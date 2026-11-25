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

export async function listRestaurants(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, is_active } = req.query;
    let sql = 'SELECT * FROM restaurants WHERE 1=1';
    const params: any[] = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (name ILIKE $${params.length} OR nit ILIKE $${params.length})`;
    }
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      sql += ` AND is_active = $${params.length}`;
    }
    sql += ' ORDER BY name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function createRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, nit, phone, email, address, city, department, logo_url, category, subscription_plan } = req.body;
    if (!name || !nit) return res.status(400).json({ error: 'Nombre y NIT son obligatorios' });
    
    const exists = await query('SELECT id FROM restaurants WHERE nit = $1', [nit]);
    if (exists.rowCount) return res.status(409).json({ error: 'NIT ya existe' });

    const result = await query(
      `INSERT INTO restaurants (name, nit, phone, email, address, city, department, logo_url, category, subscription_plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, nit, phone, email, address, city, department, logo_url, category, subscription_plan]
    );
    await logAudit(req, 'create', 'restaurant', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, nit, phone, email, address, city, department, logo_url, category, subscription_plan } = req.body;
    
    const target = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    
    if (nit && nit !== target.rows[0].nit) {
      const exists = await query('SELECT id FROM restaurants WHERE nit = $1', [nit]);
      if (exists.rowCount) return res.status(409).json({ error: 'NIT ya existe' });
    }

    const result = await query(
      `UPDATE restaurants 
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), phone = COALESCE($4, phone), 
           email = COALESCE($5, email), address = COALESCE($6, address), city = COALESCE($7, city), 
           department = COALESCE($8, department), logo_url = COALESCE($9, logo_url),
           category = COALESCE($10, category), subscription_plan = COALESCE($11, subscription_plan),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, name, nit, phone, email, address, city, department, logo_url, category, subscription_plan]
    );
    await logAudit(req, 'update', 'restaurant', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function activateRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    
    const result = await query('UPDATE restaurants SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'activate', 'restaurant', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deactivateRestaurant(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    
    const result = await query('UPDATE restaurants SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'deactivate', 'restaurant', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function getComercio(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, id } = req.params;
    if (type === 'restaurant') {
      const rest = await query('SELECT * FROM restaurants WHERE id = $1', [id]);
      if (!rest.rowCount) return res.status(404).json({ error: 'Not found' });
      const menu = await query('SELECT * FROM menu_products WHERE restaurant_id = $1', [id]);
      const branches = await query('SELECT * FROM branches WHERE restaurant_id = $1', [id]);
      const users = await query('SELECT u.id, u.name, u.email, u.is_active, r.display_name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.restaurant_id = $1', [id]);
      const metrics = await query("SELECT COUNT(id)::float8 as total_orders, SUM(total)::float8 as gmv FROM orders WHERE restaurant_id = $1 AND status != 'cancelado'", [id]);
      return res.json({ profile: rest.rows[0], catalog: menu.rows, branches: branches.rows, users: users.rows, metrics: metrics.rows[0] });
    } else if (type === 'supplier') {
      const sup = await query('SELECT * FROM suppliers WHERE id = $1', [id]);
      if (!sup.rowCount) return res.status(404).json({ error: 'Not found' });
      const prods = await query('SELECT p.*, c.name as category_name FROM products p LEFT JOIN product_categories c ON c.id = p.category_id WHERE p.supplier_id = $1', [id]);
      const users = await query('SELECT u.id, u.name, u.email, u.is_active, r.display_name as role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.supplier_id = $1', [id]);
      const metrics = await query("SELECT COUNT(id)::float8 as total_orders, SUM(total)::float8 as gmv FROM orders WHERE supplier_id = $1 AND status != 'cancelado'", [id]);
      return res.json({ profile: sup.rows[0], catalog: prods.rows, users: users.rows, branches: [], metrics: metrics.rows[0] });
    }
    res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    next(err);
  }
}

export async function listBranches(req: Request, res: Response, next: NextFunction) {
  try {
    const { restaurant_id } = req.query;
    let sql = 'SELECT * FROM branches';
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
}

export async function createBranch(req: Request, res: Response, next: NextFunction) {
  const client = await require('../../shared/config/db').pool.connect();
  try {
    const { restaurant_id, name, address, phone, is_main } = req.body;
    if (!restaurant_id || !name) return res.status(400).json({ error: 'restaurant_id y name obligatorios' });
    
    const restCheck = await client.query('SELECT 1 FROM restaurants WHERE id = $1', [restaurant_id]);
    if (!restCheck.rowCount) return res.status(400).json({ error: `El restaurant_id ${restaurant_id} no existe` });
    
    await client.query('BEGIN');
    if (is_main) {
      await client.query('UPDATE branches SET is_main = FALSE WHERE restaurant_id = $1', [restaurant_id]);
    }
    
    const result = await client.query(
      'INSERT INTO branches (restaurant_id, name, address, phone, is_main) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [restaurant_id, name, address, phone, is_main || false]
    );
    await client.query('COMMIT');
    await logAudit(req, 'create', 'branch', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function updateBranch(req: Request, res: Response, next: NextFunction) {
  const client = await require('../../shared/config/db').pool.connect();
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
    
    const result = await client.query(
      `UPDATE branches SET name = COALESCE($2, name), address = COALESCE($3, address),
       phone = COALESCE($4, phone), is_main = COALESCE($5, is_main), is_active = COALESCE($6, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, name, address, phone, is_main, is_active]
    );
    await client.query('COMMIT');
    await logAudit(req, 'update', 'branch', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

export async function activateBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM branches WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Sucursal no encontrada' });
    const result = await query('UPDATE branches SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'activate', 'branch', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deactivateBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM branches WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Sucursal no encontrada' });
    if (target.rows[0].is_main) return res.status(400).json({ error: 'No se puede desactivar la sucursal principal' });
    const result = await query('UPDATE branches SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'deactivate', 'branch', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function listSuppliers(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, is_active } = req.query;
    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    const params: any[] = [];
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (name ILIKE $${params.length} OR nit ILIKE $${params.length})`;
    }
    if (is_active !== undefined) {
      params.push(is_active === 'true');
      sql += ` AND is_active = $${params.length}`;
    }
    sql += ' ORDER BY name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function createSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, nit, category, phone, email, address, city, logo_url } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre obligatorio' });
    
    if (nit) {
      const exists = await query('SELECT id FROM suppliers WHERE nit = $1', [nit]);
      if (exists.rowCount) return res.status(409).json({ error: 'NIT ya existe' });
    }

    const result = await query(
      `INSERT INTO suppliers (name, nit, category, phone, email, address, city, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, nit, category, phone, email, address, city, logo_url]
    );
    await logAudit(req, 'create', 'supplier', result.rows[0].id, null, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { name, nit, category, phone, email, address, city, logo_url } = req.body;
    
    const target = await query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' });
    
    if (nit && nit !== target.rows[0].nit) {
      const exists = await query('SELECT id FROM suppliers WHERE nit = $1', [nit]);
      if (exists.rowCount) return res.status(409).json({ error: 'NIT ya existe' });
    }

    const result = await query(
      `UPDATE suppliers 
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), category = COALESCE($4, category), 
           phone = COALESCE($5, phone), email = COALESCE($6, email), address = COALESCE($7, address), 
           city = COALESCE($8, city), logo_url = COALESCE($9, logo_url), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [id, name, nit, category, phone, email, address, city, logo_url]
    );
    await logAudit(req, 'update', 'supplier', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function activateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const result = await query('UPDATE suppliers SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'activate', 'supplier', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deactivateSupplier(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const target = await query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (!target.rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' });
    const result = await query('UPDATE suppliers SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [id]);
    await logAudit(req, 'deactivate', 'supplier', Number(id), target.rows[0], result.rows[0]);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
