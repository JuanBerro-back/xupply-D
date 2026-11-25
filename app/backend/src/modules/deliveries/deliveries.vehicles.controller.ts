import { Request, Response, NextFunction } from 'express';
import { pool, query } from '../../shared/config/db';
import { emitOrder, emitToUser, emitDeliveryPosition, emitDeliveryStatus } from '../../shared/lib/realtime';
import { resolveBucaramangaCoords, BUCARAMANGA_DESTINATIONS, BUCARAMANGA_DISPATCH_HUBS } from '../../shared/lib/bucaramangaGeo';
import { haversineMeters, estimateEtaMinutes, insideGeofence, isValidCoord, slicePolyline } from './deliveries.geo';
import { redactDelivery, checkConfirmRateLimit, registerConfirmFailure, codesMatch, confirmAttempts, confirmKey, positionThrottle, MIN_PING_MS, MIN_MOVE_M, resolveActiveDriverForSupplier } from './deliveries.service';
import { deliverySelect, deliveryAccessWhere, deliveryListScope, getFullDelivery, getDriverLocation, getDeliveryItems, getOrderItems, getDeliveryForOrder, getRouteLastPosition, getRouteHistory, getOrderStatus, getDriverLocationFull, getVehicleForUpdate } from './deliveries.repository';
import { nextBusinessCode, nextConfirmationCode } from '../../shared/lib/codes';

export async function createVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { name, plate, type, driver_id, imei } = req.body;
    if (!name || !plate) return res.status(400).json({ error: 'name y plate son obligatorios' });
    if (imei && String(imei).length > 20) return res.status(400).json({ error: 'imei inválido' });

    const supplierId = user.role === 'admin' ? Number(req.body.supplier_id) : user.supplier_id;
    if (!supplierId || !Number.isInteger(supplierId)) {
      return res.status(400).json({ error: 'supplier_id es obligatorio para crear un vehículo' });
    }
    if (user.role === 'proveedor_admin' && Number(supplierId) !== Number(user.supplier_id)) {
      return res.status(403).json({ error: 'No autorizado para crear vehículos de otro proveedor' });
    }

    let driverName = req.body.driver_name || null;
    if (driver_id) {
      const { driver, reason } = await resolveActiveDriverForSupplier(driver_id, supplierId);
      if (reason === 'missing' || reason === 'wrong_role') {
        return res.status(400).json({ error: 'El conductor debe ser un domiciliario activo' });
      }
      if (reason === 'foreign_supplier') {
        return res.status(403).json({ error: 'El conductor no pertenece al proveedor' });
      }
      driverName = driver?.name ?? null;
    }

    const result = await query(
      `INSERT INTO vehicles (supplier_id, name, plate, type, driver_id, driver_name, imei, gps_validated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [supplierId, name, plate, type ?? 'moto', driver_id ? Number(driver_id) : null, driverName, imei || null, Boolean(imei)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateVehicle(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { name, plate, type, driver_id, imei } = req.body;
    if (imei && String(imei).length > 20) return res.status(400).json({ error: 'imei inválido' });

    const vehicle = await getVehicleForUpdate(req.params.id, user.role === 'admin', user.supplier_id);
    if (!vehicle.rowCount) return res.status(404).json({ error: 'Vehículo no encontrado' });

    let driverName = req.body.driver_name || null;
    if (driver_id) {
      const { driver, reason } = await resolveActiveDriverForSupplier(driver_id, vehicle.rows[0].supplier_id);
      if (reason === 'missing' || reason === 'wrong_role') {
        return res.status(400).json({ error: 'El conductor debe ser un domiciliario activo' });
      }
      if (reason === 'foreign_supplier') {
        return res.status(403).json({ error: 'El conductor no pertenece al proveedor del vehículo' });
      }
      driverName = driver?.name ?? null;
    }

    const result = await query(
      `UPDATE vehicles
       SET name = COALESCE($1, name),
           plate = COALESCE($2, plate),
           type = COALESCE($3, type),
           driver_id = $4,
           driver_name = COALESCE($5, driver_name),
           imei = COALESCE($6, imei),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, plate, type, driver_id ? Number(driver_id) : null, driverName, imei || null, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateVehicleGps(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { imei, gps_validated } = req.body;
    if (imei && String(imei).length > 20) return res.status(400).json({ error: 'imei inválido' });
    const result = await query(
      `UPDATE vehicles SET imei = $1, gps_validated = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND ($4::boolean = TRUE OR supplier_id = $5) RETURNING *`,
      [imei || null, Boolean(gps_validated), req.params.id, user.role === 'admin', user.supplier_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
