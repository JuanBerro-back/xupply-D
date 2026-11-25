import { Router } from 'express';
import { authRequired } from '../../../shared/middleware/auth';
import { summary, supplierListing } from './dashboard.controller';

const router = Router();
router.use(authRequired);

router.get('/summary', summary);
router.get('/supplier-listing', supplierListing);

export default router;
