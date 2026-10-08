import { Router } from 'express';
import {
  workerASale,
  workerBSale,
  getSales,
  getSaleById,
  getMySales,
  updateSale,
  verifySale,
  deleteSale,
} from '../controllers/sales.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);

// Worker routes — must come before /:id to avoid conflict
router.post('/worker-a', requireRole(Role.WORKER_A), workerASale);
router.post('/worker-b', requireRole(Role.WORKER_B), workerBSale);
router.get('/my-sales', requireRole(Role.WORKER_A, Role.WORKER_B), getMySales);
router.delete('/:id', requireRole(Role.ADMIN, Role.WORKER_A, Role.WORKER_B), deleteSale);

// Admin routes
router.get('/', requireRole(Role.ADMIN), getSales);
router.get('/:id', requireRole(Role.ADMIN), getSaleById);
router.put('/:id', requireRole(Role.ADMIN), updateSale);
router.post('/:id/verify', requireRole(Role.ADMIN), verifySale);

export default router;
