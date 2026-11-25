import { query } from '../../../shared/config/db';

export function getShares(restaurantId: number | string | null) {
  return query(
      `SELECT rs.*, s.name AS supplier_name
         FROM radar_shares rs
         JOIN suppliers s ON s.id = rs.supplier_id
        WHERE rs.restaurant_id = $1
        ORDER BY rs.created_at DESC`,
      [restaurantId]
  );
}

export function updateShare(isActive: unknown, id: number | string, restaurantId: number | string | null) {
  return query(
      `UPDATE radar_shares SET is_active = COALESCE($1, is_active)
        WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
      [isActive, id, restaurantId]
  );
}

export function getMyAlerts(restaurantId: number | string | null) {
  return query(
      `SELECT a.*, i.name AS item_name, i.category, s.name AS supplier_name
         FROM radar_alerts a
         JOIN inventory i ON i.id = a.inventory_id
         JOIN suppliers s ON s.id = a.supplier_id
        WHERE a.restaurant_id = $1 AND a.status IN ('abierta', 'ofertada')
        ORDER BY (a.level = 'critical') DESC, a.opened_at DESC LIMIT 100`,
      [restaurantId]
  );
}

export function getAlertForOffer(id: number | string, supplierId: number | string | null) {
  return query(
      `SELECT a.*, i.name AS item_name, i.unit AS item_unit
         FROM radar_alerts a JOIN inventory i ON i.id = a.inventory_id
        WHERE a.id = $1 AND a.supplier_id = $2 AND a.status = 'abierta'`,
      [id, supplierId]
  );
}

export function getOfferForAccept(id: number | string) {
  return query(
      `SELECT o.*, a.restaurant_id, a.inventory_id, a.supplier_id AS alert_supplier
         FROM radar_offers o JOIN radar_alerts a ON a.id = o.alert_id
        WHERE o.id = $1 AND o.status = 'pendiente' AND o.valid_until > CURRENT_TIMESTAMP`,
      [id]
  );
}

export function rejectOffer(id: number | string, restaurantId: number | string | null) {
  return query(
      `UPDATE radar_offers o
          SET status = 'rechazada'
         FROM radar_alerts a
        WHERE o.id = $1 AND a.id = o.alert_id AND a.restaurant_id = $2 AND o.status = 'pendiente'
        RETURNING o.*`,
      [id, restaurantId]
  );
}

export function closeAlert(id: number | string, restaurantId: number | string | null) {
  return query(
      `UPDATE radar_alerts SET status = 'cerrada'
        WHERE id = $1 AND restaurant_id = $2 AND status IN ('abierta', 'ofertada')
        RETURNING *`,
      [id, restaurantId]
  );
}
