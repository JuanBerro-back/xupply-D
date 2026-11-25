import { Request, Response, NextFunction } from 'express';
import { query } from '../../shared/config/db';
import { clearPermissionCache } from '../../shared/middleware/auth';
import bcrypt from 'bcryptjs';
import { logAudit } from '../../shared/lib/audit';
import { emitToUser, emitToRole } from '../../shared/lib/realtime';
import { getEmailStatus, sendTestEmail, checkEmailDns } from '../../shared/lib/email';
import { normalizeTenantIdsForRole, validateTenantScope } from '../../shared/lib/userTenant';
import { pagination } from './admin.service';
import { usernameExists, getRoleName, restaurantExists, branchExists, supplierExists, findUserById, countActiveAdmins, listRoles as listRolesRow, findRoleById, roleNameExists, findRole, updatePassword, forceLogout, deleteUser as deleteUserRow } from './admin.repository';

export async function listRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listRolesRow();
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function getRoleById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await findRoleById(id);
    if (!result.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, display_name, description } = req.body;
    if (!name || !display_name) {
      return res.status(400).json({ error: 'name (snake_case) y display_name son obligatorios' });
    }
    
    if (!/^[a-z_]+$/.test(name)) {
      return res.status(400).json({ error: 'name debe estar en snake_case (solo min├║sculas y guiones bajos)' });
    }
    
    const exists = await roleNameExists(name);
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
}

export async function updateRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, display_name, description } = req.body;
    const numericId = Number(id);
    
    const target = await findRole(numericId);
    if (!target.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    
    if (numericId >= 1 && numericId <= 5) {
      // Los roles seed 1..5 est├ín protegidos. No se puede cambiar su "name" (identificador)
      if (name && name !== target.rows[0].name) {
        return res.status(409).json({ error: 'No puedes renombrar el identificador interno de un rol del sistema (IDs 1-5)' });
      }
    } else {
      if (name && !/^[a-z_]+$/.test(name)) {
        return res.status(400).json({ error: 'name debe estar en snake_case (solo min├║sculas y guiones bajos)' });
      }
      if (name && name !== target.rows[0].name) {
        const exists = await roleNameExists(name);
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
}

export async function deleteRole(req: Request, res: Response, next: NextFunction) {
  try {
    const numericId = Number(req.params.id);
    if (numericId >= 1 && numericId <= 5) {
      return res.status(409).json({ error: 'No se pueden eliminar los roles del sistema base (IDs 1 al 5).' });
    }
    
    const target = await findRole(numericId);
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
}

export async function listPermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await query(
      `SELECT p.id, p.name, p.description, p.created_at, 
              (SELECT count(*) FROM role_permissions rp WHERE rp.permission_id = p.id) as roles_count
       FROM permissions p
       ORDER BY p.name`
    );
    
    // Agrupar por m├│dulo
    const grouped: Record<string, any[]> = {};
    for (const row of result.rows) {
      let moduleName = 'General';
      if (row.name.startsWith('prov:')) {
        moduleName = 'Proveedor';
      } else if (row.name === 'analytics') {
        moduleName = 'Plataforma';
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
}

export async function getPermissionById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM permissions WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Permiso no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function createPermission(req: Request, res: Response, next: NextFunction) {
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
}

export async function updatePermission(req: Request, res: Response, next: NextFunction) {
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
}

export async function deletePermission(req: Request, res: Response, next: NextFunction) {
  try {
    const numericId = Number(req.params.id);
    const target = await query('SELECT * FROM permissions WHERE id = $1', [numericId]);
    if (!target.rowCount) return res.status(404).json({ error: 'Permiso no encontrado' });
    
    const rolesUsing = await query('SELECT count(*) FROM role_permissions WHERE permission_id = $1', [numericId]);
    if (parseInt(rolesUsing.rows[0].count, 10) > 0) {
      return res.status(409).json({ error: `Este permiso est├í asignado a ${rolesUsing.rows[0].count} rol(es). No se puede eliminar.` });
    }
    
    await query('DELETE FROM permissions WHERE id = $1', [numericId]);
    await logAudit(req, 'delete', 'permission', numericId, target.rows[0], null);
    await clearPermissionCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function getRolePermissions(req: Request, res: Response, next: NextFunction) {
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
}

export async function setRolePermissions(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    const { permissions } = req.body;
    
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Se requiere un array de permission_id' });
    }
    
    const target = await findRole(numericId);
    if (!target.rowCount) return res.status(404).json({ error: 'Rol no encontrado' });
    
    if (numericId === 1) {
      // Evitamos quitarle permisos al admin para que siempre tenga acceso a todo,
      // el bypass en requirePermission protege la ejecuci├│n, pero la UI tambi├®n debe reflejarlo.
      return res.json({ ok: true, message: 'El rol de administrador tiene acceso global impl├¡cito.' });
    }
    
    const oldPerms = await query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [numericId]);
    
    // Iniciar transacci├│n expl├¡cita
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
    emitToRole(target.rows[0].name, 'auth:session_invalidated', { message: 'Los permisos de tu rol han sido actualizados por el administrador.' });
    
    res.json({ ok: true, count: permissions.length });
  } catch (err) {
    await query('ROLLBACK');
    next(err);
  }
}

export async function getPermissionRoles(req: Request, res: Response, next: NextFunction) {
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
}
