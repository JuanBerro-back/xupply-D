import { Router } from 'express';
import { authRequired, roleRequired } from '../../shared/middleware/auth';
import { list, myDeliveries, live, vehicles, drivers, byId, create, assign, updateStatus, confirm, updatePosition, track, createVehicle, updateVehicle, updateVehicleGps } from './deliveries.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.get('/my-deliveries', roleRequired('domiciliario'), myDeliveries);
// Entregas activas en el mapa (flota del proveedor / seguimiento del restaurante)
router.get('/live', live);

// Las columnas de asignación de vehículos y las coordenadas reales se
// gestionan en lib/migrations.ts. No se mutan datos de demo en cada arranque.
router.get('/vehicles', roleRequired('proveedor_admin', 'admin', 'gerente'), vehicles);
router.get('/drivers', roleRequired('proveedor_admin', 'admin', 'gerente'), drivers);
router.get('/:id', byId);
router.post('/', roleRequired('proveedor_admin', 'admin', 'gerente'), create);
router.patch('/:id/assign', roleRequired('proveedor_admin', 'admin', 'gerente'), assign);
router.patch('/:id/status', updateStatus);
router.post('/:id/confirm', roleRequired('gerente', 'empleado', 'admin'), confirm);
router.patch('/:id/position', updatePosition);
// Seguimiento completo: posición actual + ETA + polilínea del recorrido
router.get('/:id/track', track);
router.post('/vehicles', roleRequired('proveedor_admin', 'admin'), createVehicle);
router.put('/vehicles/:id', roleRequired('proveedor_admin', 'admin'), updateVehicle);
router.patch('/vehicles/:id/gps', roleRequired('proveedor_admin', 'admin'), updateVehicleGps);

export default router;
