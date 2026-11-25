import { query } from '../../../shared/config/db';

export function orderSelect() {
  return `SELECT o.*, r.name AS restaurant_name, s.name AS supplier_name,
                 COALESCE(s.email, '') AS supplier_email, COALESCE(u.email, '') AS restaurant_email
          FROM orders o
          JOIN restaurants r ON r.id = o.restaurant_id
          JOIN suppliers s ON s.id = o.supplier_id
          LEFT JOIN users u ON u.id = o.created_by`;
}

export function orderAccessWhere(user: {
  role: string;
  id: number;
  supplier_id: number | null;
  restaurant_id: number | null;
}, startIndex = 1) {
  if (user.role === 'proveedor_admin') {
    return { clause: ` AND o.supplier_id = $${startIndex}`, params: [user.supplier_id] as unknown[] };
  }
  if (user.role === 'domiciliario') {
    return {
      clause: ` AND EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id = o.id AND d.driver_id = $${startIndex})`,
      params: [user.id] as unknown[],
    };
  }
  if (user.restaurant_id) {
    return { clause: ` AND o.restaurant_id = $${startIndex}`, params: [user.restaurant_id] as unknown[] };
  }
  return { clause: '', params: [] as unknown[] };
}

export function findOrder(id: number | string) {
  return query('SELECT * FROM orders WHERE id = $1', [id]);
}

export function getFullOrder(id: number | string) {
  return query(`${orderSelect()} WHERE o.id = $1`, [id]);
}

export function getOrderItems(id: number | string) {
  return query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id]);
}

export function getOrderItemsPlain(id: number | string) {
  return query('SELECT * FROM order_items WHERE order_id = $1', [id]);
}

export function getDeliveryForDriver(orderId: number, driverId: number) {
  return query('SELECT 1 FROM deliveries WHERE order_id = $1 AND driver_id = $2', [orderId, driverId]);
}

export function getOrderDeliveries(id: number | string) {
  return query(
    `SELECT d.*, u.name AS driver_name, u.phone AS driver_phone,
            v.name AS vehicle_name, v.plate, v.type AS vehicle_type
     FROM deliveries d
     LEFT JOIN users u ON u.id = d.driver_id
     LEFT JOIN vehicles v ON v.id = d.vehicle_id
     WHERE d.order_id = $1 ORDER BY d.created_at DESC`,
    [id]
  );
}

export function getItemsForDispatch(id: number | string) {
  return query('SELECT product_id, quantity FROM order_items WHERE order_id = $1 AND product_id IS NOT NULL', [id]);
}

export function deliveryExists(orderId: number) {
  return query('SELECT id, status FROM deliveries WHERE order_id = $1', [orderId]);
}

export function getOrderAudit(id: number | string) {
  return query(
    `SELECT * FROM audit_log
     WHERE entity_type = 'order' AND entity_id = $1
     ORDER BY created_at DESC`,
    [id]
  );
}
