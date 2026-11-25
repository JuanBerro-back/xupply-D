import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import { emitInventoryAlert } from '../../../shared/lib/realtime';
import { checkRadarTrigger } from './inventory.radar';
import { getAlerts, getPredictions, findInventoryForTenant, getInventoryForTenant, getInventoryById } from './inventory.repository';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { status } = req.query;
    const params: unknown[] = [user.restaurant_id];
    let sql = `SELECT i.*, s.name AS supplier_name
               FROM inventory i
               LEFT JOIN suppliers s ON s.id = i.supplier_id
               WHERE i.restaurant_id = $1 AND i.is_active = TRUE`;
    if (status) {
      params.push(status);
      sql += ` AND i.stock_status = $${params.length}`;
    }
    sql += ' ORDER BY i.name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function alerts(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await getAlerts(user.restaurant_id);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function predictions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await getPredictions(user.restaurant_id);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier_id, expiry_date } =
      req.body;
    if (!name) return res.status(400).json({ error: 'name es requerido' });
    const result = await query(
      `INSERT INTO inventory (restaurant_id, branch_id, name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier_id, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [user.restaurant_id, user.branch_id, name, category, unit ?? 'kg', current_stock ?? 0, min_stock ?? 0, max_stock ?? 0, cost_per_unit ?? 0, supplier_id, expiry_date]
    );
    const item = result.rows[0];
    if (item.stock_status === 'critical' && user.restaurant_id) {
      emitInventoryAlert(user.restaurant_id, { message: `Stock crítico: ${item.name}` });
    }
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { current_stock, min_stock, name, category, unit, max_stock, cost_per_unit, supplier_id, expiry_date } =
      req.body;
    const previous = await findInventoryForTenant(req.params.id, user.restaurant_id);
    const result = await query(
      `UPDATE inventory
       SET name = COALESCE($2, name), category = COALESCE($3, category),
           unit = COALESCE($4, unit), current_stock = COALESCE($5, current_stock),
           min_stock = COALESCE($6, min_stock), max_stock = COALESCE($7, max_stock),
           cost_per_unit = COALESCE($8, cost_per_unit),
           supplier_id = COALESCE($9, supplier_id),
           expiry_date = COALESCE($10, expiry_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND restaurant_id = $11
       RETURNING *`,
      [req.params.id, name, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier_id, expiry_date, user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Ítem de inventario no encontrado' });
    const updated = result.rows[0];
    const previousStatus = previous.rowCount ? previous.rows[0].stock_status : updated.stock_status;
    if (previousStatus !== updated.stock_status) {
      void checkRadarTrigger(updated, previousStatus);
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function addMovement(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { type, quantity, notes } = req.body;
    const current = await getInventoryForTenant(req.params.id, user.restaurant_id);
    if (!current.rowCount) return res.status(404).json({ error: 'Ítem no encontrado' });
    const item = current.rows[0];
    const previous = Number(item.current_stock);
    const newStock = type === 'entrada' ? previous + Number(quantity) : Math.max(0, previous - Number(quantity));
    await query(
      `UPDATE inventory SET current_stock = $1, stock_status = CASE
         WHEN $1 <= min_stock THEN 'critical'::inventory_stock_status
         WHEN $1 <= min_stock * 2 THEN 'low'::inventory_stock_status
         ELSE 'normal'::inventory_stock_status END, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newStock, req.params.id]
    );
    await query(
      `INSERT INTO inventory_movements (inventory_id, type, quantity, previous_stock, new_stock, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.params.id, type, quantity, previous, newStock, notes, user.id]
    );
    const updated = await getInventoryById(req.params.id);
    if (updated.rowCount && updated.rows[0].stock_status !== item.stock_status) {
      void checkRadarTrigger(updated.rows[0], item.stock_status);
      if (updated.rows[0].stock_status === 'critical') {
        emitInventoryAlert(user.restaurant_id ?? 0, { message: `Stock crítico: ${updated.rows[0].name}` });
      }
    }
    res.json({ ok: true, previous_stock: previous, new_stock: newStock });
  } catch (err) {
    next(err);
  }
}
