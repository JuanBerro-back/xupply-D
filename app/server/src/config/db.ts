import { Pool } from 'pg';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schemaSql';

dotenv.config();

const hasCustomDbUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
const databaseUrl = hasCustomDbUrl
  ? process.env.DATABASE_URL!.trim()
  : 'postgres://postgres:postgres@127.0.0.1:5432/xupply';

if (process.env.VERCEL === '1' && !hasCustomDbUrl) {
  console.warn(
    '[DB WARNING] DATABASE_URL no detectada en Vercel. Ve a Vercel -> Settings -> Environment Variables y agrégala con la conexión de Neon.'
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