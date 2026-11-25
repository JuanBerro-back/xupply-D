import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import { getHistoricalConsumption, getLastOrder, getOrderItems, getActiveSuppliers } from './agent.repository';

export async function consumoHistorico(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = (req as any).user?.restaurant_id;
    const dias = Math.max(14, Number(req.query.dias) || 30);
    const limite = Math.max(10, Math.min(60, Number(req.query.limite_skus) || 40));
    if (!restaurantId) return res.status(400).json({ error: 'Restaurante no encontrado en sesión' });
    const { rows } = await getHistoricalConsumption(restaurantId, dias, limite);
    res.json({ items: rows, dias, limite });
  } catch (err) { next(err); }
}

export async function ultimoPedido(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = (req as any).user?.restaurant_id;
    if (!restaurantId) return res.status(400).json({ error: 'Restaurante no encontrado en sesión' });
    const last = await getLastOrder(restaurantId);
    if (last.rows.length === 0) return res.json({ order: null, items: [] });
    const id = last.rows[0].id;
    const items = await getOrderItems(id);
    res.json({ order: last.rows[0], items: items.rows });
  } catch (err) { next(err); }
}

export async function catalogoPrecios(req: Request, res: Response, next: NextFunction) {
  try {
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const search = req.query.search ? String(req.query.search) : null;
    const params: any[] = [];
    let where = 'WHERE p.is_active=TRUE';
    if (supplierId) { params.push(supplierId); where += ` AND p.supplier_id=$${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`; }
    const { rows } = await query(
      `SELECT p.id, p.sku, p.name, p.unit, p.price_per_unit, p.min_order_qty, p.stock_available, p.supplier_id, s.name as supplier_name
       FROM products p
       LEFT JOIN suppliers s ON s.id=p.supplier_id
       ${where}
       ORDER BY p.name ASC
       LIMIT 100`,
      params
    );
    res.json({ products: rows });
  } catch (err) { next(err); }
}

export async function proveedoresVigentes(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await getActiveSuppliers();
    res.json({ suppliers: rows });
  } catch (err) { next(err); }
}
