import { Request, Response, NextFunction } from 'express';
import { pool, query } from '../../shared/config/db';
import { emitOrder, emitToUser, emitDeliveryPosition, emitDeliveryStatus } from '../../shared/lib/realtime';
import { resolveBucaramangaCoords, BUCARAMANGA_DESTINATIONS, BUCARAMANGA_DISPATCH_HUBS } from '../../shared/lib/bucaramangaGeo';
import { haversineMeters, estimateEtaMinutes, insideGeofence, isValidCoord, slicePolyline } from './deliveries.geo';
import { redactDelivery, checkConfirmRateLimit, registerConfirmFailure, codesMatch, confirmAttempts, confirmKey, positionThrottle, MIN_PING_MS, MIN_MOVE_M, resolveActiveDriverForSupplier } from './deliveries.service';
import { deliverySelect, deliveryAccessWhere, deliveryListScope, getFullDelivery, getDriverLocation, getDeliveryItems, getOrderItems, getDeliveryForOrder, getRouteLastPosition, getRouteHistory, getOrderStatus, getDriverLocationFull, getVehicleForUpdate } from './deliveries.repository';
import { nextBusinessCode, nextConfirmationCode } from '../../shared/lib/codes';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { order_id, vehicle_id, driver_id, delivery_address, scheduled_time, notes, items, dest_lat, dest_lng } = req.body;
    const orderParams: unknown[] = [order_id];
    let orderSql = 'SELECT * FROM orders WHERE id = $1';
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      orderParams.push(user.supplier_id);
      orderSql += ` AND supplier_id = $${orderParams.length}`;
    } else if (user.restaurant_id) {
      orderParams.push(user.restaurant_id);
      orderSql += ` AND restaurant_id = $${orderParams.length}`;
    }
    const order = await query(orderSql, orderParams);
    if (!order.rowCount) return res.status(404).json({ error: 'Pedido no encontrado o no autorizado' });

    // Validar que conductor y vehículo pertenezcan al proveedor del pedido
    // (evita asignaciones cruzadas entre inquilinos).
    const orderSupplierId = order.rows[0].supplier_id;
    if (driver_id) {
      const { reason } = await resolveActiveDriverForSupplier(driver_id, orderSupplierId);
      if (reason === 'missing' || reason === 'wrong_role') {
        return res.status(400).json({ error: 'El domiciliario seleccionado no existe o está inactivo' });
      }
      if (reason === 'foreign_supplier' && user.role !== 'admin') {
        return res.status(403).json({ error: 'El domiciliario no pertenece al proveedor del pedido' });
      }
    }
    if (vehicle_id) {
      const vehicle = await query(
        'SELECT id, supplier_id FROM vehicles WHERE id = $1 AND is_active = TRUE',
        [Number(vehicle_id)]
      );
      if (!vehicle.rowCount) {
        return res.status(400).json({ error: 'El vehículo seleccionado no existe o está inactivo' });
      }
      if (user.role !== 'admin' && Number(vehicle.rows[0].supplier_id) !== Number(orderSupplierId)) {
        return res.status(403).json({ error: 'El vehículo no pertenece al proveedor del pedido' });
      }
    }

    // Verificar si ya existe una entrega para este pedido
    const existing = await getDeliveryForOrder(order_id);
    let deliveryRow;

    const targetAddress = delivery_address ?? order.rows[0].delivery_address;
    const resolvedGeo = resolveBucaramangaCoords(targetAddress, order_id);
    const finalLat = dest_lat ? Number(dest_lat) : resolvedGeo.lat;
    const finalLng = dest_lng ? Number(dest_lng) : resolvedGeo.lng;
    const finalAddress = targetAddress || resolvedGeo.address;

    if (existing.rowCount) {
      // Actualizar la entrega existente
      const updated = await query(
        `UPDATE deliveries
         SET vehicle_id = COALESCE($1, vehicle_id),
             driver_id = COALESCE($2, driver_id),
             delivery_address = COALESCE($3, delivery_address),
             scheduled_time = COALESCE($4, scheduled_time),
             notes = COALESCE($5, notes),
             dest_lat = COALESCE($6, dest_lat),
             dest_lng = COALESCE($7, dest_lng),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [vehicle_id ? Number(vehicle_id) : null,
         driver_id ? Number(driver_id) : null,
         finalAddress,
         scheduled_time || null, notes,
         finalLat, finalLng,
         existing.rows[0].id]
      );
      deliveryRow = updated.rows[0];
    } else {
      // Insertar nueva entrega
      const code = nextBusinessCode('DEL');
      const confirmationCode = nextConfirmationCode();
      const result = await query(
        `INSERT INTO deliveries (delivery_code, order_id, vehicle_id, driver_id, restaurant_id,
           delivery_address, scheduled_time, notes, confirmation_code, dest_lat, dest_lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [code, order_id, vehicle_id ? Number(vehicle_id) : null, driver_id ? Number(driver_id) : null, order.rows[0].restaurant_id,
         finalAddress, scheduled_time || null, notes, confirmationCode,
         finalLat, finalLng]
      );
      deliveryRow = result.rows[0];
      if (Array.isArray(items)) {
        for (const it of items) {
          await query(
            `INSERT INTO delivery_items (delivery_id, product_name, quantity, unit) VALUES ($1, $2, $3, $4)`,
            [deliveryRow.id, it.product_name, it.quantity, it.unit]
          );
        }
      }
    }

    // Si se asignó conductor y el pedido estaba en nuevo/confirmado/preparando, avanzar a despachado
    if (driver_id && ['nuevo', 'confirmado', 'preparando'].includes(order.rows[0].status)) {
      await query("UPDATE orders SET status = 'despachado', dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [order_id]);
      const updatedOrder = await getFullDelivery(deliveryRow.id);
      emitOrder('order:updated', updatedOrder.rows[0]);
    }

    if (driver_id) {
      emitToUser('notification:created', Number(driver_id), {
        message: `Se te asignó la entrega ${deliveryRow.delivery_code} del pedido ${order.rows[0].order_code}`,
        delivery_id: deliveryRow.id,
      });
    }

    const fullDelivery = await getFullDelivery(deliveryRow.id);
    const deliveryFull = fullDelivery.rows[0] ?? deliveryRow;
    emitDeliveryStatus(deliveryFull, { delivery_id: deliveryFull.id, status: deliveryFull.status, delivery_code: deliveryFull.delivery_code, restaurant_id: deliveryFull.restaurant_id, supplier_id: deliveryFull.order_supplier_id });
    res.status(existing.rowCount ? 200 : 201).json(redactDelivery(deliveryFull, user));
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction) {
  let client: import('pg').PoolClient | null = null;
  try {
    const user = req.user!;
    const driverId = Number(req.body.driver_id);
    const vehicleId = Number(req.body.vehicle_id);
    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({ error: 'Selecciona un domiciliario válido' });
    }
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return res.status(400).json({ error: 'Selecciona un vehículo válido' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const access = deliveryAccessWhere(user, 2);
    const delivery = await client.query(
      `${deliverySelect()} WHERE d.id = $1${access.clause} FOR UPDATE OF d`,
      [req.params.id, ...access.params]
    );
    if (!delivery.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Entrega no encontrada o no autorizada' });
    }
    const del = delivery.rows[0];
    const driverClient = client;
    const { driver, reason } = await resolveActiveDriverForSupplier(
      driverId,
      del.order_supplier_id,
      (sql, params) => driverClient.query(sql, params)
    );
    if (reason === 'missing') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El usuario seleccionado no existe o está inactivo' });
    }
    if (reason === 'wrong_role') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El usuario seleccionado no tiene el rol de domiciliario' });
    }
    if (reason === 'foreign_supplier' && user.role !== 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'El domiciliario no pertenece al proveedor del pedido' });
    }

    const vehicle = await client.query(
      `SELECT id FROM vehicles
       WHERE id = $1 AND is_active = TRUE
         AND ($2::boolean = TRUE OR supplier_id = $3)
       FOR UPDATE`,
      [vehicleId, user.role === 'admin', del.order_supplier_id]
    );
    if (!vehicle.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El vehículo no está activo o no pertenece al proveedor del pedido' });
    }

    const confirmationCode = del.confirmation_code || nextConfirmationCode();
    await client.query(
      `UPDATE vehicles SET driver_id = $1, driver_name = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [driverId, driver?.name, vehicleId]
    );
    const result = await client.query(
      `UPDATE deliveries
       SET driver_id = $1, vehicle_id = $2, confirmation_code = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [driverId, vehicleId, confirmationCode, req.params.id]
    );
    await client.query('COMMIT');

    // Sincronizar estado del pedido a despachado si aún no lo estaba
    const currentOrder = await query('SELECT id, status, order_code FROM orders WHERE id = $1', [del.order_id]);
    if (currentOrder.rowCount && ['nuevo', 'confirmado', 'preparando'].includes(currentOrder.rows[0].status)) {
      await query("UPDATE orders SET status = 'despachado', dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
      const updatedOrder = await query(
        `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`,
        [del.order_id]
      );
      emitOrder('order:updated', updatedOrder.rows[0]);
    }

    emitToUser('notification:created', driverId, {
      message: `Se te asignó la entrega ${del.delivery_code}`,
      delivery_id: del.id,
      confirmation_code: confirmationCode,
    });
    const assignedFull = await getFullDelivery(del.id);
    const assignedRow = assignedFull.rows[0] ?? { ...del, status: result.rows[0].status };
    emitDeliveryStatus(assignedRow, { delivery_id: del.id, status: result.rows[0].status, delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });
    res.json(redactDelivery(assignedRow, user));
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error revirtiendo la asignación de entrega:', rollbackError);
      }
    }
    next(err);
  } finally {
    client?.release();
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { status } = req.body;
    const valid = ['asignado', 'en_camino', 'llegando', 'entregado', 'fallido'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado de entrega inválido' });
    const access = deliveryAccessWhere(user, 2);
    const delivery = await query(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.role === 'domiciliario' && !['en_camino', 'llegando'].includes(status)) {
      return res.status(403).json({ error: 'El domiciliario solo puede cambiar a en_camino o llegando' });
    }
    if ((user.role === 'gerente' || user.role === 'empleado') && status !== 'fallido') {
      return res.status(403).json({ error: 'El restaurante solo puede reportar la entrega como fallida' });
    }
    if (status === 'entregado' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'La entrega solo se completa con el código de confirmación. Usa POST /:id/confirm.',
      });
    }
    const deliveredSql = status === 'entregado' ? ', actual_delivery_time = CURRENT_TIMESTAMP' : '';
    await query(
      `UPDATE deliveries SET status = $1, updated_at = CURRENT_TIMESTAMP${deliveredSql} WHERE id = $2`,
      [status, req.params.id]
    );
    if (status === 'en_camino') {
      await query("UPDATE orders SET status = 'en_camino', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
      const updated = await query(
        `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`,
        [del.order_id]
      );
      emitOrder('order:updated', updated.rows[0]);
    }
    if (status === 'entregado') {
      await query("UPDATE orders SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
      const updated = await query(
        `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`,
        [del.order_id]
      );
      emitOrder('order:updated', updated.rows[0]);
    }
    emitDeliveryStatus(del, { delivery_id: del.id, status, delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });
    const statusFull = await getFullDelivery(del.id);
    res.json(redactDelivery(statusFull.rows[0] ?? { ...del, status }, user));
  } catch (err) {
    next(err);
  }
}

export async function confirm(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { confirmation_code } = req.body;
    if (!confirmation_code) return res.status(400).json({ error: 'La llave o código de confirmación es requerido' });

    const access = deliveryAccessWhere(user, 2);
    const delivery = await query(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada o no autorizada' });
    const del = delivery.rows[0];

    if (del.status === 'entregado') {
      return res.status(400).json({ error: 'Esta entrega ya fue confirmada previamente' });
    }
    if (!checkConfirmRateLimit(user.id, del.id)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera unos minutos o solicita un nuevo código.' });
    }

    // Validación estricta del código / llave de entrega
    if (!codesMatch(del.confirmation_code, confirmation_code)) {
      registerConfirmFailure(user.id, del.id);
      return res.status(401).json({ error: 'Llave de entrega incorrecta. Verifica el código con el domiciliario.' });
    }
    confirmAttempts.delete(confirmKey(user.id, del.id));

    await query(
      `UPDATE deliveries SET status = 'entregado', actual_delivery_time = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [req.params.id]
    );

    await query(
      `UPDATE orders SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [del.order_id]
    );

    const order = await query(
      `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
       WHERE o.id = $1`,
      [del.order_id]
    );

    if (order.rowCount) emitOrder('order:updated', order.rows[0]);
    emitDeliveryStatus(del, { delivery_id: del.id, status: 'entregado', delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });

    // Notificar al domiciliario si fue el gerente quien ingresó la llave
    if (del.driver_id) {
      emitToUser('notification:created', del.driver_id, {
        message: `El restaurante confirmó la entrega del pedido ${del.delivery_code} con tu llave`,
        delivery_id: del.id,
      });
    }

    res.json({ message: 'Envío completado exitosamente con la llave de entrega', delivery: redactDelivery({ ...del, status: 'entregado' }, user) });
  } catch (err) {
    next(err);
  }
}

export async function updatePosition(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { lat, lng, speed, heading, accuracy } = req.body;
    if (!isValidCoord(lat, lng)) {
      return res.status(400).json({ error: 'lat/lng inválidos (rango fuera de coordenadas válidas)' });
    }
    const access = deliveryAccessWhere(user, 2);
    const delivery = await query(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (['entregado', 'fallido'].includes(del.status)) {
      return res.status(400).json({ error: 'La entrega ya finalizó, se dejó de rastrear' });
    }

    const latN = Number(lat);
    const lngN = Number(lng);
    const speedN = speed === undefined || speed === null ? null : Number(speed);

    // Throttle en servidor: ignorar pings más frecuentes que 5 s
    const lastPing = positionThrottle.get(del.id) ?? 0;
    const now = Date.now();
    if (now - lastPing < MIN_PING_MS) {
      return res.json({ ok: true, throttled: true });
    }
    positionThrottle.set(del.id, now);

    // Última posición registrada (para el umbral de movimiento)
    const last = await getRouteLastPosition(del.id);
    const moved = !last.rowCount
      ? true
      : haversineMeters(latN, lngN, Number(last.rows[0].lat), Number(last.rows[0].lng)) >= MIN_MOVE_M;

    // Upsert de la posición del domiciliario (funciona con o sin vehículo)
    await query(
      `INSERT INTO driver_locations (driver_id, delivery_id, lat, lng, speed, heading, accuracy)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (driver_id) DO UPDATE
         SET delivery_id = EXCLUDED.delivery_id, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
             speed = EXCLUDED.speed, heading = EXCLUDED.heading, accuracy = EXCLUDED.accuracy,
             recorded_at = CURRENT_TIMESTAMP`,
      [user.id, del.id, latN, lngN, speedN, heading ?? null, accuracy ?? null]
    );
    if (del.vehicle_id) {
      await query(
        `UPDATE vehicles SET current_lat = $1, current_lng = $2, last_location_update = CURRENT_TIMESTAMP,
          gps_last_seen = CURRENT_TIMESTAMP WHERE id = $3`,
        [latN, lngN, del.vehicle_id]
      );
    }
    if (moved) {
      await query(
        `INSERT INTO route_history (vehicle_id, delivery_id, driver_id, lat, lng, speed, heading, accuracy)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [del.vehicle_id ?? null, del.id, user.id, latN, lngN, speedN, heading ?? null, accuracy ?? null]
      );
    }

    // ETA hacia el destino de la entrega
    const etaMin = estimateEtaMinutes(latN, lngN, Number(del.dest_lat), Number(del.dest_lng), speedN);

    // Geocerca automática: < 500 m con status 'en_camino' => 'llegando'
    let statusChanged: string | null = null;
    if (del.status === 'en_camino' && insideGeofence(latN, lngN, Number(del.dest_lat), Number(del.dest_lng))) {
      await query(`UPDATE deliveries SET status = 'llegando', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [del.id]);
      statusChanged = 'llegando';
      const currentOrder = await getOrderStatus(del.order_id);
      if (currentOrder.rowCount && currentOrder.rows[0].status === 'en_camino') {
        await query(`UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [del.order_id]);
      }
      emitDeliveryStatus(del, {
        delivery_id: del.id,
        status: 'llegando',
        delivery_code: del.delivery_code,
        auto: true,
      });
      emitToUser('notification:created', del.driver_id ?? 0, {
        message: `Estás llegando al destino de ${del.delivery_code} (geocerca detectada)`,
        delivery_id: del.id,
      });
    }

    const payload = {
      delivery_id: del.id,
      order_id: del.order_id,
      restaurant_id: del.restaurant_id,
      driver_id: del.driver_id,
      driver_name: del.driver_name,
      lat: latN,
      lng: lngN,
      speed: speedN,
      heading: heading ?? null,
      accuracy: accuracy ?? null,
      eta_min: etaMin,
      status: statusChanged ?? del.status,
      recorded_at: new Date().toISOString(),
    };
    emitDeliveryPosition(del, payload);

    res.json({ ok: true, eta_min: etaMin, status: payload.status });
  } catch (err) {
    next(err);
  }
}
