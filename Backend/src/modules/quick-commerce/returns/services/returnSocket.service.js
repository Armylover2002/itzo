/**
 * Return Socket Service
 *
 * Emits real-time updates for return tracking, status changes,
 * and delivery partner assignments.
 */

import { getIO, rooms } from '../../../../config/socket.js';
import { logger } from '../../../../utils/logger.js';

/**
 * Emit a general status update to a user for a specific return.
 */
export function emitReturnStatusUpdate(userId, returnRequestId, newStatus) {
  try {
    const io = getIO();
    const room = rooms.user(userId);
    io.to(room).emit('return_status_updated', {
      returnRequestId,
      status: newStatus,
      updatedAt: new Date(),
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit return_status_updated: ${err.message}`);
  }
}

/**
 * Emit a new assignment alert to a delivery partner.
 */
export function emitReturnAssignmentSocket(partnerId, sellerReturnId) {
  try {
    const io = getIO();
    const room = rooms.delivery(partnerId);
    io.to(room).emit('new_return_assignment', {
      sellerReturnId,
      assignedAt: new Date(),
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit new_return_assignment: ${err.message}`);
  }
}

/**
 * Emit a leg status update to the admin tracking room.
 */
export function emitAdminTrackingUpdate(sellerReturnId, legStatus) {
  try {
    const io = getIO();
    // Assuming admins join a global tracking room or return-specific tracking room.
    // For now, we'll emit to a hypothetical 'admin_returns' room.
    io.to('admin_returns').emit('return_leg_updated', {
      sellerReturnId,
      status: legStatus,
      updatedAt: new Date(),
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit admin return_leg_updated: ${err.message}`);
  }
}
