import { Request, Response, NextFunction } from 'express';
import { pool, query } from '../../shared/config/db';
import { emitOrder, emitToUser, emitDeliveryPosition, emitDeliveryStatus } from '../../shared/lib/realtime';
import { resolveBucaramangaCoords, BUCARAMANGA_DESTINATIONS, BUCARAMANGA_DISPATCH_HUBS } from '../../shared/lib/bucaramangaGeo';
import { haversineMeters, estimateEtaMinutes, insideGeofence, isValidCoord, slicePolyline } from './deliveries.geo';
import { redactDelivery, checkConfirmRateLimit, registerConfirmFailure, codesMatch, confirmAttempts, confirmKey, positionThrottle, MIN_PING_MS, MIN_MOVE_M, resolveActiveDriverForSupplier } from './deliveries.service';
import { deliverySelect, deliveryAccessWhere, deliveryListScope, getFullDelivery, getDriverLocation, getDeliveryItems, getOrderItems, getDeliveryForOrder, getRouteLastPosition, getRouteHistory, getOrderStatus, getDriverLocationFull, getVehicleForUpdate } from './deliveries.repository';
import { nextBusinessCode, nextConfirmationCode } from '../../shared/lib/codes';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const scope = deliveryListScope(user);
    const params: unknown[] = [...scope.params];
    let sql = `${deliverySelect()} WHERE 1=1${scope.clause}`;
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND d.status = $${params.length}`;
    }
    sql += ' ORDER BY d.created_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows.map((row) => redactDelivery(row, user)));
  } catch (err) {
    next(err);
  }
}

export async function myDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await query(
      `${deliverySelect()}
       WHERE d.driver_id = $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [user.id]
    );
    res.json(result.rows.map((row) => redactDelivery(row, user)));
  } catch (err) {
    next(err);
  }
}

export async function live(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const scope = deliveryListScope(user);
    const params: unknown[] = [...scope.params];
    // Posición vigente: del vehículo si tiene, si no del domiciliario (driver_locations)
    let sql = `${deliverySelect()}
       WHERE d.status IN ('asignado', 'en_camino', 'llegando')
         AND (
           (v.current_lat IS NOT NULL AND v.last_location_update > now() - interval '5 minutes')
           OR EXISTS (SELECT 1 FROM driver_locations dl
                       WHERE dl.driver_id = d.driver_id
                         AND dl.recorded_at > now() - interval '5 minutes')
         )`;
    if (scope.denied) return res.status(403).json({ error: 'No autorizado' });
    sql += scope.clause;
    sql += ' ORDER BY d.updated_at DESC LIMIT 100';
    const result = await query(sql, params);

    // Resolver posición vigente: vehículo primero, si no el domiciliario
    const rows = [];
    for (const r of result.rows) {
      let lat = r.vehicle_lat !== null && r.vehicle_lat !== undefined ? Number(r.vehicle_lat) : null;
      let lng = r.vehicle_lng !== null && r.vehicle_lng !== undefined ? Number(r.vehicle_lng) : null;
      let updatedAt = r.last_location_update ?? null;
      if ((lat === null || lng === null) && r.driver_id) {
        const dl = await getDriverLocation(r.driver_id);
        if (dl.rowCount) {
          lat = Number(dl.rows[0].lat);
          lng = Number(dl.rows[0].lng);
          updatedAt = dl.rows[0].recorded_at;
        }
      }
      rows.push({
        ...redactDelivery(r, user),
        position: lat !== null && lng !== null ? { lat, lng, recorded_at: updatedAt } : null,
        eta_min:
          lat !== null && lng !== null
            ? estimateEtaMinutes(lat, lng, Number(r.dest_lat), Number(r.dest_lng))
            : null,
      });
    }
    res.json(rows);
  } catch (err) {
    next(err);
  }
}
// Las columnas de asignación de vehículos y las coordenadas reales se
// gestionan en lib/migrations.ts. No se mutan datos de demo en cada arranque.
export async function vehicles(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const safeColumns = `v.id, v.supplier_id, v.name, v.plate, v.type, v.status, v.driver_id,
                         v.current_lat, v.current_lng, v.last_location_update,
                         v.gps_validated, v.gps_last_seen, v.is_active, v.created_at, v.updated_at`;
    const adminColumns = user.role === 'admin' || user.role === 'proveedor_admin' ? ', v.imei' : '';
    let sql = `
      SELECT ${safeColumns}${adminColumns}, u.name AS driver_name, u.phone AS driver_phone, u.username AS driver_username
      FROM vehicles v
      LEFT JOIN users u ON u.id = v.driver_id
      WHERE v.is_active = TRUE
    `;
    const params: unknown[] = [];
    if (user.role === 'proveedor_admin') {
      if (!user.supplier_id) return res.status(403).json({ error: 'El usuario proveedor no tiene un proveedor asociado' });
      params.push(user.supplier_id);
      sql += ` AND v.supplier_id = $${params.length}`;
    } else if (user.role === 'gerente') {
      // El restaurante solo puede ver la flota de proveedores con los que opera.
      params.push(user.restaurant_id);
      sql += ` AND v.supplier_id IN (SELECT DISTINCT o.supplier_id FROM orders o WHERE o.restaurant_id = $${params.length})`;
    }
    sql += ' ORDER BY v.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function drivers(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let supplierFilter = '';
    if (user.role === 'proveedor_admin') {
      if (!user.supplier_id) {
        return res.status(403).json({ error: 'El usuario proveedor no tiene un proveedor asociado' });
      }
      params.push(user.supplier_id);
      supplierFilter = ` AND u.supplier_id = $${params.length}`;
    }
    const result = await query(
      `SELECT u.id, u.name, u.username, u.phone, u.email, r.name AS role_name, r.display_name AS role_label
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = TRUE
         AND r.name = 'domiciliario'${supplierFilter}
       ORDER BY u.name ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const access = deliveryAccessWhere(user, 2);
    const result = await query(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
    if (!result.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const delivery = result.rows[0];
    const items = await getDeliveryItems(req.params.id);
    const orderItems = await getOrderItems(delivery.order_id);
    res.json({ ...redactDelivery(delivery, user), items: items.rows, order_items: orderItems.rows });
  } catch (err) {
    next(err);
  }
}

export async function track(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const access = deliveryAccessWhere(user, 2);
    const delivery = await query(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];

    const active = ['asignado', 'en_camino', 'llegando'].includes(del.status);

    // Posición actual: driver_locations primero (no requiere vehículo), luego vehículo
    let position: Record<string, unknown> | null = null;
    if (del.driver_id) {
      const dl = await getDriverLocationFull(del.driver_id);
      if (dl.rowCount) position = dl.rows[0];
    }
    if (!position && del.vehicle_lat !== null && del.vehicle_lat !== undefined) {
      position = {
        lat: del.vehicle_lat,
        lng: del.vehicle_lng,
        recorded_at: del.last_location_update,
        speed: null,
      };
    }
    if (!active) position = null; // entregado/fallido: sin tracking

    const route = await getRouteHistory(del.id);

    const etaMin =
      position && active
        ? estimateEtaMinutes(
            Number(position.lat),
            Number(position.lng),
            Number(del.dest_lat),
            Number(del.dest_lng),
            position.speed ? Number(position.speed) : null
          )
        : null;

    const distanceM =
      position && active
        ? Math.round(
            haversineMeters(
              Number(position.lat),
              Number(position.lng),
              Number(del.dest_lat),
              Number(del.dest_lng)
            )
          )
        : null;

    res.json({
      delivery_id: del.id,
      delivery_code: del.delivery_code,
      status: del.status,
      active,
      driver: del.driver_id
        ? { id: del.driver_id, name: del.driver_name, phone: del.driver_phone }
        : null,
      vehicle: del.vehicle_id
        ? { id: del.vehicle_id, name: del.vehicle_name, plate: del.plate }
        : null,
      position,
      destination: {
        lat: Number(del.dest_lat),
        lng: Number(del.dest_lng),
        address: del.delivery_address,
      },
      distance_m: distanceM,
      eta_min: etaMin,
      polyline: slicePolyline(route.rows),
      points_count: route.rows.length,
    });
  } catch (err) {
    next(err);
  }
}
