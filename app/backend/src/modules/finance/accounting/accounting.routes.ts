import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, create } from './accounting.controller';

const router = Router();
router.use(authRequired);

router.get('/', roleRequired('gerente', 'admin'), list);
router.post('/', roleRequired('gerente', 'admin'), create);

export default router;
