import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, byId, create, updateStatus } from './invoices.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.get('/:id', byId);
router.post('/', roleRequired('gerente', 'admin'), create);
router.patch('/:id/status', roleRequired('gerente', 'admin'), updateStatus);

export default router;
