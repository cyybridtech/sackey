import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  restockProduct,
  getCategories,
} from '../controllers/products.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roles.middleware';
import { uploadProductImage } from '../middleware/upload.middleware';
import { Role } from '../types';

const router = Router();

// All product routes require authentication
router.use(authenticate);

router.get('/categories', getCategories);
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
