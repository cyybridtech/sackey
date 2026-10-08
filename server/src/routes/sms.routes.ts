import { Router } from 'express';
import { getSmsQueue, approveSms, rejectSms, approveBulkSms } from '../controllers/sms.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);
router.use(requireRole(Role.ADMIN));

router.get('/queue', getSmsQueue);
router.post('/approve-bulk', approveBulkSms);
router.post('/approve/:id', approveSms);
router.post('/reject/:id', rejectSms);

export default router;
