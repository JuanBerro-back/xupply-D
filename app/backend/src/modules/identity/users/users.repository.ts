import { query } from '../../../shared/config/db';

// Asegurar columnas de asignación de vehículo en usuarios
query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_type VARCHAR(50);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(50);
`).catch(() => undefined);

export function getRoleName(id: number | string | null) {
  return query('SELECT name FROM roles WHERE id = $1', [id]);
}

export function usernameExists(username: string) {
  return query('SELECT id FROM users WHERE username = $1', [username]);
}

export function restaurantExists(id: number | string | null) {
  return query('SELECT 1 FROM restaurants WHERE id = $1', [id]);
}

export function branchExists(branchId: number | string, restaurantId: number | string | null) {
  return query('SELECT 1 FROM branches WHERE id = $1 AND restaurant_id = $2', [branchId, restaurantId]);
}

export function supplierExists(id: number | string | null) {
  return query('SELECT 1 FROM suppliers WHERE id = $1', [id]);
}

export function deactivateUserById(id: number | string | null) {
  return query('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

export function activateUserById(id: number | string | null) {
  return query('UPDATE users SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

export function updatePassword(hash: string, id: number | string | null) {
  return query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, id]);
}
