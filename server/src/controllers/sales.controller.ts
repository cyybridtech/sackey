import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/audit.middleware';
import { createNotification } from '../helpers/notification.helper';
import { emitToAdmin, emitToRole } from '../services/socket.service';
import { Role, SaleStatus, PaymentMode, SaleType, CreditStatus } from '../types';
import { Prisma } from '@prisma/client';
import { workerASaleSchema, workerBSaleSchema } from '../schemas/sales.schema';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaleItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  size?: string;
  colour?: string;
}

interface WorkerSaleData {
  customerId: number;
  paymentMode: PaymentMode;
  saleType: SaleType;
  items: SaleItemInput[];
  discountAmount?: number;
  notes?: string;
}

interface SaleMatchData {
  customerId: number;
  saleType: SaleType;
  items: Array<Pick<SaleItemInput, 'productId' | 'quantity' | 'size' | 'colour'>>;
}

interface DispatchSaleData extends SaleMatchData {}

const dispatchSnapshotToJson = (data: DispatchSaleData): Prisma.InputJsonObject => ({
  customerId: data.customerId,
  saleType: data.saleType,
  items: data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    ...(item.size ? { size: item.size } : {}),
    ...(item.colour ? { colour: item.colour } : {}),
  })),
});

const saleSnapshotToJson = (data: WorkerSaleData): Prisma.InputJsonObject => ({
  customerId: data.customerId,
  paymentMode: data.paymentMode,
  saleType: data.saleType,
  items: data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    ...(item.size ? { size: item.size } : {}),
    ...(item.colour ? { colour: item.colour } : {}),
  })),
  ...(data.discountAmount !== undefined ? { discountAmount: data.discountAmount } : {}),
  ...(data.notes !== undefined ? { notes: data.notes } : {}),
});

class SaleConflictError extends Error {
  readonly statusCode = 409;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compare item arrays order-independently, ignoring price since Dispatch does not enter prices.
 */
const itemsMatch = (
  itemsA: SaleMatchData['items'],
  itemsB: SaleMatchData['items']
): boolean => {
  if (itemsA.length !== itemsB.length) return false;

  const normalize = (items: SaleMatchData['items']) =>
    items
      .map((i) => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity),
        size: i.size || '',
        colour: i.colour || '',
      }))
      .sort((a, b) =>
        a.productId - b.productId ||
        a.size.localeCompare(b.size) ||
        a.colour.localeCompare(b.colour) ||
        a.quantity - b.quantity
      );

  const normA = normalize(itemsA);
  const normB = normalize(itemsB);

  return normA.every(
    (a, idx) =>
      a.productId === normB[idx].productId &&
      a.quantity === normB[idx].quantity &&
      a.size === normB[idx].size &&
      a.colour === normB[idx].colour
  );
};

/**
 * A pair is valid only if customer, issue type, product variants, and quantities agree.
 */
export const saleMatchesHelper = (
  dataA: SaleMatchData,
  dataB: SaleMatchData
): boolean => {
  if (dataA.customerId !== dataB.customerId) return false;
  if (dataA.saleType !== dataB.saleType) return false;
  return itemsMatch(dataA.items, dataB.items);
};

export const choosePendingSaleHelper = <T>(
  candidates: T[],
  matches: (candidate: T) => boolean
): T | undefined => {
  const matchingCandidates = candidates.filter(matches);
  return matchingCandidates.length === 1 ? matchingCandidates[0] : undefined;
};

export const initialSaleStatusHelper = (
  enteredByWorkerA: boolean
): SaleStatus => enteredByWorkerA ? SaleStatus.BLUE : SaleStatus.RED;

/** Derive the automatic list-price discount and final total in cents. */
const computeTotals = (
  items: SaleItemInput[],
  products: { id: number; price: Prisma.Decimal }[]
) => {
  let originalTotalCents = 0;
  let subtotalCents = 0;
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Product ${item.productId} not found`);
    const catalogPrice = Number(product.price.toString());
    if (!Number.isFinite(catalogPrice) || !Number.isFinite(item.unitPrice)) {
      throw new SaleConflictError(`A valid price is unavailable for product ${item.productId}`);
    }
    originalTotalCents += Math.round(catalogPrice * 100) * item.quantity;
    subtotalCents += Math.round(item.unitPrice * 100) * item.quantity;
  }
  const discountCents = Math.max(0, originalTotalCents - subtotalCents);
  return {
    originalTotal: originalTotalCents / 100,
    subtotal: subtotalCents / 100,
    discountAmount: discountCents / 100,
    finalTotal: subtotalCents / 100,
  };
};

const nestedSaleItemData = (
  items: SaleItemInput[],
  products: { id: number; price: Prisma.Decimal }[],
  originalPriceSnapshots?: Map<number, Prisma.Decimal>
) => toSaleItemData(items, products, originalPriceSnapshots).map(({ productId, ...item }) => ({
  ...item,
  product: { connect: { id: productId } },
}));

const toSaleItemData = (
  items: SaleItemInput[],
  products: { id: number; price: Prisma.Decimal }[],
  originalPriceSnapshots?: Map<number, Prisma.Decimal>
) => items.map((item) => {
  const product = products.find((p) => p.id === item.productId);
  if (!product) throw new Error(`Product ${item.productId} not found`);
  const unitPriceCents = Math.round(item.unitPrice * 100);
  return {
    productId: item.productId,
    size: item.size,
    colour: item.colour,
    quantity: item.quantity,
    originalPrice: originalPriceSnapshots?.get(item.productId) || product.price,
    unitPrice: unitPriceCents / 100,
    subtotal: unitPriceCents * item.quantity / 100,
  };
});

/**
 * Deduct stock for each item. Runs inside a transaction.
 * Throws if stock would go negative.
 */
const deductStock = async (
  tx: Prisma.TransactionClient,
  items: SaleItemInput[]
): Promise<void> => {
  const quantities = new Map<number, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }

  for (const [productId, quantity] of [...quantities].sort(([idA], [idB]) => idA - idB)) {
    const result = await tx.product.updateMany({
      where: { id: productId, isActive: true, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (result.count === 0) {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) {
        throw new SaleConflictError(`Product ${productId} is no longer available`);
      }
      throw new SaleConflictError(
        `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${quantity}`
      );
    }
  }
};

const replaceSaleItems = async (
  tx: Prisma.TransactionClient,
  saleId: number,
  items: SaleItemInput[],
  products: { id: number; price: Prisma.Decimal }[],
  originalPriceSnapshots?: Map<number, Prisma.Decimal>
): Promise<void> => {
  await tx.saleItem.deleteMany({ where: { saleId } });
  await tx.saleItem.createMany({
    data: toSaleItemData(items, products, originalPriceSnapshots).map((item) => ({ ...item, saleId })),
  });
};

/**
 * Create or accumulate a credit ledger entry for CREDIT sales.
 */
const handleCreditLedger = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  saleId: number,
  finalTotal: number
): Promise<void> => {
  await tx.creditLedger.create({
    data: {
      customerId,
      saleId,
      totalAmount: finalTotal,
      amountPaid: 0,
      balance: finalTotal,
      status: CreditStatus.OUTSTANDING,
    },
  });
};

/** Queue a sale-confirmation SMS as part of the sale transaction. */
const queueSaleSms = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  saleId: number,
  customerName: string,
  finalTotal: number,
  paymentMode: PaymentMode
): Promise<void> => {
  const modeText = paymentMode === PaymentMode.CC ? 'Cash/Card' : 'Credit';
  const message = `Dear ${customerName}, your sale (ID: ${saleId}) of GH₵ ${finalTotal.toFixed(2)} via ${modeText} has been confirmed. Thank you!`;
  await tx.smsQueue.create({ data: { customerId, saleId, message } });
};

// Full sale relations for response
const saleInclude = {
  customer: true,
  workerA: { select: { id: true, name: true, role: true } },
  workerB: { select: { id: true, name: true, role: true } },
  deletedBy: { select: { id: true, name: true, role: true } },
  saleItems: { include: { product: true } },
};

const emitSaleChanged = (sale: unknown): void => {
  emitToAdmin('sale:status-changed', sale);
  emitToRole(Role.WORKER_A, 'sale:status-changed', sale);
  emitToRole(Role.WORKER_B, 'sale:status-changed', sale);
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/sales/worker-a
 * Worker A creates a sale. Implements the dual-confirmation logic.
 */
export const workerASale = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = workerASaleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid sale data' });
      return;
    }

    const { customerId, paymentMode, saleType, items, notes } = parsed.data;
    const workerAId = req.user!.userId;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, price: true },
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ success: false, error: 'One or more products not found or inactive' });
      return;
    }

    const saleItems = items.map((item) => ({ ...item, unitPrice: item.unitPrice }));
    const { originalTotal, discountAmount, finalTotal } = computeTotals(saleItems, products);

    const workerAData: WorkerSaleData = {
      customerId,
      paymentMode,
      saleType,
      items: saleItems,
      discountAmount,
      notes,
    };

    // Check for a pending RED sale (Worker B's entry) for the same customer
    const pendingRedSales = await prisma.sale.findMany({
      where: {
        customerId,
        saleType,
        OR: [
          { status: SaleStatus.RED },
          { status: SaleStatus.FLAGGED },
        ],
        workerBId: { not: null },
        workerAId: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    const pendingRedSale = choosePendingSaleHelper(
      pendingRedSales,
      (sale) =>
        Boolean(
          sale.workerBData &&
          saleMatchesHelper(workerAData, sale.workerBData as unknown as WorkerSaleData)
        )
    );
    if (pendingRedSale) {
      const redData = pendingRedSale.workerBData as unknown as WorkerSaleData;
      const isMatch = pendingRedSale.workerBData !== null &&
        saleMatchesHelper(workerAData, redData);

      if (isMatch) {
        // GREEN — update, deduct stock, handle credit
        const greenSale = await prisma.$transaction(async (tx) => {
          const claimed = await tx.sale.updateMany({
            where: {
              id: pendingRedSale.id,
              status: pendingRedSale.status,
              workerAId: null,
            },
            data: {
              workerAId,
              status: SaleStatus.GREEN,
              workerAData: saleSnapshotToJson(workerAData),
              paymentMode,
              saleType,
              discountAmount,
              originalTotal,
              finalTotal,
              notes,
            },
          });
          if (claimed.count !== 1) {
            throw new SaleConflictError('This sale has already been confirmed by another request');
          }

          if (!pendingRedSale.stockDeducted) {
            await deductStock(tx, saleItems);
            await tx.sale.update({
              where: { id: pendingRedSale.id },
              data: { stockDeducted: true },
            });
          }
          await replaceSaleItems(tx, pendingRedSale.id, saleItems, products);

          const updated = await tx.sale.findUnique({
            where: { id: pendingRedSale.id },
            include: saleInclude,
          });
          if (!updated) throw new Error('Confirmed sale could not be loaded');

          if (paymentMode === PaymentMode.CREDIT) {
            await handleCreditLedger(tx, customerId, updated.id, finalTotal);
          }
          if (customer.phone) {
            await queueSaleSms(tx, customerId, updated.id, customer.name, finalTotal, paymentMode);
          }

          return updated;
        });

        await createNotification(
          'SALE_GREEN',
          `Sale #${greenSale.id} confirmed GREEN by both workers`,
          Role.ADMIN,
          undefined,
          'Sale',
          greenSale.id
        );
        emitSaleChanged(greenSale);

        await createAuditLog(workerAId, 'SALE_GREEN', 'Sale', greenSale.id, null, greenSale, req.ip);

        res.status(201).json({
          success: true,
          data: { ...greenSale, status: undefined },
          message: 'Sale confirmed successfully',
        });
      } else {
        // FLAGGED — mismatch
        const claimed = await prisma.sale.updateMany({
          where: {
            id: pendingRedSale.id,
            status: pendingRedSale.status,
            workerAId: null,
          },
          data: {
            workerAId,
            status: SaleStatus.FLAGGED,
            workerAData: saleSnapshotToJson(workerAData),
          },
        });
        if (claimed.count !== 1) {
          throw new SaleConflictError('This sale has already been confirmed by another request');
        }
        const flaggedSale = await prisma.sale.findUniqueOrThrow({
          where: { id: pendingRedSale.id },
          include: saleInclude,
        });

        await createNotification(
          'SALE_FLAGGED',
          `Sale #${flaggedSale.id} flagged — Worker A and B entries do not match`,
          Role.ADMIN,
          undefined,
          'Sale',
          flaggedSale.id
        );
        emitSaleChanged(flaggedSale);
        await createAuditLog(workerAId, 'SALE_FLAGGED', 'Sale', flaggedSale.id, null, flaggedSale, req.ip);

        res.status(201).json({
          success: true,
          data: { ...flaggedSale, status: undefined },
          message: 'Sale submitted. Pending verification.',
        });
      }
    } else {
      // A one-sided credit sale is exposed as flagged until the other worker confirms it.
      const initialStatus = initialSaleStatusHelper(true);
      const newSale = await prisma.$transaction(async (tx) => {
        await deductStock(tx, saleItems);
        return tx.sale.create({
          data: {
            customerId,
            workerAId,
            status: initialStatus,
            stockDeducted: true,
            paymentMode,
            saleType,
            originalTotal,
            discountAmount,
            finalTotal,
            notes,
            workerAData: saleSnapshotToJson(workerAData),
            saleItems: { create: nestedSaleItemData(saleItems, products) },
          },
          include: saleInclude,
        });
      });

      await createNotification(
        'SALE_PENDING',
        `Sales entry #${newSale.id} — awaiting Dispatch confirmation`,
        Role.ADMIN,
        undefined,
        'Sale',
        newSale.id
      );
      emitSaleChanged(newSale);
      await createAuditLog(
        workerAId,
        'CREATE_SALE',
        'Sale',
        newSale.id,
        null,
        newSale,
        req.ip
      );

      res.status(201).json({
        success: true,
        data: { ...newSale, status: undefined },
        message: 'Sales entry recorded. Awaiting Dispatch confirmation.',
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sales/worker-b
 * Worker B creates a sale. Implements the dual-confirmation logic.
 */
export const workerBSale = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsed = workerBSaleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid sale data' });
      return;
    }

    const { customerId, saleType, items } = parsed.data;
    const workerBId = req.user!.userId;

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, price: true },
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ success: false, error: 'One or more products not found or inactive' });
      return;
    }

    const saleItems = items.map((item) => ({
      ...item,
      unitPrice: Number(products.find((product) => product.id === item.productId)!.price.toString()),
    }));
    const { originalTotal, discountAmount, finalTotal } = computeTotals(saleItems, products);

    const workerBData: DispatchSaleData = {
      customerId,
      saleType,
      items,
    };

    // Check for a pending BLUE sale (Worker A's entry) for the same customer
    const pendingBlueSales = await prisma.sale.findMany({
      where: {
        customerId,
        saleType,
        OR: [
          { status: SaleStatus.BLUE },
          { status: SaleStatus.FLAGGED },
        ],
        workerAId: { not: null },
        workerBId: null,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    const pendingBlueSale = choosePendingSaleHelper(
      pendingBlueSales,
      (sale) =>
        Boolean(
          sale.workerAData &&
          saleMatchesHelper(workerBData, sale.workerAData as unknown as WorkerSaleData)
        )
    );

    if (pendingBlueSale) {
      const blueData: WorkerSaleData = pendingBlueSale.workerAData as unknown as WorkerSaleData;
      const isMatch = pendingBlueSale.workerAData !== null &&
        saleMatchesHelper(workerBData, blueData);

      if (isMatch) {
        // GREEN
        const greenFinal = Number(pendingBlueSale.finalTotal.toString());

        const greenSale = await prisma.$transaction(async (tx) => {
          const claimed = await tx.sale.updateMany({
            where: {
              id: pendingBlueSale.id,
              status: pendingBlueSale.status,
              workerBId: null,
            },
            data: {
              workerBId,
              status: SaleStatus.GREEN,
              workerBData: dispatchSnapshotToJson(workerBData),
            },
          });
          if (claimed.count !== 1) {
            throw new SaleConflictError('This sale has already been confirmed by another request');
          }

          if (!pendingBlueSale.stockDeducted) {
            await deductStock(tx, blueData.items);
            await tx.sale.update({
              where: { id: pendingBlueSale.id },
              data: { stockDeducted: true },
            });
          }

          const updated = await tx.sale.findUnique({
            where: { id: pendingBlueSale.id },
            include: saleInclude,
          });
          if (!updated) throw new Error('Confirmed sale could not be loaded');

          if (blueData.paymentMode === PaymentMode.CREDIT) {
            await handleCreditLedger(tx, customerId, updated.id, greenFinal);
          }
          if (customer.phone) {
            await queueSaleSms(
              tx,
              customerId,
              updated.id,
              customer.name,
              greenFinal,
              blueData.paymentMode
            );
          }

          return updated;
        });

        await createNotification(
          'SALE_GREEN',
          `Sale #${greenSale.id} confirmed GREEN by both workers`,
          Role.ADMIN,
          undefined,
          'Sale',
          greenSale.id
        );
        emitSaleChanged(greenSale);
        await createAuditLog(workerBId, 'SALE_GREEN', 'Sale', greenSale.id, null, greenSale, req.ip);

        res.status(201).json({
          success: true,
          data: { ...greenSale, status: undefined },
          message: 'Sale confirmed successfully',
        });
      } else {
        // FLAGGED
        const claimed = await prisma.sale.updateMany({
          where: {
            id: pendingBlueSale.id,
            status: pendingBlueSale.status,
            workerBId: null,
          },
          data: {
            workerBId,
            status: SaleStatus.FLAGGED,
            workerBData: dispatchSnapshotToJson(workerBData),
          },
        });
        if (claimed.count !== 1) {
          throw new SaleConflictError('This sale has already been confirmed by another request');
        }
        const flaggedSale = await prisma.sale.findUniqueOrThrow({
          where: { id: pendingBlueSale.id },
          include: saleInclude,
        });

        await createNotification(
          'SALE_FLAGGED',
          `Sale #${flaggedSale.id} flagged — Worker A and B entries do not match`,
          Role.ADMIN,
          undefined,
          'Sale',
          flaggedSale.id
        );
        emitSaleChanged(flaggedSale);
        await createAuditLog(workerBId, 'SALE_FLAGGED', 'Sale', flaggedSale.id, null, flaggedSale, req.ip);

        res.status(201).json({
          success: true,
          data: { ...flaggedSale, status: undefined },
          message: 'Sale submitted. Pending verification.',
        });
      }
    } else {
      // A dispatch-only entry is exposed as flagged until the sales desk confirms it.
      const initialStatus = initialSaleStatusHelper(false);
      const newSale = await prisma.$transaction(async (tx) => {
        await deductStock(tx, saleItems);
        return tx.sale.create({
          data: {
            customerId,
            workerBId,
            status: initialStatus,
            stockDeducted: true,
            paymentMode: PaymentMode.CC,
            saleType,
            originalTotal,
            discountAmount,
            finalTotal,
            workerBData: dispatchSnapshotToJson(workerBData),
            saleItems: { create: nestedSaleItemData(saleItems, products) },
          },
          include: saleInclude,
        });
      });

      await createNotification(
        'SALE_PENDING',
        `Dispatch #${newSale.id} — awaiting Sales Desk confirmation`,
        Role.ADMIN,
        undefined,
        'Sale',
        newSale.id
      );
      emitSaleChanged(newSale);
      await createAuditLog(
        workerBId,
        'CREATE_SALE',
        'Sale',
        newSale.id,
        null,
        newSale,
        req.ip
      );

      res.status(201).json({
        success: true,
        data: { ...newSale, status: undefined },
        message: 'Dispatch recorded. Awaiting Sales Desk confirmation.',
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/sales
 * Admin: list all sales with filters.
 */
export const getSales = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, dateFrom, dateTo, customerId, paymentMode, deleted } = req.query;

    const where: any = { deletedAt: deleted === 'true' ? { not: null } : null };
    if (status) where.status = status as string;
    if (customerId) where.customerId = parseInt(customerId as string);
    if (paymentMode) where.paymentMode = paymentMode as string;
    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) where.saleDate.gte = new Date(dateFrom as string);
      if (dateTo) where.saleDate.lte = new Date(dateTo as string);
    }

    const sales = await prisma.sale.findMany({
      where,
      include: saleInclude,
      orderBy: { saleDate: 'desc' },
    });

    res.json({ success: true, data: sales });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/sales/:id
 * Admin: full sale details.
 */
export const getSaleById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        ...saleInclude,
        creditLedger: { include: { payments: true } },
        smsQueue: true,
      },
    });

    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found' });
      return;
    }

    res.json({ success: true, data: sale });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/sales/my-sales
 * Worker: view their own sales without color status.
 */
export const getMySales = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    const where: any =
      role === Role.WORKER_A
        ? { workerAId: userId, deletedAt: null }
        : { workerBId: userId, deletedAt: null };

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        saleItems: { include: { product: true } },
      },
      orderBy: { saleDate: 'desc' },
    });

    // Map status to worker-visible labels (no color status)
    const mapped = sales.map((sale) => {
      let displayStatus: string;
      switch (sale.status) {
        case SaleStatus.GREEN:
          displayStatus = 'confirmed';
          break;
        case SaleStatus.FLAGGED:
          displayStatus = sale.workerAId && sale.workerBId ? 'flagged' : 'awaiting_partner';
          break;
        default:
          displayStatus = 'pending';
      }
      return { ...sale, status: displayStatus };
    });

    res.json({ success: true, data: mapped });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/sales/:id
 * Admin: edit sale details.
 */
export const updateSale = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ success: false, error: 'A valid sale ID is required' });
      return;
    }
    const existing = await prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: true,
        creditLedger: true,
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Sale not found' });
      return;
    }
    if (existing.deletedAt) {
      res.status(409).json({ success: false, error: 'Deleted sales cannot be edited' });
      return;
    }

    const { notes, discountAmount, saleType } = req.body;
    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;
    const hasFinancialEdit = saleType !== undefined || discountAmount !== undefined;
    if (hasFinancialEdit && existing.status !== SaleStatus.GREEN) {
      res.status(409).json({
        success: false,
        error: 'Only confirmed sales can have financial details edited',
      });
      return;
    }
    if (saleType !== undefined) {
      if (saleType !== SaleType.RETAIL && saleType !== SaleType.WHOLESALE) {
        res.status(400).json({ success: false, error: 'Sale type must be RETAIL or WHOLESALE' });
        return;
      }
      updateData.saleType = saleType;
    }
    let updatedFinalTotal: number | undefined;
    if (discountAmount !== undefined) {
      const discount = Number(discountAmount);
      if (!Number.isFinite(discount) || discount < 0) {
        res.status(400).json({ success: false, error: 'Discount must be a non-negative amount' });
        return;
      }

      const subtotalCents = existing.saleItems.reduce(
        (sum, item) => sum + Math.round(Number(item.subtotal.toString()) * 100),
        0
      );
      const discountCents = Math.round(discount * 100);
      if (discountCents > subtotalCents) {
        res.status(400).json({ success: false, error: 'Discount cannot exceed the sale subtotal' });
        return;
      }
      updatedFinalTotal = (subtotalCents - discountCents) / 100;
      updateData.discountAmount = discountCents / 100;
      updateData.finalTotal = updatedFinalTotal;
    }

    if (
      updatedFinalTotal !== undefined &&
      existing.creditLedger &&
      Math.round(updatedFinalTotal * 100) <
        Math.round(Number(existing.creditLedger.amountPaid.toString()) * 100)
    ) {
      res.status(409).json({
        success: false,
        error: 'The adjusted sale total cannot be less than payments already recorded',
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (updatedFinalTotal !== undefined && existing.creditLedger) {
        const paidCents = Math.round(Number(existing.creditLedger.amountPaid.toString()) * 100);
        const balanceCents = Math.round(updatedFinalTotal * 100) - paidCents;
        const ledgerStatus = balanceCents === 0
          ? CreditStatus.PAID
          : paidCents > 0
            ? CreditStatus.PARTIAL
            : CreditStatus.OUTSTANDING;
        const ledgerUpdate = await tx.creditLedger.updateMany({
          where: {
            id: existing.creditLedger.id,
            amountPaid: existing.creditLedger.amountPaid,
            balance: existing.creditLedger.balance,
          },
          data: {
            totalAmount: updatedFinalTotal,
            balance: balanceCents / 100,
            status: ledgerStatus,
          },
        });
        if (ledgerUpdate.count !== 1) {
          throw new SaleConflictError('Credit balance changed while updating the sale. Refresh and try again.');
        }
      }

      return tx.sale.update({ where: { id }, data: updateData, include: saleInclude });
    });

    await createAuditLog(
      req.user!.userId,
      'UPDATE_SALE',
      'Sale',
      id,
      existing,
      updated,
      req.ip
    );

    res.json({ success: true, data: updated, message: 'Sale updated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/sales/:id
 * Soft-delete a sale record while retaining its complete details for admin review.
 */
export const deleteSale = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ success: false, error: 'A valid sale ID is required' });
      return;
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        saleItems: true,
        creditLedger: { include: { payments: true } },
      },
    });
    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found' });
      return;
    }
    if (sale.deletedAt) {
      res.status(409).json({ success: false, error: 'This sale has already been deleted' });
      return;
    }

    const actor = req.user!;
    if (
      actor.role === Role.WORKER_A && sale.workerAId !== actor.userId ||
      actor.role === Role.WORKER_B && sale.workerBId !== actor.userId
    ) {
      res.status(403).json({ success: false, error: 'You can only delete records you entered' });
      return;
    }
    if (sale.creditLedger?.payments.length) {
      res.status(409).json({
        success: false,
        error: 'This credit sale has recorded payments and cannot be deleted. Ask an admin to reconcile the balance.',
      });
      return;
    }

    const deletedAt = new Date();
    const entryKind = sale.workerBId && !sale.workerAId
      ? 'Dispatch'
      : sale.workerAId && !sale.workerBId
        ? 'Sales'
        : 'Sale';
    const notificationMessage = `${entryKind} #${id} deleted by ${actor.role === Role.WORKER_A ? 'Sales Desk' : actor.role === Role.WORKER_B ? 'Dispatch' : 'Admin'} (${actor.name})`;
    const { deletedSale, notification } = await prisma.$transaction(async (tx) => {
      const claimed = await tx.sale.updateMany({
        where: { id, deletedAt: null },
        data: {
          deletedAt,
          deletedById: actor.userId,
          deletedByRole: actor.role,
        },
      });
      if (claimed.count !== 1) {
        throw new SaleConflictError('This sale has already been deleted');
      }

      if (sale.stockDeducted) {
        for (const item of sale.saleItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }
      if (sale.creditLedger) {
        await tx.creditLedger.delete({ where: { id: sale.creditLedger.id } });
      }
      await tx.smsQueue.updateMany({
        where: { saleId: id, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });

      const deletedSale = await tx.sale.findUniqueOrThrow({
        where: { id },
        include: saleInclude,
      });
      const notification = await tx.notification.create({
        data: {
          type: 'SALE_DELETED',
          message: notificationMessage,
          targetRole: Role.ADMIN,
          relatedEntity: 'Sale',
          relatedId: id,
        },
      });
      return {
        deletedSale,
        notification,
      };
    });

    emitToAdmin('notification:new', notification);
    emitSaleChanged(deletedSale);
    await createAuditLog(actor.userId, 'DELETE_SALE', 'Sale', id, sale, deletedSale, req.ip);

    res.json({ success: true, data: deletedSale, message: 'Sale deleted and retained for admin review' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sales/:id/verify
 * Admin: mark a sale as admin-verified.
 */
export const verifySale = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const sale = await prisma.sale.findUnique({ where: { id } });

    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found' });
      return;
    }
    if (sale.status !== SaleStatus.GREEN) {
      res.status(409).json({
        success: false,
        error: 'Only sales confirmed by both workers can be verified',
      });
      return;
    }

    const verified = await prisma.sale.update({
      where: { id },
      data: { adminVerified: true },
      include: saleInclude,
    });

    emitToAdmin('sale:verified', verified);
    await createAuditLog(req.user!.userId, 'VERIFY_SALE', 'Sale', id, null, verified, req.ip);

    res.json({ success: true, data: verified, message: 'Sale verified by admin' });
  } catch (err) {
    next(err);
  }
};
