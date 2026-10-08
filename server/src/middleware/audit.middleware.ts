import prisma from '../lib/prisma';

/**
 * Helper to create an audit log entry.
 * Does not throw — logs errors to console to avoid disrupting the request flow.
 */
export const createAuditLog = async (
  userId: number,
  action: string,
  entityType: string,
  entityId?: number,
  oldValues?: object | null,
  newValues?: object | null,
  ipAddress?: string
): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        oldValues: oldValues ?? undefined,
        newValues: newValues ?? undefined,
        ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to create audit log:', err);
  }
};
