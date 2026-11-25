import { query } from '../../../shared/config/db';

export function getActiveSupplier(id: number) {
  return query('SELECT id, name FROM suppliers WHERE id = $1 AND is_active = TRUE', [id]);
}

export function getExistingReview(supplierId: number, userId: number) {
  return query(
    'SELECT id FROM "Reseña" WHERE supplier_id = $1 AND created_by = $2 LIMIT 1',
    [supplierId, userId]
  );
}

export function getUserName(id: number) {
  return query('SELECT name FROM users WHERE id = $1', [id]);
}

export function getSupplierAdmins(supplierId: number) {
  return query('SELECT id FROM users WHERE supplier_id = $1', [supplierId]);
}
