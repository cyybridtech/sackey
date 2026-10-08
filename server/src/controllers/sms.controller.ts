import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendSms } from '../services/sms.service';
import { SmsStatus } from '../types';

/**
 * GET /api/sms/queue
 * Get all pending SMS messages awaiting admin approval.
 */
export const getSmsQueue = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queue = await prisma.smsQueue.findMany({
      where: { status: SmsStatus.PENDING },
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
 * Approve and send a single SMS.
 */
export const approveSms = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));

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

    // Mark approved first
    await prisma.smsQueue.update({
      where: { id },
      data: { status: SmsStatus.APPROVED, adminApprovedAt: new Date() },
    });

    // Send SMS
    const phone = smsEntry.customer.phone;
    if (phone) {
      await sendSms(phone, smsEntry.message);
    }

    const updated = await prisma.smsQueue.update({
      where: { id },
      data: { status: SmsStatus.SENT, sentAt: new Date() },
    });

    res.json({ success: true, data: updated, message: 'SMS approved and sent' });
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
    const id = parseInt(String(req.params.id));

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
        await prisma.smsQueue.update({
          where: { id: entry.id },
          data: { status: SmsStatus.APPROVED, adminApprovedAt: new Date() },
        });

        if (entry.customer.phone) {
          await sendSms(entry.customer.phone, entry.message);
        }

        await prisma.smsQueue.update({
          where: { id: entry.id },
          data: { status: SmsStatus.SENT, sentAt: new Date() },
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
      message: `${successCount}/${entries.length} SMS messages sent`,
    });
  } catch (err) {
    next(err);
  }
};
