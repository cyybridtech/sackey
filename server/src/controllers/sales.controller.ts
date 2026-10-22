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
}

interface WorkerSaleData {
  customerId: number;
  paymentMode: PaymentMode;
  saleType: SaleType;
  items: SaleItemInput[];
  discountAmount?: number;
  amountPaid?: number;
  notes?: string;
}

interface SaleMatchData {
  customerId: number;
  paymentMode: PaymentMode;
  saleType: SaleType;
  items: Array<Pick<SaleItemInput, 'productId' | 'quantity'>>;
}

interface DispatchSaleData extends SaleMatchData {
  notes?: string;
}

const dispatchSnapshotToJson = (data: DispatchSaleData): Prisma.InputJsonObject => ({
  customerId: data.customerId,
  paymentMode: data.paymentMode,
  saleType: data.saleType,
  items: data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
  })),
  ...(data.notes !== undefined ? { notes: data.notes } : {}),
});

const saleSnapshotToJson = (data: WorkerSaleData): Prisma.InputJsonObject => ({
  customerId: data.customerId,
  paymentMode: data.paymentMode,
  saleType: data.saleType,
  items: data.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })),
  ...(data.discountAmount !== undefined ? { discountAmount: data.discountAmount } : {}),
  ...(data.amountPaid !== undefined ? { amountPaid: data.amountPaid } : {}),
  ...(data.notes !== undefined ? { notes: data.notes } : {}),
});

class SaleConflictError extends Error {
  readonly statusCode = 409;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compare item arrays order-independently (productId + quantity).
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
      }))
      .sort((a, b) => a.productId - b.productId || a.quantity - b.quantity);

  const normA = normalize(itemsA);
  const normB = normalize(itemsB);

  return normA.every(
    (a, idx) =>
      a.productId === normB[idx].productId &&
      a.quantity === normB[idx].quantity
  );
};

/**
 * A pair is valid only if customer, payment mode, issue type, and item quantities agree.
 */
export const saleMatchesHelper = (
  dataA: SaleMatchData,
  dataB: SaleMatchData
): boolean => {
  if (dataA.customerId !== dataB.customerId) return false;
  if (dataA.paymentMode !== dataB.paymentMode) return false;
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
 * Get or create the standard Walk-in Customer for anonymous/cash over-the-counter purchases.
 */
const getOrCreateWalkInCustomer = async (tx?: Prisma.TransactionClient) => {
  const client = tx || prisma;
  let walkIn = await client.customer.findFirst({
    where: { customerType: 'WALK_IN', name: 'Walk-in Customer' },
  });
  if (!walkIn) {
    walkIn = await client.customer.create({
      data: {
        name: 'Walk-in Customer',
        customerType: 'WALK_IN',
        notes: 'Standard walk-in customer for over-the-counter purchases',
      },
    });
  }
  return walkIn;
};

/**
 * Create or accumulate a credit ledger entry for CREDIT sales.
 * Supports overpayment: if amountPaid > finalTotal, excess clears existing debt oldest-first,
 * then remaining surplus is added to advanceBalance.
 * Returns a breakdown for frontend display.
 */
const handleCreditLedger = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  saleId: number,
  finalTotal: number,
  upfrontPayment: number = 0,
  recordedById?: number,
  advanceApplied: number = 0
): Promise<{ towardsSale: number; towardsDebt: number; towardsAdvance: number }> => {
  const existing = await tx.creditLedger.findUnique({
    where: { saleId },
  });
  if (existing) {
    return { towardsSale: Number(existing.amountPaid), towardsDebt: 0, towardsAdvance: 0 };
  }

  const netDue = Math.max(0, Math.round((finalTotal - advanceApplied) * 100) / 100);
  const towardsSale = Math.min(Math.max(0, Number(upfrontPayment) || 0), netDue);
  const totalCovered = Math.round((advanceApplied + towardsSale) * 100) / 100;
  const balance = Math.max(0, Math.round((finalTotal - totalCovered) * 100) / 100);
  const status = balance <= 0
    ? CreditStatus.PAID
    : totalCovered > 0
      ? CreditStatus.PARTIAL
      : CreditStatus.OUTSTANDING;

  const ledger = await tx.creditLedger.create({
    data: {
      customerId,
      saleId,
      totalAmount: finalTotal,
      amountPaid: totalCovered,
      balance,
      status,
    },
  });

  if (towardsSale > 0 && recordedById) {
    await tx.payment.create({
      data: {
        creditLedgerId: ledger.id,
        amountPaid: towardsSale,
        paymentDate: new Date(),
        notes: advanceApplied > 0
          ? `Deposit payment (GH₵ ${advanceApplied.toFixed(2)} advance credit also applied)`
          : 'Initial deposit / partial payment at time of sale',
        recordedById,
      },
    });
  }

  // Handle surplus: payment was more than netDue
  const surplusCents = Math.round(((Number(upfrontPayment) || 0) - netDue) * 100);
  if (surplusCents <= 0) return { towardsSale, towardsDebt: 0, towardsAdvance: 0 };

  // Pay off existing outstanding ledgers (oldest first), then add remainder as advance
  const existingLedgers = await tx.creditLedger.findMany({
    where: { customerId, status: { not: CreditStatus.PAID }, id: { not: ledger.id } },
    orderBy: { createdAt: 'asc' },
  });

  let remainingCents = surplusCents;
  let totalDebtPaidCents = 0;

  for (const el of existingLedgers) {
    if (remainingCents <= 0) break;
    const balCents = Math.round(Number(el.balance) * 100);
    const payCents = Math.min(remainingCents, balCents);
    remainingCents -= payCents;
    totalDebtPaidCents += payCents;
    const newBal = (balCents - payCents) / 100;
    const newStatus = newBal === 0 ? CreditStatus.PAID : CreditStatus.PARTIAL;
    await tx.creditLedger.update({
      where: { id: el.id },
      data: { amountPaid: { increment: payCents / 100 }, balance: { decrement: payCents / 100 }, status: newStatus },
    });
    if (recordedById) {
      await tx.payment.create({
        data: {
          creditLedgerId: el.id,
          amountPaid: payCents / 100,
          paymentDate: new Date(),
          notes: 'Auto-applied from sale overpayment',
          recordedById,
        },
      });
    }
  }

  const towardsDebt = totalDebtPaidCents / 100;
  const towardsAdvance = remainingCents / 100;

  if (towardsAdvance > 0) {
    await tx.customer.update({
      where: { id: customerId },
      data: { advanceBalance: { increment: towardsAdvance } },
    });
  }

  return { towardsSale, towardsDebt, towardsAdvance };
};


/** Queue an itemized sale-confirmation receipt SMS as part of the sale transaction. */
const queueSaleSms = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  saleId: number,
  customerName: string,
  finalTotal: number,
  paymentMode: PaymentMode,
  saleItems?: Array<{ product?: { name?: string | null }; quantity: number; unitPrice?: any; subtotal?: any }> | null,
  amountPaid?: number,
  advanceApplied: number = 0
): Promise<void> => {
  const modeText = paymentMode === PaymentMode.CC ? 'Cash' : 'Credit';

  // Format list of items
  let itemsSummary = '';
  if (saleItems && saleItems.length > 0) {
    const maxListed = 10;
    const lines = saleItems.slice(0, maxListed).map((item) => {
      const pName = item.product?.name || 'Item';
      const lineTotal = item.subtotal
        ? Number(item.subtotal).toFixed(2)
        : (item.quantity * Number(item.unitPrice || 0)).toFixed(2);
      return `• ${item.quantity}x ${pName} - GH₵${lineTotal}`;
    });

    if (saleItems.length > maxListed) {
      lines.push(`+ ${saleItems.length - maxListed} more item(s)`);
    }

    itemsSummary = `\nItems Bought:\n${lines.join('\n')}`;
  }

  let paymentDetails = `Total: GH₵ ${finalTotal.toFixed(2)} (${modeText})`;
  if (advanceApplied && advanceApplied > 0) {
    paymentDetails += `\nAdvance Credit Used: -GH₵ ${advanceApplied.toFixed(2)}`;
  }
  if (paymentMode === PaymentMode.CREDIT && amountPaid && amountPaid > 0) {
    const remaining = Math.max(0, finalTotal - (advanceApplied || 0) - amountPaid);
    paymentDetails += `\nDeposit: GH₵ ${amountPaid.toFixed(2)} | Balance: GH₵ ${remaining.toFixed(2)}`;
  }

  const message =
    `B.A. Ent Receipt\n` +
    `Sale #${saleId}\n` +
    `Customer: ${customerName}${itemsSummary}\n` +
    `${paymentDetails}\n` +
    `Thank you for your purchase!`;

  await tx.smsQueue.create({
    data: {
      customer: { connect: { id: customerId } },
      sale: { connect: { id: saleId } },
      message,
    },
  });
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

    const { customerId, paymentMode, saleType, items, discountAmount, amountPaid, notes, applyAdvance } = parsed.data;
    const workerAId = req.user!.userId;

    let resolvedCustomerId: number;
    let customer: any;
    if (!customerId) {
      if (paymentMode !== PaymentMode.CC) {
        res.status(400).json({ success: false, error: 'Customer name is required for credit sales' });
        return;
      }
      customer = await getOrCreateWalkInCustomer();
      resolvedCustomerId = customer.id;
    } else {
      resolvedCustomerId = customerId;
      customer = await prisma.customer.findUnique({ where: { id: resolvedCustomerId } });
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
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
    const { originalTotal, discountAmount: computedDiscount, finalTotal } = computeTotals(saleItems, products);

    const workerAData: WorkerSaleData = {
      customerId: resolvedCustomerId,
      paymentMode,
      saleType,
      items: saleItems,
      discountAmount: computedDiscount,
      amountPaid: amountPaid ? Number(amountPaid) : undefined,
      notes,
    };

    // Check for a pending RED sale (Worker B's entry) for the same customer
    const pendingRedSales = await prisma.sale.findMany({
      where: {
        customerId: resolvedCustomerId,
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
        // GREEN — update and handle credit. Stock was already deducted when
        // Worker B recorded the dispatch.
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
              discountAmount: computedDiscount,
              originalTotal,
              finalTotal,
              notes,
            },
          });
          if (claimed.count !== 1) {
            throw new SaleConflictError('This sale has already been confirmed by another request');
          }

          await replaceSaleItems(tx, pendingRedSale.id, saleItems, products);

          const updated = await tx.sale.findUnique({
            where: { id: pendingRedSale.id },
            include: saleInclude,
          });
          if (!updated) throw new Error('Confirmed sale could not be loaded');

          let advanceApplied = 0;
          if (applyAdvance && customer && Number(customer.advanceBalance) > 0) {
            advanceApplied = Math.min(Number(customer.advanceBalance), finalTotal);
            if (advanceApplied > 0) {
              await tx.customer.update({
                where: { id: resolvedCustomerId },
                data: { advanceBalance: { decrement: advanceApplied } },
              });
            }
          }

          if (paymentMode === PaymentMode.CREDIT) {
            await handleCreditLedger(tx, resolvedCustomerId, updated.id, finalTotal, amountPaid || 0, workerAId, advanceApplied);
          }
          if (customer.phone) {
            await queueSaleSms(
              tx,
              resolvedCustomerId,
              updated.id,
              customer.name,
              finalTotal,
              paymentMode,
              updated.saleItems,
              amountPaid,
              advanceApplied
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
      // Stock is NOT deducted on initial BLUE sale; it will only deduct when Worker B confirms.
      // Credit ledger and advance balance are also NOT touched here — they only apply on GREEN.
      const initialStatus = initialSaleStatusHelper(true);
      const newSale = await prisma.$transaction(async (tx) => {
        const sale = await tx.sale.create({
          data: {
            customerId: resolvedCustomerId,
            workerAId,
            status: initialStatus,
            stockDeducted: false,
            paymentMode,
            saleType,
            originalTotal,
            discountAmount: computedDiscount,
            finalTotal,
            notes,
            workerAData: saleSnapshotToJson(workerAData),
            saleItems: { create: nestedSaleItemData(saleItems, products) },
          },
          include: saleInclude,
        });

        // Do NOT deduct advance balance or create credit ledger for a BLUE (pending) sale.
        // These will be applied once the sale turns GREEN (Worker B confirms dispatch).

        return sale;
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

    const { customerId, paymentMode, saleType, items, notes } = parsed.data;
    const workerBId = req.user!.userId;

    let resolvedCustomerId: number;
    let customer: any;
    if (!customerId) {
      if (paymentMode !== PaymentMode.CC) {
        res.status(400).json({ success: false, error: 'Customer name is required for credit sales' });
        return;
      }
      customer = await getOrCreateWalkInCustomer();
      resolvedCustomerId = customer.id;
    } else {
      resolvedCustomerId = customerId;
      customer = await prisma.customer.findUnique({ where: { id: resolvedCustomerId } });
      if (!customer) {
        res.status(404).json({ success: false, error: 'Customer not found' });
        return;
      }
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
      customerId: resolvedCustomerId,
      paymentMode,
      saleType,
      items,
      notes,
    };

    // Check for a pending BLUE sale (Worker A's entry) for the same customer
    const pendingBlueSales = await prisma.sale.findMany({
      where: {
        customerId: resolvedCustomerId,
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
            await handleCreditLedger(
              tx,
              resolvedCustomerId,
              updated.id,
              greenFinal,
              blueData.amountPaid || 0,
              pendingBlueSale.workerAId || workerBId
            );
          }
          if (customer.phone) {
            await queueSaleSms(
              tx,
              resolvedCustomerId,
              updated.id,
              customer.name,
              greenFinal,
              blueData.paymentMode,
              updated.saleItems,
              blueData.amountPaid
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
      // Worker B is the physical dispatch point, so stock is deducted when
      // the dispatch is recorded, even while it waits for Worker A's entry.
      const initialStatus = initialSaleStatusHelper(false);
      const newSale = await prisma.$transaction(async (tx) => {
        await deductStock(tx, saleItems);
        return tx.sale.create({
          data: {
            customerId: resolvedCustomerId,
            workerBId,
            status: initialStatus,
            stockDeducted: true,
            paymentMode,
            saleType,
            originalTotal,
            discountAmount,
            finalTotal,
            workerBData: dispatchSnapshotToJson(workerBData),
            notes,
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
    const { status, dateFrom, dateTo, customerId, paymentMode, deleted, verified } = req.query;

    const where: any = { deletedAt: deleted === 'true' ? { not: null } : null };
    if (status) where.status = status as string;
    if (customerId) where.customerId = parseInt(customerId as string);
    if (paymentMode) where.paymentMode = paymentMode as string;

    // Filter by adminVerified status
    if (deleted !== 'true') {
      if (verified === 'true') {
        where.adminVerified = true;
      } else if (verified === 'all') {
        // do not filter by adminVerified
      } else {
        where.adminVerified = false;
      }
    }

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
    const { dateFrom, dateTo } = req.query;

    const where: any =
      role === Role.WORKER_A
        ? { workerAId: userId, deletedAt: null }
        : { workerBId: userId, deletedAt: null };

    if (dateFrom) where.saleDate = { ...where.saleDate, gte: new Date(dateFrom as string) };
    if (dateTo) {
      const end = new Date(dateTo as string);
      end.setHours(23, 59, 59, 999);
      where.saleDate = { ...where.saleDate, lte: end };
    }

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
    if (existing.adminVerified) {
      res.status(409).json({ success: false, error: 'Verified sales cannot be edited' });
      return;
    }

    const {
  notes,
  discountAmount,
  saleType,
  paymentMode,
  saleDate,
} = req.body;

const updateData: any = {};

if (notes !== undefined) {
  updateData.notes = notes;
}

// Workers may correct the sale type and payment mode on their own
// unconfirmed sales. Discount changes remain restricted to confirmed sales.
const isWorker =
  req.user!.role === Role.WORKER_A ||
  req.user!.role === Role.WORKER_B;

const isOwnSale =
  (req.user!.role === Role.WORKER_A &&
    existing.workerAId === req.user!.userId) ||
  (req.user!.role === Role.WORKER_B &&
    existing.workerBId === req.user!.userId);

const isAdmin = req.user!.role === Role.ADMIN;

if (!isAdmin && isWorker && !isOwnSale) {
  res.status(403).json({
    success: false,
    error: 'You can only edit sales you entered',
  });
  return;
}

if (
  discountAmount !== undefined &&
  existing.status !== SaleStatus.GREEN
) {
  res.status(409).json({
    success: false,
    error: 'Only confirmed sales can have discounts edited',
  });
  return;
}

if (saleType !== undefined) {
  if (
    saleType !== SaleType.RETAIL &&
    saleType !== SaleType.WHOLESALE
  ) {
    res.status(400).json({
      success: false,
      error: 'Sale type must be RETAIL or WHOLESALE',
    });
    return;
  }

  updateData.saleType = saleType;
}

if (paymentMode !== undefined) {
  if (
    paymentMode !== PaymentMode.CC &&
    paymentMode !== PaymentMode.CREDIT
  ) {
    res.status(400).json({
      success: false,
      error: 'Payment mode must be CC or CREDIT',
    });
    return;
  }  // Do not change payment mode after a credit ledger/payment exists.
  if (existing.creditLedger && paymentMode !== existing.paymentMode) {
    res.status(409).json({
      success: false,
      error: 'Payment mode cannot be changed after a payment has been recorded',
    });
    return;
  }

  updateData.paymentMode = paymentMode;
}

if (saleDate !== undefined) {
  const parsedSaleDate = new Date(saleDate);

  if (Number.isNaN(parsedSaleDate.getTime())) {
    res.status(400).json({
      success: false,
      error: 'A valid sale date is required',
    });
    return;
  }

  updateData.saleDate = parsedSaleDate;
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
    if (sale.adminVerified) {
      res.status(409).json({ success: false, error: 'Verified sales cannot be deleted' });
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
    if (sale.creditLedger?.payments.length && actor.role !== Role.ADMIN) {
      res.status(409).json({
        success: false,
        error: 'This credit sale has recorded payments. Please ask an admin to review and delete.',
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
        await tx.payment.deleteMany({ where: { creditLedgerId: sale.creditLedger.id } });
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

/**
 * POST /api/sales/:id/unverify
 * Admin: reverse verification back to confirmed but unverified state.
 */
export const unverifySale = async (
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

    const unverified = await prisma.sale.update({
      where: { id },
      data: { adminVerified: false },
      include: saleInclude,
    });

    emitToAdmin('sale:verified', unverified);
    await createAuditLog(req.user!.userId, 'UNVERIFY_SALE', 'Sale', id, null, unverified, req.ip);

    res.json({ success: true, data: unverified, message: 'Sale moved back to unverified sales' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sales/:id/restore
 * Admin: reverse/restore a deleted sale record back to active state.
 */
export const restoreSale = async (
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
        saleItems: { include: { product: true } },
        creditLedger: true,
      },
    });

    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale record not found' });
      return;
    }
    if (!sale.deletedAt) {
      res.status(400).json({ success: false, error: 'This sale is already active and not deleted' });
      return;
    }

    const restored = await prisma.$transaction(async (tx) => {
      // Re-deduct stock if the sale had deducted stock before
      if (sale.stockDeducted) {
        for (const item of sale.saleItems) {
          const current = await tx.product.findUnique({ where: { id: item.productId } });
          if (!current || current.quantity < item.quantity) {
            throw new Error(`Cannot restore: Insufficient stock for product "${item.product?.name || item.productId}"`);
          }
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      }

      // Re-create credit ledger if it was a CREDIT sale and no ledger currently exists
      if (sale.paymentMode === PaymentMode.CREDIT) {
        const existingLedger = await tx.creditLedger.findUnique({ where: { saleId: id } });
        if (!existingLedger) {
          const finalTotalNum = Number(sale.finalTotal);
          await tx.creditLedger.create({
            data: {
              customerId: sale.customerId,
              saleId: id,
              totalAmount: finalTotalNum,
              amountPaid: 0,
              balance: finalTotalNum,
              status: CreditStatus.OUTSTANDING,
              notes: 'Restored credit ledger',
            },
          });
        }
      }

      // Set deletedAt to null
      return tx.sale.update({
        where: { id },
        data: {
          deletedAt: null,
          deletedById: null,
          deletedByRole: null,
        },
        include: saleInclude,
      });
    });

    emitSaleChanged(restored);
    await createAuditLog(req.user!.userId, 'RESTORE_SALE', 'Sale', id, sale, restored, req.ip);

    res.json({
      success: true,
      data: restored,
      message: `Sale #${id} reversed and restored to active records`,
    });
  } catch (err: any) {
    next(err);
  }
};

/**
 * DELETE /api/sales/:id/permanent
 * Admin: permanently delete (purge) a deleted sale from database.
 */
export const permanentDeleteSale = async (
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
      include: { creditLedger: true },
    });

    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale record not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Delete any payments linked to its credit ledger
      if (sale.creditLedger) {
        await tx.payment.deleteMany({ where: { creditLedgerId: sale.creditLedger.id } });
        await tx.creditLedger.delete({ where: { id: sale.creditLedger.id } });
      }
      // Delete saleItems
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      // Delete smsQueue entries
      await tx.smsQueue.deleteMany({ where: { saleId: id } });
      // Finally delete sale
      await tx.sale.delete({ where: { id } });
    });

    await createAuditLog(req.user!.userId, 'PERMANENT_DELETE_SALE', 'Sale', id, sale, null, req.ip);
    res.json({ success: true, message: `Sale #${id} permanently deleted from records` });
  } catch (err) {
    next(err);
  }
};

      