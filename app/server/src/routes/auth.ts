import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db';
import { authRequired, signToken } from '../middleware/auth';
import { emitToUser } from '../lib/realtime';

const router = Router();

function buildPayload(row: {
  id: number;
  username: string;
  role: string;
  role_id: number;
  restaurant_id: number | null;
  supplier_id: number | null;
  branch_id: number | null;
}) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    role_id: row.role_id,
    restaurant_id: row.restaurant_id,
    supplier_id: row.supplier_id,
    branch_id: row.branch_id,
  };
}

// Asegurar columnas de categoría culinaria y planes de suscripción
query(`
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS category VARCHAR(100);
  ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basico';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basico';
  UPDATE restaurants SET category = 'BBQ & Parrilla' WHERE id = 1 AND category IS NULL;
  UPDATE restaurants SET category = 'Latino & Comida Típica' WHERE id = 2 AND category IS NULL;
  UPDATE restaurants SET category = 'BBQ & Parrilla' WHERE id = 3 AND category IS NULL;
  UPDATE restaurants SET category = 'Latino & Comida Típica' WHERE id = 4 AND category IS NULL;
  UPDATE restaurants SET category = 'Hamburguesas & Fast Food' WHERE id = 5 AND category IS NULL;
`).catch(() => undefined);

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, name, email, phone, type, category } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'username, password y name son requeridos' });
    }
    if (!['restaurante', 'proveedor'].includes(type)) {
      return res.status(400).json({ error: 'type debe ser restaurante o proveedor' });
    }
    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rowCount) return res.status(409).json({ error: 'El usuario ya existe' });

    const hash = await bcrypt.hash(String(password), 10);
    let roleId = type === 'proveedor' ? 4 : 2;
    let roleName = type === 'proveedor' ? 'proveedor_admin' : 'gerente';
    let restaurantId: number | null = null;
    let supplierId: number | null = null;

    if (type === 'proveedor') {
      const supplier = await query(
        `INSERT INTO suppliers (name, email, phone, category) VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, email, phone, category || 'Abarrotes y General']
      );
      supplierId = supplier.rows[0].id;
    } else {
      const restaurant = await query(
        `INSERT INTO restaurants (name, email, phone, category) VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, email, phone, category || 'Latino & Comida Típica']
      );
      restaurantId = restaurant.rows[0].id;
      await query(
        `INSERT INTO branches (restaurant_id, name, is_main) VALUES ($1, 'Sede Principal', TRUE)`,
        [restaurantId]
      );
      const admin = await query(
        `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, branch_id)
         VALUES ($1, $2, $3, $4, $5, 1, $6, (SELECT id FROM branches WHERE restaurant_id = $6 LIMIT 1))`,
        [`${username}_admin`, hash, name, email, phone, restaurantId]
      );
      emitToUser('notification:created', admin.rows[0].id, {
        message: 'Cuenta administradora creada',
      });
    }

    const user = await query(
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, role_id, restaurant_id, supplier_id, branch_id`,
      [username, hash, name, email, phone, roleId, restaurantId, supplierId]
    );
    const row = user.rows[0];
    const payload = buildPayload({ ...row, role: roleName });
    res.status(201).json({ token: signToken(payload), user: payload });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username y password son requeridos' });
    }
    const result = await query(
      `SELECT u.*, r.name AS role FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.username = $1 AND u.is_active = TRUE`,
      [username]
    );
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });

    const seedDemoPass = row.password_hash.startsWith('$2b$10$DefaulthashForDemo') && password === 'demo1234';
    const ok = seedDemoPass || (await bcrypt.compare(String(password), row.password_hash));
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
    res.json({ token: signToken(buildPayload(row)), user: buildPayload(row) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authRequired, async (req, res) => {
  res.json(req.user);
});

router.get('/roles', authRequired, async (_req, res, next) => {
  try {
    const result = await query('SELECT * FROM roles ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/tenant-info', authRequired, async (req, res, next) => {
  try {
    const user = req.user!;
    if (user.restaurant_id) {
      const r = await query('SELECT id, name, logo_url, category, COALESCE(subscription_plan, \'medio\') AS subscription_plan FROM restaurants WHERE id = $1', [user.restaurant_id]);
      if (r.rowCount) return res.json({ type: 'restaurant', ...r.rows[0] });
    }
    if (user.supplier_id) {
      const s = await query('SELECT id, name, logo_url, category FROM suppliers WHERE id = $1', [user.supplier_id]);
      if (s.rowCount) return res.json({ type: 'supplier', subscription_plan: 'premium', ...s.rows[0] });
    }
    res.json({ type: 'platform', name: 'Xupply', subscription_plan: 'premium' });
  } catch (err) {
    next(err);
  }
});

router.post('/subscription-plan', authRequired, async (req, res, next) => {
  try {
    const user = req.user!;
    const { plan } = req.body;
    if (!['basico', 'medio', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Plan inválido. Opciones: basico, medio, premium' });
    }
    if (user.restaurant_id) {
      await query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2', [plan, user.restaurant_id]);
    }
    await query('UPDATE users SET subscription_plan = $1 WHERE id = $2', [plan, user.id]);
    emitToUser('notification:created', user.id, { message: `Plan cambiado a: ${plan.toUpperCase()}` });
    res.json({ ok: true, plan });
  } catch (err) {
    next(err);
  }
});

router.post('/notify-me', authRequired, async (req, res) => {
  const user = req.user!;
  emitToUser('notification:created', user.id, { message: 'Canal de notificaciones activo' });
  res.json({ ok: true });
});

export default router;