import mongoose from 'mongoose';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { QuickOrder } from '../models/order.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { resolveHeaderReturnPolicyByProductIds } from '../admin/services/commission.service.js';
import { resolveQuickOrderCustomer } from '../utils/customer.helpers.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { emitQuickCommerceStatusUpdate } from './quickStatusRealtime.service.js';
import {
  applyReturnSellerFinance,
  buildReturnRefundReference,
  confirmPendingReturnPayout,
  executeReturnCustomerRefund,
  passReturnQualityCheckAndRefund,
} from './quickReturnFinance.service.js';
import { tryAutoAssign, renotifyExistingReturnPickupOffers } from '../../food/orders/services/order-dispatch.service.js';
import { FoodDeliveryPartner } from '../../food/delivery/models/deliveryPartner.model.js';
import { DISPATCH_DOCUMENT_TYPES } from '../utils/dispatchDocument.constants.js';
import { stampReturnOtps, applyReturnPickupPricingToDoc } from '../utils/returnPickup.helpers.js';
import {
  buildPriorReturnedQuantityMap,
  buildReturnItemsWithRefundCalculation,
  normalizeReturnRequestItems,
} from '../utils/returnRefundCalculation.helpers.js';
import {
  ACTIVE_RETURN_STATUSES,
  DEFAULT_RETURN_WINDOW_HOURS,
  REFUND_METHODS,
  REFUND_STATUSES,
  RETURN_STATUSES,
  TERMINAL_RETURN_STATUSES,
  buildReturnItemKey,
  generateReturnOtp,
  getQuickItemsFromOrder,
  groupQuickItemsBySeller,
  isDeliveredOrder,
  isQuickCommerceOrderType,
  buildReturnEligibilityMeta,
  computeReturnExpiryAt,
  resolveOrderDeliveredAt,
  serializeReturnForCustomer,
  serializeReturnForAdmin,
  enrichSerializedReturnPricingFromParentOrder,
  enrichSerializedReturnCustomerFromParentOrder,
  extractPayoutDetailsFromReturn,
} from '../utils/return.helpers.js';
import { syncParentOrderReturnStatus } from '../utils/orderReturnSummary.helpers.js';

const buildOrderIdentityQuery = (rawOrderId) => {
  const orderId = String(rawOrderId || '').trim();
  if (!orderId) return null;
  const clauses = [{ orderId }];
  if (mongoose.isValidObjectId(orderId)) clauses.unshift({ _id: orderId });
  return { $or: clauses };
};

const buildReturnHistoryEntry = ({
  byRole = 'SYSTEM',
  byId = null,
  action = '',
  fromStatus = '',
  toStatus = '',
  note = '',
  metadata = {},
}) => ({
  at: new Date(),
  byRole,
  byId: byId && mongoose.Types.ObjectId.isValid(byId) ? byId : undefined,
  action,
  fromStatus,
  toStatus,
  note,
  metadata,
});

export const appendReturnHistory = (returnDoc, entry) => {
  if (!returnDoc) return returnDoc;
  if (!Array.isArray(returnDoc.returnHistory)) returnDoc.returnHistory = [];
  returnDoc.returnHistory.push(buildReturnHistoryEntry(entry));
  return returnDoc;
};

const loadPriorReturnedQuantityMap = async (orderId) => {
  const existingReturn = await SellerReturn.findOne({ orderId: String(orderId || '').trim() }).lean();
  if (!existingReturn) return new Map();
  return buildPriorReturnedQuantityMap([existingReturn]);
};

const resetReturnDocForNewCycle = (
  returnDoc,
  {
    userId,
    reason,
    method,
    returnItems,
    pricing,
    returnRefundAmount,
    payoutDetails = {},
  },
) => {
  const previousStatus = returnDoc.returnStatus;
  returnDoc.returnStatus = RETURN_STATUSES.REQUESTED;
  returnDoc.returnReason = reason;
  returnDoc.returnItems = returnItems;
  returnDoc.pricing = pricing;
  returnDoc.returnRefundAmount = returnRefundAmount;
  returnDoc.refundMethod = method;
  returnDoc.refundStatus = REFUND_STATUSES.NONE;
  returnDoc.refundTransactionId = '';
  returnDoc.refundReference = '';
  returnDoc.returnRejectedReason = '';
  returnDoc.finance = {
    sellerLedgerApplied: false,
    sellerLedgerAppliedAt: null,
    settlementMode: '',
    preSettlementDeducted: 0,
    postSettlementDebited: 0,
    pickupFeeDebited: 0,
  };
  returnDoc.dispatch = {
    modeAtCreation: 'auto',
    status: 'unassigned',
    deliveryPartnerId: null,
    offeredTo: [],
  };
  returnDoc.deliveryState = {
    currentPhase: 'en_route_to_pickup',
    status: '',
    reachedPickupAt: null,
    pickedUpAt: null,
    reachedDropAt: null,
    completedAt: null,
  };
  returnDoc.qualityCheck = {
    status: 'pending',
    notes: '',
    checkedAt: null,
    checkedByRole: '',
    checkedById: null,
  };
  returnDoc.customerOtp = '';
  returnDoc.sellerOtp = '';
  returnDoc.pickupImages = [];
  returnDoc.pickupImageEntries = [];
  appendReturnHistory(returnDoc, {
    byRole: 'USER',
    byId: userId,
    action: 'RETURN_REOPENED',
    fromStatus: previousStatus,
    toStatus: RETURN_STATUSES.REQUESTED,
    note: reason,
    metadata: {
      refundMethod: method,
      payoutDetails: method === 'wallet' ? {} : payoutDetails,
      itemCount: returnItems.length,
      returnRefundAmount,
    },
  });
  return returnDoc;
};

const validateRefundMethodSelection = (refundMethod, { userId, payoutDetails = {} } = {}) => {
  const method = String(refundMethod || '').trim().toLowerCase();
  if (!REFUND_METHODS.has(method)) {
    throw new ValidationError('refundMethod must be one of: wallet, upi, bank');
  }

  if (method === 'wallet' && !userId) {
    throw new ValidationError('Wallet refunds require a logged-in customer account');
  }

  if (method === 'upi') {
    const upiId = String(payoutDetails?.upiId || '').trim();
    if (!upiId) throw new ValidationError('upiId is required when refundMethod is upi');
    if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId)) {
      throw new ValidationError('Invalid UPI ID format');
    }
  }

  if (method === 'bank') {
    const accountHolderName = String(payoutDetails?.accountHolderName || '').trim();
    const accountNumber = String(payoutDetails?.accountNumber || '').trim();
    const ifscCode = String(payoutDetails?.ifscCode || '').trim().toUpperCase();
    if (!accountHolderName || !accountNumber || !ifscCode) {
      throw new ValidationError('bank account details are required when refundMethod is bank');
    }
    if (!/^[a-zA-Z\s]{2,50}$/.test(accountHolderName)) {
      throw new ValidationError('Account holder name must contain only letters and spaces');
    }
    if (!/^\d{9,18}$/.test(accountNumber)) {
      throw new ValidationError('Account number must be 9 to 18 digits');
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
      throw new ValidationError('Invalid IFSC code format');
    }
  }

  return method;
};

const normalizeProductId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  const id = String(value).trim();
  return mongoose.Types.ObjectId.isValid(id) ? id : '';
};

const registerItemEligibilityKeys = (map, item, eligibility) => {
  const canonical = buildReturnItemKey(item);
  const hasVariant = Boolean(String(item?.variantName || item?.variantId || '').trim());
  const keys = [canonical];
  if (!hasVariant) {
    keys.push(
      normalizeProductId(item?.itemId),
      normalizeProductId(item?.productId),
      String(item?.itemId || '').trim(),
      String(item?.productId || '').trim(),
    );
  }
  keys.filter(Boolean).forEach((key) => {
    map[key] = eligibility;
  });
};

const resolveHeaderReturnEligibility = async (order, sellerOrders = [], now = Date.now()) => {
  const quickItems = getQuickItemsFromOrder(order);
  const productIds = quickItems.map((item) => item?.itemId || item?.productId || item?._id);
  const ratesByProduct = await resolveHeaderReturnPolicyByProductIds(productIds);
  const deliveredAt = resolveOrderDeliveredAt(order, sellerOrders);
  const itemEligibility = {};

  const itemPolicies = quickItems.map((item) => {
    const productId = normalizeProductId(item?.itemId) || normalizeProductId(item?.productId);
    const liveRates = ratesByProduct.get(productId) || {
      returnsEnabled: true,
      returnWindowHours: DEFAULT_RETURN_WINDOW_HOURS,
    };
    const hasSnapshot =
      item?.returnsEnabled !== undefined ||
      (item?.returnWindowHours !== undefined && item?.returnWindowHours !== null && item?.returnWindowHours !== '');
    const returnsEnabled = hasSnapshot
      ? item.returnsEnabled !== false
      : liveRates.returnsEnabled !== false;
    const returnWindowHours = hasSnapshot
      ? Number(item.returnWindowHours) || DEFAULT_RETURN_WINDOW_HOURS
      : Number(liveRates.returnWindowHours) || DEFAULT_RETURN_WINDOW_HOURS;
    const expiryAt = computeReturnExpiryAt(deliveredAt, returnWindowHours);
    const remainingSeconds = expiryAt
      ? Math.max(0, Math.floor((expiryAt.getTime() - now) / 1000))
      : 0;
    const returnWindowExpired = Boolean(deliveredAt && remainingSeconds <= 0);
    const eligibility = {
      productId,
      headerId: item?.headerId || liveRates.headerId || null,
      variantName: String(item?.variantName || '').trim(),
      itemKey: buildReturnItemKey(item),
      canReturn: Boolean(returnsEnabled && !returnWindowExpired && remainingSeconds > 0),
      returnsEnabled,
      returnWindowHours,
      returnExpiryAt: expiryAt ? expiryAt.toISOString() : null,
      remainingSeconds,
      returnWindowExpired,
      orderedQty: Number(item?.quantity || 0),
      remainingReturnableQty: Number(item?.quantity || 0),
      policySource: hasSnapshot ? 'snapshot' : 'live',
    };
    registerItemEligibilityKeys(itemEligibility, item, eligibility);
    return eligibility;
  });

  const enabledItems = itemPolicies.filter((row) => row.returnsEnabled);
  const returnableItems = itemPolicies.filter((row) => row.canReturn);
  const returnsEnabled = enabledItems.length > 0;
  const windowSource = returnableItems.length ? returnableItems : enabledItems;

  let returnWindowHours = DEFAULT_RETURN_WINDOW_HOURS;
  if (windowSource.length) {
    const soonest = windowSource.reduce((best, current) => {
      const bestMs = best.returnExpiryAt ? new Date(best.returnExpiryAt).getTime() : Number.POSITIVE_INFINITY;
      const currentMs = current.returnExpiryAt ? new Date(current.returnExpiryAt).getTime() : Number.POSITIVE_INFINITY;
      return currentMs <= bestMs ? current : best;
    });
    returnWindowHours = soonest.returnWindowHours || DEFAULT_RETURN_WINDOW_HOURS;
  }

  return buildReturnEligibilityMeta({
    order,
    sellerOrders,
    returnPolicy: { returnsEnabled, returnWindowHours },
    itemEligibility,
    now,
  });
};

const loadReturnEligibleOrder = async ({ orderId, userId }) => {
  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required to request a return');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  }).lean();

  if (!order) throw new NotFoundError('Order not found');
  if (!isQuickCommerceOrderType(order.orderType)) {
    throw new ValidationError('Returns are only available for Quick Commerce orders');
  }
  if (!isDeliveredOrder(order)) {
    throw new ValidationError('Returns can only be requested for delivered orders');
  }

  const sellerOrders = await SellerOrder.find({
    orderId: order.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  }).lean();

  const deliveredAt = resolveOrderDeliveredAt(order, sellerOrders);
  const returnEligibility = await resolveHeaderReturnEligibility(order, sellerOrders);

  if (returnEligibility.returnsEnabled === false) {
    throw new ValidationError('Returns are currently disabled for these products', 'RETURNS_DISABLED');
  }

  if (!returnEligibility.canReturn) {
    const windowDays = Math.max(1, Math.round((returnEligibility.returnWindowHours || DEFAULT_RETURN_WINDOW_HOURS) / 24));
    throw new ValidationError(
      `Return window has expired. Returns were available for ${windowDays} day${windowDays === 1 ? '' : 's'} after delivery.`,
      'RETURN_WINDOW_EXPIRED',
    );
  }

  return { order, sellerOrders, returnEligibility, deliveredAt };
};

const findActiveReturnsForOrder = async (orderId) =>
  SellerReturn.find({
    orderId,
    returnStatus: { $in: Array.from(ACTIVE_RETURN_STATUSES) },
  }).lean();

export const createQuickCommerceReturnRequest = async ({
  orderId,
  userId,
  reason = '',
  refundMethod,
  items = [],
  pickupImages = [],
  payoutDetails = {},
}) => {
  const normalizedReason = String(reason || '').trim();
  if (normalizedReason.length < 3) {
    throw new ValidationError('Return reason must be at least 3 characters');
  }

  const method = validateRefundMethodSelection(refundMethod, { userId, payoutDetails });

  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  const ownedOrder = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  })
    .select('orderId')
    .lean();
  if (ownedOrder?.orderId) {
    const existingAny = await SellerReturn.findOne({ orderId: ownedOrder.orderId, userId }).lean();
    if (existingAny) {
      if (TERMINAL_RETURN_STATUSES.has(existingAny.returnStatus)) {
        throw new ValidationError(
          'A return request already exists for this order',
          'RETURN_ALREADY_EXISTS',
        );
      }
      return {
        alreadyExists: true,
        returns: [serializeReturnForCustomer(existingAny)],
        message: 'Return request already exists for the selected seller(s)',
      };
    }
  }

  const { order, sellerOrders, returnEligibility } = await loadReturnEligibleOrder({ orderId, userId });

  const quickItems = getQuickItemsFromOrder(order);
  if (!quickItems.length) {
    throw new ValidationError('This order has no Quick Commerce items eligible for return');
  }

  const activeReturns = await findActiveReturnsForOrder(order.orderId);
  const activeSellerIds = new Set(activeReturns.map((row) => String(row.sellerId)));

  const sellerBuckets = groupQuickItemsBySeller(quickItems);
  if (sellerBuckets.size > 1) {
    throw new ValidationError(
      'This order contains items from multiple sellers. Returns are supported for one seller per order.',
    );
  }

  const priorReturnedMap = await loadPriorReturnedQuantityMap(order.orderId);
  const normalizedItems = normalizeReturnRequestItems(items, quickItems, priorReturnedMap);

  const requestedBySeller = new Map();

  normalizedItems.forEach((requestedItem) => {
    const key = String(requestedItem?.itemId || '').trim();
    const matchedItem = quickItems.find((item) => buildReturnItemKey(item) === key);
    if (!matchedItem) {
      throw new ValidationError(`Item ${key} is not a Quick Commerce item on this order`);
    }
    const itemPolicy =
      returnEligibility?.itemEligibility?.[key] ||
      returnEligibility?.itemEligibility?.[buildReturnItemKey(matchedItem)] ||
      returnEligibility?.itemEligibility?.[String(matchedItem?.itemId || '').trim()] ||
      returnEligibility?.itemEligibility?.[String(matchedItem?.productId || '').trim()];
    if (itemPolicy?.returnsEnabled === false) {
      throw new ValidationError(
        `Returns are disabled for ${matchedItem?.name || 'this product'}`,
        'RETURNS_DISABLED',
      );
    }
    if (itemPolicy?.returnWindowExpired || itemPolicy?.canReturn === false) {
      throw new ValidationError(
        `Return window has expired for ${matchedItem?.name || 'this product'}`,
        'RETURN_WINDOW_EXPIRED',
      );
    }
    const sellerId = String(matchedItem?.sourceId || '').trim();
    if (!requestedBySeller.has(sellerId)) requestedBySeller.set(sellerId, []);
    requestedBySeller.get(sellerId).push(requestedItem);
  });

  if (!requestedBySeller.size) {
    throw new ValidationError('At least one Quick Commerce item must be selected for return');
  }
  if (requestedBySeller.size > 1) {
    throw new ValidationError('Return requests can only include items from one seller per order.');
  }

  let orderWithUser = order;
  try {
    const user = await FoodUser.findById(userId).select('name fullName phone').lean();
    if (user) orderWithUser = { ...order, userId: user };
  } catch {
    /* keep unpopulated order */
  }
  const customer = resolveQuickOrderCustomer(orderWithUser);
  const createdReturns = [];
  let createdNew = false;

  for (const [sellerId, sellerRequestedItems] of requestedBySeller.entries()) {
    // @deprecated multi-seller loop — current policy allows exactly one seller per order/return.
    if (activeSellerIds.has(sellerId)) {
      const existing = activeReturns.find((row) => String(row.sellerId) === sellerId);
      if (existing) {
        createdReturns.push(serializeReturnForCustomer(existing));
        continue;
      }
    }

    const sellerItems = sellerBuckets.get(sellerId) || [];
    if (!sellerItems.length) {
      throw new ValidationError(`Seller ${sellerId} has no returnable items on this order`);
    }

    const existing = await SellerReturn.findOne({ sellerId, orderId: order.orderId });

    if (existing) {
      if (!TERMINAL_RETURN_STATUSES.has(existing.returnStatus)) {
        createdReturns.push(serializeReturnForCustomer(existing.toObject()));
        continue;
      }
      throw new ValidationError(
        'A return request already exists for this order',
        'RETURN_ALREADY_EXISTS',
      );
    }

    const { returnItems, pricing, returnRefundAmount } = buildReturnItemsWithRefundCalculation({
      order,
      quickItems: sellerItems,
      requestedItems: sellerRequestedItems,
      priorReturnedMap,
      existingReturnDoc: null,
    });

    const returnDoc = new SellerReturn({
      sellerId,
      orderId: order.orderId,
      parentOrderId: order._id,
      userId,
      customer: {
        name: customer?.name || 'Customer',
        phone: customer?.phone || '',
      },
      returnStatus: RETURN_STATUSES.REQUESTED,
      returnReason: normalizedReason,
      returnItems,
      pickupImages: Array.isArray(pickupImages) ? pickupImages.slice(0, 8) : [],
      pricing,
      returnRefundAmount,
      refundMethod: method,
      refundStatus: REFUND_STATUSES.NONE,
      refundTransactionId: '',
      refundReference: '',
      customerOtp: '',
      sellerOtp: '',
      dispatch: {
        modeAtCreation: 'auto',
        status: 'unassigned',
        deliveryPartnerId: null,
        offeredTo: [],
      },
      qualityCheck: {
        status: 'pending',
        notes: '',
        checkedAt: null,
        checkedByRole: '',
        checkedById: null,
      },
      returnHistory: [
        buildReturnHistoryEntry({
          byRole: 'USER',
          byId: userId,
          action: 'RETURN_REQUESTED',
          fromStatus: '',
          toStatus: RETURN_STATUSES.REQUESTED,
          note: normalizedReason,
          metadata: {
            refundMethod: method,
            payoutDetails: method === 'wallet' ? {} : payoutDetails,
            itemCount: returnItems.length,
          },
        }),
      ],
    });

    try {
      await returnDoc.save();
      createdNew = true;
      createdReturns.push(serializeReturnForCustomer(returnDoc.toObject()));
    } catch (error) {
      if (Number(error?.code) === 11000) {
        const raced = await SellerReturn.findOne({ sellerId, orderId: order.orderId }).lean();
        if (raced) {
          createdReturns.push(serializeReturnForCustomer(raced));
          continue;
        }
      }
      throw error;
    }
  }

  if (createdNew) {
    try {
      const parent = await QuickOrder.findById(order._id);
      if (parent) {
        parent.returnStatus = RETURN_STATUSES.REQUESTED;
        await parent.save({ validateBeforeSave: false });
        await emitQuickCommerceStatusUpdate(parent, { source: 'return_requested' });
      }
    } catch (error) {
      logger.warn(`createQuickCommerceReturnRequest: parent mirror failed: ${error?.message || error}`);
    }

    try {
      const { upsertSellerNotification } = await import(
        '../seller/services/sellerNotify.service.js'
      );
      for (const ret of createdReturns) {
        const sid = ret?.sellerId?._id || ret?.sellerId;
        if (!sid) continue;
        await upsertSellerNotification(sid, {
          key: `return:requested:${String(ret._id || ret.id)}`,
          type: 'order',
          title: 'Return request received',
          message: `Customer requested a return on order ${order.orderId || order._id}.`,
          link: '/seller/orders',
          metadata: {
            returnId: String(ret._id || ret.id || ''),
            orderId: String(order._id),
          },
        });
      }
    } catch (err) {
      logger.warn(`createQuickCommerceReturnRequest: seller notify failed: ${err?.message || err}`);
    }
  }

  return {
    alreadyExists: !createdNew && createdReturns.length > 0,
    returns: createdReturns,
    message: createdNew
      ? 'Return request submitted successfully'
      : 'Return request already exists for the selected seller(s)',
  };
};

export const resolveReturnEligibilityForOrder = async (order) => {
  if (!order || !isQuickCommerceOrderType(order.orderType)) {
    return buildReturnEligibilityMeta({ order: order || {}, returnPolicy: {} });
  }

  const sellerOrders = await SellerOrder.find({
    orderId: order.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  }).lean();
  return resolveHeaderReturnEligibility(order, sellerOrders);
};

export const getQuickCommerceReturnStatus = async ({ orderId, userId }) => {
  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required to view return status');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  }).lean();

  if (!order) throw new NotFoundError('Order not found');

  const returns = await SellerReturn.find({ orderId: order.orderId, userId })
    .sort({ returnRequestedAt: -1 })
    .lean();

  const returnEligibility = await resolveReturnEligibilityForOrder(order);

  return {
    orderId: order.orderId,
    parentReturnStatus: order.returnStatus || '',
    returns: returns.map(serializeReturnForCustomer),
    ...returnEligibility,
    returnEligibility,
  };
};

export const cancelQuickCommerceReturnRequest = async ({
  orderId,
  userId,
  reason = '',
  // @deprecated — ignored under ONE ORDER = ONE SELLERRETURN policy; kept for backward compatibility.
  returnId = '',
  sellerId = '',
}) => {
  void returnId;
  void sellerId;

  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required to cancel a return');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  });

  if (!order) throw new NotFoundError('Order not found');

  const cancellableStatuses = [
    RETURN_STATUSES.REQUESTED,
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.PICKUP_ASSIGNED,
  ];

  const filter = {
    orderId: order.orderId,
    userId,
    returnStatus: { $in: cancellableStatuses },
  };

  const activeReturns = await SellerReturn.find(filter);

  if (!activeReturns.length) {
    const cancelled = await SellerReturn.find({
      orderId: order.orderId,
      userId,
      returnStatus: RETURN_STATUSES.CANCELLED,
    }).lean();
    if (cancelled.length) {
      return {
        alreadyCancelled: true,
        returns: cancelled.map(serializeReturnForCustomer),
        message: 'Return request is already cancelled',
      };
    }
    throw new ValidationError('No cancellable return request found for this order');
  }

  const note = String(reason || 'Return cancelled by customer').trim();
  const updatedReturns = [];

  for (const returnDoc of activeReturns) {
    const previousStatus = returnDoc.returnStatus;
    returnDoc.returnStatus = RETURN_STATUSES.CANCELLED;
    returnDoc.refundStatus = REFUND_STATUSES.NONE;
    if (['unassigned', 'assigned', 'accepted'].includes(returnDoc.dispatch?.status)) {
      returnDoc.dispatch.status = 'cancelled';
      returnDoc.dispatch.deliveryPartnerId = null;
    }
    appendReturnHistory(returnDoc, {
      byRole: 'USER',
      byId: userId,
      action: 'RETURN_CANCELLED',
      fromStatus: previousStatus,
      toStatus: RETURN_STATUSES.CANCELLED,
      note,
    });
    await returnDoc.save();
    updatedReturns.push(serializeReturnForCustomer(returnDoc.toObject()));
  }

  const remainingActive = await SellerReturn.countDocuments({
    orderId: order.orderId,
    userId,
    returnStatus: { $in: [...ACTIVE_RETURN_STATUSES] },
  });

  if (remainingActive === 0) {
    order.returnStatus = RETURN_STATUSES.CANCELLED;
    await order.save({ validateBeforeSave: false });
  }
  await emitQuickCommerceStatusUpdate(order, { source: 'return_cancelled' });

  return {
    alreadyCancelled: false,
    returns: updatedReturns,
    message: 'Return request cancelled successfully',
  };
};

export const recordSellerReturnDecision = async ({
  sellerId,
  orderId,
  decision,
  reason = '',
  actorRole = 'SELLER',
  actorId = null,
}) => {
  const returnDoc = await SellerReturn.findOne({ sellerId, orderId });
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.returnStatus !== RETURN_STATUSES.REQUESTED) {
    return { returnDoc, pickupDispatch: null };
  }

  const nextStatus = decision === 'approve' ? RETURN_STATUSES.APPROVED : RETURN_STATUSES.REJECTED;
  const previousStatus = returnDoc.returnStatus;

  returnDoc.returnStatus = nextStatus;
  if (decision === 'reject') {
    returnDoc.returnRejectedReason = String(reason || '').trim();
    returnDoc.refundStatus = REFUND_STATUSES.NONE;
  } else {
    returnDoc.returnRejectedReason = '';
    stampReturnOtps(returnDoc);
    await applyReturnPickupPricingToDoc(returnDoc);
  }

  appendReturnHistory(returnDoc, {
    byRole: actorRole,
    byId: actorId || sellerId,
    action: decision === 'approve' ? 'RETURN_APPROVED' : 'RETURN_REJECTED',
    fromStatus: previousStatus,
    toStatus: nextStatus,
    note: String(reason || '').trim(),
  });

  await returnDoc.save();
  void syncParentOrderReturnStatus(orderId, nextStatus).catch((error) => {
    logger.warn(
      `recordSellerReturnDecision: parent returnStatus sync failed for ${orderId}: ${error?.message || error}`,
    );
  });

  // Notify customer of approve/reject
  try {
    const { notifyOwnerWithInbox } = await import(
      '../../../core/notifications/ownerInboxNotify.js'
    );
    const parentOrder = await QuickOrder.findOne(
      mongoose.isValidObjectId(orderId) ? { _id: orderId } : { orderId },
    )
      .select('userId orderId')
      .lean();
    const userId = parentOrder?.userId;
    if (userId) {
      const approved = decision === 'approve';
      await notifyOwnerWithInbox(
        { ownerType: 'USER', ownerId: userId },
        {
          title: approved ? 'Return approved' : 'Return rejected',
          body: approved
            ? `Your return request for order ${parentOrder.orderId || orderId} was approved.`
            : `Your return request for order ${parentOrder.orderId || orderId} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
          data: {
            type: 'return_status',
            orderId: String(orderId),
            status: nextStatus,
            link: `/quick/orders/${orderId}`,
          },
        },
      );
    }
  } catch (err) {
    logger.warn(`recordSellerReturnDecision: user notify failed: ${err?.message || err}`);
  }

  let pickupDispatch = null;
  if (decision === 'approve') {
    void requestSellerReturnPickup({
      sellerId,
      orderId,
      actorId: actorId || sellerId,
      throwOnFailure: false,
    }).catch((error) => {
      logger.warn(
        `Background return pickup dispatch after approve failed for ${orderId}: ${error?.message || error}`,
      );
    });

    const freshReturn = await SellerReturn.findOne({ sellerId, orderId });
    return {
      returnDoc: freshReturn || returnDoc,
      pickupDispatch: {
        success: true,
        pending: true,
        message: 'Return approved — pickup dispatch started',
        notifiedCount: 0,
      },
    };
  }

  return { returnDoc, pickupDispatch };
};

const isReturnDispatchRetryable = (dispatch = {}) => {
  if (!dispatch || dispatch.status === 'unassigned') return true;
  if (dispatch.status === 'assigned' && !dispatch.acceptedAt) return true;
  return false;
};

const countOnlineDeliveryPartners = async () =>
  FoodDeliveryPartner.countDocuments({
    availabilityStatus: 'online',
    status: {
      $in: process.env.NODE_ENV === 'production' ? ['approved'] : ['approved', 'pending'],
    },
  });

const buildReturnPickupDispatchAudit = async (dispatchResult, { attempt = 1 } = {}) => {
  const onlineCount = await countOnlineDeliveryPartners();

  if (!dispatchResult) {
    return {
      success: false,
      notifiedCount: 0,
      eligibleCount: 0,
      onlineCount,
      filteredCount: 0,
      partnerPoolCount: 0,
      persistedOfferCount: 0,
      attempt,
      reason: 'dispatch_lock_or_skip',
      bullmqRetryScheduled: false,
    };
  }

  const audit = dispatchResult?.dispatchAudit || {};
  const freshOffers = Number(audit.persistedOfferCount || 0);
  const notifiedCount = Number(dispatchResult?.notifiedCount || 0);
  const partnerPoolCount = Number(audit.partnerPoolCount || 0);

  let reason = audit.reason || '';
  if (!reason) {
    if (notifiedCount > 0) reason = 'riders_notified';
    else if (onlineCount === 0) reason = 'no_online_riders';
    else if (partnerPoolCount === 0) reason = 'no_eligible_riders_nearby';
    else reason = 'dispatch_failed';
  }

  return {
    success: notifiedCount > 0 || freshOffers > 0 || Number(audit.renotifiedCount || 0) > 0,
    notifiedCount,
    eligibleCount: Number(audit.eligibleCount || 0),
    onlineCount,
    filteredCount: Number(audit.filteredCount ?? partnerPoolCount),
    partnerPoolCount,
    geoPartnerPoolCount: Number(audit.geoPartnerPoolCount ?? 0),
    persistedOfferCount: freshOffers,
    renotifiedCount: Number(audit.renotifiedCount || 0),
    socketEmitCount: Number(audit.socketEmitCount || 0),
    attempt,
    reason,
    bullmqRetryScheduled: Boolean(audit.bullmqRetryScheduled),
  };
};

const countActiveReturnOffers = (offeredTo = []) =>
  (Array.isArray(offeredTo) ? offeredTo : []).filter((entry) =>
    ['offered', 'assigned'].includes(String(entry?.action || 'offered')),
  ).length;

const executeReturnPickupDispatch = async (returnDoc, { attempt = 1 } = {}) => {
  const beforeReturn = await SellerReturn.findById(returnDoc._id).select('dispatch').lean();
  const offeredToBefore = Array.isArray(beforeReturn?.dispatch?.offeredTo)
    ? beforeReturn.dispatch.offeredTo.length
    : 0;
  const activeOffersBefore = countActiveReturnOffers(beforeReturn?.dispatch?.offeredTo);

  await SellerReturn.findByIdAndUpdate(returnDoc._id, {
    $unset: { 'dispatch.dispatchingAt': '' },
  });

  let dispatchResult = await tryAutoAssign(String(returnDoc._id), {
    documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
    attempt,
  });

  if (!dispatchResult) {
    logger.warn(
      `[ReturnDispatch] tryAutoAssign returned null for return ${returnDoc._id} attempt=${attempt} — attempting renotify from existing offers`,
    );
    const freshForRenotify = await SellerReturn.findById(returnDoc._id);
    if (freshForRenotify) {
      const renotify = await renotifyExistingReturnPickupOffers(freshForRenotify);
      if (renotify.notifiedCount > 0) {
        dispatchResult = {
          notifiedCount: renotify.notifiedCount,
          dispatchAudit: {
            reason: 'renotify_existing_offers',
            eligibleCount: 0,
            partnerPoolCount: renotify.partnerPoolCount,
            notifiedCount: renotify.notifiedCount,
            renotifiedCount: renotify.renotifiedCount,
            persistedOfferCount: 0,
            socketEmitCount: renotify.socketEmitCount,
          },
        };
      }
    }
  }

  if (!dispatchResult?.notifiedCount && attempt < 3) {
    dispatchResult = await tryAutoAssign(String(returnDoc._id), {
      documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
      attempt: 3,
    });
  }

  const freshReturn = await SellerReturn.findById(returnDoc._id).lean();
  const offeredToAfter = Array.isArray(freshReturn?.dispatch?.offeredTo)
    ? freshReturn.dispatch.offeredTo.length
    : 0;
  const activeOffersAfter = countActiveReturnOffers(freshReturn?.dispatch?.offeredTo);
  const newOffersThisRun = Math.max(0, offeredToAfter - offeredToBefore);
  const audit = await buildReturnPickupDispatchAudit(dispatchResult, { attempt });

  logger.info(
    `[ReturnDispatch:summary] returnId=${returnDoc._id} eligibleCount=${audit.eligibleCount} partnerPoolCount=${audit.partnerPoolCount} geoPartnerPoolCount=${audit.geoPartnerPoolCount} notifiedCount=${audit.notifiedCount} renotifiedCount=${audit.renotifiedCount} persistedOfferCount=${audit.persistedOfferCount} socketEmitCount=${audit.socketEmitCount} offeredToBefore=${offeredToBefore} offeredToAfter=${offeredToAfter} activeOffersBefore=${activeOffersBefore} activeOffersAfter=${activeOffersAfter} newOffersThisRun=${newOffersThisRun} dispatch.status=${freshReturn?.dispatch?.status} deliveryPartnerId=${freshReturn?.dispatch?.deliveryPartnerId || 'null'}`,
  );

  return {
    ...audit,
    offeredToCount: activeOffersAfter,
    totalOfferedToCount: offeredToAfter,
    activeOffersCount: activeOffersAfter,
    newOffersThisRun,
    assignedPartnerId: freshReturn?.dispatch?.deliveryPartnerId
      ? String(freshReturn.dispatch.deliveryPartnerId)
      : null,
    dispatchStatus: freshReturn?.dispatch?.status || 'unassigned',
    return: freshReturn,
  };
};

export const requestSellerReturnPickup = async ({
  sellerId,
  orderId,
  actorId = null,
  throwOnFailure = true,
}) => {
  const returnDoc = await SellerReturn.findOne({ sellerId, orderId });
  if (!returnDoc) throw new NotFoundError('Return request not found');

  const allowedStatuses = new Set([RETURN_STATUSES.APPROVED, RETURN_STATUSES.PICKUP_ASSIGNED]);
  if (!allowedStatuses.has(returnDoc.returnStatus)) {
    throw new ValidationError('Return must be approved before requesting pickup');
  }

  if (returnDoc.dispatch?.status === 'accepted') {
    return {
      alreadyRequested: true,
      success: true,
      return: returnDoc.toObject(),
      message: 'Return pickup has already been accepted by a rider',
    };
  }

  if (returnDoc.dispatch?.status === 'completed') {
    throw new ValidationError('Return pickup has already been completed');
  }

  if (!isReturnDispatchRetryable(returnDoc.dispatch)) {
    throw new ValidationError('Return pickup dispatch is not in a retryable state');
  }

  const isRetry =
    returnDoc.returnStatus === RETURN_STATUSES.PICKUP_ASSIGNED &&
    isReturnDispatchRetryable(returnDoc.dispatch);

  if (!String(returnDoc.sellerOtp || '').trim()) {
    stampReturnOtps(returnDoc);
  }

  const previousStatus = returnDoc.returnStatus;

  if (!isRetry) {
    returnDoc.dispatch = {
      modeAtCreation: returnDoc.dispatch?.modeAtCreation || 'auto',
      status: 'unassigned',
      deliveryPartnerId: null,
      assignedAt: null,
      acceptedAt: null,
      completedAt: null,
      offeredTo: [],
    };

    appendReturnHistory(returnDoc, {
      byRole: 'SELLER',
      byId: actorId || sellerId,
      action: 'RETURN_PICKUP_REQUESTED',
      fromStatus: previousStatus,
      toStatus: RETURN_STATUSES.PICKUP_ASSIGNED,
      note: 'Seller requested return pickup dispatch',
    });

    returnDoc.returnStatus = RETURN_STATUSES.PICKUP_ASSIGNED;
    await returnDoc.save();
    void syncParentOrderReturnStatus(orderId, RETURN_STATUSES.PICKUP_ASSIGNED).catch((error) => {
      logger.warn(
        `requestSellerReturnPickup: parent returnStatus sync failed for ${orderId}: ${error?.message || error}`,
      );
    });
  } else {
    returnDoc.dispatch.offeredTo = (returnDoc.dispatch?.offeredTo || []).filter((entry) =>
      ['offered', 'assigned'].includes(String(entry?.action || '')),
    );
    if (returnDoc.dispatch.offeredTo.length === 0 && returnDoc.dispatch?.status === 'assigned') {
      returnDoc.dispatch.status = 'unassigned';
      returnDoc.dispatch.assignedAt = null;
    }
    appendReturnHistory(returnDoc, {
      byRole: 'SELLER',
      byId: actorId || sellerId,
      action: 'RETURN_PICKUP_RETRY',
      fromStatus: previousStatus,
      toStatus: RETURN_STATUSES.PICKUP_ASSIGNED,
      note: 'Seller retried return pickup dispatch',
    });
    await returnDoc.save();
    void syncParentOrderReturnStatus(orderId, RETURN_STATUSES.PICKUP_ASSIGNED).catch((error) => {
      logger.warn(
        `requestSellerReturnPickup retry: parent returnStatus sync failed for ${orderId}: ${error?.message || error}`,
      );
    });
  }

  const pickupDispatch = await executeReturnPickupDispatch(returnDoc);

  if (!pickupDispatch.success) {
    const message =
      pickupDispatch.reason === 'no_online_riders'
        ? 'No online delivery partners available for return pickup'
        : pickupDispatch.reason === 'no_eligible_riders_nearby'
          ? 'No nearby eligible delivery partners found for return pickup'
          : 'Return pickup dispatch failed — no riders could be notified';

    const failurePayload = {
      alreadyRequested: false,
      success: false,
      ...pickupDispatch,
      message,
      dispatchError: message,
    };

    if (throwOnFailure) {
      const error = new ValidationError(message);
      error.statusCode = 422;
      error.dispatchAudit = pickupDispatch;
      error.pickupDispatch = failurePayload;
      throw error;
    }

    return failurePayload;
  }

  return {
    alreadyRequested: false,
    success: pickupDispatch.success,
    ...pickupDispatch,
    message:
      pickupDispatch.notifiedCount > 0
        ? `Return pickup dispatch started — ${pickupDispatch.notifiedCount} rider(s) notified`
        : pickupDispatch.renotifiedCount > 0
          ? `Return pickup re-notified — ${pickupDispatch.renotifiedCount} rider(s) alerted`
          : pickupDispatch.activeOffersCount > 0
            ? `Return pickup has ${pickupDispatch.activeOffersCount} active offer(s) but no riders were notified this attempt`
            : 'Return pickup dispatch failed — no riders could be notified',
  };
};

export const getReturnPickupOtpForCustomer = async ({ orderId, userId, sellerId = '' }) => {
  const identityQuery = buildOrderIdentityQuery(orderId);
  if (!identityQuery) throw new ValidationError('orderId is required');
  if (!userId) throw new ForbiddenError('Login is required');

  const order = await QuickOrder.findOne({
    ...identityQuery,
    orderType: { $in: ['quick', 'mixed'] },
    userId,
  }).select('_id orderId').lean();

  if (!order) throw new NotFoundError('Order not found');

  const filter = { orderId: order.orderId, userId };
  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    filter.sellerId = sellerId;
  }

  const returnDoc = await SellerReturn.findOne(filter).select(
    '+customerOtp customerOtpExpiresAt returnStatus sellerId',
  );

  if (!returnDoc) throw new NotFoundError('Return request not found');

  const activePickupStatuses = new Set([
    RETURN_STATUSES.APPROVED,
    RETURN_STATUSES.PICKUP_ASSIGNED,
    RETURN_STATUSES.IN_TRANSIT,
  ]);

  if (!activePickupStatuses.has(returnDoc.returnStatus)) {
    throw new ValidationError('Return pickup OTP is not active for this return');
  }

  const expiresAt = returnDoc.customerOtpExpiresAt ? new Date(returnDoc.customerOtpExpiresAt) : null;
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    throw new ValidationError('Return pickup OTP has expired. Contact support or the seller.');
  }

  const otp = String(returnDoc.customerOtp || '').trim();
  if (!otp) {
    throw new ValidationError('Return pickup OTP is not configured yet');
  }

  return {
    orderId: order.orderId,
    returnId: String(returnDoc._id),
    sellerId: String(returnDoc.sellerId || ''),
    otp,
    expiresAt,
    returnStatus: returnDoc.returnStatus,
  };
};

const enrichAdminReturnRows = async (items = []) => {
  if (!items.length) return [];

  const orderIds = [...new Set(items.map((row) => row.orderId).filter(Boolean))];
  const parentOrders = orderIds.length
    ? await QuickOrder.find({ orderId: { $in: orderIds } })
        .populate('userId', 'name phone email')
        .select('orderId pricing deliveryAddress customer userId')
        .lean()
    : [];
  const parentOrderMap = new Map(parentOrders.map((row) => [row.orderId, row]));

  return items.map((doc) => {
    const serialized = serializeReturnForAdmin(doc);
    const parentOrder = parentOrderMap.get(doc.orderId);
    if (!parentOrder) return serialized;

    const withCustomer = enrichSerializedReturnCustomerFromParentOrder(serialized, parentOrder);
    return enrichSerializedReturnPricingFromParentOrder(withCustomer, parentOrder);
  });
};

export const listQuickCommerceReturnsForAdmin = async ({
  page = 1,
  limit = 20,
  status = '',
  search = '',
  sellerId = '',
} = {}) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = {};

  const normalizedStatus = String(status || '').trim();
  if (normalizedStatus) filter.returnStatus = normalizedStatus;

  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    filter.sellerId = sellerId;
  }

  const normalizedSearch = String(search || '').trim();
  if (normalizedSearch) {
    filter.$or = [
      { orderId: new RegExp(normalizedSearch, 'i') },
      { 'customer.name': new RegExp(normalizedSearch, 'i') },
      { 'customer.phone': new RegExp(normalizedSearch, 'i') },
    ];
  }

  const [items, total] = await Promise.all([
    SellerReturn.find(filter)
      .sort({ returnRequestedAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    SellerReturn.countDocuments(filter),
  ]);

  const enrichedItems = await enrichAdminReturnRows(items);

  return {
    items: enrichedItems,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

export const getQuickCommerceReturnForAdmin = async (returnId) => {
  if (!returnId) throw new ValidationError('returnId is required');

  let returnDoc = null;
  if (mongoose.isValidObjectId(returnId)) {
    returnDoc = await SellerReturn.findById(returnId).lean();
  }
  if (!returnDoc) {
    returnDoc = await SellerReturn.findOne({ orderId: String(returnId).trim() })
      .sort({ returnRequestedAt: -1 })
      .lean();
  }

  if (!returnDoc) throw new NotFoundError('Return request not found');

  const [enriched] = await enrichAdminReturnRows([returnDoc]);
  return enriched;
};

export const completeQuickCommerceReturnRefund = async ({
  returnId,
  actorId = null,
  actorRole = 'ADMIN',
  note = '',
  payoutReference = '',
} = {}) => {
  if (!returnId) throw new ValidationError('returnId is required');

  const returnDoc = await SellerReturn.findById(returnId);
  if (!returnDoc) throw new NotFoundError('Return request not found');

  if (returnDoc.returnStatus === RETURN_STATUSES.REFUND_COMPLETED) {
    return {
      alreadyProcessed: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: 'Refund already completed for this return',
    };
  }

  if (returnDoc.returnStatus !== RETURN_STATUSES.RETURNED) {
    throw new ValidationError('Refund can only be processed after items are marked as returned');
  }

  if (returnDoc.refundStatus === REFUND_STATUSES.COMPLETED && returnDoc.refundTransactionId) {
    return {
      alreadyProcessed: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: 'Refund already completed for this return',
    };
  }

  const order = await QuickOrder.findOne({
    orderId: returnDoc.orderId,
    orderType: { $in: ['quick', 'mixed'] },
  });

  if (!order) throw new NotFoundError('Parent order not found for return refund');

  const payoutDetails = extractPayoutDetailsFromReturn(returnDoc);
  const previousStatus = returnDoc.returnStatus;
  const previousRefundStatus = returnDoc.refundStatus;

  if (!returnDoc.refundReference) {
    returnDoc.refundReference = buildReturnRefundReference(returnDoc);
  }
  if (payoutReference) {
    returnDoc.refundReference = String(payoutReference).trim();
  }

  appendReturnHistory(returnDoc, {
    byRole: actorRole,
    byId: actorId,
    action: 'REFUND_INITIATED',
    fromStatus: previousStatus,
    toStatus: previousStatus,
    note: note || 'Return refund initiated',
    metadata: { refundMethod: returnDoc.refundMethod, refundReference: returnDoc.refundReference },
  });
  await returnDoc.save();

  const refundExecution = await executeReturnCustomerRefund(returnDoc, order, {
    actorId,
    actorRole,
    note,
    payoutDetails,
  });

  if (refundExecution.pending) {
    appendReturnHistory(returnDoc, {
      byRole: actorRole,
      byId: actorId,
      action: 'REFUND_QUEUED',
      fromStatus: previousStatus,
      toStatus: previousStatus,
      note: refundExecution.refundResult?.message || 'Refund queued for payout',
      metadata: {
        refundMethod: returnDoc.refundMethod,
        refundTransactionId: returnDoc.refundTransactionId,
        refundReference: returnDoc.refundReference,
        payoutDetails,
      },
    });
    await returnDoc.save();

    return {
      alreadyProcessed: false,
      pending: true,
      return: serializeReturnForAdmin(returnDoc.toObject()),
      message: refundExecution.refundResult?.message || 'Refund queued for manual payout',
    };
  }

  if (!refundExecution.processed) {
    appendReturnHistory(returnDoc, {
      byRole: actorRole,
      byId: actorId,
      action: 'REFUND_FAILED',
      fromStatus: previousStatus,
      toStatus: previousStatus,
      note: refundExecution.refundResult?.message || 'Refund processing failed',
      metadata: { reason: refundExecution.refundResult?.reason || 'unknown', previousRefundStatus },
    });
    await returnDoc.save();
    throw new ValidationError(refundExecution.refundResult?.message || 'Refund could not be processed');
  }

  await applyReturnSellerFinance(returnDoc, {
    actorId,
    actorRole,
    reason: note || 'Return refund seller finance',
  });

  appendReturnHistory(returnDoc, {
    byRole: actorRole,
    byId: actorId,
    action: 'REFUND_COMPLETED',
    fromStatus: previousStatus,
    toStatus: RETURN_STATUSES.REFUND_COMPLETED,
    note: refundExecution.refundResult?.message || note || 'Refund completed',
    metadata: {
      refundMethod: refundExecution.refundResult?.method,
      amount: refundExecution.refundResult?.amount,
      refundTransactionId: returnDoc.refundTransactionId,
      refundReference: returnDoc.refundReference,
      previousRefundStatus,
      finance: returnDoc.finance,
    },
  });
  await returnDoc.save();

  try {
    order.returnStatus = RETURN_STATUSES.REFUND_COMPLETED;
    await order.save({ validateBeforeSave: false });
    await syncParentOrderReturnStatus(returnDoc.orderId, RETURN_STATUSES.REFUND_COMPLETED);
    await emitQuickCommerceStatusUpdate(order, { source: 'return_refund_completed' });
  } catch (error) {
    logger.warn(`completeQuickCommerceReturnRefund: parent mirror failed: ${error?.message || error}`);
  }

  return {
    alreadyProcessed: false,
    pending: false,
    return: serializeReturnForAdmin(returnDoc.toObject()),
    message: refundExecution.refundResult?.message || 'Refund completed successfully',
  };
};
