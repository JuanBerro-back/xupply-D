import { Request, Response, NextFunction } from 'express';
import { query, pool } from '../../../shared/config/db';
import { emitOrder, emitToUser, emitInventoryAlert } from '../../../shared/lib/realtime';
import { logAudit } from '../../../shared/lib/audit';
import { sendEmail } from '../../../shared/lib/email';
import { resolveBucaramangaCoords } from '../../../shared/lib/bucaramangaGeo';
import { nextBusinessCode, nextConfirmationCode } from '../../../shared/lib/codes';
import { STATUS_TRANSITIONS } from './orders.service';
import { orderSelect, orderAccessWhere, findOrder, getFullOrder, getOrderItems, getDeliveryForDriver, getOrderDeliveries, getItemsForDispatch, deliveryExists, getOrderAudit } from './orders.repository';

export async function list(req: Request, res: Response, next: NextFunction) {
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
      const access = orderAccessWhere(user, params.length + 1);
      sql += access.clause;
      params.push(...access.params);
    }
    const result = await query(`${sql} ORDER BY o.created_at DESC LIMIT 200`, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { supplier_id, branch_id, items, notes, delivery_address, requested_delivery_date } = req.body;
    if (!supplier_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'supplier_id e items son requeridos' });
    }
    if (!user.restaurant_id) {
      return res.status(400).json({ error: 'El usuario no tiene un restaurante asociado' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const supplier = await client.query(
        'SELECT id, payment_policy FROM suppliers WHERE id = $1',
        [supplier_id]
      );
      if (!supplier.rowCount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `El supplier_id ${supplier_id} no existe` });
      }
      // La sucursal debe pertenecer al restaurante del usuario (evita pedidos
      // asociados a sucursales de otro inquilino).
      const branchId = branch_id ? Number(branch_id) : user.branch_id;
      if (branchId) {
        const branch = await client.query('SELECT 1 FROM branches WHERE id = $1 AND restaurant_id = $2', [
          branchId,
          user.restaurant_id,
        ]);
        if (!branch.rowCount) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'La sucursal indicada no pertenece a tu restaurante' });
        }
      }
      const code = nextBusinessCode('ORDER');
      // Si el proveedor exige prepago, el pedido nace con pago pendiente y no
      // puede confirmarse hasta que la pasarela lo apruebe. Los demás casos
      // conservan el flujo anterior (contraentrega / crédito).
      const paymentPolicy = String(supplier.rows[0].payment_policy || 'contraentrega');
      const paymentStatus = paymentPolicy === 'prepago' ? 'pendiente' : 'no_requerido';
      const inserted = await client.query(
        `INSERT INTO orders (order_code, restaurant_id, branch_id, supplier_id, status, notes, delivery_address, requested_delivery_date, created_by, payment_status)
         VALUES ($1, $2, $3, $4, 'nuevo', $5, $6, $7, $8, $9) RETURNING id`,
        [code, user.restaurant_id, branchId ?? null, supplier_id, notes, delivery_address, requested_delivery_date, user.id, paymentStatus]
      );
      const orderId = inserted.rows[0].id;
      let total = 0;
      for (const item of items) {
        const prod = await client.query(
          'SELECT id, name, unit, price_per_unit, supplier_id FROM products WHERE id = $1',
          [item.product_id]
        );
        if (!prod.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `Producto ${item.product_id} no encontrado` });
        }
        const p = prod.rows[0];
        if (p.supplier_id !== null && p.supplier_id !== undefined && Number(p.supplier_id) !== Number(supplier_id)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `El producto ${item.product_id} no pertenece al proveedor ${supplier_id}` });
        }
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Cantidad inválida para el producto ${item.product_id}` });
        }
        const unitPrice = Number(p.price_per_unit);
        const subtotal = unitPrice * qty;
        total += subtotal;
        await client.query(
          `INSERT INTO order_items (order_id, product_id, name, quantity, unit, unit_price, subtotal)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [orderId, p.id, p.name, qty, p.unit, unitPrice, subtotal]
        );
      }
      await client.query('UPDATE orders SET total = $1 WHERE id = $2', [total, orderId]);
      await client.query('COMMIT');
      await logAudit(req, 'create', 'order', orderId, null, { total, order_code: code, supplier_id });
      const full = await getFullOrder(orderId);
      const order = { ...full.rows[0], items: (await getOrderItems(orderId)).rows };
      emitOrder('order:created', order);
      if (order.supplier_email) {
        void sendEmail({
          to_email: order.supplier_email,
          to_name: order.supplier_name,
          subject: `Nuevo pedido ${order.order_code}`,
          body: `Recibiste el pedido ${order.order_code} por $${total}.`,
          category: 'transactional',
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
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const access = orderAccessWhere(user, 2);
    const result = await query(`${orderSelect()} WHERE o.id = $1${access.clause}`, [req.params.id, ...access.params]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = result.rows[0];
    if (user.role === 'domiciliario') {
      const hasDelivery = await getDeliveryForDriver(order.id, user.id);
      if (!hasDelivery.rowCount) return res.status(403).json({ error: 'No autorizado' });
    }
    const items = await getOrderItems(req.params.id);
    const deliveries = await getOrderDeliveries(req.params.id);

    let deliveriesList = deliveries.rows;
    // El código de confirmación lo lleva el domiciliario y lo valida el
    // restaurante: los usuarios del restaurante NO deben verlo por API
    // (podrían auto-confirmar sin la presencia del conductor).
    const isRestaurantUser =
      user.role === 'gerente' || user.role === 'empleado' || (user.restaurant_id !== null && user.role !== 'admin');
    if (isRestaurantUser) {
      deliveriesList = deliveriesList.map((d: any) => {
        const { confirmation_code, ...rest } = d;
        return { ...rest, has_security_code: Boolean(confirmation_code) };
      });
    }

    res.json({ ...order, items: items.rows, deliveries: deliveriesList });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { status } = req.body;
    const current = await findOrder(req.params.id);
    if (!current.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const order = current.rows[0];
    if (user.role === 'empleado') {
      const allowedForEmpleado = ['nuevo'];
      if (!allowedForEmpleado.includes(order.status) || !['cancelado'].includes(status)) {
        return res.status(403).json({ error: 'El empleado solo puede cancelar pedidos nuevos' });
      }
    }
    if (user.supplier_id && order.supplier_id !== user.supplier_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.restaurant_id && order.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (user.role !== 'admin') {
      const hasTenant = user.role === 'proveedor_admin' ? Boolean(user.supplier_id) : Boolean(user.restaurant_id);
      if (!hasTenant) return res.status(403).json({ error: 'Usuario sin inquilino asignado' });
    }
    if (status === 'entregado' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'El pedido solo se marca como entregado con la llave de entrega (POST /api/deliveries/:id/confirm).',
      });
    }
    // Prepago: el proveedor no puede confirmar hasta que el dinero esté aplicado.
    if (status === 'confirmado' && order.payment_status === 'pendiente') {
      return res.status(409).json({
        error: 'El pedido tiene un pago pendiente. El restaurante debe completarlo antes de confirmar.',
        code: 'PAYMENT_REQUIRED',
      });
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
    // Transición atómica: solo aplica si el estado sigue siendo el que se validó.
    const transition = await query(
      `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP${tsSql} WHERE id = $2 AND status = $3`,
      [status, req.params.id, order.status]
    );
    if (!transition.rowCount) {
      return res.status(409).json({ error: 'El pedido cambió de estado. Recarga e inténtalo de nuevo.' });
    }

    if (status === 'despachado' && order.supplier_id) {
      const items = await getItemsForDispatch(req.params.id);
      for (const it of items.rows) {
        await query(
          `UPDATE products SET stock_available = GREATEST(stock_available - $1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [it.quantity, it.product_id]
        );
      }
    }

    // Asegurar que exista un registro de entrega para seguimiento GPS cuando el pedido se despacha o se pone en camino
    if (['despachado', 'en_camino'].includes(status)) {
      const existingDel = await deliveryExists(order.id);
      if (!existingDel.rowCount) {
        const code = nextBusinessCode('DEL');
        const confirmationCode = nextConfirmationCode();
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

    await logAudit(req, 'update_status', 'order', Number(req.params.id), { status: order.status }, { status });

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
}

export async function history(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const access = orderAccessWhere(user, 2);
    const order = await query(
      `SELECT o.id FROM orders o WHERE o.id = $1${access.clause}`,
      [req.params.id, ...access.params]
    );
    if (!order.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    const result = await getOrderAudit(req.params.id);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function notifyInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await findOrder(req.params.id);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (user.restaurant_id && result.rows[0].restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    emitInventoryAlert(user.restaurant_id ?? 0, {
      message: `Pedido ${result.rows[0].order_code}: se recomienda actualizar inventario`,
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
