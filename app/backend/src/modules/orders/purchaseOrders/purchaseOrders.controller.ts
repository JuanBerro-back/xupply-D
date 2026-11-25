import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import { logAudit } from '../../../shared/lib/audit';
import { createPurchaseOrderDraft } from '../../../shared/lib/oc';
import { getPurchaseOrderById, getPurchaseOrderItems } from './purchaseOrders.repository';

export async function createDraft(req: Request, res: Response, next: NextFunction) {
  const restaurantId = (req as any).user?.restaurant_id;
  const createdBy = (req as any).user?.id ?? null;
  if (!restaurantId) {
    return res.status(400).json({ error: 'Restaurante no encontrado en sesión' });
  }
  const { supplier_id, items, notes } = req.body || {};
  try {
    const result = await createPurchaseOrderDraft({ restaurantId, createdBy, supplierId: supplier_id, items, notes });
    const poId = result.purchase_order.id;
    try {
      await logAudit(req as any, 'CREATE_PO_DRAFT', 'purchase_order', poId, null, { action: 'create_draft', ...result.purchase_order });
    } catch (_) {}
    res.status(201).json({ message: 'Borrador de OC creado', purchase_order: result.purchase_order, items: result.items });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = (req as any).user?.restaurant_id;
    const supplierId = req.query.supplier_id;
    const params: any[] = [restaurantId];
    let where = 'WHERE po.restaurant_id=$1';
    if (supplierId) { params.push(supplierId); where += ` AND po.supplier_id=$${params.length}`; }
    const { rows } = await query(
      `SELECT po.*, s.name as supplier_name
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id=po.supplier_id
       ${where}
       ORDER BY po.created_at DESC
       LIMIT 50`,
      params
    );
    res.json({ purchase_orders: rows });
  } catch (err) { next(err); }
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    const restaurantId = (req as any).user?.restaurant_id;
    const id = Number(req.params.id);
    const po = await getPurchaseOrderById(id, restaurantId);
    if (po.rows.length === 0) return res.status(404).json({ error: 'Borrador no encontrado' });
    const items = await getPurchaseOrderItems(id);
    res.json({ purchase_order: po.rows[0], items: items.rows });
  } catch (err) { next(err); }
}
