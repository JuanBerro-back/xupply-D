import { Request, Response, NextFunction } from 'express';
import { query } from '../../../shared/config/db';
import { RESTAURANT_COLUMNS, BRANCH_COLUMNS } from './restaurants.service';
import { getRestaurantById, getMyRestaurant, getBranches, createBranchRow } from './restaurants.repository';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, search } = req.query;
    const params: unknown[] = [];
    let sql = 'SELECT id, name, category, city, is_active, logo_url, description FROM restaurants WHERE is_active = TRUE';
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
    if (!user.restaurant_id) return res.status(403).json({ error: 'El usuario no tiene un restaurante asociado' });
    const result = await getMyRestaurant(user.restaurant_id);
    if (!result.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function byId(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.params.id === 'me' || req.params.id === 'branches') return next(); // Let other handlers catch it
    const result = await getRestaurantById(req.params.id);
    if (!result.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateMine(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'El usuario no tiene un restaurante asociado' });
    const { name, nit, phone, email, address, city, department, logo_url } = req.body;
    const result = await query(
      `UPDATE restaurants
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), phone = COALESCE($4, phone),
           email = COALESCE($5, email), address = COALESCE($6, address),
           city = COALESCE($7, city), department = COALESCE($8, department),
           logo_url = COALESCE($9, logo_url), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${RESTAURANT_COLUMNS}`,
      [user.restaurant_id, name, nit, phone, email, address, city, department, logo_url]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function branches(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getBranches(req.params.id);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function createBranch(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'El usuario no tiene un restaurante asociado' });
    const { name, address, phone, is_main } = req.body;
    if (!name) return res.status(400).json({ error: 'name es obligatorio' });
    const result = await createBranchRow(user.restaurant_id, name, address, phone, is_main ?? false);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}
