import { io, Socket } from 'socket.io-client';
import { getToken, getApiOrigin } from './api';

let socket: Socket | null = null;

export function connectSocket(opts: {
  userId?: number | null;
  restaurantId?: number | null;
  supplierId?: number | null;
}): Socket {
  if (socket) return socket;
  const origin = getApiOrigin() || undefined;
  socket = io(origin, {
    auth: { token: getToken() },
    query: {
      ...(opts.userId ? { userId: String(opts.userId) } : {}),
      ...(opts.restaurantId ? { restaurantId: String(opts.restaurantId) } : {}),
      ...(opts.supplierId ? { supplierId: String(opts.supplierId) } : {}),
    },
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