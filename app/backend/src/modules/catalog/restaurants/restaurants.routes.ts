import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { list, mine, byId, updateMine, branches, createBranch } from './restaurants.controller';

const router = Router();
router.use(authRequired);

router.get('/', list);
router.get('/me', mine);
router.get('/:id', byId);
router.put('/me', roleRequired('gerente', 'admin'), updateMine);
router.get('/:id/branches', branches);
router.post('/branches', roleRequired('gerente', 'admin'), createBranch);

export default router;
