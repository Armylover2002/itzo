import mongoose from 'mongoose';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { getIO, rooms } from '../../../config/socket.js';
import { getFirebaseDB } from '../../../config/firebase.js';
import { fetchPolyline } from '../../food/orders/utils/googleMaps.js';
import { tryAutoAssign } from '../../food/orders/services/order-dispatch.service.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../utils/helpers.js';
import { creditWallet } from '../../../core/payments/wallet.service.js';
import { Transaction } from '../../../core/payments/models/transaction.model.js';
import { FoodDeliveryWallet } from '../../food/delivery/models/deliveryWallet.model.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { DISPATCH_DOCUMENT_TYPES } from '../utils/dispatchDocument.constants.js';
import { RETURN_STATUSES } from '../utils/return.helpers.js';
import { syncParentOrderReturnStatus } from '../utils/orderReturnSummary.helpers.js';
import { appendReturnHistory } from './quickReturn.service.js';
import { passReturnQualityCheckAndRefund } from './quickReturnFinance.service.js';
import {
  buildReturnDeliverySocketPayload,
  loadReturnPickupContext,
  normalizePickupImageEntries,
  resolveReturnPickupCharge,
  serializeReturnForDelivery,
  verifyReturnOtp,
} from '../utils/returnPickup.helpers.js';

const COMPLETED_RETURN_DISPATCH = 'completed';

const toPartnerId = (value) => new mongoose.Types.ObjectId(value);

const isPartnerOfferedForReturn = (returnDoc, deliveryPartnerId) =>
  (returnDoc?.dispatch?.offeredTo || []).some(
    (entry) =>
      String(entry?.partnerId) === String(deliveryPartnerId) &&
      ['offered', 'assigned'].includes(String(entry?.action || '')),
  );

const loadReturnForPartner = async (returnId, { selectOtp = false } = {}) => {
  const id = String(returnId || '').trim();
  if (!mongoose.isValidObjectId(id)) throw new ValidationError('Invalid return id');

  let query = SellerReturn.findById(id);
  if (selectOtp) query = query.select('+customerOtp +sellerOtp');
  const returnDoc = await query;
  if (!returnDoc) throw new NotFoundError('Return pickup not found');
  return returnDoc;
};

const isReturnAssignedToPartner = (returnDoc, deliveryPartnerId) =>
  String(returnDoc?.dispatch?.deliveryPartnerId || '') === String(deliveryPartnerId || '');

const emitReturnClaimedToOtherPartners = (returnDoc, { acceptedBy } = {}) => {
  try {
    const io = getIO();
    if (!io) return;

    const acceptedById = String(acceptedBy || '');
    const payload = {
      orderId: returnDoc.orderId,
      orderMongoId: String(returnDoc._id),
      returnId: String(returnDoc._id),
      documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
      tripType: 'return_pickup',
      claimedBy: acceptedById,
    };

    const partnerIds = [
      ...new Set(
        (returnDoc.dispatch?.offeredTo || [])
          .map((entry) => String(entry?.partnerId || ''))
          .filter((id) => id && id !== acceptedById),
      ),
    ];

    for (const partnerId of partnerIds) {
      io.to(rooms.delivery(partnerId)).emit('order_claimed', payload);
      io.to(rooms.delivery(partnerId)).emit('order_reassigned_elsewhere', payload);
    }
  } catch (error) {
    logger.warn(`emitReturnClaimedToOtherPartners failed: ${error?.message || error}`);
  }
};

const emitReturnStatusUpdate = async (returnDoc, deliveryPartnerId) => {
  try {
    const io = getIO();
    if (!io) return;

    const context = await loadReturnPickupContext(returnDoc);
    const view = await buildReturnDeliverySocketPayload(returnDoc, context);
    const payload = {
      ...view,
      orderMongoId: String(returnDoc._id),
      returnId: String(returnDoc._id),
      documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
      tripType: 'return_pickup',
      dispatchStatus: returnDoc.dispatch?.status,
      returnStatus: returnDoc.returnStatus,
      deliveryState: returnDoc.deliveryState,
    };

    io.to(rooms.delivery(deliveryPartnerId)).emit('order_status_update', payload);
    if (returnDoc.userId) io.to(rooms.user(returnDoc.userId)).emit('order_status_update', payload);
    if (returnDoc.sellerId) io.to(rooms.seller(returnDoc.sellerId)).emit('order_status_update', payload);
  } catch (error) {
    logger.warn(`emitReturnStatusUpdate failed: ${error?.message || error}`);
  }
};

const initReturnFirebaseTracking = async (returnDoc, context, deliveryPartnerId) => {
  try {
    const customerCoords = context?.customerCoords;
    const sellerCoords = context?.sellerCoords;
    if (!customerCoords || !sellerCoords) return;

    const polyline = await fetchPolyline(
      { lat: customerCoords.lat, lng: customerCoords.lng },
      { lat: sellerCoords.lat, lng: sellerCoords.lng },
    );

    const db = getFirebaseDB();
    if (!db) return;

    const trackingKey = String(returnDoc.orderId || '').trim();
    if (!trackingKey) return;

    await db.ref(`active_orders/${trackingKey}`).set({
      polyline,
      lat: customerCoords.lat,
      lng: customerCoords.lng,
      boy_lat: customerCoords.lat,
      boy_lng: customerCoords.lng,
      restaurant_lat: sellerCoords.lat,
      restaurant_lng: sellerCoords.lng,
      customer_lat: customerCoords.lat,
      customer_lng: customerCoords.lng,
      status: 'accepted',
      documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
      tripType: 'return_pickup',
      returnId: String(returnDoc._id),
      orderId: returnDoc.orderId,
      deliveryPartnerId: String(deliveryPartnerId),
      last_updated: Date.now(),
    });
    await db.ref(`active_orders/ret_${String(returnDoc._id)}`).remove().catch(() => {});
  } catch (error) {
    logger.error(`Return Firebase tracking init failed: ${error?.message || error}`);
  }
};

const clearReturnFirebaseTracking = async (returnDoc) => {
  try {
    const db = getFirebaseDB();
    if (!db) return;
    const trackingKey = String(returnDoc.orderId || '').trim();
    await Promise.all([
      trackingKey ? db.ref(`active_orders/${trackingKey}`).remove() : Promise.resolve(),
      db.ref(`active_orders/ret_${String(returnDoc._id)}`).remove(),
    ]);
  } catch (error) {
    logger.warn(`Return Firebase cleanup failed: ${error?.message || error}`);
  }
};

const verifyReturnOtpAndPersist = async (returnDoc, options) => {
  try {
    verifyReturnOtp({ returnDoc, ...options });
    return true;
  } catch (error) {
    if (options?.incrementOnFailure !== false) {
      await returnDoc.save();
    }
    throw error;
  }
};

const creditReturnPickupRiderEarning = async (returnDoc, deliveryPartnerId) => {
  const context = await loadReturnPickupContext(returnDoc);
  const amount = resolveReturnPickupCharge({
    ...(returnDoc?.toObject?.() || returnDoc),
    calculatedPickupCharge: context.calculatedPickupCharge || returnDoc.calculatedPickupCharge,
    riderEarning: context.riderEarning || returnDoc.riderEarning,
  });

  if (context.pickupDistanceKm >= 0) {
    returnDoc.pickupDistanceKm = context.pickupDistanceKm;
  }
  if (context.pickupPricingBreakdown) {
    returnDoc.pickupPricingBreakdown = context.pickupPricingBreakdown;
  }
  if (context.calculatedPickupCharge > 0) {
    returnDoc.calculatedPickupCharge = context.calculatedPickupCharge;
  }
  if (amount > 0) {
    returnDoc.riderEarning = amount;
    await returnDoc.save();
  }
  if (!amount || amount <= 0) return;

  const breakdown = returnDoc.pickupPricingBreakdown || null;
  const distanceKm = Number(returnDoc.pickupDistanceKm || breakdown?.distanceKm || 0);

  const partnerId = toPartnerId(deliveryPartnerId);
  const returnId = String(returnDoc._id);
  const resolvedBreakdown = returnDoc?.pickupPricingBreakdown || breakdown;

  const existing = await Transaction.findOne({
    entityType: 'deliveryBoy',
    entityId: partnerId,
    category: 'delivery_earning',
    'metadata.returnId': returnId,
  })
    .select('_id')
    .lean();

  if (existing) return;

  await creditWallet({
    entityType: 'deliveryBoy',
    entityId: partnerId,
    amount,
    description: `Return pickup ${returnDoc.orderId || returnId}`,
    category: 'delivery_earning',
    metadata: {
      returnId,
      orderId: returnDoc.orderId,
      tripType: 'return_pickup',
      documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
      calculatedPickupCharge: amount,
      pickupDistanceKm: Number(returnDoc?.pickupDistanceKm || distanceKm),
      pickupPricingBreakdown: resolvedBreakdown,
    },
  });

  await FoodDeliveryWallet.updateOne(
    { deliveryPartnerId: partnerId },
    { $inc: { totalDeliveries: 1 } },
    { upsert: true },
  );
};

export const getCurrentReturnPickupTrip = async (deliveryPartnerId) => {
  const partnerId = toPartnerId(deliveryPartnerId);
  const returnDoc = await SellerReturn.findOne({
    'dispatch.deliveryPartnerId': partnerId,
    'dispatch.status': { $in: ['accepted', 'assigned'] },
    returnStatus: { $in: [RETURN_STATUSES.PICKUP_ASSIGNED, RETURN_STATUSES.IN_TRANSIT] },
  }).sort({ updatedAt: -1 });

  if (!returnDoc) return null;
  const context = await loadReturnPickupContext(returnDoc);
  return await serializeReturnForDelivery(returnDoc, context);
};

export const listAvailableReturnPickups = async (deliveryPartnerId, query = {}) => {
  const { page, limit, skip } = buildPaginationOptions(query);
  const partnerObjectId = toPartnerId(deliveryPartnerId);

  const returns = await SellerReturn.find({
    returnStatus: {
      $in: [RETURN_STATUSES.APPROVED, RETURN_STATUSES.PICKUP_ASSIGNED, RETURN_STATUSES.IN_TRANSIT],
    },
    'dispatch.status': { $in: ['unassigned', 'assigned', 'accepted'] },
    $or: [
      { 'dispatch.status': { $in: ['unassigned', 'assigned'] } },
      { 'dispatch.deliveryPartnerId': partnerObjectId },
      {
        'dispatch.offeredTo': {
          $elemMatch: {
            partnerId: partnerObjectId,
            action: { $in: ['offered', 'assigned'] },
          },
        },
      },
    ],
  })
    .sort({ updatedAt: -1 })
    .lean();

  const docs = [];
  for (const row of returns) {
    const assigned = String(row?.dispatch?.deliveryPartnerId || '') === String(deliveryPartnerId);
    const offered = isPartnerOfferedForReturn(row, deliveryPartnerId);

    if (!offered && !assigned) continue;

    const context = await loadReturnPickupContext(row);
    const view = await buildReturnDeliverySocketPayload(row, context);
    docs.push(view);
  }

  return buildPaginatedResult({
    docs: docs.slice(skip, skip + limit),
    total: docs.length,
    page,
    limit,
  });
};

export const acceptReturnPickupDelivery = async (returnId, deliveryPartnerId, body = {}) => {
  void body;
  const partnerId = toPartnerId(deliveryPartnerId);
  const id = String(returnId || '').trim();
  if (!mongoose.isValidObjectId(id)) throw new ValidationError('Invalid return id');

  const returnDoc = await SellerReturn.findOneAndUpdate(
    {
      _id: id,
      'dispatch.status': { $ne: 'accepted' },
      returnStatus: {
        $in: [RETURN_STATUSES.PICKUP_ASSIGNED, RETURN_STATUSES.IN_TRANSIT],
      },
      $or: [
        { 'dispatch.deliveryPartnerId': partnerId },
        {
          'dispatch.offeredTo': {
            $elemMatch: {
              partnerId,
              action: { $in: ['offered', 'assigned'] },
            },
          },
        },
      ],
    },
    {
      $set: {
        'dispatch.deliveryPartnerId': partnerId,
        'dispatch.status': 'accepted',
        'dispatch.assignedAt': new Date(),
        'dispatch.acceptedAt': new Date(),
        returnStatus: RETURN_STATUSES.IN_TRANSIT,
        'deliveryState.currentPhase': 'en_route_to_pickup',
        'deliveryState.status': 'accepted',
      },
    },
    { new: true },
  );

  if (!returnDoc) {
    const existing = await SellerReturn.findById(id);
    if (existing?.dispatch?.status === 'accepted') {
      if (isReturnAssignedToPartner(existing, deliveryPartnerId)) {
        const context = await loadReturnPickupContext(existing);
        if (!Number(existing.riderEarning || 0) && Number(context?.riderEarning || 0) > 0) {
          existing.riderEarning = context.riderEarning;
          await existing.save();
        }
        return await serializeReturnForDelivery(existing, context);
      }
      throw new ForbiddenError('Return pickup already accepted by another rider');
    }
    throw new ValidationError('Return pickup is not available for assignment');
  }

  const acceptContext = await loadReturnPickupContext(returnDoc);
  if (!Number(returnDoc.riderEarning || 0) && Number(acceptContext?.riderEarning || 0) > 0) {
    returnDoc.riderEarning = acceptContext.riderEarning;
  }
  if (acceptContext?.pickupDistanceKm >= 0) {
    returnDoc.pickupDistanceKm = acceptContext.pickupDistanceKm;
  }
  if (acceptContext?.pickupPricingBreakdown) {
    returnDoc.pickupPricingBreakdown = acceptContext.pickupPricingBreakdown;
  }
  if (acceptContext?.calculatedPickupCharge > 0) {
    returnDoc.calculatedPickupCharge = acceptContext.calculatedPickupCharge;
  }

  appendReturnHistory(returnDoc, {
    byRole: 'DELIVERY_PARTNER',
    byId: deliveryPartnerId,
    action: 'RETURN_PICKUP_ACCEPTED',
    fromStatus: 'unassigned',
    toStatus: 'accepted',
  });

  emitReturnClaimedToOtherPartners(returnDoc, { acceptedBy: deliveryPartnerId });
  await returnDoc.save();
  void syncParentOrderReturnStatus(returnDoc.orderId, RETURN_STATUSES.IN_TRANSIT).catch((error) => {
    logger.warn(
      `acceptReturnPickupDelivery: parent returnStatus sync failed for ${returnDoc.orderId}: ${error?.message || error}`,
    );
  });

  const context = await loadReturnPickupContext(returnDoc);
  await initReturnFirebaseTracking(returnDoc, context, deliveryPartnerId);
  await emitReturnStatusUpdate(returnDoc, deliveryPartnerId);

  return await serializeReturnForDelivery(returnDoc, context);
};

export const rejectReturnPickupDelivery = async (returnId, deliveryPartnerId) => {
  const returnDoc = await loadReturnForPartner(returnId);
  const isAssigned = isReturnAssignedToPartner(returnDoc, deliveryPartnerId);
  const isOffered = isPartnerOfferedForReturn(returnDoc, deliveryPartnerId);

  if (!isAssigned && !isOffered) {
    throw new ForbiddenError('Not your return pickup');
  }

  const offer = (returnDoc.dispatch?.offeredTo || []).find(
    (entry) =>
      String(entry?.partnerId) === String(deliveryPartnerId) && entry?.action === 'offered',
  );
  if (offer) offer.action = 'rejected';

  returnDoc.dispatch.status = 'unassigned';
  returnDoc.dispatch.deliveryPartnerId = null;
  returnDoc.dispatch.assignedAt = null;
  returnDoc.dispatch.acceptedAt = null;

  appendReturnHistory(returnDoc, {
    byRole: 'DELIVERY_PARTNER',
    byId: deliveryPartnerId,
    action: 'RETURN_PICKUP_REJECTED',
    fromStatus: 'assigned',
    toStatus: 'unassigned',
  });

  await returnDoc.save();

  void tryAutoAssign(String(returnDoc._id), {
    documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
  }).catch((err) => logger.error(`Return pickup re-dispatch failed: ${err.message}`));

  return await serializeReturnForDelivery(returnDoc);
};

export const confirmReachedPickupReturn = async (returnId, deliveryPartnerId) => {
  const returnDoc = await loadReturnForPartner(returnId);
  if (!isReturnAssignedToPartner(returnDoc, deliveryPartnerId)) {
    throw new ForbiddenError('Not your return pickup');
  }
  if (returnDoc.dispatch?.status !== 'accepted') {
    throw new ValidationError('Return pickup must be accepted first');
  }

  const currentPhase = returnDoc.deliveryState?.currentPhase || '';
  if (currentPhase === 'at_pickup' || returnDoc.deliveryState?.status === 'reached_pickup') {
    return await serializeReturnForDelivery(returnDoc);
  }

  returnDoc.deliveryState = {
    ...(returnDoc.deliveryState?.toObject?.() || returnDoc.deliveryState || {}),
    currentPhase: 'at_pickup',
    status: 'reached_pickup',
    reachedPickupAt: returnDoc.deliveryState?.reachedPickupAt || new Date(),
  };

  appendReturnHistory(returnDoc, {
    byRole: 'DELIVERY_PARTNER',
    byId: deliveryPartnerId,
    action: 'RETURN_REACHED_CUSTOMER',
    note: 'Rider reached customer pickup location',
  });

  await returnDoc.save();
  await emitReturnStatusUpdate(returnDoc, deliveryPartnerId);
  return await serializeReturnForDelivery(returnDoc);
};

export const confirmPickupReturn = async (returnId, deliveryPartnerId, body = {}) => {
  const returnDoc = await loadReturnForPartner(returnId, { selectOtp: true });
  if (!isReturnAssignedToPartner(returnDoc, deliveryPartnerId)) {
    throw new ForbiddenError('Not your return pickup');
  }

  const otp = body?.otp || body?.customerOtp;
  await verifyReturnOtpAndPersist(returnDoc, { role: 'customer', otp });

  const imageEntries = normalizePickupImageEntries(body?.pickupImages || body?.images || body?.billImageUrl, {
    actorId: deliveryPartnerId,
    actorRole: 'DELIVERY_PARTNER',
  });

  returnDoc.pickupImageEntries = [
    ...(returnDoc.pickupImageEntries || []),
    ...imageEntries,
  ];
  returnDoc.pickupImages = [
    ...new Set([...(returnDoc.pickupImages || []), ...imageEntries.map((entry) => entry.url)]),
  ];

  returnDoc.deliveryState = {
    ...(returnDoc.deliveryState?.toObject?.() || returnDoc.deliveryState || {}),
    currentPhase: 'en_route_to_delivery',
    status: 'picked_up',
    pickedUpAt: new Date(),
  };

  returnDoc.markModified('deliveryState');
  returnDoc.markModified('pickupImageEntries');
  returnDoc.markModified('pickupImages');

  appendReturnHistory(returnDoc, {
    byRole: 'DELIVERY_PARTNER',
    byId: deliveryPartnerId,
    action: 'RETURN_PICKED_UP',
    note: 'Customer OTP verified and pickup images uploaded',
    metadata: { imageCount: imageEntries.length },
  });

  await returnDoc.save();
  await emitReturnStatusUpdate(returnDoc, deliveryPartnerId);
  return await serializeReturnForDelivery(returnDoc);
};

export const confirmReachedDropReturn = async (returnId, deliveryPartnerId) => {
  const returnDoc = await loadReturnForPartner(returnId);
  if (!isReturnAssignedToPartner(returnDoc, deliveryPartnerId)) {
    throw new ForbiddenError('Not your return pickup');
  }

  if (returnDoc.deliveryState?.status !== 'picked_up') {
    throw new ValidationError('Pickup must be confirmed before reaching seller drop');
  }

  returnDoc.deliveryState = {
    ...(returnDoc.deliveryState?.toObject?.() || returnDoc.deliveryState || {}),
    currentPhase: 'at_drop',
    status: 'reached_drop',
    reachedDropAt: returnDoc.deliveryState?.reachedDropAt || new Date(),
  };

  returnDoc.markModified('deliveryState');

  appendReturnHistory(returnDoc, {
    byRole: 'DELIVERY_PARTNER',
    byId: deliveryPartnerId,
    action: 'RETURN_REACHED_SELLER',
    note: 'Rider reached seller drop location',
  });

  await returnDoc.save();
  await emitReturnStatusUpdate(returnDoc, deliveryPartnerId);
  return await serializeReturnForDelivery(returnDoc);
};

export const completeReturnPickup = async (returnId, deliveryPartnerId, body = {}) => {
  const returnDoc = await loadReturnForPartner(returnId, { selectOtp: true });
  if (!isReturnAssignedToPartner(returnDoc, deliveryPartnerId)) {
    throw new ForbiddenError('Not your return pickup');
  }

  if (returnDoc.dispatch?.status === COMPLETED_RETURN_DISPATCH && returnDoc.returnStatus === RETURN_STATUSES.RETURNED) {
    return await serializeReturnForDelivery(returnDoc);
  }

  const deliveryStatus = String(returnDoc.deliveryState?.status || '').trim();
  const deliveryPhase = String(returnDoc.deliveryState?.currentPhase || '').trim();
  const hasPickupHistory = (returnDoc.returnHistory || []).some(
    (entry) => entry?.action === 'RETURN_PICKED_UP',
  );
  const pickupConfirmed =
    ['picked_up', 'reached_drop'].includes(deliveryStatus) ||
    ['en_route_to_delivery', 'at_drop'].includes(deliveryPhase) ||
    Boolean(returnDoc.deliveryState?.pickedUpAt) ||
    hasPickupHistory;

  if (!pickupConfirmed) {
    throw new ValidationError('Customer pickup must be confirmed before completing return pickup');
  }

  if (!returnDoc.pickupImageEntries?.length) {
    throw new ValidationError('Pickup images are required before completing return pickup');
  }

  const otp = body?.otp || body?.sellerOtp;
  await verifyReturnOtpAndPersist(returnDoc, { role: 'seller', otp });

  const previousStatus = returnDoc.returnStatus;
  returnDoc.returnStatus = RETURN_STATUSES.RETURNED;
  returnDoc.dispatch.status = COMPLETED_RETURN_DISPATCH;
  returnDoc.dispatch.completedAt = new Date();
  returnDoc.deliveryState = {
    ...(returnDoc.deliveryState?.toObject?.() || returnDoc.deliveryState || {}),
    currentPhase: 'completed',
    status: 'completed',
    completedAt: new Date(),
  };

  appendReturnHistory(returnDoc, {
    byRole: 'DELIVERY_PARTNER',
    byId: deliveryPartnerId,
    action: 'RETURN_PICKUP_COMPLETED',
    fromStatus: previousStatus,
    toStatus: RETURN_STATUSES.RETURNED,
    note: 'Seller OTP verified; return pickup completed',
  });

  await returnDoc.save();
  void syncParentOrderReturnStatus(returnDoc.orderId, RETURN_STATUSES.RETURNED).catch((error) => {
    logger.warn(
      `completeReturnPickupDelivery: parent returnStatus sync failed for ${returnDoc.orderId}: ${error?.message || error}`,
    );
  });
  await clearReturnFirebaseTracking(returnDoc);
  await creditReturnPickupRiderEarning(returnDoc, deliveryPartnerId);
  await emitReturnStatusUpdate(returnDoc, deliveryPartnerId);

  try {
    await passReturnQualityCheckAndRefund({
      returnId: String(returnDoc._id),
      actorId: deliveryPartnerId,
      actorRole: 'DELIVERY_PARTNER',
      notes: 'Auto quality pass after rider return pickup completion',
      force: true,
    });
  } catch (error) {
    logger.warn(`Return finance pipeline after pickup completion: ${error?.message || error}`);
  }

  return await serializeReturnForDelivery(returnDoc);
};

export const isSellerReturnDocumentId = async (documentId) => {
  if (!mongoose.isValidObjectId(String(documentId || ''))) return false;
  const exists = await SellerReturn.findById(documentId).select('_id').lean();
  return Boolean(exists);
};
