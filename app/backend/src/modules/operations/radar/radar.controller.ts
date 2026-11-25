import { Request, Response, NextFunction } from 'express';
import { query, pool } from '../../../shared/config/db';
import { emitRadarOffer, emitToUser } from '../../../shared/lib/realtime';
import { logAudit } from '../../../shared/lib/audit';
import { nextBusinessCode } from '../../../shared/lib/codes';
import { getShares, updateShare as updateShareRow, getMyAlerts, getAlertForOffer, getOfferForAccept, rejectOffer as rejectOfferRow, closeAlert as closeAlertRow } from './radar.repository';

export async function listShares(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await getShares(user.restaurant_id);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function createShare(req: Request, res: Response, next: NextFunction) {
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
}

export async function updateShare(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { is_active } = req.body;
    const result = await updateShareRow(is_active, req.params.id, user.restaurant_id);
    if (!result.rowCount) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function myAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await getMyAlerts(user.restaurant_id);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function alerts(req: Request, res: Response, next: NextFunction) {
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
}

export async function createOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { product_name, offered_qty, offered_price, eta_hours, notes, unit } = req.body;
    if (!offered_qty || offered_price === undefined) {
      return res.status(400).json({ error: 'offered_qty y offered_price son requeridos' });
    }
    const alert = await getAlertForOffer(req.params.id, user.supplier_id);
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
      await client.query('COMMIT');
      await logAudit(req, 'offer', 'radar_alert', Number(req.params.id), null, { offered_price: Number(offered_price) });

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
}

export async function offers(req: Request, res: Response, next: NextFunction) {
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
}

export async function acceptOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const offer = await getOfferForAccept(req.params.id);
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
      orderCode = nextBusinessCode('ORDER');
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
      await client.query('COMMIT');
      await logAudit(req, 'accept_offer', 'radar_offer', Number(off.id), null, { order_id: orderId, total });
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
}

export async function rejectOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await rejectOfferRow(req.params.id, user.restaurant_id);
    if (!result.rowCount) return res.status(404).json({ error: 'Oferta no encontrada o no disponible' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function closeAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await closeAlertRow(req.params.id, user.restaurant_id);
    if (!result.rowCount) return res.status(404).json({ error: 'Alerta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
