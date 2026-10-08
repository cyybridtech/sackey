import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/audit.middleware';
import { SaleStatus, Role } from '../types';

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 * Aggregated data for the admin overview dashboard.
 */
export const getDashboard = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's total GREEN sales
    const todaySales = await prisma.sale.aggregate({
      where: {
        status: SaleStatus.GREEN,
        deletedAt: null,
        saleDate: { gte: todayStart, lte: todayEnd },
      },
      _sum: { finalTotal: true },
      _count: { id: true },
    });

    // Total outstanding credit
    const creditAggregate = await prisma.creditLedger.aggregate({
      where: { status: { in: ['OUTSTANDING', 'PARTIAL'] } },
      _sum: { balance: true },
    });

    // Stock by category
    const stockByCategory = await prisma.product.groupBy({
      by: ['category'],
      where: { isActive: true },
      _sum: { quantity: true },
    });

    // Sale status counts
    const statusCounts = await prisma.sale.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    });
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s) => (statusMap[s.status] = s._count.id));

    // Low stock products (< 10)
    const lowStockProducts = await prisma.product.findMany({
      where: { isActive: true, quantity: { lt: 10 } },
      orderBy: { quantity: 'asc' },
      take: 20,
    });

    // Recent audit logs
    const recentActivity = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { id: true, name: true, role: true } } },
    });

    // Total active products count and total stock units
    const totalProducts = await prisma.product.count({ where: { isActive: true } });
    const deletedSaleCount = await prisma.sale.count({ where: { deletedAt: { not: null } } });
    const stockUnitsAggregate = await prisma.product.aggregate({
      where: { isActive: true },
      _sum: { quantity: true },
    });
    const totalStockUnits = stockUnitsAggregate._sum.quantity || 0;

    // Pending SMS count
    const pendingSmsCount = await prisma.smsQueue.count({ where: { status: 'PENDING' } });

    // Last 7 days sales aggregation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const pastWeekSales = await prisma.sale.findMany({
      where: {
        status: SaleStatus.GREEN,
        deletedAt: null,
        saleDate: { gte: sevenDaysAgo },
      },
      select: {
        saleDate: true,
        finalTotal: true,
      },
    });

    const salesMap: Record<string, { total: number; count: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(5, 10);
      salesMap[dateKey] = { total: 0, count: 0 };
    }

    pastWeekSales.forEach((s) => {
      const dateKey = new Date(s.saleDate).toISOString().slice(5, 10);
      if (salesMap[dateKey]) {
        salesMap[dateKey].total += parseFloat(s.finalTotal.toString());
        salesMap[dateKey].count += 1;
      }
    });

    const salesLast7Days = Object.entries(salesMap).map(([date, val]) => ({
      date,
      total: val.total,
      count: val.count,
    }));

    const todaySalesTotal = parseFloat((todaySales._sum.finalTotal || 0).toString());
    const totalOutstandingDebt = parseFloat((creditAggregate._sum.balance || 0).toString());

    res.json({
      success: true,
      data: {
        todaySalesTotal,
        totalOutstandingDebt,
        totalProducts,
        deletedSaleCount,
        totalStockUnits,
        pendingSms: pendingSmsCount,
        salesLast7Days,
        today: {
          totalSales: todaySalesTotal,
          saleCount: todaySales._count.id,
        },
        totalOutstandingCredit: totalOutstandingDebt,
        stockByCategory,
        saleStatusCounts: {
          BLUE: statusMap[SaleStatus.BLUE] || 0,
          RED: statusMap[SaleStatus.RED] || 0,
          GREEN: statusMap[SaleStatus.GREEN] || 0,
          FLAGGED: statusMap[SaleStatus.FLAGGED] || 0,
        },
        lowStockProducts,
        recentActivity,
        pendingSmsCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/dashboard/sales-report
 * Sales report for a date range, broken down by day and payment mode / sale type.
 */
export const getSalesReport = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = req.query;

    const where: any = { status: SaleStatus.GREEN, deletedAt: null };
    if (dateFrom || dateTo) {
      where.saleDate = {};
      if (dateFrom) where.saleDate.gte = new Date(dateFrom as string);
      if (dateTo) where.saleDate.lte = new Date(dateTo as string);
    }

    const sales = await prisma.sale.findMany({
      where,
      select: {
        saleDate: true,
        finalTotal: true,
        paymentMode: true,
        saleType: true,
      },
      orderBy: { saleDate: 'asc' },
    });

    // Group by day
    const byDay: Record<string, number> = {};
    let ccTotal = 0;
    let creditTotal = 0;
    let wholesaleTotal = 0;
    let retailTotal = 0;

    for (const sale of sales) {
      const day = sale.saleDate.toISOString().split('T')[0];
      const amount = parseFloat(sale.finalTotal.toString());
      byDay[day] = (byDay[day] || 0) + amount;

      if (sale.paymentMode === 'CC') ccTotal += amount;
      else creditTotal += amount;

      if (sale.saleType === 'WHOLESALE') wholesaleTotal += amount;
      else retailTotal += amount;
    }

    const dailyBreakdown = Object.entries(byDay).map(([date, total]) => ({ date, total }));

    res.json({
      success: true,
      data: {
        totalSales: sales.reduce((s, sale) => s + parseFloat(sale.finalTotal.toString()), 0),
        saleCount: sales.length,
        dailyBreakdown,
        paymentBreakdown: { CC: ccTotal, CREDIT: creditTotal },
        typeBreakdown: { WHOLESALE: wholesaleTotal, RETAIL: retailTotal },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * List all users (excluding password hash).
 */
export const getUsers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/users
 * Create a new worker account.
 */
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, username, password, role } = req.body;

    if (!name || !username || !password || !role) {
      res.status(400).json({ success: false, error: 'name, username, password, role are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ success: false, error: 'Username already taken' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, username, passwordHash, role },
      select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
    });

    await createAuditLog(
      req.user!.userId,
      'CREATE_USER',
      'User',
      user.id,
      null,
      user,
      req.ip
    );

    res.status(201).json({ success: true, data: user, message: 'User created successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/users/:id
 * Update user name, username, or active status. Cannot change own role.
 */
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const { name, username, isActive } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (id === req.user!.userId && isActive === false) {
      res.status(400).json({ success: false, error: 'You cannot deactivate your own account' });
      return;
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      res.status(400).json({ success: false, error: 'Name must be a non-empty string' });
      return;
    }
    if (username !== undefined && (typeof username !== 'string' || !username.trim())) {
      res.status(400).json({ success: false, error: 'Username must be a non-empty string' });
      return;
    }
    if (username && username !== existing.username) {
      const usernameOwner = await prisma.user.findUnique({ where: { username } });
      if (usernameOwner) {
        res.status(409).json({ success: false, error: 'Username already taken' });
        return;
      }
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      res.status(400).json({ success: false, error: 'isActive must be a boolean' });
      return;
    }

    const updateData: { name?: string; username?: string; isActive?: boolean } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (username !== undefined) updateData.username = username.trim();
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });

    await createAuditLog(
      req.user!.userId,
      'UPDATE_USER',
      'User',
      id,
      existing,
      updated,
      req.ip
    );

    res.json({ success: true, data: updated, message: 'User updated successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Audit Log ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-log
 * Paginated audit log with optional filters.
 */
export const getAuditLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, action, dateFrom, dateTo, page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (userId) where.userId = parseInt(userId as string);
    if (action) where.action = { contains: action as string };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const [total, logs] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * GET /api/admin/notifications
 * All admin notifications ordered newest first.
 */
export const getNotifications = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ targetRole: Role.ADMIN }, { targetRole: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/notifications/:id/read
 * Mark a single notification as read.
 */
export const markNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ success: true, data: notification });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/notifications/read-all
 * Mark all admin notifications as read.
 */
export const markAllNotificationsRead = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: {
        isRead: false,
        OR: [{ targetRole: Role.ADMIN }, { targetRole: null }],
      },
      data: { isRead: true },
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};
