"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../config/db");
const auth_1 = require("../middleware/auth");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const audit_1 = require("../lib/audit");
const realtime_1 = require("../lib/realtime");
const userTenant_1 = require("../lib/userTenant");
const router = (0, express_1.Router)();
router.use(auth_1.authRequired);
// ==========================================
// USUARIOS
// ==========================================
router.get('/users', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { q, role_id, restaurant_id, supplier_id, is_active, page = '1', limit = '20' } = req.query;
        let sql = `SELECT u.id, u.username, u.name, u.email, u.phone, u.role_id, 
                      u.restaurant_id, u.branch_id, u.supplier_id, u.is_active, 
                      u.last_login, u.created_at, u.vehicle_type, u.vehicle_plate,
                      r.name AS role_name, r.display_name AS role_label
               FROM users u
               JOIN roles r ON r.id = u.role_id
               WHERE 1=1`;
        const params = [];
        if (q) {
            params.push(`%${q}%`);
            sql += ` AND (u.name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
        }
        if (role_id) {
            params.push(Number(role_id));
            sql += ` AND u.role_id = $${params.length}`;
        }
        if (restaurant_id) {
            params.push(Number(restaurant_id));
            sql += ` AND u.restaurant_id = $${params.length}`;
        }
        if (supplier_id) {
            params.push(Number(supplier_id));
            sql += ` AND u.supplier_id = $${params.length}`;
        }
        if (is_active !== undefined) {
            params.push(is_active === 'true');
            sql += ` AND u.is_active = $${params.length}`;
        }
        // Count total for pagination
        const countResult = await (0, db_1.query)(`SELECT COUNT(*) FROM (${sql}) AS t`, params);
        const total = parseInt(countResult.rows[0].count, 10);
        // Pagination
        const p = Math.max(1, Number(page));
        const l = Math.max(1, Number(limit));
        sql += ` ORDER BY u.created_at DESC LIMIT ${l} OFFSET ${(p - 1) * l}`;
        const result = await (0, db_1.query)(sql, params);
        res.json({
            data: result.rows,
            meta: {
                total,
                page: p,
                limit: l,
                pages: Math.ceil(total / l)
            }
        });
    }
    catch (err) {
        next(err);
    }
});
router.get('/users/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT u.id, u.username, u.name, u.email, u.phone, u.role_id, 
              u.restaurant_id, u.branch_id, u.supplier_id, u.is_active, 
              u.last_login, u.created_at, u.updated_at, u.vehicle_type, u.vehicle_plate,
              r.name AS role_name, r.display_name AS role_label,
              rest.name AS restaurant_name,
              br.name AS branch_name,
              sup.name AS supplier_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN restaurants rest ON rest.id = u.restaurant_id
       LEFT JOIN branches br ON br.id = u.branch_id
       LEFT JOIN suppliers sup ON sup.id = u.supplier_id
       WHERE u.id = $1`, [id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.post('/users', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { username, password, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate } = req.body;
        if (!username || !password || !name || !role_id) {
            return res.status(400).json({ error: 'username, password, name y role_id son obligatorios' });
        }
        if (String(password).length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }
        const exists = await (0, db_1.query)('SELECT id FROM users WHERE username = $1', [username.trim()]);
        if (exists.rowCount)
            return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        // Validar que el rol exista y que el inquilino sea coherente con el rol.
        const roleRow = await (0, db_1.query)('SELECT name FROM roles WHERE id = $1', [Number(role_id)]);
        const roleName = roleRow.rows[0]?.name;
        if (!roleName)
            return res.status(400).json({ error: 'El role_id proporcionado no existe' });
        let restId = restaurant_id ? Number(restaurant_id) : null;
        let branchId = branch_id ? Number(branch_id) : null;
        let supId = supplier_id ? Number(supplier_id) : null;
        if (restId) {
            const restCheck = await (0, db_1.query)('SELECT 1 FROM restaurants WHERE id = $1', [restId]);
            if (!restCheck.rowCount)
                return res.status(400).json({ error: `El restaurant_id ${restId} no existe` });
        }
        if (branchId) {
            const branchCheck = await (0, db_1.query)('SELECT 1 FROM branches WHERE id = $1 AND restaurant_id = $2', [branchId, restId]);
            if (!branchCheck.rowCount)
                return res.status(400).json({ error: `El branch_id ${branchId} no pertenece al restaurant_id ${restId} o no existe` });
        }
        if (supId) {
            const supCheck = await (0, db_1.query)('SELECT 1 FROM suppliers WHERE id = $1', [supId]);
            if (!supCheck.rowCount)
                return res.status(400).json({ error: `El supplier_id ${supId} no existe` });
        }
        const scopeError = (0, userTenant_1.validateTenantScope)(roleName, { restaurant_id: restId, supplier_id: supId });
        if (scopeError)
            return res.status(400).json({ error: scopeError });
        const scope = (0, userTenant_1.tenantScopeForRole)(roleName);
        if (scope === 'restaurant') {
            supId = null;
        }
        else if (scope === 'supplier') {
            restId = null;
            branchId = null;
        }
        else if (scope === 'platform') {
            restId = null;
            supId = null;
            branchId = null;
        }
        const hash = await bcryptjs_1.default.hash(String(password), 10);
        const result = await (0, db_1.query)(`INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, username, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`, [username.trim(), hash, name.trim(), email?.trim() || null, phone?.trim() || null, Number(role_id), restId, branchId, supId, vehicle_type || null, vehicle_plate || null]);
        await (0, audit_1.logAudit)(req, 'create', 'user', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/users/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate } = req.body;
        const target = await (0, db_1.query)('SELECT * FROM users WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        const oldUser = target.rows[0];
        // Invariante: un admin no puede quitarse su propio rol
        if (oldUser.id === req.user?.id && oldUser.role_id === 1 && role_id && role_id !== 1) {
            return res.status(403).json({ error: 'No puedes quitarte el rol de administrador a ti mismo' });
        }
        if (restaurant_id) {
            const restCheck = await (0, db_1.query)('SELECT 1 FROM restaurants WHERE id = $1', [restaurant_id]);
            if (!restCheck.rowCount)
                return res.status(400).json({ error: `El restaurant_id ${restaurant_id} no existe` });
        }
        if (branch_id) {
            const restId = restaurant_id || oldUser.restaurant_id;
            const branchCheck = await (0, db_1.query)('SELECT 1 FROM branches WHERE id = $1 AND restaurant_id = $2', [branch_id, restId]);
            if (!branchCheck.rowCount)
                return res.status(400).json({ error: `El branch_id ${branch_id} no pertenece al restaurant_id ${restId} o no existe` });
        }
        if (supplier_id) {
            const supCheck = await (0, db_1.query)('SELECT 1 FROM suppliers WHERE id = $1', [supplier_id]);
            if (!supCheck.rowCount)
                return res.status(400).json({ error: `El supplier_id ${supplier_id} no existe` });
        }
        // Coherencia rol/tenant del estado resultante (los ids se conservan con COALESCE).
        const effectiveRoleId = role_id ? Number(role_id) : oldUser.role_id;
        const effectiveRoleRow = await (0, db_1.query)('SELECT name FROM roles WHERE id = $1', [effectiveRoleId]);
        const effectiveRoleName = effectiveRoleRow.rows[0]?.name;
        if (!effectiveRoleName)
            return res.status(400).json({ error: 'El role_id proporcionado no existe' });
        const scopeError = (0, userTenant_1.validateTenantScope)(effectiveRoleName, {
            restaurant_id: restaurant_id ? Number(restaurant_id) : oldUser.restaurant_id,
            supplier_id: supplier_id ? Number(supplier_id) : oldUser.supplier_id,
        });
        if (scopeError)
            return res.status(400).json({ error: scopeError });
        const result = await (0, db_1.query)(`UPDATE users 
       SET name = COALESCE($2, name), 
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           role_id = COALESCE($5, role_id),
           restaurant_id = COALESCE($6, restaurant_id),
           branch_id = COALESCE($7, branch_id),
           supplier_id = COALESCE($8, supplier_id),
           vehicle_type = COALESCE($9, vehicle_type),
           vehicle_plate = COALESCE($10, vehicle_plate),
           token_version = CASE WHEN role_id IS DISTINCT FROM COALESCE($5, role_id)
                                  OR restaurant_id IS DISTINCT FROM COALESCE($6, restaurant_id)
                                  OR supplier_id IS DISTINCT FROM COALESCE($8, supplier_id)
                                THEN token_version + 1 ELSE token_version END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate, is_active, updated_at`, [id, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate]);
        await (0, audit_1.logAudit)(req, 'update', 'user', Number(id), oldUser, result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/users/:id/activate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM users WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        const result = await (0, db_1.query)(`UPDATE users SET is_active = TRUE, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
        await (0, audit_1.logAudit)(req, 'activate', 'user', Number(id), target.rows[0], result.rows[0]);
        res.json({ ok: true, user: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.patch('/users/:id/deactivate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM users WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        const userToDeactivate = target.rows[0];
        if (userToDeactivate.id === req.user?.id) {
            return res.status(403).json({ error: 'No puedes desactivarte a ti mismo' });
        }
        if (userToDeactivate.role_id === 1) {
            const activeAdmins = await (0, db_1.query)('SELECT count(*) FROM users WHERE role_id = 1 AND is_active = TRUE');
            if (parseInt(activeAdmins.rows[0].count, 10) <= 1) {
                return res.status(403).json({ error: 'No puedes desactivar al último administrador activo' });
            }
        }
        const result = await (0, db_1.query)(`UPDATE users SET is_active = FALSE, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [id]);
        await (0, audit_1.logAudit)(req, 'deactivate', 'user', Number(id), userToDeactivate, result.rows[0]);
        (0, realtime_1.emitToUser)('auth:session_invalidated', Number(id), { message: 'Tu cuenta ha sido desactivada por el administrador.' });
        res.json({ ok: true, user: result.rows[0] });
    }
    catch (err) {
        next(err);
    }
});
router.patch('/users/:id/password', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password || String(password).length < 8) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
        }
        const target = await (0, db_1.query)('SELECT * FROM users WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        const hash = await bcryptjs_1.default.hash(String(password), 10);
        await (0, db_1.query)('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, id]);
        await (0, audit_1.logAudit)(req, 'change_password', 'user', Number(id), null, { message: 'Password updated' });
        (0, realtime_1.emitToUser)('auth:session_invalidated', Number(id), { message: 'Tu contraseña fue actualizada por el administrador. Inicia sesión nuevamente.' });
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
router.post('/users/:id/force-logout', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        // Invalidamos el token directamente iterando su version
        await (0, db_1.query)('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [Number(req.params.id)]);
        await (0, audit_1.logAudit)(req, 'force_logout', 'user', Number(req.params.id), null, { note: 'JWT successfully invalidated via token_version' });
        (0, realtime_1.emitToUser)('auth:session_invalidated', Number(req.params.id), { message: 'Tu sesión ha sido revocada por el administrador.' });
        res.json({
            ok: true,
            message: 'Sesión cerrada con éxito. Los tokens actuales del usuario han sido invalidados en tiempo real.'
        });
    }
    catch (err) {
        next(err);
    }
});
router.delete('/users/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM users WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        if (target.rows[0].id === req.user?.id) {
            return res.status(403).json({ error: 'No puedes eliminarte a ti mismo' });
        }
        try {
            await (0, db_1.query)('DELETE FROM users WHERE id = $1', [id]);
            await (0, audit_1.logAudit)(req, 'delete', 'user', Number(id), target.rows[0], null);
            res.json({ ok: true });
        }
        catch (dbErr) {
            // 23503 es el código de PostgreSQL para foreign_key_violation
            if (dbErr.code === '23503') {
                return res.status(409).json({ error: 'No se puede eliminar el usuario porque tiene registros dependientes (pedidos, facturas, auditoría, etc). Por favor, desactívalo en su lugar.' });
            }
            throw dbErr;
        }
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// ROLES
// ==========================================
router.get('/roles', (0, auth_1.requirePermission)('config'), async (_req, res, next) => {
    try {
        const result = await (0, db_1.query)('SELECT id, name, display_name, description, created_at, updated_at FROM roles ORDER BY id');
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.get('/roles/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)('SELECT id, name, display_name, description, created_at, updated_at FROM roles WHERE id = $1', [id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Rol no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.post('/roles', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { name, display_name, description } = req.body;
        if (!name || !display_name) {
            return res.status(400).json({ error: 'name (snake_case) y display_name son obligatorios' });
        }
        if (!/^[a-z_]+$/.test(name)) {
            return res.status(400).json({ error: 'name debe estar en snake_case (solo minúsculas y guiones bajos)' });
        }
        const exists = await (0, db_1.query)('SELECT id FROM roles WHERE name = $1', [name]);
        if (exists.rowCount)
            return res.status(409).json({ error: 'El nombre interno del rol ya existe' });
        const result = await (0, db_1.query)('INSERT INTO roles (name, display_name, description) VALUES ($1, $2, $3) RETURNING *', [name, display_name, description || null]);
        await (0, audit_1.logAudit)(req, 'create', 'role', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/roles/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, display_name, description } = req.body;
        const numericId = Number(id);
        const target = await (0, db_1.query)('SELECT * FROM roles WHERE id = $1', [numericId]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Rol no encontrado' });
        if (numericId >= 1 && numericId <= 5) {
            // Los roles seed 1..5 están protegidos. No se puede cambiar su "name" (identificador)
            if (name && name !== target.rows[0].name) {
                return res.status(409).json({ error: 'No puedes renombrar el identificador interno de un rol del sistema (IDs 1-5)' });
            }
        }
        else {
            if (name && !/^[a-z_]+$/.test(name)) {
                return res.status(400).json({ error: 'name debe estar en snake_case (solo minúsculas y guiones bajos)' });
            }
            if (name && name !== target.rows[0].name) {
                const exists = await (0, db_1.query)('SELECT id FROM roles WHERE name = $1', [name]);
                if (exists.rowCount)
                    return res.status(409).json({ error: 'El nombre interno del rol ya existe' });
            }
        }
        const result = await (0, db_1.query)(`UPDATE roles 
       SET name = COALESCE($2, name),
           display_name = COALESCE($3, display_name),
           description = COALESCE($4, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`, [numericId, name, display_name, description]);
        await (0, audit_1.logAudit)(req, 'update', 'role', numericId, target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/roles/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const numericId = Number(req.params.id);
        if (numericId >= 1 && numericId <= 5) {
            return res.status(409).json({ error: 'No se pueden eliminar los roles del sistema base (IDs 1 al 5).' });
        }
        const target = await (0, db_1.query)('SELECT * FROM roles WHERE id = $1', [numericId]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Rol no encontrado' });
        const usersWithRole = await (0, db_1.query)('SELECT count(*) FROM users WHERE role_id = $1', [numericId]);
        if (parseInt(usersWithRole.rows[0].count, 10) > 0) {
            return res.status(409).json({ error: `No se puede eliminar. Hay ${usersWithRole.rows[0].count} usuarios usando este rol.` });
        }
        await (0, db_1.query)('DELETE FROM roles WHERE id = $1', [numericId]);
        await (0, audit_1.logAudit)(req, 'delete', 'role', numericId, target.rows[0], null);
        await (0, auth_1.clearPermissionCache)();
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// PERMISOS
// ==========================================
router.get('/permissions', (0, auth_1.requirePermission)('config'), async (_req, res, next) => {
    try {
        const result = await (0, db_1.query)(`SELECT p.id, p.name, p.description, p.created_at, 
              (SELECT count(*) FROM role_permissions rp WHERE rp.permission_id = p.id) as roles_count
       FROM permissions p
       ORDER BY p.name`);
        // Agrupar por módulo
        const grouped = {};
        for (const row of result.rows) {
            let moduleName = 'General';
            if (row.name.startsWith('prov:')) {
                moduleName = 'Proveedor';
            }
            else if (row.name === 'analytics') {
                moduleName = 'Plataforma';
            }
            else {
                const parts = row.name.split(':');
                if (parts.length > 0) {
                    moduleName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
                }
            }
            if (!grouped[moduleName]) {
                grouped[moduleName] = [];
            }
            grouped[moduleName].push(row);
        }
        res.json({ list: result.rows, grouped });
    }
    catch (err) {
        next(err);
    }
});
router.get('/permissions/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)('SELECT * FROM permissions WHERE id = $1', [id]);
        if (!result.rowCount)
            return res.status(404).json({ error: 'Permiso no encontrado' });
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.post('/permissions', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { name, description } = req.body;
        if (!name)
            return res.status(400).json({ error: 'El nombre del permiso es obligatorio' });
        const exists = await (0, db_1.query)('SELECT id FROM permissions WHERE name = $1', [name]);
        if (exists.rowCount)
            return res.status(409).json({ error: 'El permiso ya existe' });
        const result = await (0, db_1.query)('INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
        await (0, audit_1.logAudit)(req, 'create', 'permission', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/permissions/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const target = await (0, db_1.query)('SELECT * FROM permissions WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Permiso no encontrado' });
        if (name && name !== target.rows[0].name) {
            const exists = await (0, db_1.query)('SELECT id FROM permissions WHERE name = $1', [name]);
            if (exists.rowCount)
                return res.status(409).json({ error: 'El nombre de permiso ya existe' });
        }
        const result = await (0, db_1.query)('UPDATE permissions SET name = COALESCE($2, name), description = COALESCE($3, description) WHERE id = $1 RETURNING *', [id, name, description]);
        await (0, audit_1.logAudit)(req, 'update', 'permission', Number(id), target.rows[0], result.rows[0]);
        await (0, auth_1.clearPermissionCache)();
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.delete('/permissions/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const numericId = Number(req.params.id);
        const target = await (0, db_1.query)('SELECT * FROM permissions WHERE id = $1', [numericId]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Permiso no encontrado' });
        const rolesUsing = await (0, db_1.query)('SELECT count(*) FROM role_permissions WHERE permission_id = $1', [numericId]);
        if (parseInt(rolesUsing.rows[0].count, 10) > 0) {
            return res.status(409).json({ error: `Este permiso está asignado a ${rolesUsing.rows[0].count} rol(es). No se puede eliminar.` });
        }
        await (0, db_1.query)('DELETE FROM permissions WHERE id = $1', [numericId]);
        await (0, audit_1.logAudit)(req, 'delete', 'permission', numericId, target.rows[0], null);
        await (0, auth_1.clearPermissionCache)();
        res.json({ ok: true });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// ASIGNACIÓN ROL -> PERMISOS
// ==========================================
router.get('/roles/:id/permissions', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        // El admin puede ver los permisos. Para id = 1, como tiene bypass en backend,
        // enviamos un array especial indicando todo o listamos todos los existentes.
        if (Number(id) === 1) {
            const all = await (0, db_1.query)('SELECT id FROM permissions');
            return res.json(all.rows.map(r => r.id));
        }
        const result = await (0, db_1.query)('SELECT permission_id FROM role_permissions WHERE role_id = $1', [id]);
        res.json(result.rows.map(r => r.permission_id));
    }
    catch (err) {
        next(err);
    }
});
router.put('/roles/:id/permissions', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const numericId = Number(id);
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'Se requiere un array de permission_id' });
        }
        const target = await (0, db_1.query)('SELECT * FROM roles WHERE id = $1', [numericId]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Rol no encontrado' });
        if (numericId === 1) {
            // Evitamos quitarle permisos al admin para que siempre tenga acceso a todo,
            // el bypass en requirePermission protege la ejecución, pero la UI también debe reflejarlo.
            return res.json({ ok: true, message: 'El rol de administrador tiene acceso global implícito.' });
        }
        const oldPerms = await (0, db_1.query)('SELECT permission_id FROM role_permissions WHERE role_id = $1', [numericId]);
        // Iniciar transacción explícita
        await (0, db_1.query)('BEGIN');
        await (0, db_1.query)('DELETE FROM role_permissions WHERE role_id = $1', [numericId]);
        for (const pId of permissions) {
            await (0, db_1.query)('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [numericId, pId]);
        }
        await (0, db_1.query)('COMMIT');
        // Invalidar tokens de los usuarios afectados para forzar actualizacion de RBAC local
        await (0, db_1.query)('UPDATE users SET token_version = token_version + 1 WHERE role_id = $1', [numericId]);
        await (0, audit_1.logAudit)(req, 'update_permissions', 'role', numericId, { permissions: oldPerms.rows.map(r => r.permission_id) }, { permissions });
        await (0, auth_1.clearPermissionCache)();
        (0, realtime_1.emitToRole)(target.rows[0].name, 'auth:session_invalidated', { message: 'Los permisos de tu rol han sido actualizados por el administrador.' });
        res.json({ ok: true, count: permissions.length });
    }
    catch (err) {
        await (0, db_1.query)('ROLLBACK');
        next(err);
    }
});
router.get('/permissions/:id/roles', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await (0, db_1.query)(`SELECT r.id, r.name, r.display_name 
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE rp.permission_id = $1`, [id]);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// AUDITORÍA
// ==========================================
router.get('/audit-log', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { entity_type, entity_id, user_id, action, from, to, page = '1', limit = '50' } = req.query;
        let sql = `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, a.ip_address, a.created_at,
                      u.username, u.name AS user_name
               FROM audit_log a
               LEFT JOIN users u ON a.user_id = u.id
               WHERE 1=1`;
        const params = [];
        if (entity_type) {
            params.push(entity_type);
            sql += ` AND a.entity_type = $${params.length}`;
        }
        if (entity_id) {
            params.push(Number(entity_id));
            sql += ` AND a.entity_id = $${params.length}`;
        }
        if (user_id) {
            params.push(Number(user_id));
            sql += ` AND a.user_id = $${params.length}`;
        }
        if (action) {
            params.push(action);
            sql += ` AND a.action = $${params.length}`;
        }
        if (from) {
            params.push(from);
            sql += ` AND a.created_at >= $${params.length}::timestamp`;
        }
        if (to) {
            params.push(to);
            sql += ` AND a.created_at <= $${params.length}::timestamp`;
        }
        const countResult = await (0, db_1.query)(`SELECT COUNT(*) FROM (${sql}) AS t`, params);
        const total = parseInt(countResult.rows[0].count, 10);
        const p = Math.max(1, Number(page));
        const l = Math.max(1, Number(limit));
        sql += ` ORDER BY a.created_at DESC LIMIT ${l} OFFSET ${(p - 1) * l}`;
        const result = await (0, db_1.query)(sql, params);
        res.json({
            data: result.rows,
            meta: { total, page: p, limit: l, pages: Math.ceil(total / l) }
        });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// CATÁLOGOS DE SOPORTE
// ==========================================
router.get('/restaurants', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { q, is_active } = req.query;
        let sql = 'SELECT * FROM restaurants WHERE 1=1';
        const params = [];
        if (q) {
            params.push(`%${q}%`);
            sql += ` AND (name ILIKE $${params.length} OR nit ILIKE $${params.length})`;
        }
        if (is_active !== undefined) {
            params.push(is_active === 'true');
            sql += ` AND is_active = $${params.length}`;
        }
        sql += ' ORDER BY name';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/restaurants', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { name, nit, phone, email, address, city, department, logo_url, category, subscription_plan } = req.body;
        if (!name || !nit)
            return res.status(400).json({ error: 'Nombre y NIT son obligatorios' });
        const exists = await (0, db_1.query)('SELECT id FROM restaurants WHERE nit = $1', [nit]);
        if (exists.rowCount)
            return res.status(409).json({ error: 'NIT ya existe' });
        const result = await (0, db_1.query)(`INSERT INTO restaurants (name, nit, phone, email, address, city, department, logo_url, category, subscription_plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, [name, nit, phone, email, address, city, department, logo_url, category, subscription_plan]);
        await (0, audit_1.logAudit)(req, 'create', 'restaurant', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/restaurants/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, nit, phone, email, address, city, department, logo_url, category, subscription_plan } = req.body;
        const target = await (0, db_1.query)('SELECT * FROM restaurants WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        if (nit && nit !== target.rows[0].nit) {
            const exists = await (0, db_1.query)('SELECT id FROM restaurants WHERE nit = $1', [nit]);
            if (exists.rowCount)
                return res.status(409).json({ error: 'NIT ya existe' });
        }
        const result = await (0, db_1.query)(`UPDATE restaurants 
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), phone = COALESCE($4, phone), 
           email = COALESCE($5, email), address = COALESCE($6, address), city = COALESCE($7, city), 
           department = COALESCE($8, department), logo_url = COALESCE($9, logo_url),
           category = COALESCE($10, category), subscription_plan = COALESCE($11, subscription_plan),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`, [id, name, nit, phone, email, address, city, department, logo_url, category, subscription_plan]);
        await (0, audit_1.logAudit)(req, 'update', 'restaurant', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/restaurants/:id/activate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM restaurants WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        const result = await (0, db_1.query)('UPDATE restaurants SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        await (0, audit_1.logAudit)(req, 'activate', 'restaurant', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/restaurants/:id/deactivate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM restaurants WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Restaurante no encontrado' });
        const result = await (0, db_1.query)('UPDATE restaurants SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        await (0, audit_1.logAudit)(req, 'deactivate', 'restaurant', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.get('/comercios/:type/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { type, id } = req.params;
        if (type === 'restaurant') {
            const rest = await (0, db_1.query)('SELECT * FROM restaurants WHERE id = $1', [id]);
            if (!rest.rowCount)
                return res.status(404).json({ error: 'Not found' });
            const menu = await (0, db_1.query)('SELECT * FROM menu_products WHERE restaurant_id = $1', [id]);
            const branches = await (0, db_1.query)('SELECT * FROM branches WHERE restaurant_id = $1', [id]);
            const users = await (0, db_1.query)('SELECT u.id, u.name, u.email, u.is_active, r.display_name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.restaurant_id = $1', [id]);
            const metrics = await (0, db_1.query)("SELECT COUNT(id)::float8 as total_orders, SUM(total)::float8 as gmv FROM orders WHERE restaurant_id = $1 AND status != 'cancelado'", [id]);
            return res.json({ profile: rest.rows[0], catalog: menu.rows, branches: branches.rows, users: users.rows, metrics: metrics.rows[0] });
        }
        else if (type === 'supplier') {
            const sup = await (0, db_1.query)('SELECT * FROM suppliers WHERE id = $1', [id]);
            if (!sup.rowCount)
                return res.status(404).json({ error: 'Not found' });
            const prods = await (0, db_1.query)('SELECT p.*, c.name as category_name FROM products p LEFT JOIN product_categories c ON c.id = p.category_id WHERE p.supplier_id = $1', [id]);
            const users = await (0, db_1.query)('SELECT u.id, u.name, u.email, u.is_active, r.display_name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.supplier_id = $1', [id]);
            const metrics = await (0, db_1.query)("SELECT COUNT(id)::float8 as total_orders, SUM(total)::float8 as gmv FROM orders WHERE supplier_id = $1 AND status != 'cancelado'", [id]);
            return res.json({ profile: sup.rows[0], catalog: prods.rows, users: users.rows, branches: [], metrics: metrics.rows[0] });
        }
        res.status(400).json({ error: 'Invalid type' });
    }
    catch (err) {
        next(err);
    }
});
router.get('/branches', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { restaurant_id } = req.query;
        let sql = 'SELECT * FROM branches';
        const params = [];
        if (restaurant_id) {
            params.push(Number(restaurant_id));
            sql += ' WHERE restaurant_id = $1';
        }
        sql += ' ORDER BY name';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/branches', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    const client = await require('../config/db').pool.connect();
    try {
        const { restaurant_id, name, address, phone, is_main } = req.body;
        if (!restaurant_id || !name)
            return res.status(400).json({ error: 'restaurant_id y name obligatorios' });
        const restCheck = await client.query('SELECT 1 FROM restaurants WHERE id = $1', [restaurant_id]);
        if (!restCheck.rowCount)
            return res.status(400).json({ error: `El restaurant_id ${restaurant_id} no existe` });
        await client.query('BEGIN');
        if (is_main) {
            await client.query('UPDATE branches SET is_main = FALSE WHERE restaurant_id = $1', [restaurant_id]);
        }
        const result = await client.query('INSERT INTO branches (restaurant_id, name, address, phone, is_main) VALUES ($1, $2, $3, $4, $5) RETURNING *', [restaurant_id, name, address, phone, is_main || false]);
        await client.query('COMMIT');
        await (0, audit_1.logAudit)(req, 'create', 'branch', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
router.put('/branches/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    const client = await require('../config/db').pool.connect();
    try {
        const { id } = req.params;
        const { name, address, phone, is_main, is_active } = req.body;
        await client.query('BEGIN');
        const target = await client.query('SELECT * FROM branches WHERE id = $1', [id]);
        if (!target.rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        }
        if (target.rows[0].is_main && is_active === false) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'No se puede desactivar la sucursal principal' });
        }
        if (is_main && !target.rows[0].is_main) {
            await client.query('UPDATE branches SET is_main = FALSE WHERE restaurant_id = $1', [target.rows[0].restaurant_id]);
        }
        const result = await client.query(`UPDATE branches SET name = COALESCE($2, name), address = COALESCE($3, address),
       phone = COALESCE($4, phone), is_main = COALESCE($5, is_main), is_active = COALESCE($6, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`, [id, name, address, phone, is_main, is_active]);
        await client.query('COMMIT');
        await (0, audit_1.logAudit)(req, 'update', 'branch', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        await client.query('ROLLBACK');
        next(err);
    }
    finally {
        client.release();
    }
});
router.patch('/branches/:id/activate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM branches WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        const result = await (0, db_1.query)('UPDATE branches SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        await (0, audit_1.logAudit)(req, 'activate', 'branch', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/branches/:id/deactivate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM branches WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Sucursal no encontrada' });
        if (target.rows[0].is_main)
            return res.status(400).json({ error: 'No se puede desactivar la sucursal principal' });
        const result = await (0, db_1.query)('UPDATE branches SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        await (0, audit_1.logAudit)(req, 'deactivate', 'branch', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.get('/suppliers', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { q, is_active } = req.query;
        let sql = 'SELECT * FROM suppliers WHERE 1=1';
        const params = [];
        if (q) {
            params.push(`%${q}%`);
            sql += ` AND (name ILIKE $${params.length} OR nit ILIKE $${params.length})`;
        }
        if (is_active !== undefined) {
            params.push(is_active === 'true');
            sql += ` AND is_active = $${params.length}`;
        }
        sql += ' ORDER BY name';
        const result = await (0, db_1.query)(sql, params);
        res.json(result.rows);
    }
    catch (err) {
        next(err);
    }
});
router.post('/suppliers', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { name, nit, category, phone, email, address, city, logo_url } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Nombre obligatorio' });
        if (nit) {
            const exists = await (0, db_1.query)('SELECT id FROM suppliers WHERE nit = $1', [nit]);
            if (exists.rowCount)
                return res.status(409).json({ error: 'NIT ya existe' });
        }
        const result = await (0, db_1.query)(`INSERT INTO suppliers (name, nit, category, phone, email, address, city, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, [name, nit, category, phone, email, address, city, logo_url]);
        await (0, audit_1.logAudit)(req, 'create', 'supplier', result.rows[0].id, null, result.rows[0]);
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.put('/suppliers/:id', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, nit, category, phone, email, address, city, logo_url } = req.body;
        const target = await (0, db_1.query)('SELECT * FROM suppliers WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        if (nit && nit !== target.rows[0].nit) {
            const exists = await (0, db_1.query)('SELECT id FROM suppliers WHERE nit = $1', [nit]);
            if (exists.rowCount)
                return res.status(409).json({ error: 'NIT ya existe' });
        }
        const result = await (0, db_1.query)(`UPDATE suppliers 
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), category = COALESCE($4, category), 
           phone = COALESCE($5, phone), email = COALESCE($6, email), address = COALESCE($7, address), 
           city = COALESCE($8, city), logo_url = COALESCE($9, logo_url), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`, [id, name, nit, category, phone, email, address, city, logo_url]);
        await (0, audit_1.logAudit)(req, 'update', 'supplier', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/suppliers/:id/activate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM suppliers WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        const result = await (0, db_1.query)('UPDATE suppliers SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        await (0, audit_1.logAudit)(req, 'activate', 'supplier', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
router.patch('/suppliers/:id/deactivate', (0, auth_1.requirePermission)('config'), async (req, res, next) => {
    try {
        const { id } = req.params;
        const target = await (0, db_1.query)('SELECT * FROM suppliers WHERE id = $1', [id]);
        if (!target.rowCount)
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        const result = await (0, db_1.query)('UPDATE suppliers SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
        await (0, audit_1.logAudit)(req, 'deactivate', 'supplier', Number(id), target.rows[0], result.rows[0]);
        res.json(result.rows[0]);
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// KPIs / STATS
// ==========================================
router.get('/stats', (0, auth_1.requirePermission)('analytics'), async (req, res, next) => {
    try {
        const { date_range } = req.query; // 'hoy', '7d', '30d', 'all'
        let dateFilterOrders = '';
        let dateFilterInvoices = '';
        let dateFilterDeliveries = '';
        if (date_range === 'hoy') {
            dateFilterOrders = "AND date(created_at) = CURRENT_DATE";
            dateFilterInvoices = "AND date(issued_at) = CURRENT_DATE";
            dateFilterDeliveries = "AND date(created_at) = CURRENT_DATE";
        }
        else if (date_range === '7d') {
            dateFilterOrders = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
            dateFilterInvoices = "AND issued_at >= CURRENT_DATE - INTERVAL '7 days'";
            dateFilterDeliveries = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
        }
        else if (date_range === '30d' || !date_range) { // default 30d
            dateFilterOrders = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
            dateFilterInvoices = "AND issued_at >= CURRENT_DATE - INTERVAL '30 days'";
            dateFilterDeliveries = "AND created_at >= CURRENT_DATE - INTERVAL '30 days'";
        }
        const stats = {};
        // KPI 1: Ingresos del periodo
        const kpi = await (0, db_1.query)(`
      SELECT 
        (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status IN ('emitida', 'pagada') ${dateFilterInvoices})::float8 AS revenue,
        (SELECT COUNT(*) FROM orders WHERE status != 'cancelado' ${dateFilterOrders})::float8 AS orders_count,
        (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status != 'cancelado' ${dateFilterOrders})::float8 AS avg_ticket,
        (SELECT COUNT(*) FROM deliveries WHERE status = 'fallido' ${dateFilterDeliveries})::float8 / GREATEST((SELECT COUNT(*) FROM deliveries WHERE 1=1 ${dateFilterDeliveries}), 1) * 100 AS failed_delivery_pct,
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_delivery_time - scheduled_time))/60), 0) FROM deliveries WHERE actual_delivery_time IS NOT NULL AND status = 'entregado' ${dateFilterDeliveries})::float8 AS avg_delivery_delay_min,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status != 'cancelado' ${dateFilterOrders})::float8 AS gmv_total,
        (SELECT COUNT(*) FROM inventory WHERE stock_status = 'critical')::float8 AS critical_items,
        (SELECT COUNT(*) FROM inventory WHERE expiry_date <= CURRENT_DATE + interval '7 days')::float8 AS expiring_items,
        (SELECT COUNT(*) FROM suppliers WHERE is_active = TRUE)::float8 AS active_suppliers
    `);
        stats.kpis = kpi.rows[0];
        // Gráficos: Ventas por día
        const salesByDay = await (0, db_1.query)(`
      SELECT date(created_at) as date, SUM(total)::float8 as total
      FROM orders
      WHERE status != 'cancelado' ${dateFilterOrders}
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `);
        stats.sales_by_day = salesByDay.rows;
        // Pedidos por estado
        const ordersByStatus = await (0, db_1.query)(`
      SELECT status, COUNT(*)::float8 as count
      FROM orders
      WHERE 1=1 ${dateFilterOrders}
      GROUP BY status
    `);
        stats.orders_by_status = ordersByStatus.rows;
        // Top Productos
        const topProducts = await (0, db_1.query)(`
      SELECT p.name, SUM(i.quantity)::float8 as qty, SUM(i.subtotal)::float8 as total
      FROM order_items i
      JOIN products p ON p.id = i.product_id
      JOIN orders o ON o.id = i.order_id
      WHERE o.status != 'cancelado' ${dateFilterOrders.replace(/created_at/g, 'o.created_at')}
      GROUP BY p.name
      ORDER BY qty DESC
      LIMIT 10
    `);
        stats.top_products = topProducts.rows;
        // Top Proveedores
        const topSuppliers = await (0, db_1.query)(`
      SELECT s.name, SUM(o.total)::float8 as total, COUNT(o.id)::float8 as orders
      FROM orders o
      JOIN suppliers s ON s.id = o.supplier_id
      WHERE o.status != 'cancelado' ${dateFilterOrders.replace(/created_at/g, 'o.created_at')}
      GROUP BY s.name
      ORDER BY total DESC
      LIMIT 5
    `);
        stats.top_suppliers = topSuppliers.rows;
        // Actividad reciente
        const recentActivity = await (0, db_1.query)(`
      SELECT a.action, a.entity_type, a.created_at, u.name as user_name
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 15
    `);
        stats.recent_activity = recentActivity.rows;
        res.json(stats);
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
