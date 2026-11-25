import { query } from '../../../shared/config/db';

export function getPredictions(restaurantId: number) {
  return query('SELECT * FROM v_inventory_predictions WHERE restaurant_id = $1 ORDER BY urgency DESC', [restaurantId]);
}

export function getReportOrders(restaurantId: number) {
  return query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(total), 0) AS revenue,
              COALESCE(AVG(total), 0) AS avg_order
       FROM orders WHERE restaurant_id = $1`,
      [restaurantId]
  );
}

export function getReportInventory(restaurantId: number) {
  return query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(CASE WHEN stock_status = 'critical' THEN 1 ELSE 0 END), 0)::int AS critical
       FROM inventory WHERE restaurant_id = $1`,
      [restaurantId]
  );
}
