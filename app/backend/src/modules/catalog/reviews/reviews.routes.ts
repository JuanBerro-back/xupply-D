import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, create } from './reviews.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.post('/', roleRequired('gerente', 'empleado', 'admin'), create);

export default router;
