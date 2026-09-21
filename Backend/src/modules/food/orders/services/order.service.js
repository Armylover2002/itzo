// Order Service - Backend Logic
import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
// import { paymentSnapshotFromOrder } from './foodOrderPayment.service.js';
import { logger } from '../../../../utils/logger.js';
import { FoodUser } from '../../../../core/users/user.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { resolveRestaurantCommissionPercentage } from '../../constants/commission.constants.js';
import { FoodDeliveryPartner } from '../../delivery/models/deliveryPartner.model.js';
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../../core/auth/errors.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../../utils/helpers.js';
import {
  ORDER_LIST_PROJECTION,
  ORDER_DETAIL_PROJECTION,
  RESTAURANT_ORDER_LIST_SELECT,
  USER_ORDER_LIST_SELECT,
  toOrderStatusSocketDto,
  toDeliveryTripDto,
  toOrderDetailDto,
} from '../dto/order.dto.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodOfferUsage } from '../../admin/models/offerUsage.model.js';
import {
    validateAndApplyCoupon,
    consumeOrderCouponUsageOnDelivery,
} from '../../shared/coupon.util.js';
import {
  resolveRestaurantDocument,
  toNormalizedFoodRestaurantSource,
  canonicalizeFoodItemSourceIds,
  isMongoObjectIdString,
} from '../../shared/restaurantIdentity.util.js';
import {
    calculateDistanceKm,
    normalizeDeliveryAddress as normalizeDeliveryAddressGeo,
    normalizeRestaurantLocation,
} from '../../shared/geo.utils.js';
import {
    hasDeliveryFeeRanges,
    resolveUserDeliveryFee,
    calculateRiderEarning,
    resolveRestaurantToUserDistanceKm,
    resolveRestaurantToUserRoadDistanceKm,
    resolveConfiguredDeliveryFeeFallback,
} from '../../shared/delivery-fee.util.js';
import {
  evaluateFoodQuickDeliveryEligibility,
  splitQuickDeliveryCharge,
  isFoodQuickDeliveryMode,
} from './quick-eligibility.service.js';
import { computeFoodQuickEtaPromise, computeFoodDisplayEtaPromise } from './quick-eta.service.js';
import { computePlatformNetProfitWithQuickFreeze } from '../utils/quickFinance.util.js';
import { FoodItem } from '../../admin/models/food.model.js';
import { FoodAddon } from '../../restaurant/models/foodAddon.model.js';
import { SellerProduct } from '../../../quick-commerce/seller/models/sellerProduct.model.js';
import { resolveDiscountSplitByCoupon } from '../../shared/discountSplit.util.js';
import { resolveRestaurantPhone } from '../../shared/restaurantContact.js';
import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodSupportTicket } from '../../user/models/supportTicket.model.js';
import { Seller } from '../../../quick-commerce/seller/models/seller.model.js';
import { SellerOrder } from '../../../quick-commerce/seller/models/sellerOrder.model.js';
import { getHeaderCommissionSnapshot } from '../../../quick-commerce/admin/services/commission.service.js';
import { QuickFeeSettings } from '../../../quick-commerce/admin/models/feeSettings.model.js';
import { calculateQuickPricing, calculateCustomerDeliveryFee } from '../../../quick-commerce/admin/services/billing.service.js';
import {
    createRazorpayOrder,
    createPaymentLink,
    verifyPaymentSignature,
    getRazorpayKeyId,
    isRazorpayConfigured,
    fetchRazorpayPayment,
    fetchRazorpayPaymentLink,
    initiateRazorpayRefund
} from '../helpers/razorpay.helper.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { isPointInPolygon } from '../../../../utils/geo.js';
import { addOrderJob, removeOrderJob, getOrderJobMeta } from '../../../../queues/producers/order.producer.js';
import { addPaymentJob } from '../../../../queues/producers/payment.producer.js';
import { fetchPolyline } from '../utils/googleMaps.js';
import { getFirebaseDB } from '../../../../config/firebase.js';
import {
  SCHEDULE_ACTIVATE_LEAD_MINUTES,
  SCHEDULE_MIN_LEAD_MINUTES,
  SCHEDULE_MAX_DAYS_AHEAD,
  SCHEDULE_FALLBACK_GRACE_MS,
} from '../utils/scheduleConstants.js';
import * as foodTransactionService from './foodTransaction.service.js';
import { ensureDailyPassEligibility } from "../../subscriptions/services/wallet.service.js";
import { isSubscriptionEnforced } from "../../../common/services/subscriptionEnforcement.service.js";
import {
  getGlobalPaymentSettings,
  assertPaymentMethodAllowed,
} from '../../../common/services/globalPaymentSettings.service.js';
import {
  tryAutoAssign,
  processDispatchTimeout,
  listNearbyOnlineDeliveryPartners,
  getDispatchSettings,
  updateDispatchSettings
} from './order-dispatch.service.js';
import { resolveDeliveryDocumentType } from '../../../quick-commerce/services/dispatchDocument.service.js';
import { DISPATCH_DOCUMENT_TYPES } from '../../../quick-commerce/utils/dispatchDocument.constants.js';
import * as returnPickupDelivery from '../../../quick-commerce/services/returnPickupDelivery.service.js';
import { deductWalletBalance, refundWalletBalance } from '../../user/services/userWallet.service.js';
import { getGlobalBranding } from '../../../common/services/globalBranding.service.js';
import { roadDistanceKm, PAYMENT_QUEUE_ACTIONS, enqueueOrderEvent, notifyRestaurantNewOrder, canExposeOrderToRestaurant, enrichRestaurantQuickPricing, watchdogCancellationReason } from './order.helpers.js';
import { scorePointsByRoadDistance } from '../../../../services/roadDistance.service.js';
import { assertDeliveryPartnerCodHeadroom } from '../../delivery/services/deliveryFinance.service.js';
import { getDeliveryCashLimitSettings } from '../../admin/services/admin.service.js';
import { getPrivacySettingsSync } from '../../../common/utils/privacySettingsCache.js';

export {
  tryAutoAssign,
  processDispatchTimeout,
  listNearbyOnlineDeliveryPartners,
  getDispatchSettings,
  updateDispatchSettings
};

const resolveCodOrderLimit = async () => {
  try {
    const settings = await getDeliveryCashLimitSettings();
    const raw = Number(settings?.deliveryCashLimit);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  } catch {
    return null;
  }
};

const buildCodEligibility = (orderTotal, codOrderLimit) => {
  const total = Math.max(0, Number(orderTotal || 0));
  const limit = Number(codOrderLimit);
  if (!Number.isFinite(limit) || limit <= 0) {
    return {
      codAllowed: true,
      codOrderLimit: null,
      codBlockedReason: null,
    };
  }
  const allowed = total <= limit;
  return {
    codAllowed: allowed,
    codOrderLimit: limit,
    codBlockedReason: allowed ? null : 'ORDER_TOTAL_EXCEEDS_CASH_LIMIT',
  };
};

const ORDER_ID_PREFIX = "FOD-";
const ORDER_ID_LENGTH = 6;
const USER_CANCEL_FULL_REFUND_WINDOW_MS = 30 * 1000;
const USER_CANCEL_EDIT_WINDOW_MS = 60 * 1000;

async function ensureRazorpayPaymentNotConsumed(paymentId, { currentFoodOrderId = null } = {}) {
  const rzPaymentId = String(paymentId || "").trim();
  if (!rzPaymentId) throw new ValidationError("Razorpay payment id required");

  const foodExisting = await FoodOrder.findOne({
    "payment.razorpay.paymentId": rzPaymentId,
    ...(currentFoodOrderId ? { _id: { $ne: currentFoodOrderId } } : {}),
  })
    .select("_id orderId")
    .lean();

  if (foodExisting) {
    throw new ValidationError("Razorpay payment already consumed");
  }
}

function shouldHoldDispatchForScheduled(orderLike) {
  return String(orderLike?.orderStatus || "").toLowerCase() === "scheduled";
}

/**
 * Normalize/validate scheduledAt for Food Schedule Order.
 * Returns null when dto has no schedule → ASAP path unchanged.
 */
function resolveValidatedScheduledAt(rawScheduledAt) {
  if (rawScheduledAt === undefined || rawScheduledAt === null || rawScheduledAt === "") return null;

  const scheduledAt = new Date(rawScheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new ValidationError("Invalid scheduledAt datetime");
  }

  const now = Date.now();
  const minLeadMs = Math.max(0, SCHEDULE_MIN_LEAD_MINUTES) * 60 * 1000;
  if (scheduledAt.getTime() < now + minLeadMs) {
    throw new ValidationError(
      `Scheduled time must be at least ${SCHEDULE_MIN_LEAD_MINUTES} minutes from now`
    );
  }

  const maxDay = new Date();
  maxDay.setHours(0, 0, 0, 0);
  maxDay.setDate(maxDay.getDate() + Math.max(0, SCHEDULE_MAX_DAYS_AHEAD) + 1);
  const maxExclusive = maxDay.getTime();
  if (scheduledAt.getTime() >= maxExclusive) {
    throw new ValidationError(
      `Scheduled time must be within the next ${SCHEDULE_MAX_DAYS_AHEAD} day(s)`
    );
  }

  return scheduledAt;
}

async function assertRestaurantAllowsSchedule(restaurantOrId) {
  if (!restaurantOrId) return;
  // Prefer already-normalized restaurant from order entry (no refetch).
  if (
    typeof restaurantOrId === "object" &&
    restaurantOrId.scheduleOrderEnabled !== undefined
  ) {
    if (restaurantOrId.scheduleOrderEnabled === false) {
      throw new ValidationError("This restaurant is not accepting scheduled orders");
    }
    return;
  }
  const restaurant = await FoodRestaurant.findById(restaurantOrId)
    .select("scheduleOrderEnabled")
    .lean();
  if (restaurant && restaurant.scheduleOrderEnabled === false) {
    throw new ValidationError("This restaurant is not accepting scheduled orders");
  }
}

function buildFoodScheduleJobId(orderMongoId) {
  return `food-schedule-${String(orderMongoId || "").trim()}`;
}

/**
 * PRIMARY activation path: enqueue BullMQ delayed job at schedule create time.
 * Persists scheduleNotifyJobId immediately when Redis accepts the job.
 * Returns null only when BullMQ/Redis cannot accept → Mongo fallback owns activation.
 */
async function scheduleOrderActivationJob(order) {
  if (!order || String(order.orderStatus || "").toLowerCase() !== "scheduled" || !order.scheduledAt) {
    return null;
  }

  const scheduledTime = new Date(order.scheduledAt).getTime();
  if (!Number.isFinite(scheduledTime)) return null;

  const leadMs = Math.max(0, SCHEDULE_ACTIVATE_LEAD_MINUTES) * 60 * 1000;
  const delay = Math.max(0, scheduledTime - leadMs - Date.now());
  const orderMongoId = order._id.toString();
  const jobId = buildFoodScheduleJobId(orderMongoId);
  const payload = {
    orderId: order.orderId,
    orderMongoId,
  };

  if (process.env.BULLMQ_ENABLED !== "true") {
    logger.warn(
      `Schedule activation deferred to fallback reconciler for ${order.orderId} (BULLMQ_ENABLED!=true)`
    );
    return null;
  }

  try {
    const job = await addOrderJob(
      { action: "NOTIFY_SCHEDULED_ORDER", ...payload },
      { delay, jobId, removeOnComplete: true, removeOnFail: 50 }
    );
    if (!job) {
      logger.error(
        `PRIMARY schedule job NOT enqueued for ${order.orderId} (queue unavailable). Fallback reconciler will activate when due.`
      );
      return null;
    }
    const resolvedId = job?.id != null ? String(job.id) : jobId;
    order.scheduleNotifyJobId = resolvedId;
    await FoodOrder.updateOne(
      { _id: order._id },
      { $set: { scheduleNotifyJobId: resolvedId } }
    );
    logger.info(
      `PRIMARY schedule job enqueued order=${order.orderId} delay=${delay}ms jobId=${resolvedId}`
    );
    return resolvedId;
  } catch (err) {
    logger.error(
      `PRIMARY schedule job enqueue failed for ${order.orderId}: ${err?.message || err}. Fallback reconciler will activate when due.`
    );
    return null;
  }
}

async function cancelScheduleActivationJob(orderLike) {
  const mongoId = orderLike?._id?.toString?.() || "";
  const jobIds = new Set(
    [
      orderLike?.scheduleNotifyJobId,
      mongoId ? buildFoodScheduleJobId(mongoId) : null,
    ].filter(Boolean)
  );
  for (const jobId of jobIds) {
    await removeOrderJob(jobId);
  }
  if (orderLike?._id) {
    await FoodOrder.updateOne(
      { _id: orderLike._id },
      { $set: { scheduleNotifyJobId: null } }
    ).catch(() => {});
  }
}

/**
 * Fallback-only gate: when BullMQ is primary, activate via reconciler only if the
 * delayed job is missing, failed, queue is down, or stuck past grace after due.
 */
async function shouldFallbackActivateScheduledOrder(orderRow) {
  if (!orderRow?._id || !orderRow.scheduledAt) return false;

  const leadMs = Math.max(0, SCHEDULE_ACTIVATE_LEAD_MINUTES) * 60 * 1000;
  const activateAtMs = new Date(orderRow.scheduledAt).getTime() - leadMs;
  if (!Number.isFinite(activateAtMs) || Date.now() < activateAtMs) {
    return false;
  }

  if (process.env.BULLMQ_ENABLED !== "true") {
    return true;
  }

  const deterministicId = buildFoodScheduleJobId(orderRow._id);
  const storedId = orderRow.scheduleNotifyJobId
    ? String(orderRow.scheduleNotifyJobId)
    : null;

  if (!storedId) {
    logger.warn(
      `Schedule fallback: missing scheduleNotifyJobId for ${orderRow.orderId || orderRow._id}`
    );
    return true;
  }

  const meta = await getOrderJobMeta(storedId);
  const metaAlt =
    storedId !== deterministicId ? await getOrderJobMeta(deterministicId) : meta;
  const effective = meta.exists ? meta : metaAlt;

  if (effective.queueUnavailable) {
    logger.warn(
      `Schedule fallback: queue unavailable for ${orderRow.orderId || orderRow._id}`
    );
    return true;
  }

  if (!effective.exists) {
    logger.warn(
      `Schedule fallback: BullMQ job missing for ${orderRow.orderId || orderRow._id} jobId=${storedId}`
    );
    return true;
  }

  const state = String(effective.state || "").toLowerCase();
  if (state === "failed") {
    logger.warn(
      `Schedule fallback: BullMQ job failed for ${orderRow.orderId || orderRow._id}`
    );
    return true;
  }

  if (["delayed", "waiting", "wait", "active", "paused", "prioritized"].includes(state)) {
    const overdueMs = Date.now() - activateAtMs;
    if (overdueMs >= Math.max(0, SCHEDULE_FALLBACK_GRACE_MS)) {
      logger.warn(
        `Schedule fallback: job stuck state=${state} overdueMs=${overdueMs} for ${orderRow.orderId || orderRow._id}`
      );
      return true;
    }
    return false;
  }

  if (state === "completed") {
    logger.warn(
      `Schedule fallback: job completed but order still scheduled for ${orderRow.orderId || orderRow._id}`
    );
    return true;
  }

  return true;
}

function generateFourDigitDeliveryOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function shouldShowDeliveryPartnerPhone(order) {
  if (!order) return false;
  const status = String(order.orderStatus || order.status || "").toLowerCase();
  const deliveryStatus = String(order.deliveryState?.status || "").toLowerCase();

  // Robust fallback: if order is already picked up or delivered, show phone number anyway
  const isPostPickup = ["picked_up", "reached_drop", "delivered"].includes(status) || 
                       deliveryStatus === "picked_up" || 
                       deliveryStatus === "reached_drop";
                       
  if (isPostPickup) return true;

  const reachedPickup = deliveryStatus === "reached_pickup" || status === "reached_pickup";
  const photoUploaded = !!order.deliveryState?.billImageUrl;

  return reachedPickup && photoUploaded;
}

/** Remove secret fields before returning order JSON to delivery partner / restaurant. */
function sanitizeOrderForExternal(orderDoc, roleContext = "") {
  const o = orderDoc?.toObject ? orderDoc.toObject() : { ...(orderDoc || {}) };
  delete o.deliveryOtp;
  const dv = o.deliveryVerification;
  if (dv && dv.dropOtp != null) {
    const d = dv.dropOtp;
    o.deliveryVerification = {
      ...dv,
      dropOtp: {
        required: Boolean(d.required),
        verified: Boolean(d.verified),
      },
    };
  }

  if (!o.orderMongoId) {
    o.orderMongoId = (o._id || orderDoc?._id || "").toString();
  }
  if (!o.orderId) {
    o.orderId = o.orderId || o.order_id || o.orderMongoId;
  }

  // Mask Delivery Partner phone for Restaurant panel
  if (String(roleContext).toUpperCase() === "RESTAURANT") {
    if (!shouldShowDeliveryPartnerPhone(o)) {
      if (o.dispatch?.deliveryPartnerId && typeof o.dispatch.deliveryPartnerId === "object") {
        o.dispatch.deliveryPartnerId = {
          ...o.dispatch.deliveryPartnerId,
          phone: "Hidden until photo upload",
        };
      }
      if (o.deliveryPartnerId && typeof o.deliveryPartnerId === "object") {
        o.deliveryPartnerId = {
          ...o.deliveryPartnerId,
          phone: "Hidden until photo upload",
        };
      }
      if (Array.isArray(o.dispatchPlan?.legs)) {
        o.dispatchPlan.legs = o.dispatchPlan.legs.map((leg) => {
          if (leg?.deliveryPartnerId && typeof leg.deliveryPartnerId === "object") {
            return {
              ...leg,
              deliveryPartnerId: {
                ...leg.deliveryPartnerId,
                phone: "Hidden until photo upload",
              },
            };
          }
          return leg;
        });
      }
    }
  }

  return applyCustomerContactProtection(o);
}

function emitDeliveryDropOtpToUser(order, plainOtp) {
  try {
    const io = getIO();
    if (!io || !plainOtp || !order?.userId) return;
    io.to(rooms.user(order.userId)).emit("delivery_drop_otp", {
      orderMongoId: order._id?.toString?.(),
      orderId: order.orderId,
      otp: plainOtp,
      message:
        "Share this OTP with your delivery partner to hand over the order.",
    });
  } catch (e) {
    logger.warn(`emitDeliveryDropOtpToUser failed: ${e?.message || e}`);
  }
}

async function notifyOwnersSafely(targets, payload) {
  try {
    const { notifyOwnersWithInbox } = await import("../../../../core/notifications/ownerInboxNotify.js");
    await notifyOwnersWithInbox(targets, payload);
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

async function notifyOwnerSafely(target, payload) {
  try {
    const { notifyOwnerWithInbox } = await import("../../../../core/notifications/ownerInboxNotify.js");
    await notifyOwnerWithInbox(target, payload);
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

function buildOrderIdentityFilter(orderIdOrMongoId) {
  const raw = String(orderIdOrMongoId || "").trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw))
    return { _id: new mongoose.Types.ObjectId(raw) };
  return { orderId: raw };
}

function isTerminalCancelStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return (
    s === "cancelled_by_user" ||
    s === "cancelled_by_restaurant" ||
    s === "cancelled_by_admin" ||
    s === "cancelled_by_system"
  );
}

function applyCancellationTerminalState(order, { cancelledStatus, reason = "", cancelledBy } = {}) {
  if (!order || typeof order !== "object") return;

  const status = String(cancelledStatus || "").toLowerCase();
  const by =
    cancelledBy ||
    (status === "cancelled_by_restaurant"
      ? "restaurant"
      : status === "cancelled_by_user"
        ? "user"
        : status === "cancelled_by_admin"
          ? "admin"
          : status === "cancelled_by_system"
            ? "system"
            : null);
  if (by) order.cancelledBy = by;
  const reasonText = String(reason || "").trim();
  if (reasonText) order.cancellationReason = reasonText;

  // Dispatch: stop rider assignment and mark cancelled.
  if (!order.dispatch || typeof order.dispatch !== "object") order.dispatch = {};
  order.dispatch.status = "cancelled";
  order.dispatch.deliveryPartnerId = null;
  order.dispatch.acceptedAt = null;
  order.dispatch.assignedAt = null;
  if (Array.isArray(order.dispatch.offeredTo)) {
    // Keep audit trail but prevent further repeats from old offers.
    order.dispatch.offeredTo = order.dispatch.offeredTo.map((x) => ({
      ...x,
      action: x.action || "offered",
    }));
  } else {
    order.dispatch.offeredTo = [];
  }

  // DispatchPlan: make it terminal but keep legs for audit.
  if (!order.dispatchPlan || typeof order.dispatchPlan !== "object")
    order.dispatchPlan = {};
  order.dispatchPlan.combinedPickupEligible = false;
  order.dispatchPlan.reason = reason
    ? `Cancelled: ${reason}`
    : `Cancelled (${String(cancelledStatus || "cancelled").replace(/_/g, " ")})`;
  if (Array.isArray(order.dispatchPlan.legs)) {
    order.dispatchPlan.legs = order.dispatchPlan.legs.map((leg) => ({
      ...leg,
      deliveryPartnerId: null,
      assignedAt: null,
      partnerCandidates: [],
    }));
  }

  // DeliveryState: mark terminal cancelled.
  if (!order.deliveryState || typeof order.deliveryState !== "object")
    order.deliveryState = {};
  order.deliveryState.currentPhase = "cancelled";
  order.deliveryState.status = "cancelled";

  // Drop any pending schedule activation job (user/admin/restaurant cancel).
  void cancelScheduleActivationJob(order);

  // Payment: for non-paid flows, keep it cancelled.
  if (order.payment && typeof order.payment === "object") {
    const method = String(order.payment.method || "").trim().toLowerCase();
    const paid =
      ["razorpay", "razorpay_qr"].includes(method) &&
      String(order.payment.status || "").trim().toLowerCase() === "paid";
    if (
      !paid &&
      String(order.payment.status || "").trim().toLowerCase() !== "refunded"
    ) {
      order.payment.status = "cancelled";
    }
  }
}

function safePushStatusHistory(order, { byRole, byId, from, to, note = "" }) {
  if (!order) return;
  const fromNorm = String(from || "").trim();
  const toNorm = String(to || "").trim();
  if (!toNorm || fromNorm === toNorm) return;
  pushStatusHistory(order, { byRole, byId, from: fromNorm, to: toNorm, note });
}

function generateOrderId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < ORDER_ID_LENGTH; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return ORDER_ID_PREFIX + s;
}

async function ensureUniqueOrderId() {
  let orderId;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    orderId = generateOrderId();
    const found = await FoodOrder.exists({ orderId });
    exists = !!found;
    attempts++;
  }
  if (exists) throw new ValidationError("Could not generate unique order id");
  return orderId;
}

function normalizeDeliveryAddress(address) {
  if (!address || typeof address !== "object") return undefined;

  const street =
    String(address.street || "").trim() ||
    String(address.address || "").trim() ||
    String(address.formattedAddress || "").trim();
  const city =
    String(address.city || "").trim() ||
    String(address.area || "").trim();
  const state =
    String(address.state || "").trim() ||
    city;

  return {
    label: address.label || "Home",
    street,
    additionalDetails:
      String(address.additionalDetails || "").trim() ||
      String(address.area || "").trim(),
    city,
    state,
    zipCode: String(address.zipCode || address.postalCode || "").trim(),
    phone: String(address.phone || "").trim(),
    location: address.location?.coordinates
      ? { type: "Point", coordinates: address.location.coordinates }
      : undefined,
  };
}

function toGeoPoint(lat, lng) {
  if (lat == null || lng == null) return undefined;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return { type: "Point", coordinates: [b, a] };
}

function getItemType(item, fallbackOrderType = "food") {
  if (item?.type === "quick" || item?.orderType === "quick") return "quick";
  if (item?.type === "food" || item?.orderType === "food") return "food";
  return fallbackOrderType === "quick" ? "quick" : "food";
}

function buildSourceIdForItem(item, itemType) {
  if (item?.sourceId) return String(item.sourceId);
  if (itemType === "quick") {
    return String(
      item?.quickStoreId ||
        item?.storeId ||
        item?.sellerId ||
        item?.restaurantId ||
        "quick-commerce",
    );
  }
  return String(item?.restaurantId || item?.sourceRestaurantId || "");
}

function normalizeOrderItems(items = [], fallbackOrderType = "food") {
  return (Array.isArray(items) ? items : []).map((item) => {
    const itemType = getItemType(item, fallbackOrderType);
    const sourceId = buildSourceIdForItem(item, itemType);
    return {
      ...item,
      type: itemType,
      sourceId,
      sourceName:
        item?.sourceName ||
        (itemType === "quick"
          ? item?.quickStoreName || item?.storeName || item?.sellerName || ""
          : item?.restaurant || item?.restaurantName || ""),
    };
  });
}

function resolveQuickUnitPrice(product, variantId) {
  if (variantId) {
    const variant = (Array.isArray(product?.variants) ? product.variants : []).find(
      (entry) => String(entry?._id || "") === String(variantId).trim(),
    );
    if (!variant) {
      throw new ValidationError("Selected quick product variant is unavailable");
    }
    const sale = Number(variant.salePrice || 0);
    const base = Number(variant.price || 0);
    return {
      unitPrice: sale > 0 ? sale : base,
      variantName: variant.name || "",
    };
  }
  const sale = Number(product?.salePrice || 0);
  const base = Number(product?.price || 0);
  return { unitPrice: sale > 0 ? sale : base, variantName: "" };
}

/**
 * Overwrite food line prices from FoodItem, then FoodAddon for remaining IDs.
 * Never trusts client-provided food/addon prices.
 */
async function applyServerFoodItemPricing(items = [], sourceMap = new Map()) {
  const foodItems = (Array.isArray(items) ? items : []).filter((item) => item?.type === "food");
  if (!foodItems.length) return;

  const itemIds = [
    ...new Set(
      foodItems
        .map((item) => String(item?.itemId || "").trim())
        .filter((id) => mongoose.isValidObjectId(id)),
    ),
  ];
  if (!itemIds.length) {
    throw new ValidationError("Invalid food item selection");
  }

  const objectIds = itemIds.map((id) => new mongoose.Types.ObjectId(id));
  const foodDocs = await FoodItem.find({
    _id: { $in: objectIds },
    approvalStatus: "approved",
    isAvailable: true,
  })
    .select("restaurantId name price variants image images foodType")
    .lean();
  const foodById = new Map(foodDocs.map((doc) => [String(doc._id), doc]));

  const missingIds = itemIds.filter((id) => !foodById.has(id));
  const addonDocs = missingIds.length
    ? await FoodAddon.find({
        _id: { $in: missingIds.map((id) => new mongoose.Types.ObjectId(id)) },
        approvalStatus: "approved",
        isAvailable: true,
        isDeleted: { $ne: true },
        published: { $ne: null },
      })
        .select("restaurantId published draft")
        .lean()
    : [];
  const addonById = new Map(addonDocs.map((doc) => [String(doc._id), doc]));

  for (const item of foodItems) {
    const itemId = String(item?.itemId || "").trim();
    const source = sourceMap.get(String(item.sourceId));
    const expectedRestaurantId = String(source?.sourceId || "").trim();

    const foodDoc = foodById.get(itemId);
    if (foodDoc) {
      const docRestaurantId = String(foodDoc.restaurantId || "").trim();
      if (!expectedRestaurantId || expectedRestaurantId !== docRestaurantId) {
        throw new ValidationError("Food item does not belong to selected restaurant");
      }

      let unitPrice = Number(foodDoc.price || 0);
      if (item?.variantId) {
        const variantId = String(item.variantId).trim();
        const variant = (Array.isArray(foodDoc.variants) ? foodDoc.variants : []).find(
          (entry) => String(entry?._id || "") === variantId,
        );
        if (!variant) {
          throw new ValidationError("Selected food variant is unavailable");
        }
        unitPrice = Number(variant.price || 0);
        item.variantName = variant.name || item.variantName || "";
        item.variantPrice = unitPrice;
      }

      item.price = unitPrice;
      item.name = foodDoc.name || item.name;
      item.image = item.image || foodDoc.image || foodDoc.images?.[0] || "";
      item.isVeg = String(foodDoc.foodType || "").toLowerCase() === "veg";
      item.isAddon = false;
      item.sourceId = expectedRestaurantId;
      item.sourceName = source?.sourceName || item.sourceName || "";
      continue;
    }

    const addonDoc = addonById.get(itemId);
    if (!addonDoc) {
      throw new ValidationError("One or more food items are unavailable");
    }

    const docRestaurantId = String(addonDoc.restaurantId || "").trim();
    if (!expectedRestaurantId || expectedRestaurantId !== docRestaurantId) {
      throw new ValidationError("Food addon does not belong to selected restaurant");
    }

    const published = addonDoc.published || addonDoc.draft || {};
    item.price = Number(published.price || 0);
    item.name = published.name || item.name;
    item.image = item.image || published.image || published.images?.[0] || "";
    item.isVeg = String(published.foodType || "Veg").toLowerCase() !== "non-veg";
    item.isAddon = true;
    item.variantId = undefined;
    item.variantName = "";
    item.variantPrice = item.price;
    item.sourceId = expectedRestaurantId;
    item.sourceName = source?.sourceName || item.sourceName || "";
  }
}

/**
 * Overwrite quick line prices from SellerProduct. Never trusts client prices.
 */
async function applyServerQuickItemPricing(items = [], sourceMap = new Map()) {
  const quickItems = (Array.isArray(items) ? items : []).filter((item) => item?.type === "quick");
  if (!quickItems.length) return;

  const itemIds = [
    ...new Set(
      quickItems
        .map((item) => String(item?.itemId || "").trim())
        .filter((id) => mongoose.isValidObjectId(id)),
    ),
  ];
  if (!itemIds.length) {
    throw new ValidationError("Invalid quick item selection");
  }

  const productDocs = await SellerProduct.find({
    _id: { $in: itemIds.map((id) => new mongoose.Types.ObjectId(id)) },
    status: "active",
  })
    .select("sellerId name price salePrice variants mainImage galleryImages")
    .lean();
  const productById = new Map(productDocs.map((doc) => [String(doc._id), doc]));

  for (const item of quickItems) {
    const itemId = String(item?.itemId || "").trim();
    const product = productById.get(itemId);
    if (!product) {
      throw new ValidationError("One or more quick items are unavailable");
    }

    const source = sourceMap.get(String(item.sourceId));
    const expectedSellerId = String(source?.sourceId || item.sourceId || "").trim();
    const docSellerId = String(product.sellerId || "").trim();
    if (!expectedSellerId || expectedSellerId !== docSellerId) {
      throw new ValidationError("Quick item does not belong to selected store");
    }

    const { unitPrice, variantName } = resolveQuickUnitPrice(product, item?.variantId);
    item.price = unitPrice;
    if (item?.variantId) {
      item.variantName = variantName || item.variantName || "";
      item.variantPrice = unitPrice;
    }
    item.name = product.name || item.name;
    item.image = item.image || product.mainImage || product.galleryImages?.[0] || "";
    item.sourceId = expectedSellerId;
    item.sourceName = source?.sourceName || item.sourceName || "";
  }
}

async function applyServerItemPricing(items = [], sourceMap = new Map()) {
  await applyServerFoodItemPricing(items, sourceMap);
  await applyServerQuickItemPricing(items, sourceMap);
}

function sumItemsSubtotal(items = [], typeFilter = null) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => (typeFilter ? item?.type === typeFilter : true))
    .reduce(
      (sum, item) => sum + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
      0,
    );
}

function getPointLatLng(locationLike) {
  const coords = locationLike?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
    return { lat: Number(lat), lng: Number(lng) };
  }

  // Accept non-GeoJSON shapes used by some legacy payloads.
  const lat = locationLike?.lat ?? locationLike?.latitude;
  const lng = locationLike?.lng ?? locationLike?.longitude;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function validateDeliveryCoordinates(location) {
  const coords = location?.coordinates;
  if (!Array.isArray(coords) || coords.length !== 2) {
    throw new ValidationError("Delivery location coordinates are required");
  }
  const [lng, lat] = coords.map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new ValidationError("Delivery location coordinates must be valid numbers");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new ValidationError("Delivery location coordinates are out of range");
  }
}

async function loadSavedUserAddress(userId, addressId) {
  if (!userId || !addressId || !mongoose.Types.ObjectId.isValid(String(addressId))) {
    return null;
  }
  const user = await FoodUser.findById(userId).select("addresses").lean();
  if (!user?.addresses?.length) return null;
  const saved = user.addresses.find((entry) => String(entry?._id) === String(addressId));
  if (!saved) return null;
  return normalizeDeliveryAddress(saved);
}

/**
 * Resolve delivery coordinates from a trusted saved address when possible.
 * Client-supplied coordinates are only used for live/current-location orders.
 */
async function resolveTrustedDeliveryAddress(userId, dto = {}) {
  const addressId =
    dto.deliveryAddressId ||
    dto.address?._id ||
    dto.address?.id ||
    null;

  if (addressId && userId) {
    const saved = await loadSavedUserAddress(userId, addressId);
    if (!saved) {
      throw new ValidationError("Delivery address not found");
    }
    const client = normalizeDeliveryAddress(dto.address) || {};
    return {
      ...saved,
      label: client.label || saved.label,
      street: client.street || saved.street,
      additionalDetails: client.additionalDetails || saved.additionalDetails,
      city: client.city || saved.city,
      state: client.state || saved.state,
      zipCode: client.zipCode || saved.zipCode,
      phone: client.phone || saved.phone,
      location: saved.location,
    };
  }

  const normalized = normalizeDeliveryAddress(dto.address);
  if (!normalized?.location?.coordinates) {
    throw new ValidationError("Delivery location coordinates are required");
  }
  validateDeliveryCoordinates(normalized.location);
  return normalized;
}

async function detectServiceZoneForPoint(lat, lng) {
  const zones = await FoodZone.find({ isActive: true }).lean();
  for (const zone of zones) {
    const coords = (Array.isArray(zone.coordinates) ? zone.coordinates : []).filter(
      (point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude),
    );
    if (coords.length < 3) continue;
    if (isPointInPolygon(lat, lng, coords)) {
      return { status: "IN_SERVICE", zoneId: zone._id, zone };
    }
  }
  return { status: "OUT_OF_SERVICE", zoneId: null, zone: null };
}

async function assertDeliveryInServiceArea(deliveryAddress) {
  const point = getPointLatLng(deliveryAddress?.location);
  if (!point) {
    throw new ValidationError("Delivery location coordinates are required");
  }
  const result = await detectServiceZoneForPoint(point.lat, point.lng);
  if (result.status !== "IN_SERVICE") {
    throw new ValidationError("Delivery address is outside our service area");
  }
  return result;
}

function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function normalizeFoodFeeSettings(feeDoc = null) {
  const defaultFeeSettings = {
    deliveryFee: 25,
    baseDistanceKm: 3,
    baseDeliveryFee: 25,
    perKmCharge: 10,
    sponsorRules: [],
    platformFee: 5,
    packagingFee: 0,
    gstRate: 5,
    mixedOrderDistanceLimit: 2,
    mixedOrderAngleLimit: 35,
  };

  const feeSettings = {
    ...defaultFeeSettings,
    ...(feeDoc || {}),
  };

  feeSettings.baseDistanceKm = Number(
    feeSettings.baseDistanceKm ?? defaultFeeSettings.baseDistanceKm,
  );
  feeSettings.baseDeliveryFee = Number(
    feeSettings.baseDeliveryFee ??
      feeSettings.deliveryFee ??
      defaultFeeSettings.baseDeliveryFee,
  );
  feeSettings.perKmCharge = Number(
    feeSettings.perKmCharge ?? defaultFeeSettings.perKmCharge,
  );
  feeSettings.deliveryFee = Number(
    feeSettings.deliveryFee ?? feeSettings.baseDeliveryFee ?? defaultFeeSettings.deliveryFee,
  );
  feeSettings.platformFee = Number(
    feeSettings.platformFee ?? defaultFeeSettings.platformFee,
  );
  feeSettings.packagingFee = Number(
    feeSettings.packagingFee ?? defaultFeeSettings.packagingFee,
  );
  if (!Number.isFinite(feeSettings.packagingFee) || feeSettings.packagingFee < 0) {
    feeSettings.packagingFee = 0;
  }
  feeSettings.gstRate = Number(feeSettings.gstRate ?? defaultFeeSettings.gstRate);
  feeSettings.mixedOrderDistanceLimit = Number(
    feeSettings.mixedOrderDistanceLimit ?? defaultFeeSettings.mixedOrderDistanceLimit,
  );
  feeSettings.mixedOrderAngleLimit = Number(
    feeSettings.mixedOrderAngleLimit ?? defaultFeeSettings.mixedOrderAngleLimit,
  );
  feeSettings.sponsorRules = Array.isArray(feeSettings.sponsorRules)
    ? feeSettings.sponsorRules
    : [];
  feeSettings.deliveryDistanceSlabs = Array.isArray(feeSettings.deliveryDistanceSlabs)
    ? feeSettings.deliveryDistanceSlabs
    : [];
  feeSettings.deliveryFeeRanges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? feeSettings.deliveryFeeRanges
    : [];

  return feeSettings;
}

async function applyRangeBasedFoodDeliveryPricing({ feeSettings, subtotal, address, restaurant }) {
  const distanceKm =
    (await resolveRestaurantToUserRoadDistanceKm(restaurant, address)) ?? 0;
  const deliveryFeeResult = resolveUserDeliveryFee(feeSettings, { subtotal, distanceKm });
  const deliveryFee = roundCurrency(deliveryFeeResult.deliveryFee);

  return {
    deliveryFee,
    totalDeliveryFee: deliveryFee,
    userDeliveryFee: deliveryFee,
    restaurantDeliveryFee: 0,
    sponsoredDelivery: false,
    sponsoredKm: 0,
    deliveryDistanceKm: deliveryFeeResult.distanceKm,
    deliverySponsorType: "USER_FULL",
    deliveryFeeBreakdown: {
      source: deliveryFeeResult.source,
      distanceKm: deliveryFeeResult.distanceKm,
      deliveryFee,
    },
  };
}

function calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;

  if (Array.isArray(feeSettings?.deliveryDistanceSlabs) && feeSettings.deliveryDistanceSlabs.length > 0) {
    const baseSlab = feeSettings.deliveryDistanceSlabs.find((s) => Number(s.fromKm || 0) === 0);
    
    if (!baseSlab) {
      // Fallback: If no base slab exists starting at 0, do traditional range matching
      const matchedSlab = feeSettings.deliveryDistanceSlabs.find(
        (slab) => distance >= Number(slab.fromKm) && distance <= Number(slab.toKm)
      );
      if (matchedSlab) {
        return roundCurrency(Number(matchedSlab.deliveryFee));
      }
      const sortedSlabs = [...feeSettings.deliveryDistanceSlabs].sort((a, b) => Number(b.toKm) - Number(a.toKm));
      if (sortedSlabs.length > 0 && distance > Number(sortedSlabs[0].toKm)) {
        return roundCurrency(Number(sortedSlabs[0].deliveryFee));
      }
      return roundCurrency(resolveConfiguredDeliveryFeeFallback(feeSettings, distance));
    }

    const baseFee = Number(baseSlab.deliveryFee || 0);
    const baseMax = Number(baseSlab.toKm || 0);

    // If distance is within the base slab (e.g. 0-5 km)
    if (distance <= baseMax) {
      return roundCurrency(baseFee);
    }

    // Distance is greater than baseMax (e.g. > 5 km).
    const sorted = [...feeSettings.deliveryDistanceSlabs].sort((a, b) => Number(a.fromKm || 0) - Number(b.fromKm || 0));
    let totalFee = baseFee;

    for (const slab of sorted) {
      const slabMin = Number(slab.fromKm || 0);
      if (slabMin === 0) continue; // Skip base slab as it is already included

      const slabMax = slab.toKm == null ? null : Number(slab.toKm);
      const rate = Number(slab.deliveryFee || 0);

      if (distance <= slabMin) continue;

      const upper = slabMax == null ? distance : Math.min(distance, slabMax);
      const kmInSlab = Math.max(0, upper - slabMin);

      if (kmInSlab > 0) {
        totalFee += kmInSlab * rate;
      }
    }

    return roundCurrency(totalFee);
  }

  // No slabs: use admin flat / base+per-km (never hardcode ₹60).
  return roundCurrency(resolveConfiguredDeliveryFeeFallback(feeSettings, distance));
}

function resolveSponsorRule(subtotal, distanceKm, sponsorRules = []) {
  const safeSubtotal = Number(subtotal);
  const safeDistance = Number(distanceKm);
  if (!Number.isFinite(safeSubtotal) || !Number.isFinite(safeDistance)) return null;

  const normalizedRules = (Array.isArray(sponsorRules) ? sponsorRules : [])
    .map((rule, index) => {
      const minOrderAmount = Number(rule?.minOrderAmount);
      const maxOrderAmount =
        rule?.maxOrderAmount == null || rule?.maxOrderAmount === ""
          ? null
          : Number(rule.maxOrderAmount);
      const maxDistanceKm = Number(rule?.maxDistanceKm);
      const sponsoredKm =
        rule?.sponsoredKm == null || rule?.sponsoredKm === ""
          ? null
          : Number(rule.sponsoredKm);
      return {
        index,
        minOrderAmount,
        maxOrderAmount,
        maxDistanceKm,
        sponsorType: String(rule?.sponsorType || "").trim().toUpperCase(),
        sponsoredKm,
      };
    })
    .filter((rule) =>
      Number.isFinite(rule.minOrderAmount) &&
      Number.isFinite(rule.maxDistanceKm) &&
      rule.maxDistanceKm >= 0 &&
      ["USER_FULL", "RESTAURANT_FULL", "SPLIT"].includes(rule.sponsorType),
    )
    .sort((a, b) => {
      if (b.minOrderAmount !== a.minOrderAmount) return b.minOrderAmount - a.minOrderAmount;
      if (a.maxDistanceKm !== b.maxDistanceKm) return a.maxDistanceKm - b.maxDistanceKm;
      return a.index - b.index;
    });

  return (
    normalizedRules.find((rule) => {
      const orderOk =
        safeSubtotal >= rule.minOrderAmount &&
        (rule.maxOrderAmount == null || safeSubtotal <= rule.maxOrderAmount);
      const distanceOk = safeDistance <= rule.maxDistanceKm;
      return orderOk && distanceOk;
    }) || null
  );
}

function calculateFoodDeliveryPricing({
  subtotal,
  distanceKm,
  feeSettings,
}) {
  const safeDistance =
    Number.isFinite(Number(distanceKm)) && Number(distanceKm) >= 0
      ? Number(distanceKm)
      : 0;
  const totalDeliveryFee = calculateBaseDeliveryFeeForDistance(safeDistance, feeSettings);
  const matchedRule = (Array.isArray(feeSettings?.deliveryDistanceSlabs) && feeSettings.deliveryDistanceSlabs.length > 0)
    ? null
    : resolveSponsorRule(subtotal, safeDistance, feeSettings?.sponsorRules);

  let userDeliveryFee = totalDeliveryFee;
  let restaurantDeliveryFee = 0;
  let sponsoredKm = 0;
  let deliverySponsorType = "USER_FULL";

  if (matchedRule?.sponsorType === "RESTAURANT_FULL") {
    userDeliveryFee = 0;
    restaurantDeliveryFee = totalDeliveryFee;
    sponsoredKm = safeDistance;
    deliverySponsorType = "RESTAURANT_FULL";
  } else if (matchedRule?.sponsorType === "SPLIT") {
    const safeSponsoredKm = Math.max(
      0,
      Math.min(safeDistance, Number(matchedRule.sponsoredKm || 0)),
    );
    restaurantDeliveryFee = Math.min(
      totalDeliveryFee,
      calculateBaseDeliveryFeeForDistance(safeSponsoredKm, feeSettings),
    );
    userDeliveryFee = Math.max(0, roundCurrency(totalDeliveryFee - restaurantDeliveryFee));
    sponsoredKm = safeSponsoredKm;
    deliverySponsorType = "SPLIT";
  } else if (matchedRule?.sponsorType === "USER_FULL") {
    deliverySponsorType = "USER_FULL";
  }

  return {
    totalDeliveryFee: roundCurrency(totalDeliveryFee),
    userDeliveryFee: roundCurrency(userDeliveryFee),
    restaurantDeliveryFee: roundCurrency(restaurantDeliveryFee),
    deliveryFee: roundCurrency(userDeliveryFee),
    sponsoredDelivery: roundCurrency(restaurantDeliveryFee) > 0,
    sponsoredKm: roundCurrency(sponsoredKm),
    deliveryDistanceKm: roundCurrency(safeDistance),
    deliverySponsorType,
  };
}

function angleBetweenPickupVectors(userPoint, firstPoint, secondPoint) {
  if (!userPoint || !firstPoint || !secondPoint) return null;
  const v1x = Number(firstPoint.lng) - Number(userPoint.lng);
  const v1y = Number(firstPoint.lat) - Number(userPoint.lat);
  const v2x = Number(secondPoint.lng) - Number(userPoint.lng);
  const v2y = Number(secondPoint.lat) - Number(userPoint.lat);
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosine = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
  return Math.acos(cosine) * (180 / Math.PI);
}

async function fetchPickupSourcesByType(items = []) {
  const foodSourceIds = [
    ...new Set(
      items
        .filter((item) => item.type === "food")
        .map((item) => item.sourceId)
        .filter(Boolean)
        .map((id) => String(id).trim()),
    ),
  ];
  const quickSourceIds = [
    ...new Set(
      items
        .filter((item) => item.type === "quick")
        .map((item) => item.sourceId)
        .filter(Boolean),
    ),
  ];
  const foodObjectIds = foodSourceIds
    .filter((id) => isMongoObjectIdString(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  // Option B: any non-ObjectId inbound key is treated as business restaurantId.
  const foodBusinessIds = foodSourceIds
    .filter((id) => !isMongoObjectIdString(id))
    .map((id) => String(id).toUpperCase());

  const restaurantQueryParts = [
    ...(foodObjectIds.length ? [{ _id: { $in: foodObjectIds } }] : []),
    ...(foodBusinessIds.length
      ? [{ restaurantId: { $in: foodBusinessIds } }]
      : []),
  ];

  const [restaurants, sellers] = await Promise.all([
    foodSourceIds.length && restaurantQueryParts.length
      ? FoodRestaurant.find({ $or: restaurantQueryParts })
          .select(
            "restaurantId restaurantName location addressLine1 area city state zoneId status commissionPercentage quickDeliveryEnabled scheduleOrderEnabled isAcceptingOrders kitchenPrepMinutes profileImage",
          )
          .lean()
      : [],
    quickSourceIds.length
      ? Seller.find({
          _id: {
            $in: quickSourceIds
              .filter((id) => isMongoObjectIdString(id))
              .map((id) => new mongoose.Types.ObjectId(id)),
          },
        })
          .select("shopName name location shopInfo approvalStatus approved isActive")
          .lean()
      : [],
  ]);

  const sourceMap = new Map();
  for (const restaurant of restaurants) {
    const normalizedRestaurant = toNormalizedFoodRestaurantSource(restaurant);
    if (!normalizedRestaurant) continue;
    sourceMap.set(normalizedRestaurant.sourceId, normalizedRestaurant);
    if (normalizedRestaurant.businessRestaurantId) {
      sourceMap.set(normalizedRestaurant.businessRestaurantId, normalizedRestaurant);
    }
  }
  for (const seller of sellers) {
    sourceMap.set(String(seller._id), {
      type: "quick",
      sourceId: String(seller._id),
      sourceName: seller.shopName || seller.name || "Quick Commerce",
      status:
        seller.approvalStatus ||
        (seller.approved && seller.isActive ? "approved" : "inactive"),
      location: seller.location,
      zoneId: seller.shopInfo?.zoneId || null,
      address:
        seller.location?.formattedAddress ||
        seller.location?.address ||
        "",
    });
  }
  return sourceMap;
}

/**
 * Single identity entry for food cart/order: load sources once, rewrite
 * item.sourceId → Mongo _id, return map + primary restaurant.
 */
async function resolveFoodOrderSources(items = [], dtoRestaurantId = null) {
  const sourceMap = await fetchPickupSourcesByType(items);
  canonicalizeFoodItemSourceIds(items, sourceMap);

  // Ensure dto.restaurantId is present even when cart items omit sourceId.
  if (dtoRestaurantId) {
    const dtoKey = String(dtoRestaurantId).trim();
    const already =
      sourceMap.get(dtoKey) ||
      sourceMap.get(dtoKey.toUpperCase()) ||
      sourceMap.get(dtoKey.toLowerCase());
    if (!already) {
      const doc = await resolveRestaurantDocument(dtoKey);
      const normalized = toNormalizedFoodRestaurantSource(doc);
      if (normalized) {
        sourceMap.set(normalized.sourceId, normalized);
        if (normalized.businessRestaurantId) {
          sourceMap.set(normalized.businessRestaurantId, normalized);
        }
      }
    }
  }

  const foodSourceIds = [
    ...new Set(
      items
        .filter((item) => item.type === "food")
        .map((item) => item.sourceId)
        .filter(Boolean),
    ),
  ];

  const primaryKey = dtoRestaurantId || foodSourceIds[0] || null;
  let primaryRestaurant = primaryKey
    ? sourceMap.get(String(primaryKey)) ||
      sourceMap.get(String(primaryKey).toUpperCase())
    : null;

  // dto.restaurantId may be business code while items already canonicalized to _id
  if (!primaryRestaurant && dtoRestaurantId) {
    primaryRestaurant =
      sourceMap.get(String(dtoRestaurantId).toUpperCase()) ||
      sourceMap.get(String(dtoRestaurantId));
  }
  if (!primaryRestaurant && foodSourceIds[0]) {
    primaryRestaurant = sourceMap.get(String(foodSourceIds[0]));
  }

  return { sourceMap, primaryRestaurant, foodSourceIds };
}

function buildPickupPointsFromItems(items = [], sourceMap = new Map()) {
  const grouped = new Map();
  for (const item of items) {
    const source =
      sourceMap.get(String(item.sourceId)) ||
      sourceMap.get(String(item.sourceId || "").toUpperCase()) ||
      {};
    // Always prefer canonical Mongo sourceId from the map (Option B).
    const canonicalSourceId = String(source.sourceId || item.sourceId || "");
    const key = `${item.type}:${canonicalSourceId}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        pickupType: item.type,
        sourceId: canonicalSourceId,
        sourceName: item.sourceName || source.sourceName || "",
        address: source.address || "",
        location: source.location?.coordinates
          ? { type: "Point", coordinates: source.location.coordinates }
          : undefined,
        itemIds: [],
      });
    }
    grouped.get(key).itemIds.push(String(item.itemId || item.id || item.name));
  }
  return [...grouped.values()];
}

async function evaluateCombinedPickupEligibility(pickupPoints = [], deliveryAddress) {
  const foodPickup = pickupPoints.find((point) => point.pickupType === "food");
  const quickPickup = pickupPoints.find((point) => point.pickupType === "quick");
  const foodPoint = getPointLatLng(foodPickup?.location);
  const quickPoint = getPointLatLng(quickPickup?.location);
  const userPoint = getPointLatLng(deliveryAddress?.location);
  if (!foodPoint || !quickPoint || !userPoint) {
    const missing = [];
    if (!foodPoint) missing.push("food pickup");
    if (!quickPoint) missing.push("quick pickup");
    if (!userPoint) missing.push("delivery");
    return {
      eligible: false,
      pickupDistanceKm: null,
      sameDirection: false,
      reason: `${missing.join(" and ")} coordinates are unavailable`,
    };
  }

  // Fetch dynamic settings
  const feeDoc = await FoodFeeSettings.findOne({ isActive: { $ne: false } }).sort({ createdAt: -1 }).lean();
  const distLimit = feeDoc?.mixedOrderDistanceLimit ?? 2;
  const angleLimit = feeDoc?.mixedOrderAngleLimit ?? 35;

  const pickupDistanceKm = await roadDistanceKm(
    foodPoint.lat,
    foodPoint.lng,
    quickPoint.lat,
    quickPoint.lng,
  );
  const angle = angleBetweenPickupVectors(userPoint, foodPoint, quickPoint);
  
  // If pickups are very close to each other (e.g. < 200m), they are definitely in the same direction for practical purposes
  const isVeryClose = pickupDistanceKm <= 0.2;
  const sameDirection = isVeryClose || (angle == null ? false : angle <= angleLimit);
  
  const eligible = pickupDistanceKm <= distLimit && sameDirection;
  return {
    eligible,
    distanceLimitKm: Number(distLimit),
    angleLimitDeg: Number(angleLimit),
    pickupDistanceKm: Number.isFinite(pickupDistanceKm) ? Number(pickupDistanceKm.toFixed(2)) : null,
    sameDirection,
    reason: eligible
      ? "Pickups are close and aligned for a shared rider"
      : pickupDistanceKm > distLimit
        ? `Pickups are more than ${distLimit} km apart`
        : `Pickups are not in the same direction (exceeds ${angleLimit}° deviation)`,
  };
}

async function resolveDispatchPlanMeta(orderType, pickupPoints = [], deliveryAddress) {
  if (orderType === "mixed") {
    return evaluateCombinedPickupEligibility(pickupPoints, deliveryAddress);
  }

  const primaryPickup = pickupPoints[0];
  const pickupPoint = getPointLatLng(primaryPickup?.location);
  const deliveryPoint = getPointLatLng(deliveryAddress?.location);

  if (!pickupPoint) {
    return {
      eligible: false,
      pickupDistanceKm: null,
      sameDirection: false,
      reason: "Pickup coordinates are unavailable",
    };
  }
  if (!deliveryPoint) {
    return {
      eligible: false,
      pickupDistanceKm: null,
      sameDirection: false,
      reason: "Delivery coordinates are unavailable",
    };
  }

  const distanceKm = await roadDistanceKm(
    pickupPoint.lat,
    pickupPoint.lng,
    deliveryPoint.lat,
    deliveryPoint.lng,
  );

  return {
    eligible: true,
    pickupDistanceKm: Number.isFinite(distanceKm)
      ? Number(distanceKm.toFixed(2))
      : null,
    sameDirection: true,
    reason:
      orderType === "quick"
        ? "Quick commerce single pickup delivery"
        : "Single pickup delivery",
  };
}

async function populateDispatchLegPartnerCandidates(dispatchPlan, pickupPoints = []) {
  if (!dispatchPlan || !Array.isArray(dispatchPlan.legs) || !pickupPoints.length) {
    return;
  }

  const legCandidates = await Promise.all(
    pickupPoints.map(async (point) => ({
      legId: `${point.pickupType}:${point.sourceId}`,
      partnerCandidates: await listNearbyPartnersForPoint(point),
    })),
  );

  for (const leg of dispatchPlan.legs) {
    const found = legCandidates.find((candidate) => candidate.legId === leg.legId);
    if (found) leg.partnerCandidates = found.partnerCandidates;
  }
}

async function listNearbyPartnersForPoint(point, { maxKm = 15, limit = 5 } = {}) {
  const latLng = getPointLatLng(point?.location);
  if (!latLng) {
    const fallbackPartners = await FoodDeliveryPartner.find({
      status: "approved",
      availabilityStatus: "online",
    })
      .select("_id")
      .limit(Math.max(1, limit))
      .lean();

    return fallbackPartners.map((partner) => ({
      partnerId: partner._id,
      distanceKm: null,
    }));
  }

  const partners = await FoodDeliveryPartner.find({
    status: "approved",
    availabilityStatus: "online",
    lastLat: { $exists: true, $ne: null },
    lastLng: { $exists: true, $ne: null },
  })
    .select("_id lastLat lastLng")
    .lean();

  const scored = await scorePointsByRoadDistance(
    latLng,
    partners.map((partner) => ({
      partnerId: partner._id,
      lat: partner.lastLat,
      lng: partner.lastLng,
    })),
    { maxKm },
  );

  const nearbyPartners = scored
    .slice(0, Math.max(1, limit))
    .map(({ partnerId, distanceKm }) => ({ partnerId, distanceKm }));

  if (nearbyPartners.length > 0) {
    return nearbyPartners;
  }

  const fallbackPartners = await FoodDeliveryPartner.find({
    status: "approved",
    availabilityStatus: "online",
  })
    .select("_id")
    .limit(Math.max(1, limit))
    .lean();

  return fallbackPartners.map((partner) => ({
    partnerId: partner._id,
    distanceKm: null,
  }));
}

function pushStatusHistory(order, { byRole, byId, from, to, note = "" }) {
  const fromNorm = String(from || "").trim();
  const toNorm = String(to || "").trim();
  if (!toNorm || fromNorm === toNorm) return;
  order.statusHistory.push({
    at: new Date(),
    byRole,
    byId: byId || undefined,
    from: fromNorm,
    to: toNorm,
    note,
  });
}

/**
 * Female customer privacy mask — Admin > Global Settings > Customer Privacy Settings.
 * When enabled, hides a female customer's real phone from delivery-partner-facing
 * order views and routes them to the configured support number instead.
 * No-ops (and never throws) when `userId` isn't populated with `gender`, so callers
 * that haven't opted into the populate keep working exactly as before.
 */
function applyCustomerContactProtection(orderLike) {
  const userGender = orderLike?.userId?.gender || "";
  const isFemale = String(userGender).toLowerCase() === "female";
  const settings = getPrivacySettingsSync();

  if (isFemale && settings.enableFemaleContactProtection) {
    orderLike.customerPhone = null;
    orderLike.userPhone = null;
    orderLike.isContactProtected = true;
    orderLike.contactMessage = settings.privacyMessage;
    orderLike.companySupportNumber = settings.companySupportNumber;
    orderLike.companyWhatsappNumber = settings.companyWhatsappNumber;
    if (orderLike.deliveryAddress) {
      orderLike.deliveryAddress = { ...orderLike.deliveryAddress, phone: null };
    }
  } else {
    orderLike.isContactProtected = false;
  }
  return orderLike;
}

/**
 * Returns a plain-object clone of `order` with `userId` guaranteed to carry
 * `gender` (fetched separately when not already populated), for feeding into
 * applyCustomerContactProtection via buildDeliverySocketPayload. Never mutates
 * the original `order` doc, since callers keep using it afterward (e.g. as a
 * live mongoose document, or passing `order.userId` as a raw id elsewhere).
 */
async function resolveOrderWithCustomerGender(order) {
  const userRef = order?.userId;
  if (userRef && typeof userRef === "object" && "gender" in userRef) {
    return order;
  }
  const userId = userRef?._id || userRef;
  if (!userId) return order;
  try {
    const genderDoc = await FoodUser.findById(userId).select("gender").lean();
    const base = order?.toObject ? order.toObject() : order;
    return { ...base, userId: { _id: userId, gender: genderDoc?.gender } };
  } catch {
    return order;
  }
}

function normalizeOrderForClient(orderDoc) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const mongoId = (order._id || orderDoc?._id || "").toString();
  const displayId = order.orderId || order.order_id || mongoId;
  return {
    ...order,
    orderMongoId: mongoId,
    orderId: displayId,
    status: order?.orderStatus || order?.status || "",
    deliveredAt:
      order?.deliveryState?.deliveredAt || order?.deliveredAt || null,
    deliveryPartnerId:
      order?.dispatch?.deliveryPartnerId || order?.deliveryPartnerId || null,
    rating: order?.ratings?.restaurant?.rating ?? order?.rating ?? null,
    deliveryState: {
      ...(order?.deliveryState || {}),
      currentLocation: order?.lastRiderLocation?.coordinates?.length >= 2 ? {
        lat: order.lastRiderLocation.coordinates[1],
        lng: order.lastRiderLocation.coordinates[0]
      } : (order?.deliveryState?.currentLocation || null)
    }
  };
}

function toIdString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function isSplitDispatchOrder(order) {
  return (
    order?.orderType === "mixed" &&
    ["split", "express_split"].includes(String(order?.dispatchPlan?.strategy || ""))
  );
}

function isExpressSplitDispatchOrder(order) {
  return (
    order?.orderType === "mixed" &&
    String(order?.dispatchPlan?.strategy || "") === "express_split"
  );
}

function getAssignedDispatchLeg(order, deliveryPartnerId) {
  const partnerId = toIdString(deliveryPartnerId);
  if (!partnerId) return null;
  return (
    (order?.dispatchPlan?.legs || []).find(
      (leg) => toIdString(leg?.deliveryPartnerId) === partnerId,
    ) || null
  );
}

function isOrderAssignedToDeliveryPartner(order, deliveryPartnerId) {
  const partnerId = toIdString(deliveryPartnerId);
  if (!partnerId) return false;

  const wholeOrderPartnerId = toIdString(order?.dispatch?.deliveryPartnerId);
  if (wholeOrderPartnerId === partnerId) return true;

  return Boolean(getAssignedDispatchLeg(order, deliveryPartnerId));
}

function filterOrderItemsForLeg(order, leg) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!leg?.legId) return items;
  const targetLegId = String(leg.legId);
  return items.filter(
    (item) => `${item?.type || item?.orderType}:${item?.sourceId}` === targetLegId,
  );
}

function getEligibleDispatchLegs(order, deliveryPartnerId) {
  const partnerId = toIdString(deliveryPartnerId);
  if (!partnerId) return [];
  const existingAssignedLeg = getAssignedDispatchLeg(order, deliveryPartnerId);
  if (isExpressSplitDispatchOrder(order) && existingAssignedLeg) {
    return [];
  }
  return (order?.dispatchPlan?.legs || [])
    .filter((leg) => !toIdString(leg?.deliveryPartnerId))
    .filter((leg) =>
      (leg?.partnerCandidates || []).some(
        (candidate) => toIdString(candidate?.partnerId) === partnerId,
      ),
    )
    .map((leg) => {
      const candidate = (leg?.partnerCandidates || []).find(
        (entry) => toIdString(entry?.partnerId) === partnerId,
      );
      return {
        ...leg,
        candidateDistanceKm: Number.isFinite(candidate?.distanceKm)
          ? candidate.distanceKm
          : null,
      };
    });
}

function sortDispatchLegsByCandidateDistance(legs = []) {
  return [...legs].sort((a, b) => {
    const aDistance = Number.isFinite(a?.candidateDistanceKm)
      ? a.candidateDistanceKm
      : Number.POSITIVE_INFINITY;
    const bDistance = Number.isFinite(b?.candidateDistanceKm)
      ? b.candidateDistanceKm
      : Number.POSITIVE_INFINITY;
    return aDistance - bDistance;
  });
}

async function claimSplitDispatchLegAtomically(order, deliveryPartnerId, requestedLegId = "") {
  const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  const partnerIdString = partnerId.toString();
  const orderLegs = Array.isArray(order?.dispatchPlan?.legs) ? order.dispatchPlan.legs : [];
  const existingLeg = getAssignedDispatchLeg(order, deliveryPartnerId);
  const trimmedRequestedLegId = String(requestedLegId || "").trim();
  const requestedLeg = trimmedRequestedLegId
    ? orderLegs.find((leg) => String(leg?.legId || "") === trimmedRequestedLegId)
    : null;

  if (
    isExpressSplitDispatchOrder(order) &&
    existingLeg &&
    trimmedRequestedLegId &&
    existingLeg.legId !== trimmedRequestedLegId
  ) {
    throw new ValidationError(
      "Express mixed delivery assigns separate riders per pickup leg",
    );
  }

  if (requestedLeg && !existingLeg) {
    const legOwnerId = toIdString(requestedLeg?.deliveryPartnerId);
    if (legOwnerId && legOwnerId !== partnerIdString) {
      throw new ForbiddenError("This dispatch leg is already claimed by another rider");
    }

    const eligibleForRequestedLeg = (requestedLeg?.partnerCandidates || []).some(
      (candidate) => toIdString(candidate?.partnerId) === partnerIdString,
    );

    if (!legOwnerId && !eligibleForRequestedLeg) {
      throw new ForbiddenError("This dispatch leg is not available for this rider");
    }
  }

  if (existingLeg) {
    const updatedOrder = await FoodOrder.findById(order._id);
    return {
      updatedOrder,
      claimedLegId: existingLeg.legId,
    };
  }

  const eligibleLegs = sortDispatchLegsByCandidateDistance(
    getEligibleDispatchLegs(order, deliveryPartnerId),
  );
  const candidateLegIds = trimmedRequestedLegId
    ? [trimmedRequestedLegId]
    : eligibleLegs.map((leg) => String(leg?.legId || "")).filter(Boolean);

  if (!candidateLegIds.length) {
    throw new ValidationError("No dispatch leg is currently available for this rider");
  }

  for (const legId of candidateLegIds) {
    const claimQuery = {
      _id: order._id,
      orderStatus: {
        $in: ["confirmed", "preparing", "ready_for_pickup", "picked_up"],
      },
      dispatchPlan: {
        $exists: true,
      },
      "dispatchPlan.legs": {
        $elemMatch: {
          legId,
          deliveryPartnerId: null,
          partnerCandidates: {
            $elemMatch: {
              partnerId,
            },
          },
        },
      },
    };

    if (isExpressSplitDispatchOrder(order)) {
      claimQuery["dispatchPlan.legs.deliveryPartnerId"] = { $ne: partnerId };
    }

    const claimUpdate = {
      $set: {
        "dispatchPlan.legs.$[target].deliveryPartnerId": partnerId,
        "dispatchPlan.legs.$[target].assignedAt": new Date(),
        "dispatch.assignedAt": order?.dispatch?.assignedAt || new Date(),
      },
    };

    const claimOptions = {
      arrayFilters: [
        {
          "target.legId": legId,
          "target.deliveryPartnerId": null,
        },
      ],
    };

    if (isExpressSplitDispatchOrder(order)) {
      claimUpdate.$pull = {
        "dispatchPlan.legs.$[other].partnerCandidates": {
          partnerId,
        },
      };
      claimOptions.arrayFilters.push({
        "other.legId": { $ne: legId },
      });
    }

    const claimResult = await FoodOrder.updateOne(claimQuery, claimUpdate, claimOptions);
    if (claimResult?.modifiedCount > 0) {
      const updatedOrder = await FoodOrder.findById(order._id);
      return {
        updatedOrder,
        claimedLegId: legId,
      };
    }
  }

  throw new ValidationError("No dispatch leg is currently available for this rider");
}

function reorderPickupPointsForLeg(order, legId) {
  const pickupPoints = Array.isArray(order?.pickupPoints) ? [...order.pickupPoints] : [];
  if (!legId || pickupPoints.length <= 1) return pickupPoints;
  const selectedIndex = pickupPoints.findIndex(
    (point) => `${point?.pickupType}:${point?.sourceId}` === legId,
  );
  if (selectedIndex <= 0) return pickupPoints;
  const [selectedPoint] = pickupPoints.splice(selectedIndex, 1);
  return [selectedPoint, ...pickupPoints];
}

function buildDeliveryOrderView(orderDoc, deliveryPartnerId, options = {}) {
  const order = normalizeOrderForClient(orderDoc);
  const assignedLeg =
    options.assignedDispatchLeg ||
    getAssignedDispatchLeg(orderDoc, deliveryPartnerId);
  const offeredLeg =
    options.dispatchLeg ||
    assignedLeg ||
    getEligibleDispatchLegs(orderDoc, deliveryPartnerId)[0] ||
    null;

  const activeLeg = assignedLeg || offeredLeg;
  order.orderMongoId =
    orderDoc?._id?.toString?.() || order?._id?.toString?.() || toIdString(order?._id);
  order.orderId = order?.orderId || order?.order_id || order.orderMongoId;

  if (activeLeg) {
    const legDeliveryFee = Number(activeLeg?.deliveryFee || 0);
    const legRiderEarning = Number(activeLeg?.riderEarning || 0);
    order.dispatchOfferType = isSplitDispatchOrder(orderDoc) ? "split_leg" : "single";
    if (isSplitDispatchOrder(orderDoc)) {
      order.deliveryFee = legDeliveryFee;
      order.riderEarning = legRiderEarning;
      order.earnings = legRiderEarning || legDeliveryFee || 0;
    }
    order.dispatchLeg = {
      legId: activeLeg.legId,
      pickupType: activeLeg.pickupType,
      sourceId: activeLeg.sourceId,
      sourceName: activeLeg.sourceName || "",
      deliveryFee: legDeliveryFee,
      riderEarning: legRiderEarning,
      candidateDistanceKm: Number.isFinite(activeLeg?.candidateDistanceKm)
        ? activeLeg.candidateDistanceKm
        : null,
      assignedAt: activeLeg.assignedAt || null,
      deliveryPartnerId: activeLeg.deliveryPartnerId || null,
    };
    if (isSplitDispatchOrder(orderDoc)) {
      order.items = filterOrderItemsForLeg(orderDoc, activeLeg);
      order.pickupPoints = reorderPickupPointsForLeg(orderDoc, activeLeg.legId).filter(
        (point) => `${point?.pickupType}:${point?.sourceId}` === activeLeg.legId,
      );
    } else {
      order.pickupPoints = reorderPickupPointsForLeg(orderDoc, activeLeg.legId);
    }
  }

  if (assignedLeg) {
    order.assignedDispatchLeg = {
      legId: assignedLeg.legId,
      pickupType: assignedLeg.pickupType,
      sourceId: assignedLeg.sourceId,
      sourceName: assignedLeg.sourceName || "",
      assignedAt: assignedLeg.assignedAt || null,
      deliveryPartnerId: assignedLeg.deliveryPartnerId || null,
    };
    order.deliveryPartnerId = assignedLeg.deliveryPartnerId || order.deliveryPartnerId || null;
  }

  return applyCustomerContactProtection(order);
}

async function applyAggregateRating(model, entityId, newRating) {
  if (!entityId) return;
  const doc = await model.findById(entityId).select("rating totalRatings");
  if (!doc) return;

  const totalRatings = Number(doc.totalRatings || 0);
  const currentAverage = Number(doc.rating || 0);
  const nextTotal = totalRatings + 1;
  const nextAverage = Number(
    ((currentAverage * totalRatings + Number(newRating)) / nextTotal).toFixed(
      1,
    ),
  );

  doc.totalRatings = nextTotal;
  doc.rating = nextAverage;
  await doc.save();
}

// 🗑️ Moved to foodTransaction.service.js to centralize finance logic.

// 🗑️ Moved to foodTransaction.service.js to centralize finance logic.

/** Append-only food_order_payments row; never blocks main flow on failure */
// 🗑️ Deprecated in favor of FoodTransaction system.

function buildDeliverySocketPayload(orderDoc, restaurantDoc = null) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const restaurant = restaurantDoc || order?.restaurantId || null;
  const restaurantLocation = restaurant?.location || {};
  const pickupPoints = Array.isArray(order?.pickupPoints) ? order.pickupPoints : [];

  const payload = {
    orderMongoId:
      orderDoc?._id?.toString?.() || order?._id?.toString?.() || order?._id,
    orderId: order?.orderId,
    orderType: order?.orderType || "food",
    status: orderDoc?.orderStatus || order?.orderStatus,
    items: Array.isArray(order?.items)
      ? order.items.map((item) => ({
          name: item?.name,
          quantity: item?.quantity,
          price: item?.price,
          type: item?.type,
        }))
      : [],
    pickupPoints,
    pricing: order?.pricing
      ? {
          total: order.pricing.total,
          deliveryFee: order.pricing.deliveryFee,
          deliveryDistanceKm: order.pricing.deliveryDistanceKm,
          driverEarning: order.pricing.driverEarning,
        }
      : undefined,
    total: order?.pricing?.total,
    payment: order?.payment
      ? {
          method: order.payment.method,
          status: order.payment.status,
          amountDue: order.payment.amountDue,
        }
      : undefined,
    paymentMethod: order?.payment?.method,
    restaurantId:
      order?.restaurantId?._id?.toString?.() ||
      order?.restaurantId?.toString?.() ||
      order?.restaurantId,
    restaurantName: restaurant?.restaurantName || order?.restaurantName,
    restaurantAddress:
      restaurantLocation?.address ||
      restaurantLocation?.formattedAddress ||
      restaurant?.addressLine1 ||
      "",
    restaurantPhone: resolveRestaurantPhone(restaurant),
    restaurantLocation: {
      latitude:
        restaurantLocation?.latitude ||
        (Array.isArray(restaurantLocation?.coordinates)
          ? restaurantLocation.coordinates[1]
          : undefined),
      longitude:
        restaurantLocation?.longitude ||
        (Array.isArray(restaurantLocation?.coordinates)
          ? restaurantLocation.coordinates[0]
          : undefined),
      address:
        restaurantLocation?.address ||
        restaurantLocation?.formattedAddress ||
        restaurant?.addressLine1 ||
        "",
      area: restaurantLocation?.area || restaurant?.area || "",
      city: restaurantLocation?.city || restaurant?.city || "",
      state: restaurantLocation?.state || restaurant?.state || "",
    },
    deliveryAddress: order?.deliveryAddress,
    customerAddress: order?.deliveryAddress?.formattedAddress || order?.deliveryAddress?.addressLine1 || "",
    customerName: order?.userId?.name || order?.customerName || "",
    customerPhone: order?.userId?.phone || order?.deliveryAddress?.phone || "",
    userName: order?.userId?.name || order?.customerName || "",
    userPhone: order?.userId?.phone || order?.deliveryAddress?.phone || "",
    riderEarning: order?.riderEarning || 0,
    earnings: order?.riderEarning || order?.pricing?.deliveryFee || 0,
    deliveryFee: order?.pricing?.deliveryFee || 0,
    deliveryFleet: order?.deliveryFleet,
    dispatch: order?.dispatch
      ? {
          status: order.dispatch.status,
          deliveryPartnerId: order.dispatch.deliveryPartnerId,
          offerTimeoutSec: order.dispatch.offerTimeoutSec,
        }
      : undefined,
    distanceKm: order?.distanceKm ?? order?.pricing?.deliveryDistanceKm ?? null,
    deliveryDistanceKm: order?.deliveryDistanceKm ?? order?.pricing?.deliveryDistanceKm ?? null,
    createdAt: order?.createdAt,
    updatedAt: order?.updatedAt,
  };

  // Reuses order.userId (populated with gender where the caller's query opted
  // in) to apply the same female-contact-protection mask as buildDeliveryOrderView.
  payload.userId = order?.userId;
  const protectedPayload = applyCustomerContactProtection(payload);
  delete protectedPayload.userId;
  return protectedPayload;
}

function buildSplitLegSocketPayload(orderDoc, leg, restaurantDoc = null) {
  const basePayload = buildDeliverySocketPayload(orderDoc, restaurantDoc);
  const legId = String(leg?.legId || "");
  const legDeliveryFee = Number(leg?.deliveryFee || 0);
  const legRiderEarning = Number(leg?.riderEarning || 0);

  return {
    ...basePayload,
    dispatchOfferType: "split_leg",
    deliveryFee: legDeliveryFee,
    riderEarning: legRiderEarning,
    earnings: legRiderEarning || legDeliveryFee || 0,
    dispatchLeg: {
      legId,
      pickupType: leg?.pickupType || "",
      sourceId: leg?.sourceId || "",
      sourceName: leg?.sourceName || "",
      deliveryFee: legDeliveryFee,
      riderEarning: legRiderEarning,
      candidateDistanceKm: null,
      assignedAt: leg?.assignedAt || null,
      deliveryPartnerId: leg?.deliveryPartnerId || null,
    },
    items: filterOrderItemsForLeg(orderDoc, leg),
    pickupPoints: reorderPickupPointsForLeg(orderDoc, legId).filter(
      (point) => `${point?.pickupType}:${point?.sourceId}` === legId,
    ),
  };
}

function emitOrderClaimedToOtherPartners(order, {
  acceptedBy,
  legId = "",
  candidatePartnerIds = [],
} = {}) {
  try {
    const io = getIO();
    if (!io) return;

    const acceptedById = toIdString(acceptedBy);
    const payload = {
      orderId: String(order?.orderId || ""),
      orderMongoId: order?._id?.toString?.() || "",
      legId: String(legId || "").trim(),
      claimedBy: acceptedById,
    };

    const partnerIds = [...new Set(
      (Array.isArray(candidatePartnerIds) ? candidatePartnerIds : [])
        .map((value) => toIdString(value))
        .filter(Boolean)
        .filter((value) => value !== acceptedById),
    )];

    for (const partnerId of partnerIds) {
      io.to(rooms.delivery(partnerId)).emit("order_claimed", payload);
      io.to(rooms.delivery(partnerId)).emit("order_reassigned_elsewhere", payload);
    }
  } catch (error) {
    logger.warn(`emitOrderClaimedToOtherPartners failed: ${error?.message || error}`);
  }
}

function buildSellerOrderAddress(deliveryAddress) {
  if (!deliveryAddress) return { address: "", city: "" };
  const coords = deliveryAddress?.location?.coordinates;
  return {
    address: deliveryAddress.street || "",
    city: deliveryAddress.city || "",
    ...(Array.isArray(coords) && coords.length === 2
      ? {
          location: {
            lat: Number(coords[1]),
            lng: Number(coords[0]),
          },
        }
      : {}),
  };
}

function buildSellerOrdersFromParent(orderDoc, { customerName = "", customerPhone = "" } = {}) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const quickItems = Array.isArray(order.items)
    ? order.items.filter((item) => item?.type === "quick")
    : [];
  if (!quickItems.length) return [];

  const quickSubtotal = quickItems.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
  const totalDeliveryFee = Number(order?.pricing?.deliveryFee || 0);
  const sellerBuckets = new Map();

  for (const item of quickItems) {
    const sellerId = String(item?.sourceId || "").trim();
    if (!sellerId || !mongoose.isValidObjectId(sellerId)) continue;
    if (!sellerBuckets.has(sellerId)) sellerBuckets.set(sellerId, []);
    sellerBuckets.get(sellerId).push(item);
  }

  return Promise.all(
    Array.from(sellerBuckets.entries()).map(async ([sellerId, sellerItems]) => {
      const sellerSubtotal = sellerItems.reduce(
        (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
        0,
      );
      const allocatedDeliveryFee =
        quickSubtotal > 0
          ? Number(((totalDeliveryFee * sellerSubtotal) / quickSubtotal).toFixed(2))
          : 0;

      // Phase 2: Calculate commission and receivable for sellers
      let commissionAmount = 0;
      let receivable = sellerSubtotal;

      try {
        const snapshot = await getHeaderCommissionSnapshot(
          sellerItems.map((item) => ({
            productId: item?.itemId || item?.productId,
            price: item?.price,
            quantity: item?.quantity,
          })),
        );
        commissionAmount = Number(snapshot?.commissionAmount || 0);
        receivable = Math.max(0, Number((sellerSubtotal - commissionAmount).toFixed(2)));
      } catch (err) {
        logger.warn(`Failed to get commission snapshot for seller ${sellerId}: ${err.message}`);
      }

      return {
        orderType: order.orderType === "mixed" ? "mixed" : "quick",
        parentOrderId: orderDoc?._id || order?._id || null,
        sellerId: new mongoose.Types.ObjectId(sellerId),
        orderId: order.orderId,
        customer: {
          name:
            String(customerName || order?.userId?.name || "").trim() || "Customer",
          phone:
            String(customerPhone || order?.deliveryAddress?.phone || "").trim() || "",
        },
        items: sellerItems.map((item) => ({
          productId: mongoose.isValidObjectId(String(item?.itemId || ""))
            ? new mongoose.Types.ObjectId(String(item.itemId))
            : null,
          name: item?.name || "Item",
          price: Number(item?.price || 0),
          quantity: Math.max(1, Number(item?.quantity || 1)),
          image: item?.image || "",
        })),
        pricing: {
          subtotal: sellerSubtotal,
          commission: commissionAmount,
          deliveryFee: allocatedDeliveryFee,
          receivable: receivable,
          total: Number((sellerSubtotal + allocatedDeliveryFee).toFixed(2)),
        },
        status: "pending",
        workflowStatus: "SELLER_PENDING",
        sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
        address: buildSellerOrderAddress(order.deliveryAddress),
        payment: {
          method: ["cash", "cod"].includes(String(order?.payment?.method || "").toLowerCase())
            ? "cash"
            : "online",
        },
      };
    }),
  );
}

async function upsertSellerOrdersForParent(orderDoc, options = {}) {
  const sellerOrders = await buildSellerOrdersFromParent(orderDoc, options);
  if (!sellerOrders.length) return [];

  return Promise.all(
    sellerOrders.map((sellerOrder) =>
      SellerOrder.findOneAndUpdate(
        {
          sellerId: sellerOrder.sellerId,
          orderId: sellerOrder.orderId,
        },
        { $set: sellerOrder },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ).lean(),
    ),
  );
}

async function notifySellerNewOrders(orderDoc, sellerOrders = []) {
  try {
    if (!orderDoc || !canExposeOrderToRestaurant(orderDoc) || !sellerOrders.length) return;
    if (orderDoc.orderStatus === "scheduled") return;

    const io = getIO();
    for (const sellerOrder of sellerOrders) {
      if (!sellerOrder?.sellerId) continue;
      const payload = {
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder._id?.toString?.() || "",
        orderType: sellerOrder.orderType || "quick",
        status: sellerOrder.status,
        workflowStatus: sellerOrder.workflowStatus,
        items: sellerOrder.items || [],
        pricing: sellerOrder.pricing || {},
        createdAt: sellerOrder.createdAt || new Date(),
      };

      if (io) {
        io.to(rooms.seller(sellerOrder.sellerId)).emit("new_order", payload);
        io.to(rooms.seller(sellerOrder.sellerId)).emit("order:new", payload);
        io.to(rooms.seller(sellerOrder.sellerId)).emit("play_notification_sound", {
          audience: "seller",
          type: "new_order",
          orderId: sellerOrder.orderId,
          sellerOrderId: sellerOrder._id?.toString?.() || "",
        });
      }

      try {
        const { upsertSellerNotification } = await import(
          "../../../quick-commerce/seller/services/sellerNotify.service.js"
        );
        const saved = await upsertSellerNotification(sellerOrder.sellerId, {
          key: `order:${sellerOrder.orderId}:new`,
          type: "order",
          title:
            sellerOrder.orderType === "mixed"
              ? "New mixed order received"
              : "New quick order received",
          message:
            sellerOrder.orderType === "mixed"
              ? `Order ${sellerOrder.orderId} includes a mixed-order seller leg waiting for action.`
              : `Order ${sellerOrder.orderId} is waiting for seller action.`,
          link: "/seller/orders",
          metadata: {
            orderId: sellerOrder.orderId,
            sellerOrderId: sellerOrder._id?.toString?.() || "",
            orderType: sellerOrder.orderType || "quick",
          },
        });
        // upsertSellerNotification swallows errors and returns null — still push FCM then.
        if (!saved) {
          await notifyOwnerSafely(
            { ownerType: "SELLER", ownerId: sellerOrder.sellerId },
            {
              title:
                sellerOrder.orderType === "mixed"
                  ? "New mixed order received"
                  : "New quick order received",
              body:
                sellerOrder.orderType === "mixed"
                  ? `Order ${sellerOrder.orderId} includes a mixed-order seller leg waiting for action.`
                  : `Order ${sellerOrder.orderId} is waiting for seller action.`,
              data: {
                type: "new_seller_order",
                orderId: sellerOrder.orderId,
                sellerOrderId: sellerOrder._id?.toString?.() || "",
                orderType: sellerOrder.orderType || "quick",
                link: `/seller/orders`,
              },
            },
          );
        }
      } catch (sellerBellErr) {
        logger.warn(`Seller bell notify failed: ${sellerBellErr?.message || sellerBellErr}`);
        await notifyOwnerSafely(
          { ownerType: "SELLER", ownerId: sellerOrder.sellerId },
          {
            title:
              sellerOrder.orderType === "mixed"
                ? "New mixed order received"
                : "New quick order received",
            body:
              sellerOrder.orderType === "mixed"
                ? `Order ${sellerOrder.orderId} includes a mixed-order seller leg waiting for action.`
                : `Order ${sellerOrder.orderId} is waiting for seller action.`,
            data: {
              type: "new_seller_order",
              orderId: sellerOrder.orderId,
              sellerOrderId: sellerOrder._id?.toString?.() || "",
              orderType: sellerOrder.orderType || "quick",
              link: `/seller/orders`,
            },
          },
        );
      }
    }
  } catch (error) {
    logger.warn(`Seller order notify failed: ${error?.message || error}`);
  }
}

/**
 * Synchronize cancellation of all seller-specific order legs associated with a parent order.
 * Triggers status updates and real-time socket notifications to sellers.
 */
async function cancelSellerOrdersForParent(orderDoc, reason = "Parent order cancelled") {
  try {
    const parentId = orderDoc._id;
    // Find active seller order legs (not yet delivered or already cancelled)
    const activeSellerOrders = await SellerOrder.find({
      parentOrderId: parentId,
      status: { $nin: ["cancelled", "delivered"] }
    });

    if (!activeSellerOrders.length) return;

    logger.info(`MixedOrder: Cancelling ${activeSellerOrders.length} seller legs for Order ${orderDoc.orderId}`);

    // Update all matching legs to 'cancelled' status
    await SellerOrder.updateMany(
      { 
        parentOrderId: parentId, 
        status: { $nin: ["cancelled", "delivered"] } 
      },
      { 
        $set: { 
          status: "cancelled",
          workflowStatus: "CANCELLED"
        } 
      }
    );

    // Notify each seller via Socket.io and Push Notifications
    await notifySellerOrderCancelled(orderDoc, activeSellerOrders, reason);
  } catch (error) {
    logger.error(`cancelSellerOrdersForParent failed for Order ${orderDoc?.orderId}: ${error.message}`);
  }
}

/**
 * Emit real-time socket events and send push notifications to sellers when their leg of a mixed order is cancelled.
 */
async function notifySellerOrderCancelled(orderDoc, sellerOrders, reason) {
  try {
    const io = getIO();
    for (const sellerOrder of sellerOrders) {
      const sellerId = sellerOrder.sellerId?.toString?.() || sellerOrder.sellerId;
      
      if (io && sellerId) {
        const payload = {
          orderId: sellerOrder.orderId,
          sellerOrderId: sellerOrder._id?.toString?.() || "",
          reason,
          status: "cancelled"
        };
        
        console.log(`[MIXED-SYNC] Emitting cancellation for SellerOrder ${sellerOrder.orderId} to seller room: ${rooms.seller(sellerId)}`);
        // Emit specific cancellation events to seller room
        io.to(rooms.seller(sellerId)).emit("order_cancelled", payload);
        io.to(rooms.seller(sellerId)).emit("order:cancelled", payload);
        
        // Also emit 'order_status_update' so generic UI listeners (like DashboardLayout) can update status tags
        io.to(rooms.seller(sellerId)).emit("order_status_update", {
            ...payload,
            orderStatus: "cancelled",
            sellerStatus: "cancelled",
            message: `Order #${sellerOrder.orderId} was cancelled.`
        });
      }

      if (sellerId) {
        try {
          const { upsertSellerNotification } = await import(
            "../../../quick-commerce/seller/services/sellerNotify.service.js"
          );
          const saved = await upsertSellerNotification(sellerId, {
            key: `order:${sellerOrder.orderId}:cancelled`,
            type: "order",
            title: "Order Cancelled ❌",
            message: `Order ${sellerOrder.orderId} has been cancelled.`,
            link: "/seller/orders",
            metadata: {
              orderId: sellerOrder.orderId,
              sellerOrderId: sellerOrder._id?.toString?.() || "",
            },
          });
          if (!saved) {
            await notifyOwnerSafely(
              { ownerType: "SELLER", ownerId: sellerId },
              {
                title: "Order Cancelled ❌",
                body: `Order ${sellerOrder.orderId} has been cancelled by the ${reason.includes('user') ? 'user' : 'restaurant'}.`,
                data: {
                  type: "seller_order_cancelled",
                  orderId: sellerOrder.orderId,
                  sellerOrderId: sellerOrder._id?.toString?.() || "",
                  link: `/seller/orders`,
                },
              },
            );
          }
        } catch (sellerBellErr) {
          logger.warn(`Seller cancel bell notify failed: ${sellerBellErr?.message || sellerBellErr}`);
          await notifyOwnerSafely(
            { ownerType: "SELLER", ownerId: sellerId },
            {
              title: "Order Cancelled ❌",
              body: `Order ${sellerOrder.orderId} has been cancelled by the ${reason.includes('user') ? 'user' : 'restaurant'}.`,
              data: {
                type: "seller_order_cancelled",
                orderId: sellerOrder.orderId,
                sellerOrderId: sellerOrder._id?.toString?.() || "",
                link: `/seller/orders`,
              },
            },
          );
        }
      }
    }
  } catch (error) {
    logger.warn(`notifySellerOrderCancelled failed: ${error.message}`);
  }
}

// Stale listNearbyOnlineDeliveryPartners removed (now imported from order-dispatch.service.js)

async function refreshSplitDispatchLegCandidates(order) {
  if (!isSplitDispatchOrder(order)) return false;

  const assignedPartnerIds = new Set(
    (order.dispatchPlan?.legs || [])
      .map((leg) => toIdString(leg?.deliveryPartnerId))
      .filter(Boolean),
  );

  let changed = false;
  for (const leg of order.dispatchPlan?.legs || []) {
    if (toIdString(leg?.deliveryPartnerId)) continue;

    const pickupPoint = (order.pickupPoints || []).find(
      (point) => `${point?.pickupType}:${point?.sourceId}` === leg.legId,
    );
    if (!pickupPoint) continue;

    const candidates = await listNearbyPartnersForPoint(pickupPoint);
    const nextCandidates = candidates.filter((candidate) => {
      const candidateId = toIdString(candidate?.partnerId);
      if (!candidateId) return false;
      if (
        isExpressSplitDispatchOrder(order) &&
        assignedPartnerIds.has(candidateId)
      ) {
        return false;
      }
      return true;
    });

    const previousSerialized = JSON.stringify(
      (leg.partnerCandidates || []).map((candidate) => ({
        partnerId: toIdString(candidate?.partnerId),
        distanceKm: candidate?.distanceKm == null
          ? null
          : Number(candidate.distanceKm),
      })),
    );
    const nextSerialized = JSON.stringify(
      nextCandidates.map((candidate) => ({
        partnerId: toIdString(candidate?.partnerId),
        distanceKm: candidate?.distanceKm == null
          ? null
          : Number(candidate.distanceKm),
      })),
    );

    if (previousSerialized !== nextSerialized) {
      leg.partnerCandidates = nextCandidates;
      changed = true;
    }
  }

  return changed;
}

async function notifySplitDispatchOffers(order, { restaurantDoc = null } = {}) {
  if (!order || !isSplitDispatchOrder(order)) return;

  const refreshed = await refreshSplitDispatchLegCandidates(order);
  if (refreshed) {
    await order.save();
  }

  const io = getIO();
  const restaurant =
    restaurantDoc ||
    (order.restaurantId
      ? await FoodRestaurant.findById(order.restaurantId)
          .select("restaurantName location addressLine1 area city state")
          .lean()
      : null);

  const pushTargets = [];
  const targetedPartnerIds = new Set();
  const maxCandidatesPerLeg = isExpressSplitDispatchOrder(order) ? 3 : 5;
  const openLegs = (order.dispatchPlan?.legs || []).filter(
    (leg) => !toIdString(leg?.deliveryPartnerId),
  );
  const distinctOpenCandidateIds = new Set(
    openLegs.flatMap((leg) =>
      (Array.isArray(leg?.partnerCandidates) ? leg.partnerCandidates : [])
        .map((candidate) => toIdString(candidate?.partnerId))
        .filter(Boolean),
    ),
  );
  const canEnforceDistinctExpressTargets =
    isExpressSplitDispatchOrder(order) &&
    distinctOpenCandidateIds.size >= openLegs.length;

  for (const leg of order.dispatchPlan?.legs || []) {
    if (toIdString(leg?.deliveryPartnerId)) continue;

    const legPayload = buildSplitLegSocketPayload(await resolveOrderWithCustomerGender(order), leg, restaurant);
    const candidatePool = Array.isArray(leg.partnerCandidates)
      ? [...leg.partnerCandidates]
      : [];
    const uniqueCandidates = candidatePool.filter(
      (candidate) => !targetedPartnerIds.has(toIdString(candidate?.partnerId)),
    );
    const duplicateCandidates = candidatePool.filter((candidate) =>
      targetedPartnerIds.has(toIdString(candidate?.partnerId)),
    );
    const candidatesToNotify = isExpressSplitDispatchOrder(order)
      ? (
          canEnforceDistinctExpressTargets
            ? uniqueCandidates
            : [...uniqueCandidates, ...duplicateCandidates]
        ).slice(0, maxCandidatesPerLeg)
      : candidatePool.slice(0, maxCandidatesPerLeg);

    for (const candidate of candidatesToNotify) {
      const partnerId = toIdString(candidate?.partnerId);
      if (!partnerId) continue;
      targetedPartnerIds.add(partnerId);

      if (io) {
        io.to(rooms.delivery(partnerId)).emit("new_order_available", {
          ...legPayload,
          pickupDistanceKm: candidate?.distanceKm ?? null,
          dispatchLeg: {
            ...legPayload.dispatchLeg,
            candidateDistanceKm: candidate?.distanceKm ?? null,
          },
        });
        io.to(rooms.delivery(partnerId)).emit("play_notification_sound", {
          audience: "delivery",
          type: "new_order_available",
          orderId: legPayload.orderId,
          orderMongoId: legPayload.orderMongoId,
          legId: leg.legId,
        });
      }

      pushTargets.push({
        ownerType: "DELIVERY_PARTNER",
        ownerId: partnerId,
      });
    }
  }

  if (pushTargets.length) {
    await notifyOwnersSafely(pushTargets, {
      title: "New mixed pickup available",
      body: `Order ${order.orderId} has a nearby pickup leg available for delivery.`,
      data: {
        type: "new_order_available",
        audience: "delivery",
        orderId: order.orderId,
        orderMongoId: order._id?.toString?.() || "",
        link: "/food/delivery",
        targetUrl: "/food/delivery",
      },
    });
  }
}

export async function notifySplitDispatchOffersForOrder(orderId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) {
    throw new ValidationError("Order id required");
  }

  const order = await FoodOrder.findOne(identity);
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  if (!isSplitDispatchOrder(order)) {
    throw new ValidationError("Order is not configured for split dispatch");
  }

  const activeStatuses = ["confirmed", "preparing", "ready_for_pickup", "ready"];
  if (!activeStatuses.includes(String(order.orderStatus || "").toLowerCase())) {
    throw new ValidationError(`Cannot notify riders for order in status: ${order.orderStatus}`);
  }

  await notifySplitDispatchOffers(order);
  return { success: true };
}

/** Channel: worker → API for Instant-identical socket/FCM after BullMQ activation. */

export const FOOD_SCHEDULE_ACTIVATED_CHANNEL = "food:schedule:activated";

async function publishScheduleActivatedEvent(orderMongoId) {

  const payload = JSON.stringify({ orderMongoId: String(orderMongoId) });

  try {

    const { getRedisClient, createRedisClient } = await import(

      "../../../../config/redis.js"

    );

    let redis = getRedisClient();

    let owned = false;

    if (!redis) {

      redis = createRedisClient();

      if (!redis) {

        logger.error(

          `Schedule activation notify bridge failed: Redis unavailable for ${orderMongoId}`

        );

        return false;

      }

      await redis.connect();

      owned = true;

    }

    await redis.publish(FOOD_SCHEDULE_ACTIVATED_CHANNEL, payload);

    if (owned) await redis.quit().catch(() => {});

    logger.info(`Published ${FOOD_SCHEDULE_ACTIVATED_CHANNEL} for ${orderMongoId}`);

    return true;

  } catch (err) {

    logger.error(

      `publishScheduleActivatedEvent failed for ${orderMongoId}: ${err?.message || err}`

    );

    return false;

  }

}

/**

 * Instant-identical restaurant + customer notify after scheduled→placed.

 * Safe to call once (Redis NX lock). Used by API process (has Socket.IO).

 */

export async function deliverScheduleActivationNotifications(orderDoc) {

  if (!orderDoc?._id) return { success: false, reason: "Missing order" };

  const orderMongoId = orderDoc._id.toString();

  try {

    const { getRedisClient } = await import("../../../../config/redis.js");

    const redis = getRedisClient();

    if (redis) {

      const lockKey = `food:schedule:notify-lock:${orderMongoId}`;

      const locked = await redis.set(lockKey, "1", { NX: true, EX: 86400 });

      if (locked === null) {

        logger.info(

          `Schedule activation notify skipped (already delivered) order=${orderDoc.orderId || orderMongoId}`

        );

        return { success: true, skipped: true };

      }

    }

  } catch (err) {

    logger.warn(`Schedule notify lock skipped: ${err?.message || err}`);

  }

  await notifyRestaurantNewOrder(orderDoc);

  if (orderDoc.orderType === "quick" || orderDoc.orderType === "mixed") {

    const sellerOrders = await upsertSellerOrdersForParent(orderDoc);

    if (sellerOrders.length > 0) {

      await notifySellerNewOrders(orderDoc, sellerOrders);

    }

  }

  try {

    const io = getIO();

    if (io && orderDoc.userId) {

      io.to(rooms.user(orderDoc.userId)).emit("order_status_update", {

        orderId: orderDoc.orderId,

        orderMongoId,

        orderStatus: orderDoc.orderStatus,

        status: orderDoc.orderStatus,

        activatedAt: orderDoc.activatedAt,

        scheduledAt: orderDoc.scheduledAt,

        message: "Your scheduled order was sent to the restaurant",

      });

    }

  } catch (err) {

    logger.warn(`Schedule activation status socket failed: ${err?.message || err}`);

  }

  // Do NOT send customer "preparing" FCM here.
  // That fires only when restaurant accepts / starts preparing (updateOrderStatusRestaurant).

  return { success: true };

}

/**

 * API-side subscriber for worker-originated activations (sockets require API process).

 */

export async function handleScheduleActivatedBridgeMessage(raw) {

  try {

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;

    const orderMongoId = data?.orderMongoId;

    if (!orderMongoId) return { success: false };

    const order = await FoodOrder.findById(orderMongoId);

    if (!order || String(order.orderStatus || "").toLowerCase() !== "placed") {

      return { success: false, reason: "Order not placed" };

    }

    return deliverScheduleActivationNotifications(order);

  } catch (err) {

    logger.error(`handleScheduleActivatedBridgeMessage failed: ${err?.message || err}`);

    return { success: false };

  }

}

/** Triggered by BullMQ at T-lead (PRIMARY) or by fallback reconciler when job is missing/stuck. */

export async function processScheduledOrderNotification(orderMongoId, options = {}) {

  if (!orderMongoId) return { success: false, reason: "Missing order id" };

  const source = String(options?.source || "unknown");

  const deterministicJobId = buildFoodScheduleJobId(orderMongoId);

  // Atomic CAS: only one winner if BullMQ + fallback race (or Redis job replay).

  const activatedAt = new Date();

  const order = await FoodOrder.findOneAndUpdate(

    { _id: orderMongoId, orderStatus: "scheduled" },

    {

      $set: {

        orderStatus: "placed",

        activatedAt,

        scheduleNotifyJobId: null,

        // Delivery has not started — rider not assigned yet.
        // en_route_to_pickup only after driver is assigned / heading to restaurant.

        "deliveryState.currentPhase": "waiting_activation",

        "deliveryState.status": "waiting_activation",

      },

      $push: {

        statusHistory: {

          at: activatedAt,

          byRole: "SYSTEM",

          from: "scheduled",

          to: "placed",

          note: `Scheduled order activated for restaurant review (${SCHEDULE_ACTIVATE_LEAD_MINUTES}m window reached) via ${source}`,

        },

      },

    },

    { new: true }

  );

  if (!order) {

    await removeOrderJob(deterministicJobId);

    return {

      success: false,

      alreadyHandled: true,

      reason: "Order not found or not in scheduled status",

    };

  }

  await removeOrderJob(deterministicJobId);

  // Socket.IO lives on the API process. Worker bridges notify via Redis.

  const io = getIO();

  if (io) {

    await deliverScheduleActivationNotifications(order);

  } else {

    const published = await publishScheduleActivatedEvent(order._id.toString());

    if (!published) {

      logger.error(

        `Schedule activated in Mongo but notify bridge failed for ${order.orderId} — restaurant poll/FCM may recover`

      );

    }

  }

  logger.info(

    `Schedule activated order=${order.orderId} source=${source} activatedAt=${activatedAt.toISOString()}`

  );

  return { success: true, source };

}

/**
 * FALLBACK reconciler — must NEVER be the normal activation path when BullMQ is healthy.
 * Activates only when the primary delayed job is missing/failed/stuck/queue-down.
 * Idempotent via processScheduledOrderNotification CAS.
 */
export async function processDueScheduledFoodOrders(limit = 50) {
  const leadMs = Math.max(0, SCHEDULE_ACTIVATE_LEAD_MINUTES) * 60 * 1000;
  const dueBefore = new Date(Date.now() + leadMs);

  // Repair legacy scheduled rows that still have Instant deliveryPhase default.
  await FoodOrder.updateMany(
    {
      orderStatus: "scheduled",
      "deliveryState.currentPhase": { $nin: ["waiting_activation", "cancelled"] },
    },
    {
      $set: {
        "deliveryState.currentPhase": "waiting_activation",
        "deliveryState.status": "waiting_activation",
      },
    }
  ).catch((err) => {
    logger.warn(
      `Failed to repair scheduled deliveryState phases: ${err?.message || err}`
    );
  });

  const dueOrders = await FoodOrder.find({
    orderStatus: "scheduled",
    scheduledAt: { $ne: null, $lte: dueBefore },
  })
    .select("_id orderId scheduledAt scheduleNotifyJobId")
    .sort({ scheduledAt: 1 })
    .limit(Math.max(1, Math.min(200, Number(limit) || 50)))
    .lean();

  let processed = 0;
  let skippedHealthyPrimary = 0;
  for (const row of dueOrders) {
    try {
      const allowFallback = await shouldFallbackActivateScheduledOrder(row);
      if (!allowFallback) {
        skippedHealthyPrimary += 1;
        continue;
      }
      const result = await processScheduledOrderNotification(row._id, {
        source: "fallback_reconciler",
      });
      if (result?.success) processed += 1;
    } catch (err) {
      logger.error(
        `processDueScheduledFoodOrders failed for ${row.orderId}: ${err?.message || err}`
      );
    }
  }

  if (processed > 0 || skippedHealthyPrimary > 0) {
    logger.info(
      `Food schedule fallback reconciler activated=${processed} skippedHealthyPrimary=${skippedHealthyPrimary} scanned=${dueOrders.length}`
    );
  }
  return { processed, scanned: dueOrders.length, skippedHealthyPrimary };
}

export async function processOrderPostPaymentFulfillment(orderInput, options = {}) {
  const { notifyCustomer = false, customerUserId = null } = options;
  const order =
    orderInput instanceof FoodOrder
      ? orderInput
      : await FoodOrder.findById(orderInput);
  if (!order) return { success: false, reason: "Order not found" };

  if (order.orderType === "food" || order.orderType === "mixed") {
    await notifyRestaurantNewOrder(order);
  }
  if (order.orderType === "quick" || order.orderType === "mixed") {
    const sellerOrders = await upsertSellerOrdersForParent(order);
    await notifySellerNewOrders(order, sellerOrders);
  }

  if (order.orderStatus === "scheduled" && order.scheduledAt) {
    await scheduleOrderActivationJob(order);
  }

  if (
    (order.orderType === "food" || (order.orderType === "mixed" && order.dispatchPlan?.strategy === "single")) &&
    String(order.dispatch?.modeAtCreation || "manual") === "auto" &&
    String(order.payment?.status || "").toLowerCase() === "paid" &&
    !shouldHoldDispatchForScheduled(order)
  ) {
    try {
      await tryAutoAssign(order._id);
    } catch {
      // leave unassigned
    }
  }

  if (notifyCustomer && customerUserId) {
    const branding = await getGlobalBranding();
    await notifyOwnersSafely([{ ownerType: "USER", ownerId: customerUserId }], {
      title: "Payment Successful! ✅",
      body: `We have received your payment of ₹${order.payment.amountDue} for Order #${order.orderId}.`,
      image: branding.image,
      data: {
        type: "payment_success",
        orderId: String(order.orderId),
        orderMongoId: String(order._id),
      },
    });
  }

  return { success: true };
}

// Stale getDispatchSettings and updateDispatchSettings removed (now imported from order-dispatch.service.js)

// ----- Calculate (validation + return pricing from payload) -----
export async function calculateOrder(userId, dto, options = {}) {
  const items = normalizeOrderItems(dto.items, dto.orderType);
  const hasFoodItems = items.some((item) => item.type === "food");
  const hasQuickItems = items.some((item) => item.type === "quick");
  const orderType =
    hasFoodItems && hasQuickItems
      ? "mixed"
      : hasQuickItems
        ? "quick"
        : "food";
  // Option B: resolve restaurant identity once (business code or Mongo _id).
  // createOrder may pass preResolvedSources to avoid a duplicate restaurant load.
  let sourceMap;
  let primaryRestaurant;
  if (options.preResolvedSources?.sourceMap) {
    sourceMap = options.preResolvedSources.sourceMap;
    canonicalizeFoodItemSourceIds(items, sourceMap);
    primaryRestaurant =
      options.preResolvedSources.primaryRestaurant ||
      (dto.restaurantId
        ? sourceMap.get(String(dto.restaurantId)) ||
          sourceMap.get(String(dto.restaurantId).toUpperCase())
        : null);
    if (!primaryRestaurant) {
      const foodId = items.find((i) => i.type === "food")?.sourceId;
      primaryRestaurant = foodId ? sourceMap.get(String(foodId)) : null;
    }
  } else {
    ({ sourceMap, primaryRestaurant } = await resolveFoodOrderSources(
      items,
      dto.restaurantId,
    ));
  }
  await applyServerItemPricing(items, sourceMap);
  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0,
  );

  // Fee settings (admin-configured). Use safe fallbacks for dev if not configured.
  const feeDoc = await FoodFeeSettings.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .lean();
  const feeSettings = normalizeFoodFeeSettings(feeDoc);

  const pickupPoints = buildPickupPointsFromItems(items, sourceMap);
  const trustedDeliveryAddress =
    orderType === "food" || orderType === "mixed"
      ? await resolveTrustedDeliveryAddress(userId, dto)
      : normalizeDeliveryAddress(dto.address);
  const serviceZone =
    orderType === "food" || orderType === "mixed"
      ? await assertDeliveryInServiceArea(trustedDeliveryAddress)
      : null;
  const eligibility =
    orderType === "mixed"
      ? await evaluateCombinedPickupEligibility(pickupPoints, trustedDeliveryAddress)
      : {
          eligible: false,
          pickupDistanceKm: null,
          sameDirection: false,
          reason: "",
        };

  if (orderType === "quick") {
    const quickSourceId = items.find((item) => item.type === "quick")?.sourceId;
    const quickSource = quickSourceId ? sourceMap.get(String(quickSourceId)) : null;
    const packagingFee = roundCurrency(Number(feeSettings.packagingFee || 0));
    const platformFee = feeSettings.platformFee;
    let deliveryFee = feeSettings.deliveryFee;
    let deliveryDistanceKm = null;
    let deliveryFeeBreakdown = null;

    if (hasDeliveryFeeRanges(feeSettings) && quickSource) {
      const rangePricing = await applyRangeBasedFoodDeliveryPricing({
        feeSettings,
        subtotal,
        address: trustedDeliveryAddress,
        restaurant: quickSource,
      });
      deliveryFee = rangePricing.deliveryFee;
      deliveryDistanceKm = rangePricing.deliveryDistanceKm;
      deliveryFeeBreakdown = rangePricing.deliveryFeeBreakdown;
    }

    const gstRate = feeSettings.gstRate;
    const tax =
      Number.isFinite(gstRate) && gstRate > 0
        ? Math.round(subtotal * (gstRate / 100))
        : 0;
    const discount = 0;
    const total = Math.max(
      0,
      subtotal + packagingFee + deliveryFee + platformFee + tax - discount,
    );
    const codOrderLimit = await resolveCodOrderLimit();
    const codEligibility = buildCodEligibility(total, codOrderLimit);

    return {
      pricing: {
        subtotal,
        tax,
        packagingFee,
        deliveryFee,
        deliveryDistanceKm,
        deliveryFeeBreakdown,
        platformFee,
        discount,
        total,
        currency: "INR",
        couponCode: null,
        appliedCoupon: null,
        codAllowed: codEligibility.codAllowed,
        codOrderLimit: codEligibility.codOrderLimit,
        codBlockedReason: codEligibility.codBlockedReason,
      },
      serviceZone: null,
    };
  }

  // Identity already resolved + food item sourceIds canonicalized above.
  if (!primaryRestaurant) throw new ValidationError("Restaurant not found");
  if (primaryRestaurant.status !== "approved")
    throw new ValidationError("Restaurant not available");
  const primaryRestaurantId = primaryRestaurant.sourceId;

  const inactiveQuickSource = [...sourceMap.values()].find(
    (source) =>
      source.type === "quick" &&
      !["approved", "active"].includes(String(source.status || "").toLowerCase()),
  );
  if (inactiveQuickSource) {
    throw new ValidationError(
      `${inactiveQuickSource.sourceName || "Quick store"} is not available`,
    );
  }

  const packagingFee = roundCurrency(Number(feeSettings.packagingFee || 0));
  const platformFee = feeSettings.platformFee;

  let deliveryFee = 0;
  let totalDeliveryFee = 0;
  let userDeliveryFee = 0;
  let restaurantDeliveryFee = 0;
  let sponsoredDelivery = false;
  let sponsoredKm = 0;
  let deliveryDistanceKm = null;
  let deliverySponsorType = "USER_FULL";
  let deliveryFeeBreakdown = null;

  if (orderType === "food") {
    if (hasDeliveryFeeRanges(feeSettings)) {
      const rangePricing = await applyRangeBasedFoodDeliveryPricing({
        feeSettings,
        subtotal,
        address: trustedDeliveryAddress,
        restaurant: primaryRestaurant,
      });
      deliveryFee = rangePricing.deliveryFee;
      totalDeliveryFee = rangePricing.totalDeliveryFee;
      userDeliveryFee = rangePricing.userDeliveryFee;
      restaurantDeliveryFee = rangePricing.restaurantDeliveryFee;
      sponsoredDelivery = rangePricing.sponsoredDelivery;
      sponsoredKm = rangePricing.sponsoredKm;
      deliveryDistanceKm = rangePricing.deliveryDistanceKm;
      deliverySponsorType = rangePricing.deliverySponsorType;
      deliveryFeeBreakdown = rangePricing.deliveryFeeBreakdown;
    } else {
      // Always charge using road distance (same source as ranges path / UX).
      const distanceKm =
        (await resolveRestaurantToUserRoadDistanceKm(
          primaryRestaurant,
          trustedDeliveryAddress,
        )) ?? 0;
      const deliveryPricing = calculateFoodDeliveryPricing({
        subtotal,
        distanceKm,
        feeSettings,
      });
      deliveryFee = deliveryPricing.deliveryFee;
      totalDeliveryFee = deliveryPricing.totalDeliveryFee;
      userDeliveryFee = deliveryPricing.userDeliveryFee;
      restaurantDeliveryFee = deliveryPricing.restaurantDeliveryFee;
      sponsoredDelivery = deliveryPricing.sponsoredDelivery;
      sponsoredKm = deliveryPricing.sponsoredKm;
      deliveryDistanceKm = deliveryPricing.deliveryDistanceKm;
      deliverySponsorType = deliveryPricing.deliverySponsorType;
    }
  } else {
    if (hasDeliveryFeeRanges(feeSettings)) {
      const rangePricing = await applyRangeBasedFoodDeliveryPricing({
        feeSettings,
        subtotal,
        address: trustedDeliveryAddress,
        restaurant: primaryRestaurant,
      });
      deliveryFee = rangePricing.deliveryFee;
      totalDeliveryFee = rangePricing.totalDeliveryFee;
      userDeliveryFee = rangePricing.userDeliveryFee;
      restaurantDeliveryFee = rangePricing.restaurantDeliveryFee;
      sponsoredDelivery = rangePricing.sponsoredDelivery;
      sponsoredKm = rangePricing.sponsoredKm;
      deliveryDistanceKm = rangePricing.deliveryDistanceKm;
      deliverySponsorType = rangePricing.deliverySponsorType;
      deliveryFeeBreakdown = rangePricing.deliveryFeeBreakdown;
    } else {
      const distanceKm =
        (await resolveRestaurantToUserRoadDistanceKm(
          primaryRestaurant,
          trustedDeliveryAddress,
        )) ?? 0;
      const deliveryPricing = calculateFoodDeliveryPricing({
        subtotal,
        distanceKm,
        feeSettings,
      });
      deliveryFee = deliveryPricing.deliveryFee;
      totalDeliveryFee = deliveryPricing.totalDeliveryFee;
      userDeliveryFee = deliveryPricing.userDeliveryFee;
      restaurantDeliveryFee = deliveryPricing.restaurantDeliveryFee;
      sponsoredDelivery = deliveryPricing.sponsoredDelivery;
      sponsoredKm = deliveryPricing.sponsoredKm;
      deliveryDistanceKm = deliveryPricing.deliveryDistanceKm;
      deliverySponsorType = deliveryPricing.deliverySponsorType;
    }
  }

  const quickFeeDoc = (orderType === "mixed")
    ? await QuickFeeSettings.findOne({ isActive: true }).sort({ createdAt: -1 }).lean()
    : null;

  const quickSubtotal = orderType === "mixed"
    ? items.filter(i => i.type === "quick").reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0)
    : 0;

  const foodItemSubtotal = orderType === "mixed"
    ? items.filter(i => i.type === "food").reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0)
    : subtotal;

  // Use Mongo _id from the single entry resolve — no second identity lookup.
  const resolvedRestaurantObjectId = primaryRestaurant?.sourceId
    ? new mongoose.Types.ObjectId(String(primaryRestaurant.sourceId))
    : null;

  let discount = 0;
  let appliedCoupon = null;
  const codeRaw = dto.couponCode
    ? String(dto.couponCode).trim().toUpperCase()
    : "";
  if (codeRaw && foodItemSubtotal > 0) {
    const couponResult = await validateAndApplyCoupon({
      couponCode: codeRaw,
      itemSubtotal: foodItemSubtotal,
      userId,
      resolvedRestaurantObjectId,
    });
    discount = couponResult.discount;
    appliedCoupon = couponResult.appliedCoupon;
  }

  let tax = 0;
  if (orderType === "mixed") {
    const discountedFoodSubtotal = Math.max(0, foodItemSubtotal - discount);
    const foodTax = Math.round(discountedFoodSubtotal * (feeSettings.gstRate / 100));
    const quickGstRate = quickFeeDoc?.gstRate ?? 0;
    const quickTax = Math.round(quickSubtotal * (quickGstRate / 100));
    tax = foodTax + quickTax;
  } else {
    const gstRate = feeSettings.gstRate;
    const discountedSubtotal = Math.max(0, subtotal - discount);
    tax = Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(discountedSubtotal * (gstRate / 100))
      : 0;
  }
  // ----- Mixed cart: QC store delivery fee (Quick Commerce) — NEVER Food Quick surcharge -----
  // Food Quick surcharge uses foodQuickDeliveryFee / pricing.quickDeliveryFee (food Instant only).
  const qcStoreDeliveryFee = orderType === "mixed"
    ? calculateCustomerDeliveryFee(quickFeeDoc || {}, deliveryDistanceKm)
    : 0;
  const normalDeliveryFee =
    orderType === "mixed" ? Math.max(deliveryFee, qcStoreDeliveryFee) : deliveryFee;
  const expressDeliveryFee =
    orderType === "mixed" ? deliveryFee + qcStoreDeliveryFee : deliveryFee;
  const selectedDeliveryFee =
    orderType === "mixed"
      ? dto.deliveryFleet === "express"
        ? expressDeliveryFee
        : normalDeliveryFee
      : deliveryFee;
  let total = Math.max(
    0,
    subtotal + packagingFee + selectedDeliveryFee + platformFee + tax - discount,
  );
  const deliveryOptions =
    orderType === "mixed" && eligibility.eligible
      ? [
          {
            code: "normal",
            label: "Normal delivery",
            deliveryFee: normalDeliveryFee,
            total: Math.max(
              0,
              subtotal +
                packagingFee +
                normalDeliveryFee +
                platformFee +
                tax -
                discount,
            ),
            riderCount: 1,
          },
          {
            code: "express",
            label: "Express delivery",
            deliveryFee: expressDeliveryFee,
            total: Math.max(
              0,
              subtotal +
                packagingFee +
                expressDeliveryFee +
                platformFee +
                tax -
                discount,
            ),
            riderCount: 2,
          },
        ]
      : [];

  // ----- Food Quick Delivery — additive; Basic path untouched when deliveryMode≠quick -----
  // Mixed-cart QC store fee is qcStoreDeliveryFee above — never reuse Food Quick names.
  let foodQuickDeliveryFee = 0;
  let foodQuickPlatformShare = 0;
  let foodQuickRiderBonus = 0;
  let foodQuickRiderShare = 0;
  let foodQuickRestaurantShare = 0;
  let foodQuickSharePcts = { platform: 0, rider: 0, restaurant: 0 };
  let foodQuickFinanceVersion = "";
  let foodDeliveryMode = "basic";
  let foodQuickDeliveryMeta = null;
  let etaPromise = null;

  // Always attach gate metadata for Instant food (no fee impact) so Cart can show the Quick toggle.
  if (orderType === "food" && !dto.scheduledAt) {
    const quickEval = await evaluateFoodQuickDeliveryEligibility({
      orderType,
      restaurant: primaryRestaurant,
      // Mongo _id only — never pass business REST###### into findById paths.
      restaurantId: primaryRestaurant.sourceId,
      zone: serviceZone?.zone || null,
      zoneId: serviceZone?.zoneId || primaryRestaurant.zoneId || null,
      feeSettings: feeDoc,
      scheduledAt: dto.scheduledAt || null,
      subtotal: foodItemSubtotal,
      deliveryDistanceKm,
    });
    foodQuickDeliveryMeta = {
      eligible: quickEval.eligible === true,
      reason: quickEval.reason || "",
      reasons: quickEval.reasons || [],
      gates: quickEval.gates,
      charge: Number(quickEval.settings?.charge) || 0,
      maxDistanceKm: Number(quickEval.settings?.maxDistanceKm) || 0,
      maxEtaMinutes: Number(quickEval.settings?.maxEtaMinutes) || 0,
      defaultKitchenPrepMinutes:
        Number(quickEval.settings?.defaultKitchenPrepMinutes) || 0,
    };

    // Only price Quick when client explicitly requests deliveryMode=quick.
    // Non-quick food Instant continues with identical fee math as before.
    if (isFoodQuickDeliveryMode(dto.deliveryMode) && quickEval.eligible) {
      const eta = computeFoodQuickEtaPromise({
        restaurant: primaryRestaurant,
        deliveryDistanceKm,
        quickSettings: quickEval.settings,
        startsAt: new Date(),
        // travelMinutes: plug Matrix duration here when available (no duplicate call).
      });
      if (!eta.eligibleByEta) {
        foodQuickDeliveryMeta.eligible = false;
        foodQuickDeliveryMeta.reason = eta.reason || "max_eta";
        foodQuickDeliveryMeta.reasons = [
          ...(foodQuickDeliveryMeta.reasons || []),
          eta.reason || "max_eta",
        ];
        // Still attach a display ETA so user banner can show countdown (no Quick SLA).
        const displayEta = computeFoodDisplayEtaPromise({
          restaurant: primaryRestaurant,
          deliveryDistanceKm,
          quickSettings: quickEval.settings,
          startsAt: new Date(),
        });
        etaPromise = displayEta.etaPromise;
      } else {
        const split = splitQuickDeliveryCharge(quickEval.settings);
        foodQuickDeliveryFee = split.quickDeliveryFee;
        foodQuickPlatformShare = split.quickPlatformShare;
        foodQuickRiderBonus = split.quickRiderBonus;
        foodQuickRiderShare = split.quickRiderShare;
        foodQuickRestaurantShare = split.quickRestaurantShare;
        foodQuickSharePcts = split.quickSharePcts;
        foodQuickFinanceVersion = split.quickFinanceVersion;
        foodDeliveryMode = "quick";
        total = Math.max(0, total + foodQuickDeliveryFee);
        etaPromise = eta.etaPromise;
        foodQuickDeliveryMeta.etaPromise = {
          min: etaPromise.min,
          max: etaPromise.max,
          mid: etaPromise.mid,
          engineVersion: etaPromise.engineVersion,
          components: etaPromise.components,
          sources: etaPromise.sources,
        };
      }
    } else {
      // Basic Instant — display ETA for user home banner / tracking countdown.
      const displayEta = computeFoodDisplayEtaPromise({
        restaurant: primaryRestaurant,
        deliveryDistanceKm,
        quickSettings: quickEval.settings,
        startsAt: new Date(),
      });
      etaPromise = displayEta.etaPromise;
    }
  }

  return {
    pricing: {
      subtotal,
      tax,
      packagingFee,
      deliveryFee: selectedDeliveryFee,
      totalDeliveryFee:
        orderType === "food" ? totalDeliveryFee : selectedDeliveryFee,
      userDeliveryFee:
        orderType === "food" ? userDeliveryFee : selectedDeliveryFee,
      restaurantDeliveryFee:
        orderType === "food" ? restaurantDeliveryFee : 0,
      sponsoredDelivery:
        orderType === "food" ? sponsoredDelivery : false,
      sponsoredKm:
        orderType === "food" ? sponsoredKm : 0,
      deliveryDistanceKm:
        orderType === "food" ? deliveryDistanceKm : null,
      deliverySponsorType:
        orderType === "food" ? deliverySponsorType : "USER_FULL",
      deliveryFeeBreakdown,
      platformFee,
      discount,
      /** Food Quick surcharge only (0 for Basic / QC / Mixed). */
      quickDeliveryFee: foodQuickDeliveryFee,
      quickPlatformShare: foodQuickPlatformShare,
      quickRiderBonus: foodQuickRiderBonus,
      quickRiderShare: foodQuickRiderShare,
      quickRestaurantShare: foodQuickRestaurantShare,
      quickSharePcts: foodQuickSharePcts,
      quickFinanceVersion: foodQuickFinanceVersion,
      /** Additive alias: Quick Commerce store delivery fee on mixed carts. */
      qcDeliveryFee: orderType === "mixed" ? qcStoreDeliveryFee : 0,
      total,
      currency: "INR",
      couponCode: appliedCoupon?.code || codeRaw || null,
      appliedCoupon,
      deliveryOptions,
      pickupDistanceKm: eligibility.pickupDistanceKm,
      combinedPickupEligible: eligibility.eligible,
      mixedOrderDistanceLimit: eligibility.distanceLimitKm,
      mixedOrderAngleLimit: eligibility.angleLimitDeg,
      sameDirection: eligibility.sameDirection,
      eligibilityReason: eligibility.reason,
      pickupPoints,
      deliveryMode: foodDeliveryMode,
      quickDelivery: foodQuickDeliveryMeta,
      etaPromise,
      ...buildCodEligibility(total, await resolveCodOrderLimit()),
    },
    serviceZone: serviceZone
      ? { zoneId: serviceZone.zoneId, status: serviceZone.status, zone: serviceZone.zone }
      : null,
    /** Reuse fee doc downstream (createOrder) — avoid duplicate Mongo read. */
    feeSettingsDoc: feeDoc || null,
  };
}

// ----- Create order -----
export async function createOrder(userId, dto) {
  const items = normalizeOrderItems(dto.items, dto.orderType);
  const hasFoodItems = items.some((item) => item.type === "food");
  const hasQuickItems = items.some((item) => item.type === "quick");
  const orderType =
    hasFoodItems && hasQuickItems
      ? "mixed"
      : hasQuickItems
        ? "quick"
        : "food";
  // Single identity resolve for createOrder entry (Option B). calculateOrder
  // re-resolves on its own item copy for pricing — same contract, Mongo sourceId.
  const { sourceMap, primaryRestaurant } = await resolveFoodOrderSources(
    items,
    dto.restaurantId,
  );
  const primaryRestaurantId = primaryRestaurant?.sourceId || null;
  if (hasFoodItems) {
    if (!primaryRestaurant) throw new ValidationError("Restaurant not found");
    if (primaryRestaurant.status !== "approved")
      throw new ValidationError("Restaurant not accepting orders");

    // PHASE 3D: SUBSCRIPTION GUARD (READ-ONLY VALIDATION)
    // CRITICAL: Use primaryRestaurant.sourceId (MongoDB _id) instead of primaryRestaurantId (which could be custom ID)
    const eligibility = (await isSubscriptionEnforced('RESTAURANT'))
      ? await ensureDailyPassEligibility(primaryRestaurant.sourceId, 'RESTAURANT')
      : { eligible: true, shouldDeduct: false };
    if (!eligibility.eligible || eligibility.shouldDeduct) {
      throw new ValidationError(eligibility.reason === 'LOW_BALANCE' || eligibility.reason === 'REQUIRES_DAY_DEDUCTION'
        ? "Restaurant is not accepting new orders due to insufficient subscription balance."
        : "Restaurant is not accepting new orders at this time.");
    }
  }
  const inactiveQuickSource = [...sourceMap.values()].find(
    (source) =>
      source.type === "quick" &&
      !["approved", "active"].includes(String(source.status || "").toLowerCase()),
  );
  if (inactiveQuickSource) {
    throw new ValidationError(
      `${inactiveQuickSource.sourceName || "Quick store"} is not accepting orders`,
    );
  }
  await applyServerItemPricing(items, sourceMap);

  const orderId = await ensureUniqueOrderId();
  const settings =
    orderType === "food" || orderType === "mixed"
      ? await getDispatchSettings()
      : null;
  const dispatchMode = settings?.dispatchMode || "manual";

  const deliveryAddress =
    orderType === "food" || orderType === "mixed"
      ? await resolveTrustedDeliveryAddress(userId, dto)
      : normalizeDeliveryAddress(dto.address);

  const paymentMethod =
    dto.paymentMethod === "card" ? "razorpay" : dto.paymentMethod;
  const isCash = paymentMethod === "cash";
  const isWallet = paymentMethod === "wallet";

  const paymentSettings = await getGlobalPaymentSettings();
  const paymentCheck = assertPaymentMethodAllowed(paymentMethod, paymentSettings);
  if (!paymentCheck.allowed) {
    throw new ValidationError(paymentCheck.message);
  }

  // Enforce admin COD access flag — UI hide alone is not sufficient (API bypass).
  if (isCash) {
    const orderingUser = await FoodUser.findById(userId).select("isCodAllowed isActive").lean();
    if (!orderingUser || orderingUser.isActive === false) {
      throw new ForbiddenError("User account is deactivated");
    }
    if (orderingUser.isCodAllowed === false) {
      throw new ForbiddenError("Cash on Delivery is not available for this account");
    }
  }

  const pickupPoints = buildPickupPointsFromItems(items, sourceMap);
  const combinedPickup = await resolveDispatchPlanMeta(
    orderType,
    pickupPoints,
    deliveryAddress,
  );
  const requestedDeliveryFleet =
    dto.deliveryFleet ||
    (orderType === "mixed" ? "normal" : orderType === "quick" ? "quick" : "standard");
  if (orderType === "mixed" && requestedDeliveryFleet === "express" && !combinedPickup.eligible) {
    throw new ValidationError(combinedPickup.reason || "Express delivery is not available for this mixed order");
  }
  const dispatchStrategy =
    orderType !== "mixed"
      ? "single"
      : requestedDeliveryFleet === "express"
        ? "express_split"
        : combinedPickup.eligible
          ? "single"
          : "split";

  // Server-authoritative pricing from active fee settings (never trust client fee amounts).
  const couponCodeFromClient = [
    dto.couponCode,
    dto.pricing?.couponCode,
  ]
    .map((code) => (code ? String(code).trim().toUpperCase() : ""))
    .find(Boolean) || "";
  const requestedFoodDeliveryMode = isFoodQuickDeliveryMode(dto.deliveryMode)
    ? "quick"
    : "basic";
  if (requestedFoodDeliveryMode === "quick" && dto.scheduledAt) {
    throw new ValidationError("Quick Delivery cannot be combined with Schedule Order");
  }

  const {
    pricing: serverPricing,
    serviceZone: detectedServiceZone,
    feeSettingsDoc: calcFeeDoc,
  } = await calculateOrder(
    userId,
    {
      orderType,
      items: dto.items,
      address: deliveryAddress,
      deliveryAddressId:
        dto.deliveryAddressId ||
        dto.address?._id ||
        dto.address?.id ||
        undefined,
      restaurantId: primaryRestaurantId || undefined,
      zoneId: dto.zoneId,
      couponCode: couponCodeFromClient,
      deliveryFleet: requestedDeliveryFleet,
      deliveryMode: requestedFoodDeliveryMode,
      scheduledAt: dto.scheduledAt,
    },
    {
      preResolvedSources: { sourceMap, primaryRestaurant },
    },
  );

  // Soft fallback (aligned with calculateOrder): if client asked for Quick but gates
  // failed, serverPricing.deliveryMode stays "basic" and Quick fee is 0. Do NOT 400 —
  // production-safe for races, admin disable, and older clients. Hard reject remains
  // only for Schedule∩Quick (validated above / in DTO).
  const quickFallbackApplied =
    requestedFoodDeliveryMode === "quick" &&
    String(serverPricing.deliveryMode || "basic") !== "quick";

  let resolvedDeliveryFee = Math.max(0, Number(serverPricing.deliveryFee || 0));
  let resolvedTotal = Math.max(0, Number(serverPricing.total || 0));
  if (
    orderType === "mixed" &&
    requestedDeliveryFleet === "express" &&
    Array.isArray(serverPricing.deliveryOptions)
  ) {
    const expressOption = serverPricing.deliveryOptions.find(
      (option) => option?.code === "express",
    );
    if (expressOption) {
      resolvedDeliveryFee = Math.max(0, Number(expressOption.deliveryFee || 0));
      resolvedTotal = Math.max(0, Number(expressOption.total || 0));
    }
  }

  const commissionPercentage = primaryRestaurant
    ? resolveRestaurantCommissionPercentage(primaryRestaurant.commissionPercentage)
    : 0;

  // Restaurant commission applies only to food GMV (never quick), after restaurant-borne discount.
  const foodCommissionSubtotal =
    orderType === "quick"
      ? 0
      : orderType === "mixed"
        ? sumItemsSubtotal(items, "food")
        : Math.max(0, Number(serverPricing.subtotal || 0));

  let restaurantDiscountShareForCommission = 0;
  const orderDiscount = Math.max(0, Number(serverPricing.discount || 0));
  if (orderDiscount > 0 && foodCommissionSubtotal > 0) {
    const split = await resolveDiscountSplitByCoupon({
      couponCode: serverPricing.couponCode || couponCodeFromClient || "",
      discount: orderDiscount,
      couponSource: serverPricing.appliedCoupon?.source,
    });
    restaurantDiscountShareForCommission = Math.max(
      0,
      Number(split.restaurantDiscountShare || 0),
    );
  }

  const commissionBase = Math.max(
    0,
    foodCommissionSubtotal - restaurantDiscountShareForCommission,
  );
  const restaurantCommission =
    Math.round(commissionBase * (commissionPercentage / 100) * 100) / 100;

  const useExpressMixedFees =
    orderType === "mixed" && requestedDeliveryFleet === "express";
  const normalizedPricing = {
    subtotal: Math.max(0, Number(serverPricing.subtotal || 0)),
    tax: Math.max(0, Number(serverPricing.tax || 0)),
    packagingFee: Math.max(0, Number(serverPricing.packagingFee || 0)),
    deliveryFee: resolvedDeliveryFee,
    totalDeliveryFee: useExpressMixedFees
      ? resolvedDeliveryFee
      : Math.max(
          0,
          Number(serverPricing.totalDeliveryFee ?? resolvedDeliveryFee),
        ),
    userDeliveryFee: useExpressMixedFees
      ? resolvedDeliveryFee
      : Math.max(
          0,
          Number(serverPricing.userDeliveryFee ?? resolvedDeliveryFee),
        ),
    restaurantDeliveryFee: Math.max(
      0,
      Number(serverPricing.restaurantDeliveryFee || 0),
    ),
    sponsoredDelivery: Boolean(serverPricing.sponsoredDelivery),
    sponsoredKm: Math.max(0, Number(serverPricing.sponsoredKm || 0)),
    deliveryDistanceKm:
      serverPricing.deliveryDistanceKm == null
        ? null
        : Number(serverPricing.deliveryDistanceKm),
    deliverySponsorType: String(
      serverPricing.deliverySponsorType || "USER_FULL",
    ),
    platformFee: Math.max(0, Number(serverPricing.platformFee || 0)),
    discount: Math.max(0, Number(serverPricing.discount || 0)),
    restaurantCommissionPercentage: commissionPercentage,
    restaurantCommission,
    quickDeliveryFee: Math.max(0, Number(serverPricing.quickDeliveryFee || 0)),
    quickPlatformShare: Math.max(0, Number(serverPricing.quickPlatformShare || 0)),
    quickRiderBonus: Math.max(0, Number(serverPricing.quickRiderBonus || 0)),
    quickRiderShare: Math.max(
      0,
      Number(
        serverPricing.quickRiderShare ?? serverPricing.quickRiderBonus ?? 0,
      ),
    ),
    quickRestaurantShare: Math.max(
      0,
      Number(serverPricing.quickRestaurantShare || 0),
    ),
    quickSharePcts: {
      platform: Math.max(0, Number(serverPricing.quickSharePcts?.platform || 0)),
      rider: Math.max(0, Number(serverPricing.quickSharePcts?.rider || 0)),
      restaurant: Math.max(
        0,
        Number(serverPricing.quickSharePcts?.restaurant || 0),
      ),
    },
    quickFinanceVersion: String(serverPricing.quickFinanceVersion || ""),
    total: resolvedTotal,
    currency: String(serverPricing.currency || "INR"),
    couponCode: serverPricing.couponCode || couponCodeFromClient || null,
    appliedCoupon: serverPricing.appliedCoupon || undefined,
  };
  const orderDeliveryMode =
    String(serverPricing.deliveryMode || "basic") === "quick" ? "quick" : "basic";
  if (normalizedPricing.totalDeliveryFee < normalizedPricing.deliveryFee) {
    normalizedPricing.totalDeliveryFee = normalizedPricing.deliveryFee;
  }
  if (
    normalizedPricing.restaurantDeliveryFee <= 0 &&
    normalizedPricing.totalDeliveryFee > normalizedPricing.deliveryFee
  ) {
    normalizedPricing.restaurantDeliveryFee = Math.max(
      0,
      normalizedPricing.totalDeliveryFee - normalizedPricing.deliveryFee,
    );
  }
  normalizedPricing.sponsoredDelivery =
    Boolean(normalizedPricing.sponsoredDelivery) ||
    normalizedPricing.restaurantDeliveryFee > 0;
  const recomputedTotal = Math.max(
    0,
    normalizedPricing.subtotal +
      normalizedPricing.tax +
      normalizedPricing.packagingFee +
      normalizedPricing.deliveryFee +
      normalizedPricing.platformFee +
      normalizedPricing.quickDeliveryFee -
      normalizedPricing.discount,
  );
  normalizedPricing.total = recomputedTotal;

  if (isCash) {
    const codOrderLimit = await resolveCodOrderLimit();
    const codEligibility = buildCodEligibility(normalizedPricing.total, codOrderLimit);
    if (!codEligibility.codAllowed) {
      throw new ValidationError(
        `Cash on Delivery is not available for orders above ₹${Math.round(codOrderLimit)}.`,
      );
    }
  }

  const payment = {
    method: paymentMethod,
    status: isCash ? "cod_pending" : isWallet ? "paid" : "created",
    amountDue: normalizedPricing.total ?? 0,
    razorpay: {},
    qr: {},
  };

  let distanceKm = null;
  // Reuse fee settings from calculateOrder — avoid duplicate Mongo hot-path read.
  const feeDocForRider =
    calcFeeDoc ||
    (await FoodFeeSettings.findOne({ isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .lean());
  const feeSettingsForRider = normalizeFoodFeeSettings(feeDocForRider);

  if (
    (orderType === "food" || orderType === "mixed") &&
    normalizedPricing.deliveryDistanceKm == null
  ) {
    distanceKm = await resolveRestaurantToUserRoadDistanceKm(
      primaryRestaurant,
      deliveryAddress,
    );
    if (Number.isFinite(distanceKm)) {
      normalizedPricing.deliveryDistanceKm = distanceKm;
    }
  }

  const riderDistanceKm =
    normalizedPricing.deliveryDistanceKm ?? distanceKm ?? null;
  const baseRiderEarning =
    orderType === "food" || orderType === "quick" || orderType === "mixed"
      ? calculateRiderEarning(feeSettingsForRider, riderDistanceKm)
      : 0;
  const quickRiderBonus =
    orderDeliveryMode === "quick"
      ? Math.max(0, Number(normalizedPricing.quickRiderBonus || 0))
      : 0;
  const quickPlatformShare =
    orderDeliveryMode === "quick"
      ? Math.max(0, Number(normalizedPricing.quickPlatformShare || 0))
      : 0;
  const riderEarning = Math.max(0, baseRiderEarning + quickRiderBonus);

  // Mixed express_split: QC store leg uses qcDeliveryFee / legacy fee settings deliveryFee.
  const qcLegDeliveryFee =
    orderType === "mixed" && dispatchStrategy === "express_split"
      ? Number(feeDocForRider?.deliveryFee || 25)
      : 0;
  const foodLegDeliveryFee =
    orderType === "mixed" && dispatchStrategy === "express_split"
      ? Math.max(0, Number(normalizedPricing.deliveryFee || 0) - qcLegDeliveryFee)
      : 0;

  /**
   * FINANCE FREEZE — Food Quick Charge accounting (deliveryMode === 'quick'):
   *   Customer pays:    pricing.quickDeliveryFee
   *   Platform gets:    pricing.quickPlatformShare
   *   Rider gets:       pricing.quickRiderShare (= quickRiderBonus BC alias)
   *   Restaurant gets:  pricing.quickRestaurantShare — frozen here; realized
   *                     into restaurant settlement ONLY after successful delivery
   *                     (never restaurant wallet at create).
   * Invariant: platform + rider + restaurant shares ≈ quickDeliveryFee
   *
   * platformProfit uses quickPlatformShare (NOT full quickDeliveryFee) and
   * subtracts baseRiderEarning only (quickRiderBonus already paid to rider).
   * When Basic / missing restaurantSharePct: restaurant share 0 → identical BC.
   */
  const deliveryFeeForProfit = Number.isFinite(normalizedPricing.totalDeliveryFee)
    ? normalizedPricing.totalDeliveryFee
    : Number.isFinite(normalizedPricing.deliveryFee)
      ? normalizedPricing.deliveryFee
      : 0;
  let platformProfit = computePlatformNetProfitWithQuickFreeze({
    deliveryFee: deliveryFeeForProfit,
    platformFee: Number.isFinite(normalizedPricing.platformFee)
      ? normalizedPricing.platformFee
      : 0,
    restaurantCommission: Number(normalizedPricing.restaurantCommission) || 0,
    sellerCommission: 0,
    quickPlatformShare,
    baseRiderShare: baseRiderEarning,
    adminDiscountShare: 0,
  });
  // GST collected from customer attributed to platform for remittance/reporting.
  platformProfit = Math.max(
    0,
    (Number(platformProfit) || 0) + (Number(normalizedPricing.tax) || 0),
  );

  const dispatchLegs = await Promise.all(
    pickupPoints.map(async (point) => {
      const legSource = sourceMap.get(String(point.sourceId)) || primaryRestaurant;
      const legDistanceKm =
        dispatchStrategy === "express_split"
          ? (await resolveRestaurantToUserRoadDistanceKm(legSource, deliveryAddress)) ??
            riderDistanceKm
          : riderDistanceKm;
      const legRiderEarning =
        dispatchStrategy === "express_split"
          ? calculateRiderEarning(feeSettingsForRider, legDistanceKm)
          : 0;

      return {
        legId: `${point.pickupType}:${point.sourceId}`,
        pickupType: point.pickupType,
        sourceId: point.sourceId,
        sourceName: point.sourceName || "",
        deliveryFee:
          dispatchStrategy === "express_split"
            ? point.pickupType === "quick"
              ? qcLegDeliveryFee
              : foodLegDeliveryFee
            : 0,
        riderEarning: legRiderEarning,
        assignedAt: null,
        deliveryPartnerId: null,
        partnerCandidates: [],
      };
    }),
  );

  const dispatchPlan = {
    strategy: dispatchStrategy,
    combinedPickupEligible: combinedPickup.eligible,
    pickupDistanceKm: combinedPickup.pickupDistanceKm,
    sameDirection: combinedPickup.sameDirection,
    reason: combinedPickup.reason,
    legs: dispatchLegs,
  };

  await populateDispatchLegPartnerCandidates(dispatchPlan, pickupPoints);

  const resolvedScheduledAt = resolveValidatedScheduledAt(dto.scheduledAt);
  if (resolvedScheduledAt && hasFoodItems && primaryRestaurant) {
    await assertRestaurantAllowsSchedule(primaryRestaurant);
  }
  const isScheduledOrder = Boolean(resolvedScheduledAt);
  const initialOrderStatus = isScheduledOrder ? "scheduled" : "created";

  const order = new FoodOrder({
    orderType,
    orderId,
    userId: new mongoose.Types.ObjectId(userId),
    restaurantId:
      hasFoodItems && primaryRestaurant?.sourceId ? new mongoose.Types.ObjectId(primaryRestaurant.sourceId) : null,
    zoneId:
      hasFoodItems && detectedServiceZone?.zoneId
        ? new mongoose.Types.ObjectId(detectedServiceZone.zoneId)
        : hasFoodItems && primaryRestaurant?.zoneId
          ? new mongoose.Types.ObjectId(primaryRestaurant.zoneId)
          : undefined,
    items,
    pickupPoints,
    ...(deliveryAddress ? { deliveryAddress } : {}),
    pricing: normalizedPricing,
    deliveryMode: orderDeliveryMode,
    ...(serverPricing.etaPromise
      ? {
          etaPromise: {
            min: serverPricing.etaPromise.min,
            max: serverPricing.etaPromise.max,
            mid: serverPricing.etaPromise.mid,
            startsAt: serverPricing.etaPromise.startsAt || new Date(),
            endsAt: serverPricing.etaPromise.endsAt || null,
            prepMinutes: serverPricing.etaPromise.prepMinutes,
            kitchenPrepMinutes:
              serverPricing.etaPromise.kitchenPrepMinutes ??
              serverPricing.etaPromise.prepMinutes,
            assignmentMinutes: serverPricing.etaPromise.assignmentMinutes ?? null,
            pickupMinutes: serverPricing.etaPromise.pickupMinutes ?? null,
            travelMinutes: serverPricing.etaPromise.travelMinutes,
            bufferMinutes: serverPricing.etaPromise.bufferMinutes,
            engineVersion:
              serverPricing.etaPromise.engineVersion ||
              (orderDeliveryMode === "quick" ? "food-quick-eta-v2" : "food-basic-eta-v1"),
            slaClock: serverPricing.etaPromise.slaClock || "placed",
            prepSource: serverPricing.etaPromise.prepSource || "",
            travelSource: serverPricing.etaPromise.travelSource || "",
            assignmentSource: serverPricing.etaPromise.assignmentSource || "",
            rejectionReason: serverPricing.etaPromise.rejectionReason || "",
            components: serverPricing.etaPromise.components || undefined,
            sources: serverPricing.etaPromise.sources || undefined,
          },
        }
      : {}),
    payment,
    orderStatus: initialOrderStatus,
    ...(orderType === "food" || orderType === "mixed"
      ? { dispatch: { modeAtCreation: dispatchMode, status: "unassigned" } }
      : {}),
    dispatchPlan,
    statusHistory: [
      {
        at: new Date(),
        byRole: "SYSTEM",
        from: "",
        to: initialOrderStatus,
        note: isScheduledOrder ? "Scheduled order placed" : "Order placed",
      },
    ],
    note: dto.note || "",
    restaurantNote: dto.restaurantNote || "",
    sendCutlery: dto.sendCutlery !== false,
    deliveryFleet:
      orderType === "mixed"
        ? requestedDeliveryFleet
        : orderType === "food"
          ? dto.deliveryFleet || "standard"
          : "quick",
    scheduledAt: resolvedScheduledAt,
    activatedAt: null,
    scheduleNotifyJobId: null,
    // Scheduled orders have not started delivery; Instant keeps schema default.
    ...(isScheduledOrder
      ? {
          deliveryState: {
            currentPhase: "waiting_activation",
            status: "waiting_activation",
          },
        }
      : {}),
    riderEarning,
    platformProfit,
  });

  let razorpayPayload = null;

  if (paymentMethod === "razorpay" && isRazorpayConfigured()) {
    const amountPaise = Math.round((normalizedPricing.total ?? 0) * 100);
    if (amountPaise < 100)
      throw new ValidationError("Amount too low for online payment");
    try {
      const rzOrder = await createRazorpayOrder(amountPaise, "INR", orderId);
      order.payment.razorpay = {
        orderId: rzOrder.id,
        paymentId: "",
        signature: "",
      };
      order.payment.status = "created";
      razorpayPayload = {
        key: getRazorpayKeyId(),
        orderId: rzOrder.id,
        amount: rzOrder.amount,
        currency: rzOrder.currency || "INR",
      };
    } catch (err) {
      throw new ValidationError(err?.message || "Payment gateway error");
    }
  }

  if (isWallet) {
    const walletAmount = Number(normalizedPricing.total || 0);
    await deductWalletBalance(
      userId,
      walletAmount,
      "Food order payment",
      {
        orderId: String(order._id),
        orderReadableId: orderId,
        source: "food_order_payment",
        orderType,
      },
    );
    try {
      await order.save();
    } catch (saveErr) {
      // Compensate: money was taken but order did not persist.
      try {
        await refundWalletBalance(
          userId,
          walletAmount,
          "Order create compensation",
          {
            orderId: String(order._id),
            orderReadableId: orderId,
            source: "order_save_compensation",
          },
        );
      } catch (refundErr) {
        logger.error(
          `Wallet compensation failed after order save error for ${orderId}: ${refundErr?.message || refundErr}`,
        );
      }
      throw saveErr;
    }
  } else {
    await order.save();
  }

  await foodTransactionService.createInitialTransaction(order);
  const sellerOrders = hasQuickItems
    ? await upsertSellerOrdersForParent(order, {
        customerName: dto.customerName,
        customerPhone: dto.customerPhone || dto.address?.phone,
      })
    : [];

  if (paymentMethod === "razorpay" && order.payment?.razorpay?.orderId) {
    // Audit can still happen here or via FinanceService events
  }

  // Realtime + push notifications.
  try {

    const branding = await getGlobalBranding();
    // Notify customer. For online payments, order is created but awaits payment confirmation.
    const isAwaitingOnlinePayment =
      String(order.payment?.method || "").toLowerCase() === "razorpay" &&
      String(order.payment?.status || "").toLowerCase() !== "paid";
    await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
      title: isAwaitingOnlinePayment
        ? "Complete Payment to Confirm Order"
        : isScheduledOrder
          ? "Scheduled Order Confirmed!"
          : orderType === "mixed"
          ? "Mixed Order Confirmed!"
          : orderType === "quick"
          ? "Quick Order Confirmed!"
          : "Order Confirmed!",
      body: isAwaitingOnlinePayment
        ? orderType === "mixed"
          ? `Order #${orderId} is created. Complete payment to confirm your mixed delivery.`
          : orderType === "quick"
          ? `Order #${orderId} is created. Please complete payment to confirm your quick order.`
          : `Order #${orderId} is created. Please complete payment to send it to ${primaryRestaurant?.sourceName || "the restaurant"}.`
        : isScheduledOrder
          ? `Your order #${orderId} is scheduled for ${new Date(resolvedScheduledAt).toLocaleString()}. We'll notify the restaurant closer to the time.`
          : orderType === "mixed"
          ? `Your mixed order #${orderId} has been placed successfully.`
          : orderType === "quick"
          ? `Your quick order #${orderId} has been placed successfully.`
          : `Your order #${orderId} from ${primaryRestaurant?.sourceName || "the restaurant"} has been placed successfully.`,
      image: branding.image,
      data: {
        type: isAwaitingOnlinePayment
          ? "order_created_pending_payment"
          : isScheduledOrder
            ? "schedule_confirmed"
            : "order_created",
        orderId: String(orderId),
        orderMongoId: order._id?.toString?.() || "",
        link: `/food/user/orders/${order._id?.toString?.() || ""}`,
      },
    });

    // Restaurant gets new-order request only when payment flow is eligible (not while scheduled).
    if (hasFoodItems) {
      await notifyRestaurantNewOrder(order);
    }
    if (hasQuickItems) {
      await notifySellerNewOrders(order, sellerOrders);
    }
  } catch {
    // Don't block order placement on socket/notification failures.
  }

  // PRIMARY BullMQ enqueue must NOT be swallowed by notification catch above.
  if (order.orderStatus === "scheduled" && order.scheduledAt) {
    try {
      await scheduleOrderActivationJob(order);
    } catch (err) {
      logger.error(
        `scheduleOrderActivationJob crashed for ${order.orderId}: ${err?.message || err}`
      );
    }
  }

  if (
    (orderType === "food" || (orderType === "mixed" && dispatchStrategy === "single")) &&
    dispatchMode === "auto" &&
    (isCash ||
      order.payment.status === "paid" ||
      order.payment.status === "cod_pending") &&
    !shouldHoldDispatchForScheduled(order)
  ) {
    try {
      await tryAutoAssign(order._id);
    } catch {
      // leave unassigned
    }
  }

  const saved = order.toObject();
  // Omit bulky history from create response — clients refetch detail when needed.
  const { statusHistory, ...orderForClient } = saved;
  let orderForClientEnriched = orderForClient;
  if (primaryRestaurant?.sourceId && (orderType === "food" || hasFoodItems)) {
    orderForClientEnriched = {
      ...orderForClient,
      restaurantName: primaryRestaurant.sourceName,
      restaurantId: {
        _id: primaryRestaurant.sourceId,
        restaurantName: primaryRestaurant.sourceName,
        name: primaryRestaurant.sourceName,
        profileImage: primaryRestaurant.profileImage,
      },
      restaurantImage:
        typeof primaryRestaurant.profileImage === "string"
          ? primaryRestaurant.profileImage
          : primaryRestaurant.profileImage?.url || undefined,
    };
  }
  return {
    order: orderForClientEnriched,
    razorpay: razorpayPayload,
    ...(quickFallbackApplied
      ? {
          quickDeliveryFallback: {
            requested: true,
            applied: false,
            deliveryMode: "basic",
            reason:
              serverPricing?.quickDelivery?.reason ||
              "Quick Delivery unavailable; order placed as Basic Delivery",
            gates: serverPricing?.quickDelivery?.gates || null,
          },
        }
      : {}),
  };
}

// ----- Verify payment -----
export async function verifyPayment(userId, dto) {
  const identity = buildOrderIdentityFilter(dto.orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");
  if (order.payment.status === "paid")
    return { order: order.toObject(), payment: order.payment };

  const expectedRazorpayOrderId = String(order.payment?.razorpay?.orderId || "").trim();
  const providedRazorpayOrderId = String(dto.razorpayOrderId || "").trim();
  if (!expectedRazorpayOrderId || providedRazorpayOrderId !== expectedRazorpayOrderId) {
    throw new ValidationError("Payment order mismatch");
  }

  const valid = verifyPaymentSignature(
    expectedRazorpayOrderId,
    dto.razorpayPaymentId,
    dto.razorpaySignature,
  );
  if (!valid) throw new ValidationError("Payment verification failed");
  await ensureRazorpayPaymentNotConsumed(dto.razorpayPaymentId, {
    currentFoodOrderId: order._id,
  });

  if (isRazorpayConfigured()) {
    const fetchedPayment = await fetchRazorpayPayment(dto.razorpayPaymentId);
    const fetchedOrderId = String(fetchedPayment?.order_id || "").trim();
    const fetchedStatus = String(fetchedPayment?.status || "").toLowerCase();
    const fetchedAmountPaise = Number(fetchedPayment?.amount || 0);
    const expectedAmountPaise = Math.round(Number(order.payment?.amountDue || 0) * 100);

    if (fetchedOrderId !== expectedRazorpayOrderId) {
      throw new ValidationError("Payment order mismatch");
    }
    if (fetchedStatus !== "captured") {
      throw new ValidationError("Payment not captured");
    }
    if (!Number.isFinite(expectedAmountPaise) || expectedAmountPaise < 100) {
      throw new ValidationError("Invalid order payment amount");
    }
    if (fetchedAmountPaise !== expectedAmountPaise) {
      throw new ValidationError("Payment amount mismatch");
    }
  }

  order.payment.status = "paid";
  order.payment.razorpay.paymentId = dto.razorpayPaymentId;
  order.payment.razorpay.signature = dto.razorpaySignature;
  await order.save();

  await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
    status: 'captured',
    razorpayPaymentId: dto.razorpayPaymentId,
    razorpaySignature: dto.razorpaySignature,
    recordedByRole: "USER",
    recordedById: new mongoose.Types.ObjectId(userId)
  });

  try {
    await processOrderPostPaymentFulfillment(order, {
      notifyCustomer: true,
      customerUserId: userId,
    });
  } catch (fulfillmentError) {
    logger.error(
      `Post-payment fulfillment failed for order ${order.orderId}:`,
      fulfillmentError?.message || fulfillmentError,
    );
  }

  return { order: order.toObject(), payment: order.payment };
}

// ----- Auto-assign -----

// Stale tryAutoAssign and processDispatchTimeout removed (now imported from order-dispatch.service.js)

// ----- User: list, get, cancel -----
export async function listOrdersUser(userId, query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = { userId: new mongoose.Types.ObjectId(userId) };

  // Opt-in lightweight probe for active-order banner (does not change default list/history).
  const scope = String(query?.scope || "").trim().toLowerCase();
  if (scope === "active") {
    filter.orderStatus = {
      $nin: [
        "delivered",
        "completed",
        "cancelled",
        "cancelled_by_user",
        "cancelled_by_restaurant",
        "cancelled_by_admin",
        "cancelled_by_system",
        "payment_failed",
        "expired",
        "failed",
      ],
    };
  }

  const [docs, total] = await Promise.all([
    FoodOrder.find(filter)
      .select(USER_ORDER_LIST_SELECT)
      .populate(
        "restaurantId",
        "restaurantName name profileImage area city slug",
      )
      .populate("dispatch.deliveryPartnerId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
  ]);
  return buildPaginatedResult({
    docs: docs.map((doc) => normalizeOrderForClient(doc)),
    total,
    page,
    limit,
  });
}

export async function getOrderById(
  orderId,
  { userId, restaurantId, deliveryPartnerId, admin } = {},
) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");
  const order = await FoodOrder.findOne(identity)
    .select(`${ORDER_DETAIL_PROJECTION} +deliveryOtp`)
    .populate(
      "restaurantId",
      "restaurantName profileImage area city location rating totalRatings phone primaryContactNumber ownerPhone slug",
    )
    .populate("dispatch.deliveryPartnerId", "name phone rating totalRatings")
    .populate("dispatchPlan.legs.deliveryPartnerId", "name phone rating totalRatings")
    .populate("userId", "name phone email gender")
    .lean();
  if (!order) throw new NotFoundError("Order not found");

  if (admin) return normalizeOrderForClient(order);

  const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
  const orderRestaurantId = order.restaurantId?._id?.toString() || order.restaurantId?.toString();
  const orderPartnerId = order.dispatch?.deliveryPartnerId?._id?.toString() || order.dispatch?.deliveryPartnerId?.toString();
  const assignedLegPartnerId = deliveryPartnerId
    ? toIdString(getAssignedDispatchLeg(order, deliveryPartnerId)?.deliveryPartnerId)
    : "";

  if (userId && orderUserId !== userId.toString())
    throw new ForbiddenError("Not your order");
  if (restaurantId && orderRestaurantId !== restaurantId.toString())
    throw new ForbiddenError("Not your restaurant order");
  if (
    deliveryPartnerId &&
    orderPartnerId !== deliveryPartnerId.toString() &&
    assignedLegPartnerId !== deliveryPartnerId.toString()
  )
    throw new ForbiddenError("Not assigned to you");

  if (deliveryPartnerId || restaurantId) {
    if (deliveryPartnerId) {
      return buildDeliveryOrderView(order, deliveryPartnerId, {
        assignedDispatchLeg: getAssignedDispatchLeg(order, deliveryPartnerId),
      });
    }
    const normalized = normalizeOrderForClient(order);
    return sanitizeOrderForExternal(normalized, "RESTAURANT");
  }

  if (userId) {
    const drop = order.deliveryVerification?.dropOtp || {};
    const secret = String(order.deliveryOtp || "").trim();
    const out = normalizeOrderForClient(order);
    delete out.deliveryOtp;
    out.deliveryVerification = {
      ...(order.deliveryVerification || {}),
      dropOtp: {
        required: Boolean(drop.required),
        verified: Boolean(drop.verified),
      },
    };
    if (drop.required && !drop.verified && secret) {
      out.handoverOtp = secret;
    }
    return out;
  }

  return sanitizeOrderForExternal(order);
}

const WALLET_REFUND_SOURCE_BY_ACTOR = {
  user: "user_cancel_refund",
  restaurant: "restaurant_cancel_refund",
  admin: "admin_auto_refund",
};

function isTerminalOrderStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return (
    isTerminalCancelStatus(s) ||
    s === "delivered" ||
    s === "cancelled"
  );
}

// --- AUTO REFUND HELPER ---
async function autoProcessRefund(order, source) {
    if (!order || !order.payment || order.payment.status !== 'paid') return false;
    
    const paymentMethod = String(order.payment.method || '').trim().toLowerCase();
    const isOnlinePaid = ['razorpay', 'razorpay_qr'].includes(paymentMethod);
    const isWalletPaid = paymentMethod === 'wallet';
    
    if (!isOnlinePaid && !isWalletPaid) return false;
    
    const amount = Number(order.pricing?.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) return false;
    
    if (order.payment.status === 'refunded' || order.payment.refund?.status === 'processed') return false;
    
    let processed = false;
    let refundId = '';
    const walletSource =
      WALLET_REFUND_SOURCE_BY_ACTOR[source] || "restaurant_cancel_refund";
    
    try {
        if (isWalletPaid) {
            await refundWalletBalance(
                order.userId,
                amount,
                'Order cancelled',
                {
                    orderId: String(order._id),
                    orderReadableId: String(order.orderId || ''),
                    source: walletSource,
                }
            );
            processed = true;
            refundId = `wallet_refund_${Date.now()}`;
        } else if (isOnlinePaid) {
            const paymentId = order.payment.razorpay?.paymentId;
            if (paymentId) {
                const refundResult = await initiateRazorpayRefund(paymentId, amount, {
                    idempotencyKey: `food_refund_${String(order._id)}_${source}`,
                    notes: {
                        orderId: String(order.orderId || order._id),
                        source: walletSource,
                    },
                });
                if (refundResult && refundResult.success) {
                    processed = true;
                    refundId = refundResult.refundId;
                }
            }
        }
        
        if (processed) {
            order.payment.status = 'refunded';
            order.payment.refund = {
                status: 'processed',
                amount: amount,
                refundId: refundId,
                requestedMethod: isWalletPaid ? 'wallet' : 'gateway',
                processedMethod: isWalletPaid ? 'wallet' : 'gateway',
                requestedAt: new Date(),
                processedAt: new Date(),
                requestedByUser: source === 'user',
                reason: 'Automatic refund on cancellation'
            };
            
            if (order.userId) {
                try {
                    await notifyOwnerSafely(
                        { ownerType: 'USER', ownerId: order.userId },
                        {
                            title: 'Refund Processed! 💸',
                            body: `Your refund of ₹${amount} for cancelled Order #${order.orderId} has been automatically processed.`,
                            data: {
                                type: 'refund_processed',
                                orderId: String(order.orderId),
                                orderMongoId: String(order._id || ''),
                                link: `/food/user/orders/${String(order._id || order.orderId || '')}`,
                            },
                        },
                    );
                } catch (e) {
                    logger.warn(`Failed to notify user of auto-refund: ${e?.message}`);
                }
            }
            return true;
        } else {
            order.payment.refund = {
                status: 'failed',
                amount: amount,
                reason: 'Automatic refund failed'
            };
            return false;
        }
    } catch (err) {
        logger.error(`[AutoRefund] Failed for order ${order._id}: ${err.message}`);
        order.payment.refund = {
            status: 'failed',
            amount: amount,
            reason: `Error: ${err.message}`
        };
        return false;
    }
}

export async function cancelOrder(orderId, userId, reason, refundTo) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");

  const orderStatus = String(order.orderStatus || "").trim().toLowerCase();
  const alwaysCancelableStatuses = ["created", "placed", "scheduled"];
  const cancelWindowStatuses = ["confirmed", "preparing", "ready_for_pickup", "picked_up"];
  const dispatchStatus = String(order.dispatch?.status || "").trim().toLowerCase();
  const hasAcceptedDeliveryPartner =
    dispatchStatus === "accepted" ||
    Boolean(order.dispatch?.acceptedAt) ||
    Boolean(order.dispatch?.deliveryPartnerId);
  const canCancelBeforeDispatchStarts =
    ["confirmed", "preparing", "ready_for_pickup"].includes(orderStatus) &&
    !hasAcceptedDeliveryPartner;

  if (!alwaysCancelableStatuses.includes(orderStatus)) {
    const cancelWindowStartEntry = [...(order.statusHistory || [])]
      .reverse()
      .find((entry) => cancelWindowStatuses.includes(String(entry?.to || "").trim().toLowerCase()));
    const cancelWindowStartAt = cancelWindowStartEntry?.at || order.updatedAt || order.createdAt || null;
    const cancelWindowStartMs = cancelWindowStartAt ? new Date(cancelWindowStartAt).getTime() : NaN;
    const isWithinCancelWindow =
      cancelWindowStatuses.includes(orderStatus) &&
      Number.isFinite(cancelWindowStartMs) &&
      Date.now() - cancelWindowStartMs <= USER_CANCEL_EDIT_WINDOW_MS;

    if (!isWithinCancelWindow && !canCancelBeforeDispatchStarts) {
      throw new ValidationError("Order cannot be cancelled");
    }
  }

  // Cancel activation job before flipping status (race-safe best effort).
  if (orderStatus === "scheduled") {
    await cancelScheduleActivationJob(order);
  }

  const from = order.orderStatus;
  order.orderStatus = "cancelled_by_user";
  order.scheduleNotifyJobId = null;
  safePushStatusHistory(order, {
    byRole: "USER",
    byId: userId,
    from,
    to: "cancelled_by_user",
    note: reason || "",
  });
  applyCancellationTerminalState(order, {
    cancelledStatus: "cancelled_by_user",
    reason: reason || "",
  });

  const paymentMethod = String(order.payment?.method || "").trim().toLowerCase();
  const isOnlinePaid =
    ["razorpay", "razorpay_qr"].includes(paymentMethod) &&
    (order.payment.status === "paid" || order.payment.status === "refunded");
  const isWalletPaid =
    paymentMethod === "wallet" &&
    String(order.payment?.status || "").trim().toLowerCase() === "paid" &&
    String(order.payment?.refund?.status || "").trim().toLowerCase() !== "processed";
  const requestedRefundMethod =
    refundTo === "wallet" || refundTo === "gateway" ? refundTo : "gateway";

  // Wallet-paid orders: refund immediately on user cancel (idempotent by orderId).
  if (isWalletPaid) {
    const totalAmount = Number(order.pricing?.total || 0);
    if (Number.isFinite(totalAmount) && totalAmount > 0 && order.userId) {
      try {
        await refundWalletBalance(
          order.userId,
          totalAmount,
          "Order refund",
          {
            orderId: String(order._id),
            orderReadableId: String(order.orderId || ""),
            source: "user_cancel_refund",
          },
        );
        order.payment.status = "refunded";
        order.payment.refund = {
          status: "processed",
          amount: totalAmount,
          refundId: `wallet_refund_${order._id}`,
          requestedMethod: "wallet",
          processedMethod: "wallet",
          requestedAt: new Date(),
          requestedByUser: true,
          reason: reason || "",
          processedAt: new Date(),
        };
      } catch (err) {
        logger.warn(
          `Wallet refund failed on user cancel for Order ${orderId}: ${err?.message || err}`,
        );
        order.payment.refund = {
          status: "failed",
          amount: totalAmount,
          requestedMethod: "wallet",
          processedMethod: "wallet",
          requestedAt: new Date(),
          requestedByUser: true,
          reason: reason || "",
        };
      }
    }
  } else if (isOnlinePaid) {
    order.payment.refund = {
      ...(order.payment.refund || {}),
      status: "pending",
      amount: Number(order.pricing?.total || 0),
      refundId: "",
      requestedMethod: requestedRefundMethod,
      processedMethod: undefined,
      requestedAt: new Date(),
      requestedByUser: true,
      reason: reason || "",
      processedAt: null,
    };
  }
  // User-cancelled online/wallet refunds are handled automatically
  if (["paid", "refunded"].includes(order.payment.status)) {
    await autoProcessRefund(order, 'user');
  } else if (!["paid", "refunded"].includes(order.payment.status)) {
    // For COD or unpaid online orders, mark payment as cancelled
    order.payment.status = "cancelled";
  }

  // User-cancelled online refunds are handled from admin so the 30-second policy can be enforced.
  if (
    false &&
    order.payment.status === "paid" &&
    order.payment.method === "razorpay" &&
    order.payment.razorpay?.paymentId &&
    (!order.payment.refund || order.payment.refund.status !== "processed")
  ) {
    try {
      const refundResult = await initiateRazorpayRefund(
        order.payment.razorpay.paymentId,
        order.pricing.total,
        {
          idempotencyKey: `food_refund_${String(order._id)}_user_cancel`,
          notes: { orderId: String(order.orderId || order._id), source: 'user_cancel' },
        },
      );

      if (refundResult.success) {
        order.payment.status = "refunded";
        order.payment.refund = {
          status: "processed",
          amount: order.pricing.total,
          refundId: refundResult.refundId,
          processedAt: new Date()
        };
      } else {
        // Log failure but let order cancellation proceed
        order.payment.refund = {
          status: "failed",
          amount: order.pricing.total
        };
      }
    } catch (err) {
      console.error(`Refund processing error for Order ${orderId}:`, err);
      order.payment.refund = { status: "failed", amount: order.pricing.total };
    }
  }

  await order.save();

  // Sync mixed order seller legs if applicable
  if (order.orderType === 'mixed' || order.orderType === 'quick') {
    await cancelSellerOrdersForParent(order, "Cancelled by user");
  }

  enqueueOrderEvent("order_cancelled_by_user", {
    orderMongoId: order._id?.toString?.(),
    orderId: order.orderId,
    userId,
    reason: reason || "",
    refundTo: isOnlinePaid ? requestedRefundMethod : undefined,
  });

  // Sync transaction status — cancelled orders must leave captured/authorized
  // so they never remain eligible for restaurant settlement.
  try {
    const paymentStatus = String(order.payment?.status || "").trim().toLowerCase();
    const wasPaidOrRefunded = ["paid", "refunded"].includes(paymentStatus);
    await foodTransactionService.updateTransactionStatus(order._id, 'cancelled_by_user', {
        status: wasPaidOrRefunded ? 'refunded' : 'failed',
        note: `Order cancelled by user: ${reason || "No reason"}`,
        recordedByRole: 'USER',
        recordedById: userId
    });
  } catch (err) {
    logger.warn(`cancelOrder transaction sync failed: ${err?.message || err}`);
  }

  // Notify User and Restaurant about the cancellation
  const refundPolicyDetail =
    isOnlinePaid
      ? ` Refund review will follow the cancellation policy: full refund within ${USER_CANCEL_FULL_REFUND_WINDOW_MS / 1000} seconds, otherwise admin may process a partial refund. Requested destination: ${requestedRefundMethod === "wallet" ? "wallet" : "original payment method"}.`
      : "";

  const branding = await getGlobalBranding();
  const cancelTargets = [
    { ownerType: "USER", ownerId: userId },
    { ownerType: "RESTAURANT", ownerId: order.restaurantId },
  ];
  const assignedRiderId =
    order.dispatch?.deliveryPartnerId?.toString?.() ||
    order.dispatch?.deliveryPartnerId;
  if (assignedRiderId) {
    cancelTargets.push({
      ownerType: "DELIVERY_PARTNER",
      ownerId: assignedRiderId,
    });
  }
  await notifyOwnersSafely(cancelTargets, {
    title: "Order Cancelled ❌",
    body: `Order #${order.orderId} has been cancelled successfully.${refundPolicyDetail}`,
    image: branding.image,
    data: {
      type: "order_cancelled",
      orderId: String(order.orderId),
      orderMongoId: String(order._id),
    },
  });

  // Real-time: status update via socket
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        message: `Order #${order.orderId} has been cancelled successfully.${refundPolicyDetail}`,
      };
      io.to(rooms.user(userId)).emit("order_status_update", payload);
      io.to(rooms.restaurant(order.restaurantId)).emit("order_status_update", payload);
      if (assignedRiderId) {
        io.to(rooms.delivery(assignedRiderId)).emit("order_cancelled", payload);
      }
    }
  } catch (err) {
    logger.warn(`cancelOrder socket emit failed: ${err?.message || err}`);
  }

  return order.toObject();
}

export async function submitOrderRatings(orderId, userId, dto) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  // First try food order
  let order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });

  let isQuickOrder = false;
  
  // If not food order, try quick commerce order
  if (!order) {
    const { QuickOrder } = await import('../../../quick-commerce/models/order.model.js');
    order = await QuickOrder.findOne({
      ...identity,
      userId: new mongoose.Types.ObjectId(userId),
    });
    isQuickOrder = true;
  }

  if (!order) throw new NotFoundError("Order not found");
  if (String(order.orderStatus) !== "delivered") {
    throw new ValidationError("You can rate only delivered orders");
  }

  const hasDeliveryPartner = !!order.dispatch?.deliveryPartnerId;
  
  // For quick commerce orders, use sellerRating instead of restaurantRating
  const sellerRating = dto.sellerRating || dto.restaurantRating;
  const sellerComment = dto.sellerComment || dto.restaurantComment || "";

  if (!sellerRating) {
    throw new ValidationError(isQuickOrder ? "Seller rating is required" : "Restaurant rating is required");
  }

  if (hasDeliveryPartner && !dto.deliveryPartnerRating) {
    throw new ValidationError("Delivery partner rating is required");
  }

  const existingRating = isQuickOrder 
    ? (order?.ratings?.seller?.rating || order?.ratings?.restaurant?.rating) 
    : order?.ratings?.restaurant?.rating;
    
  const restaurantAlreadyRated = Number.isFinite(Number(existingRating));
  const deliveryAlreadyRated = Number.isFinite(
    Number(order?.ratings?.deliveryPartner?.rating),
  );
  if (restaurantAlreadyRated || (hasDeliveryPartner && deliveryAlreadyRated)) {
    throw new ValidationError("Ratings already submitted for this order");
  }

  const now = new Date();
  order.ratings = order.ratings || {};
  
  // Set both seller and restaurant ratings for compatibility
  if (isQuickOrder) {
    order.ratings.seller = {
      rating: sellerRating,
      comment: sellerComment,
      ratedAt: now,
    };
    order.ratings.restaurant = {
      rating: sellerRating,
      comment: sellerComment,
      ratedAt: now,
    };
  } else {
    order.ratings.restaurant = {
      rating: sellerRating,
      comment: sellerComment,
      ratedAt: now,
    };
  }

  if (hasDeliveryPartner) {
    order.ratings.deliveryPartner = {
      rating: dto.deliveryPartnerRating,
      comment: dto.deliveryPartnerComment || "",
      ratedAt: now,
    };
  }

  let sellerModel, sellerId;
  if (isQuickOrder) {
    const { Seller } = await import('../../../quick-commerce/seller/models/seller.model.js');
    sellerModel = Seller;
    const quickItem = order.items?.find(item => item.type === 'quick');
    sellerId = quickItem?.sourceId;
  } else {
    sellerModel = FoodRestaurant;
    sellerId = order.restaurantId;
  }

  const promises = [];
  if (sellerId) {
    promises.push(applyAggregateRating(sellerModel, sellerId, sellerRating));
  }
  if (hasDeliveryPartner) {
    promises.push(applyAggregateRating(
      FoodDeliveryPartner,
      order.dispatch.deliveryPartnerId,
      dto.deliveryPartnerRating,
    ));
  }

  await Promise.all(promises);

  await order.save();
  enqueueOrderEvent('order_ratings_submitted', {
    orderMongoId: order._id?.toString?.(),
    orderId: order.orderId,
    userId,
    restaurantRating: sellerRating,
    deliveryPartnerRating: hasDeliveryPartner ? dto.deliveryPartnerRating : null
  });
  return order.toObject();
}

// ----- Restaurant -----
export async function listOrdersRestaurant(restaurantId, query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = {
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
    $or: [
      { "payment.method": { $in: ["cash", "wallet"] } },
      { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
    ],
  };
  const [docs, total] = await Promise.all([
    FoodOrder.find(filter)
      .select(RESTAURANT_ORDER_LIST_SELECT)
      .populate("userId", "name phone profileImage gender")
      .populate("dispatch.deliveryPartnerId", "name phone rating")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
  ]);
  // Phone masking for restaurant role (partner phone hidden until photo rules allow).
  const sanitizedDocs = await Promise.all(
    docs.map(async (doc) => {
      const normalized = normalizeOrderForClient(doc);
      if (String(doc.deliveryMode || '').toLowerCase() === 'quick' && doc.pricing) {
        normalized.pricing = await enrichRestaurantQuickPricing(
          doc.pricing,
          doc.deliveryMode,
        );
      }
      return sanitizeOrderForExternal(normalized, 'RESTAURANT');
    }),
  );
  return buildPaginatedResult({ docs: sanitizedDocs, total, page, limit });
}

export async function updateOrderStatusRestaurant(
  orderId,
  restaurantId,
  orderStatus,
  reason = "",
  extras = {},
) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    throw new ValidationError("Invalid restaurant id");
  }
  let order = await FoodOrder.findOne({
    ...identity,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });
  if (!order) throw new NotFoundError("Order not found");
  const from = order.orderStatus;
  const requestedStatus = String(orderStatus || "").trim();
  const isCancelRequest =
    isTerminalCancelStatus(requestedStatus) ||
    requestedStatus.includes("cancel");

  // Idempotent: duplicate cancel/reject — order already terminal, do not re-refund.
  if (isCancelRequest && isTerminalCancelStatus(from)) {
    return order.toObject();
  }

  // Block resurrecting cancelled/delivered orders into active workflow.
  if (isTerminalOrderStatus(from) && !isCancelRequest) {
    throw new ValidationError(
      `Order cannot move to '${requestedStatus}' from terminal status '${from}'`,
    );
  }

  // Idempotent accept / mark-ready when already at or past target state.
  if (
    requestedStatus === "preparing" &&
    ["preparing", "ready_for_pickup", "ready", "picked_up", "delivered"].includes(
      String(from || "").trim().toLowerCase(),
    )
  ) {
    return order.toObject();
  }
  if (
    (requestedStatus === "ready_for_pickup" || requestedStatus === "ready") &&
    ["ready_for_pickup", "ready", "picked_up", "delivered"].includes(
      String(from || "").trim().toLowerCase(),
    )
  ) {
    return order.toObject();
  }

  // Enforce actor-specific cancellation status and terminal side effects.
  if (isTerminalCancelStatus(orderStatus)) {
    order.orderStatus = "cancelled_by_restaurant";
    safePushStatusHistory(order, {
      byRole: "RESTAURANT",
      byId: restaurantId,
      from,
      to: "cancelled_by_restaurant",
      note: String(reason || "").trim(),
    });
    applyCancellationTerminalState(order, {
      cancelledStatus: "cancelled_by_restaurant",
      reason: String(reason || "").trim(),
    });
  } else {
    order.orderStatus = orderStatus;
    safePushStatusHistory(order, {
      byRole: "RESTAURANT",
      byId: restaurantId,
      from,
      to: orderStatus,
      note: String(reason || "").trim(),
    });

    // Refresh display ETA when restaurant accepts with a prep-time estimate.
    const acceptLike =
      String(orderStatus) === "preparing" || String(orderStatus) === "confirmed";
    if (acceptLike) {
      const prepFromExtras = Number(
        extras?.prepTimeMins ??
          (typeof extras?.preparationTime === "number"
            ? extras.preparationTime
            : String(extras?.preparationTime || "").match(/(\d+)/)?.[1]),
      );
      if (Number.isFinite(prepFromExtras) && prepFromExtras > 0) {
        // Keep accept prep inside kitchen-prep product bounds (1–90).
        const safePrep = Math.min(90, Math.max(1, Math.round(prepFromExtras)));
        try {
          const existing = order.etaPromise?.toObject
            ? order.etaPromise.toObject()
            : { ...(order.etaPromise || {}) };
          const displayEta = computeFoodDisplayEtaPromise({
            restaurant: { kitchenPrepMinutes: safePrep },
            deliveryDistanceKm: order.pricing?.deliveryDistanceKm ?? null,
            travelMinutes: existing.travelMinutes,
            assignmentMinutes: existing.assignmentMinutes,
            quickSettings: {
              pickupMinutes: existing.pickupMinutes,
              etaBufferMinutes: existing.bufferMinutes,
              fallbackTravelMinutes: existing.travelMinutes || 12,
              riderAssignmentMinutes: existing.assignmentMinutes || 3,
              defaultKitchenPrepMinutes: safePrep,
              maxEtaMinutes: 0,
            },
            // Keep placed clock when we already have startsAt (Quick SLA / display).
            startsAt: existing.startsAt
              ? new Date(existing.startsAt)
              : order.createdAt
                ? new Date(order.createdAt)
                : new Date(),
          });
          if (displayEta?.etaPromise) {
            order.etaPromise = {
              ...existing,
              ...displayEta.etaPromise,
              // Preserve Quick engine version when order is Quick.
              engineVersion:
                String(order.deliveryMode || "") === "quick"
                  ? existing.engineVersion || "food-quick-eta-v2"
                  : displayEta.etaPromise.engineVersion,
            };
          }
        } catch (etaErr) {
          logger.warn(
            `[ETA] Failed to refresh etaPromise on accept: ${etaErr?.message || etaErr}`,
          );
        }
      }
    }
  }

  // Payment + refund side effects before persistence (admin path saves after refund).
  if (isCancelRequest) {
    const isOnlinePaid =
      order.payment?.method === "razorpay" &&
      (order.payment?.status === "paid" || order.payment?.status === "refunded");
    if (["paid", "refunded"].includes(order.payment?.status)) {
      await autoProcessRefund(order, "restaurant");
    } else if (!isOnlinePaid && order.payment) {
      order.payment.status = "cancelled";
    }
    if (order.orderType === "mixed" || order.orderType === "quick") {
      console.log(
        `[MIXED-SYNC] Order ${order.orderId} (type: ${order.orderType}) cancelled by restaurant. Propagating to seller legs...`,
      );
      await cancelSellerOrdersForParent(order, "Cancelled by restaurant");
    }
  }

  await order.save();

  // Real-time: status update to restaurant room.
  try {
    const io = getIO();
    if (io) {
      console.log(
        `[DEBUG] Emitting status update to restaurant ${restaurantId} and user ${order.userId}: ${orderStatus}`,
      );
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        title: `Order ${order.orderId} updated`,
        message: `Status changed to ${String(orderStatus).replace(/_/g, " ")}`,
      };
      io.to(rooms.restaurant(restaurantId)).emit(
        "order_status_update",
        payload,
      );
      io.to(rooms.user(order.userId)).emit("order_status_update", payload);
      if (payload?.orderStatus && String(payload.orderStatus).includes("cancel")) {
        // Ensure delivery app drops stale active trip immediately.
        io.to(rooms.delivery(order.dispatch?.deliveryPartnerId)).emit("order_cancelled", payload);
        for (const leg of order.dispatchPlan?.legs || []) {
          if (leg?.deliveryPartnerId) {
            io.to(rooms.delivery(leg.deliveryPartnerId)).emit("order_cancelled", payload);
          }
        }
      }
    }

    let title = `Order ${order.orderId} updated`;
    let body = `Status changed to ${String(orderStatus).replace(/_/g, " ")}`;

    // Custom messages for customer based on status
    if (orderStatus === "confirmed") {
      title = "Order Accepted! 🧑‍🍳";
      body =
        "The restaurant has accepted your order and is starting to prepare it.";
    } else if (orderStatus === "preparing") {
      title = "Food is being prepared! 🍳";
      body = "Your food is currently being prepared by the restaurant.";
    } else if (orderStatus === "ready_for_pickup" || orderStatus === "ready") {
      title = "Food is ready! 🛍️";
      body = "Your order is ready and waiting to be picked up.";
    } else if (
      String(orderStatus).includes("cancel") ||
      String(order.orderStatus || "").includes("cancel")
    ) {
      const isOnlinePaid =
        order.payment?.method === "razorpay" &&
        (order.payment?.status === "paid" ||
          order.payment?.status === "refunded");
      const refundDetail = isOnlinePaid ? ` Your refund of ₹${order.pricing.total} is being processed and will be credited to your original payment method within 5-7 working days.` : "";
      const reasonText = String(order.cancellationReason || reason || "").trim();
      const isAcceptanceTimeout =
        /restaurant not accept|did not respond|not accepted within/i.test(
          reasonText,
        );

      title = "Order Cancelled ❌";
      body = isAcceptanceTimeout
        ? `The restaurant did not accept your order in time.${refundDetail}`
        : `Unfortunately, your order has been cancelled by the restaurant.${refundDetail}`;
    }

    const assignedRiderId = order.dispatch?.deliveryPartnerId;
    let riderTitle = `Order #${order.orderId} updated`;
    let riderBody = `The order status is now ${String(orderStatus).replace(/_/g, " ")}.`;

    if (String(orderStatus).includes("cancel")) {
      riderTitle = "Order Cancelled ❌";
      riderBody = `Order #${order.orderId} has been cancelled. Please stop your current task.`;
    } else if (orderStatus === "ready_for_pickup" || orderStatus === "ready") {
      riderTitle = "Order ready for pickup 🛍️";
      riderBody = `Order #${order.orderId} is ready at the restaurant.`;
    } else if (orderStatus === "confirmed" || orderStatus === "preparing") {
      riderTitle = "Order update";
      riderBody = `Order #${order.orderId} is being prepared.`;
    }

    const branding = await getGlobalBranding();
    const commonData = {
      type: "order_status_update",
      orderId: order.orderId,
      orderMongoId: order._id?.toString?.() || "",
      orderStatus: String(orderStatus || ""),
    };

    // Separate payloads per audience (avoid restaurant getting customer copy)
    await notifyOwnerSafely(
      { ownerType: "USER", ownerId: order.userId },
      {
        title,
        body,
        image: branding.image,
        data: {
          ...commonData,
          link: `/food/user/orders/${order._id?.toString?.() || ""}`,
        },
      },
    );

    const restaurantTitle = String(orderStatus).includes("cancel")
      ? "Order Cancelled ❌"
      : `Order #${order.orderId} updated`;
    const restaurantBody = String(orderStatus).includes("cancel")
      ? `You cancelled order #${order.orderId}.`
      : `Status is now ${String(orderStatus).replace(/_/g, " ")}.`;
    await notifyOwnerSafely(
      { ownerType: "RESTAURANT", ownerId: restaurantId },
      {
        title: restaurantTitle,
        body: restaurantBody,
        image: branding.image,
        data: commonData,
      },
    );

    if (assignedRiderId) {
      await notifyOwnerSafely(
        { ownerType: "DELIVERY_PARTNER", ownerId: assignedRiderId },
        {
          title: riderTitle,
          body: riderBody,
          image: branding.image,
          data: {
            ...commonData,
            audience: "delivery",
            link: "/food/delivery",
            targetUrl: "/food/delivery",
          },
        },
      );
    }
  } catch (err) {
    console.error("[DEBUG] Error emitting status update to restaurant:", err);
  }

  // Real-time: delivery request / ready notifications.
  try {
    const io = getIO();
    if (io) {
      // On accept (confirmed or preparing) -> request delivery partners.
      if (
        (String(orderStatus) === "preparing" || String(orderStatus) === "confirmed") && 
        (String(from) !== "preparing" && String(from) !== "confirmed")
      ) {
        console.log(
          `[DEBUG] Order ${order.orderId} status changed to '${orderStatus}'. Triggering delivery dispatch.`,
        );
        // If auto dispatch, try assign now.
        if (
          order.dispatch?.status === "unassigned" &&
          order.dispatch?.modeAtCreation === "auto"
        ) {
          try {
            console.log(`[DEBUG] Auto-assigning order ${order.orderId}`);
            await tryAutoAssign(order._id);
            // Refresh order state from DB after auto-assignment
            order = await FoodOrder.findById(order._id); 
          } catch (err) {
            console.error(
              `[DEBUG] Auto-assign failed for order ${order.orderId}:`,
              err,
            );
          }
        }

        const restaurant = await FoodRestaurant.findById(order.restaurantId)
          .select("restaurantName location addressLine1 area city state primaryContactNumber ownerPhone")
          .lean();
        const payload = buildDeliverySocketPayload(await resolveOrderWithCustomerGender(order), restaurant);

        // If assigned, notify assigned partner only.
        const assignedId =
          order.dispatch?.deliveryPartnerId?.toString?.() ||
          order.dispatch?.deliveryPartnerId;
        if (assignedId && order.dispatch?.status === "assigned") {
          console.log(
            `[DEBUG] Order ${order.orderId} assigned to ${assignedId}. Notifying.`,
          );
          io.to(rooms.delivery(assignedId)).emit("new_order", payload);
          io.to(rooms.delivery(assignedId)).emit("play_notification_sound", {
            audience: "delivery",
            type: "new_order",
            orderId: payload.orderId,
            orderMongoId: payload.orderMongoId,
          });
          await notifyOwnerSafely(
            { ownerType: "DELIVERY_PARTNER", ownerId: assignedId },
            {
              title: "New delivery task",
              body: `Order ${payload.orderId} is assigned to you.`,
              data: {
                type: "new_order",
                audience: "delivery",
                orderId: payload.orderId,
                orderMongoId: payload.orderMongoId,
                link: "/food/delivery",
                targetUrl: "/food/delivery",
              },
            },
          );
        } else {
          if (isSplitDispatchOrder(order)) {
            await notifySplitDispatchOffers(order, { restaurantDoc: restaurant });
          } else {
            // Broadcast to nearby online partners so someone can accept/claim.
            console.log(
              `[DEBUG] Searching for nearby partners for order ${order.orderId}`,
            );
            const { partners } = await listNearbyOnlineDeliveryPartners(
              order.restaurantId,
              { maxKm: 15, limit: 25 },
            );
            console.log(
              `[DEBUG] Found ${partners.length} partners: ${JSON.stringify(partners)}`,
            );
            for (const p of partners) {
              const targetRoom = rooms.delivery(p.partnerId);
              console.log(
                `[DEBUG] Emitting new_order_available to room: ${targetRoom}`,
              );
              io.to(targetRoom).emit("new_order_available", {
                ...payload,
                pickupDistanceKm: p.distanceKm,
              });
            }
            await notifyOwnersSafely(
              partners.slice(0, 5).map((p) => ({
                ownerType: "DELIVERY_PARTNER",
                ownerId: p.partnerId,
              })),
              {
                title: "New delivery order available",
                body: `Order ${payload.orderId} is available near ${restaurant?.restaurantName || "your area"}.`,
                data: {
                  type: "new_order_available",
                  audience: "delivery",
                  orderId: payload.orderId,
                  orderMongoId: payload.orderMongoId,
                  link: "/food/delivery",
                  targetUrl: "/food/delivery",
                },
              },
            );
            // Also trigger a generic sound event for the first few partners.
            for (const p of partners.slice(0, 5)) {
              io.to(rooms.delivery(p.partnerId)).emit("play_notification_sound", {
                audience: "delivery",
                type: "new_order_available",
                orderId: payload.orderId,
                orderMongoId: payload.orderMongoId,
              });
            }
          }
        }
      }

            // When ready for pickup -> ping assigned delivery partner.
            if (String(orderStatus) === 'ready_for_pickup' && String(from) !== 'ready_for_pickup') {
                console.log(`[DEBUG] Order ${order.orderId} changed to 'ready_for_pickup'.`);
                const assignedId = order.dispatch?.deliveryPartnerId?.toString?.() || order.dispatch?.deliveryPartnerId;
                if (assignedId) {
                    console.log(`[DEBUG] Notifying assigned partner ${assignedId} that order is ready.`);
                    const restaurant = await FoodRestaurant.findById(order.restaurantId).select('restaurantName location addressLine1 area city state primaryContactNumber ownerPhone').lean();
                    const payload = buildDeliverySocketPayload(await resolveOrderWithCustomerGender(order), restaurant);
                    io.to(rooms.delivery(assignedId)).emit('order_ready', payload);
                    // FCM + inbox (socket alone is not enough if app is backgrounded)
                    await notifyOwnerSafely(
                      { ownerType: "DELIVERY_PARTNER", ownerId: assignedId },
                      {
                        title: "Order ready for pickup 🛍️",
                        body: `Order #${order.orderId} is ready at the restaurant.`,
                        data: {
                          type: "order_ready",
                          audience: "delivery",
                          orderId: order.orderId,
                          orderMongoId: order._id?.toString?.() || "",
                          link: "/food/delivery",
                          targetUrl: "/food/delivery",
                        },
                      },
                    );
                } else {
                    console.log(`[DEBUG] Order ${order.orderId} is ready but no partner assigned.`);
                }
            }
        }
    } catch (err) {
        console.error('[DEBUG] Error in delivery notification logic:', err);
    }

    enqueueOrderEvent('restaurant_order_status_updated', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        restaurantId,
        from,
        to: orderStatus
    });

    // Refund already handled via autoProcessRefund earlier in this function.
    const isCancellationStatus = String(orderStatus).includes("cancel") || isTerminalCancelStatus(orderStatus);

    // Remove cancelled orders from restaurant payout eligibility (never leave as captured).
    if (isCancellationStatus || String(order.orderStatus || "").includes("cancel")) {
      try {
        const paymentStatus = String(order.payment?.status || "").trim().toLowerCase();
        const wasPaidOrRefunded = ["paid", "refunded"].includes(paymentStatus);
        await foodTransactionService.updateTransactionStatus(
          order._id,
          "cancelled_by_restaurant",
          {
            status: wasPaidOrRefunded ? "refunded" : "failed",
            note: reason
              ? `Order cancelled by restaurant: ${reason}`
              : "Order cancelled by restaurant",
            recordedByRole: "RESTAURANT",
            recordedById: restaurantId,
          },
        );
      } catch (err) {
        logger.warn(
          `updateOrderStatusRestaurant transaction sync failed: ${err?.message || err}`,
        );
      }
    }

    const saved = order.toObject();
    const { statusHistory, ...orderForClient } = saved;
    return orderForClient;
}

export async function updateOrderStatusAdmin(orderId, adminId, orderStatus, reason = "") {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    throw new ValidationError("Invalid admin id");
  }

  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");

  const from = order.orderStatus;
  const next = String(orderStatus || "").trim();
  const note = String(reason || "").trim();

  if (isTerminalCancelStatus(next)) {
    order.orderStatus = "cancelled_by_admin";
    safePushStatusHistory(order, {
      byRole: "ADMIN",
      byId: adminId,
      from,
      to: "cancelled_by_admin",
      note,
    });
    applyCancellationTerminalState(order, {
      cancelledStatus: "cancelled_by_admin",
      reason: note,
    });
  } else {
    order.orderStatus = next;
    safePushStatusHistory(order, {
      byRole: "ADMIN",
      byId: adminId,
      from,
      to: next,
      note,
    });
  }

  await order.save();

  if (order.orderStatus === 'delivered') {
    await consumeOrderCouponUsageOnDelivery(order, order.userId);
  }

  if (order.orderStatus === "cancelled_by_admin") {
    if (order.orderType === "mixed" || order.orderType === "quick") {
      await cancelSellerOrdersForParent(order, "Cancelled by admin");
    }

    try {
      const paymentStatus = String(order.payment?.status || "").trim().toLowerCase();
      const wasPaidOrRefunded = ["paid", "refunded"].includes(paymentStatus);
      await foodTransactionService.updateTransactionStatus(order._id, "cancelled_by_admin", {
        status: wasPaidOrRefunded ? "refunded" : "failed",
        note: note ? `Order cancelled by admin: ${note}` : "Order cancelled by admin",
        recordedByRole: "ADMIN",
        recordedById: adminId,
      });
    } catch (err) {
      logger.warn(`updateOrderStatusAdmin transaction sync failed: ${err?.message || err}`);
    }
  }

  // ✅ Automated refund on ADMIN cancel (same behavior as restaurant-cancel)
  // - Wallet payment: credit back to user wallet immediately.
  // - Razorpay payment: initiate Razorpay refund (full amount).
  if (order.orderStatus === "cancelled_by_admin") {
    if (["paid", "refunded"].includes(order.payment?.status)) {
      await autoProcessRefund(order, "admin");
    } else if (!["paid", "refunded"].includes(String(order.payment?.status || ""))) {
      // COD/unpaid orders: keep payment cancelled marker consistent.
      order.payment.status = "cancelled";
    }
  }

  await order.save();

  // Inbox + FCM for user / restaurant / assigned rider (socket alone is not enough)
  try {
    const branding = await getGlobalBranding();
    const isCancel = String(order.orderStatus).includes("cancel");
    const statusLabel = String(order.orderStatus).replace(/_/g, " ");
    const title = isCancel
      ? "Order Cancelled ❌"
      : `Order #${order.orderId} updated`;
    const userBody = isCancel
      ? `Order #${order.orderId} was cancelled by support.${note ? ` Reason: ${note}` : ""}`
      : `Order #${order.orderId} status is now ${statusLabel}.`;
    const restaurantBody = isCancel
      ? `Order #${order.orderId} was cancelled by admin.${note ? ` Reason: ${note}` : ""}`
      : `Order #${order.orderId} status changed to ${statusLabel}.`;
    const riderBody = isCancel
      ? `Order #${order.orderId} has been cancelled. Please stop your current task.`
      : `Order #${order.orderId} is now ${statusLabel}.`;

    const commonData = {
      type: isCancel ? "order_cancelled" : "order_status_update",
      orderId: String(order.orderId),
      orderMongoId: String(order._id),
      orderStatus: String(order.orderStatus),
    };

    if (order.userId) {
      await notifyOwnerSafely(
        { ownerType: "USER", ownerId: order.userId },
        {
          title,
          body: userBody,
          image: branding.image,
          data: {
            ...commonData,
            link: `/food/user/orders/${order._id}`,
          },
        },
      );
    }
    if (order.restaurantId) {
      await notifyOwnerSafely(
        { ownerType: "RESTAURANT", ownerId: order.restaurantId },
        { title, body: restaurantBody, image: branding.image, data: commonData },
      );
    }
    const riderId =
      order.dispatch?.deliveryPartnerId?.toString?.() ||
      order.dispatch?.deliveryPartnerId;
    if (riderId) {
      await notifyOwnerSafely(
        { ownerType: "DELIVERY_PARTNER", ownerId: riderId },
        {
          title,
          body: riderBody,
          image: branding.image,
          data: {
            ...commonData,
            audience: "delivery",
            link: "/food/delivery",
          },
        },
      );
    }
  } catch (err) {
    logger.warn(`updateOrderStatusAdmin notify failed: ${err?.message || err}`);
  }

  // Emit the same canonical realtime event so all panels converge.
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        title: `Order ${order.orderId} updated`,
        message: `Status changed to ${String(order.orderStatus).replace(/_/g, " ")}`,
      };
      if (order.userId) io.to(rooms.user(order.userId)).emit("order_status_update", payload);
      if (order.restaurantId) io.to(rooms.restaurant(order.restaurantId)).emit("order_status_update", payload);
      if (String(order.orderStatus).includes("cancel")) {
        if (order.dispatch?.deliveryPartnerId) {
          io.to(rooms.delivery(order.dispatch.deliveryPartnerId)).emit("order_cancelled", payload);
        }
        for (const leg of order.dispatchPlan?.legs || []) {
          if (leg?.deliveryPartnerId) {
            io.to(rooms.delivery(leg.deliveryPartnerId)).emit("order_cancelled", payload);
          }
        }
      }
    }
  } catch (err) {
    logger.warn(`updateOrderStatusAdmin socket emit failed: ${err?.message || err}`);
  }

  enqueueOrderEvent("admin_order_status_updated", {
    orderMongoId: order._id?.toString?.(),
    orderId: order.orderId,
    adminId,
    from,
    to: order.orderStatus,
  });

  return order.toObject();
}

/**
 * Manually re-trigger delivery partner search for a restaurant order.
 * Only allowed if status is preparing/ready and no partner has accepted yet.
 */
export async function resendDeliveryNotificationRestaurant(orderId, restaurantId) {
    const order = await FoodOrder.findOne({
        _id: new mongoose.Types.ObjectId(orderId),
        restaurantId: new mongoose.Types.ObjectId(restaurantId)
    });

    if (!order) throw new NotFoundError('Order not found');

    // Only allow if order is still active and not already terminal
    const activeStatuses = ['confirmed', 'preparing', 'ready_for_pickup', 'ready'];
    if (!activeStatuses.includes(order.orderStatus)) {
        throw new ValidationError(`Cannot resend notification for order in status: ${order.orderStatus}`);
    }

    // Guard: don't disrupt an active assignment that was already accepted
    if (order.dispatch?.status === 'accepted') {
        throw new ValidationError('A delivery partner has already accepted this order.');
    }

    // Reset dispatch state to unassigned to allow tryAutoAssign to start fresh
    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = null;
    // Clear previously offered partners to give everyone a fresh chance when resending manually.
    order.dispatch.offeredTo = [];
    
    await order.save();

    if (isSplitDispatchOrder(order)) {
        await notifySplitDispatchOffers(order);
    } else {
        // Trigger smart dispatch logic immediately
        const { tryAutoAssign } = await import('./order-dispatch.service.js');
        const dispatchRes = await tryAutoAssign(order._id, { attempt: 3 });
        return { 
          success: true, 
          notifiedCount: dispatchRes?.notifiedCount || 0 
        };
    }

    return { success: true };
}

export async function getCurrentTripDelivery(deliveryPartnerId) {
  if (!deliveryPartnerId) throw new ValidationError("Delivery partner ID required");

  const activeReturn = await returnPickupDelivery.getCurrentReturnPickupTrip(deliveryPartnerId);
  if (activeReturn) return activeReturn;

  const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  
  // Find the active order assigned to or accepted by this rider.
  const order = await FoodOrder.findOne({
    $or: [
      { "dispatch.deliveryPartnerId": partnerId },
      { "dispatchPlan.legs": { $elemMatch: { deliveryPartnerId: partnerId } } },
    ],
    orderStatus: {
      $in: ["confirmed", "preparing", "ready_for_pickup", "picked_up", "reached_pickup", "reached_drop"]
    }
  })
    .populate({ path: "restaurantId", select: "restaurantName name phone location addressLine1 area city state profileImage" })
    .populate({ path: "userId", select: "name phone gender" })
    .sort({ updatedAt: -1 })
    .lean();

  if (!order) return null;
  return buildDeliveryOrderView(order, deliveryPartnerId, {
    assignedDispatchLeg: getAssignedDispatchLeg(order, deliveryPartnerId),
  });
}

// ----- Delivery: available, accept, reject, status -----
export async function listOrdersAvailableDelivery(deliveryPartnerId, query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const partnerObjectId = new mongoose.Types.ObjectId(deliveryPartnerId);
  const filter = {
    $or: [
      {
        "dispatch.status": "unassigned",
        orderStatus: { $in: ["confirmed", "preparing", "ready_for_pickup"] },
      },
      {
        "dispatch.deliveryPartnerId": partnerObjectId,
        orderStatus: {
          $nin: [
            "delivered",
            "cancelled_by_user",
            "cancelled_by_restaurant",
            "cancelled_by_admin",
          ],
        },
      },
      {
        "dispatchPlan.legs": {
          $elemMatch: {
            deliveryPartnerId: partnerObjectId,
          },
        },
        orderStatus: {
          $nin: [
            "delivered",
            "cancelled_by_user",
            "cancelled_by_restaurant",
            "cancelled_by_admin",
          ],
        },
      },
      {
        "dispatchPlan.legs": {
          $elemMatch: {
            deliveryPartnerId: null,
            partnerCandidates: {
              $elemMatch: {
                partnerId: partnerObjectId,
              },
            },
          },
        },
        orderStatus: {
          $nin: [
            "delivered",
            "cancelled_by_user",
            "cancelled_by_restaurant",
            "cancelled_by_admin",
          ],
        },
      },
    ],
  };

  const orders = await FoodOrder.find(filter)
    .sort({ createdAt: -1 })
    .populate("userId", "name phone email gender")
    .populate("restaurantId", "restaurantName name address phone ownerPhone location profileImage")
    .lean();

  const docs = [];
  for (const order of orders) {
    const assignedLeg = getAssignedDispatchLeg(order, deliveryPartnerId);
    const assignedWholeOrder =
      toIdString(order?.dispatch?.deliveryPartnerId) === toIdString(deliveryPartnerId);
    const eligibleLegs = isSplitDispatchOrder(order)
      ? getEligibleDispatchLegs(order, deliveryPartnerId)
      : [];
    const isMarketplaceOrder = isSplitDispatchOrder(order)
      ? eligibleLegs.length > 0
      : order?.dispatch?.status === "unassigned" &&
        ["confirmed", "preparing", "ready_for_pickup"].includes(order?.orderStatus);

    if (assignedLeg) {
      docs.push(
        buildDeliveryOrderView(order, deliveryPartnerId, {
          assignedDispatchLeg: assignedLeg,
          dispatchLeg: assignedLeg,
        }),
      );
      continue;
    }

    if (isSplitDispatchOrder(order)) {
      if (!isMarketplaceOrder) continue;
      for (const leg of eligibleLegs) {
        docs.push(
          buildDeliveryOrderView(order, deliveryPartnerId, {
            dispatchLeg: leg,
          }),
        );
      }
      continue;
    }

    if (isMarketplaceOrder || assignedWholeOrder) {
      docs.push(buildDeliveryOrderView(order, deliveryPartnerId));
    }
  }

  const returnPickups = await returnPickupDelivery.listAvailableReturnPickups(
    deliveryPartnerId,
    { page: 1, limit: 100 },
  );
  const mergedDocs = [...docs, ...(returnPickups?.docs || returnPickups?.items || [])];

  return buildPaginatedResult({
    docs: mergedDocs.slice(skip, skip + limit),
    total: mergedDocs.length,
    page,
    limit,
  });
}
export async function acceptOrderDelivery(orderId, deliveryPartnerId, body = {}) {
  const documentType = await resolveDeliveryDocumentType(orderId, body);
  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return returnPickupDelivery.acceptReturnPickupDelivery(orderId, deliveryPartnerId, body);
  }

  const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    orderStatus: {
      $nin: [
        "delivered",
        "cancelled_by_user",
        "cancelled_by_restaurant",
        "cancelled_by_admin",
      ],
    },
    $or: [
      { "dispatch.status": "unassigned" },
      { "dispatch.deliveryPartnerId": partnerId },
      { "dispatchPlan.legs": { $elemMatch: { deliveryPartnerId: partnerId } } },
      {
        "dispatchPlan.legs": {
          $elemMatch: {
            deliveryPartnerId: null,
            partnerCandidates: {
              $elemMatch: {
                partnerId,
              },
            },
          },
        },
      },
    ],
  });

  if (!order) throw new NotFoundError("Order not found");

  if (
    !["confirmed", "preparing", "ready_for_pickup", "picked_up"].includes(
      order.orderStatus,
    )
  ) {
    throw new ValidationError("Order not ready for delivery assignment");
  }

  // Prevent COD accept when order collect amount exceeds remaining cash limit
  await assertDeliveryPartnerCodHeadroom(deliveryPartnerId, order);

  if (isSplitDispatchOrder(order)) {
    const requestedLegId = String(body?.legId || "").trim();
    const { updatedOrder, claimedLegId } = await claimSplitDispatchLegAtomically(
      order,
      deliveryPartnerId,
      requestedLegId,
    );

    if (!updatedOrder) {
      throw new NotFoundError("Order not found");
    }

    const targetLeg = (updatedOrder.dispatchPlan?.legs || []).find(
      (leg) =>
        String(leg?.legId || "") === String(claimedLegId || "") &&
        toIdString(leg?.deliveryPartnerId) === toIdString(deliveryPartnerId),
    );

    if (!targetLeg) {
      throw new ValidationError("No dispatch leg is currently available for this rider");
    }

    const assignedLegCount = (updatedOrder.dispatchPlan?.legs || []).filter((leg) =>
      toIdString(leg.deliveryPartnerId),
    ).length;

    const nextDispatchStatus =
      assignedLegCount >= (updatedOrder.dispatchPlan?.legs || []).length
        ? "accepted"
        : "assigned";
    const previousDispatchStatus = updatedOrder.dispatch?.status || "unassigned";

    updatedOrder.dispatch.status = nextDispatchStatus;
    updatedOrder.dispatch.assignedAt = updatedOrder.dispatch.assignedAt || new Date();
    if (nextDispatchStatus === "accepted") {
      updatedOrder.dispatch.acceptedAt = updatedOrder.dispatch.acceptedAt || new Date();
    }

    if (previousDispatchStatus !== nextDispatchStatus) {
      pushStatusHistory(updatedOrder, {
        byRole: "DELIVERY_PARTNER",
        byId: deliveryPartnerId,
        from: previousDispatchStatus,
        to: nextDispatchStatus,
        note: `Accepted split dispatch leg ${targetLeg.legId}`,
      });
    }

    emitOrderClaimedToOtherPartners(updatedOrder, {
      acceptedBy: deliveryPartnerId,
      legId: targetLeg.legId,
      candidatePartnerIds: (targetLeg.partnerCandidates || []).map(
        (candidate) => candidate?.partnerId,
      ),
    });

    await updatedOrder.save();
    return getOrderById(updatedOrder._id, { deliveryPartnerId });
  }

  const wasUnassigned =
    order.dispatch?.status === "unassigned" ||
    !order.dispatch?.deliveryPartnerId;
  if (
    !wasUnassigned &&
    order.dispatch.deliveryPartnerId?.toString() !==
      deliveryPartnerId.toString()
  ) {
    throw new ForbiddenError("Not your order");
  }

  const from = order.dispatch?.status || "unassigned";
  order.dispatch.deliveryPartnerId = partnerId;
  order.dispatch.status = "accepted";
  if (!order.dispatch.assignedAt) order.dispatch.assignedAt = new Date();
  order.dispatch.acceptedAt = new Date();
  // Rider now heading to restaurant — start Instant delivery phase.
  if (!order.deliveryState || typeof order.deliveryState !== "object") {
    order.deliveryState = {};
  }
  if (
    !order.deliveryState.currentPhase ||
    order.deliveryState.currentPhase === "waiting_activation"
  ) {
    order.deliveryState.currentPhase = "en_route_to_pickup";
  }
  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: deliveryPartnerId,
    from,
    to: "accepted",
  });

  emitOrderClaimedToOtherPartners(order, {
    acceptedBy: deliveryPartnerId,
    candidatePartnerIds: [
      ...(order.dispatch?.offeredTo || []).map((entry) => entry?.partnerId),
    ],
  });

  await order.save();
  await order.populate('restaurantId');

  try {
      const rest = order.restaurantId;
      const userLoc = order.deliveryAddress?.location?.coordinates;
      const restLoc = rest?.location?.coordinates;

      if (restLoc?.[0] && userLoc?.[0]) {
          const polyline = await fetchPolyline(
              { lat: restLoc[1], lng: restLoc[0] },
              { lat: userLoc[1], lng: userLoc[0] }
          );

          const db = getFirebaseDB();
          if (db) {
              const orderRef = db.ref(`active_orders/${order.orderId}`);
              await orderRef.set({
                  polyline,
                  lat: restLoc[1],
                  lng: restLoc[0],
                  boy_lat: restLoc[1],
                  boy_lng: restLoc[0],
                  restaurant_lat: restLoc[1],
                  restaurant_lng: restLoc[0],
                  customer_lat: userLoc[1],
                  customer_lng: userLoc[0],
                  status: 'accepted',
                  last_updated: Date.now()
              }).catch(e => logger.error(`Firebase orderRef set error: ${e.message}`));
          }
      }
  } catch (err) {
      logger.error(`Error initializing Firebase order tracking: ${err.message}`);
  }

  await foodTransactionService.updateTransactionRider(order._id, deliveryPartnerId);

  try {
    const io = getIO();
    if (io) {
      io.to(rooms.delivery(deliveryPartnerId)).emit("order_status_update", {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        dispatchStatus: order.dispatch?.status,
      });
      io.to(rooms.restaurant(order.restaurantId)).emit("order_status_update", {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        dispatchStatus: order.dispatch?.status,
      });
      io.to(rooms.user(order.userId)).emit("order_status_update", {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        dispatchStatus: order.dispatch?.status,
      });
    }
  } catch (e) {
    logger.warn(`Socket emit on acceptOrderDelivery failed: ${e?.message || e}`);
  }

  enqueueOrderEvent("delivery_assigned", {
    orderMongoId: order._id?.toString?.(),
    orderId: order.orderId,
    deliveryPartnerId,
    dispatchStatus: order.dispatch?.status,
  });

  return getOrderById(order._id, { deliveryPartnerId });
}
export async function rejectOrderDelivery(orderId, deliveryPartnerId, body = {}) {
    const documentType = await resolveDeliveryDocumentType(orderId, body);
    if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
      return returnPickupDelivery.rejectReturnPickupDelivery(orderId, deliveryPartnerId);
    }

    const identity = buildOrderIdentityFilter(orderId);
    if (!identity) throw new ValidationError('Order id required');
    const order = await FoodOrder.findOne(identity);
    if (!order) throw new NotFoundError('Order not found');

    if (isSplitDispatchOrder(order)) {
      const assignedLeg = getAssignedDispatchLeg(order, deliveryPartnerId);
      if (!assignedLeg) throw new ForbiddenError('No split dispatch leg assigned to you');

      assignedLeg.deliveryPartnerId = null;
      assignedLeg.assignedAt = null;
      assignedLeg.partnerCandidates = (assignedLeg.partnerCandidates || []).filter(
        (candidate) => toIdString(candidate?.partnerId) !== toIdString(deliveryPartnerId),
      );

      const assignedLegCount = (order.dispatchPlan?.legs || []).filter((leg) =>
        toIdString(leg.deliveryPartnerId),
      ).length;

      order.dispatch.status = assignedLegCount > 0 ? 'assigned' : 'unassigned';
      if (!assignedLegCount) {
        order.dispatch.assignedAt = undefined;
        order.dispatch.acceptedAt = undefined;
      }

      pushStatusHistory(order, {
        byRole: 'DELIVERY_PARTNER',
        byId: deliveryPartnerId,
        from: 'assigned',
        to: order.dispatch.status,
        note: `Rejected split dispatch leg ${assignedLeg.legId}`,
      });
      await order.save();
      return getOrderById(order._id, { deliveryPartnerId });
    }

    if (order.dispatch.deliveryPartnerId?.toString() !== deliveryPartnerId.toString()) throw new ForbiddenError('Not your order');
    
    const offer = order.dispatch.offeredTo.find(o => String(o.partnerId) === String(deliveryPartnerId) && o.action === 'offered');
    if (offer) offer.action = 'rejected';

    order.dispatch.status = 'unassigned';
    order.dispatch.deliveryPartnerId = undefined;
    order.dispatch.assignedAt = undefined;
    order.dispatch.acceptedAt = undefined;
    pushStatusHistory(order, { byRole: 'DELIVERY_PARTNER', byId: deliveryPartnerId, from: 'assigned', to: 'unassigned', note: 'Rejected' });
    await order.save();
    
    enqueueOrderEvent('delivery_rejected', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId
    });

    void tryAutoAssign(order._id).catch(err => logger.error(`SmartDispatch: Auto-assign after reject failed: ${err.message}`));

    return order.toObject();
}
export async function confirmReachedPickupDelivery(orderId, deliveryPartnerId, body = {}) {
  const documentType = await resolveDeliveryDocumentType(orderId, body);
  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return returnPickupDelivery.confirmReachedPickupReturn(orderId, deliveryPartnerId);
  }

  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");
  if (!isOrderAssignedToDeliveryPartner(order, deliveryPartnerId)) {
    throw new ForbiddenError("Not your order");
  }
  if (order.orderStatus === "delivered")
    throw new ValidationError("Order already delivered");

  // Idempotent: if already at/after pickup, keep success.
  const currentPhase = order.deliveryState?.currentPhase || "";
  const currentStatus = order.deliveryState?.status || "";
  if (currentPhase === "at_pickup" || currentStatus === "reached_pickup") {
    return order.toObject();
  }

  const from = currentStatus || currentPhase || order.orderStatus;
  order.deliveryState = {
    ...(order.deliveryState?.toObject?.() || order.deliveryState || {}),
    currentPhase: "at_pickup",
    status: "reached_pickup",
    reachedPickupAt: order.deliveryState?.reachedPickupAt || new Date(),
  };
  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: deliveryPartnerId,
    from,
    to: "reached_pickup",
    note: "Reached pickup location",
  });
  await order.save();

  // Socket + status-specific push (not "delivered")
  emitOrderUpdate(order, deliveryPartnerId);

  // Notify Restaurant about rider arrival (inbox + FCM)
  try {
    const partner = await FoodDeliveryPartner.findById(deliveryPartnerId).select("name").lean();
    const branding = await getGlobalBranding();
    await notifyOwnersSafely(
      [{ ownerType: "RESTAURANT", ownerId: order.restaurantId }],
      {
        title: "Rider Arrived! 🛵",
        body: `${partner?.name || "The delivery partner"} has arrived at your restaurant to pick up Order #${order.orderId}.`,
        image: branding.image,
        data: {
          type: "rider_arrived",
          orderId: String(order.orderId),
          orderMongoId: String(order._id),
          partnerName: partner?.name || "",
        },
      },
    );
  } catch (err) {
    logger.warn(`Error notifying restaurant about rider arrival: ${err?.message || err}`);
  }

    enqueueOrderEvent('reached_pickup', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId,
        orderStatus: order.orderStatus,
        deliveryPhase: order.deliveryState?.currentPhase,
        deliveryStatus: order.deliveryState?.status
    });
    return order.toObject();
}

/**
 * Slide to confirm pickup (Bill uploaded)
 */
export async function confirmPickupDelivery(
  orderId,
  deliveryPartnerId,
  billImageUrl,
  body = {},
) {
  const mergedBody = { ...body, billImageUrl: billImageUrl || body?.billImageUrl };
  const documentType = await resolveDeliveryDocumentType(orderId, mergedBody);
  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return returnPickupDelivery.confirmPickupReturn(orderId, deliveryPartnerId, mergedBody);
  }

  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");
  if (!isOrderAssignedToDeliveryPartner(order, deliveryPartnerId)) {
    throw new ForbiddenError("Not your order");
  }

  const from = order.orderStatus;
  order.orderStatus = "picked_up";
  order.deliveryState = {
    ...(order.deliveryState?.toObject?.() || order.deliveryState || {}),
    currentPhase: "en_route_to_delivery",
    status: "picked_up",
    pickedUpAt: new Date(),
    billImageUrl,
  };
  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: deliveryPartnerId,
    from,
    to: "picked_up",
    note: "Order picked up",
  });
  await order.save();

    emitOrderUpdate(order, deliveryPartnerId);
    enqueueOrderEvent('picked_up', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId,
        billImageUrl: billImageUrl || null
    });
    return order.toObject();
}

export async function confirmReachedDropDelivery(orderId, deliveryPartnerId, body = {}) {
  const documentType = await resolveDeliveryDocumentType(orderId, body);
  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return returnPickupDelivery.confirmReachedDropReturn(orderId, deliveryPartnerId);
  }

  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity).select("+deliveryOtp");
  if (!order) throw new NotFoundError("Order not found");
  if (!isOrderAssignedToDeliveryPartner(order, deliveryPartnerId)) {
    throw new ForbiddenError("Not your order");
  }

  if (order.deliveryVerification?.dropOtp?.verified) {
    emitOrderUpdate(order, deliveryPartnerId);
    return sanitizeOrderForExternal(await resolveOrderWithCustomerGender(order));
  }

  const alreadyAtDrop =
    order.deliveryState?.currentPhase === "at_drop" ||
    order.deliveryState?.status === "reached_drop";
  const fromPhase =
    order.deliveryState?.status ||
    order.deliveryState?.currentPhase ||
    order.orderStatus ||
    "";

  const existingOtp = String(order.deliveryOtp || "").trim();
  if (!alreadyAtDrop || !existingOtp) {
    order.deliveryOtp = generateFourDigitDeliveryOtp();
    order.deliveryVerification = {
      ...(order.deliveryVerification?.toObject?.() ||
        order.deliveryVerification ||
        {}),
      dropOtp: { required: true, verified: false },
    };
  }

  order.deliveryState = {
    ...(order.deliveryState?.toObject?.() || order.deliveryState || {}),
    currentPhase: "at_drop",
    status: "reached_drop",
    reachedDropAt: order.deliveryState?.reachedDropAt || new Date(),
  };

  if (!alreadyAtDrop) {
    pushStatusHistory(order, {
      byRole: "DELIVERY_PARTNER",
      byId: deliveryPartnerId,
      from: fromPhase,
      to: "reached_drop",
      note: "Reached drop location",
    });
  }

  await order.save();

    const plainOtp = String(order.deliveryOtp || '').trim();
    emitDeliveryDropOtpToUser(order, plainOtp);
    emitOrderUpdate(order, deliveryPartnerId);
    enqueueOrderEvent('reached_drop', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId,
        dropOtpRequired: order.deliveryVerification?.dropOtp?.required ?? true,
        dropOtpVerified: order.deliveryVerification?.dropOtp?.verified ?? false
    });
    return sanitizeOrderForExternal(await resolveOrderWithCustomerGender(order));
}

export async function verifyDropOtpDelivery(orderId, deliveryPartnerId, otp) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne(identity).select("+deliveryOtp");
  if (!order) throw new NotFoundError("Order not found");
  if (!isOrderAssignedToDeliveryPartner(order, deliveryPartnerId)) {
    throw new ForbiddenError("Not your order");
  }

  const otpStr = String(otp || "").trim();
  if (!otpStr) throw new ValidationError("OTP is required");

  if (!order.deliveryVerification?.dropOtp?.required) {
    throw new ValidationError(
      "OTP verification is not active for this order. Confirm reached drop first.",
    );
  }
  if (order.deliveryVerification?.dropOtp?.verified) {
    return { order: await resolveOrderWithCustomerGender(order).then(sanitizeOrderForExternal) };
  }

  const expected = String(order.deliveryOtp || "").trim();
  if (!expected || expected !== otpStr) {
    throw new ValidationError(
      "Invalid OTP. Ask the customer for the code shown in their app.",
    );
  }

  // Use direct path assignment for robustness in Mongoose change detection
  if (!order.deliveryVerification) order.deliveryVerification = { dropOtp: {} };
  order.deliveryVerification.dropOtp.verified = true;
  order.markModified('deliveryVerification.dropOtp.verified');
  
  order.deliveryOtp = "";
  await order.save();

    emitOrderUpdate(order, deliveryPartnerId);
    enqueueOrderEvent('drop_otp_verified', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId
    });
    return { order: await resolveOrderWithCustomerGender(order).then(sanitizeOrderForExternal) };
}

export async function completeDelivery(orderId, deliveryPartnerId, body = {}) {
  const documentType = await resolveDeliveryDocumentType(orderId, body);
  if (documentType === DISPATCH_DOCUMENT_TYPES.SELLER_RETURN) {
    return returnPickupDelivery.completeReturnPickup(orderId, deliveryPartnerId, body);
  }

  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");
  if (!isOrderAssignedToDeliveryPartner(order, deliveryPartnerId)) {
    throw new ForbiddenError("Not your order");
  }

  const { otp, ratings, paymentMode } = body;

  // Only unpaid COD flows may switch collection mode at delivery.
  // Never rewrite wallet / Razorpay method after prepaid capture.
  const existingPayMethod = String(order.payment?.method || "").trim().toLowerCase();
  const existingPayStatus = String(order.payment?.status || "").trim().toLowerCase();
  const isPrepaidCaptured =
    ["wallet", "razorpay", "razorpay_qr"].includes(existingPayMethod) &&
    ["paid", "refunded"].includes(existingPayStatus);
  if (!isPrepaidCaptured) {
    if (paymentMode === "cash") {
      order.payment.method = "cash";
    } else if (paymentMode === "qr") {
      order.payment.method = "razorpay_qr";
    }
  }

  if (
    order.deliveryVerification?.dropOtp?.required &&
    !order.deliveryVerification?.dropOtp?.verified && 
    !otp // Only throw if OTP is not provided here as fallback
  ) {
    throw new ValidationError(
      "Customer handover OTP is required. Verify the OTP from the customer before completing delivery.",
    );
  }

  const from = order.orderStatus;
  const prevPayStatus = order.payment.status;
  const payMethod = order.payment.method;

  // Security gate: only complete QR delivery after Razorpay payment-link is actually paid.
  // This enables frontend auto-complete after QR success.
  if (payMethod === "razorpay_qr") {
    // syncRazorpayQrPayment is a helper presumed present in this service context
    if (typeof syncRazorpayQrPayment === 'function') await syncRazorpayQrPayment(order);
    if (order.payment.status !== "paid") {
      throw new ValidationError("QR payment not verified yet");
    }
  }

  order.orderStatus = "delivered";
  order.financialsLocked = true;
  order.financialsLockedAt = order.financialsLockedAt || new Date();
  // Mark COD / unpaid collection as paid on delivery; prepaid stays paid/refunded as-is.
  if (!["paid", "refunded"].includes(String(order.payment?.status || "").trim().toLowerCase())) {
    order.payment.status = "paid";
  } else if (["cash", "cod", "cash_on_delivery", "razorpay_qr"].includes(String(payMethod || "").toLowerCase())) {
    order.payment.status = "paid";
  }
  order.deliveryState = {
    ...(order.deliveryState?.toObject?.() || order.deliveryState || {}),
    currentPhase: "delivered",
    status: "delivered",
    deliveredAt: new Date(),
  };

  if (ratings) {
    order.ratings = {
       ...(order.ratings?.toObject?.() || order.ratings || {}),
       ...ratings
    };
  }

  pushStatusHistory(order, {
    byRole: "DELIVERY_PARTNER",
    byId: deliveryPartnerId,
    from,
    to: "delivered",
    note: "Delivery completed successfully",
  });

  await order.save();
  const ledgerKind =
    payMethod === "cash" && prevPayStatus === "cod_pending"
      ? "cod_marked_paid_on_delivery"
      : "payment_snapshot_sync";

  await foodTransactionService.updateTransactionStatus(order._id, ledgerKind, {
    status: 'captured',
    recordedByRole: "DELIVERY_PARTNER",
    recordedById: deliveryPartnerId,
    note: `Delivery completed. Prev status: ${prevPayStatus}`
  });

  // Restaurant Quick Share → settlement component only (never restaurant wallet).
  // Idempotent; no-op when share is 0 / missing (historical orders).
  try {
    await foodTransactionService.realizeFoodQuickRestaurantShare(order);
  } catch (err) {
    logger.warn(
      `[QuickFinance] realize restaurant share failed for ${order.orderId || order._id}: ${err?.message || err}`,
    );
  }

  await consumeOrderCouponUsageOnDelivery(order, order.userId);
  emitOrderUpdate(order, deliveryPartnerId);
  enqueueOrderEvent('delivery_completed', {
      orderMongoId: order._id?.toString?.(),
      orderId: order.orderId,
      deliveryPartnerId,
      payMethod,
      prevPayStatus,
      paymentStatus: order.payment?.status,
      riderEarning: Number(order.riderEarning || 0),
      platformProfit: Number(order.platformProfit || 0),
      paymentMethod: payMethod,
  });
  return sanitizeOrderForExternal(await resolveOrderWithCustomerGender(order));
}

function emitOrderUpdate(order, deliveryPartnerId) {
  try {
    const io = getIO();
    if (io) {
      const dv =
        order.deliveryVerification?.toObject?.() || order.deliveryVerification;
      const payload = toOrderStatusSocketDto(order, {
        deliveryVerification: dv
          ? {
              dropOtp: {
                required: Boolean(dv?.dropOtp?.required),
                verified: Boolean(dv?.dropOtp?.verified),
              },
            }
          : undefined,
      });
      io.to(rooms.delivery(deliveryPartnerId)).emit(
        "order_status_update",
        payload,
      );
      io.to(rooms.restaurant(order.restaurantId)).emit(
        "order_status_update",
        payload,
      );
      io.to(rooms.user(order.userId)).emit("order_status_update", payload);
    }

    const deliveryStatus = String(
      order.deliveryState?.status || order.orderStatus || "",
    ).toLowerCase();
    const orderStatus = String(order.orderStatus || "").toLowerCase();
    const isDelivered =
      orderStatus === "delivered" || deliveryStatus === "delivered";
    const orderId = order.orderId;
    const orderMongoId = order._id?.toString?.() || "";
    const baseData = {
      type: "order_status_update",
      orderId,
      orderMongoId,
      orderStatus: isDelivered ? "delivered" : deliveryStatus || orderStatus,
    };

    // Intermediate delivery steps — status-specific pushes (never claim "delivered")
    if (!isDelivered) {
      if (deliveryStatus === "picked_up") {
        void notifyOwnersSafely(
          [{ ownerType: "USER", ownerId: order.userId }],
          {
            title: `Order #${orderId} picked up`,
            body: "Your order is on the way to you.",
            data: { ...baseData, orderStatus: "picked_up" },
          },
        );
        void notifyOwnersSafely(
          [{ ownerType: "RESTAURANT", ownerId: order.restaurantId }],
          {
            title: `Order #${orderId} picked up`,
            body: "Rider has picked up the order from your restaurant.",
            data: { ...baseData, orderStatus: "picked_up" },
          },
        );
      } else if (deliveryStatus === "reached_drop") {
        void notifyOwnersSafely(
          [{ ownerType: "USER", ownerId: order.userId }],
          {
            title: `Rider nearby — Order #${orderId}`,
            body: "Your delivery partner has reached your location. Share the OTP to complete delivery.",
            data: { ...baseData, orderStatus: "reached_drop" },
          },
        );
      }
      // reached_pickup restaurant notify is handled in confirmReachedPickupDelivery
      // drop_otp_verified: socket-only (no extra push spam)
      return;
    }

    // Real delivered only
    let riderTitle = "Order delivered! 🏁";
    let riderBody = `Order #${orderId} has been marked as delivered.`;
    if (order.payment?.method === "cash") {
      riderTitle = "Payment Collected! 💵";
      riderBody = `You have collected ₹${order.pricing?.total || 0} cash for Order #${orderId}.`;
    }

    void notifyOwnersSafely(
      [
        { ownerType: "RESTAURANT", ownerId: order.restaurantId },
        { ownerType: "USER", ownerId: order.userId },
      ],
      {
        title: `Order #${orderId} delivered! ✅`,
        body: "Hope you enjoyed your meal!",
        data: {
          ...baseData,
          orderStatus: "delivered",
        },
      },
    );

    void notifyOwnerSafely(
      { ownerType: "DELIVERY_PARTNER", ownerId: deliveryPartnerId },
      {
        title: riderTitle,
        body: riderBody,
        data: {
          type: "order_completed",
          orderId,
          orderMongoId,
          paymentMethod: order.payment?.method,
          amountCollected: String(order.pricing?.total || 0),
        },
      },
    );
  } catch (e) {
    console.error("Error emitting order update:", e);
  }
}

export async function updateOrderStatusDelivery(orderId, deliveryPartnerId, orderStatus) {
    const identity = buildOrderIdentityFilter(orderId);
    if (!identity) throw new ValidationError('Order id required');
    const order = await FoodOrder.findOne(identity);
    if (!order) throw new NotFoundError('Order not found');
    if (order.dispatch.deliveryPartnerId?.toString() !== deliveryPartnerId.toString()) throw new ForbiddenError('Not your order');
    const from = order.orderStatus;
    order.orderStatus = orderStatus;
    if (String(orderStatus).toLowerCase() === 'delivered') {
        order.financialsLocked = true;
        order.financialsLockedAt = order.financialsLockedAt || new Date();
    }
    pushStatusHistory(order, { byRole: 'DELIVERY_PARTNER', byId: deliveryPartnerId, from, to: orderStatus });
    await order.save();
    if (String(orderStatus).toLowerCase() === 'delivered') {
        await consumeOrderCouponUsageOnDelivery(order, order.userId);
    }
    enqueueOrderEvent('delivery_status_updated', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId,
        from,
        to: orderStatus
    });
    return order.toObject();
}

// ----- COD QR collection -----
export async function createCollectQr(
  orderId,
  deliveryPartnerId,
  customerInfo = {},
) {
  const query = mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId };
  const order = await FoodOrder.findOne(query)
    .populate("userId", "name email phone")
    .lean();
  if (!order) throw new NotFoundError("Order not found");
  if (
    order.dispatch.deliveryPartnerId?.toString() !==
    deliveryPartnerId.toString()
  )
    throw new ForbiddenError("Not your order");
  if (order.payment.method !== "cash" && order.payment.status === "paid")
    throw new ValidationError("Order already paid");
  if (
    order.financialsLocked ||
    String(order.orderStatus || "").toLowerCase() === "delivered"
  ) {
    throw new ValidationError("Order financials are locked after delivery");
  }
  const amountDue = order.payment.amountDue ?? order.pricing?.total ?? 0;
  if (amountDue < 1) throw new ValidationError("No amount due");

  if (!isRazorpayConfigured())
    throw new ValidationError("QR payment not configured");

  const amountPaise = Math.round(amountDue * 100);
  const user = order.userId || {};
  const link = await createPaymentLink({
    amountPaise,
    currency: "INR",
    description: `Order ${order.orderId} - COD collect`,
    orderId: order.orderId,
    customerName: customerInfo.name || user.name || "Customer",
    customerEmail: customerInfo.email || user.email || "customer@example.com",
    customerPhone: customerInfo.phone || user.phone,
  });

  // Conditional update so concurrent delivery finish cannot rewrite locked financials.
  const qrWrite = await FoodOrder.updateOne(
    {
      _id: order._id,
      financialsLocked: { $ne: true },
      orderStatus: { $ne: "delivered" },
    },
    {
      $set: {
        "payment.method": "razorpay_qr",
        "payment.status": "pending_qr",
        "payment.qr": {
          paymentLinkId: link.id,
          shortUrl: link.short_url,
          imageUrl: link.short_url,
          status: link.status || "created",
          expiresAt: link.expire_by ? new Date(link.expire_by * 1000) : null,
        },
      },
    },
  );
  if (!qrWrite?.modifiedCount) {
    throw new ValidationError("Order financials are locked after delivery");
  }

    const updated = await FoodOrder.findById(order._id).select('orderId restaurantId userId riderEarning payment pricing').lean();
    if (updated) {
        await foodTransactionService.updateTransactionStatus(order._id, 'cod_collect_qr_created', {
            recordedByRole: 'DELIVERY_PARTNER',
            recordedById: deliveryPartnerId,
            note: 'COD collection QR created'
        });
    }

    enqueueOrderEvent('collect_qr_created', {
        orderMongoId: String(orderId),
        orderId: updated?.orderId || null,
        deliveryPartnerId,
        paymentLinkId: link.id,
        shortUrl: link.short_url,
        amountDue
    });

  // IMPORTANT: return QR payload so frontend can render "Generate QR" / "Show QR".
  const shortUrl =
    link?.short_url ?? link?.shortUrl ?? link?.short_url_path ?? null;
  const imageUrl =
    link?.short_url ??
    link?.image_url ??
    link?.imageUrl ??
    link?.image ??
    null;

  return {
    shortUrl,
    imageUrl,
    amount: amountDue,
    expiresAt:
      link?.expire_by
        ? new Date(link.expire_by * 1000)
        : link?.expiresAt
          ? new Date(link.expiresAt)
          : null,
  };
}

/**
 * Razorpay QR auto-verify:
 * - Fetch payment-link status from Razorpay
 * - Update `order.payment.status` to `paid` when Razorpay marks it paid
 * - Update `order.payment.qr.status` for UI/debugging
 *
 * IMPORTANT: Callers should `await` this before completing delivery.
 */
async function syncRazorpayQrPayment(orderDoc) {
  if (!orderDoc?.payment) return orderDoc?.payment;
  if (orderDoc.payment.method !== "razorpay_qr") return orderDoc.payment;
  if (orderDoc.payment.status === "paid") return orderDoc.payment;

  const paymentLinkId = orderDoc.payment?.qr?.paymentLinkId;
  if (!paymentLinkId) return orderDoc.payment;
  if (!isRazorpayConfigured()) return orderDoc.payment;

  let link;
  try {
    link = await fetchRazorpayPaymentLink(paymentLinkId);
  } catch (err) {
    logger.warn(
      `Razorpay payment-link fetch failed for ${paymentLinkId}: ${
        err?.message || err
      }`
    );
    return orderDoc.payment;
  }

  const linkStatus = String(link?.status || "").toLowerCase();
  if (!linkStatus) return orderDoc.payment;

  // Update QR snapshot status.
  orderDoc.payment.qr = {
    ...(orderDoc.payment.qr?.toObject?.() || orderDoc.payment.qr || {}),
    status: linkStatus,
  };

  // Mark paid only when Razorpay says it's paid/settled.
  if (["paid", "captured", "authorized"].includes(linkStatus)) {
    orderDoc.payment.status = "paid";
    await orderDoc.save();
  } else if (["expired", "cancelled", "canceled", "failed"].includes(linkStatus)) {
    orderDoc.payment.status = "failed";
    await orderDoc.save();
  }

  return orderDoc.payment;
}

export async function getPaymentStatus(orderId, deliveryPartnerId) {
  // Support both short orderId strings and MongoDB _ids.
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity).select(
    "payment dispatch riderEarning platformProfit pricing"
  );
  if (!order) throw new NotFoundError("Order not found");
  if (
    order.dispatch?.deliveryPartnerId?.toString() !==
    deliveryPartnerId.toString()
  )
    throw new ForbiddenError("Not your order");

  // Auto-sync Razorpay QR payment status before returning.
  // syncRazorpayQrPayment calls Razorpay, updates order.payment.status, and saves.
  if (order.payment?.method === "razorpay_qr") {
    await syncRazorpayQrPayment(order);
  }

  const transaction = await FoodTransaction.findOne({ orderId: order._id }).lean();
  const latestHistory = (transaction?.history || []).sort((a, b) => (b.at || 0) - (a.at || 0))[0] || null;

  return {
    payment: {
      ...(order.payment?.toObject?.() || order.payment || {}),
      // Expose the effective status in a flat field for easy frontend reading
      status: order.payment?.status,
    },
    latestPaymentSnapshot: latestHistory,
    riderEarning: order.riderEarning ?? 0,
    platformProfit: order.platformProfit ?? 0,
    pricingTotal: order.pricing?.total ?? 0,
    transactionStatus: transaction?.status ?? null,
  };
}

// ----- Admin -----
const EMPTY_ORDER_REPORT_STATUS_SUMMARY = {
  total: 0,
  Scheduled: 0,
  Pending: 0,
  Accepted: 0,
  Processing: 0,
  "Food On The Way": 0,
  Delivered: 0,
  Canceled: 0,
  "Payment Failed": 0,
  Refunded: 0,
};

const isTruthyQueryFlag = (value) => value === true || value === "true" || value === "1";

async function buildListOrdersAdminFilter(query = {}) {
  const filter = {
    orderType: { $in: ["food", "mixed"] },
    $or: [
      { "payment.method": { $in: ["cash", "wallet"] } },
      { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } },
    ],
  };

  const rawStatus = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
  const cancelledBy = typeof query.cancelledBy === "string" ? query.cancelledBy.trim().toLowerCase() : "";
  const restaurantIdRaw = typeof query.restaurantId === "string" ? query.restaurantId.trim() : "";
  const zoneIdRaw = typeof query.zoneId === "string" ? query.zoneId.trim() : "";
  const userIdRaw = typeof query.userId === "string" ? query.userId.trim() : "";
  const startDateRaw = typeof query.startDate === "string" ? query.startDate.trim() : "";
  const endDateRaw = typeof query.endDate === "string" ? query.endDate.trim() : "";
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const deliveryModeRaw =
    typeof query.deliveryMode === "string" ? query.deliveryMode.trim().toLowerCase() : "";

  if (rawStatus && rawStatus !== "all") {
    switch (rawStatus) {
      case "pending":
        filter.orderStatus = { $in: ["created", "confirmed"] };
        break;
      case "accepted":
        filter.orderStatus = "confirmed";
        break;
      case "processing":
        filter.orderStatus = { $in: ["preparing", "ready_for_pickup"] };
        break;
      case "food-on-the-way":
        filter.orderStatus = "picked_up";
        break;
      case "delivered":
        filter.orderStatus = "delivered";
        break;
      case "canceled":
      case "cancelled":
        filter.orderStatus = {
          $in: [
            "cancelled_by_user",
            "cancelled_by_restaurant",
            "cancelled_by_admin",
            "cancelled_by_system",
          ],
        };
        break;
      case "restaurant-cancelled":
        filter.orderStatus = "cancelled_by_restaurant";
        break;
      case "payment-failed":
        filter["payment.status"] = "failed";
        break;
      case "refunded":
        filter["payment.status"] = "refunded";
        break;
      case "offline-payments":
        filter["payment.method"] = "cash";
        filter.orderStatus = { $in: ["created", "confirmed", "delivered"] };
        break;
      case "scheduled":
        // Prefer current scheduled lifecycle, not historical scheduledAt remnants.
        filter.orderStatus = "scheduled";
        break;
    }
  }

  if (cancelledBy) {
    if (cancelledBy === "restaurant") {
      filter.orderStatus = "cancelled_by_restaurant";
    } else if (cancelledBy === "user" || cancelledBy === "customer") {
      filter.orderStatus = "cancelled_by_user";
    }
  }

  if (restaurantIdRaw && mongoose.Types.ObjectId.isValid(restaurantIdRaw)) {
    filter.restaurantId = new mongoose.Types.ObjectId(restaurantIdRaw);
  }
  if (zoneIdRaw && mongoose.Types.ObjectId.isValid(zoneIdRaw)) {
    filter.zoneId = new mongoose.Types.ObjectId(zoneIdRaw);
  }
  if (userIdRaw && mongoose.Types.ObjectId.isValid(userIdRaw)) {
    filter.userId = new mongoose.Types.ObjectId(userIdRaw);
  }

  if (deliveryModeRaw === "quick" || deliveryModeRaw === "basic") {
    filter.deliveryMode = deliveryModeRaw;
  } else if (deliveryModeRaw === "sla_breached") {
    filter.deliveryMode = "quick";
    filter["sla.breached"] = true;
  }

  if (startDateRaw || endDateRaw) {
    const createdAt = {};
    const start = startDateRaw ? new Date(startDateRaw) : null;
    const end = endDateRaw ? new Date(endDateRaw) : null;
    if (start && !Number.isNaN(start.getTime())) {
      createdAt.$gte = start;
    }
    if (end && !Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      createdAt.$lte = end;
    }
    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }
  }

  if (search) {
    const searchConditions = [{ orderId: { $regex: search, $options: "i" } }];
    const [matchingUsers, matchingRestaurants] = await Promise.all([
      FoodUser.find({ name: { $regex: search, $options: "i" } }).select("_id").lean(),
      FoodRestaurant.find({ restaurantName: { $regex: search, $options: "i" } }).select("_id").lean(),
    ]);

    if (matchingUsers.length > 0) {
      searchConditions.push({ userId: { $in: matchingUsers.map((u) => u._id) } });
    }
    if (matchingRestaurants.length > 0) {
      searchConditions.push({ restaurantId: { $in: matchingRestaurants.map((r) => r._id) } });
    }

    const originalFilter = { ...filter };
    delete filter.$or;
    filter.$and = [{ $or: originalFilter.$or }, { $or: searchConditions }];
  }

  return filter;
}

async function aggregateListOrdersAdminStatusSummary(filter) {
  const rows = await FoodOrder.aggregate([
    { $match: filter },
    {
      $addFields: {
        displayStatus: {
          $switch: {
            branches: [
              { case: { $eq: ["$orderStatus", "scheduled"] }, then: "Scheduled" },
              { case: { $in: ["$orderStatus", [null, "", "created", "placed", "confirmed"]] }, then: "Pending" },
              { case: { $in: ["$orderStatus", ["preparing", "ready_for_pickup"]] }, then: "Processing" },
              { case: { $eq: ["$orderStatus", "picked_up"] }, then: "Food On The Way" },
              { case: { $eq: ["$orderStatus", "delivered"] }, then: "Delivered" },
              { case: { $eq: ["$orderStatus", "cancelled_by_restaurant"] }, then: "Canceled" },
              {
                case: { $in: ["$orderStatus", ["cancelled_by_user", "cancelled_by_admin", "cancelled_by_system"]] },
                then: "Canceled",
              },
            ],
            default: { $ifNull: ["$orderStatus", "Pending"] },
          },
        },
      },
    },
    { $group: { _id: "$displayStatus", count: { $sum: 1 } } },
  ]);

  const summary = { ...EMPTY_ORDER_REPORT_STATUS_SUMMARY };
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count || 0);
    total += count;
    if (Object.prototype.hasOwnProperty.call(summary, row._id)) {
      summary[row._id] += count;
    }
  }
  summary.total = total;
  return summary;
}

export async function listOrdersAdmin(query) {
  const includeStatusSummary = isTruthyQueryFlag(query?.includeStatusSummary);
  const maxLimit = includeStatusSummary ? 500 : 100;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), maxLimit);
  const skip = (page - 1) * limit;

  const filter = await buildListOrdersAdminFilter(query);

  const [docs, total, statusSummary] = await Promise.all([
    FoodOrder.find(filter)
      .select(ORDER_LIST_PROJECTION)
      .populate("userId", "name phone email")
      .populate("restaurantId", "restaurantName area city ownerPhone")
      .populate("dispatch.deliveryPartnerId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
    includeStatusSummary ? aggregateListOrdersAdminStatusSummary(filter) : Promise.resolve(null),
  ]);

  const paginated = buildPaginatedResult({ docs, total, page, limit });
  return {
    ...paginated,
    orders: paginated.data,
    ...(statusSummary ? { statusSummary } : {}),
  };
}

export async function assignDeliveryPartnerAdmin(
  orderId,
  deliveryPartnerId,
  adminId,
) {
  const order = await FoodOrder.findById(orderId);
  if (!order) throw new NotFoundError("Order not found");
  if (order.dispatch.status === "accepted")
    throw new ValidationError("Order already accepted by partner");

  const partner = await FoodDeliveryPartner.findById(deliveryPartnerId)
    .select("status")
    .lean();
  if (!partner || partner.status !== "approved")
    throw new ValidationError("Delivery partner not available");

    order.dispatch.status = 'assigned';
    order.dispatch.deliveryPartnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
    order.dispatch.assignedAt = new Date();
    pushStatusHistory(order, { byRole: 'ADMIN', byId: adminId, from: order.dispatch.status, to: 'assigned' });
    await order.save();
    enqueueOrderEvent('delivery_partner_assigned', {
        orderMongoId: order._id?.toString?.(),
        orderId: order.orderId,
        deliveryPartnerId,
        adminId
    });
    return order.toObject();
}

export async function deleteOrderAdmin(orderId, adminId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne(identity).lean();
  if (!order) throw new NotFoundError("Order not found");

  // Keep support tickets but detach deleted order reference.
  await Promise.all([
    FoodSupportTicket.updateMany(
      { orderId: order._id },
      { $set: { orderId: null } },
    ),
    FoodTransaction.deleteOne({
      $or: [{ orderId: order._id }, { orderReadableId: String(order.orderId) }],
    }),
    FoodOrder.deleteOne({ _id: order._id }),
  ]);

  // Remove realtime tracking node if present.
  try {
    const db = getFirebaseDB();
    if (db && order?.orderId) {
      await db.ref(`active_orders/${order.orderId}`).remove();
    }
  } catch (err) {
    logger.warn(`Delete order firebase cleanup failed: ${err?.message || err}`);
  }

  // Notify connected apps so stale UI entries can disappear without refresh.
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: String(order._id),
        orderId: String(order.orderId || ""),
        deletedBy: "ADMIN",
        adminId: adminId ? String(adminId) : null,
      };

      if (order.userId) io.to(rooms.user(order.userId)).emit("order_deleted", payload);
      if (order.restaurantId) io.to(rooms.restaurant(order.restaurantId)).emit("order_deleted", payload);
      if (order.dispatch?.deliveryPartnerId) {
        io.to(rooms.delivery(order.dispatch.deliveryPartnerId)).emit("order_deleted", payload);
      }
    }
  } catch (err) {
    logger.warn(`Delete order socket emit failed: ${err?.message || err}`);
  }

  enqueueOrderEvent("order_deleted_by_admin", {
    orderMongoId: String(order._id),
    orderId: String(order.orderId || ""),
    adminId: adminId ? String(adminId) : null,
  });

  return {
    deleted: true,
    orderId: String(order.orderId || ""),
    orderMongoId: String(order._id),
  };
}

/**
 * 🕵️ Watchdog: Recovers orders that are in intermediate states for too long.
 * Runs once at server startup (triggered in server.js).
 */
export async function recoverStuckOrders() {
  try {
    const STUCK_THRESHOLD_HOURS = 2; // Orders older than this in a transient state are considered stuck
    const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000);

    const transientStates = [
      'placed',
      'created',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'picked_up'
    ];

    // Find orders that haven't been updated recently and are in a transient state
    const stuckOrders = await FoodOrder.find({
      orderStatus: { $in: transientStates },
      updatedAt: { $lt: thresholdDate }
    });

    if (stuckOrders.length === 0) {
      // logger.info('Watchdog: No stuck orders found to recover.');
      return;
    }

    logger.info(`Watchdog: Found ${stuckOrders.length} stuck orders. Mark as cancelled...`);

    const results = await Promise.all(stuckOrders.map(async (order) => {
      try {
        const oldStatus = order.orderStatus;
        const displayReason = watchdogCancellationReason(oldStatus);
        order.orderStatus = 'cancelled_by_system';
        
        pushStatusHistory(order, {
          byRole: 'SYSTEM',
          from: oldStatus,
          to: 'cancelled_by_system',
          note: displayReason,
        });

        applyCancellationTerminalState(order, {
          cancelledStatus: 'cancelled_by_system',
          reason: displayReason,
        });

        await order.save({ validateBeforeSave: false });
        
        // Sync mixed order seller legs
        if (order.orderType === 'mixed' || order.orderType === 'quick') {
          await cancelSellerOrdersForParent(order, "Cancelled by system watchdog");
        }

        // Exclude stuck/cancelled orders from restaurant settlement eligibility.
        try {
          const paymentStatus = String(order.payment?.status || '').trim().toLowerCase();
          const wasPaidOrRefunded = ['paid', 'refunded'].includes(paymentStatus);
          await foodTransactionService.updateTransactionStatus(
            order._id,
            'cancelled_by_system',
            {
              status: wasPaidOrRefunded ? 'refunded' : 'failed',
              note: 'Watchdog auto-recovery: Order cancelled while stuck in transient state',
              recordedByRole: 'SYSTEM',
            },
          );
        } catch (txErr) {
          logger.warn(
            `Watchdog transaction sync failed for ${order.orderId}: ${txErr?.message || txErr}`,
          );
        }
        
        // Enqueue event for housekeeping/finance
        enqueueOrderEvent('order_cancelled_by_watchdog', {
          orderMongoId: order._id.toString(),
          orderId: order.orderId,
          fromStatus: oldStatus
        });

        return true;
      } catch (err) {
        logger.error(`Watchdog: Failed to recover order ${order.orderId}: ${err.message}`);
        return false;
      }
    }));

    const recoveredCount = results.filter(Boolean).length;
    logger.info(`Watchdog: Successfully recovered ${recoveredCount}/${stuckOrders.length} stuck orders.`);
  } catch (err) {
    logger.error(`Watchdog Error during recovery: ${err.message}`);
  }
}

/**
 * 🆕 Resync State Helper:
 * - When a client reconnects, they call this to get their active order state.
 * - For Delivery Partners: returns the current trip details.
 * - For Users: returns the most recent active order being prepared or delivered.
 */
export async function resyncState(userId, role) {
  if (!userId || !role) return { activeOrder: null };

  let activeOrder = null;

  try {
    const roleUpper = String(role).toUpperCase();
    
    if (roleUpper === 'DELIVERY_PARTNER') {
      const trip = await getCurrentTripDelivery(userId);
      activeOrder = trip ? toDeliveryTripDto(trip) : null;
    } else if (roleUpper === 'USER') {
      const order = await FoodOrder.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        orderStatus: {
          $in: ["placed", "created", "confirmed", "preparing", "ready_for_pickup", "picked_up", "reached_pickup", "reached_drop"]
        }
      })
      .select(`${ORDER_DETAIL_PROJECTION} +deliveryOtp`)
      .populate({ path: "restaurantId", select: "restaurantName name phone location addressLine1 area city state profileImage" })
      .sort({ createdAt: -1 })
      .lean();

      if (order) {
        const normalized = normalizeOrderForClient(order);
        if (order.deliveryVerification?.dropOtp?.required && !order.deliveryVerification?.dropOtp?.verified) {
          normalized.handoverOtp = order.deliveryOtp;
        }
        activeOrder = toOrderDetailDto(normalized, { role: "USER" });
      }
    }
  } catch (err) {
    logger.error(`resyncState failed for ${role}:${userId} — ${err.message}`);
  }

  return { activeOrder };
}

