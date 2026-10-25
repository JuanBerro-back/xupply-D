import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import app from './app';
import { setIo, registerSocket, emitToUser } from './lib/realtime';
import { ensureServerInitialized, expireRadarItems } from './lib/migrations';
import { query } from './config/db';
import type { AuthUser } from './middleware/auth';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const server = http.createServer(app);
const socketOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => Boolean(origin) && origin !== '*');
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const io = new Server(server, {
  // En producción, lista blanca estricta (fail-closed). Las apps nativas no
  // envían Origin y se permiten; los navegadores deben estar en CLIENT_ORIGIN.
  cors: {
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void
    ) => {
      if (!origin) return cb(null, true);
      if (socketOrigins.includes(origin)) return cb(null, true);
      return cb(null, !isProduction);
    },
    credentials: true,
  },
});

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
    const rawAuth = (socket.handshake.auth ?? {}) as { token?: unknown };
    const token =
      typeof rawAuth.token === 'string' && rawAuth.token
        ? rawAuth.token
        : String(socket.handshake.query.token ?? '');
    if (!token) return next(new Error('unauthorized'));
    const decoded = jwt.verify(token, String(process.env.JWT_SECRET ?? ''), {
      algorithms: ['HS256'],
    }) as AuthUser;
    if (!decoded?.id) return next(new Error('unauthorized'));

    // Igual que authRequired: rol, inquilino y versión del token se leen de la
    // base de datos para que una sesión revocada no pueda seguir conectada.
    const check = await query(
      `SELECT u.username, u.name, u.is_active, u.token_version,
              u.role_id, r.name AS role, u.restaurant_id, u.supplier_id, u.branch_id
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1`,
      [decoded.id]
    );
    const row = check.rows[0];
    if (!check.rowCount || !row.is_active) return next(new Error('unauthorized'));
    if (Number(decoded.token_version ?? -1) !== Number(row.token_version)) {
      return next(new Error('unauthorized'));
    }

    (socket.data as { user?: AuthUser }).user = {
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
  } catch {
    return next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  const user = (socket.data as { user?: AuthUser }).user;
  if (!user) {
    socket.disconnect(true);
    return;
  }

  registerSocket(socket, user);

  emitToUser('notification:created', user.id, { message: 'Conexión en tiempo real establecida' });
});

setIo(io);

if (!process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Xupply API corriendo en http://0.0.0.0:${PORT}`);
    await ensureServerInitialized();
    // Limpieza horaria de alertas y ofertas vencidas del Radar
    setInterval(expireRadarItems, 60 * 60 * 1000);
  });
}

export default app;
export { app, server, io };
