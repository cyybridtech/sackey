import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
  getCategories,
  getRestockRequests,
  approveRestockRequest,
  rejectRestockRequest,
} from '../controllers/products.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { uploadProductImage } from '../middleware/upload.middleware';
import { Role } from '../types';

const router = Router();

// All product routes require authentication
router.use(authenticate);

router.get('/categories', getCategories);
router.get('/restock-requests', getRestockRequests);
router.post('/restock-requests/:id/approve', requireRole(Role.ADMIN), approveRestockRequest);
router.post('/restock-requests/:id/reject', requireRole(Role.ADMIN), rejectRestockRequest);

router.get('/', getProducts);
router.get('/:id', getProductById);

router.post(
  '/',
  requireRole(Role.ADMIN, Role.WORKER_A),
  uploadProductImage,
  createProduct
);

router.put(
  '/:id',
  requireRole(Role.ADMIN, Role.WORKER_A),
  uploadProductImage,
  updateProduct
);

router.delete('/:id', requireRole(Role.ADMIN), deleteProduct);

router.post('/:id/restock', requireRole(Role.ADMIN, Role.WORKER_A), restockProduct);

export default router;
