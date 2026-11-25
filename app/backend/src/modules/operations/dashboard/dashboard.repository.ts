import { query } from '../../../shared/config/db';

export function getSupplierCategory(id: number) {
  return query('SELECT category FROM suppliers WHERE id = $1', [id]);
}

export function getRestaurantCategory(id: number) {
  return query('SELECT category FROM restaurants WHERE id = $1', [id]);
}

export function getDailySuggestions() {
  return query(
      `SELECT p.id, p.name, p.unit, p.price_per_unit::float, p.supplier_id, s.name AS supplier_name, p.image_url,
              'Insumo esencial de alta rotación para la cocina' AS reason
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.is_active = TRUE AND p.stock_available > 0
       ORDER BY p.id ASC
       LIMIT 6`
  );
}

export function getDailyDiscounts() {
  return query(
      `SELECT p.id, p.name, p.unit, p.price_per_unit::float, p.supplier_id, s.name AS supplier_name, p.image_url,
              ROUND((p.price_per_unit * 1.25)::numeric, 0)::float AS original_price,
              20 AS discount_pct,
              'Oferta del día por compras en línea' AS promo_tag
       FROM products p
       JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.is_active = TRUE AND p.stock_available > 0
       ORDER BY p.price_per_unit DESC
       LIMIT 4`
  );
}

export function getRawSuppliers() {
  return query(
      `SELECT s.id, s.name, s.category, s.rating, s.review_count, s.city, s.phone, s.logo_url
       FROM suppliers s WHERE s.is_active = TRUE`
  );
}

export function getRestDirectory() {
  return query(
        `SELECT r.id, r.name, r.city, r.category, r.created_at
         FROM restaurants r
         WHERE r.is_active = TRUE
         ORDER BY r.created_at DESC
         LIMIT 10`
  );
}

export function getSupplierListing() {
  return query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id AND p.is_active = TRUE) AS product_count,
              (SELECT COUNT(*) FROM orders o WHERE o.supplier_id = s.id) AS order_count
       FROM suppliers s
       WHERE s.is_active = TRUE
       ORDER BY s.rating DESC`
  );
}
