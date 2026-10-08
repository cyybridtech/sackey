import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDebt,
  recordPayment,
} from '../controllers/customers.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);

router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.get('/:id/debt', getCustomerDebt);

router.post('/', requireRole(Role.ADMIN, Role.WORKER_A), createCustomer);
router.put('/:id', requireRole(Role.ADMIN, Role.WORKER_A), updateCustomer);
router.delete('/:id', requireRole(Role.ADMIN), deleteCustomer);
router.post('/:id/payment', requireRole(Role.ADMIN, Role.WORKER_A), recordPayment);

export default router;
