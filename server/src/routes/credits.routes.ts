import { Router } from 'express';
import { getCredits, getCreditSummary, getCreditById } from '../controllers/credits.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);
router.use(requireRole(Role.ADMIN));

router.get('/', getCredits);
router.get('/summary', getCreditSummary);
router.get('/:id', getCreditById);

export default router;
