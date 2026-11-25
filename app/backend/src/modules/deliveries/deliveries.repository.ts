import { query } from '../../shared/config/db';

export function deliverySelect() {
  return `SELECT d.*, o.order_code, o.total AS order_total, o.notes AS order_notes,
                 o.supplier_id AS order_supplier_id,
                 r.name AS restaurant_name, r.phone AS restaurant_phone,
                 r.address AS restaurant_address,
                 v.name AS vehicle_name, v.plate, v.type AS vehicle_type,
                 v.current_lat AS vehicle_lat, v.current_lng AS vehicle_lng,
                 v.last_location_update, v.imei, v.gps_validated, v.gps_last_seen,
                 u.name AS driver_name, u.phone AS driver_phone,
                 cu.name AS created_by_name, cu.phone AS created_by_phone,
                 s.name AS supplier_name, s.phone AS supplier_phone
          FROM deliveries d
          JOIN orders o ON o.id = d.order_id
          JOIN restaurants r ON r.id = d.restaurant_id
          JOIN suppliers s ON s.id = o.supplier_id
          LEFT JOIN vehicles v ON v.id = d.vehicle_id
          LEFT JOIN users u ON u.id = d.driver_id
          LEFT JOIN users cu ON cu.id = o.created_by`;
}

/** Restringe una entrega al inquilino del usuario (proveedor, restaurante o domiciliario). */
export function deliveryAccessWhere(user: {
  role: string;
  id: number;
  supplier_id: number | null;
  restaurant_id: number | null;
}, startIndex = 1) {
  if (user.role === 'proveedor_admin') {
    return { clause: ` AND o.supplier_id = $${startIndex}`, params: [user.supplier_id] as unknown[] };
  }
  if (user.role === 'domiciliario') {
    return { clause: ` AND d.driver_id = $${startIndex}`, params: [user.id] as unknown[] };
  }
  if (user.restaurant_id) {
    return { clause: ` AND d.restaurant_id = $${startIndex}`, params: [user.restaurant_id] as unknown[] };
  }
  return { clause: '', params: [] as unknown[] };
}

/**
 * Alcance usado por los listados. Aplica las mismas reglas que
 * `deliveryAccessWhere` y marca como `denied` a los usuarios sin rol de
 * plataforma y sin inquilino asignado.
 */
export function deliveryListScope(
  user: {
    role: string;
    id: number;
    supplier_id: number | null;
    restaurant_id: number | null;
  },
  startIndex = 1
) {
  if (user.role === 'proveedor_admin' && user.supplier_id) {
    return {
      clause: ` AND o.supplier_id = $${startIndex}`,
      params: [user.supplier_id] as unknown[],
      denied: false,
    };
  }
  if (user.role === 'domiciliario') {
    return { clause: ` AND d.driver_id = $${startIndex}`, params: [user.id] as unknown[], denied: false };
  }
  if (user.restaurant_id) {
    return {
      clause: ` AND d.restaurant_id = $${startIndex}`,
      params: [user.restaurant_id] as unknown[],
      denied: false,
    };
  }
  return { clause: '', params: [] as unknown[], denied: user.role !== 'admin' };
}

export function getFullDelivery(id: number | string) {
  return query(`${deliverySelect()} WHERE d.id = $1`, [id]);
}

export function getDriverLocation(driverId: number) {
  return query('SELECT lat, lng, recorded_at FROM driver_locations WHERE driver_id = $1', [driverId]);
}

export function getDriverLocationFull(driverId: number) {
  return query('SELECT * FROM driver_locations WHERE driver_id = $1', [driverId]);
}

export function getDeliveryItems(id: number | string) {
  return query('SELECT * FROM delivery_items WHERE delivery_id = $1', [id]);
}

export function getOrderItems(id: number | string) {
  return query('SELECT * FROM order_items WHERE order_id = $1', [id]);
}

export function getDeliveryForOrder(orderId: number | string) {
  return query('SELECT * FROM deliveries WHERE order_id = $1', [orderId]);
}

export function getRouteLastPosition(id: number) {
  return query(
    `SELECT lat, lng FROM route_history
     WHERE delivery_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [id]
  );
}

export function getRouteHistory(id: number) {
  return query(
    `SELECT lat, lng, speed, recorded_at FROM route_history
     WHERE delivery_id = $1 ORDER BY recorded_at ASC`,
    [id]
  );
}

export function getOrderStatus(id: number) {
  return query('SELECT id, status FROM orders WHERE id = $1', [id]);
}

export function getVehicleForUpdate(id: number | string, isAdmin: boolean, supplierId: number | null) {
  return query(
    `SELECT id, supplier_id FROM vehicles
     WHERE id = $1 AND ($2::boolean = TRUE OR supplier_id = $3)`,
    [id, isAdmin, supplierId]
  );
}
