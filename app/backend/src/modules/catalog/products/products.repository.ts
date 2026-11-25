import { query } from '../../../shared/config/db';

export function productBaseSelect() {
  return `SELECT p.*, pc.name AS category, pc.id AS category_id, s.name AS supplier_name
          FROM products p
          JOIN product_categories pc ON pc.id = p.category_id
          JOIN suppliers s ON s.id = p.supplier_id`;
}

export function getProductById(id: number | string) {
  return query(`${productBaseSelect()} WHERE p.id = $1`, [id]);
}

export function supplierExists(id: number) {
  return query('SELECT 1 FROM suppliers WHERE id = $1', [id]);
}

export function findProduct(id: number | string) {
  return query('SELECT * FROM products WHERE id = $1', [id]);
}

export function deactivateProduct(id: number | string) {
  return query('UPDATE products SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}
