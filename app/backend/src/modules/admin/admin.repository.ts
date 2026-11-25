import { query } from '../../shared/config/db';

export function usernameExists(username: string) {
  return query('SELECT id FROM users WHERE username = $1', [username]);
}

export function getRoleName(id: number | string | null) {
  return query('SELECT name FROM roles WHERE id = $1', [id]);
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

export function findUserById(id: number | string | null) {
  return query('SELECT * FROM users WHERE id = $1', [id]);
}

export function countActiveAdmins() {
  return query('SELECT count(*) FROM users WHERE role_id = 1 AND is_active = TRUE');
}

export function listRoles() {
  return query('SELECT id, name, display_name, description, created_at, updated_at FROM roles ORDER BY id');
}

export function findRoleById(id: number | string | null) {
  return query('SELECT id, name, display_name, description, created_at, updated_at FROM roles WHERE id = $1', [id]);
}

export function roleNameExists(name: string) {
  return query('SELECT id FROM roles WHERE name = $1', [name]);
}

export function findRole(id: number | string | null) {
  return query('SELECT * FROM roles WHERE id = $1', [id]);
}

export function updatePassword(hash: string, id: number | string | null) {
  return query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, id]);
}

export function forceLogout(id: number | string | null) {
  return query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [id]);
}

export function deleteUser(id: number | string | null) {
  return query('DELETE FROM users WHERE id = $1', [id]);
}
