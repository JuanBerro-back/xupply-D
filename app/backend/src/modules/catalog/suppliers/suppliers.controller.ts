import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import { emitToUser } from '../../../shared/lib/realtime';
import { SUPPLIER_COLUMNS } from './suppliers.service';
import { getSupplierById, getActiveSupplierById } from './suppliers.repository';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, search } = req.query;
    const params: unknown[] = [];
    let sql = `SELECT ${SUPPLIER_COLUMNS} FROM suppliers WHERE is_active = TRUE`;
    if (category) {
      params.push(category);
      sql += ` AND category ILIKE $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR city ILIKE $${params.length})`;
    }
    sql += ' ORDER BY name';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function mine(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const result = await getSupplierById(user.supplier_id);
    if (!result.rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateMine(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (!user.supplier_id) {
      return res.status(403).json({ error: 'El usuario no tiene un proveedor asociado' });
    }
    const { name, nit, category, phone, email, address, city, logo_url } = req.body;
    const result = await query(
      `UPDATE suppliers
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), category = COALESCE($4, category),
           phone = COALESCE($5, phone), email = COALESCE($6, email), address = COALESCE($7, address),
           city = COALESCE($8, city), logo_url = COALESCE($9, logo_url), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING ${SUPPLIER_COLUMNS}`,
      [user.supplier_id, name, nit, category, phone, email, address, city, logo_url]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' });
    emitToUser('notification:created', user.id, { message: 'Perfil de proveedor actualizado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getActiveSupplierById(req.params.id);
    if (!result.rowCount) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
