"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = __importDefault(require("./app"));
exports.app = app_1.default;
const realtime_1 = require("./lib/realtime");
const migrations_1 = require("./lib/migrations");
const db_1 = require("./config/db");
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 4000;
const server = http_1.default.createServer(app_1.default);
exports.server = server;
const socketOrigins = (process.env.CLIENT_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => Boolean(origin) && origin !== '*');
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const io = new socket_io_1.Server(server, {
    // En producción, lista blanca estricta (fail-closed). Las apps nativas no
    // envían Origin y se permiten; los navegadores deben estar en CLIENT_ORIGIN.
    cors: {
        origin: (origin, cb) => {
            if (!origin)
                return cb(null, true);
            if (socketOrigins.includes(origin))
                return cb(null, true);
            return cb(null, !isProduction);
        },
        credentials: true,
    },
});
exports.io = io;
/**
 * Autenticación del handshake de Socket.IO.
 *
 * Antes cualquier cliente podía conectarse y unirse a las salas que quisiera
 * (incluida `admins`) enviando `role=admin` en la query, y por tanto recibir
 * pedidos, GPS y auditoría de toda la plataforma. Ahora la identidad SIEMPRE
 * sale del JWT y las salas se derivan de esa identidad, nunca del cliente.
 */
io.use(async (socket, next) => {
    try {
        const rawAuth = (socket.handshake.auth ?? {});
        const token = typeof rawAuth.token === 'string' && rawAuth.token
            ? rawAuth.token
            : String(socket.handshake.query.token ?? '');
        if (!token)
            return next(new Error('unauthorized'));
        const decoded = jsonwebtoken_1.default.verify(token, String(process.env.JWT_SECRET ?? ''), {
            algorithms: ['HS256'],
        });
        if (!decoded?.id)
            return next(new Error('unauthorized'));
        // Igual que authRequired: rol, inquilino y versión del token se leen de la
        // base de datos para que una sesión revocada no pueda seguir conectada.
        const check = await (0, db_1.query)(`SELECT u.username, u.name, u.is_active, u.token_version,
              u.role_id, r.name AS role, u.restaurant_id, u.supplier_id, u.branch_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`, [decoded.id]);
        const row = check.rows[0];
        if (!check.rowCount || !row.is_active)
            return next(new Error('unauthorized'));
        if (Number(decoded.token_version ?? -1) !== Number(row.token_version)) {
            return next(new Error('unauthorized'));
        }
        socket.data.user = {
            id: Number(decoded.id),
            username: row.username,
            name: row.name,
            role: row.role,
            role_id: Number(row.role_id),
            restaurant_id: row.restaurant_id === null ? null : Number(row.restaurant_id),
            supplier_id: row.supplier_id === null ? null : Number(row.supplier_id),
            branch_id: row.branch_id === null ? null : Number(row.branch_id),
            token_version: Number(row.token_version),
        };
        return next();
    }
    catch {
        return next(new Error('unauthorized'));
    }
});
io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) {
        socket.disconnect(true);
        return;
    }
    (0, realtime_1.registerSocket)(socket, user);
    (0, realtime_1.emitToUser)('notification:created', user.id, { message: 'Conexión en tiempo real establecida' });
});
(0, realtime_1.setIo)(io);
if (!process.env.VERCEL) {
    server.listen(PORT, '0.0.0.0', async () => {
        console.log(`Xupply API corriendo en http://0.0.0.0:${PORT}`);
        await (0, migrations_1.ensureServerInitialized)();
        // Limpieza horaria de alertas y ofertas vencidas del Radar
        setInterval(migrations_1.expireRadarItems, 60 * 60 * 1000);
    });
}
exports.default = app_1.default;
