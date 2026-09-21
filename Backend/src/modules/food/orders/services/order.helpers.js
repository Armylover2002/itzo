import mongoose from 'mongoose';
import { logger } from '../../../../utils/logger.js';
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import { addPaymentJob } from '../../../../queues/producers/payment.producer.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { splitQuickDeliveryCharge } from './quick-eligibility.service.js';
import { normalizeQuickDeliverySettings } from '../utils/quickDeliveryConstants.js';
import { resolveRestaurantPhone } from '../../shared/restaurantContact.js';
import { getPrivacySettingsSync } from '../../../common/utils/privacySettingsCache.js';

/**
 * Female customer privacy mask — Admin > Global Settings > Customer Privacy Settings.
 * Mirrors the copy of this helper in order.service.js (kept local there since that
 * file shadows these exports with its own versions for the Food order flows).
 * No-ops when `userId` isn't populated with `gender`, so callers that haven't
 * opted into the populate keep working exactly as before.
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

/** Actions that must be processed by the payment worker (wallet credits / refunds). */
export const PAYMENT_QUEUE_ACTIONS = [
  'delivery_completed',
  'order_cancelled',
  'order_cancelled_by_user',
  'order_cancelled_by_watchdog',
  'payment_verified',
];

function runSyncPaymentProcessor(action, payload = {}) {
  import('../../../../queues/processors/payment.processor.js')
    .then(({ processPaymentJob }) => {
      logger.info(`[BullMQ:fallback] Running sync payment processor for action=${action}`);
      processPaymentJob({
        data: { action, ...payload },
        id: `sync_${action}_${payload.orderMongoId || Date.now()}`,
      }).catch((err) => {
        logger.error(`[BullMQ:fallback] Sync payment processor failed: ${err.message}`);
      });
    })
    .catch((err) => {
      logger.error(`[BullMQ:fallback] Failed to import payment processor: ${err.message}`);
    });
}

/**
 * Fire-and-forget BullMQ enqueue for order lifecycle events.
 * Payment settlement actions use the payment queue when BullMQ is enabled.
 * jobOptions (3rd arg) is passed to addOrderJob — e.g. { delay, jobId }.
 * Never blocks API response; failures are logged only.
 */
export function enqueueOrderEvent(action, payload = {}, jobOptions = {}) {
  const isPaymentAction = PAYMENT_QUEUE_ACTIONS.includes(action);

  try {
    if (isPaymentAction) {
      if (process.env.BULLMQ_ENABLED === 'true') {
        const jobOpts = {};
        if (payload.orderMongoId) {
          // Deduplicate concurrent enqueues for the same order+action.
          jobOpts.jobId = `payment_${action}_${payload.orderMongoId}`;
        }
        void addPaymentJob({ action, ...payload }, jobOpts)
          .then((job) => {
            if (!job) {
              // Queue unavailable despite BullMQ flag — still settle credits.
              runSyncPaymentProcessor(action, payload);
            }
          })
          .catch((err) => {
            const msg = String(err?.message || err);
            if (/JobId|already exists|already existed/i.test(msg)) {
              logger.info(
                `[BullMQ] Payment job already present for action=${action} order=${payload.orderMongoId || ''}`,
              );
              return;
            }
            logger.warn(`BullMQ enqueue payment event failed: ${action} - ${msg}`);
            runSyncPaymentProcessor(action, payload);
          });
      } else {
        runSyncPaymentProcessor(action, payload);
      }
      return;
    }

    void addOrderJob({ action, ...payload }, jobOptions).catch((err) => {
      logger.warn(`BullMQ enqueue order event failed: ${action} - ${err?.message || err}`);
    });
  } catch (err) {
    logger.warn(`BullMQ enqueue order event failed (sync): ${action} - ${err?.message || err}`);
    if (isPaymentAction) {
      runSyncPaymentProcessor(action, payload);
    }
  }
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Road/travel distance in km (Google Distance Matrix with Haversine fallback). */
export async function roadDistanceKm(lat1, lon1, lat2, lon2) {
  const { getRoadDistanceKmValue } = await import('../../../../services/roadDistance.service.js');
  return getRoadDistanceKmValue(
    { lat: lat1, lng: lon1 },
    { lat: lat2, lng: lon2 },
  );
}

/** Full road distance result including whether the value is an estimate. */
export async function roadDistanceDetails(lat1, lon1, lat2, lon2) {
  const { getRoadDistanceKm } = await import('../../../../services/roadDistance.service.js');
  return getRoadDistanceKm(
    { lat: lat1, lng: lon1 },
    { lat: lat2, lng: lon2 },
  );
}

export function generateFourDigitDeliveryOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function shouldShowDeliveryPartnerPhone(order) {
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

export function sanitizeOrderForExternal(orderDoc, roleContext = "") {
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
  o.orderMongoId = (o._id || orderDoc?._id || "").toString();
  // Ensure orderId field for UI always contains the pretty ID
  o.orderId = o.orderId || o.order_id || o.orderMongoId;

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

export function emitDeliveryDropOtpToUser(order, plainOtp) {
  try {
    const io = getIO();
    if (!io || !plainOtp) return;

    const payload = {
      orderMongoId: order._id?.toString?.(),
      orderId: order.orderId || order.order_id || order._id?.toString?.(),
      otp: plainOtp,
      message:
        "Share this OTP with your delivery partner to hand over the order.",
    };

    // Emit to specific user room if logged in
    if (order.userId) {
      io.to(rooms.user(order.userId)).emit("delivery_drop_otp", payload);
    }

    // Always emit to tracking room (covers guests and active trackers)
    const orderId = order.orderId || order.order_id || order._id?.toString?.();
    if (orderId) {
      io.to(rooms.tracking(orderId)).emit("delivery_drop_otp", payload);
    }
  } catch (e) {
    logger.warn(`emitDeliveryDropOtpToUser failed: ${e?.message || e}`);
  }
}

export async function notifyOwnersSafely(targets, payload) {
  try {
    const { notifyOwnersWithInbox } = await import('../../../../core/notifications/ownerInboxNotify.js');
    await notifyOwnersWithInbox(targets, payload);
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export async function notifyOwnerSafely(target, payload) {
  try {
    const { notifyOwnerWithInbox } = await import('../../../../core/notifications/ownerInboxNotify.js');
    await notifyOwnerWithInbox(target, payload);
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export function buildOrderIdentityFilter(orderIdOrMongoId) {
  const raw = String(orderIdOrMongoId || "").trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw))
    return { _id: new mongoose.Types.ObjectId(raw) };
  
  // Search BOTH underscore and camelCase variants for robust lookup
  return { 
    $or: [
        { order_id: raw },
        { orderId: raw }
    ]
  };
}

export function toGeoPoint(lat, lng) {
  if (lat == null || lng == null) return undefined;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return { type: "Point", coordinates: [b, a] };
}

export function isTerminalOrderStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return (
    s === "cancelled_by_user" ||
    s === "cancelled_by_restaurant" ||
    s === "cancelled_by_admin" ||
    s === "cancelled_by_system"
  );
}

const WATCHDOG_CANCELLATION_RE =
  /watchdog|stuck in transient|auto-recovery|auto recover/i;

/** User-facing cancel reason when watchdog clears a stuck transient order. */
export function watchdogCancellationReason(fromStatus) {
  const s = String(fromStatus || "").trim().toLowerCase();
  if (s === "placed" || s === "created") return "Restaurant not accept";
  if (s === "confirmed" || s === "preparing") {
    return "Order was not completed in time";
  }
  if (s === "ready_for_pickup" || s === "ready") {
    return "Order was not picked up in time";
  }
  if (s === "picked_up") return "Delivery was not completed in time";
  return "Order expired due to inactivity";
}

function inferStatusBeforeCancellation(orderLike) {
  const history = orderLike?.statusHistory;
  if (!Array.isArray(history) || history.length === 0) return "";
  const cancelEntry = [...history]
    .reverse()
    .find((entry) => String(entry?.to || "").toLowerCase().includes("cancel"));
  return String(cancelEntry?.from || "").trim().toLowerCase();
}

/** Maps internal/system cancellation text to restaurant/customer-safe copy. */
export function formatCancellationReasonForDisplay(orderLike) {
  const raw = String(orderLike?.cancellationReason || "").trim();
  if (!raw) return "";
  if (!WATCHDOG_CANCELLATION_RE.test(raw)) return raw;
  const fromStatus = inferStatusBeforeCancellation(orderLike);
  return watchdogCancellationReason(fromStatus);
}

export function pushStatusHistory(order, { byRole, byId, from, to, note = "" }) {
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

export function normalizeOrderForClient(orderDoc) {
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

export async function applyAggregateRating(model, entityId, newRating) {
  if (!entityId) return;
  const doc = await model.findById(entityId).select("rating totalRatings");
  if (!doc) return;

  const totalRatings = Number(doc.totalRatings || 0);
  const currentAverage = Number(doc.rating || 0);
  const nextTotal = totalRatings + 1;
  const nextAverage = Number(
    ((currentAverage * totalRatings + Number(newRating)) / nextTotal).toFixed(1),
  );

  doc.totalRatings = nextTotal;
  doc.rating = nextAverage;
  await doc.save();
}

export function buildDeliverySocketPayload(orderDoc, restaurantDoc = null) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const isQuickOrder = String(order?.orderType || '').trim().toLowerCase() === 'quick';
  const restaurant = restaurantDoc || order?.restaurantId || null;
  const seller = isQuickOrder ? restaurant : null;
  const restaurantLocation = restaurant?.location || {};
  const deliveryAddress = order?.deliveryAddress || {};
  const storeAddressText = [
    restaurantLocation?.formattedAddress,
    restaurantLocation?.address,
    restaurant?.shopInfo?.formattedAddress,
    restaurant?.shopInfo?.address,
    restaurant?.addressLine1,
  ]
    .map((part) => String(part || '').trim())
    .find(Boolean) || '';

  const sellerPickupLat = restaurantLocation?.latitude ??
    (Array.isArray(restaurantLocation?.coordinates) ? restaurantLocation.coordinates[1] : undefined);
  const sellerPickupLng = restaurantLocation?.longitude ??
    (Array.isArray(restaurantLocation?.coordinates) ? restaurantLocation.coordinates[0] : undefined);

  let pickupPoints = Array.isArray(order?.pickupPoints) ? [...order.pickupPoints] : [];
  if (isQuickOrder && seller?._id) {
    const quickPickupPoint = {
      legId: `quick:${seller._id}`,
      pickupType: 'quick',
      sourceId: String(seller._id),
      sourceName: String(seller.shopName || seller.name || 'Store').trim(),
      address: storeAddressText,
      phone: String(seller.phone || '').trim(),
      ...(Number.isFinite(Number(sellerPickupLat)) && Number.isFinite(Number(sellerPickupLng))
        ? {
            location: {
              coordinates: [Number(sellerPickupLng), Number(sellerPickupLat)],
              lat: Number(sellerPickupLat),
              lng: Number(sellerPickupLng),
              address: storeAddressText,
              formattedAddress: storeAddressText,
            },
          }
        : {}),
    };
    if (!pickupPoints.length) pickupPoints = [quickPickupPoint];
  }

  const customerAddressParts = [
    deliveryAddress.formattedAddress,
    deliveryAddress.street || deliveryAddress.address,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter((part) => part && part.toUpperCase() !== 'NA');

  const customerLocation = Array.isArray(deliveryAddress?.location?.coordinates)
    && deliveryAddress.location.coordinates.length >= 2
    ? {
        lat: Number(deliveryAddress.location.coordinates[1]),
        lng: Number(deliveryAddress.location.coordinates[0]),
      }
    : (Number.isFinite(Number(deliveryAddress?.location?.lat)) && Number.isFinite(Number(deliveryAddress?.location?.lng))
        ? {
            lat: Number(deliveryAddress.location.lat),
            lng: Number(deliveryAddress.location.lng),
          }
        : null);

  const primaryQuickPickup = pickupPoints.find((point) => point?.pickupType === 'quick') || pickupPoints[0] || null;

  const payload = {
    orderMongoId:
      orderDoc?._id?.toString?.() || order?._id?.toString?.() || order?._id,
    orderId: order?.orderId || order?.order_id || order?._id?.toString?.(),
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
          quickRiderBonus: order.pricing.quickRiderBonus,
          quickRiderShare: order.pricing.quickRiderShare,
          quickRestaurantShare: order.pricing.quickRestaurantShare,
          quickDeliveryFee: order.pricing.quickDeliveryFee,
          quickPlatformShare: order.pricing.quickPlatformShare,
          quickSharePcts: order.pricing.quickSharePcts,
          quickFinanceVersion: order.pricing.quickFinanceVersion,
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
      restaurant?._id?.toString?.() ||
      order?.restaurantId?._id?.toString?.() ||
      order?.restaurantId?.toString?.() ||
      order?.restaurantId,
    restaurantName: seller?.shopName || restaurant?.shopName || restaurant?.restaurantName || order?.restaurantName || "",
    restaurantAddress: storeAddressText,
    restaurantPhone: resolveRestaurantPhone(restaurant),
    restaurantLocation: {
      latitude: sellerPickupLat,
      longitude: sellerPickupLng,
      address: storeAddressText,
      area: restaurantLocation?.area || restaurant?.area || "",
      city: restaurantLocation?.city || restaurant?.city || "",
      state: restaurantLocation?.state || restaurant?.state || "",
      ...(Array.isArray(restaurantLocation?.coordinates) ? { coordinates: restaurantLocation.coordinates } : {}),
    },
    deliveryAddress: order?.deliveryAddress,
    customerAddress: [...new Set(customerAddressParts)].join(', '),
    customerLocation,
    customerName: order?.customerName || deliveryAddress?.name || deliveryAddress?.fullName || order?.userId?.name || "",
    customerPhone: order?.customerPhone || deliveryAddress?.phone || order?.userId?.phone || "",
    userName: order?.customerName || deliveryAddress?.name || deliveryAddress?.fullName || order?.userId?.name || "",
    userPhone: order?.customerPhone || deliveryAddress?.phone || order?.userId?.phone || "",
    note: order?.note || "",
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
    // Food Quick Delivery (deliveryMode) — distinct from QC orderType:quick
    deliveryMode: String(order?.deliveryMode || 'basic'),
    isFoodQuickDelivery: String(order?.deliveryMode || '').toLowerCase() === 'quick',
    quickRiderBonus: Number(order?.pricing?.quickRiderBonus || 0) || 0,
    quickRiderShare:
      Number(
        order?.pricing?.quickRiderShare ?? order?.pricing?.quickRiderBonus ?? 0,
      ) || 0,
    quickRestaurantShare: Number(order?.pricing?.quickRestaurantShare || 0) || 0,
    quickDeliveryFee: Number(order?.pricing?.quickDeliveryFee || 0) || 0,
    quickPlatformShare: Number(order?.pricing?.quickPlatformShare || 0) || 0,
    quickSharePcts: order?.pricing?.quickSharePcts || null,
    quickFinanceVersion: String(order?.pricing?.quickFinanceVersion || ''),
    etaPromise: order?.etaPromise || null,
    offerTimeoutSec:
      String(order?.deliveryMode || '').toLowerCase() === 'quick'
        ? Number(order?.dispatch?.offerTimeoutSec || 45) || 45
        : Number(order?.dispatch?.offerTimeoutSec || 60) || 60,
  };

  if (isQuickOrder && seller?._id) {
    payload.orderType = 'quick';
    payload.storeId = String(seller._id);
    payload.sellerId = String(seller._id);
    payload.storeName = String(seller.shopName || seller.name || 'Store').trim();
    payload.sellerName = payload.storeName;
    payload.storeAddress = storeAddressText;
    payload.sellerAddress = storeAddressText;
    payload.storePhone = String(seller.phone || '').trim();
    payload.sellerPhone = payload.storePhone;
    payload.seller = {
      _id: seller._id,
      shopName: seller.shopName || seller.name || 'Store',
      name: seller.name || seller.shopName || 'Store',
      phone: seller.phone || '',
      location: restaurantLocation,
    };
    if (primaryQuickPickup) {
      payload.dispatchLeg = {
        legId: primaryQuickPickup.legId || `quick:${seller._id}`,
        pickupType: 'quick',
        sourceId: String(primaryQuickPickup.sourceId || seller._id),
        sourceName: primaryQuickPickup.sourceName || payload.storeName,
        address: primaryQuickPickup.address || storeAddressText,
        phone: primaryQuickPickup.phone || payload.storePhone,
        location: primaryQuickPickup.location || payload.restaurantLocation,
      };
    }
  }

  // Reuses order.userId (populated with gender where the caller's query opted
  // in) to apply female-contact-protection to the socket payload.
  payload.userId = order?.userId;
  const protectedPayload = applyCustomerContactProtection(payload);
  delete protectedPayload.userId;
  return protectedPayload;
}

export function canExposeOrderToRestaurant(orderLike) {
  // Hold restaurant exposure while still scheduled (mirror order.service).
  if (String(orderLike?.orderStatus || '').toLowerCase() === 'scheduled') return false;
  const method = String(orderLike?.payment?.method || "").toLowerCase();
  const status = String(orderLike?.payment?.status || "").toLowerCase();
  if (["cash", "wallet"].includes(method)) return true;
  return ["paid", "authorized", "captured", "settled"].includes(status);
}

/**
 * Ensure restaurant-facing quick pricing lines are populated (share + pcts + fee).
 * Recomputes from active fee settings when the order doc is missing frozen share fields.
 */
export async function enrichRestaurantQuickPricing(pricing = {}, deliveryMode = 'basic') {
  const base = pricing && typeof pricing === 'object' ? { ...pricing } : {};
  const isQuick = String(deliveryMode || '').toLowerCase() === 'quick';
  if (!isQuick) return base;

  let quickDeliveryFee = Math.max(0, Number(base.quickDeliveryFee) || 0);
  let quickRestaurantShare = Math.max(0, Number(base.quickRestaurantShare) || 0);
  let quickSharePcts =
    base.quickSharePcts && typeof base.quickSharePcts === 'object'
      ? { ...base.quickSharePcts }
      : { platform: 0, rider: 0, restaurant: 0 };

  const feeSettings = await FoodFeeSettings.findOne({ isActive: { $ne: false } })
    .sort({ createdAt: -1 })
    .lean();
  const quickSettings = normalizeQuickDeliverySettings(feeSettings?.quickDelivery);

  if (!(quickDeliveryFee > 0) && quickSettings.charge > 0) {
    quickDeliveryFee = quickSettings.charge;
  }

  if (quickDeliveryFee > 0) {
    const split = splitQuickDeliveryCharge(quickSettings, quickDeliveryFee);
    if (!(quickRestaurantShare > 0)) {
      quickRestaurantShare = split.quickRestaurantShare;
    }
    if (!(Number(quickSharePcts.restaurant) > 0)) {
      quickSharePcts = { ...split.quickSharePcts };
    }
    if (!(Number(base.quickPlatformShare) > 0)) {
      base.quickPlatformShare = split.quickPlatformShare;
    }
    if (!(Number(base.quickRiderShare ?? base.quickRiderBonus) > 0)) {
      base.quickRiderShare = split.quickRiderShare;
      base.quickRiderBonus = split.quickRiderBonus;
    }
  }

  return {
    ...base,
    quickDeliveryFee,
    quickRestaurantShare,
    quickSharePcts,
  };
}

async function buildRestaurantNewOrderSocketPayload(orderDoc) {
  const o = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const mongoId = o._id?.toString?.() || String(o._id || "");
  const addr = o.deliveryAddress || o.address || null;
  const isQuick = String(o.deliveryMode || "").toLowerCase() === "quick";
  const pricingSrc = await enrichRestaurantQuickPricing(o.pricing || {}, o.deliveryMode);
  const foodItems = Array.isArray(o.items)
    ? o.items.filter((item) => String(item?.type || "").toLowerCase() !== "quick")
    : [];
  const itemsSum = foodItems.reduce((sum, item) => {
    const price = Number(item?.price || 0);
    const qty = Number(item?.quantity || 0);
    return sum + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
  }, 0);
  const subtotalRaw = Number(pricingSrc.subtotal ?? pricingSrc.itemSubtotal);
  const subtotal =
    Number.isFinite(subtotalRaw) && subtotalRaw >= 0 ? subtotalRaw : itemsSum;
  const tax = Number(pricingSrc.tax ?? pricingSrc.taxes) || 0;
  const packagingFee = Number(pricingSrc.packagingFee) || 0;
  const discount = Number(pricingSrc.discount) || 0;
  const quickRestaurantShare = Number(pricingSrc.quickRestaurantShare) || 0;
  const quickDeliveryFee = Number(pricingSrc.quickDeliveryFee) || 0;
  const quickSharePcts = pricingSrc.quickSharePcts || null;
  const restaurantCommission = Number(pricingSrc.restaurantCommission) || 0;
  const restaurantCommissionPercentage =
    Number(pricingSrc.restaurantCommissionPercentage) || 0;
  // Restaurant kitchen bill (matches popup / OrderDetails) — items + packaging + quick share.
  const restaurantBill = Math.max(
    0,
    subtotal + tax + packagingFee + quickRestaurantShare - discount,
  );

  return {
    _id: o._id,
    orderId: o.orderId || o.order_id || mongoId,
    orderMongoId: mongoId || undefined,
    orderStatus: o.orderStatus,
    status: o.orderStatus,
    restaurantId: o.restaurantId,
    items: Array.isArray(o.items)
      ? o.items.map((item) => ({
          name: item?.name,
          quantity: item?.quantity,
          price: item?.price,
          type: item?.type,
          variantName: item?.variantName,
        }))
      : [],
    pricing: {
      subtotal,
      itemSubtotal: subtotal,
      tax,
      taxes: tax,
      packagingFee,
      discount,
      quickDeliveryFee,
      quickRestaurantShare,
      quickSharePcts,
      restaurantCommission,
      restaurantCommissionPercentage,
      restaurantBill,
    },
    restaurantBill,
    total: restaurantBill,
    quickRestaurantShare,
    quickDeliveryFee,
    quickSharePcts,
    restaurantCommission,
    restaurantCommissionPercentage,
    isFoodQuickDelivery: isQuick,
    payment: o.payment
      ? { method: o.payment.method, status: o.payment.status }
      : undefined,
    paymentMethod: o.payment?.method,
    deliveryAddress: addr,
    customerAddress: addr,
    address: addr,
    note: o.note,
    restaurantNote: o.restaurantNote,
    sendCutlery: o.sendCutlery,
    scheduledAt: o.scheduledAt,
    createdAt: o.createdAt,
    estimatedDeliveryTime:
      o.estimatedDeliveryTime || o.etaPromise?.minutes || 30,
    deliveryMode: o.deliveryMode,
  };
}

export async function notifyRestaurantNewOrder(orderDoc) {
  try {
    if (!orderDoc || !canExposeOrderToRestaurant(orderDoc)) return;
    if (String(orderDoc.orderStatus || '').toLowerCase() === 'scheduled') return;

    const io = getIO();

    if (io) {
      const payload = await buildRestaurantNewOrderSocketPayload(orderDoc);
      logger.info(
        `[RestaurantOrders] Emitting new_order to ${rooms.restaurant(orderDoc.restaurantId)} for order ${orderDoc._id?.toString?.() || ''}`,
      );
      io.to(rooms.restaurant(orderDoc.restaurantId)).emit("new_order", payload);
      io.to(rooms.restaurant(orderDoc.restaurantId)).emit(
        "play_notification_sound",
        {
          audience: "restaurant",
          type: "new_order",
          orderId: payload.orderId,
          orderMongoId: payload.orderMongoId,
        },
      );

    }

    const isFoodQuick =
      String(orderDoc.deliveryMode || "").toLowerCase() === "quick";
    await notifyOwnersSafely(
      [{ ownerType: "RESTAURANT", ownerId: orderDoc.restaurantId }],
      {
        title: isFoodQuick ? "New Quick Delivery order" : "New order received",
        body: isFoodQuick
          ? `PRIORITY: Quick order #${orderDoc.orderId || orderDoc.order_id || orderDoc._id} — prep ASAP.`
          : `Order #${orderDoc.order_id || orderDoc._id} is waiting for review.`,
        data: {
          type: "new_order",
          audience: "restaurant",
          orderId: orderDoc._id.toString(),
          orderMongoId: orderDoc._id?.toString?.() || "",
          deliveryMode: String(orderDoc.deliveryMode || "basic"),
          isFoodQuickDelivery: isFoodQuick,
          link: `/food/restaurant/orders/${orderDoc._id?.toString?.() || ""}`,
          targetUrl: `/food/restaurant/orders/${orderDoc._id?.toString?.() || ""}`,
        },
      },
    );

  } catch {
    // Do not block order/payment flow if notification fails.
  }
}

export const STATUS_PRIORITY = {
  created: 10,
  scheduled: 12,
  placed: 15,
  confirmed: 20,
  preparing: 30,
  ready_for_pickup: 40,
  reached_pickup: 50,
  picked_up: 60,
  reached_drop: 70,
  delivered: 80,
  cancelled_by_user: 100,
  cancelled_by_restaurant: 100,
  cancelled_by_admin: 100,
  cancelled_by_system: 100,
};

/**
 * Returns true if the next status is a valid forward progression from the current status.
 * Prevents "reversing" order status (e.g. from Preparing back to Created).
 */
export function isStatusAdvance(current, next) {
  // If current status is missing, it's effectively 'created' or start of flow
  if (!current) return true;
  
  const currentPrio = STATUS_PRIORITY[current] || 0;
  const nextPrio = STATUS_PRIORITY[next] || 0;

  // Terminal states (100) cannot transition to anything else
  if (currentPrio >= 100) return false;
  
  // Delivered (80) cannot transition to anything (except maybe cancellation if allowed, but here we say no)
  if (currentPrio === 80) return false;

  // Special case: Cancellation is almost always an advance unless already delivered
  if (nextPrio === 100 && currentPrio < 80) return true;

  return nextPrio > currentPrio;
}
