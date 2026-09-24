import { Router } from 'express';
import { query, pool } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { emitRadarOffer, emitToUser } from '../lib/realtime';

const router = Router();
router.use(authRequired);

// ---------------------------------------------------------------
// SHARES: el restaurante decide con quién comparte su semáforo
// ---------------------------------------------------------------

router.get('/shares', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `SELECT rs.*, s.name AS supplier_name
         FROM radar_shares rs
         JOIN suppliers s ON s.id = rs.supplier_id
        WHERE rs.restaurant_id = $1
        ORDER BY rs.created_at DESC`,
      [user.restaurant_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/shares', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { supplier_id, scope, category, inventory_id, share_level, alert_on } = req.body;
    if (!supplier_id) return res.status(400).json({ error: 'supplier_id es requerido' });
    const finalScope = ['todo', 'categoria', 'producto'].includes(scope) ? scope : 'todo';
    if (finalScope === 'categoria' && !category) {
      return res.status(400).json({ error: 'category es requerido cuando scope=categoria' });
    }
    if (finalScope === 'producto' && !inventory_id) {
      return res.status(400).json({ error: 'inventory_id es requerido cuando scope=producto' });
    }
    const result = await query(
      `INSERT INTO radar_shares (restaurant_id, supplier_id, scope, category, inventory_id, share_level, alert_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (restaurant_id, supplier_id, scope, COALESCE(category,''), COALESCE(inventory_id,0))
       DO UPDATE SET is_active = TRUE, share_level = EXCLUDED.share_level, alert_on = EXCLUDED.alert_on
       RETURNING *`,
      [
        user.restaurant_id,
        Number(supplier_id),
        finalScope,
        category ?? null,
        inventory_id ? Number(inventory_id) : null,
        share_level === 'cantidad' ? 'cantidad' : 'semaforo',
        alert_on === 'low' ? 'low' : 'critical',
        user.id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/shares/:id', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { is_active } = req.body;
    const result = await query(
      `UPDATE radar_shares SET is_active = COALESCE($1, is_active)
        WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
      [is_active, req.params.id, user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------
// ALERTAS: bandeja entrante del proveedor ("X restaurante te necesita")
// ---------------------------------------------------------------

// El restaurante ve las señales que YA emitió (hacia qué proveedores)
router.get('/my-alerts', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `SELECT a.*, i.name AS item_name, i.category, s.name AS supplier_name
         FROM radar_alerts a
         JOIN inventory i ON i.id = a.inventory_id
         JOIN suppliers s ON s.id = a.supplier_id
        WHERE a.restaurant_id = $1 AND a.status IN ('abierta', 'ofertada')
        ORDER BY (a.level = 'critical') DESC, a.opened_at DESC LIMIT 100`,
      [user.restaurant_id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/alerts', roleRequired('proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [user.supplier_id];
    let sql = `SELECT a.*, i.name AS item_name, i.category, r.name AS restaurant_name
                 FROM radar_alerts a
                 JOIN inventory i ON i.id = a.inventory_id
                 JOIN restaurants r ON r.id = a.restaurant_id
                 JOIN radar_shares rs ON rs.restaurant_id = a.restaurant_id
                                      AND rs.supplier_id = a.supplier_id
                                      AND rs.is_active = TRUE
                WHERE a.supplier_id = $1`;
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND a.status = $${params.length}`;
    } else {
      sql += ` AND a.status IN ('abierta', 'ofertada')`;
    }
    sql += ` ORDER BY (a.level = 'critical') DESC, a.opened_at DESC LIMIT 100`;
    const result = await query(sql, params);
    // El proveedor solo ve el semáforo, nunca el stock real
    res.json(result.rows.map((row) => ({ ...row, share_level: 'semaforo' })));
  } catch (err) {
    next(err);
  }
});

router.post('/alerts/:id/offers', roleRequired('proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { product_name, offered_qty, offered_price, eta_hours, notes, unit } = req.body;
    if (!offered_qty || offered_price === undefined) {
      return res.status(400).json({ error: 'offered_qty y offered_price son requeridos' });
    }
    const alert = await query(
      `SELECT a.*, i.name AS item_name, i.unit AS item_unit
         FROM radar_alerts a JOIN inventory i ON i.id = a.inventory_id
        WHERE a.id = $1 AND a.supplier_id = $2 AND a.status = 'abierta'`,
      [req.params.id, user.supplier_id]
    );
    if (!alert.rowCount) return res.status(404).json({ error: 'Alerta no encontrada o no disponible' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const offer = await client.query(
        `INSERT INTO radar_offers (alert_id, supplier_id, product_name, unit, offered_qty, offered_price, eta_hours, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          alert.rows[0].id,
          user.supplier_id,
          product_name || alert.rows[0].item_name,
          unit || alert.rows[0].item_unit,
          Number(offered_qty),
          Number(offered_price),
          Number(eta_hours) || 24,
          notes ?? null,
          user.id,
        ]
      );
      await client.query(
        `UPDATE radar_alerts SET status = 'ofertada' WHERE id = $1 AND status = 'abierta'`,
        [req.params.id]
      );
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'offer', 'radar_alert', $2, $3::jsonb)`,
        [user.id, req.params.id, JSON.stringify({ offered_price: Number(offered_price) })]
      );
      await client.query('COMMIT');

      emitRadarOffer(alert.rows[0].restaurant_id, {
        offer_id: offer.rows[0].id,
        alert_id: alert.rows[0].id,
        supplier_id: user.supplier_id,
        item: alert.rows[0].item_name,
        offered_qty: Number(offered_qty),
        offered_price: Number(offered_price),
        eta_hours: Number(eta_hours) || 24,
        valid_until: offer.rows[0].valid_until,
      });
      res.status(201).json(offer.rows[0]);
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

// ---------------------------------------------------------------
// OFERTAS: bandeja entrante del restaurante + aceptar/rechazar
// ---------------------------------------------------------------

router.get('/offers', roleRequired('gerente', 'admin', 'empleado', 'proveedor_admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `SELECT o.*, a.restaurant_id, a.inventory_id, r.name AS restaurant_name,
                      s.name AS supplier_name, i.name AS item_name, i.category
                 FROM radar_offers o
                 JOIN radar_alerts a ON a.id = o.alert_id
                 JOIN restaurants r ON r.id = a.restaurant_id
                 JOIN suppliers s ON s.id = o.supplier_id
                 JOIN inventory i ON i.id = a.inventory_id
                WHERE 1=1`;
    if (user.role === 'proveedor_admin') {
      params.push(user.supplier_id);
      sql += ` AND o.supplier_id = $${params.length}`;
    } else if (user.restaurant_id) {
      params.push(user.restaurant_id);
      sql += ` AND a.restaurant_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND o.status = $${params.length}`;
    } else {
      sql += ` AND o.status = 'pendiente' AND o.valid_until > CURRENT_TIMESTAMP`;
    }
    sql += ' ORDER BY o.created_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/offers/:id/accept', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const offer = await query(
      `SELECT o.*, a.restaurant_id, a.inventory_id, a.supplier_id AS alert_supplier
         FROM radar_offers o JOIN radar_alerts a ON a.id = o.alert_id
        WHERE o.id = $1 AND o.status = 'pendiente' AND o.valid_until > CURRENT_TIMESTAMP`,
      [req.params.id]
    );
    if (!offer.rowCount) return res.status(404).json({ error: 'Oferta no encontrada o expirada' });
    const off = offer.rows[0];
    if (off.restaurant_id !== user.restaurant_id) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const client = await pool.connect();
    let orderId = 0;
    let orderCode = '';
    let total = 0;
    try {
      await client.query('BEGIN');
      orderCode = `ORDER-${Date.now().toString(36).toUpperCase()}`;
      total = Number(off.offered_qty) * Number(off.offered_price);
      const ins = await client.query(
        `INSERT INTO orders (order_code, restaurant_id, branch_id, supplier_id, total, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          orderCode,
          user.restaurant_id,
          user.branch_id,
          off.supplier_id,
          total,
          `Radar de Stock: oferta #${off.id} - ${off.product_name}`,
          user.id,
        ]
      );
      orderId = ins.rows[0].id;
      await client.query(
        `INSERT INTO order_items (order_id, inventory_id, name, quantity, unit, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, off.inventory_id, off.product_name, Number(off.offered_qty), off.unit ?? 'unidad', Number(off.offered_price), total]
      );
      await client.query(`UPDATE radar_offers SET status = 'aceptada', order_id = $1 WHERE id = $2`, [orderId, off.id]);
      await client.query(
        `UPDATE radar_alerts SET status = 'aceptada' WHERE id = $1`,
        [off.alert_id]
      );
      // Reponer el inventario asociado al aceptar la oferta
      if (off.inventory_id) {
        await client.query(
          `UPDATE inventory
              SET current_stock = current_stock + $1,
                  stock_status = CASE
                    WHEN current_stock + $1 <= min_stock THEN 'critical'::inventory_stock_status
                    WHEN current_stock + $1 <= min_stock * 2 THEN 'low'::inventory_stock_status
                    ELSE 'normal'::inventory_stock_status END,
                  updated_at = CURRENT_TIMESTAMP
            WHERE id = $2`,
          [Number(off.offered_qty), off.inventory_id]
        );
        await client.query(
          `INSERT INTO inventory_movements (inventory_id, type, quantity, previous_stock, new_stock, reference_type, reference_id, created_by)
           SELECT $1, 'entrada', $2, current_stock - $2, current_stock, 'radar_offer', $3, $4
             FROM inventory WHERE id = $1`,
          [off.inventory_id, Number(off.offered_qty), off.id, user.id]
        );
      }
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
         VALUES ($1, 'accept_offer', 'radar_offer', $2, $3::jsonb)`,
        [user.id, off.id, JSON.stringify({ order_id: orderId, total })]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    emitToUser('notification:created', off.created_by ?? 0, {
      message: `Tu oferta de "${off.product_name}" fue aceptada (pedido ${orderCode})`,
      order_id: orderId,
    });
    res.status(201).json({ order_id: orderId, order_code: orderCode, total });
  } catch (err) {
    next(err);
  }
});

router.post('/offers/:id/reject', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `UPDATE radar_offers o
          SET status = 'rechazada'
         FROM radar_alerts a
        WHERE o.id = $1 AND a.id = o.alert_id AND a.restaurant_id = $2 AND o.status = 'pendiente'
        RETURNING o.*`,
      [req.params.id, user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Oferta no encontrada o no disponible' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Cerrar una alerta sin oferta (el restaurante ya repuso por otra vía)
router.post('/alerts/:id/close', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `UPDATE radar_alerts SET status = 'cerrada'
        WHERE id = $1 AND restaurant_id = $2 AND status IN ('abierta', 'ofertada')
        RETURNING *`,
      [req.params.id, user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Alerta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
