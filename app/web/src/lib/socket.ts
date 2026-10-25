import { io, Socket } from 'socket.io-client';
import { getToken, getApiOrigin } from './api';

let socket: Socket | null = null;

/**
 * La identidad del socket se deriva EXCLUSIVAMENTE del JWT en el handshake.
 * El cliente ya no envía userId/role/tenant ni emite `client:identify`: esos
 * datos eran controlados por el navegador y permitían unirse a salas ajenas.
 */
export function connectSocket(_opts?: {
  userId?: number | null;
  role?: string | null;
  restaurantId?: number | null;
  supplierId?: number | null;
}): Socket {
  if (socket) {
    // Refrescar el token en cada reconexión (p. ej. tras renovar la sesión).
    socket.auth = { token: getToken() };
    if (!socket.connected) socket.connect();
    return socket;
  }
  const origin = getApiOrigin() || undefined;
  socket = io(origin, {
    auth: (cb) => cb({ token: getToken() }),
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
