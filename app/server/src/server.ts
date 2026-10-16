import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from './app';
import { setIo, registerSocket, emitToUser } from './lib/realtime';
import { ensureServerInitialized, expireRadarItems } from './lib/migrations';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const server = http.createServer(app);
const socketOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const io = new Server(server, {
  // En producción, restringir a la lista blanca de CLIENT_ORIGIN.
  cors: { origin: socketOrigins.length === 0 ? true : socketOrigins, credentials: true },
});

io.on('connection', (socket) => {
  registerSocket(socket);
  const userId = Number(socket.handshake.query.userId);
  const role = String(socket.handshake.query.role || '');
  if (Number.isInteger(userId) && userId > 0) {
    socket.join(`user:${userId}`);
    emitToUser('notification:created', userId, { message: 'Conexión en tiempo real establecida' });
  }
  if (role === 'admin') {
    socket.join('admins');
    socket.join('role:admin');
  }
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