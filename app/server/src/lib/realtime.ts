import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { AuthUser } from '../middleware/auth';
import { query } from '../config/db';

let io: SocketIOServer | null = null;

export function setIo(instance: SocketIOServer) {
  io = instance;
}

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
 * Registra un socket YA autenticado.
 *
 * La identidad llega desde el JWT (ver `server.ts`): NUNCA se aceptan
 * `role`/`restaurantId`/`userId` enviados por el cliente, porque permitían
 * unirse a la sala `admins` o a la de cualquier otro inquilino y recibir
 * pedidos, posiciones GPS y eventos de auditoría ajenos.
 */
export function registerSocket(socket: Socket, user: AuthUser) {
  socket.join(`user:${user.id}`);
  if (user.restaurant_id) socket.join(`restaurant:${user.restaurant_id}`);
  if (user.supplier_id) socket.join(`supplier:${user.supplier_id}`);
  if (user.role) socket.join(`role:${user.role}`);
  if (user.role === 'admin') socket.join('admins');

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
        io?.to(`delivery:${deliveryId}`).emit('delivery:position', payload);
        io?.to(`restaurant:${row.restaurant_id}`).emit('delivery:position', payload);
        if (row.supplier_id) io?.to(`supplier:${row.supplier_id}`).emit('delivery:position', payload);
      } catch {
        /* ignorar */
      }
    }
  );
}

export function emitAuditActivity(data: unknown) {
  if (!io) return;
  io.to('admins').emit('audit:new_entry', data);
  io.to('admins').emit('user:activity', data);
}

/**
 * Emite la posición GPS SOLO a las partes autorizadas de la entrega
 * (restaurante, proveedor y sala de seguimiento). Nunca broadcast global:
 * la posición del domiciliario no debe salir a todos los clientes conectados.
 */
export function emitDeliveryPosition(
  delivery: { id: number; restaurant_id: number; supplier_id?: number | null },
  data: unknown
) {
  if (!io) return;
  io.to(toRestaurantId(delivery.restaurant_id))
    .to(`delivery:${delivery.id}`)
    .emit('delivery:position', data);
  if (delivery.supplier_id) {
    io.to(toSupplierId(delivery.supplier_id)).emit('delivery:position', data);
  }
}

/** Estado/ETA de la entrega para las mismas partes autorizadas. */
export function emitDeliveryStatus(
  delivery: { id: number; restaurant_id: number; supplier_id?: number | null },
  data: unknown
) {
  if (!io) return;
  io.to(toRestaurantId(delivery.restaurant_id))
    .to(`delivery:${delivery.id}`)
    .emit('delivery:status', data);
  if (delivery.supplier_id) {
    io.to(toSupplierId(delivery.supplier_id)).emit('delivery:status', data);
  }
}

/** Notificación de oferta entrante del Radar de Stock. */
export function emitRadarAlert(supplierId: number, data: unknown) {
  if (!io) return;
  io.to(toSupplierId(supplierId)).emit('radar:alert', data);
}

export function emitRadarOffer(restaurantId: number, data: unknown) {
  if (!io) return;
  io.to(toRestaurantId(restaurantId)).emit('radar:offer', data);
}

function isOrderLike(data: unknown): data is {
  restaurant_id: number;
  supplier_id: number;
  id: number;
} {
  return (
    !!data &&
    typeof data === 'object' &&
    'restaurant_id' in data &&
    'supplier_id' in data &&
    'id' in data
  );
}

function toRestaurantId(id: number | null | undefined) {
  return `restaurant:${id}`;
}

function toSupplierId(id: number | null | undefined) {
  return `supplier:${id}`;
}

export function emitOrder(event: string, data: unknown) {
  if (!io) return;
  if (isOrderLike(data)) {
    io.to(toRestaurantId(data.restaurant_id)).emit(event, data);
    io.to(toSupplierId(data.supplier_id)).emit(event, data);
    io.to(`order:${data.id}`).emit(event, data);
  } else {
    // Nunca broadcast global de datos de pedidos sin inquilino identificable.
    io.to('admins').emit(event, data);
  }
}

export function emitToUser(event: string, userId: number, data: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToRole(role: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, data);
}

export function emitInventoryAlert(restaurantId: number, data: unknown) {
  if (!io) return;
  io.to(toRestaurantId(restaurantId)).emit('inventory:alert', data);
}
