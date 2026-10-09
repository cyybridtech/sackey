import { Router } from 'express';
import { login, getMe, changePassword, setupCredentials } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);
router.post('/setup-credentials', authenticate, setupCredentials);

export default router;
