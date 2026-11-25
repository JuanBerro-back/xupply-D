import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schemaSql';

dotenv.config();

/**
 * El esquema base incluye datos de referencia (roles, permisos) y, al final,
 * datos de demostración (restaurantes, proveedores, productos y usuarios con
 * contraseña conocida). En producción NO se siembran los datos demo salvo que
 * se habilite explícitamente SEED_DEMO_DATA=true.
 */
function splitSchema(): { schema: string; demo: string } {
  const demoStart = SCHEMA_SQL.indexOf('-- Restaurantes');
  const viewsStart = SCHEMA_SQL.indexOf('-- VISTAS');
  if (demoStart === -1 || viewsStart === -1 || viewsStart <= demoStart) {
    return { schema: SCHEMA_SQL, demo: '' };
  }
  return {
    schema: SCHEMA_SQL.slice(0, demoStart) + SCHEMA_SQL.slice(viewsStart),
    demo: SCHEMA_SQL.slice(demoStart, viewsStart),
  };
}

export function shouldSeedDemoData(): boolean {
  const flag = (process.env.SEED_DEMO_DATA ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'si'].includes(flag)) return true;
  if (['false', '0', 'no'].includes(flag)) return false;
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
}

export function resolveDatabaseUrl(): { url: string; isConfigured: boolean; source: string } {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
    return { url: process.env.DATABASE_URL.trim(), isConfigured: true, source: 'DATABASE_URL' };
  }
  if (process.env.POSTGRES_URL && process.env.POSTGRES_URL.trim()) {
    return { url: process.env.POSTGRES_URL.trim(), isConfigured: true, source: 'POSTGRES_URL' };
  }
  if (process.env.POSTGRES_URL_NON_POOLING && process.env.POSTGRES_URL_NON_POOLING.trim()) {
    return { url: process.env.POSTGRES_URL_NON_POOLING.trim(), isConfigured: true, source: 'POSTGRES_URL_NON_POOLING' };
  }
  if (process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_PRISMA_URL.trim()) {
    return { url: process.env.POSTGRES_PRISMA_URL.trim(), isConfigured: true, source: 'POSTGRES_PRISMA_URL' };
  }
  if (process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_DATABASE) {
    const user = encodeURIComponent(process.env.POSTGRES_USER);
    const pass = process.env.POSTGRES_PASSWORD ? `:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}` : '';
    const host = process.env.POSTGRES_HOST;
    const db = process.env.POSTGRES_DATABASE;
    return {
      url: `postgresql://${user}${pass}@${host}/${db}?sslmode=require`,
      isConfigured: true,
      source: 'POSTGRES_HOST/USER/DATABASE',
    };
  }
  return {
    url: 'postgres://postgres:postgres@127.0.0.1:5432/xupply',
    isConfigured: false,
    source: 'default_localhost',
  };
}

const resolvedDb = resolveDatabaseUrl();
export const hasCustomDbUrl = resolvedDb.isConfigured;
export const databaseUrl = resolvedDb.url;

if (process.env.VERCEL === '1' && !hasCustomDbUrl) {
  console.warn(
    '[DB WARNING] Ni DATABASE_URL ni POSTGRES_URL fueron detectadas en Vercel. Ve a Vercel -> Settings -> Environment Variables y agrégala.'
  );
}

const requiresSsl =
  databaseUrl.includes('neon.tech') ||
  databaseUrl.includes('render.com') ||
  databaseUrl.includes('vercel-storage.com') ||
  databaseUrl.includes('supabase.co') ||
  databaseUrl.includes('sslmode=require') ||
  process.env.PGSSLMODE === 'require';

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]', (err as Error)?.message || err);
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export async function initDatabase() {
  try {
    if (process.env.VERCEL === '1' && !hasCustomDbUrl) {
      throw new Error(
        'DATABASE_URL no está configurada en las variables de entorno de Vercel. Agrega DATABASE_URL en Settings -> Environment Variables.'
      );
    }

    const res = await pool.query("SELECT to_regclass('public.users')");
    if (!res.rows[0]?.to_regclass) {
      console.log('[DB] Inicializando esquema de base de datos PostgreSQL...');
      const { schema, demo } = splitSchema();
      await pool.query(schema);
      if (shouldSeedDemoData() && demo) {
        await pool.query(demo);
        console.log('[DB] Esquema y datos de demostración creados exitosamente.');
        console.warn('[DB] ATENCIÓN: los usuarios demo usan contraseñas conocidas. No uses este modo en producción.');
      } else {
        console.log('[DB] Esquema creado sin datos de demostración (SEED_DEMO_DATA deshabilitado).');
      }
    } else {
      console.log('[DB] Tablas de base de datos verificadas.');
    }

    await ensureBootstrapAdmin();
  } catch (err) {
    console.error('[DB] Error verificando/inicializando base de datos:', err);
    throw err;
  }
}

/**
 * Hash bcrypt compartido por todos los usuarios demo del esquema original
 * (contraseña `demo1234`). No se usa para autenticar: solo para localizar
 * cuentas heredadas que siguen siendo vulnerables.
 */
const KNOWN_DEMO_HASH = '$2a$10$oeMFaVfquf/BWyFhkKmh.upF3lNucd/f8.jq4pajD5Sl10zCwwU.e';

/**
 * Neutraliza cuentas heredadas que todavía usan la contraseña demo conocida.
 * Se ejecuta solo cuando el sembrado demo está deshabilitado (producción).
 *
 * - Si el usuario coincide con `ADMIN_USERNAME` y hay `ADMIN_PASSWORD` válida,
 *   se rota su contraseña y se mantiene activo.
 * - Cualquier otra cuenta con ese hash se desactiva y se le asigna un hash
 *   aleatorio inutilizable, invalidando además sus tokens (`token_version`).
 */
export async function neutralizeDemoCredentials(): Promise<void> {
  if (shouldSeedDemoData()) return;
  try {
    const rows = await pool.query(
      'SELECT id, username FROM users WHERE password_hash = $1',
      [KNOWN_DEMO_HASH]
    );
    if (!rows.rowCount) return;

    const adminUsername = (process.env.ADMIN_USERNAME ?? '').trim();
    const adminPassword = process.env.ADMIN_PASSWORD ?? '';
    let rotated = 0;
    let blocked = 0;

    for (const row of rows.rows as Array<{ id: number; username: string }>) {
      if (adminUsername && row.username === adminUsername && adminPassword.length >= 12) {
        const hash = await bcrypt.hash(adminPassword, 12);
        await pool.query(
          `UPDATE users
              SET password_hash = $1,
                  is_active = TRUE,
                  token_version = COALESCE(token_version, 1) + 1
            WHERE id = $2`,
          [hash, row.id]
        );
        rotated += 1;
        continue;
      }
      const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
      await pool.query(
        `UPDATE users
            SET password_hash = $1,
                is_active = FALSE,
                token_version = COALESCE(token_version, 1) + 1
          WHERE id = $2`,
        [unusable, row.id]
      );
      blocked += 1;
    }

    if (rotated > 0) {
      console.warn(
        `[SECURITY] ${rotated} cuenta(s) demo actualizadas con ADMIN_PASSWORD (usuario: ${adminUsername}).`
      );
    }
    if (blocked > 0) {
      console.warn(
        `[SECURITY] ${blocked} cuenta(s) bloqueadas por usar la contraseña demo conocida. ` +
          'Define ADMIN_USERNAME/ADMIN_PASSWORD o restablece sus contraseñas desde el panel.'
      );
    }
  } catch (err) {
    console.error(
      '[SECURITY] No se pudieron neutralizar las credenciales demo:',
      (err as Error)?.message
    );
  }
}

/**
 * En despliegues sin datos demo no existe ningún usuario. Si se definen
 * ADMIN_USERNAME y ADMIN_PASSWORD, se crea el administrador inicial una sola
 * vez (idempotente). Nunca se crean credenciales por defecto.
 */
async function ensureBootstrapAdmin(): Promise<void> {
  if (shouldSeedDemoData()) return;
  const username = (process.env.ADMIN_USERNAME ?? '').trim();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!username || !password) {
    const anyUser = await pool.query('SELECT 1 FROM users LIMIT 1');
    if (!anyUser.rowCount) {
      console.warn(
        '[DB] No hay usuarios y ADMIN_USERNAME/ADMIN_PASSWORD no están definidos. ' +
          'Define ambas variables (contraseña de 12+ caracteres) para crear el administrador inicial.'
      );
    }
    return;
  }
  if (password.length < 12) {
    console.warn('[DB] ADMIN_PASSWORD debe tener al menos 12 caracteres. No se creó el administrador inicial.');
    return;
  }
  const role = await pool.query("SELECT id FROM roles WHERE name = 'admin'");
  if (!role.rowCount) {
    console.warn('[DB] El rol admin no existe todavía; no se creó el administrador inicial.');
    return;
  }
  const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (exists.rowCount) return;
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (username, password_hash, name, role_id)
     VALUES ($1, $2, 'Administrador', $3)`,
    [username, hash, role.rows[0].id]
  );
  console.log(`[DB] Administrador inicial creado: ${username}`);
}
