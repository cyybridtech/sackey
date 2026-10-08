import prisma from '../lib/prisma';
import { Role } from '../types';
import { emitToAdmin, emitToRole } from '../services/socket.service';

/**
 * Creates a Notification record in the database and emits a real-time socket event.
 *
 * @param type          - Notification type string (e.g. 'SALE_FLAGGED', 'PAYMENT_RECEIVED')
 * @param message       - Human-readable notification message
 * @param targetRole    - Optional role to target (emits to that role's socket room)
 * @param targetUserId  - Optional specific user ID to target
 * @param relatedEntity - Optional entity name (e.g. 'Sale', 'Customer')
 * @param relatedId     - Optional related entity ID
 */
export const createNotification = async (
  type: string,
  message: string,
  targetRole?: Role,
  targetUserId?: number,
  relatedEntity?: string,
  relatedId?: number
): Promise<void> => {
  try {
    const notification = await prisma.notification.create({
      data: {
        type,
        message,
        targetRole,
        targetUserId,
        relatedEntity,
        relatedId,
      },
    });

    // Emit real-time event
    if (targetRole === Role.ADMIN || !targetRole) {
      emitToAdmin('notification:new', notification);
    } else if (targetRole) {
      emitToRole(targetRole, 'notification:new', notification);
    }
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
};
