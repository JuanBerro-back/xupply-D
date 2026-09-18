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

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    next();
  } catch {
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