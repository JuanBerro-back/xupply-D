import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { createDraft, list, byId } from './purchaseOrders.controller';

const router = Router();
router.use(authRequired);

router.post('/drafts', roleRequired('gerente', 'admin'), createDraft);
router.get('/', list);
router.get('/:id', byId);

export default router;
