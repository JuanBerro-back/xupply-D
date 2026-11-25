import { query } from '../../../shared/config/db';

export function getAlerts(restaurantId: number | null) {
  return query(
    `SELECT * FROM inventory
     WHERE restaurant_id = $1 AND is_active = TRUE
       AND stock_status IN ('critical', 'low')
     ORDER BY stock_status, name`,
    [restaurantId]
  );
}

export function getPredictions(restaurantId: number | null) {
  return query(`SELECT * FROM v_inventory_predictions WHERE restaurant_id = $1 ORDER BY urgency DESC, item_name`, [restaurantId]);
}

export function findInventoryForTenant(id: number | string, restaurantId: number | null) {
  return query('SELECT stock_status FROM inventory WHERE id = $1 AND restaurant_id = $2', [id, restaurantId]);
}

export function getInventoryForTenant(id: number | string, restaurantId: number | null) {
  return query('SELECT * FROM inventory WHERE id = $1 AND restaurant_id = $2', [id, restaurantId]);
}

export function getInventoryById(id: number | string) {
  return query('SELECT * FROM inventory WHERE id = $1', [id]);
}
