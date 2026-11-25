import { Router } from 'express';
import { authRequired } from '../../../shared/middleware/auth';
import { listCategories } from './categories.controller';

const router = Router();
router.use(authRequired);

router.get('/', listCategories);

export default router;
