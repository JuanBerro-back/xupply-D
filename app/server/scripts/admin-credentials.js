#!/usr/bin/env node
/**
 * Gestión de credenciales de plataforma (admin / verificador).
 *
 * Uso (desde app/server, con DATABASE_URL en el entorno o en .env):
 *
 *   npm run admin:credentials -- --list
 *   npm run admin:credentials -- --username=admin --generate --yes
 *   npm run admin:credentials -- --username=admin --password="..." --yes
 *   npm run admin:credentials -- --username=revisor --role=verificador --generate --yes
 *
 * No imprime hashes ni la contraseña introducida. Si se usa --generate,
 * muestra la contraseña UNA sola vez para que la guardes en tu gestor.
 */
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const args = process.argv.slice(2);
const flags = new Map();
for (const arg of args) {
  if (!arg.startsWith('--')) continue;
  const [key, ...rest] = arg.slice(2).split('=');
  flags.set(key, rest.length ? rest.join('=') : 'true');
}
const has = (name) => flags.has(name) && flags.get(name) !== 'false';
const value = (name, fallback = '') => (flags.has(name) ? flags.get(name) : fallback);

if (has('help') || has('h')) {
  console.log(`Uso:
  npm run admin:credentials -- --list
  npm run admin:credentials -- --username=admin --generate --yes
  npm run admin:credentials -- --username=admin --password="TuClaveLarga" --yes
  npm run admin:credentials -- --username=revisor --role=verificador --generate --yes

Opciones:
  --list                 Lista usuarios de plataforma (admin/verificador), sin hashes
  --username=<usuario>   Usuario a crear o actualizar
  --password=<clave>     Contraseña (mínimo 12 caracteres)
  --generate             Genera una contraseña aleatoria y la muestra una vez
  --role=<rol>           admin (por defecto) o verificador
  --email=<correo>       Correo opcional
  --yes                  Confirma la escritura en la base de datos

Requiere DATABASE_URL (o variables PG*) en el entorno o en app/server/.env.`);
  process.exit(0);
}

function connectionConfig() {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.error('[admin] Falta DATABASE_URL. Define la cadena de Neon/PostgreSQL en el entorno o en app/server/.env.');
    console.error('[admin] En Vercel está en Settings → Environment Variables → DATABASE_URL.');
    process.exit(1);
  }
  const needsSsl = /sslmode=require|neon\.tech|render\.com|supabase\.co/i.test(url);
  return { connectionString: url, ssl: needsSsl ? { rejectUnauthorized: false } : undefined };
}

function maskHost() {
  try {
    const parsed = new URL(process.env.DATABASE_URL);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return '(host no parseable)';
  }
}

function generatedPassword() {
  // 18 bytes -> ~24 caracteres base64url, suficiente entropía.
  return crypto.randomBytes(18).toString('base64url');
}

async function main() {
  const pool = new Pool(connectionConfig());
  const client = await pool.connect();
  try {
    const target = maskHost();
    if (has('list')) {
      const result = await client.query(
        `SELECT u.username, r.name AS role, u.is_active, u.restaurant_id, u.supplier_id, u.last_login
           FROM users u JOIN roles r ON r.id = u.role_id
          WHERE r.name IN ('admin', 'verificador')
          ORDER BY r.name, u.username`
      );
      console.log(`Usuarios de plataforma en ${target}:`);
      if (!result.rowCount) console.log('  (ninguno)');
      for (const row of result.rows) {
        console.log(
          `  ${row.username} | rol=${row.role} | activo=${row.is_active ? 'sí' : 'no'}` +
            (row.last_login ? ` | último login=${row.last_login.toISOString()}` : '')
        );
      }
      return;
    }

    const username = String(value('username')).trim().toLowerCase();
    const roleName = String(value('role', 'admin')).trim();
    const email = String(value('email')).trim() || null;
    const provided = String(value('password'));
    const generate = has('generate');

    if (!username) {
      console.error('[admin] Falta --username. Usa --list para ver los existentes.');
      process.exit(1);
    }
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      console.error('[admin] Usuario inválido: 3-40 caracteres, minúsculas, números, punto, guion o guion bajo.');
      process.exit(1);
    }
    if (!['admin', 'verificador'].includes(roleName)) {
      console.error('[admin] --role debe ser admin o verificador.');
      process.exit(1);
    }

    const password = generate ? generatedPassword() : provided;
    if (!password || password.length < 12) {
      console.error('[admin] La contraseña debe tener al menos 12 caracteres (o usa --generate).');
      process.exit(1);
    }
    if (!has('yes')) {
      console.error('[admin] Escritura no confirmada. Repite el comando con --yes.');
      console.error(`[admin] Se actualizaría/crearía "${username}" con rol ${roleName} en ${target}.`);
      process.exit(1);
    }

    const role = await client.query('SELECT id FROM roles WHERE name = $1', [roleName]);
    if (!role.rowCount) {
      console.error(`[admin] El rol "${roleName}" no existe. Aplica la migración/arranque del servidor primero.`);
      process.exit(1);
    }
    const roleId = role.rows[0].id;
    const hash = await bcrypt.hash(password, 12);

    const existing = await client.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rowCount) {
      await client.query(
        `UPDATE users
            SET password_hash = $1,
                role_id = $2,
                email = COALESCE($3, email),
                restaurant_id = NULL,
                supplier_id = NULL,
                branch_id = NULL,
                is_active = TRUE,
                token_version = COALESCE(token_version, 1) + 1,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $4`,
        [hash, roleId, email, existing.rows[0].id]
      );
      console.log(`[admin] Contraseña y rol actualizados para "${username}" (${roleName}) en ${target}.`);
    } else {
      await client.query(
        `INSERT INTO users (username, password_hash, name, email, phone, role_id, restaurant_id, supplier_id, branch_id, is_active)
         VALUES ($1, $2, $3, $4, NULL, $5, NULL, NULL, NULL, TRUE)`,
        [username, hash, username, email, roleId]
      );
      console.log(`[admin] Usuario "${username}" creado con rol ${roleName} en ${target}.`);
    }

    if (generate) {
      console.log('');
      console.log('  Contraseña generada (guárdala ahora, no se vuelve a mostrar):');
      console.log(`  ${password}`);
      console.log('');
    } else {
      console.log('[admin] Se usó la contraseña que proporcionaste (no se imprime).');
    }
    console.log('[admin] Las sesiones anteriores de ese usuario quedaron invalidadas.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[admin] Error:', err.message || err);
  process.exit(1);
});
