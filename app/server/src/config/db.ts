import { Pool } from 'pg';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schemaSql';

dotenv.config();

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
      console.log('[DB] Inicializando esquema de base de datos PostgreSQL desde SCHEMA_SQL...');
      await pool.query(SCHEMA_SQL);
      console.log('[DB] Esquema y usuarios creados exitosamente.');
    } else {
      console.log('[DB] Tablas de base de datos verificadas.');
      // Make sure the admin user is a super admin
      try {
        await pool.query(
          `UPDATE users SET restaurant_id = NULL, branch_id = NULL, name = 'Super Administrador' WHERE username = 'admin' AND role_id = 1`
        );
        console.log('[DB] Admin user updated to Super Admin.');
      } catch (e) {
        console.error('[DB] Error updating admin user:', e);
      }
    }
  } catch (err) {
    console.error('[DB] Error verificando/inicializando base de datos:', err);
    throw err;
  }
}