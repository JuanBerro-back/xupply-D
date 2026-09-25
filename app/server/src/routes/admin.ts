import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired, clearPermissionCache, requirePermission } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authRequired);
router.use(roleRequired('admin')); // Aplica a todo este router

// Helper para auditoría
async function logAudit(req: Request, action: string, entity_type: string, entity_id: number | null, old_values: any, new_values: any) {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const cleanOld = old_values ? { ...old_values } : null;
    const cleanNew = new_values ? { ...new_values } : null;
    
    if (cleanOld && 'password_hash' in cleanOld) delete cleanOld.password_hash;
    if (cleanNew && 'password_hash' in cleanNew) delete cleanNew.password_hash;
    if (cleanNew && 'password' in cleanNew) delete cleanNew.password;
    
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user?.id, action, entity_type, entity_id, cleanOld ? JSON.stringify(cleanOld) : null, cleanNew ? JSON.stringify(cleanNew) : null, ip]
    );
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}

// ==========================================
// USUARIOS
// ==========================================

router.get('/users', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q, role_id, restaurant_id, supplier_id, is_active, page = '1', limit = '20' } = req.query;
    
    let sql = `SELECT u.id, u.username, u.name, u.email, u.phone, u.role_id, 
                      u.restaurant_id, u.branch_id, u.supplier_id, u.is_active, 
                      u.last_login, u.created_at, u.vehicle_type, u.vehicle_plate,
                      r.name AS role_name, r.display_name AS role_label
               FROM users u
               JOIN roles r ON r.id = u.role_id
               WHERE 1=1`;
    const params: unknown[] = [];
    
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
    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) AS t`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    
    // Pagination
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Number(limit));
    sql += ` ORDER BY u.created_at DESC LIMIT ${l} OFFSET ${(p - 1) * l}`;
    
    const result = await query(sql, params);
    
    res.json({
      data: result.rows,
      meta: {
        total,
        page: p,
        limit: l,
        pages: Math.ceil(total / l)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT u.id, u.username, u.name, u.email, u.phone, u.role_id, 
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
       WHERE u.id = $1`,
      [id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/users', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate } = req.body;
    
    if (!username || !password || !name || !role_id) {
      return res.status(400).json({ error: 'username, password, name y role_id son obligatorios' });
    }
    
    const exists = await query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (exists.rowCount) return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    
    const hash = await bcrypt.hash(String(password), 10);
    
    const result = await query(
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, username, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`,
      [username.trim(), hash, name.trim(), email?.trim() || null, phone?.trim() || null, role_id, restaurant_id || null, branch_id || null, supplier_id || null, vehicle_type || null, vehicle_plate || null]
    );
    
    await logAudit(req, 'create', 'user', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/users/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate } = req.body;
    
    const target = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const oldUser = target.rows[0];
    
    // Invariante: un admin no puede quitarse su propio rol
    if (oldUser.id === req.user?.id && oldUser.role_id === 1 && role_id && role_id !== 1) {
      return res.status(403).json({ error: 'No puedes quitarte el rol de administrador a ti mismo' });
    }
    
    const result = await query(
      `UPDATE users 
       SET name = COALESCE($2, name), 
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           role_id = COALESCE($5, role_id),
           restaurant_id = COALESCE($6, restaurant_id),
           branch_id = COALESCE($7, branch_id),
           supplier_id = COALESCE($8, supplier_id),
           vehicle_type = COALESCE($9, vehicle_type),
           vehicle_plate = COALESCE($10, vehicle_plate),
           token_version = CASE WHEN role_id != COALESCE($5, role_id) THEN token_version + 1 ELSE token_version END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate, is_active, updated_at`,
      [id, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate]
    );
    
    await logAudit(req, 'update', 'user', Number(id), oldUser, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/activate', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const result = await query(
      `UPDATE users SET is_active = TRUE, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, 
      [id]
    );
    
    await logAudit(req, 'activate', 'user', Number(id), target.rows[0], result.rows[0]);
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/deactivate', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const userToDeactivate = target.rows[0];
    if (userToDeactivate.id === req.user?.id) {
      return res.status(403).json({ error: 'No puedes desactivarte a ti mismo' });
    }
    
    if (userToDeactivate.role_id === 1) {
      const activeAdmins = await query('SELECT count(*) FROM users WHERE role_id = 1 AND is_active = TRUE');
      if (parseInt(activeAdmins.rows[0].count, 10) <= 1) {
        return res.status(403).json({ error: 'No puedes desactivar al último administrador activo' });
      }
    }
    
    const result = await query(
      `UPDATE users SET is_active = FALSE, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, 
      [id]
    );
    
    await logAudit(req, 'deactivate', 'user', Number(id), userToDeactivate, result.rows[0]);
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/password', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    
    const target = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const hash = await bcrypt.hash(String(password), 10);
    await query('UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, id]);
    
    await logAudit(req, 'change_password', 'user', Number(id), null, { message: 'Password updated' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:id/force-logout', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Invalidamos el token directamente iterando su version
    await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [Number(req.params.id)]);
    await logAudit(req, 'force_logout', 'user', Number(req.params.id), null, { note: 'JWT successfully invalidated via token_version' });
    res.json({ 
      ok: true, 
      message: 'Sesión cerrada con éxito. Los tokens actuales del usuario han sido invalidados en tiempo real.' 
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    if (target.rows[0].id === req.user?.id) {
      return res.status(403).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    
    try {
      await query('DELETE FROM users WHERE id = $1', [id]);
      await logAudit(req, 'delete', 'user', Number(id), target.rows[0], null);
      res.json({ ok: true });
    } catch (dbErr: any) {
      // 23503 es el código de PostgreSQL para foreign_key_violation
      if (dbErr.code === '23503') {
        return res.status(409).json({ error: 'No se puede eliminar el usuario porque tiene registros dependientes (pedidos, facturas, auditoría, etc). Por favor, desactívalo en su lugar.' });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ROLES
// ==========================================

router.get('/roles', requirePermission('config'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, display_name, description, created_at, updated_at FROM roles ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/roles/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT id, name, display_name, description, created_at, updated_at FROM roles WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/roles', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, display_name, description } = req.body;
    if (!name || !display_name) {
      return res.status(400).json({ error: 'name (snake_case) y display_name son obligatorios' });
    }
    
    if (!/^[a-z_]+$/.test(name)) {
      return res.status(400).json({ error: 'name debe estar en snake_case (solo minúsculas y guiones bajos)' });
    }
    
    const exists = await query('SELECT id FROM roles WHERE name = $1', [name]);
    if (exists.rowCount) return res.status(409).json({ error: 'El nombre interno del rol ya existe' });
    
    const result = await query(
      'INSERT INTO roles (name, display_name, description) VALUES ($1, $2, $3) RETURNING *',
      [name, display_name, description || null]
    );
    
    await logAudit(req, 'create', 'role', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/roles/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, display_name, description } = req.body;
    const numericId = Number(id);
    
    const target = await query('SELECT * FROM roles WHERE id = $1', [numericId]);
    if (!target.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    
    if (numericId >= 1 && numericId <= 5) {
      // Los roles seed 1..5 están protegidos. No se puede cambiar su "name" (identificador)
      if (name && name !== target.rows[0].name) {
        return res.status(409).json({ error: 'No puedes renombrar el identificador interno de un rol del sistema (IDs 1-5)' });
      }
    } else {
      if (name && !/^[a-z_]+$/.test(name)) {
        return res.status(400).json({ error: 'name debe estar en snake_case (solo minúsculas y guiones bajos)' });
      }
      if (name && name !== target.rows[0].name) {
        const exists = await query('SELECT id FROM roles WHERE name = $1', [name]);
        if (exists.rowCount) return res.status(409).json({ error: 'El nombre interno del rol ya existe' });
      }
    }
    
    const result = await query(
      `UPDATE roles 
       SET name = COALESCE($2, name),
           display_name = COALESCE($3, display_name),
           description = COALESCE($4, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [numericId, name, display_name, description]
    );
    
    await logAudit(req, 'update', 'role', numericId, target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/roles/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const numericId = Number(req.params.id);
    if (numericId >= 1 && numericId <= 5) {
      return res.status(409).json({ error: 'No se pueden eliminar los roles del sistema base (IDs 1 al 5).' });
    }
    
    const target = await query('SELECT * FROM roles WHERE id = $1', [numericId]);
    if (!target.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    
    const usersWithRole = await query('SELECT count(*) FROM users WHERE role_id = $1', [numericId]);
    if (parseInt(usersWithRole.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: `No se puede eliminar. Hay ${usersWithRole.rows[0].count} usuarios usando este rol.` });
    }
    
    await query('DELETE FROM roles WHERE id = $1', [numericId]);
    await logAudit(req, 'delete', 'role', numericId, target.rows[0], null);
    await clearPermissionCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// PERMISOS
// ==========================================

router.get('/permissions', requirePermission('config'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.description, p.created_at, 
              (SELECT count(*) FROM role_permissions rp WHERE rp.permission_id = p.id) as roles_count
       FROM permissions p
       ORDER BY p.name`
    );
    
    // Agrupar por módulo
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      let moduleName = 'General';
      if (row.name.startsWith('prov:')) {
        moduleName = 'Proveedor';
      } else {
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
  } catch (err) {
    next(err);
  }
});

router.get('/permissions/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM permissions WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Permiso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/permissions', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre del permiso es obligatorio' });
    
    const exists = await query('SELECT id FROM permissions WHERE name = $1', [name]);
    if (exists.rowCount) return res.status(409).json({ error: 'El permiso ya existe' });
    
    const result = await query(
      'INSERT INTO permissions (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    
    await logAudit(req, 'create', 'permission', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/permissions/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const target = await query('SELECT * FROM permissions WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Permiso no encontrado' });
    
    if (name && name !== target.rows[0].name) {
      const exists = await query('SELECT id FROM permissions WHERE name = $1', [name]);
      if (exists.rowCount) return res.status(409).json({ error: 'El nombre de permiso ya existe' });
    }
    
    const result = await query(
      'UPDATE permissions SET name = COALESCE($2, name), description = COALESCE($3, description) WHERE id = $1 RETURNING *',
      [id, name, description]
    );
    
    await logAudit(req, 'update', 'permission', Number(id), target.rows[0], result.rows[0]);
    await clearPermissionCache();
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/permissions/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const numericId = Number(req.params.id);
    const target = await query('SELECT * FROM permissions WHERE id = $1', [numericId]);
    if (!target.rowCount) return res.status(404).json({ error: 'Permiso no encontrado' });
    
    const rolesUsing = await query('SELECT count(*) FROM role_permissions WHERE permission_id = $1', [numericId]);
    if (parseInt(rolesUsing.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: `Este permiso está asignado a ${rolesUsing.rows[0].count} rol(es). No se puede eliminar.` });
    }
    
    await query('DELETE FROM permissions WHERE id = $1', [numericId]);
    await logAudit(req, 'delete', 'permission', numericId, target.rows[0], null);
    await clearPermissionCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// ASIGNACIÓN ROL -> PERMISOS
// ==========================================

router.get('/roles/:id/permissions', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    // El admin puede ver los permisos. Para id = 1, como tiene bypass en backend,
    // enviamos un array especial indicando todo o listamos todos los existentes.
    if (Number(id) === 1) {
      const all = await query('SELECT id FROM permissions');
      return res.json(all.rows.map(r => r.id));
    }
    
    const result = await query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [id]);
    res.json(result.rows.map(r => r.permission_id));
  } catch (err) {
    next(err);
  }
});

router.put('/roles/:id/permissions', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    const { permissions } = req.body;
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Se requiere un array de permission_id' });
    }
    
    const target = await query('SELECT * FROM roles WHERE id = $1', [numericId]);
    if (!target.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    
    if (numericId === 1) {
      // Evitamos quitarle permisos al admin para que siempre tenga acceso a todo,
      // el bypass en requirePermission protege la ejecución, pero la UI también debe reflejarlo.
      return res.json({ ok: true, message: 'El rol de administrador tiene acceso global implícito.' });
    }
    
    const oldPerms = await query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [numericId]);
    
    // Iniciar transacción explícita
    await query('BEGIN');
    await query('DELETE FROM role_permissions WHERE role_id = $1', [numericId]);
    
    for (const pId of permissions) {
      await query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [numericId, pId]);
    }
    
    await query('COMMIT');
    
    // Invalidar tokens de los usuarios afectados para forzar actualizacion de RBAC local
    await query('UPDATE users SET token_version = token_version + 1 WHERE role_id = $1', [numericId]);

    await logAudit(req, 'update_permissions', 'role', numericId, 
      { permissions: oldPerms.rows.map(r => r.permission_id) }, 
      { permissions }
    );
    await clearPermissionCache();
    
    res.json({ ok: true, count: permissions.length });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
});

router.get('/permissions/:id/roles', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT r.id, r.name, r.display_name 
       FROM role_permissions rp
       JOIN roles r ON rp.role_id = r.id
       WHERE rp.permission_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// AUDITORÍA
// ==========================================

router.get('/audit-log', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id, user_id, action, from, to, page = '1', limit = '50' } = req.query;
    
    let sql = `SELECT a.id, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, a.ip_address, a.created_at,
                      u.username, u.name AS user_name
               FROM audit_log a
               LEFT JOIN users u ON a.user_id = u.id
               WHERE 1=1`;
    const params: unknown[] = [];
    
    if (entity_type) {
      params.push(entity_type);
      sql += ` AND a.entity_type = $${params.length}`;
    } else {
      sql += ` AND a.entity_type IN ('user', 'role', 'permission', 'role_permission')`;
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
    
    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) AS t`, params);
    const total = parseInt(countResult.rows[0].count, 10);
    
    const p = Math.max(1, Number(page));
    const l = Math.max(1, Number(limit));
    sql += ` ORDER BY a.created_at DESC LIMIT ${l} OFFSET ${(p - 1) * l}`;
    
    const result = await query(sql, params);
    
    res.json({
      data: result.rows,
      meta: { total, page: p, limit: l, pages: Math.ceil(total / l) }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// CATÁLOGOS DE SOPORTE
// ==========================================

router.get('/restaurants', requirePermission('config'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, nit, is_active FROM restaurants ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/comercios/:type/:id', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, id } = req.params;
    if (type === 'restaurant') {
      const rest = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
      if (!rest.rowCount) return res.status(404).json({ error: 'Not found' });
      const menu = await query('SELECT * FROM menu_products WHERE restaurant_id = $1', [id]);
      return res.json({ profile: rest.rows[0], catalog: menu.rows });
    } else if (type === 'supplier') {
      const sup = await query('SELECT * FROM suppliers WHERE id = $1', [id]);
      if (!sup.rowCount) return res.status(404).json({ error: 'Not found' });
      const prods = await query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN product_categories c ON c.id = p.category_id WHERE p.supplier_id = $1', [id]);
      return res.json({ profile: sup.rows[0], catalog: prods.rows });
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    next(err);
  }
});

router.get('/branches', requirePermission('config'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { restaurant_id } = req.query;
    let sql = 'SELECT id, name, is_main, is_active FROM branches';
    const params: unknown[] = [];
    if (restaurant_id) {
      params.push(Number(restaurant_id));
      sql += ' WHERE restaurant_id = $1';
    }
    sql += ' ORDER BY name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/suppliers', requirePermission('config'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT id, name, nit, is_active FROM suppliers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// KPIs / STATS
// ==========================================

router.get('/stats', requirePermission('dashboard'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats: any = {};
    
    // Usuarios
    const userTotals = await query(`
      SELECT 
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_users
      FROM users
    `);
    stats.active_users = Number(userTotals.rows[0].active_users || 0);
    stats.inactive_users = Number(userTotals.rows[0].inactive_users || 0);
    stats.total_users = stats.active_users + stats.inactive_users;
    
    // Por rol
    const byRole = await query(`
      SELECT r.display_name AS name, count(u.id) as value
      FROM users u
      JOIN roles r ON r.id = u.role_id
      GROUP BY r.display_name
      ORDER BY value DESC
    `);
    stats.users_by_role = byRole.rows;
    
    // Totales de tenants
    const tenantCounts = await query(`
      SELECT 
        (SELECT count(*) FROM restaurants) as total_restaurants,
        (SELECT count(*) FROM branches) as total_branches,
        (SELECT count(*) FROM suppliers) as total_suppliers
    `);
    stats.total_restaurants = Number(tenantCounts.rows[0].total_restaurants || 0);
    stats.total_branches = Number(tenantCounts.rows[0].total_branches || 0);
    stats.total_suppliers = Number(tenantCounts.rows[0].total_suppliers || 0);
    
    // Últimos 5 usuarios
    const recentUsers = await query(`
      SELECT u.id, u.username, u.name, r.display_name AS role, u.created_at, u.is_active
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at DESC
      LIMIT 5
    `);
    stats.recent_users = recentUsers.rows;
    
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
