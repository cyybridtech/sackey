import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/audit.middleware';
import { createNotification } from '../helpers/notification.helper';
import { emitToAdmin } from '../services/socket.service';
import { Role } from '../types';
import path from 'path';

/**
 * GET /api/products
 * List all active products with optional filters.
 */
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, search, lowStock } = req.query;

    const where: any = { isActive: true };

    if (category) where.category = category as string;

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { brand: { contains: search as string } },
        { category: { contains: search as string } },
      ];
    }

    if (lowStock === 'true') {
      where.quantity = { lt: 10 };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const role = req.user?.role;
    const userId = req.user?.userId;

    if (role === Role.WORKER_A && userId) {
      // Worker A sees current confirmed stock. Stock quantity only deducts when Worker B confirms
      const workerAProducts = products.map((p) => ({
        ...p,
        quantity: p.quantity,
        confirmedStock: p.quantity,
      }));

      res.json({ success: true, data: workerAProducts });
      return;
    }

    if (role === Role.WORKER_B && userId) {
      // Worker B sees current warehouse stock
      const workerBProducts = products.map((p) => ({
        ...p,
        quantity: p.quantity,
        confirmedStock: p.quantity,
      }));

      res.json({ success: true, data: workerBProducts });
      return;
    }

    // For Admin: include pending BLUE and RED counts per product for complete visibility
    const pendingBlue = await prisma.sale.findMany({
      where: { status: 'BLUE', deletedAt: null },
      select: { saleItems: { select: { productId: true, quantity: true } } },
    });
    const pendingRed = await prisma.sale.findMany({
      where: { status: 'RED', deletedAt: null },
      select: { saleItems: { select: { productId: true, quantity: true } } },
    });

    const blueMap: Record<number, number> = {};
    for (const s of pendingBlue) {
      for (const item of s.saleItems) {
        blueMap[item.productId] = (blueMap[item.productId] || 0) + item.quantity;
      }
    }

    const redMap: Record<number, number> = {};
    for (const s of pendingRed) {
      for (const item of s.saleItems) {
        redMap[item.productId] = (redMap[item.productId] || 0) + item.quantity;
      }
    }

    const adminProducts = products.map((p) => {
      const pendingSalesQty = blueMap[p.id] || 0;
      const pendingDispatchQty = redMap[p.id] || 0;
      return {
        ...p,
        // BLUE sales have not reduced physical stock yet, so reserve them
        // from the sales-side availability. RED dispatches have already
        // reduced p.quantity when Worker B recorded the dispatch; subtracting
        // pendingDispatchQty here would count that stock twice.
        availableForSales: Math.max(0, p.quantity - pendingSalesQty),
        availableForDispatch: p.quantity,
        pendingSalesQty,
        pendingDispatchQty,
      };
    });

    res.json({ success: true, data: adminProducts });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/categories
 * Get all distinct categories.
 */
export const getCategories = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const categories = await prisma.product.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    res.json({ success: true, data: categories.map((c) => c.category) });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/:id
 * Get a single product by ID.
 */
export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product || !product.isActive) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products
 * Create a new product (with optional image upload).
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, brand, category, quantity, price, description } = req.body;

    if (!name || !category || !price) {
      res.status(400).json({ success: false, error: 'Name, category, and price are required' });
      return;
    }

    let imageUrl: string | undefined = req.body.imageUrl;
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      imageUrl = `data:${req.file.mimetype};base64,${base64}`;
    }

    const product = await prisma.product.create({
      data: {
        name,
        brand,
        category,
        quantity: parseInt(quantity) || 0,
        price: parseFloat(price),
        imageUrl,
        description,
      },
    });

    await createAuditLog(
      req.user!.userId,
      'CREATE_PRODUCT',
      'Product',
      product.id,
      null,
      product,
      req.ip
    );

    await createNotification(
      'PRODUCT_CREATED',
      `New product "${product.name}" added by ${req.user!.name}`,
      Role.ADMIN,
      undefined,
      'Product',
      product.id
    );

    emitToAdmin('product:created', product);

    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/products/:id
 * Update a product's details and optionally its image.
 */
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const { name, brand, category, quantity, price, description, imageUrl } = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (brand !== undefined) updateData.brand = brand;
    if (category !== undefined) updateData.category = category;
    if (quantity !== undefined) updateData.quantity = parseInt(quantity);
    if (price !== undefined) updateData.price = parseFloat(price);
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      updateData.imageUrl = `data:${req.file.mimetype};base64,${base64}`;
    }

    const updated = await prisma.product.update({ where: { id }, data: updateData });

    await createAuditLog(
      req.user!.userId,
      'UPDATE_PRODUCT',
      'Product',
      id,
      existing,
      updated,
      req.ip
    );

    res.json({ success: true, data: updated, message: 'Product updated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/products/:id
 * Soft-delete a product (set isActive = false).
 */
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    await prisma.product.update({ where: { id }, data: { isActive: false } });

    await createAuditLog(
      req.user!.userId,
      'DELETE_PRODUCT',
      'Product',
      id,
      existing,
      null,
      req.ip
    );

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/:id/restock
 * Add quantity to an existing product's stock.
 */
export const restockProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const { quantity } = req.body;

    if (!quantity || parseInt(quantity) <= 0) {
      res.status(400).json({ success: false, error: 'A positive quantity is required' });
      return;
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing || !existing.isActive) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const addQty = parseInt(quantity);
    const { notes } = req.body;
    const isWorker = req.user!.role === Role.WORKER_A || req.user!.role === Role.WORKER_B;
    const roleLabel = req.user!.role === Role.WORKER_A ? 'Sales Desk' : req.user!.role === Role.WORKER_B ? 'Dispatch' : 'Admin';

    if (isWorker) {
      // Worker submits restock request — requires admin confirmation before stock becomes valid
      const request = await prisma.restockRequest.create({
        data: {
          productId: id,
          workerId: req.user!.userId,
          quantity: addQty,
          notes: notes || null,
          status: 'PENDING',
        },
        include: {
          product: true,
          worker: { select: { id: true, name: true, role: true } },
        },
      });

      await createAuditLog(
        req.user!.userId,
        'REQUEST_RESTOCK',
        'Product',
        id,
        { currentStock: existing.quantity },
        { requestedQuantity: addQty, notes },
        req.ip
      );

      await createNotification(
        'RESTOCK_REVIEW_REQUIRED',
        `⚠️ [Restock Pending Review] ${roleLabel} (${req.user!.name}) submitted a restock of +${addQty} units for "${existing.name}". Please review and confirm to apply.`,
        Role.ADMIN,
        undefined,
        'Product',
        id
      );

      emitToAdmin('restock:requested', request);

      res.status(202).json({
        success: true,
        pendingApproval: true,
        data: request,
        message: `Restock request of ${addQty} units submitted. Admin review and confirmation is required before inventory updates.`,
      });
      return;
    }

    // Admin direct restock: immediate inventory update
    const updated = await prisma.product.update({
      where: { id },
      data: { quantity: { increment: addQty } },
    });

    await createAuditLog(
      req.user!.userId,
      'RESTOCK_PRODUCT',
      'Product',
      id,
      { quantity: existing.quantity },
      { quantity: updated.quantity, notes },
      req.ip
    );

    await createNotification(
      'PRODUCT_RESTOCKED',
      `Admin (${req.user!.name}) restocked ${addQty} units of "${updated.name}" (Stock now: ${updated.quantity})${notes ? ` — Note: ${notes}` : ''}`,
      Role.ADMIN,
      undefined,
      'Product',
      id
    );

    emitToAdmin('product:restocked', { ...updated, restockedBy: req.user!.name, role: req.user!.role, addQty, notes });

    res.json({ success: true, data: updated, message: `Restocked ${addQty} units successfully` });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/products/restock-requests
 * Admin or Worker: Get all restock requests.
 */
export const getRestockRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statusParam = req.query.status as string | undefined;
    const where: any = {};
    if (statusParam && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusParam)) {
      where.status = statusParam;
    }

    const requests = await prisma.restockRequest.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, category: true, quantity: true, price: true } },
        worker: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/restock-requests/:id/approve
 * Admin: Review and confirm a worker's restock request, applying the inventory addition.
 */
export const approveRestockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const request = await prisma.restockRequest.findUnique({
      where: { id },
      include: { product: true, worker: true },
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Restock request not found' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, error: `This restock request is already ${request.status.toLowerCase()}` });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark request as APPROVED
      const approved = await tx.restockRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: req.user!.userId,
          reviewedAt: new Date(),
        },
        include: {
          product: true,
          worker: { select: { id: true, name: true, role: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      });

      // 2. Increment product inventory
      const updatedProduct = await tx.product.update({
        where: { id: request.productId },
        data: { quantity: { increment: request.quantity } },
      });

      return { approved, updatedProduct };
    });

    await createAuditLog(
      req.user!.userId,
      'APPROVE_RESTOCK',
      'Product',
      request.productId,
      { previousStock: request.product.quantity },
      { addedQuantity: request.quantity, newStock: result.updatedProduct.quantity },
      req.ip
    );

    // Notify worker
    await createNotification(
      'RESTOCK_APPROVED',
      `Admin approved your restock of +${request.quantity} units for "${request.product.name}". Inventory now updated.`,
      request.worker.role as Role,
      request.workerId,
      'Product',
      request.productId
    );

    emitToAdmin('product:restocked', { ...result.updatedProduct, restockedBy: request.worker.name, addQty: request.quantity });

    res.json({
      success: true,
      data: result,
      message: `Restock confirmed! +${request.quantity} units added to "${request.product.name}".`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/products/restock-requests/:id/reject
 * Admin: Reject a worker's restock request.
 */
export const rejectRestockRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const request = await prisma.restockRequest.findUnique({
      where: { id },
      include: { product: true, worker: true },
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Restock request not found' });
      return;
    }

    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, error: `This restock request is already ${request.status.toLowerCase()}` });
      return;
    }

    const rejected = await prisma.restockRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById: req.user!.userId,
        reviewedAt: new Date(),
      },
      include: {
        product: true,
        worker: { select: { id: true, name: true, role: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    await createAuditLog(
      req.user!.userId,
      'REJECT_RESTOCK',
      'Product',
      request.productId,
      null,
      { rejectedQuantity: request.quantity },
      req.ip
    );

    await createNotification(
      'RESTOCK_REJECTED',
      `Admin reviewed and rejected the restock request of +${request.quantity} units for "${request.product.name}".`,
      request.worker.role as Role,
      request.workerId,
      'Product',
      request.productId
    );

    res.json({
      success: true,
      data: rejected,
      message: `Restock request for "${request.product.name}" rejected.`,
    });
  } catch (err) {
    next(err);
  }
};
