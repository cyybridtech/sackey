import { Router } from 'express';
import {
  workerASale,
  workerBSale,
  getSales,
  getSaleById,
  getMySales,
  updateSale,
  verifySale,
  unverifySale,
  deleteSale,
  restoreSale,
  permanentDeleteSale,
} from '../controllers/sales.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);

// Worker routes
router.post(
  '/worker-a',
  requireRole(Role.WORKER_A),
  workerASale
);

router.post(
  '/worker-b',
  requireRole(Role.WORKER_B),
  workerBSale
);

// Workers can view their own sales
router.get(
  '/my-sales',
  requireRole(Role.WORKER_A, Role.WORKER_B),
  getMySales
);

// Workers can delete their own sale records
router.delete(
  '/:id',
  requireRole(Role.ADMIN, Role.WORKER_A, Role.WORKER_B),
  deleteSale
);

// Admin routes
router.get(
  '/',
  requireRole(Role.ADMIN),
  getSales
);

router.get(
  '/:id',
  requireRole(Role.ADMIN),
  getSaleById
);

// Admins and workers can edit sales
router.put(
  '/:id',
  requireRole(Role.ADMIN, Role.WORKER_A, Role.WORKER_B),
  updateSale
);

// Verification remains admin-only
router.post(
  '/:id/verify',
  requireRole(Role.ADMIN),
  verifySale
);

router.post(
  '/:id/unverify',
  requireRole(Role.ADMIN),
  unverifySale
);

// Restore remains admin-only
router.post(
  '/:id/restore',
  requireRole(Role.ADMIN),
  restoreSale
);

// Permanent deletion remains admin-only
router.delete(
  '/:id/permanent',
  requireRole(Role.ADMIN),
  permanentDeleteSale
);

export default router;
