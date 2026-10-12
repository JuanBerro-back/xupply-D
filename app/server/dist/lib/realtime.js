"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setIo = setIo;
exports.registerSocket = registerSocket;
exports.emitAuditActivity = emitAuditActivity;
exports.emitDeliveryPosition = emitDeliveryPosition;
exports.emitDeliveryStatus = emitDeliveryStatus;
exports.emitRadarAlert = emitRadarAlert;
exports.emitRadarOffer = emitRadarOffer;
exports.emitOrder = emitOrder;
exports.emitToUser = emitToUser;
exports.emitToRole = emitToRole;
exports.emitInventoryAlert = emitInventoryAlert;
let io = null;
function setIo(instance) {
    io = instance;
}
function registerSocket(socket) {
    const { restaurantId, supplierId, orderId, deliveryId, userId, role } = socket.handshake.query;
    if (typeof restaurantId === 'string')
        socket.join(`restaurant:${restaurantId}`);
    if (typeof supplierId === 'string')
        socket.join(`supplier:${supplierId}`);
    if (typeof orderId === 'string')
        socket.join(`order:${orderId}`);
    if (typeof deliveryId === 'string')
        socket.join(`delivery:${deliveryId}`);
    if (typeof userId === 'string')
        socket.join(`user:${userId}`);
    if (typeof role === 'string')
        socket.join(`role:${role}`);
    if (role === 'admin')
        socket.join('admins');
    socket.on('client:identify', (data) => {
        if (data?.role === 'admin') {
            socket.join('admins');
            socket.join('role:admin');
        }
        if (data?.userId)
            socket.join(`user:${data.userId}`);
        if (data?.restaurantId)
            socket.join(`restaurant:${data.restaurantId}`);
        if (data?.supplierId)
            socket.join(`supplier:${data.supplierId}`);
    });
    // Permite al cliente unirse/salir de la sala de seguimiento de una entrega
    socket.on('delivery:join', (id) => {
        if (Number.isInteger(Number(id)))
            socket.join(`delivery:${Number(id)}`);
    });
    socket.on('delivery:leave', (id) => {
        socket.leave(`delivery:${Number(id)}`);
    });
    // Permite al repartidor actualizar su posición en vivo
    socket.on('delivery:update_position', (data) => {
        if (data && data.deliveryId) {
            // Retransmitimos la posición a todos los que estén suscritos a esta entrega (Restaurantes, Admins, etc.)
            socket.to(`delivery:${data.deliveryId}`).emit('delivery:position', data);
        }
    });
}
function emitAuditActivity(data) {
    if (!io)
        return;
    io.to('admins').emit('audit:new_entry', data);
    io.to('admins').emit('user:activity', data);
}
/**
 * Emite la posición GPS SOLO a las partes autorizadas de la entrega
 * (restaurante, proveedor y sala de seguimiento). Nunca broadcast global:
 * la posición del domiciliario no debe salir a todos los clientes conectados.
 */
function emitDeliveryPosition(delivery, data) {
    if (!io)
        return;
    io.to(toRestaurantId(delivery.restaurant_id))
        .to(`delivery:${delivery.id}`)
        .emit('delivery:position', data);
    if (delivery.supplier_id) {
        io.to(toSupplierId(delivery.supplier_id)).emit('delivery:position', data);
    }
}
/** Estado/ETA de la entrega para las mismas partes autorizadas. */
function emitDeliveryStatus(delivery, data) {
    if (!io)
        return;
    io.to(toRestaurantId(delivery.restaurant_id))
        .to(`delivery:${delivery.id}`)
        .emit('delivery:status', data);
    if (delivery.supplier_id) {
        io.to(toSupplierId(delivery.supplier_id)).emit('delivery:status', data);
    }
}
/** Notificación de oferta entrante del Radar de Stock. */
function emitRadarAlert(supplierId, data) {
    if (!io)
        return;
    io.to(toSupplierId(supplierId)).emit('radar:alert', data);
}
function emitRadarOffer(restaurantId, data) {
    if (!io)
        return;
    io.to(toRestaurantId(restaurantId)).emit('radar:offer', data);
}
function isOrderLike(data) {
    return (!!data &&
        typeof data === 'object' &&
        'restaurant_id' in data &&
        'supplier_id' in data &&
        'id' in data);
}
function toRestaurantId(id) {
    return `restaurant:${id}`;
}
function toSupplierId(id) {
    return `supplier:${id}`;
}
function emitOrder(event, data) {
    if (!io)
        return;
    if (isOrderLike(data)) {
        io.to(toRestaurantId(data.restaurant_id)).emit(event, data);
        io.to(toSupplierId(data.supplier_id)).emit(event, data);
        io.to(`order:${data.id}`).emit(event, data);
    }
    else {
        io.emit(event, data);
    }
}
function emitToUser(event, userId, data) {
    if (!io)
        return;
    io.to(`user:${userId}`).emit(event, data);
}
function emitToRole(role, event, data) {
    if (!io)
        return;
    io.to(`role:${role}`).emit(event, data);
}
function emitInventoryAlert(restaurantId, data) {
    if (!io)
        return;
    io.to(toRestaurantId(restaurantId)).emit('inventory:alert', data);
}
