"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = exports.databaseUrl = exports.hasCustomDbUrl = void 0;
exports.shouldSeedDemoData = shouldSeedDemoData;
exports.resolveDatabaseUrl = resolveDatabaseUrl;
exports.initDatabase = initDatabase;
exports.neutralizeDemoCredentials = neutralizeDemoCredentials;
const pg_1 = require("pg");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
const schemaSql_1 = require("./schemaSql");
dotenv_1.default.config();
/**
 * El esquema base incluye datos de referencia (roles, permisos) y, al final,
 * datos de demostración (restaurantes, proveedores, productos y usuarios con
 * contraseña conocida). En producción NO se siembran los datos demo salvo que
 * se habilite explícitamente SEED_DEMO_DATA=true.
 */
function splitSchema() {
    const demoStart = schemaSql_1.SCHEMA_SQL.indexOf('-- Restaurantes');
    const viewsStart = schemaSql_1.SCHEMA_SQL.indexOf('-- VISTAS');
    if (demoStart === -1 || viewsStart === -1 || viewsStart <= demoStart) {
        return { schema: schemaSql_1.SCHEMA_SQL, demo: '' };
    }
    return {
        schema: schemaSql_1.SCHEMA_SQL.slice(0, demoStart) + schemaSql_1.SCHEMA_SQL.slice(viewsStart),
        demo: schemaSql_1.SCHEMA_SQL.slice(demoStart, viewsStart),
    };
}
function shouldSeedDemoData() {
    const flag = (process.env.SEED_DEMO_DATA ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(flag))
        return true;
    if (['false', '0', 'no'].includes(flag))
        return false;
    return process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
}
function resolveDatabaseUrl() {
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
exports.hasCustomDbUrl = resolvedDb.isConfigured;
exports.databaseUrl = resolvedDb.url;
if (process.env.VERCEL === '1' && !exports.hasCustomDbUrl) {
    console.warn('[DB WARNING] Ni DATABASE_URL ni POSTGRES_URL fueron detectadas en Vercel. Ve a Vercel -> Settings -> Environment Variables y agrégala.');
}
const requiresSsl = exports.databaseUrl.includes('neon.tech') ||
    exports.databaseUrl.includes('render.com') ||
    exports.databaseUrl.includes('vercel-storage.com') ||
    exports.databaseUrl.includes('supabase.co') ||
    exports.databaseUrl.includes('sslmode=require') ||
    process.env.PGSSLMODE === 'require';
exports.pool = new pg_1.Pool({
    connectionString: exports.databaseUrl,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
});
exports.pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err?.message || err);
});
const query = (text, params) => exports.pool.query(text, params);
exports.query = query;
async function initDatabase() {
    try {
        if (process.env.VERCEL === '1' && !exports.hasCustomDbUrl) {
            throw new Error('DATABASE_URL no está configurada en las variables de entorno de Vercel. Agrega DATABASE_URL en Settings -> Environment Variables.');
        }
        const res = await exports.pool.query("SELECT to_regclass('public.users')");
        if (!res.rows[0]?.to_regclass) {
            console.log('[DB] Inicializando esquema de base de datos PostgreSQL...');
            const { schema, demo } = splitSchema();
            await exports.pool.query(schema);
            if (shouldSeedDemoData() && demo) {
                await exports.pool.query(demo);
                console.log('[DB] Esquema y datos de demostración creados exitosamente.');
                console.warn('[DB] ATENCIÓN: los usuarios demo usan contraseñas conocidas. No uses este modo en producción.');
            }
            else {
                console.log('[DB] Esquema creado sin datos de demostración (SEED_DEMO_DATA deshabilitado).');
            }
        }
        else {
            console.log('[DB] Tablas de base de datos verificadas.');
        }
        await ensureBootstrapAdmin();
    }
    catch (err) {
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
async function neutralizeDemoCredentials() {
    if (shouldSeedDemoData())
        return;
    try {
        const rows = await exports.pool.query('SELECT id, username FROM users WHERE password_hash = $1', [KNOWN_DEMO_HASH]);
        if (!rows.rowCount)
            return;
        const adminUsername = (process.env.ADMIN_USERNAME ?? '').trim();
        const adminPassword = process.env.ADMIN_PASSWORD ?? '';
        let rotated = 0;
        let blocked = 0;
        for (const row of rows.rows) {
            if (adminUsername && row.username === adminUsername && adminPassword.length >= 12) {
                const hash = await bcryptjs_1.default.hash(adminPassword, 12);
                await exports.pool.query(`UPDATE users
              SET password_hash = $1,
                  is_active = TRUE,
                  token_version = COALESCE(token_version, 1) + 1
            WHERE id = $2`, [hash, row.id]);
                rotated += 1;
                continue;
            }
            const unusable = await bcryptjs_1.default.hash(crypto_1.default.randomBytes(32).toString('hex'), 12);
            await exports.pool.query(`UPDATE users
            SET password_hash = $1,
                is_active = FALSE,
                token_version = COALESCE(token_version, 1) + 1
          WHERE id = $2`, [unusable, row.id]);
            blocked += 1;
        }
        if (rotated > 0) {
            console.warn(`[SECURITY] ${rotated} cuenta(s) demo actualizadas con ADMIN_PASSWORD (usuario: ${adminUsername}).`);
        }
        if (blocked > 0) {
            console.warn(`[SECURITY] ${blocked} cuenta(s) bloqueadas por usar la contraseña demo conocida. ` +
                'Define ADMIN_USERNAME/ADMIN_PASSWORD o restablece sus contraseñas desde el panel.');
        }
    }
    catch (err) {
        console.error('[SECURITY] No se pudieron neutralizar las credenciales demo:', err?.message);
    }
}
/**
 * En despliegues sin datos demo no existe ningún usuario. Si se definen
 * ADMIN_USERNAME y ADMIN_PASSWORD, se crea el administrador inicial una sola
 * vez (idempotente). Nunca se crean credenciales por defecto.
 */
async function ensureBootstrapAdmin() {
    if (shouldSeedDemoData())
        return;
    const username = (process.env.ADMIN_USERNAME ?? '').trim();
    const password = process.env.ADMIN_PASSWORD ?? '';
    if (!username || !password) {
        const anyUser = await exports.pool.query('SELECT 1 FROM users LIMIT 1');
        if (!anyUser.rowCount) {
            console.warn('[DB] No hay usuarios y ADMIN_USERNAME/ADMIN_PASSWORD no están definidos. ' +
                'Define ambas variables (contraseña de 12+ caracteres) para crear el administrador inicial.');
        }
        return;
    }
    if (password.length < 12) {
        console.warn('[DB] ADMIN_PASSWORD debe tener al menos 12 caracteres. No se creó el administrador inicial.');
        return;
    }
    const role = await exports.pool.query("SELECT id FROM roles WHERE name = 'admin'");
    if (!role.rowCount) {
        console.warn('[DB] El rol admin no existe todavía; no se creó el administrador inicial.');
        return;
    }
    const exists = await exports.pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rowCount)
        return;
    const hash = await bcryptjs_1.default.hash(password, 12);
    await exports.pool.query(`INSERT INTO users (username, password_hash, name, role_id)
     VALUES ($1, $2, 'Administrador', $3)`, [username, hash, role.rows[0].id]);
    console.log(`[DB] Administrador inicial creado: ${username}`);
}
