import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/me', async (req, res, next) => {
  try {
    const user = req.user!;
    const result = await query(
      `SELECT r.* FROM restaurants r WHERE r.id = $1`,
      [user.restaurant_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/me', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, nit, phone, email, address, city, department, logo_url } = req.body;
    const result = await query(
      `UPDATE restaurants
       SET name = COALESCE($2, name), nit = COALESCE($3, nit), phone = COALESCE($4, phone),
           email = COALESCE($5, email), address = COALESCE($6, address),
           city = COALESCE($7, city), department = COALESCE($8, department),
           logo_url = COALESCE($9, logo_url), updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
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
    const result = await query('SELECT * FROM branches WHERE restaurant_id = $1 ORDER BY is_main DESC, name', [
      req.params.id,
    ]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/branches', roleRequired('gerente', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { name, address, phone, is_main } = req.body;
    const result = await query(
      `INSERT INTO branches (restaurant_id, name, address, phone, is_main)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user.restaurant_id, name, address, phone, is_main ?? false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;