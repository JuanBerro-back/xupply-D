import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, mine, updateMine, byId } from './suppliers.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.get('/me', mine);
router.put('/me', roleRequired('proveedor_admin', 'admin'), updateMine);
router.get('/:id', byId);

export default router;
