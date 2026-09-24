import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { emitOrder, emitToUser, emitDeliveryPosition, emitDeliveryStatus } from '../lib/realtime';
import { resolveBucaramangaCoords, BUCARAMANGA_DESTINATIONS, BUCARAMANGA_DISPATCH_HUBS } from '../lib/bucaramangaGeo';
import { haversineMeters, estimateEtaMinutes, insideGeofence, isValidCoord, slicePolyline } from '../lib/geo';

const router = Router();
router.use(authRequired);

function deliverySelect() {
  return `SELECT d.*, o.order_code, o.total AS order_total, o.notes AS order_notes,
                 o.supplier_id AS order_supplier_id,
                 r.name AS restaurant_name, r.phone AS restaurant_phone,
                 r.address AS restaurant_address,
                 v.name AS vehicle_name, v.plate, v.type AS vehicle_type,
                 v.current_lat AS vehicle_lat, v.current_lng AS vehicle_lng,
                 v.last_location_update, v.imei, v.gps_validated, v.gps_last_seen,
                 u.name AS driver_name, u.phone AS driver_phone,
                 s.name AS supplier_name, s.phone AS supplier_phone
          FROM deliveries d
          JOIN orders o ON o.id = d.order_id
          JOIN restaurants r ON r.id = d.restaurant_id
          JOIN suppliers s ON s.id = o.supplier_id
          LEFT JOIN vehicles v ON v.id = d.vehicle_id
          LEFT JOIN users u ON u.id = d.driver_id`;
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `${deliverySelect()} WHERE 1=1`;
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND o.supplier_id = $${params.length}`;
    } else if (user.role === 'domiciliario') {
      params.push(user.id);
      sql += ` AND d.driver_id = $${params.length}`;
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      sql += ` AND d.restaurant_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND d.status = $${params.length}`;
    }
    sql += ' ORDER BY d.created_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/my-deliveries', roleRequired('domiciliario'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `${deliverySelect()}
       WHERE d.driver_id = $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Entregas activas en el mapa (flota del proveedor / seguimiento del restaurante)
router.get('/live', async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    // Posición vigente: del vehículo si tiene, si no del domiciliario (driver_locations)
    let sql = `${deliverySelect()}
       WHERE d.status IN ('asignado', 'en_camino', 'llegando')
         AND (
           (v.current_lat IS NOT NULL AND v.last_location_update > now() - interval '5 minutes')
           OR EXISTS (SELECT 1 FROM driver_locations dl
                       WHERE dl.driver_id = d.driver_id
                         AND dl.recorded_at > now() - interval '5 minutes')
         )`;
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND o.supplier_id = $${params.length}`;
    } else if (user.role === 'domiciliario') {
      params.push(user.id);
      sql += ` AND d.driver_id = $${params.length}`;
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      sql += ` AND d.restaurant_id = $${params.length}`;
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    sql += ' ORDER BY d.updated_at DESC LIMIT 100';
    const result = await query(sql, params);

    // Resolver posición vigente: vehículo primero, si no el domiciliario
    const rows = [];
    for (const r of result.rows) {
      let lat = r.vehicle_lat !== null && r.vehicle_lat !== undefined ? Number(r.vehicle_lat) : null;
      let lng = r.vehicle_lng !== null && r.vehicle_lng !== undefined ? Number(r.vehicle_lng) : null;
      let updatedAt = r.last_location_update ?? null;
      if ((lat === null || lng === null) && r.driver_id) {
        const dl = await query('SELECT lat, lng, recorded_at FROM driver_locations WHERE driver_id = $1', [r.driver_id]);
        if (dl.rowCount) {
          lat = Number(dl.rows[0].lat);
          lng = Number(dl.rows[0].lng);
          updatedAt = dl.rows[0].recorded_at;
        }
      }
      rows.push({
        ...r,
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
});

// Asegurar columnas de asignación de vehículos y coordenadas reales en Bucaramanga
query(`
  ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_id INT;
  ALTER TABLE vehicles ALTER COLUMN supplier_id DROP NOT NULL;

  -- Actualizar destinos de entregas existentes con direcciones reales emblemáticas de Bucaramanga
  UPDATE deliveries
  SET dest_lat = 7.1168, dest_lng = -73.1095,
      delivery_address = 'Carrera 35 #48-22, Cabecera del Llano, Bucaramanga'
  WHERE id % 4 = 1;

  UPDATE deliveries
  SET dest_lat = 7.0665, dest_lng = -73.1030,
      delivery_address = 'Calle 30 #26-10, Parque Caracolí / Cañaveral, Floridablanca'
  WHERE id % 4 = 2;

  UPDATE deliveries
  SET dest_lat = 7.0845, dest_lng = -73.1175,
      delivery_address = 'Calle 105 #24-32, Provenza, Bucaramanga'
  WHERE id % 4 = 3;

  UPDATE deliveries
  SET dest_lat = 7.0984, dest_lng = -73.1090,
      delivery_address = 'Transversal 93 #34-99, El Tejar / C.C. Cacique, Bucaramanga'
  WHERE id % 4 = 0;

  -- Actualizar coordenadas de vehículos en hubs logísticos reales
  UPDATE vehicles
  SET current_lat = 7.1320, current_lng = -73.1650
  WHERE id % 3 = 1;

  UPDATE vehicles
  SET current_lat = 7.0850, current_lng = -73.1680
  WHERE id % 3 = 2;

  UPDATE vehicles
  SET current_lat = 7.1235, current_lng = -73.1285
  WHERE id % 3 = 0;
`).catch(() => undefined);

router.get('/vehicles', roleRequired('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    let sql = `
      SELECT v.*, u.name AS driver_name, u.phone AS driver_phone, u.username AS driver_username
      FROM vehicles v
      LEFT JOIN users u ON u.id = v.driver_id
      WHERE v.is_active = TRUE
    `;
    const params: unknown[] = [];
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      params.push(user.supplier_id);
      sql += ` AND (v.supplier_id = $1 OR v.supplier_id IS NULL)`;
    }
    sql += ' ORDER BY v.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/drivers', roleRequired('proveedor_admin', 'admin', 'gerente'), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.username, u.phone, u.email, r.name AS role_name, r.display_name AS role_label
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = TRUE
       ORDER BY (r.name = 'domiciliario') DESC, u.name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(`${deliverySelect()} WHERE d.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const delivery = result.rows[0];
    if (user.role === 'domiciliario' && delivery.driver_id !== user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      const order = await query('SELECT supplier_id FROM orders WHERE id = $1', [delivery.order_id]);
      if (order.rowCount && order.rows[0].supplier_id !== user.supplier_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }
    const items = await query('SELECT * FROM delivery_items WHERE delivery_id = $1', [req.params.id]);
    const orderItems = await query('SELECT * FROM order_items WHERE order_id = $1', [delivery.order_id]);
    res.json({ ...delivery, items: items.rows, order_items: orderItems.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { order_id, vehicle_id, driver_id, delivery_address, scheduled_time, notes, items, dest_lat, dest_lng } = req.body;
    const orderParams: unknown[] = [order_id];
    let orderSql = 'SELECT * FROM orders WHERE id = $1';
    if (user.role === 'proveedor_admin' && user.supplier_id) {
      orderParams.push(user.supplier_id);
      orderSql += ` AND supplier_id = $${orderParams.length}`;
    }
    const order = await query(orderSql, orderParams);
    if (!order.rowCount) return res.status(404).json({ error: 'Pedido no encontrado o no autorizado' });

    // Verificar si ya existe una entrega para este pedido
    const existing = await query('SELECT * FROM deliveries WHERE order_id = $1', [order_id]);
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
      const code = `DEL-${Date.now().toString(36).toUpperCase()}`;
      const confirmationCode = String(Math.floor(1000 + Math.random() * 9000));
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
      const updatedOrder = await query(`${deliverySelect()} WHERE d.id = $1`, [deliveryRow.id]);
      emitOrder('order:updated', updatedOrder.rows[0]);
    }

    if (driver_id) {
      emitToUser('notification:created', Number(driver_id), {
        message: `Se te asignó la entrega ${deliveryRow.delivery_code} del pedido ${order.rows[0].order_code}`,
        delivery_id: deliveryRow.id,
      });
    }

    emitDeliveryStatus(deliveryRow, { delivery_id: deliveryRow.id, status: deliveryRow.status, delivery_code: deliveryRow.delivery_code, restaurant_id: deliveryRow.restaurant_id, supplier_id: deliveryRow.order_supplier_id });
    res.status(existing.rowCount ? 200 : 201).json(deliveryRow);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/assign', roleRequired('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { driver_id } = req.body;
    if (!driver_id) return res.status(400).json({ error: 'driver_id es requerido' });
    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.supplier_id) {
      const order = await query('SELECT supplier_id FROM orders WHERE id = $1', [del.order_id]);
      if (order.rowCount && order.rows[0].supplier_id !== user.supplier_id) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }
    const driver = await query(
      `SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE`,
      [driver_id]
    );
    if (!driver.rowCount) {
      return res.status(400).json({ error: 'El usuario seleccionado no existe o está inactivo' });
    }
    const confirmationCode = del.confirmation_code || String(Math.floor(1000 + Math.random() * 9000));
    const result = await query(
      `UPDATE deliveries SET driver_id = $1, confirmation_code = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [driver_id, confirmationCode, req.params.id]
    );

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

    emitToUser('notification:created', driver_id, {
      message: `Se te asignó la entrega ${del.delivery_code}`,
      delivery_id: del.id,
      confirmation_code: confirmationCode,
    });
    emitDeliveryStatus(del, { delivery_id: del.id, status: result.rows[0].status, delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const user = req.user!;
    const { status } = req.body;
    const valid = ['asignado', 'en_camino', 'llegando', 'entregado', 'fallido'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Estado de entrega inválido' });
    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.role === 'domiciliario' && del.driver_id !== user.id) {
      return res.status(403).json({ error: 'Solo puedes actualizar tus propias entregas' });
    }
    if (user.role === 'domiciliario' && !['en_camino', 'llegando', 'entregado'].includes(status)) {
      return res.status(403).json({ error: 'El domiciliario solo puede cambiar a en_camino, llegando o entregado' });
    }
    if (status === 'entregado' && user.role === 'domiciliario') {
      return res.status(400).json({ error: 'Usa POST /:id/confirm con el código de confirmación para entregar' });
    }
    const deliveredSql = status === 'entregado' ? ', actual_delivery_time = CURRENT_TIMESTAMP' : '';
    const result = await query(
      `UPDATE deliveries SET status = $1, updated_at = CURRENT_TIMESTAMP${deliveredSql} WHERE id = $2 RETURNING *`,
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
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirm', roleRequired('domiciliario', 'gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { confirmation_code } = req.body;
    if (!confirmation_code) return res.status(400).json({ error: 'La llave o código de confirmación es requerido' });

    const delivery = await query('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];

    // Si es domiciliario, debe ser su entrega asignada
    if (user.role === 'domiciliario' && del.driver_id !== user.id) {
      return res.status(403).json({ error: 'Esta entrega no está asignada a ti' });
    }

    // Si es gerente, debe ser de su restaurante
    if ((user.role === 'gerente' || user.restaurant_id) && user.role !== 'admin') {
      if (del.restaurant_id !== user.restaurant_id) {
        return res.status(403).json({ error: 'No autorizado para confirmar entregas de otro restaurante' });
      }
    }

    if (del.status === 'entregado') {
      return res.status(400).json({ error: 'Esta entrega ya fue confirmada previamente' });
    }

    // Validación estricta del código / llave de entrega
    if (String(del.confirmation_code).trim() !== String(confirmation_code).trim()) {
      return res.status(401).json({ error: 'Llave de entrega incorrecta. Verifica el código con el domiciliario.' });
    }

    const result = await query(
      `UPDATE deliveries SET status = 'entregado', actual_delivery_time = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
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

    res.json({ message: 'Envío completado exitosamente con la llave de entrega', delivery: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Últimos pings por entrega, para el throttle del servidor (5 s mín.)
const positionThrottle = new Map<number, number>();
const MIN_PING_MS = 5000;
const MIN_MOVE_M = 10; // no guardar en route_history si se movió menos de 10 m

router.patch('/:id/position', async (req, res, next) => {
  try {
    const user = req.user!;
    const { lat, lng, speed, heading, accuracy } = req.body;
    if (!isValidCoord(lat, lng)) {
      return res.status(400).json({ error: 'lat/lng inválidos (rango fuera de coordenadas válidas)' });
    }
    const delivery = await query(`${deliverySelect()} WHERE d.id = $1`, [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.role === 'domiciliario' && del.driver_id !== user.id) {
      return res.status(403).json({ error: 'Solo puedes actualizar tu posición en tus entregas' });
    }
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
    const last = await query(
      `SELECT lat, lng FROM route_history
        WHERE delivery_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [del.id]
    );
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
      const currentOrder = await query('SELECT id, status FROM orders WHERE id = $1', [del.order_id]);
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
});

// Seguimiento completo: posición actual + ETA + polilínea del recorrido
router.get('/:id/track', async (req, res, next) => {
  try {
    const user = req.user!;
    const delivery = await query(`${deliverySelect()} WHERE d.id = $1`, [req.params.id]);
    if (!delivery.rowCount) return res.status(404).json({ error: 'Entrega no encontrada' });
    const del = delivery.rows[0];
    if (user.role === 'domiciliario' && del.driver_id !== user.id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.role === 'proveedor_admin' && user.supplier_id && del.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.restaurant_id && del.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const active = ['asignado', 'en_camino', 'llegando'].includes(del.status);

    // Posición actual: driver_locations primero (no requiere vehículo), luego vehículo
    let position: Record<string, unknown> | null = null;
    if (del.driver_id) {
      const dl = await query('SELECT * FROM driver_locations WHERE driver_id = $1', [del.driver_id]);
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

    const route = await query(
      `SELECT lat, lng, speed, recorded_at FROM route_history
        WHERE delivery_id = $1 ORDER BY recorded_at ASC`,
      [del.id]
    );

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
});

router.post('/vehicles', roleRequired('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, plate, type, driver_id, imei } = req.body;
    let driverName = req.body.driver_name || null;
    if (driver_id) {
      const u = await query('SELECT name FROM users WHERE id = $1', [driver_id]).catch(() => ({ rows: [] }));
      if (u.rows[0]) driverName = u.rows[0].name;
    }
    const result = await query(
      `INSERT INTO vehicles (supplier_id, name, plate, type, driver_id, driver_name, imei, gps_validated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user.supplier_id || null, name, plate, type ?? 'moto', driver_id ? Number(driver_id) : null, driverName, imei || null, Boolean(imei)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/vehicles/:id', roleRequired('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
  try {
    const { name, plate, type, driver_id, imei } = req.body;
    let driverName = req.body.driver_name || null;
    if (driver_id) {
      const u = await query('SELECT name FROM users WHERE id = $1', [driver_id]).catch(() => ({ rows: [] }));
      if (u.rows[0]) driverName = u.rows[0].name;
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
});

router.patch('/vehicles/:id/gps', roleRequired('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
  try {
    const { imei, gps_validated } = req.body;
    const result = await query(
      `UPDATE vehicles SET imei = $1, gps_validated = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [imei || null, Boolean(gps_validated), req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
