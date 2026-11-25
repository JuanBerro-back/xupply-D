import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, byId, create, update, remove } from './products.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.get('/:id', byId);
router.post('/', roleRequired('proveedor_admin', 'admin'), create);
router.put('/:id', roleRequired('proveedor_admin', 'admin'), update);
router.delete('/:id', roleRequired('proveedor_admin', 'admin'), remove);

export default router;
