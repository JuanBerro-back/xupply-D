import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { AuthUser } from '../../shared/middleware/auth';
import { query } from '../../shared/config/db';

/** Comprueba que el usuario autenticado puede ver una entrega concreta. */
async function canAccessDelivery(user: AuthUser, deliveryId: number): Promise<boolean> {
  if (user.role === 'admin') return true;
  const res = await query(
    `SELECT d.restaurant_id, d.driver_id, o.supplier_id
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
      WHERE d.id = $1`,
    [deliveryId]
  );
  if (!res.rowCount) return false;
  const row = res.rows[0];
  if (user.restaurant_id && Number(row.restaurant_id) === Number(user.restaurant_id)) return true;
  if (user.supplier_id && Number(row.supplier_id) === Number(user.supplier_id)) return true;
  if (user.role === 'domiciliario' && Number(row.driver_id) === Number(user.id)) return true;
  return false;
}

/**
 * Registra los listeners de entregas de un socket YA autenticado.
 * Se llama justo después de `registerSocket`, que asigna las salas derivadas
 * del JWT (ver `server.ts`).
 */
export function registerDeliverySocket(socket: Socket, user: AuthUser, io: SocketIOServer) {
  // El cliente solo puede pedir unirse a una entrega que le pertenezca.
  socket.on('delivery:join', async (id: unknown) => {
    const deliveryId = Number(id);
    if (!Number.isInteger(deliveryId) || deliveryId <= 0) return;
    try {
      if (await canAccessDelivery(user, deliveryId)) socket.join(`delivery:${deliveryId}`);
    } catch {
      /* ignorar */
    }
  });

  socket.on('delivery:leave', (id: unknown) => {
    const deliveryId = Number(id);
    if (Number.isInteger(deliveryId)) socket.leave(`delivery:${deliveryId}`);
  });

  // Solo el domiciliario asignado (o un admin) puede publicar su posición.
  socket.on(
    'delivery:update_position',
    async (data: { deliveryId?: number; lat?: number; lng?: number; speed?: number | null }) => {
      const deliveryId = Number(data?.deliveryId);
      if (!Number.isInteger(deliveryId) || deliveryId <= 0) return;
      try {
        const res = await query(
          `SELECT d.driver_id, d.restaurant_id, o.supplier_id
             FROM deliveries d
             JOIN orders o ON o.id = d.order_id
            WHERE d.id = $1`,
          [deliveryId]
        );
        if (!res.rowCount) return;
        const row = res.rows[0];
        const isAssignedDriver = Number(row.driver_id) === Number(user.id);
        if (!isAssignedDriver && user.role !== 'admin') return;
        const payload = { ...data, deliveryId };
        io.to(`delivery:${deliveryId}`).emit('delivery:position', payload);
        io.to(`restaurant:${row.restaurant_id}`).emit('delivery:position', payload);
        if (row.supplier_id) io.to(`supplier:${row.supplier_id}`).emit('delivery:position', payload);
      } catch {
        /* ignorar */
      }
    }
  );
}
