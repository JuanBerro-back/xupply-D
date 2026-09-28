import { Router } from 'express';
import { query, pool } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { emitOrder, emitToUser, emitInventoryAlert } from '../lib/realtime';
import { sendEmail } from '../lib/email';
import { resolveBucaramangaCoords } from '../lib/bucaramangaGeo';

const router = Router();
router.use(authRequired);

const STATUS_TRANSITIONS: Record<string, string[]> = {
  nuevo: ['confirmado', 'cancelado'],
  confirmado: ['preparando', 'cancelado'],
  preparando: ['despachado', 'cancelado'],
  despachado: ['en_camino'],
  en_camino: ['entregado'],
  entregado: [],
  cancelado: [],
};

function orderSelect() {
  return `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name,
                 COALESCE(s.email, '') AS supplier_email, COALESCE(u.email, '') AS restaurant_email
          FROM orders o
          JOIN restaurants r ON r.id = o.restaurant_id
          JOIN suppliers s ON s.id = o.supplier_id
          LEFT JOIN users u ON u.id = o.created_by`;
}

function orderAccessWhere(user: {
  role: string;
  supplier_id: number | null;
  restaurant_id: number | null;
}) {
  if (user.role === 'proveedor_admin') {
    return { clause: ' AND o.supplier_id = $1', params: [user.supplier_id] as unknown[] };
  }
  if (user.role === 'domiciliario') {
    return { clause: '', params: [] as unknown[] };
  }
  if (user.restaurant_id) {
    return { clause: ' AND o.restaurant_id = $1', params: [user.restaurant_id] as unknown[] };
  }
  return { clause: '', params: [] as unknown[] };
}

router.get('/', async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `${orderSelect()} WHERE 1=1`;
    if (user.role === 'domiciliario') {
      sql = `SELECT DISTINCT o.*, r.name AS restaurant_name, s.name AS supplier_name,
                    COALESCE(s.email, '') AS supplier_email, COALESCE(u.email, '') AS restaurant_email
             FROM orders o
             JOIN deliveries d ON d.order_id = o.id
             JOIN restaurants r ON r.id = o.restaurant_id
             JOIN suppliers s ON s.id = o.supplier_id
             LEFT JOIN users u ON u.id = o.created_by
             WHERE d.driver_id = $1`;
      params.push(user.id);
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND o.status = $${params.length}`;
    }
    if (req.query.supplier_id) {
      params.push(req.query.supplier_id);
      sql += ` AND o.supplier_id = $${params.length}`;
    }
    if (user.role !== 'domiciliario') {
      const access = orderAccessWhere(user);
      sql += access.clause;
      params.push(...access.params);
    }
    const result = await query(`${sql} ORDER BY o.created_at DESC LIMIT 200`, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('gerente', 'empleado', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { supplier_id, branch_id, items, notes, delivery_address, requested_delivery_date } = req.body;
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'supplier_id e items son requeridos' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const code = `ORDER-${Date.now().toString(36).toUpperCase()}`;
      const inserted = await client.query(
        `INSERT INTO orders (order_code, restaurant_id, branch_id, supplier_id, status, notes, delivery_address, requested_delivery_date, created_by)
         VALUES ($1, $2, $3, $4, 'nuevo', $5, $6, $7, $8) RETURNING id`,
        [code, user.restaurant_id, branch_id ?? user.branch_id, supplier_id, notes, delivery_address, requested_delivery_date, user.id]
      );
      const orderId = inserted.rows[0].id;
      let total = 0;
      for (const item of items) {
        const prod = await client.query(
          'SELECT id, name, unit, price_per_unit FROM products WHERE id = $1',
          [item.product_id]
        );
        if (!prod.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `Producto ${item.product_id} no encontrado` });
        }
        const p = prod.rows[0];
        const qty = Number(item.quantity);
        const subtotal = p.price_per_unit * qty;
        total += subtotal;
        await client.query(
          `INSERT INTO order_items (order_id, product_id, name, quantity, unit, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [orderId, p.id, p.name, qty, p.unit, p.price_per_unit, subtotal]
        );
      }
      await client.query('UPDATE orders SET total = $1 WHERE id = $2', [total, orderId]);
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'create', 'order', $2, $3::jsonb)`,
        [user.id, orderId, JSON.stringify({ total })]
      );
      await client.query('COMMIT');
      const full = await query(`${orderSelect()} WHERE o.id = $1`, [orderId]);
      const order = { ...full.rows[0], items: (await query('SELECT * FROM order_items WHERE order_id = $1', [orderId])).rows };
      emitOrder('order:created', order);
      if (order.supplier_email) {
        sendEmail({
          to_email: order.supplier_email,
          to_name: order.supplier_name,
          subject: `Nuevo pedido ${order.order_code}`,
          body: `Recibiste el pedido ${order.order_code} por $${total}.`,
        });
      }
      res.status(201).json(order);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(`${orderSelect()} WHERE o.id = $1`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = result.rows[0];
    if (user.role === 'domiciliario') {
      const hasDelivery = await query(
        'SELECT 1 FROM deliveries WHERE order_id = $1 AND driver_id = $2',
        [order.id, user.id]
      );
      if (!hasDelivery.rowCount) return res.status(403).json({ error: 'No autorizado' });
    }
    const items = await query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [req.params.id]);
    const deliveries = await query(
      `SELECT d.*, u.name AS driver_name, u.phone AS driver_phone,
              v.name AS vehicle_name, v.plate, v.type AS vehicle_type
       FROM deliveries d
       LEFT JOIN users u ON u.id = d.driver_id
       LEFT JOIN vehicles v ON v.id = d.vehicle_id
       WHERE d.order_id = $1 ORDER BY d.created_at DESC`,
      [req.params.id]
    );

    let deliveriesList = deliveries.rows;
    // Para el gerente, el domiciliario lleva el código; el gerente no lo ve en la pantalla antes de la entrega
    if (user.role === 'gerente' || (user.restaurant_id && user.role !== 'admin')) {
      deliveriesList = deliveriesList.map((d: any) => {
        if (d.status !== 'entregado') {
          const { confirmation_code, ...rest } = d;
          return { ...rest, has_security_code: true };
        }
        return d;
      });
    }

    res.json({ ...order, items: items.rows, deliveries: deliveriesList });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const user = req.user!;
    const { status } = req.body;
    const current = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!current.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = current.rows[0];
    if (user.role === 'domiciliario') {
      return res.status(403).json({ error: 'El domiciliario no puede cambiar el estado del pedido directamente' });
    }
    if (user.role === 'empleado') {
      const allowedForEmpleado = ['nuevo'];
      if (!allowedForEmpleado.includes(order.status) || !['cancelado'].includes(status)) {
        return res.status(403).json({ error: 'El empleado solo puede cancelar pedidos nuevos' });
      }
    }
    if (user.supplier_id && order.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.restaurant_id && order.restaurant_id !== user.restaurant_id && status !== 'cancelado') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const allowed = STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `No se puede pasar de "${order.status}" a "${status}"` });
    }
    const timestamps: Record<string, string> = {
      confirmado: 'confirmed_at',
      despachado: 'dispatched_at',
      entregado: 'delivered_at',
    };
    const tsColumn = timestamps[status];
    const tsSql = tsColumn ? `, ${tsColumn} = CURRENT_TIMESTAMP` : '';
    await query(`UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP${tsSql} WHERE id = $2`, [status, req.params.id]);

    if (status === 'despachado' && order.supplier_id) {
      const items = await query('SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL', [req.params.id]);
      for (const it of items.rows) {
        await query(
          `UPDATE products SET stock_available = GREATEST(stock_available - $1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [it.quantity, it.product_id]
        );
      }
    }

    // Asegurar que exista un registro de entrega para seguimiento GPS cuando el pedido se despacha o se pone en camino
    if (['despachado', 'en_camino'].includes(status)) {
      const existingDel = await query('SELECT id, status FROM deliveries WHERE order_id = $1', [order.id]);
      if (!existingDel.rowCount) {
        const code = `DEL-${Date.now().toString(36).toUpperCase()}`;
        const confirmationCode = String(Math.floor(1000 + Math.random() * 9000));
        const coords = resolveBucaramangaCoords(order.delivery_address, order.id);
        await query(
          `INSERT INTO deliveries (delivery_code, order_id, restaurant_id, delivery_address, status, confirmation_code, dest_lat, dest_lng)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [code, order.id, order.restaurant_id, order.delivery_address || coords.address, status === 'en_camino' ? 'en_camino' : 'asignado', confirmationCode, coords.lat, coords.lng]
        );
      } else if (status === 'en_camino' && existingDel.rows[0].status === 'asignado') {
        await query("UPDATE deliveries SET status = 'en_camino', updated_at = CURRENT_TIMESTAMP WHERE order_id = $1", [order.id]);
      }
    } else if (status === 'entregado') {
      await query("UPDATE deliveries SET status = 'entregado', actual_delivery_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE order_id = $1 AND status != 'entregado'", [order.id]);
    }

    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, 'status', 'order', $2, $3::jsonb)`,
      [user.id, req.params.id, JSON.stringify({ status })]
    );

    const updated = await query(`${orderSelect()} WHERE o.id = $1`, [req.params.id]);
    emitOrder('order:updated', updated.rows[0]);
    if (status === 'cancelado' && order.restaurant_id) {
      emitToUser('notification:created', user.id, {
        message: `Pedido ${order.order_code} cancelado`,
      });
    }
    res.json(updated.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM audit_log
       WHERE entity_type = 'order' AND entity_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/notify-inventory', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    emitInventoryAlert(user.restaurant_id ?? 0, {
      message: `Pedido ${result.rows[0].order_code}: se recomienda actualizar inventario`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
