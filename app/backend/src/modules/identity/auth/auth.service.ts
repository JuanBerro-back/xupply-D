import { rateLimit } from '../utils/rateLimit';
import { getAllPermissions, getRolePermissions } from './auth.repository';

// Protección contra fuerza bruta y creación masiva de cuentas.
export const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth:login' });
export const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'auth:register' });

/** Permisos efectivos: admin obtiene todos; el resto, los de su rol. */
export async function permissionsForRole(role: string, roleId: number): Promise<string[]> {
  if (role === 'admin') {
    const all = await getAllPermissions();
    return all.rows.map((r: { name: string }) => r.name);
  }
  const perms = await getRolePermissions(roleId);
  return perms.rows.map((r: { name: string }) => r.name);
}

export function buildPayload(row: {
  id: number;
  username: string;
  role: string;
  role_id: number;
  restaurant_id: number | null;
  supplier_id: number | null;
  branch_id: number | null;
  token_version?: number;
}) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    role_id: row.role_id,
    restaurant_id: row.restaurant_id,
    supplier_id: row.supplier_id,
    branch_id: row.branch_id,
    token_version: row.token_version,
  };
}
