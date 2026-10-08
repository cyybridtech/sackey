import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { CreditStatus } from '../types';

/**
 * GET /api/credits
 * Admin: list all credit ledgers with customer info and optional filters.
 */
export const getCredits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, customerId, dateFrom, dateTo } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    if (customerId) where.customerId = parseInt(customerId as string);
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const ledgers = await prisma.creditLedger.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        sale: { select: { id: true, saleDate: true, saleType: true } },
        payments: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: ledgers });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/credits/summary
 * Admin: aggregated credit summary — total debt, customer count, top debtors.
 */
export const getCreditSummary = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const activeStatuses = [CreditStatus.OUTSTANDING, CreditStatus.PARTIAL];

    // Aggregate totals using Prisma
    const aggregate = await prisma.creditLedger.aggregate({
      where: { status: { in: activeStatuses } },
      _sum: { balance: true },
      _count: { id: true },
    });
    const collectedAggregate = await prisma.creditLedger.aggregate({
      _sum: { amountPaid: true },
    });

    // Distinct customer count with debt
    const debtorIds = await prisma.creditLedger.findMany({
      where: { status: { in: activeStatuses } },
      select: { customerId: true },
      distinct: ['customerId'],
    });

    // Top 10 debtors
    const topDebtors = await prisma.creditLedger.groupBy({
      by: ['customerId'],
      where: { status: { in: activeStatuses } },
      _sum: { balance: true },
      orderBy: { _sum: { balance: 'desc' } },
      take: 10,
    });

    const topDebtorIds = topDebtors.map((d) => d.customerId);
    const topDebtorCustomers = await prisma.customer.findMany({
      where: { id: { in: topDebtorIds } },
      select: { id: true, name: true, phone: true },
    });

    const topDebtorsEnriched = topDebtors.map((d) => ({
      customer: topDebtorCustomers.find((c) => c.id === d.customerId),
      totalBalance: d._sum.balance,
    }));

    res.json({
      success: true,
      data: {
        totalOutstandingDebt: aggregate._sum.balance || 0,
        totalCollected: collectedAggregate._sum.amountPaid || 0,
        totalActiveEntries: aggregate._count.id,
        customersWithDebt: debtorIds.length,
        topDebtors: topDebtorsEnriched,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/credits/:id
 * Admin: single credit ledger with full payment history.
 */
export const getCreditById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));

    const ledger = await prisma.creditLedger.findUnique({
      where: { id },
      include: {
        customer: true,
        sale: { include: { saleItems: { include: { product: true } } } },
        payments: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!ledger) {
      res.status(404).json({ success: false, error: 'Credit ledger entry not found' });
      return;
    }

    res.json({ success: true, data: ledger });
  } catch (err) {
    next(err);
  }
};
