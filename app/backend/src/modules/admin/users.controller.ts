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

export async function getUsers(req: Request, res: Response, next: NextFunction) {
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
    const { page: p, limit: l, offset } = pagination(page, limit);
    sql += ` ORDER BY u.created_at DESC LIMIT ${l} OFFSET ${offset}`;
    
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
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
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
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate } = req.body;
    
    if (!username || !password || !name || !role_id) {
      return res.status(400).json({ error: 'username, password, name y role_id son obligatorios' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contrase├▒a debe tener al menos 8 caracteres' });
    }
    
    const exists = await usernameExists(username.trim());
    if (exists.rowCount) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

    // Validar que el rol exista y que el inquilino sea coherente con el rol.
    const roleRow = await getRoleName(Number(role_id));
    const roleName = roleRow.rows[0]?.name;
    if (!roleName) return res.status(400).json({ error: 'El role_id proporcionado no existe' });

    const { restaurant_id: restId, branch_id: branchId, supplier_id: supId } = normalizeTenantIdsForRole(
      roleName,
      {
        restaurant_id: restaurant_id ? Number(restaurant_id) : null,
        branch_id: branch_id ? Number(branch_id) : null,
        supplier_id: supplier_id ? Number(supplier_id) : null,
      }
    );

    // El inquilino se deduce del rol ANTES de validar: los roles de plataforma
    // (admin, verificador) no llevan restaurante ni proveedor, as├¡ que cualquier
    // valor heredado del formulario se descarta en vez de rechazar el alta.
    const scopeError = validateTenantScope(roleName, { restaurant_id: restId, supplier_id: supId });
    if (scopeError) return res.status(400).json({ error: scopeError });

    if (restId) {
      const restCheck = await restaurantExists(restId);
      if (!restCheck.rowCount) return res.status(400).json({ error: `El restaurant_id ${restId} no existe` });
    }
    if (branchId) {
      const branchCheck = await branchExists(branchId, restId);
      if (!branchCheck.rowCount) return res.status(400).json({ error: `El branch_id ${branchId} no pertenece al restaurant_id ${restId} o no existe` });
    }
    if (supId) {
      const supCheck = await supplierExists(supId);
      if (!supCheck.rowCount) return res.status(400).json({ error: `El supplier_id ${supId} no existe` });
    }
    
    const hash = await bcrypt.hash(String(password), 10);
    
    const result = await query(
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, username, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`,
      [username.trim(), hash, name.trim(), email?.trim() || null, phone?.trim() || null, Number(role_id), restId, branchId, supId, vehicle_type || null, vehicle_plate || null]
    );
    
    await logAudit(req, 'create', 'user', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate } = req.body;
    
    const target = await findUserById(id);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const oldUser = target.rows[0];
    
    // Invariante: un admin no puede quitarse su propio rol
    if (oldUser.id === req.user?.id && oldUser.role_id === 1 && role_id && role_id !== 1) {
      return res.status(403).json({ error: 'No puedes quitarte el rol de administrador a ti mismo' });
    }
    
    // Estado resultante del rol y su inquilino.
    const effectiveRoleId = role_id ? Number(role_id) : oldUser.role_id;
    const effectiveRoleRow = await getRoleName(effectiveRoleId);
    const effectiveRoleName = effectiveRoleRow.rows[0]?.name;
    if (!effectiveRoleName) return res.status(400).json({ error: 'El role_id proporcionado no existe' });

    const { restaurant_id: restId, branch_id: branchId, supplier_id: supId } = normalizeTenantIdsForRole(
      effectiveRoleName,
      {
        restaurant_id: restaurant_id ? Number(restaurant_id) : oldUser.restaurant_id,
        branch_id: branch_id ? Number(branch_id) : oldUser.branch_id,
        supplier_id: supplier_id ? Number(supplier_id) : oldUser.supplier_id,
      }
    );

    // Al cambiar a un rol de plataforma se limpia el inquilino; al cambiar de
    // restaurante a proveedor (o viceversa) se descarta el que no aplica.
    const scopeError = validateTenantScope(effectiveRoleName, { restaurant_id: restId, supplier_id: supId });
    if (scopeError) return res.status(400).json({ error: scopeError });

    if (restId) {
      const restCheck = await restaurantExists(restId);
      if (!restCheck.rowCount) return res.status(400).json({ error: `El restaurant_id ${restId} no existe` });
    }

    if (branchId) {
      const branchCheck = await branchExists(branchId, restId);
      if (!branchCheck.rowCount) return res.status(400).json({ error: `El branch_id ${branchId} no pertenece al restaurant_id ${restId} o no existe` });
    }

    if (supId) {
      const supCheck = await supplierExists(supId);
      if (!supCheck.rowCount) return res.status(400).json({ error: `El supplier_id ${supId} no existe` });
    }

    const result = await query(
      `UPDATE users 
       SET name = COALESCE($2, name), 
           email = COALESCE($3, email),
           phone = COALESCE($4, phone),
           role_id = $5,
           restaurant_id = $6,
           branch_id = $7,
           supplier_id = $8,
           vehicle_type = COALESCE($9, vehicle_type),
           vehicle_plate = COALESCE($10, vehicle_plate),
           token_version = CASE WHEN role_id IS DISTINCT FROM $5
                                  OR restaurant_id IS DISTINCT FROM $6
                                  OR supplier_id IS DISTINCT FROM $8
                                THEN token_version + 1 ELSE token_version END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, name, email, phone, role_id, restaurant_id, branch_id, supplier_id, vehicle_type, vehicle_plate, is_active, updated_at`,
      [id, name, email, phone, effectiveRoleId, restId, branchId, supId, vehicle_type, vehicle_plate]
    );
    
    await logAudit(req, 'update', 'user', Number(id), oldUser, result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function activateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await findUserById(id);
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
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await findUserById(id);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const userToDeactivate = target.rows[0];
    if (userToDeactivate.id === req.user?.id) {
      return res.status(403).json({ error: 'No puedes desactivarte a ti mismo' });
    }
    
    if (userToDeactivate.role_id === 1) {
      const activeAdmins = await countActiveAdmins();
      if (parseInt(activeAdmins.rows[0].count, 10) <= 1) {
        return res.status(403).json({ error: 'No puedes desactivar al ├║ltimo administrador activo' });
      }
    }
    
    const result = await query(
      `UPDATE users SET is_active = FALSE, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, 
      [id]
    );
    
    await logAudit(req, 'deactivate', 'user', Number(id), userToDeactivate, result.rows[0]);
    emitToUser('auth:session_invalidated', Number(id), { message: 'Tu cuenta ha sido desactivada por el administrador.' });
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function changeUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'La contrase├▒a debe tener al menos 8 caracteres' });
    }
    
    const target = await findUserById(id);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const hash = await bcrypt.hash(String(password), 10);
    await updatePassword(hash, id);
    
    await logAudit(req, 'change_password', 'user', Number(id), null, { message: 'Password updated' });
    emitToUser('auth:session_invalidated', Number(id), { message: 'Tu contrase├▒a fue actualizada por el administrador. Inicia sesi├│n nuevamente.' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function forceLogoutUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Invalidamos el token directamente iterando su version
    await forceLogout(Number(req.params.id));
    await logAudit(req, 'force_logout', 'user', Number(req.params.id), null, { note: 'JWT successfully invalidated via token_version' });
    emitToUser('auth:session_invalidated', Number(req.params.id), { message: 'Tu sesi├│n ha sido revocada por el administrador.' });
    res.json({ 
      ok: true, 
      message: 'Sesi├│n cerrada con ├®xito. Los tokens actuales del usuario han sido invalidados en tiempo real.' 
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await findUserById(id);
    if (!target.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    if (target.rows[0].id === req.user?.id) {
      return res.status(403).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    
    try {
      await deleteUserRow(id);
      await logAudit(req, 'delete', 'user', Number(id), target.rows[0], null);
      res.json({ ok: true });
    } catch (dbErr: any) {
      // 23503 es el c├│digo de PostgreSQL para foreign_key_violation
      if (dbErr.code === '23503') {
        return res.status(409).json({ error: 'No se puede eliminar el usuario porque tiene registros dependientes (pedidos, facturas, auditor├¡a, etc). Por favor, desact├¡valo en su lugar.' });
      }
      throw dbErr;
    }
  } catch (err) {
    next(err);
  }
}
