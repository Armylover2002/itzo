/**
 * Return Notification Service
 *
 * Orchestrates sending push notifications and in-app alerts for return
 * lifecycle events (user updates, rider assignments, seller alerts).
 */

import { sendPushNotification } from '../../../../core/notifications/firebase.service.js';
import { FoodUser } from '../../../food/user/models/user.model.js';
import { Seller } from '../../seller/models/seller.model.js';
import { FoodDeliveryPartner } from '../../../food/delivery/models/deliveryPartner.model.js';
import { logger } from '../../../../utils/logger.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getTokensForUser(userId) {
  const user = await FoodUser.findById(userId).select('fcmToken').lean();
  return user?.fcmToken ? [user.fcmToken] : [];
}

async function getTokensForSeller(sellerId) {
  const seller = await Seller.findById(sellerId).select('fcmTokens').lean();
  return seller?.fcmTokens || [];
}

async function getTokensForRider(partnerId) {
  const partner = await FoodDeliveryPartner.findById(partnerId).select('fcmToken').lean();
  return partner?.fcmToken ? [partner.fcmToken] : [];
}

function fireAndForget(promise, context) {
  promise.catch((err) => {
    logger.error(`[ReturnNotification] Failed to send ${context}: ${err.message}`);
  });
}

// ─── Event Orchestrators ────────────────────────────────────────────────────

/**
 * Triggered when a new return request is created.
 */
export async function notifyReturnCreated(returnRequest) {
  const userTokens = await getTokensForUser(returnRequest.userId);
  if (userTokens.length) {
    fireAndForget(
      sendPushNotification(userTokens, {
        notification: {
          title: 'Return Request Received',
          body: `Your return request (ID: ${returnRequest.returnId}) is under review.`,
        },
        data: {
          type: 'RETURN_CREATED',
          returnId: returnRequest.returnId,
          orderId: returnRequest.orderId,
        },
      }),
      'user_return_created'
    );
  }
}

/**
 * Triggered when admin approves/rejects items.
 */
export async function notifyReturnReviewed(returnRequest, isApproved, isPartial) {
  const userTokens = await getTokensForUser(returnRequest.userId);
  if (!userTokens.length) return;

  const title = isPartial 
    ? 'Return Partially Approved' 
    : isApproved 
      ? 'Return Approved' 
      : 'Return Rejected';
      
  const body = isApproved || isPartial
    ? `We will assign a delivery partner shortly for pickup.`
    : `Your return request was not eligible. Tap for details.`;

  fireAndForget(
    sendPushNotification(userTokens, {
      notification: { title, body },
      data: {
        type: 'RETURN_REVIEWED',
        returnId: returnRequest.returnId,
        status: returnRequest.status,
      },
    }),
    'user_return_reviewed'
  );
}

/**
 * Triggered when a rider accepts the pickup assignment.
 */
export async function notifyPickupAssigned(sellerReturn) {
  // Notify User
  const userTokens = await getTokensForUser(sellerReturn.userId);
  if (userTokens.length) {
    fireAndForget(
      sendPushNotification(userTokens, {
        notification: {
          title: 'Pickup Agent Assigned',
          body: `A delivery partner is on the way to pick up your return for order ${sellerReturn.orderId}.`,
        },
        data: {
          type: 'RETURN_PICKUP_ASSIGNED',
          sellerReturnId: sellerReturn._id.toString(),
        },
      }),
      'user_pickup_assigned'
    );
  }
}

/**
 * Triggered when rider is at user location.
 */
export async function notifyRiderArrivedAtUser(sellerReturn) {
  const userTokens = await getTokensForUser(sellerReturn.userId);
  if (userTokens.length) {
    fireAndForget(
      sendPushNotification(userTokens, {
        notification: {
          title: 'Agent Arrived',
          body: `The pickup agent has reached your location. Please share the pickup OTP.`,
        },
        data: {
          type: 'RETURN_AGENT_ARRIVED',
          sellerReturnId: sellerReturn._id.toString(),
        },
      }),
      'user_rider_arrived'
    );
  }
}

/**
 * Triggered when items are picked up (heading to seller).
 */
export async function notifyPickedUp(sellerReturn) {
  // Notify User
  const userTokens = await getTokensForUser(sellerReturn.userId);
  if (userTokens.length) {
    fireAndForget(
      sendPushNotification(userTokens, {
        notification: {
          title: 'Return Picked Up',
          body: `Your items have been picked up successfully.`,
        },
        data: {
          type: 'RETURN_PICKED_UP',
          sellerReturnId: sellerReturn._id.toString(),
        },
      }),
      'user_picked_up'
    );
  }

  // Notify Seller
  const sellerTokens = await getTokensForSeller(sellerReturn.sellerId);
  if (sellerTokens.length) {
    fireAndForget(
      sendPushNotification(sellerTokens, {
        notification: {
          title: 'Incoming Return',
          body: `A return for order ${sellerReturn.orderId} has been picked up and is on its way to your store.`,
        },
        data: {
          type: 'RETURN_INCOMING',
          sellerReturnId: sellerReturn._id.toString(),
        },
      }),
      'seller_return_incoming'
    );
  }
}

/**
 * Triggered when rider reaches seller store.
 */
export async function notifyRiderArrivedAtSeller(sellerReturn) {
  const sellerTokens = await getTokensForSeller(sellerReturn.sellerId);
  if (sellerTokens.length) {
    fireAndForget(
      sendPushNotification(sellerTokens, {
        notification: {
          title: 'Agent Arrived for Return',
          body: `The delivery partner has arrived with the return for order ${sellerReturn.orderId}. Please verify OTP.`,
        },
        data: {
          type: 'RETURN_AGENT_AT_STORE',
          sellerReturnId: sellerReturn._id.toString(),
        },
      }),
      'seller_rider_arrived'
    );
  }
}

/**
 * Triggered when return leg completes.
 */
export async function notifyReturnCompleted(sellerReturn) {
  // Notify Seller
  const sellerTokens = await getTokensForSeller(sellerReturn.sellerId);
  if (sellerTokens.length) {
    fireAndForget(
      sendPushNotification(sellerTokens, {
        notification: {
          title: 'Return Handed Over',
          body: `The return for order ${sellerReturn.orderId} was successfully handed over to you.`,
        },
        data: {
          type: 'RETURN_COMPLETED',
          sellerReturnId: sellerReturn._id.toString(),
        },
      }),
      'seller_return_completed'
    );
  }
}

/**
 * Triggered when refund completes.
 */
export async function notifyRefundProcessed(returnRequest, amount) {
  const userTokens = await getTokensForUser(returnRequest.userId);
  if (userTokens.length && amount > 0) {
    fireAndForget(
      sendPushNotification(userTokens, {
        notification: {
          title: 'Refund Processed',
          body: `A refund of ₹${amount} has been initiated for your return (ID: ${returnRequest.returnId}).`,
        },
        data: {
          type: 'RETURN_REFUNDED',
          returnId: returnRequest.returnId,
        },
      }),
      'user_refund_processed'
    );
  }
}

/**
 * Fallback / optional SMS sender placeholder.
 * Since the existing SMS sender uses a strictly formatted DLT template for 'registration',
 * we just log or ignore until a new DLT template is configured for Returns.
 */
export async function sendReturnSms(phone, message) {
  // TODO: Integrate actual SMS gateway with approved DLT templates.
  logger.info(`[ReturnNotification] (Mock SMS to ${phone}): ${message}`);
}
