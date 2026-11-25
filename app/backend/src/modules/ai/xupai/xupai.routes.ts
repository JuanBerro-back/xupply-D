import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { status, agent } from './xupai.controller';

const router = Router();
router.use(authRequired);

router.get('/status', roleRequired('gerente', 'proveedor_admin'), status);
router.post('/agent', roleRequired('gerente'), agent);

export default router;
