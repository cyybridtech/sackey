import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendSms } from '../services/sms.service';
import { SmsStatus } from '../types';

/**
 * GET /api/sms/queue
 * Get SMS messages awaiting approval or review.
 * Optional query parameter: ?status=PENDING | APPROVED | REJECTED | SENT
 */
export const getSmsQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statusParam = req.query.status as string | undefined;
    const where: any = {};

    if (statusParam && Object.values(SmsStatus).includes(statusParam as SmsStatus)) {
      where.status = statusParam as SmsStatus;
    }

    const queue = await prisma.smsQueue.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        sale: { select: { id: true, saleDate: true, finalTotal: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: queue });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sms/approve/:id
 * Approve and send a single SMS via Vynfy.
 */
export const approveSms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const smsEntry = await prisma.smsQueue.findUnique({
      where: { id },
      include: { customer: { select: { phone: true, name: true } } },
    });

    if (!smsEntry) {
      res.status(404).json({ success: false, error: 'SMS entry not found' });
      return;
    }

    if (smsEntry.status !== SmsStatus.PENDING) {
      res.status(400).json({ success: false, error: `SMS is already ${smsEntry.status}` });
      return;
    }

    const phone = smsEntry.customer?.phone;
    if (!phone) {
      res.status(400).json({
        success: false,
        error: `Customer ${smsEntry.customer?.name || ''} has no phone number registered`,
      });
      return;
    }

    // Send SMS via Vynfy
    const sendResult = await sendSms(phone, smsEntry.message);

    if (!sendResult.success) {
      res.status(400).json({
        success: false,
        error: sendResult.error || 'Failed to send SMS through Vynfy',
        providerResponse: sendResult.providerResponse,
      });
      return;
    }

    // Update status to APPROVED and SENT
    const updated = await prisma.smsQueue.update({
      where: { id },
      data: {
        status: SmsStatus.SENT,
        adminApprovedAt: new Date(),
        sentAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: updated,
      message: 'SMS approved and sent successfully via Vynfy',
      providerResponse: sendResult.providerResponse,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sms/reject/:id
 * Reject an SMS in the queue.
 */
export const rejectSms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);

    const smsEntry = await prisma.smsQueue.findUnique({ where: { id } });
    if (!smsEntry) {
      res.status(404).json({ success: false, error: 'SMS entry not found' });
      return;
    }

    const updated = await prisma.smsQueue.update({
      where: { id },
      data: { status: SmsStatus.REJECTED },
    });

    res.json({ success: true, data: updated, message: 'SMS rejected' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sms/approve-bulk
 * Approve and send multiple SMS messages.
 */
export const approveBulkSms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'An array of ids is required' });
      return;
    }

    const entries = await prisma.smsQueue.findMany({
      where: { id: { in: ids }, status: SmsStatus.PENDING },
      include: { customer: { select: { phone: true, name: true } } },
    });

    const results: { id: number; success: boolean; error?: string }[] = [];

    for (const entry of entries) {
      try {
        if (!entry.customer?.phone) {
          results.push({ id: entry.id, success: false, error: 'Customer phone missing' });
          continue;
        }

        const sendResult = await sendSms(entry.customer.phone, entry.message);

        if (!sendResult.success) {
          results.push({ id: entry.id, success: false, error: sendResult.error });
          continue;
        }

        await prisma.smsQueue.update({
          where: { id: entry.id },
          data: {
            status: SmsStatus.SENT,
            adminApprovedAt: new Date(),
            sentAt: new Date(),
          },
        });

        results.push({ id: entry.id, success: true });
      } catch (e: any) {
        results.push({ id: entry.id, success: false, error: e.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    res.json({
      success: true,
      data: results,
      message: `${successCount}/${entries.length} SMS messages sent via Vynfy`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/sms/test
 * Send an immediate test SMS via Vynfy to verify credentials and sender ID.
 */
export const sendTestSms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phone, message } = req.body;

    if (!phone) {
      res.status(400).json({ success: false, error: 'Recipient phone number is required' });
      return;
    }

    const testMessage = message || 'Hello! This is a test notification from your POS system via Vynfy.';
    const result = await sendSms(phone, testMessage);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to dispatch test SMS via Vynfy',
        providerResponse: result.providerResponse,
      });
      return;
    }

    res.json({
      success: true,
      message: `Test SMS dispatched successfully to ${phone}`,
      providerResponse: result.providerResponse,
    });
  } catch (err) {
    next(err);
  }
};
