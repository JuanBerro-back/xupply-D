import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  role_id: number;
  restaurant_id: number | null;
  supplier_id: number | null;
  branch_id: number | null;
  token_version?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'xupply-secret-change-me';

const permissionCache = new Map<number, Set<string>>();
let cacheLoaded = false;

async function loadPermissions() {
  if (cacheLoaded) return;
  const result = await query(
    `SELECT rp.role_id, p.name AS permission
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id`
  );
  for (const row of result.rows) {
    if (!permissionCache.has(row.role_id)) {
      permissionCache.set(row.role_id, new Set());
    }
    permissionCache.get(row.role_id)!.add(row.permission);
  }
  cacheLoaded = true;
}

export async function clearPermissionCache() {
  permissionCache.clear();
  cacheLoaded = false;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    
    // Verificación en tiempo real contra DB para invalidar sesiones antiguas,
    // revocar accesos de usuarios inactivos o cuando sus roles/permisos cambian drásticamente.
    const userCheck = await query('SELECT token_version, is_active FROM users WHERE id = $1', [decoded.id]);
    
    if (!userCheck.rowCount || !userCheck.rows[0].is_active) {
      return res.status(401).json({ error: 'Cuenta inactiva o eliminada' });
    }
    
    // Si el token tiene version, compararla. Si el token es antiguo (antes de agregar la columna),
    // se considerará válido hasta que se venza o se requiera forzosamente.
    if (decoded.token_version !== undefined && userCheck.rows[0].token_version !== decoded.token_version) {
      return res.status(401).json({ error: 'Sesión invalidada por cambios en la cuenta. Por favor inicie sesión nuevamente.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function roleRequired(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No autorizado para esta acción' });
    }
    next();
  };
}

export function requirePermission(...permissionNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (req.user.role === 'admin') return next();
    await loadPermissions();
    const userPerms = permissionCache.get(req.user.role_id) ?? new Set();
    const hasPermission = permissionNames.some((p) => userPerms.has(p));
    if (!hasPermission) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}