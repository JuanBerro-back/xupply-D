"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.server = exports.app = void 0;
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const app_1 = __importDefault(require("./app"));
exports.app = app_1.default;
const realtime_1 = require("./lib/realtime");
const migrations_1 = require("./lib/migrations");
dotenv_1.default.config();
const PORT = Number(process.env.PORT) || 4000;
const server = http_1.default.createServer(app_1.default);
exports.server = server;
const io = new socket_io_1.Server(server, {
    cors: { origin: true, credentials: true },
});
exports.io = io;
io.on('connection', (socket) => {
    (0, realtime_1.registerSocket)(socket);
    const userId = Number(socket.handshake.query.userId);
    const role = String(socket.handshake.query.role || '');
    if (Number.isInteger(userId) && userId > 0) {
        socket.join(`user:${userId}`);
        (0, realtime_1.emitToUser)('notification:created', userId, { message: 'Conexión en tiempo real establecida' });
    }
    if (role === 'admin') {
        socket.join('admins');
        socket.join('role:admin');
    }
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
