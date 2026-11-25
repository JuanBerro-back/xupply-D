import { Router } from 'express';
import { authRequired, roleRequired } from '../../../shared/middleware/auth';
import { loginLimiter, registerLimiter } from './auth.service';
import { register, login, me, roles, tenantInfo, subscriptionPlan, logout, changePassword, notifyMe } from './auth.controller';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', authRequired, me);
router.get('/roles', authRequired, roles);
router.get('/tenant-info', authRequired, tenantInfo);
router.post('/subscription-plan', authRequired, roleRequired('admin'), subscriptionPlan);
router.post('/logout', authRequired, logout);
router.post('/change-password', authRequired, changePassword);
router.post('/notify-me', authRequired, notifyMe);

export default router;
