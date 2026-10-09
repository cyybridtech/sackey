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

    res.json({ success: true, data: products });
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
    const updated = await prisma.product.update({
      where: { id },
      data: { quantity: { increment: addQty } },
    });

    const isWorker = req.user!.role === Role.WORKER_A || req.user!.role === Role.WORKER_B;
    const roleLabel = req.user!.role === Role.WORKER_A ? 'Worker A (Sales)' : req.user!.role === Role.WORKER_B ? 'Worker B (Dispatch)' : 'Admin';

    await createAuditLog(
      req.user!.userId,
      isWorker ? 'WORKER_RESTOCK' : 'RESTOCK_PRODUCT',
      'Product',
      id,
      { quantity: existing.quantity },
      { quantity: updated.quantity, notes },
      req.ip
    );

    await createNotification(
      isWorker ? 'WORKER_RESTOCK_ALERT' : 'PRODUCT_RESTOCKED',
      `${isWorker ? '⚠️ [Worker Restock] ' : ''}${roleLabel} (${req.user!.name}) restocked ${addQty} units of "${updated.name}" (Stock now: ${updated.quantity})${notes ? ` — Note: ${notes}` : ''}`,
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
