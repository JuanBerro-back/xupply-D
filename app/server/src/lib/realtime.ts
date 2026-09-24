import type { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export function setIo(instance: SocketIOServer) {
  io = instance;
}

export function registerSocket(socket: Socket) {
  const { restaurantId, supplierId, orderId, deliveryId, userId } = socket.handshake.query;
  if (typeof restaurantId === 'string') socket.join(`restaurant:${restaurantId}`);
  if (typeof supplierId === 'string') socket.join(`supplier:${supplierId}`);
  if (typeof orderId === 'string') socket.join(`order:${orderId}`);
  if (typeof deliveryId === 'string') socket.join(`delivery:${deliveryId}`);
  if (typeof userId === 'string') socket.join(`user:${userId}`);

  // Permite al cliente unirse/salir de la sala de seguimiento de una entrega
  socket.on('delivery:join', (id: unknown) => {
    if (Number.isInteger(Number(id))) socket.join(`delivery:${Number(id)}`);
  });
  socket.on('delivery:leave', (id: unknown) => {
    socket.leave(`delivery:${Number(id)}`);
  });
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
    io.emit(event, data);
  }
}

export function emitToUser(event: string, userId: number, data: unknown) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

export function emitInventoryAlert(restaurantId: number, data: unknown) {
  if (!io) return;
  io.to(toRestaurantId(restaurantId)).emit('inventory:alert', data);
}