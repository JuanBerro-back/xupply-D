import { Router } from 'express';
import { query } from '../config/db';
import { authRequired, roleRequired } from '../middleware/auth';
import { emitToUser } from '../lib/realtime';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res, next) => {
  try {
    const { supplier_id } = req.query;
    const params: unknown[] = [];
    let sql = `SELECT rv.*, s.name AS supplier_name
               FROM "Reseña" rv
               JOIN suppliers s ON s.id = rv.supplier_id`;
    if (supplier_id) {
      params.push(supplier_id);
      sql += ` WHERE rv.supplier_id = $${params.length}`;
    }
    sql += ' ORDER BY rv.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', roleRequired('gerente', 'empleado', 'admin'), async (req, res, next) => {
  try {
    const user = req.user!;
    const { supplier_id, rating, comment } = req.body;
    if (!supplier_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'supplier_id y rating (1-5) son requeridos' });
    }
    if (user.role === 'proveedor_admin') {
      return res.status(403).json({ error: 'Los proveedores no se califican a sí mismos' });
    }
    const userRow = await query('SELECT name FROM users WHERE id = $1', [user.id]);
    const result = await query(
      `INSERT INTO "Reseña" (supplier_id, reviewer_name, rating, comment, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [supplier_id, userRow.rows[0]?.name ?? user.username, rating, comment, user.id]
    );
    const agg = await query(
      `SELECT ROUND(AVG(rating)::numeric, 1) AS rating, COUNT(*)::int AS review_count
       FROM "Reseña" WHERE supplier_id = $1`,
      [supplier_id]
    );
    await query('UPDATE suppliers SET rating = $1, review_count = $2 WHERE id = $3', [
      agg.rows[0].rating,
      agg.rows[0].review_count,
      supplier_id,
    ]);
    const supplier = await query('SELECT id, name FROM suppliers WHERE id = $1', [supplier_id]);
    if (supplier.rowCount) {
      const admins = await query('SELECT id FROM users WHERE supplier_id = $1', [supplier_id]);
      for (const a of admins.rows) {
        emitToUser('notification:created', a.id, { message: `Nueva reseña para ${supplier.rows[0].name}` });
      }
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;