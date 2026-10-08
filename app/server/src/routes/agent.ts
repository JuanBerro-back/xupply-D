import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/consumo-historico', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const restaurantId = (req as any).user?.restaurant_id;
    const dias = Math.max(14, Number(req.query.dias) || 30);
    const limite = Math.max(10, Math.min(60, Number(req.query.limite_skus) || 40));
    if (!restaurantId) return res.status(400).json({ error: 'Restaurante no encontrado en sesión' });
    const { rows } = await query(
      `SELECT
         oi.product_id,
         MAX(oi.name) AS name,
         SUM(oi.quantity) AS total_qty,
         COUNT(DISTINCT o.id) AS num_pedidos,
         MAX(o.created_at) AS last_order_date,
         ROUND(SUM(oi.quantity) / NULLIF($2,0), 2) AS avg_qty_30d,
         ROUND(EXTRACT(DAY FROM (NOW() - MAX(o.created_at))), 0) AS days_since_last
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.restaurant_id = $1 AND o.status <> 'cancelado' AND o.created_at >= NOW() - ($2::int || ' days')::interval
       GROUP BY oi.product_id
       HAVING SUM(oi.quantity) > 0
       ORDER BY total_qty DESC
       LIMIT $3`,
      [restaurantId, dias, limite]
    );
    res.json({ items: rows, dias, limite });
  } catch (err) { next(err); }
});

router.get('/ultimo-pedido', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const restaurantId = (req as any).user?.restaurant_id;
    if (!restaurantId) return res.status(400).json({ error: 'Restaurante no encontrado en sesión' });
    const last = await query(
      `SELECT * FROM orders
       WHERE restaurant_id=$1 AND status <> 'cancelado'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [restaurantId]
    );
    if (last.rows.length === 0) return res.json({ order: null, items: [] });
    const id = last.rows[0].id;
    const items = await query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id ASC', [id]);
    res.json({ order: last.rows[0], items: items.rows });
  } catch (err) { next(err); }
});

router.get('/catalogo-precios', roleRequired('gerente', 'admin'), async (req, res, next) => {
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
});

router.get('/proveedores-vigentes', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.id, s.name, s.is_active, COUNT(p.id) AS sku_count
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id=s.id AND p.is_active=TRUE
       WHERE s.is_active=TRUE
       GROUP BY s.id, s.name, s.is_active
       ORDER BY s.name ASC`
    );
    res.json({ suppliers: rows });
  } catch (err) { next(err); }
});

export default router;
