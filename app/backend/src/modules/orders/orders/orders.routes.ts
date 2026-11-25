import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, create, byId, updateStatus, history, notifyInventory } from './orders.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.post('/', roleRequired('gerente', 'empleado', 'admin'), create);
router.get('/:id', byId);
router.patch('/:id/status', roleRequired('admin', 'gerente', 'empleado', 'proveedor_admin'), updateStatus);
router.get('/:id/history', history);
router.get('/:id/notify-inventory', roleRequired('gerente', 'admin'), notifyInventory);

export default router;
