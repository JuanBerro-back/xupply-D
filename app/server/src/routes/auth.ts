import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, hasCustomDbUrl } from '../config/db';
import { authRequired, roleRequired, signToken } from '../middleware/auth';
import { emitToUser } from '../lib/realtime';
import { logAudit } from '../lib/audit';
import { ensureServerInitialized } from '../lib/migrations';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// Protección contra fuerza bruta y creación masiva de cuentas.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth:login' });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: 'auth:register' });

function buildPayload(row: {
  id: number;
  username: string;
  role: string;
  role_id: number;
  restaurant_id: number | null;
  supplier_id: number | null;
  branch_id: number | null;
  token_version?: number;
}) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    role_id: row.role_id,
    restaurant_id: row.restaurant_id,
    supplier_id: row.supplier_id,
    branch_id: row.branch_id,
    token_version: row.token_version,
  };
}



router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const { password, name, email, phone, type, category } = req.body;
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'username, password y name son requeridos' });
    }
    // Evita usuarios con espacios o caracteres de control (rompen el login y la auditoría).
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return res.status(400).json({
        error: 'El usuario debe tener entre 3 y 40 caracteres: letras minúsculas, números, punto, guion o guion bajo',
      });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) {
      return res.status(400).json({ error: 'El email no es válido' });
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
    let branchId: number | null = null;

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
      // Se crea la sede principal. El propietario queda como 'gerente' (rol 2),
      // nunca como administrador global de la plataforma.
      const branch = await query(
        `INSERT INTO branches (restaurant_id, name, is_main) VALUES ($1, 'Sede Principal', TRUE) RETURNING id`,
        [restaurantId]
      );
      branchId = branch.rows[0].id;
    }

    const user = await query(
      `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, role_id, restaurant_id, supplier_id, branch_id, token_version`,
      [username, hash, name, email, phone, roleId, restaurantId, supplierId, branchId]
    );
    const row = user.rows[0];
    let permissions: string[] = [];
    if (roleName === 'admin') {
      const all = await query('SELECT name FROM permissions');
      permissions = all.rows.map((r: any) => r.name);
    } else {
      const perms = await query(
        `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`,
        [roleId]
      );
      permissions = perms.rows.map((r: any) => r.name);
    }
    const payload = buildPayload({ ...row, role: roleName });
    await logAudit(req, 'register', 'user', row.id, null, { username, role: roleName, name });
    res.status(201).json({ token: signToken(payload), user: { ...payload, permissions } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username y password son requeridos' });
    }

    if (process.env.VERCEL === '1' && !hasCustomDbUrl) {
      return res.status(500).json({
        error: 'Base de datos no configurada en Vercel',
        detail: 'Falta configurar la variable DATABASE_URL en Settings -> Environment Variables de tu proyecto en Vercel con la URL de Neon.',
      });
    }

    let result;
    try {
      result = await query(
        `SELECT u.*, r.name AS role FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.username = $1 AND u.is_active = TRUE`,
        [username]
      );
    } catch (queryErr: any) {
      console.error('[Auth Login] Error de base de datos', queryErr?.code || queryErr?.message);
      if (queryErr?.message?.includes('users') || queryErr?.code === '42P01') {
        console.warn('[Auth Login] Tabla users no encontrada. Inicializando BD y reintentando...');
        try {
          await ensureServerInitialized();
          result = await query(
            `SELECT u.*, r.name AS role FROM users u
             JOIN roles r ON r.id = u.role_id
             WHERE u.username = $1 AND u.is_active = TRUE`,
            [username]
          );
        } catch (initErr: any) {
          console.error('[Auth Login] Error inicializando esquema', initErr?.code || initErr?.message);
          return res.status(500).json({ error: 'Error interno del servidor' });
        }
      } else {
        // Nunca devolver el mensaje crudo del driver (filtra host, tablas, etc.).
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
    const row = result.rows[0];
    if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });

    let ok = false;
    try {
      ok = await bcrypt.compare(String(password), row.password_hash);
    } catch {
      // Hash corrupto o inválido (p. ej. datos semilla antiguos): no autenticar.
      ok = false;
    }
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    let permissions: string[] = [];
    if (row.role === 'admin') {
      const all = await query('SELECT name FROM permissions');
      permissions = all.rows.map((r: any) => r.name);
    } else {
      const perms = await query(
        `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`,
        [row.role_id]
      );
      permissions = perms.rows.map((r: any) => r.name);
    }
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
    await logAudit(req, 'login', 'user', row.id, null, { username: row.username, role: row.role, name: row.name });
    res.json({ token: signToken(buildPayload(row)), user: { ...buildPayload(row), permissions } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const user = req.user!;
    let permissions: string[] = [];
    if (user.role === 'admin') {
      const all = await query('SELECT name FROM permissions');
      permissions = all.rows.map((r: any) => r.name);
    } else {
      const perms = await query(
        `SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1`,
        [user.role_id]
      );
      permissions = perms.rows.map((r: any) => r.name);
    }
    res.json({ ...user, permissions });
  } catch (err) {
    next(err);
  }
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

router.post('/subscription-plan', authRequired, roleRequired('admin'), async (req, res, next) => {
  try {
    // Un gerente NO puede cambiar su propio plan: eso permitía obtener el plan
    // premium gratis. Solo un administrador de plataforma puede asignarlo.
    const user = req.user!;
    const { plan, restaurant_id } = req.body;
    if (!['basico', 'medio', 'premium'].includes(plan)) {
      return res.status(400).json({ error: 'Plan inválido. Opciones: basico, medio, premium' });
    }
    const targetRestaurantId = restaurant_id ? Number(restaurant_id) : user.restaurant_id;
    if (!targetRestaurantId) {
      return res.status(400).json({ error: 'restaurant_id es requerido' });
    }
    const updated = await query('UPDATE restaurants SET subscription_plan = $1 WHERE id = $2 RETURNING id', [
      plan,
      targetRestaurantId,
    ]);
    if (!updated.rowCount) return res.status(404).json({ error: 'Restaurante no encontrado' });
    await logAudit(req, 'update_plan', 'restaurant', targetRestaurantId, null, { plan });
    res.json({ ok: true, plan, restaurant_id: targetRestaurantId });
  } catch (err) {
    next(err);
  }
});

/** Cierre de sesión real: invalida los tokens emitidos para este usuario. */
router.post('/logout', authRequired, async (req, res, next) => {
  try {
    const user = req.user!;
    await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [user.id]);
    await logAudit(req, 'logout', 'user', user.id, null, null);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Cambio de contraseña por el propio usuario (antes solo el admin podía). */
router.post('/change-password', authRequired, async (req, res, next) => {
  try {
    const user = req.user!;
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password y new_password son requeridos' });
    }
    if (String(new_password).length < 10) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 10 caracteres' });
    }
    if (String(new_password) === String(current_password)) {
      return res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual' });
    }
    const row = await query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    if (!row.rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
    const ok = await bcrypt.compare(String(current_password), row.rows[0].password_hash).catch(() => false);
    if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    const hash = await bcrypt.hash(String(new_password), 10);
    await query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hash, user.id]
    );
    await logAudit(req, 'change_password', 'user', user.id, null, { self: true });
    res.json({ ok: true, message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
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