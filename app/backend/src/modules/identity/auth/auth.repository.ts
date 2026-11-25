import { query } from '../../../shared/config/db';

export function findUserByUsername(username: string) {
  return query('SELECT id FROM users WHERE username = $1', [username]);
}

export function findDuplicateNit(table: string, nit: string) {
  return query(`SELECT id FROM ${table} WHERE nit = $1`, [nit]);
}

export function findDuplicateEmail(email: string) {
  return query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE lower(email) = lower($1)) +
       (SELECT COUNT(*) FROM restaurants WHERE lower(email) = lower($1)) +
       (SELECT COUNT(*) FROM suppliers WHERE lower(email) = lower($1)) AS count`,
    [email]
  );
}

export function getAllPermissions() {
  return query('SELECT name FROM permissions');
}

export function getRolePermissions(roleId: number) {
  return query(
    `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`,
    [roleId]
  );
}

export function updateLastLogin(id: number) {
  return query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

export function getRoles() {
  return query('SELECT * FROM roles ORDER BY id');
}

export function incrementTokenVersion(id: number) {
  return query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [id]);
}

export function getPasswordHash(id: number) {
  return query('SELECT password_hash FROM users WHERE id = $1', [id]);
}

export function updatePassword(hash: string, id: number) {
  return query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, id]);
}

export function updateSubscriptionPlan(plan: string, restaurantId: number) {
  return query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2 RETURNING id', [plan, restaurantId]);
}

export function getRestaurantTenant(id: number) {
  return query('SELECT id, name, logo_url, category, COALESCE(subscription_plan, \'medio\') AS subscription_plan FROM restaurants WHERE id = $1', [id]);
}

export function getSupplierTenant(id: number) {
  return query('SELECT id, name, logo_url, category FROM suppliers WHERE id = $1', [id]);
}
