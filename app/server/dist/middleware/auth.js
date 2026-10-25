"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearPermissionCache = clearPermissionCache;
exports.signToken = signToken;
exports.authRequired = authRequired;
exports.roleRequired = roleRequired;
exports.requirePermission = requirePermission;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../config/db");
const RAW_JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
if (!RAW_JWT_SECRET || !RAW_JWT_SECRET.trim()) {
    const message = '[Auth] JWT_SECRET no está configurado. Define la variable de entorno JWT_SECRET ' +
        'con un valor largo y aleatorio antes de iniciar el servidor.';
    if (IS_PRODUCTION) {
        // No arrancar en producción con un secreto por defecto: permitiría falsificar tokens.
        throw new Error(message);
    }
    console.warn(`${message} Usando un secreto SOLO para desarrollo.`);
}
const JWT_SECRET = (RAW_JWT_SECRET && RAW_JWT_SECRET.trim()) || 'dev-only-insecure-secret-change-me';
// Sesiones cortas: antes 7 días. Configurable por entorno.
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '12h');
const permissionCache = new Map();
let cacheLoaded = false;
async function loadPermissions() {
    if (cacheLoaded)
        return;
    const result = await (0, db_1.query)(`SELECT rp.role_id, p.name AS permission
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id`);
    for (const row of result.rows) {
        if (!permissionCache.has(row.role_id)) {
            permissionCache.set(row.role_id, new Set());
        }
        permissionCache.get(row.role_id).add(row.permission);
    }
    cacheLoaded = true;
}
async function clearPermissionCache() {
    permissionCache.clear();
    cacheLoaded = false;
}
function signToken(user) {
    return jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });
}
async function authRequired(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(header.slice(7), JWT_SECRET, {
            algorithms: ['HS256'],
        });
        // Verificación en tiempo real contra la BD: además de invalidar sesiones
        // antiguas, el rol y el inquilino se toman SIEMPRE de la base de datos y no
        // del token. Así un cambio de rol/restaurante/proveedor se aplica al
        // instante (antes el JWT podía seguir diciendo lo contrario hasta caducar).
        const userCheck = await (0, db_1.query)(`SELECT u.id, u.username, u.name, u.token_version, u.is_active,
              u.role_id, r.name AS role, u.restaurant_id, u.supplier_id, u.branch_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`, [decoded.id]);
        if (!userCheck.rowCount || !userCheck.rows[0].is_active) {
            return res.status(401).json({ error: 'Cuenta inactiva o eliminada' });
        }
        // Comparar SIEMPRE la versión del token contra la de la BD. Los tokens sin versión
        // (emitidos antes de habilitar esta columna) se rechazan para forzar un nuevo inicio de sesión.
        if (Number(decoded.token_version ?? -1) !== Number(userCheck.rows[0].token_version)) {
            return res.status(401).json({ error: 'Sesión invalidada por cambios en la cuenta. Por favor inicie sesión nuevamente.' });
        }
        const row = userCheck.rows[0];
        req.user = {
            id: Number(row.id),
            username: row.username,
            name: row.name,
            role: row.role,
            role_id: Number(row.role_id),
            restaurant_id: row.restaurant_id === null ? null : Number(row.restaurant_id),
            supplier_id: row.supplier_id === null ? null : Number(row.supplier_id),
            branch_id: row.branch_id === null ? null : Number(row.branch_id),
            token_version: Number(row.token_version),
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}
function roleRequired(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'No autenticado' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'No autorizado para esta acción' });
        }
        next();
    };
}
function requirePermission(...permissionNames) {
    return async (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'No autenticado' });
        // Sin bypass por rol: incluso 'admin' pasa solo si su rol tiene el permiso.
        // El rol admin (role_id 1) recibe todos los permisos en la siembra/migración.
        await loadPermissions();
        const userPerms = permissionCache.get(req.user.role_id) ?? new Set();
        const hasPermission = permissionNames.some((p) => userPerms.has(p));
        if (!hasPermission) {
            return res.status(403).json({ error: 'No tienes permiso para esta acción' });
        }
        next();
    };
}
