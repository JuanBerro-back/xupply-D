import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { chat, predictInventory, report } from './ai.controller';

const router = Router();
router.use(authRequired);

router.post('/chat', roleRequired('gerente', 'proveedor_admin'), chat);
router.post('/predict-inventory', roleRequired('gerente', 'admin'), predictInventory);
router.post('/report', roleRequired('gerente', 'admin'), report);

export default router;
