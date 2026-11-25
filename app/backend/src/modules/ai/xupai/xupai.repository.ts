import { query } from '../../../shared/config/db';

export async function getConsumoHistorico(restaurantId: number, dias: number, limite: number) {
  const diasSafe = Math.max(14, Number(dias) || 30);
  const limiteSafe = Math.max(10, Math.min(60, Number(limite) || 40));
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
    [restaurantId, diasSafe, limiteSafe]
  );
  return { dias: diasSafe, items: rows };
}

export async function getUltimoPedido(restaurantId: number) {
  const last = await query(
    `SELECT * FROM orders
     WHERE restaurant_id=$1 AND status <> 'cancelado'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [restaurantId]
  );
  if (last.rows.length === 0) return { order: null, items: [] };
  const items = await query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id ASC', [last.rows[0].id]);
  return { order: last.rows[0], items: items.rows };
}

export async function getCatalogoPrecios(supplierId: number | null, search: string | null) {
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
  return { products: rows };
}

export async function getProveedoresVigentes() {
  const { rows } = await query(
    `SELECT s.id, s.name, s.is_active, COUNT(p.id) AS sku_count
     FROM suppliers s
     LEFT JOIN products p ON p.supplier_id=s.id AND p.is_active=TRUE
     WHERE s.is_active=TRUE
     GROUP BY s.id, s.name, s.is_active
     ORDER BY s.name ASC`
  );
  return { suppliers: rows };
}
