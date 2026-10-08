import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/audit.middleware';
import { createNotification } from '../helpers/notification.helper';
import { emitToAdmin } from '../services/socket.service';
import { Role, CreditStatus } from '../types';

class PaymentConflictError extends Error {
  readonly statusCode = 409;
}

/**
 * GET /api/customers
 * List all customers with optional search/type filters and total outstanding debt.
 */
export const getCustomers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, customerType } = req.query;

    const where: any = {};

    if (customerType) where.customerType = customerType as string;

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { phone: { contains: search as string } },
        { email: { contains: search as string } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        creditLedger: {
          where: { status: { in: [CreditStatus.OUTSTANDING, CreditStatus.PARTIAL] } },
          select: { balance: true },
        },
        sales: {
          where: {
            paymentMode: 'CREDIT',
            status: { in: ['BLUE', 'RED', 'FLAGGED'] },
          },
          select: { finalTotal: true, status: true },
        },
        _count: {
          select: { sales: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute total outstanding debt per customer
    const result = customers.map((c) => {
      const confirmedDebt = c.creditLedger.reduce(
        (sum, l) => sum + parseFloat(l.balance.toString()),
        0
      );
      const pendingDebt = c.sales.reduce(
        (sum, s) => sum + parseFloat(s.finalTotal.toString()),
        0
      );
      return {
        ...c,
        totalDebt: confirmedDebt,
        totalOutstandingDebt: confirmedDebt,
        pendingDebt,
        totalPotentialDebt: confirmedDebt + pendingDebt,
        salesCount: c._count.sales,
        creditLedger: undefined,
        sales: undefined,
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/customers/:id
 * Full customer profile including sales, credit ledger summary, and payments.
 */
export const getCustomerById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            saleItems: { include: { product: true } },
            workerA: { select: { id: true, name: true } },
            workerB: { select: { id: true, name: true } },
          },
          orderBy: { saleDate: 'desc' },
        },
        creditLedger: {
          include: {
            payments: { include: { recordedBy: { select: { id: true, name: true } } } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const confirmedDebt = customer.creditLedger
      .filter((l) => l.status !== CreditStatus.PAID)
      .reduce((sum, l) => sum + parseFloat(l.balance.toString()), 0);

    const pendingCreditSales = customer.sales.filter(
      (s) => s.paymentMode === 'CREDIT' && s.status !== 'GREEN'
    );
    const pendingCreditDebt = pendingCreditSales.reduce(
      (sum, s) => sum + parseFloat(s.finalTotal.toString()),
      0
    );

    const allPayments = customer.creditLedger.flatMap((cl) => cl.payments || []);

    res.json({
      success: true,
      data: {
        ...customer,
        totalDebt: confirmedDebt,
        confirmedDebt,
        pendingCreditDebt,
        totalPotentialDebt: confirmedDebt + pendingCreditDebt,
        pendingCreditSales,
        allPayments,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/customers
 * Create a new customer.
 */
export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone, email, address, customerType, notes } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Customer name is required' });
      return;
    }

    const customer = await prisma.customer.create({
      data: { name, phone, email, address, customerType, notes },
    });

    await createAuditLog(
      req.user!.userId,
      'CREATE_CUSTOMER',
      'Customer',
      customer.id,
      null,
      customer,
      req.ip
    );

    res.status(201).json({
      success: true,
      data: customer,
      message: 'Customer created successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/customers/:id
 * Update customer information.
 */
export const updateCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const { name, phone, email, address, customerType, notes } = req.body;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: { name, phone, email, address, customerType, notes },
    });

    await createAuditLog(
      req.user!.userId,
      'UPDATE_CUSTOMER',
      'Customer',
      id,
      existing,
      updated,
      req.ip
    );

    res.json({ success: true, data: updated, message: 'Customer updated successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/customers/:id
 * Delete a customer only when it has no sales, credit, or message history.
 */
export const deleteCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ success: false, error: 'A valid customer ID is required' });
      return;
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { sales: true, creditLedger: true, smsQueue: true } },
      },
    });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }
    if (customer._count.sales || customer._count.creditLedger || customer._count.smsQueue) {
      res.status(409).json({
        success: false,
        error: 'Customers with sales, debt, or SMS history cannot be deleted. Edit the customer record instead.',
      });
      return;
    }

    await prisma.customer.delete({ where: { id } });
    await createAuditLog(req.user!.userId, 'DELETE_CUSTOMER', 'Customer', id, customer, null, req.ip);
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/customers/:id/debt
 * Get a customer's complete debt breakdown.
 */
export const getCustomerDebt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' });
      return;
    }

    const ledgers = await prisma.creditLedger.findMany({
      where: { customerId: id },
      include: {
        sale: { select: { id: true, saleDate: true, finalTotal: true, saleType: true } },
        payments: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOutstanding = ledgers
      .filter((l) => l.status !== CreditStatus.PAID)
      .reduce((sum, l) => sum + parseFloat(l.balance.toString()), 0);

    res.json({
      success: true,
      data: {
        customer: { id: customer.id, name: customer.name, phone: customer.phone },
        ledgers,
        totalOutstanding,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/customers/:id/payment
 * Record a partial or full payment against a credit ledger entry.
 */
export const recordPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = parseInt(String(req.params.id));
    const { creditLedgerId, amountPaid, notes } = req.body;
    const ledgerId = Number(creditLedgerId);
    const paid = Number(amountPaid);

    if (
      !Number.isInteger(customerId) ||
      customerId <= 0 ||
      !Number.isInteger(ledgerId) ||
      ledgerId <= 0 ||
      !Number.isFinite(paid) ||
      paid <= 0
    ) {
      res
        .status(400)
        .json({ success: false, error: 'creditLedgerId and a positive amountPaid are required' });
      return;
    }

    const ledger = await prisma.creditLedger.findFirst({
      where: { id: ledgerId, customerId },
      include: { customer: true },
    });

    if (!ledger) {
      res.status(404).json({ success: false, error: 'Credit ledger entry not found' });
      return;
    }

    const paidCents = Math.round(paid * 100);
    const currentBalanceCents = Math.round(Number(ledger.balance.toString()) * 100);
    const currentBalance = currentBalanceCents / 100;

    if (paidCents <= 0 || paidCents > currentBalanceCents) {
      res.status(400).json({
        success: false,
        error: `Amount paid (${paid}) must be positive and cannot exceed balance (${currentBalance})`,
      });
      return;
    }

    const normalizedPaid = paidCents / 100;
    const newBalance = (currentBalanceCents - paidCents) / 100;

    let newStatus: CreditStatus = CreditStatus.PARTIAL;
    if (newBalance === 0) newStatus = CreditStatus.PAID;

    const { payment, updatedLedger } = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.creditLedger.updateMany({
        where: {
          id: ledger.id,
          status: ledger.status,
          balance: ledger.balance,
        },
        data: {
          amountPaid: { increment: normalizedPaid },
          balance: { decrement: normalizedPaid },
          status: newStatus,
        },
      });
      if (updateResult.count !== 1) {
        throw new PaymentConflictError(
          'This balance changed while recording the payment. Refresh and try again.'
        );
      }

      const payment = await tx.payment.create({
        data: {
          creditLedgerId: ledger.id,
          amountPaid: normalizedPaid,
          recordedById: req.user!.userId,
          notes,
        },
      });
      const updatedLedger = await tx.creditLedger.findUniqueOrThrow({ where: { id: ledger.id } });

      if (ledger.customer.phone) {
        const smsMessage =
          `Dear ${ledger.customer.name}, we received GH₵ ${normalizedPaid.toFixed(2)}. ` +
          `Remaining balance: GH₵ ${newBalance.toFixed(2)}. Thank you.`;
        await tx.smsQueue.create({
          data: {
            customerId,
            saleId: ledger.saleId,
            message: smsMessage,
          },
        });
      }

      return { payment, updatedLedger };
    });

    await createAuditLog(
      req.user!.userId,
      'RECORD_PAYMENT',
      'CreditLedger',
      ledger.id,
      { balance: currentBalance, status: ledger.status },
      { balance: newBalance, status: newStatus },
      req.ip
    );

    // Notify admin
    await createNotification(
      'PAYMENT_RECEIVED',
      `Payment of GH₵ ${normalizedPaid.toFixed(2)} received from ${ledger.customer.name} (Balance: GH₵ ${newBalance.toFixed(2)})`,
      Role.ADMIN,
      undefined,
      'CreditLedger',
      ledger.id
    );
    emitToAdmin('payment:received', { payment, ledger: updatedLedger });

    res.json({
      success: true,
      data: { payment, ledger: updatedLedger },
      message: 'Payment recorded successfully',
    });
  } catch (err) {
    next(err);
  }
};
