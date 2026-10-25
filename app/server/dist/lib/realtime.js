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
const db_1 = require("../config/db");
let io = null;
function setIo(instance) {
    io = instance;
}
/** Comprueba que el usuario autenticado puede ver una entrega concreta. */
async function canAccessDelivery(user, deliveryId) {
    if (user.role === 'admin')
        return true;
    const res = await (0, db_1.query)(`SELECT d.restaurant_id, d.driver_id, o.supplier_id
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
      WHERE d.id = $1`, [deliveryId]);
    if (!res.rowCount)
        return false;
    const row = res.rows[0];
    if (user.restaurant_id && Number(row.restaurant_id) === Number(user.restaurant_id))
        return true;
    if (user.supplier_id && Number(row.supplier_id) === Number(user.supplier_id))
        return true;
    if (user.role === 'domiciliario' && Number(row.driver_id) === Number(user.id))
        return true;
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
function registerSocket(socket, user) {
    socket.join(`user:${user.id}`);
    if (user.restaurant_id)
        socket.join(`restaurant:${user.restaurant_id}`);
    if (user.supplier_id)
        socket.join(`supplier:${user.supplier_id}`);
    if (user.role)
        socket.join(`role:${user.role}`);
    if (user.role === 'admin')
        socket.join('admins');
    // El cliente solo puede pedir unirse a una entrega que le pertenezca.
    socket.on('delivery:join', async (id) => {
        const deliveryId = Number(id);
        if (!Number.isInteger(deliveryId) || deliveryId <= 0)
            return;
        try {
            if (await canAccessDelivery(user, deliveryId))
                socket.join(`delivery:${deliveryId}`);
        }
        catch {
            /* ignorar */
        }
    });
    socket.on('delivery:leave', (id) => {
        const deliveryId = Number(id);
        if (Number.isInteger(deliveryId))
            socket.leave(`delivery:${deliveryId}`);
    });
    // Solo el domiciliario asignado (o un admin) puede publicar su posición.
    socket.on('delivery:update_position', async (data) => {
        const deliveryId = Number(data?.deliveryId);
        if (!Number.isInteger(deliveryId) || deliveryId <= 0)
            return;
        try {
            const res = await (0, db_1.query)(`SELECT d.driver_id, d.restaurant_id, o.supplier_id
             FROM deliveries d
             JOIN orders o ON o.id = d.order_id
            WHERE d.id = $1`, [deliveryId]);
            if (!res.rowCount)
                return;
            const row = res.rows[0];
            const isAssignedDriver = Number(row.driver_id) === Number(user.id);
            if (!isAssignedDriver && user.role !== 'admin')
                return;
            const payload = { ...data, deliveryId };
            io?.to(`delivery:${deliveryId}`).emit('delivery:position', payload);
            io?.to(`restaurant:${row.restaurant_id}`).emit('delivery:position', payload);
            if (row.supplier_id)
                io?.to(`supplier:${row.supplier_id}`).emit('delivery:position', payload);
        }
        catch {
            /* ignorar */
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
        // Nunca broadcast global de datos de pedidos sin inquilino identificable.
        io.to('admins').emit(event, data);
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
