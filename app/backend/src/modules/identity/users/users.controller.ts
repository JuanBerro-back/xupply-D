import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import bcrypt from 'bcryptjs';
import { normalizeTenantIdsForRole, validateTenantScope } from '../../../shared/lib/userTenant';
import { checkUserScope } from './users.service';
import { getRoleName, usernameExists, restaurantExists, branchExists, supplierExists, deactivateUserById, activateUserById, updatePassword } from './users.repository';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const params: unknown[] = [];
    let sql = `SELECT u.id, u.username, u.name, u.email, u.phone, u.is_active, u.last_login,
                      u.created_at, u.supplier_id, u.restaurant_id,
                      COALESCE(u.vehicle_type, 'moto') AS vehicle_type,
                      u.vehicle_plate,
                      r.name AS role_name, COALESCE(r.display_name, r.name) AS role_label, r.id AS role_id
               FROM users u
               JOIN roles r ON r.id = u.role_id
               WHERE 1=1`;

    if (user.role === 'proveedor_admin') {
      if (!user.supplier_id) return res.status(403).json({ error: 'No autorizado' });
      params.push(user.supplier_id);
      // Proveedor es jefe del domiciliario: solo ve domiciliarios de su empresa
      sql += ` AND r.name = 'domiciliario' AND u.supplier_id = $${params.length}`;
    } else if (user.role === 'gerente') {
      if (!user.restaurant_id) return res.status(403).json({ error: 'No autorizado' });
      params.push(user.restaurant_id);
      // Gerente es jefe del empleado: solo ve empleados operativos de su restaurante
      sql += ` AND r.name = 'empleado' AND u.restaurant_id = $${params.length}`;
    } else if (user.role !== 'admin') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    sql += ` ORDER BY u.is_active DESC, u.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { username, password, name, email, phone, role_id, vehicle_type, vehicle_plate } = req.body;
    if (!username || !password || !name || !role_id) {
      return res.status(400).json({ error: 'username, password, name y role_id son requeridos' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const numericRoleId = Number(role_id);
    const allowedRoles = user.role === 'proveedor_admin'
      ? ['domiciliario']
      : user.role === 'gerente'
        ? ['empleado']
        : ['admin', 'gerente', 'empleado', 'proveedor_admin', 'domiciliario', 'verificador'];

    const roleRow = await getRoleName(numericRoleId);
    const roleName = roleRow.rows[0]?.name;

    if (!roleName) {
      return res.status(400).json({ error: 'El role_id proporcionado no existe' });
    }

    if (!allowedRoles.includes(roleName)) {
      return res.status(403).json({ error: 'No tienes permisos para crear usuarios con ese rol' });
    }

    const exists = await usernameExists(username.trim());
    if (exists.rowCount) return res.status(409).json({ error: 'El nombre de usuario ya existe' });

    const hash = await bcrypt.hash(String(password), 10);
    let restaurantId = user.restaurant_id;
    let supplierId = user.supplier_id;
    let branchId = user.branch_id;

    if (user.role === 'admin' && req.body.restaurant_id) {
      const restCheck = await restaurantExists(req.body.restaurant_id);
      if (!restCheck.rowCount) return res.status(400).json({ error: `El restaurant_id ${req.body.restaurant_id} no existe` });
      restaurantId = req.body.restaurant_id;

      if (req.body.branch_id) {
        const branchCheck = await branchExists(req.body.branch_id, restaurantId);
        if (!branchCheck.rowCount) return res.status(400).json({ error: `El branch_id ${req.body.branch_id} no pertenece al restaurant_id ${restaurantId} o no existe` });
        branchId = req.body.branch_id;
      } else {
        branchId = null;
      }
    }
    if (user.role === 'admin' && req.body.supplier_id) {
      const supCheck = await supplierExists(req.body.supplier_id);
      if (!supCheck.rowCount) return res.status(400).json({ error: `El supplier_id ${req.body.supplier_id} no existe` });
      supplierId = req.body.supplier_id;
    }

    // Invariante rol/tenant: gerente|empleado requieren restaurante; proveedor_admin|domiciliario
    // requieren proveedor; admin y verificador son de plataforma. El inquilino se
    // deduce del rol antes de validar para no arrastrar valores de otra selección.
    const normalized = normalizeTenantIdsForRole(roleName, {
      restaurant_id: restaurantId,
      branch_id: branchId,
      supplier_id: supplierId,
    });
    restaurantId = normalized.restaurant_id;
    branchId = normalized.branch_id;
    supplierId = normalized.supplier_id;

    const scopeError = validateTenantScope(roleName, { restaurant_id: restaurantId, supplier_id: supplierId });
    if (scopeError) return res.status(400).json({ error: scopeError });

    const result = await query(
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id, branch_id, vehicle_type, vehicle_plate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, username, name, email, phone, role_id, restaurant_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`,
      [username.trim(), hash, name.trim(), email ? email.trim() : null, phone ? phone.trim() : null, numericRoleId, restaurantId, supplierId, branchId, vehicle_type || 'moto', vehicle_plate || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const { name, email, phone, is_active, role_id, vehicle_type, vehicle_plate } = req.body;
    
    const scope = await checkUserScope(user, req.params.id);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });
    const targetUser = scope.user;

    const numericRoleId = role_id ? Number(role_id) : undefined;
    let roleName = targetUser.role_name;
    if (numericRoleId && numericRoleId !== targetUser.role_id) {
      const roleRow = await getRoleName(numericRoleId);
      roleName = roleRow.rows[0]?.name;
      const allowedRoles = user.role === 'proveedor_admin' ? ['domiciliario'] : user.role === 'gerente' ? ['empleado'] : ['admin', 'gerente', 'empleado', 'proveedor_admin', 'domiciliario', 'verificador'];
      if (!roleName || !allowedRoles.includes(roleName)) {
        return res.status(403).json({ error: 'No puedes asignar ese rol' });
      }
    }

    // El inquilino se deduce del rol resultante: los roles de plataforma
    // (admin/verificador) no conservan restaurante ni proveedor.
    let restaurantId = targetUser.restaurant_id;
    let branchId = targetUser.branch_id;
    let supplierId = targetUser.supplier_id;
    const normalized = normalizeTenantIdsForRole(roleName, {
      restaurant_id: restaurantId,
      branch_id: branchId,
      supplier_id: supplierId,
    });
    restaurantId = normalized.restaurant_id;
    branchId = normalized.branch_id;
    supplierId = normalized.supplier_id;

    const scopeError = validateTenantScope(roleName, { restaurant_id: restaurantId, supplier_id: supplierId });
    if (scopeError) return res.status(400).json({ error: scopeError });

    const result = await query(
      `UPDATE users
       SET name = COALESCE($2, name), email = COALESCE($3, email),
           phone = COALESCE($4, phone), is_active = COALESCE($5, is_active),
           role_id = COALESCE($6, role_id),
           restaurant_id = $7,
           branch_id = $8,
           supplier_id = $9,
           vehicle_type = COALESCE($10, vehicle_type),
           vehicle_plate = COALESCE($11, vehicle_plate),
           token_version = CASE WHEN role_id IS DISTINCT FROM COALESCE($6, role_id)
                                 OR restaurant_id IS DISTINCT FROM $7
                                 OR supplier_id IS DISTINCT FROM $9
                               THEN token_version + 1 ELSE token_version END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, username, name, email, phone, role_id, restaurant_id, supplier_id, vehicle_type, vehicle_plate, is_active, created_at`,
      [req.params.id, name, email, phone, is_active, numericRoleId, restaurantId, branchId, supplierId, vehicle_type, vehicle_plate]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await checkUserScope(req.user!, req.params.id, true);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });
    
    await deactivateUserById(req.params.id);
    res.json({ ok: true, message: 'Usuario desactivado' });
  } catch (err) {
    next(err);
  }
}

export async function activateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await checkUserScope(req.user!, req.params.id);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });
    
    await activateUserById(req.params.id);
    res.json({ ok: true, message: 'Usuario activado' });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    
    const scope = await checkUserScope(req.user!, req.params.id);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });
    
    const hash = await bcrypt.hash(String(password), 10);
    await updatePassword(hash, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
