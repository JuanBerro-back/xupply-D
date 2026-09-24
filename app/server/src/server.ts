import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { createApp } from './app';
import { setIo, registerSocket, emitToUser } from './lib/realtime';
import { ensureRadarAndGpsSchema, expireRadarItems } from './lib/migrations';

import { initDatabase } from './config/db';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const app = createApp();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

io.on('connection', (socket) => {
  registerSocket(socket);
  const userId = Number(socket.handshake.query.userId);
  if (Number.isInteger(userId) && userId > 0) {
    socket.join(`user:${userId}`);
    emitToUser('notification:created', userId, { message: 'Conexión en tiempo real establecida' });
  }
});

setIo(io);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Xupply API corriendo en http://0.0.0.0:${PORT}`);
  await initDatabase();
  await ensureRadarAndGpsSchema();
  await expireRadarItems();
  // Limpieza horaria de alertas y ofertas vencidas del Radar
  setInterval(expireRadarItems, 60 * 60 * 1000);
});