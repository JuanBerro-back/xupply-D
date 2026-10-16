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
    return jsonwebtoken_1.default.sign(user, JWT_SECRET, { expiresIn: '7d' });
}
async function authRequired(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token requerido' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(header.slice(7), JWT_SECRET);
        // Verificación en tiempo real contra DB para invalidar sesiones antiguas,
        // revocar accesos de usuarios inactivos o cuando sus roles/permisos cambian drásticamente.
        const userCheck = await (0, db_1.query)('SELECT token_version, is_active FROM users WHERE id = $1', [decoded.id]);
        if (!userCheck.rowCount || !userCheck.rows[0].is_active) {
            return res.status(401).json({ error: 'Cuenta inactiva o eliminada' });
        }
        // Comparar SIEMPRE la versión del token contra la de la BD. Los tokens sin versión
        // (emitidos antes de habilitar esta columna) se rechazan para forzar un nuevo inicio de sesión.
        if (Number(decoded.token_version ?? -1) !== Number(userCheck.rows[0].token_version)) {
            return res.status(401).json({ error: 'Sesión invalidada por cambios en la cuenta. Por favor inicie sesión nuevamente.' });
        }
        req.user = decoded;
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
        if (req.user.role === 'admin')
            return next();
        await loadPermissions();
        const userPerms = permissionCache.get(req.user.role_id) ?? new Set();
        const hasPermission = permissionNames.some((p) => userPerms.has(p));
        if (!hasPermission) {
            return res.status(403).json({ error: 'No tienes permiso para esta acción' });
        }
        next();
    };
}
