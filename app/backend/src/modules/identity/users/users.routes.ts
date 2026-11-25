import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, create, update, activateUser, deactivateUser, changePassword } from './users.controller';

const router = Router();
router.use(authRequired);

router.get('/', roleRequired('admin', 'gerente', 'proveedor_admin'), list);
router.post('/', roleRequired('admin', 'gerente', 'proveedor_admin'), create);
router.put('/:id', roleRequired('admin', 'gerente', 'proveedor_admin'), update);
router.patch('/:id/activate', roleRequired('admin', 'gerente', 'proveedor_admin'), activateUser);
router.patch('/:id/deactivate', roleRequired('admin', 'gerente', 'proveedor_admin'), deactivateUser);
router.patch('/:id/password', roleRequired('admin', 'gerente', 'proveedor_admin'), changePassword);

export default router;
