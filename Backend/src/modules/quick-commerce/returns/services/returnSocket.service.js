/**
 * Return Socket Service
 *
 * Emits real-time updates for return tracking, status changes,
 * and delivery partner assignments.
 */

import { getIO, rooms } from '../../../../config/socket.js';
import { logger } from '../../../../utils/logger.js';
import { SellerReturn } from '../../seller/models/sellerReturn.model.js';
import { QuickOrder } from '../../models/order.model.js';

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
 * Populates user/seller data so the rider UI can render NewOrderModal
 * with customer pickup address and seller drop address.
 */
export async function emitReturnAssignmentSocket(partnerId, sellerReturn) {
  try {
    const io = getIO();
    const room = rooms.delivery(partnerId);
    
    // Populate user and seller details for the rider UI
    let returnData;
    if (sellerReturn._id) {
      const populated = await SellerReturn.findById(sellerReturn._id)
        .populate('userId', 'name phone location deliveryAddresses')
        .populate('sellerId', 'shopName name phone location address')
        .populate('returnRequestId', 'images reason notes returnId orderId deliveryAddress')
        .lean();
      
      if (populated) {
        returnData = populated;
      } else {
        returnData = sellerReturn.toObject ? sellerReturn.toObject() : sellerReturn;
      }
    } else {
      returnData = sellerReturn.toObject ? sellerReturn.toObject() : sellerReturn;
    }
    
    // Build pickup/drop address info for the NewOrderModal
    const user = returnData.userId || {};
    const seller = returnData.sellerId || {};
    const returnReq = returnData.returnRequestId || {};

    // Fetch original QuickOrder to guarantee deliveryAddress contains proper location/coordinates
    let originalOrder = null;
    if (returnReq.orderMongoId) {
      originalOrder = await QuickOrder.findById(returnReq.orderMongoId).lean();
    }
    // Pickup = user's address (from original order's delivery address)
    const pickupAddress = originalOrder?.deliveryAddress || returnReq.deliveryAddress || {};
    
    // Dropoff = seller's location
    const dropoffAddress = {
      address: seller.address || seller.location?.address || seller.location?.formattedAddress || '',
      location: seller.location,
      name: seller.shopName || seller.name || 'Seller Store',
    };

    io.to(room).emit('new_return_assignment', {
      ...returnData,
      isReturn: true,
      orderId: returnData._id,
      assignedAt: new Date(),
      // Enriched fields for NewOrderModal rendering
      user: {
        name: user.name || returnData.customer?.name || 'Customer',
        phone: user.phone || returnData.customer?.phone || '',
      },
      seller: {
        shopName: seller.shopName || seller.name || 'Seller Store',
        name: seller.name || '',
        phone: seller.phone || '',
        location: seller.location,
      },
      pickupAddress: {
        name: user.name || returnData.customer?.name || 'Customer',
        address: pickupAddress.formattedAddress || pickupAddress.address || pickupAddress.street || 'Customer Address',
        location: pickupAddress.location,
      },
      dropoffAddress: dropoffAddress,
      returnReason: returnData.returnReason || returnReq.reason || '',
      returnId: returnReq.returnId || '',
      returnItems: returnData.returnItems || [],
      returnDeliveryCommission: returnData.returnDeliveryCommission || 0,
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit new_return_assignment: ${err.message}`);
  }
}

/**
 * Emit a return pickup OTP to the user.
 * Reuses the 'delivery_drop_otp' event so the user app catches it instantly.
 */
export function emitReturnPickupOtpToUser(userId, otp, orderId) {
  try {
    const io = getIO();
    io.to(rooms.user(userId)).emit('delivery_drop_otp', {
      orderId: orderId,
      otp: otp,
      message: 'Your return pickup OTP is'
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit return pickup OTP: ${err.message}`);
  }
}

/**
 * Emit a return handoff OTP to the seller.
 */
export function emitReturnHandoffOtpToSeller(sellerId, otp, sellerReturnId) {
  try {
    const io = getIO();
    io.to(rooms.seller(sellerId)).emit('seller_handoff_otp', {
      sellerReturnId: sellerReturnId,
      otp: otp,
      message: 'Your return handoff OTP is'
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit return handoff OTP: ${err.message}`);
  }
}

/**
 * Emit a leg status update to the admin tracking room.
 */
export function emitAdminTrackingUpdate(sellerReturnId, legStatus) {
  try {
    const io = getIO();
    // Admins join a global tracking room for return updates
    io.to('admin_returns').emit('return_leg_updated', {
      sellerReturnId,
      status: legStatus,
      updatedAt: new Date(),
    });
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit admin return_leg_updated: ${err.message}`);
  }
}

/**
 * Emit a leg tracking update to both admin AND user rooms.
 * Called after every delivery partner status update so admin and user
 * can see live progress of the return pickup/delivery.
 */
export function emitReturnLegTrackingUpdate(leg, newStatus) {
  try {
    const io = getIO();
    const payload = {
      sellerReturnId: leg._id,
      returnRequestId: leg.returnRequestId,
      status: newStatus,
      deliveryPartnerId: leg.assignment?.deliveryPartnerId,
      updatedAt: new Date(),
    };

    // 1. Notify admins
    io.to('admin_returns').emit('return_leg_updated', payload);

    // 2. Notify the user who made the return request
    if (leg.userId) {
      const userId = typeof leg.userId === 'object' ? leg.userId._id || leg.userId : leg.userId;
      io.to(rooms.user(userId)).emit('return_leg_tracking', payload);
    }

    // 3. Notify seller
    if (leg.sellerId) {
      const sellerId = typeof leg.sellerId === 'object' ? leg.sellerId._id || leg.sellerId : leg.sellerId;
      io.to(rooms.seller(sellerId)).emit('return_leg_tracking', payload);
    }
  } catch (err) {
    logger.error(`[ReturnSocket] Failed to emit return_leg_tracking: ${err.message}`);
  }
}
