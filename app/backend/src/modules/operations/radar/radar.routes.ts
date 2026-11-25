import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { listShares, createShare, updateShare, myAlerts, alerts, createOffer, offers, acceptOffer, rejectOffer, closeAlert } from './radar.controller';

const router = Router();
router.use(authRequired);

router.get('/shares', roleRequired('gerente', 'admin'), listShares);
router.post('/shares', roleRequired('gerente', 'admin'), createShare);
router.patch('/shares/:id', roleRequired('gerente', 'admin'), updateShare);
router.get('/my-alerts', roleRequired('gerente', 'admin'), myAlerts);
router.get('/alerts', roleRequired('proveedor_admin'), alerts);
router.post('/alerts/:id/offers', roleRequired('proveedor_admin'), createOffer);
router.get('/offers', roleRequired('gerente', 'admin', 'empleado', 'proveedor_admin'), offers);
router.post('/offers/:id/accept', roleRequired('gerente', 'admin'), acceptOffer);
router.post('/offers/:id/reject', roleRequired('gerente', 'admin'), rejectOffer);
router.post('/alerts/:id/close', roleRequired('gerente', 'admin'), closeAlert);

export default router;
