import { query } from '../../../shared/config/db';

export function getHistoricalConsumption(restaurantId: number | string, dias: number, limite: number) {
  return query(
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
}

export function getLastOrder(restaurantId: number | string) {
  return query(
      `SELECT * FROM orders
       WHERE restaurant_id=$1 AND status <> 'cancelado'
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [restaurantId]
  );
}

export function getOrderItems(id: number) {
  return query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY id ASC', [id]);
}

export function getActiveSuppliers() {
  return query(
      `SELECT s.id, s.name, s.is_active, COUNT(p.id) AS sku_count
       FROM suppliers s
       LEFT JOIN products p ON p.supplier_id=s.id AND p.is_active=TRUE
       WHERE s.is_active=TRUE
       GROUP BY s.id, s.name, s.is_active
       ORDER BY s.name ASC`
  );
}
