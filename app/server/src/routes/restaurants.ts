import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

const RESTAURANT_COLUMNS = `id, name, nit, phone, email, address, city, department, logo_url,
                            description, cover_url, category, subscription_plan, is_active, created_at, updated_at`;
const BRANCH_COLUMNS = 'id, restaurant_id, name, address, phone, is_main, is_active, created_at, updated_at';

router.get('/', async (req, res, next) => {
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
});

router.get('/me', async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'El usuario no tiene un restaurante asociado' });
    const result = await query(
      `SELECT ${RESTAURANT_COLUMNS} FROM restaurants r WHERE r.id = $1`,
      [user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (req.params.id === 'me' || req.params.id === 'branches') return next(); // Let other handlers catch it
    const result = await query(`SELECT ${RESTAURANT_COLUMNS} FROM restaurants WHERE id = $1 AND is_active = TRUE`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/me', roleRequired('gerente', 'admin'), async (req, res, next) => {
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
});

router.get('/:id/branches', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ${BRANCH_COLUMNS} FROM branches WHERE restaurant_id = $1 ORDER BY is_main DESC, name`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/branches', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.restaurant_id) return res.status(403).json({ error: 'El usuario no tiene un restaurante asociado' });
    const { name, address, phone, is_main } = req.body;
    if (!name) return res.status(400).json({ error: 'name es obligatorio' });
    const result = await query(
      `INSERT INTO branches (restaurant_id, name, address, phone, is_main)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${BRANCH_COLUMNS}`,
      [user.restaurant_id, name, address, phone, is_main ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;