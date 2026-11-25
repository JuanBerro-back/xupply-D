import { query } from '../../../shared/config/db';

export function getPurchaseOrderById(id: number, restaurantId: number | string | null) {
  return query('SELECT * FROM purchase_orders WHERE id=$1 AND restaurant_id=$2', [id, restaurantId]);
}

export function getPurchaseOrderItems(id: number) {
  return query('SELECT * FROM purchase_order_items WHERE purchase_order_id=$1 ORDER BY id ASC', [id]);
}
