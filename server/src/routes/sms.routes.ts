import { Router } from 'express';
import {
  getSmsQueue,
  approveSms,
  rejectSms,
  approveBulkSms,
  sendTestSms,
  updateSms,
  reverseSms,
  deleteSms,
} from '../controllers/sms.controller';
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
router.post('/reverse/:id', reverseSms);
router.put('/:id', updateSms);
router.delete('/:id', deleteSms);
router.post('/test', sendTestSms);

export default router;
