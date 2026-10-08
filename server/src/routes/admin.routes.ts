import { Router } from 'express';
import {
  getDashboard,
  getSalesReport,
  getUsers,
  createUser,
  updateUser,
  getAuditLog,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { Role } from '../types';

const router = Router();

router.use(authenticate);
router.use(requireRole(Role.ADMIN));

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/dashboard/sales-report', getSalesReport);

// Users
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);

// Audit log
router.get('/audit-log', getAuditLog);

// Notifications — read-all must come before /:id to avoid conflict
router.get('/notifications', getNotifications);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;
