"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const realtime_1 = require("../lib/realtime");
const bucaramangaGeo_1 = require("../lib/bucaramangaGeo");
const geo_1 = require("../lib/geo");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
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
/** Restringe una entrega al inquilino del usuario (proveedor, restaurante o domiciliario). */
function deliveryAccessWhere(user, startIndex = 1) {
    if (user.role === 'proveedor_admin') {
        return { clause: ` AND o.supplier_id = $${startIndex}`, params: [user.supplier_id] };
    }
    if (user.role === 'domiciliario') {
        return { clause: ` AND d.driver_id = $${startIndex}`, params: [user.id] };
    }
    if (user.restaurant_id) {
        return { clause: ` AND d.restaurant_id = $${startIndex}`, params: [user.restaurant_id] };
    }
    return { clause: '', params: [] };
}
router.get('/', async (req, res, next) => {
    try {
        const user = req.user;
        const params = [];
        let sql = `${deliverySelect()} WHERE 1=1`;
        if (user.role === 'proveedor_admin' && user.supplier_id) {
            params.push(user.supplier_id);
            sql += ` AND o.supplier_id = $${params.length}`;
        }
        else if (user.role === 'domiciliario') {
            params.push(user.id);
            sql += ` AND d.driver_id = $${params.length}`;
        }
        else if (user.restaurant_id) {
            params.push(user.restaurant_id);
            sql += ` AND d.restaurant_id = $${params.length}`;
        }
        if (req.query.status) {
            params.push(req.query.status);
            sql += ` AND d.status = $${params.length}`;
        }
        sql += ' ORDER BY d.created_at DESC LIMIT 100';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.get('/my-deliveries', (0, auth_1.roleRequired)('domiciliario'), async (req, res, next) => {
    try {
        const user = req.user;
        const result = await (0, db_1.query)(`${deliverySelect()}
       WHERE d.driver_id = $1
       ORDER BY d.created_at DESC LIMIT 50`, [user.id]);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
// Entregas activas en el mapa (flota del proveedor / seguimiento del restaurante)
router.get('/live', async (req, res, next) => {
    try {
        const user = req.user;
        const params = [];
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
        }
        else if (user.role === 'domiciliario') {
            params.push(user.id);
            sql += ` AND d.driver_id = $${params.length}`;
        }
        else if (user.restaurant_id) {
            params.push(user.restaurant_id);
            sql += ` AND d.restaurant_id = $${params.length}`;
        }
        else if (user.role !== 'admin') {
            return res.status(403).json({ error: 'No autorizado' });
        }
        sql += ' ORDER BY d.updated_at DESC LIMIT 100';
        const result = await (0, db_1.query)(sql, params);
        // Resolver posición vigente: vehículo primero, si no el domiciliario
        const rows = [];
        for (const r of result.rows) {
            let lat = r.vehicle_lat !== null && r.vehicle_lat !== undefined ? Number(r.vehicle_lat) : null;
            let lng = r.vehicle_lng !== null && r.vehicle_lng !== undefined ? Number(r.vehicle_lng) : null;
            let updatedAt = r.last_location_update ?? null;
            if ((lat === null || lng === null) && r.driver_id) {
                const dl = await (0, db_1.query)('SELECT lat, lng, recorded_at FROM driver_locations WHERE driver_id = $1', [r.driver_id]);
                if (dl.rowCount) {
                    lat = Number(dl.rows[0].lat);
                    lng = Number(dl.rows[0].lng);
                    updatedAt = dl.rows[0].recorded_at;
                }
            }
            rows.push({
                ...r,
                position: lat !== null && lng !== null ? { lat, lng, recorded_at: updatedAt } : null,
                eta_min: lat !== null && lng !== null
                    ? (0, geo_1.estimateEtaMinutes)(lat, lng, Number(r.dest_lat), Number(r.dest_lng))
                    : null,
            });
        }
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
// Asegurar columnas de asignación de vehículos y coordenadas reales en Bucaramanga
(0, db_1.query)(`
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
router.get('/vehicles', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    try {
        const user = req.user;
        let sql = `
      SELECT v.*, u.name AS driver_name, u.phone AS driver_phone, u.username AS driver_username
      FROM vehicles v
      LEFT JOIN users u ON u.id = v.driver_id
      WHERE v.is_active = TRUE
    `;
        const params = [];
        if (user.role === 'proveedor_admin' && user.supplier_id) {
            params.push(user.supplier_id);
            sql += ` AND (v.supplier_id = $1 OR v.supplier_id IS NULL)`;
        }
        sql += ' ORDER BY v.name';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.get('/drivers', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    try {
        const user = req.user;
        const params = [];
        let supplierFilter = '';
        if (user.role === 'proveedor_admin') {
            if (!user.supplier_id) {
                return res.status(403).json({ error: 'El usuario proveedor no tiene un proveedor asociado' });
            }
            params.push(user.supplier_id);
            supplierFilter = ` AND u.supplier_id = $${params.length}`;
        }
        const result = await (0, db_1.query)(`SELECT u.id, u.name, u.username, u.phone, u.email, r.name AS role_name, r.display_name AS role_label
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.is_active = TRUE
         AND r.name = 'domiciliario'${supplierFilter}
       ORDER BY u.name ASC`, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const user = req.user;
        const access = deliveryAccessWhere(user, 2);
        const result = await (0, db_1.query)(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Entrega no encontrada' });
        const delivery = result.rows[0];
        const items = await (0, db_1.query)('SELECT * FROM delivery_items WHERE delivery_id = $1', [req.params.id]);
        const orderItems = await (0, db_1.query)('SELECT * FROM order_items WHERE order_id = $1', [delivery.order_id]);
        res.json({ ...delivery, items: items.rows, order_items: orderItems.rows });
    }
    catch (err) {
        next(err);
    }
});
router.post('/', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    try {
        const user = req.user;
        const { order_id, vehicle_id, driver_id, delivery_address, scheduled_time, notes, items, dest_lat, dest_lng } = req.body;
        const orderParams = [order_id];
        let orderSql = 'SELECT * FROM orders WHERE id = $1';
        if (user.role === 'proveedor_admin' && user.supplier_id) {
            orderParams.push(user.supplier_id);
            orderSql += ` AND supplier_id = $${orderParams.length}`;
        }
        else if (user.restaurant_id) {
            orderParams.push(user.restaurant_id);
            orderSql += ` AND restaurant_id = $${orderParams.length}`;
        }
        const order = await (0, db_1.query)(orderSql, orderParams);
        if (!order.rowCount)
            return res.status(404).json({ error: 'Pedido no encontrado o no autorizado' });
        // Verificar si ya existe una entrega para este pedido
        const existing = await (0, db_1.query)('SELECT * FROM deliveries WHERE order_id = $1', [order_id]);
        let deliveryRow;
        const targetAddress = delivery_address ?? order.rows[0].delivery_address;
        const resolvedGeo = (0, bucaramangaGeo_1.resolveBucaramangaCoords)(targetAddress, order_id);
        const finalLat = dest_lat ? Number(dest_lat) : resolvedGeo.lat;
        const finalLng = dest_lng ? Number(dest_lng) : resolvedGeo.lng;
        const finalAddress = targetAddress || resolvedGeo.address;
        if (existing.rowCount) {
            // Actualizar la entrega existente
            const updated = await (0, db_1.query)(`UPDATE deliveries
         SET vehicle_id = COALESCE($1, vehicle_id),
             driver_id = COALESCE($2, driver_id),
             delivery_address = COALESCE($3, delivery_address),
             scheduled_time = COALESCE($4, scheduled_time),
             notes = COALESCE($5, notes),
             dest_lat = COALESCE($6, dest_lat),
             dest_lng = COALESCE($7, dest_lng),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`, [vehicle_id ? Number(vehicle_id) : null,
                driver_id ? Number(driver_id) : null,
                finalAddress,
                scheduled_time || null, notes,
                finalLat, finalLng,
                existing.rows[0].id]);
            deliveryRow = updated.rows[0];
        }
        else {
            // Insertar nueva entrega
            const code = `DEL-${Date.now().toString(36).toUpperCase()}`;
            const confirmationCode = String(Math.floor(1000 + Math.random() * 9000));
            const result = await (0, db_1.query)(`INSERT INTO deliveries (delivery_code, order_id, vehicle_id, driver_id, restaurant_id,
           delivery_address, scheduled_time, notes, confirmation_code, dest_lat, dest_lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`, [code, order_id, vehicle_id ? Number(vehicle_id) : null, driver_id ? Number(driver_id) : null, order.rows[0].restaurant_id,
                finalAddress, scheduled_time || null, notes, confirmationCode,
                finalLat, finalLng]);
            deliveryRow = result.rows[0];
            if (Array.isArray(items)) {
                for (const it of items) {
                    await (0, db_1.query)(`INSERT INTO delivery_items (delivery_id, product_name, quantity, unit) VALUES ($1, $2, $3, $4)`, [deliveryRow.id, it.product_name, it.quantity, it.unit]);
                }
            }
        }
        // Si se asignó conductor y el pedido estaba en nuevo/confirmado/preparando, avanzar a despachado
        if (driver_id && ['nuevo', 'confirmado', 'preparando'].includes(order.rows[0].status)) {
            await (0, db_1.query)("UPDATE orders SET status = 'despachado', dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [order_id]);
            const updatedOrder = await (0, db_1.query)(`${deliverySelect()} WHERE d.id = $1`, [deliveryRow.id]);
            (0, realtime_1.emitOrder)('order:updated', updatedOrder.rows[0]);
        }
        if (driver_id) {
            (0, realtime_1.emitToUser)('notification:created', Number(driver_id), {
                message: `Se te asignó la entrega ${deliveryRow.delivery_code} del pedido ${order.rows[0].order_code}`,
                delivery_id: deliveryRow.id,
            });
        }
        (0, realtime_1.emitDeliveryStatus)(deliveryRow, { delivery_id: deliveryRow.id, status: deliveryRow.status, delivery_code: deliveryRow.delivery_code, restaurant_id: deliveryRow.restaurant_id, supplier_id: deliveryRow.order_supplier_id });
        res.status(existing.rowCount ? 200 : 201).json(deliveryRow);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/:id/assign', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    let client;
    try {
        const user = req.user;
        const driverId = Number(req.body.driver_id);
        const vehicleId = Number(req.body.vehicle_id);
        if (!Number.isInteger(driverId) || driverId <= 0) {
            return res.status(400).json({ error: 'Selecciona un domiciliario válido' });
        }
        if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
            return res.status(400).json({ error: 'Selecciona un vehículo válido' });
        }
        client = await db_1.pool.connect();
        await client.query('BEGIN');
        const access = deliveryAccessWhere(user, 2);
        const delivery = await client.query(`${deliverySelect()} WHERE d.id = $1${access.clause} FOR UPDATE OF d`, [req.params.id, ...access.params]);
        if (!delivery.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Entrega no encontrada o no autorizada' });
        }
        const del = delivery.rows[0];
        const driver = await client.query(`SELECT u.*, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1 AND u.is_active = TRUE`, [driverId]);
        if (!driver.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El usuario seleccionado no existe o está inactivo' });
        }
        if (driver.rows[0].role_name !== 'domiciliario') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El usuario seleccionado no tiene el rol de domiciliario' });
        }
        if (user.role === 'proveedor_admin' && driver.rows[0].supplier_id !== user.supplier_id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'El domiciliario no pertenece a tu proveedor' });
        }
        const vehicle = await client.query(`SELECT id FROM vehicles
       WHERE id = $1 AND is_active = TRUE
         AND (supplier_id = $2 OR supplier_id IS NULL)
       FOR UPDATE`, [vehicleId, del.order_supplier_id]);
        if (!vehicle.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El vehículo no está activo o no pertenece al proveedor del pedido' });
        }
        const confirmationCode = del.confirmation_code || String(Math.floor(1000 + Math.random() * 9000));
        await client.query(`UPDATE vehicles SET driver_id = $1, driver_name = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`, [driverId, driver.rows[0].name, vehicleId]);
        const result = await client.query(`UPDATE deliveries
       SET driver_id = $1, vehicle_id = $2, confirmation_code = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`, [driverId, vehicleId, confirmationCode, req.params.id]);
        await client.query('COMMIT');
        // Sincronizar estado del pedido a despachado si aún no lo estaba
        const currentOrder = await (0, db_1.query)('SELECT id, status, order_code FROM orders WHERE id = $1', [del.order_id]);
        if (currentOrder.rowCount && ['nuevo', 'confirmado', 'preparando'].includes(currentOrder.rows[0].status)) {
            await (0, db_1.query)("UPDATE orders SET status = 'despachado', dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
            const updatedOrder = await (0, db_1.query)(`SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`, [del.order_id]);
            (0, realtime_1.emitOrder)('order:updated', updatedOrder.rows[0]);
        }
        (0, realtime_1.emitToUser)('notification:created', driverId, {
            message: `Se te asignó la entrega ${del.delivery_code}`,
            delivery_id: del.id,
            confirmation_code: confirmationCode,
        });
        (0, realtime_1.emitDeliveryStatus)(del, { delivery_id: del.id, status: result.rows[0].status, delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });
        res.json(result.rows[0]);
    }
    catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            }
            catch (rollbackError) {
                console.error('Error revirtiendo la asignación de entrega:', rollbackError);
            }
        }
        next(err);
    }
    finally {
        client?.release();
    }
});
router.patch('/:id/status', async (req, res, next) => {
    try {
        const user = req.user;
        const { status } = req.body;
        const valid = ['asignado', 'en_camino', 'llegando', 'entregado', 'fallido'];
        if (!valid.includes(status))
            return res.status(400).json({ error: 'Estado de entrega inválido' });
        const access = deliveryAccessWhere(user, 2);
        const delivery = await (0, db_1.query)(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
        if (!delivery.rowCount)
            return res.status(404).json({ error: 'Entrega no encontrada' });
        const del = delivery.rows[0];
        if (user.role === 'domiciliario' && !['en_camino', 'llegando', 'entregado'].includes(status)) {
            return res.status(403).json({ error: 'El domiciliario solo puede cambiar a en_camino, llegando o entregado' });
        }
        if (status === 'entregado' && user.role === 'domiciliario') {
            return res.status(400).json({ error: 'Usa POST /:id/confirm con el código de confirmación para entregar' });
        }
        const deliveredSql = status === 'entregado' ? ', actual_delivery_time = CURRENT_TIMESTAMP' : '';
        const result = await (0, db_1.query)(`UPDATE deliveries SET status = $1, updated_at = CURRENT_TIMESTAMP${deliveredSql} WHERE id = $2 RETURNING *`, [status, req.params.id]);
        if (status === 'en_camino') {
            await (0, db_1.query)("UPDATE orders SET status = 'en_camino', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
            const updated = await (0, db_1.query)(`SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`, [del.order_id]);
            (0, realtime_1.emitOrder)('order:updated', updated.rows[0]);
        }
        if (status === 'entregado') {
            await (0, db_1.query)("UPDATE orders SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [del.order_id]);
            const updated = await (0, db_1.query)(`SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
         WHERE o.id = $1`, [del.order_id]);
            (0, realtime_1.emitOrder)('order:updated', updated.rows[0]);
        }
        (0, realtime_1.emitDeliveryStatus)(del, { delivery_id: del.id, status, delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.post('/:id/confirm', (0, auth_1.roleRequired)('domiciliario', 'gerente', 'admin'), async (req, res, next) => {
    try {
        const user = req.user;
        const { confirmation_code } = req.body;
        if (!confirmation_code)
            return res.status(400).json({ error: 'La llave o código de confirmación es requerido' });
        const access = deliveryAccessWhere(user, 2);
        const delivery = await (0, db_1.query)(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
        if (!delivery.rowCount)
            return res.status(404).json({ error: 'Entrega no encontrada o no autorizada' });
        const del = delivery.rows[0];
        if (del.status === 'entregado') {
            return res.status(400).json({ error: 'Esta entrega ya fue confirmada previamente' });
        }
        // Validación estricta del código / llave de entrega
        if (String(del.confirmation_code).trim() !== String(confirmation_code).trim()) {
            return res.status(401).json({ error: 'Llave de entrega incorrecta. Verifica el código con el domiciliario.' });
        }
        const result = await (0, db_1.query)(`UPDATE deliveries SET status = 'entregado', actual_delivery_time = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`, [req.params.id]);
        await (0, db_1.query)(`UPDATE orders SET status = 'entregado', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`, [del.order_id]);
        const order = await (0, db_1.query)(`SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id JOIN suppliers s ON s.id = o.supplier_id
       WHERE o.id = $1`, [del.order_id]);
        if (order.rowCount)
            (0, realtime_1.emitOrder)('order:updated', order.rows[0]);
        (0, realtime_1.emitDeliveryStatus)(del, { delivery_id: del.id, status: 'entregado', delivery_code: del.delivery_code, restaurant_id: del.restaurant_id, supplier_id: del.order_supplier_id });
        // Notificar al domiciliario si fue el gerente quien ingresó la llave
        if (del.driver_id) {
            (0, realtime_1.emitToUser)('notification:created', del.driver_id, {
                message: `El restaurante confirmó la entrega del pedido ${del.delivery_code} con tu llave`,
                delivery_id: del.id,
            });
        }
        res.json({ message: 'Envío completado exitosamente con la llave de entrega', delivery: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
// Últimos pings por entrega, para el throttle del servidor (5 s mín.)
const positionThrottle = new Map();
const MIN_PING_MS = 5000;
const MIN_MOVE_M = 10; // no guardar en route_history si se movió menos de 10 m
router.patch('/:id/position', async (req, res, next) => {
    try {
        const user = req.user;
        const { lat, lng, speed, heading, accuracy } = req.body;
        if (!(0, geo_1.isValidCoord)(lat, lng)) {
            return res.status(400).json({ error: 'lat/lng inválidos (rango fuera de coordenadas válidas)' });
        }
        const access = deliveryAccessWhere(user, 2);
        const delivery = await (0, db_1.query)(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
        if (!delivery.rowCount)
            return res.status(404).json({ error: 'Entrega no encontrada' });
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
        const last = await (0, db_1.query)(`SELECT lat, lng FROM route_history
        WHERE delivery_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [del.id]);
        const moved = !last.rowCount
            ? true
            : (0, geo_1.haversineMeters)(latN, lngN, Number(last.rows[0].lat), Number(last.rows[0].lng)) >= MIN_MOVE_M;
        // Upsert de la posición del domiciliario (funciona con o sin vehículo)
        await (0, db_1.query)(`INSERT INTO driver_locations (driver_id, delivery_id, lat, lng, speed, heading, accuracy)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (driver_id) DO UPDATE
         SET delivery_id = EXCLUDED.delivery_id, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
             speed = EXCLUDED.speed, heading = EXCLUDED.heading, accuracy = EXCLUDED.accuracy,
             recorded_at = CURRENT_TIMESTAMP`, [user.id, del.id, latN, lngN, speedN, heading ?? null, accuracy ?? null]);
        if (del.vehicle_id) {
            await (0, db_1.query)(`UPDATE vehicles SET current_lat = $1, current_lng = $2, last_location_update = CURRENT_TIMESTAMP,
          gps_last_seen = CURRENT_TIMESTAMP WHERE id = $3`, [latN, lngN, del.vehicle_id]);
        }
        if (moved) {
            await (0, db_1.query)(`INSERT INTO route_history (vehicle_id, delivery_id, driver_id, lat, lng, speed, heading, accuracy)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [del.vehicle_id ?? null, del.id, user.id, latN, lngN, speedN, heading ?? null, accuracy ?? null]);
        }
        // ETA hacia el destino de la entrega
        const etaMin = (0, geo_1.estimateEtaMinutes)(latN, lngN, Number(del.dest_lat), Number(del.dest_lng), speedN);
        // Geocerca automática: < 500 m con status 'en_camino' => 'llegando'
        let statusChanged = null;
        if (del.status === 'en_camino' && (0, geo_1.insideGeofence)(latN, lngN, Number(del.dest_lat), Number(del.dest_lng))) {
            await (0, db_1.query)(`UPDATE deliveries SET status = 'llegando', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [del.id]);
            statusChanged = 'llegando';
            const currentOrder = await (0, db_1.query)('SELECT id, status FROM orders WHERE id = $1', [del.order_id]);
            if (currentOrder.rowCount && currentOrder.rows[0].status === 'en_camino') {
                await (0, db_1.query)(`UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [del.order_id]);
            }
            (0, realtime_1.emitDeliveryStatus)(del, {
                delivery_id: del.id,
                status: 'llegando',
                delivery_code: del.delivery_code,
                auto: true,
            });
            (0, realtime_1.emitToUser)('notification:created', del.driver_id ?? 0, {
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
        (0, realtime_1.emitDeliveryPosition)(del, payload);
        res.json({ ok: true, eta_min: etaMin, status: payload.status });
    }
    catch (err) {
        next(err);
    }
});
// Seguimiento completo: posición actual + ETA + polilínea del recorrido
router.get('/:id/track', async (req, res, next) => {
    try {
        const user = req.user;
        const access = deliveryAccessWhere(user, 2);
        const delivery = await (0, db_1.query)(`${deliverySelect()} WHERE d.id = $1${access.clause}`, [req.params.id, ...access.params]);
        if (!delivery.rowCount)
            return res.status(404).json({ error: 'Entrega no encontrada' });
        const del = delivery.rows[0];
        const active = ['asignado', 'en_camino', 'llegando'].includes(del.status);
        // Posición actual: driver_locations primero (no requiere vehículo), luego vehículo
        let position = null;
        if (del.driver_id) {
            const dl = await (0, db_1.query)('SELECT * FROM driver_locations WHERE driver_id = $1', [del.driver_id]);
            if (dl.rowCount)
                position = dl.rows[0];
        }
        if (!position && del.vehicle_lat !== null && del.vehicle_lat !== undefined) {
            position = {
                lat: del.vehicle_lat,
                lng: del.vehicle_lng,
                recorded_at: del.last_location_update,
                speed: null,
            };
        }
        if (!active)
            position = null; // entregado/fallido: sin tracking
        const route = await (0, db_1.query)(`SELECT lat, lng, speed, recorded_at FROM route_history
        WHERE delivery_id = $1 ORDER BY recorded_at ASC`, [del.id]);
        const etaMin = position && active
            ? (0, geo_1.estimateEtaMinutes)(Number(position.lat), Number(position.lng), Number(del.dest_lat), Number(del.dest_lng), position.speed ? Number(position.speed) : null)
            : null;
        const distanceM = position && active
            ? Math.round((0, geo_1.haversineMeters)(Number(position.lat), Number(position.lng), Number(del.dest_lat), Number(del.dest_lng)))
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
            polyline: (0, geo_1.slicePolyline)(route.rows),
            points_count: route.rows.length,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/vehicles', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    try {
        const user = req.user;
        const { name, plate, type, driver_id, imei } = req.body;
        let driverName = req.body.driver_name || null;
        if (driver_id) {
            const u = await (0, db_1.query)('SELECT name FROM users WHERE id = $1', [driver_id]).catch(() => ({ rows: [] }));
            if (u.rows[0])
                driverName = u.rows[0].name;
        }
        const result = await (0, db_1.query)(`INSERT INTO vehicles (supplier_id, name, plate, type, driver_id, driver_name, imei, gps_validated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [user.supplier_id || null, name, plate, type ?? 'moto', driver_id ? Number(driver_id) : null, driverName, imei || null, Boolean(imei)]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/vehicles/:id', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    try {
        const { name, plate, type, driver_id, imei } = req.body;
        let driverName = req.body.driver_name || null;
        if (driver_id) {
            const u = await (0, db_1.query)('SELECT name FROM users WHERE id = $1', [driver_id]).catch(() => ({ rows: [] }));
            if (u.rows[0])
                driverName = u.rows[0].name;
        }
        const result = await (0, db_1.query)(`UPDATE vehicles
       SET name = COALESCE($1, name),
           plate = COALESCE($2, plate),
           type = COALESCE($3, type),
           driver_id = $4,
           driver_name = COALESCE($5, driver_name),
           imei = COALESCE($6, imei),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`, [name, plate, type, driver_id ? Number(driver_id) : null, driverName, imei || null, req.params.id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Vehículo no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/vehicles/:id/gps', (0, auth_1.roleRequired)('proveedor_admin', 'admin', 'gerente'), async (req, res, next) => {
    try {
        const { imei, gps_validated } = req.body;
        const result = await (0, db_1.query)(`UPDATE vehicles SET imei = $1, gps_validated = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`, [imei || null, Boolean(gps_validated), req.params.id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Vehículo no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
