import { Router } from 'express';
import { query } from '../config/db';
import { authRequired } from '../middleware/auth';

const router = Router();
router.use(authRequired);

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM product_categories ORDER BY sort_order');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;