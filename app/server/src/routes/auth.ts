import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, pool, hasCustomDbUrl } from '../config/db';
import { authRequired, roleRequired, signToken } from '../middleware/auth';
import { emitToUser } from '../lib/realtime';
import { logAudit } from '../lib/audit';
import { ensureServerInitialized } from '../lib/migrations';
import { rateLimit } from '../middleware/rateLimit';
import { isEntityType, randomVerificationToken, validateNit } from '../lib/verification';
import { notifyReviewers, sendRegistrationReceived } from '../lib/verificationEmails';

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
    const { password, name, email, phone, type, category, city, department, address } = req.body;
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const nitCheck = validateNit(req.body.nit);
    const legalRepName = String(req.body.legal_rep_name ?? '').trim();
    const legalRepDocument = String(req.body.legal_rep_document ?? '').trim();

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
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) {
      return res.status(400).json({ error: 'El correo corporativo es obligatorio y debe ser válido' });
    }
    if (!isEntityType(type)) {
      return res.status(400).json({ error: 'type debe ser restaurante o proveedor' });
    }
    if (!nitCheck.ok) {
      return res.status(400).json({ error: nitCheck.reason || 'NIT no válido' });
    }
    if (!String(address ?? '').trim()) {
      return res.status(400).json({ error: 'La dirección de la empresa es obligatoria' });
    }
    if (!String(city ?? '').trim()) {
      return res.status(400).json({ error: 'La ciudad es obligatoria' });
    }
    if (!legalRepName) {
      return res.status(400).json({ error: 'El nombre del representante legal es obligatorio' });
    }
    if (!/^\d{6,12}$/.test(legalRepDocument.replace(/[.\s]/g, ''))) {
      return res.status(400).json({ error: 'La cédula del representante legal no es válida' });
    }

    const nit = nitCheck.formatted!;
    const table = type === 'proveedor' ? 'suppliers' : 'restaurants';

    const exists = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rowCount) return res.status(409).json({ error: 'El usuario ya existe' });

    const duplicateNit = await query(`SELECT id FROM ${table} WHERE nit = $1`, [nit]);
    if (duplicateNit.rowCount) {
      return res.status(409).json({ error: `Ya existe una cuenta registrada con el NIT ${nit}` });
    }

    const duplicateEmail = await query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE lower(email) = lower($1)) +
         (SELECT COUNT(*) FROM restaurants WHERE lower(email) = lower($1)) +
         (SELECT COUNT(*) FROM suppliers WHERE lower(email) = lower($1)) AS count`,
      [String(email).trim()]
    );
    if (Number(duplicateEmail.rows[0]?.count ?? 0) > 0) {
      return res.status(409).json({ error: 'Ese correo ya está asociado a una cuenta. Usa uno diferente o inicia sesión.' });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const roleId = type === 'proveedor' ? 4 : 2;
    const roleName = type === 'proveedor' ? 'proveedor_admin' : 'gerente';
    let restaurantId: number | null = null;
    let supplierId: number | null = null;
    let branchId: number | null = null;
    const verificationToken = randomVerificationToken();

    // Entidad + sede + usuario se crean en una sola transacción: si algo falla,
    // no queda una empresa huérfana ni un usuario sin inquilino.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (type === 'proveedor') {
        const supplier = await client.query(
          `INSERT INTO suppliers
             (name, nit, email, phone, category, address, city, legal_rep_name, legal_rep_document,
              verification_status, verification_token, submitted_at, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,CURRENT_TIMESTAMP,FALSE)
           RETURNING id`,
          [
            name,
            nit,
            String(email).trim(),
            phone || null,
            category || 'Abarrotes y General',
            String(address).trim(),
            String(city).trim(),
            legalRepName,
            legalRepDocument,
            verificationToken,
          ]
        );
        supplierId = supplier.rows[0].id;
      } else {
        const restaurant = await client.query(
          `INSERT INTO restaurants
             (name, nit, email, phone, category, address, city, department, legal_rep_name, legal_rep_document,
              verification_status, verification_token, submitted_at, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pendiente',$11,CURRENT_TIMESTAMP,FALSE)
           RETURNING id`,
          [
            name,
            nit,
            String(email).trim(),
            phone || null,
            category || 'Latino & Comida Típica',
            String(address).trim(),
            String(city).trim(),
            String(department ?? 'Santander').trim() || 'Santander',
            legalRepName,
            legalRepDocument,
            verificationToken,
          ]
        );
        restaurantId = restaurant.rows[0].id;
        // Se crea la sede principal. El propietario queda como 'gerente' (rol 2),
        // nunca como administrador global de la plataforma.
        const branch = await client.query(
          `INSERT INTO branches (restaurant_id, name, is_main) VALUES ($1, 'Sede Principal', TRUE) RETURNING id`,
          [restaurantId]
        );
        branchId = branch.rows[0].id;
      }

      // La cuenta nace inactiva: no puede iniciar sesión hasta la aprobación.
      await client.query(
        `INSERT INTO users
           (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id, branch_id, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE)`,
        [username, hash, name, String(email).trim(), phone || null, roleId, restaurantId, supplierId, branchId]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }

    await logAudit(
      req,
      'register_pending_verification',
      type === 'proveedor' ? 'supplier' : 'restaurant',
      type === 'proveedor' ? supplierId! : restaurantId!,
      null,
      { username, role: roleName, name, nit, email }
    );

    void sendRegistrationReceived({
      kind: type,
      name,
      email: String(email).trim(),
      token: verificationToken,
    }).catch((err) => console.warn('[Auth Register] No se pudo enviar la confirmación:', err));

    void notifyReviewers({
      kind: type,
      name,
      nit,
      city: String(city).trim(),
      applicant: name,
      token: verificationToken,
    }).catch((err) => console.warn('[Auth Register] No se pudo avisar al equipo:', err));

    res.status(201).json({
      pending: true,
      entity_type: type,
      name,
      verification_status: 'pendiente',
      verification_token: verificationToken,
      message:
        'Registro recibido. La cuenta queda en revisión hasta que un verificador apruebe los documentos.',
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con esos datos (NIT o correo duplicado).' });
    }
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
    const loginSql = `SELECT u.*, r.name AS role,
                             COALESCE(rest.verification_status, sup.verification_status) AS entity_verification_status,
                             COALESCE(rest.verification_reason, sup.verification_reason) AS entity_verification_reason,
                             COALESCE(rest.verification_token, sup.verification_token) AS entity_verification_token
                        FROM users u
                        JOIN roles r ON r.id = u.role_id
                        LEFT JOIN restaurants rest ON rest.id = u.restaurant_id
                        LEFT JOIN suppliers sup ON sup.id = u.supplier_id
                       WHERE u.username = $1`;
    try {
      result = await query(loginSql, [username]);
    } catch (queryErr: any) {
      console.error('[Auth Login] Error de base de datos', queryErr?.code || queryErr?.message);
      if (queryErr?.message?.includes('users') || queryErr?.code === '42P01') {
        console.warn('[Auth Login] Tabla users no encontrada. Inicializando BD y reintentando...');
        try {
          await ensureServerInitialized();
          result = await query(loginSql, [username]);
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

    // La contraseña es correcta: ahora sí se puede informar el estado de la
    // verificación sin filtrar la existencia de cuentas a terceros.
    const verificationStatus = row.entity_verification_status as string | null;
    if (verificationStatus && verificationStatus !== 'verificado') {
      const pending = verificationStatus === 'pendiente';
      const correction = verificationStatus === 'subsanacion';
      return res.status(403).json({
        code: pending ? 'VERIFICATION_PENDING' : correction ? 'VERIFICATION_CORRECTION' : 'VERIFICATION_REJECTED',
        verification_status: verificationStatus,
        verification_reason: row.entity_verification_reason ?? null,
        verification_token: row.entity_verification_token ?? null,
        error: pending
          ? 'Tu cuenta está en revisión. Te avisaremos por correo cuando un verificador la apruebe.'
          : correction
          ? 'Necesitamos que corrijas documentos antes de activar tu cuenta. Revisa el correo que te enviamos.'
          : `Tu registro no fue aprobado. Motivo: ${row.entity_verification_reason || 'no especificado'}`,
      });
    }

    if (!row.is_active) return res.status(401).json({ error: 'Credenciales inválidas' });

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