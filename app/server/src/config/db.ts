import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/xupply';

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined,
});

import path from 'path';
import fs from 'fs';

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export async function initDatabase() {
  try {
    const res = await pool.query("SELECT to_regclass('public.users')");
    if (!res.rows[0]?.to_regclass) {
      console.log('[DB] Inicializando esquema de base de datos PostgreSQL...');
      const candidates = [
        path.join(__dirname, '..', '..', 'DB', 'xupply_schema_postgresql.sql'),
        path.join(__dirname, '..', 'DB', 'xupply_schema_postgresql.sql'),
        path.join(process.cwd(), 'server', 'DB', 'xupply_schema_postgresql.sql'),
        path.join(process.cwd(), 'DB', 'xupply_schema_postgresql.sql'),
      ];
      const sqlPath = candidates.find((p) => fs.existsSync(p));
      if (sqlPath) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        console.log('[DB] Esquema y usuarios creados exitosamente.');
      } else {
        console.warn('[DB] No se encontró el archivo xupply_schema_postgresql.sql');
      }
    } else {
      console.log('[DB] Tablas de base de datos verificadas.');
    }
  } catch (err) {
    console.error('[DB] Error verificando/inicializando base de datos:', err);
  }
}