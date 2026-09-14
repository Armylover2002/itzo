/**
 * Production order response / socket DTOs.
 * Controllers map service results through these before HTTP send.
 * Keep field names backward-compatible with existing FE consumers.
 */

import { formatCancellationReasonForDisplay } from "../services/order.helpers.js";
import { resolveRestaurantPhone } from "../../shared/restaurantContact.js";

function asPlain(orderLike) {
  if (!orderLike) return {};
  if (typeof orderLike.toObject === "function") return orderLike.toObject();
  return orderLike;
}

function idStr(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function cancellationReasonForDto(o) {
  const formatted = formatCancellationReasonForDisplay(o);
  if (formatted) return formatted;
  const raw = String(o?.cancellationReason || "").trim();
  return raw || undefined;
}

function slimItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    _id: item?._id,
    itemId: item?.itemId || item?._id,
    name: item?.name || item?.foodName,
    variantName: item?.variantName,
    quantity: item?.quantity,
    price: item?.price,
    type: item?.type,
    isVeg: item?.isVeg,
    image: item?.image || null,
    sourceId: item?.sourceId,
  }));
}

function slimRefund(refund) {
  if (!refund || typeof refund !== "object") return undefined;
  const status = refund.status || "none";
  if (status === "none" && !refund.amount) return undefined;
  return {
    status,
    amount: refund.amount,
    refundId: refund.refundId,
    requestedMethod: refund.requestedMethod,
    processedMethod: refund.processedMethod,
    requestedAt: refund.requestedAt,
    processedAt: refund.processedAt,
    reason: refund.reason,
  };
}

function slimPayment(payment) {
  if (!payment || typeof payment !== "object") return undefined;
  return {
    method: payment.method,
    status: payment.status,
    amountDue: payment.amountDue,
    amount: payment.amount,
    refund: slimRefund(payment.refund),
    razorpay: payment.razorpay
      ? {
          orderId: payment.razorpay.orderId,
          paymentId: payment.razorpay.paymentId,
        }
      : undefined,
  };
}

function slimPricing(pricing) {
  if (!pricing || typeof pricing !== "object") return undefined;
  return {
    subtotal: pricing.subtotal,
    itemTotal: pricing.itemTotal,
    deliveryFee: pricing.deliveryFee,
    packagingFee: pricing.packagingFee,
    platformFee: pricing.platformFee,
    tax: pricing.tax,
    discount: pricing.discount,
    couponDiscount: pricing.couponDiscount,
    restaurantCommission: pricing.restaurantCommission,
    total: pricing.total,
    deliveryDistanceKm: pricing.deliveryDistanceKm,
    appliedCoupon: pricing.appliedCoupon,
    quickDelivery: pricing.quickDelivery,
    quickRiderBonus: pricing.quickRiderBonus,
    quickRiderShare: pricing.quickRiderShare,
    quickRestaurantShare: pricing.quickRestaurantShare,
    quickDeliveryFee: pricing.quickDeliveryFee,
    quickPlatformShare: pricing.quickPlatformShare,
    quickSharePcts: pricing.quickSharePcts,
  };
}

function slimDispatch(dispatch) {
  if (!dispatch || typeof dispatch !== "object") return undefined;
  return {
    status: dispatch.status,
    deliveryPartnerId: dispatch.deliveryPartnerId,
    assignedAt: dispatch.assignedAt,
    offerTimeoutSec: dispatch.offerTimeoutSec,
  };
}

function restaurantProfileImageUrl(restaurantRef) {
  if (!restaurantRef || typeof restaurantRef !== "object") return "";
  const raw = restaurantRef.profileImage ?? restaurantRef.image;
  if (!raw) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && typeof raw.url === "string") {
    return raw.url.trim();
  }
  return "";
}

function slimRestaurantRef(restaurantId) {
  if (!restaurantId) return restaurantId;
  if (typeof restaurantId !== "object") return restaurantId;
  return {
    _id: restaurantId._id,
    restaurantName: restaurantId.restaurantName || restaurantId.name,
    name: restaurantId.name || restaurantId.restaurantName,
    profileImage: restaurantId.profileImage,
    area: restaurantId.area,
    city: restaurantId.city,
    location: restaurantId.location,
    rating: restaurantId.rating,
    totalRatings: restaurantId.totalRatings,
    phone: resolveRestaurantPhone(restaurantId),
    primaryContactNumber: restaurantId.primaryContactNumber,
    slug: restaurantId.slug,
  };
}

function slimUserRef(userId) {
  if (!userId) return userId;
  if (typeof userId !== "object") return userId;
  return {
    _id: userId._id,
    name: userId.name,
    phone: userId.phone,
    email: userId.email,
    profileImage: userId.profileImage,
  };
}

function slimPartnerRef(partner) {
  if (!partner) return partner;
  if (typeof partner !== "object") return partner;
  return {
    _id: partner._id,
    name: partner.name,
    phone: partner.phone,
    rating: partner.rating,
    totalRatings: partner.totalRatings,
  };
}

/** Minimal ACK for status mutations (accept / reject / ready / reached-*). */
export function toOrderMutationAck(orderLike) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id);
  return {
    _id: o._id,
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || mongoId,
    orderStatus: o.orderStatus || o.status,
    status: o.orderStatus || o.status,
    updatedAt: o.updatedAt,
    deliveryMode: o.deliveryMode,
  };
}

/** Create / verify-payment client order — keep checkout + tracking prefetch fields. */
export function toOrderCreateDto(orderLike) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id);
  const restaurantRef =
    o.restaurantId && typeof o.restaurantId === "object" ? o.restaurantId : null;
  return {
    _id: o._id,
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || mongoId,
    orderType: o.orderType || "food",
    orderStatus: o.orderStatus,
    status: o.orderStatus,
    restaurantId: slimRestaurantRef(o.restaurantId) || o.restaurantId,
    restaurantName:
      o.restaurantName ||
      restaurantRef?.restaurantName ||
      restaurantRef?.name ||
      undefined,
    restaurantImage:
      o.restaurantImage || restaurantProfileImageUrl(restaurantRef) || undefined,
    items: slimItems(o.items),
    pricing: slimPricing(o.pricing),
    payment: slimPayment(o.payment),
    deliveryAddress: o.deliveryAddress || o.address,
    deliveryMode: o.deliveryMode,
    scheduledAt: o.scheduledAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    etaPromise: o.etaPromise,
    estimatedDeliveryTime: o.estimatedDeliveryTime,
    note: o.note,
    restaurantNote: o.restaurantNote,
    sendCutlery: o.sendCutlery,
    distanceKm: o.distanceKm,
    deliveryDistanceKm: o.deliveryDistanceKm,
  };
}

/** User / restaurant / admin list row. */
export function toOrderListItemDto(orderLike, { role = "USER" } = {}) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id);
  const partner =
    o.dispatch?.deliveryPartnerId ||
    o.deliveryPartnerId ||
    null;
  const restaurantRef =
    o.restaurantId && typeof o.restaurantId === "object" ? o.restaurantId : null;
  const restaurantImage =
    o.restaurantImage || restaurantProfileImageUrl(restaurantRef) || undefined;
  const customerRef =
    o.userId && typeof o.userId === "object" ? o.userId : null;

  const base = {
    _id: idStr(o._id) || o._id,
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || mongoId,
    orderType: o.orderType || "food",
    orderStatus: o.orderStatus || o.status,
    status: o.orderStatus || o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    scheduledAt: o.scheduledAt,
    activatedAt: o.activatedAt,
    deliveredAt: o.deliveredAt || o.deliveryState?.deliveredAt || null,
    items: slimItems(o.items),
    pricing: slimPricing(o.pricing),
    payment: slimPayment(o.payment),
    paymentMethod: o.payment?.method || o.paymentMethod,
    deliveryAddress: o.deliveryAddress || o.address,
    address: o.deliveryAddress || o.address,
    restaurantId: slimRestaurantRef(o.restaurantId),
    restaurantName:
      o.restaurantName ||
      restaurantRef?.restaurantName ||
      restaurantRef?.name ||
      undefined,
    restaurantImage,
    ratings: o.ratings,
    rating: o.rating ?? o.ratings?.restaurant?.rating ?? null,
    cancellationReason: cancellationReasonForDto(o),
    cancelledBy: o.cancelledBy,
    deliveryMode: o.deliveryMode || "basic",
    eta: o.eta,
    etaPromise: o.etaPromise,
    estimatedDeliveryTime: o.estimatedDeliveryTime,
    preparationTime: o.preparationTime,
    note: o.note,
    restaurantNote: o.restaurantNote,
    sendCutlery: o.sendCutlery,
    sla: o.sla,
    tracking: o.tracking
      ? { status: o.tracking.status, updatedAt: o.tracking.updatedAt }
      : undefined,
    deliveryPartnerId: slimPartnerRef(partner) || partner,
    deliveryPartnerName: o.deliveryPartnerName || partner?.name,
    deliveryPartnerPhone: o.deliveryPartnerPhone || partner?.phone,
    customerName: customerRef?.name || o.customerName || o.userName || o.deliveryAddress?.name,
    customerPhone: customerRef?.phone || o.customerPhone || o.userPhone || o.deliveryAddress?.phone,
  };

  if (role === "RESTAURANT" || role === "ADMIN") {
    base.userId = slimUserRef(o.userId);
    base.dispatch = slimDispatch(o.dispatch);
    base.restaurantCommission = o.restaurantCommission;
  }

  if (role === "ADMIN") {
    base.platformProfit = o.platformProfit;
    base.riderEarning = o.riderEarning;
  }

  return base;
}

/**
 * Delivery active-trip / accept / pickup / complete response.
 * Keeps location + payment fields DeliveryV2 useOrderManager reads.
 */
export function toDeliveryTripDto(orderLike) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id || o.orderMongoId);
  const restaurant = o.restaurantId;
  const restaurantRef =
    restaurant && typeof restaurant === "object" ? restaurant : null;
  const restaurantImage =
    o.restaurantImage || restaurantProfileImageUrl(restaurantRef) || undefined;

  return {
    _id: o._id,
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || mongoId,
    orderType: o.orderType || "food",
    orderStatus: o.orderStatus || o.status,
    status: o.orderStatus || o.status,
    documentType: o.documentType,
    tripType: o.tripType,
    returnId: o.returnId,
    restaurantId: slimRestaurantRef(restaurant),
    restaurantName:
      o.restaurantName ||
      restaurant?.restaurantName ||
      restaurant?.name ||
      "",
    restaurantImage,
    restaurantLocation: o.restaurantLocation || restaurant?.location || null,
    restaurantAddress: o.restaurantAddress,
    restaurantPhone: o.restaurantPhone || resolveRestaurantPhone(restaurant),
    restaurant_lat: o.restaurant_lat,
    restaurant_lng: o.restaurant_lng,
    deliveryAddress: o.deliveryAddress,
    customerLocation: o.customerLocation,
    customerAddress: o.customerAddress,
    customerName: o.customerName || o.userName || o.userId?.name || o.deliveryAddress?.name,
    customerPhone: o.customerPhone || o.userPhone || o.userId?.phone || o.deliveryAddress?.phone,
    userName: o.userName || o.customerName || o.userId?.name,
    userPhone: o.userPhone || o.customerPhone || o.userId?.phone,
    items: slimItems(o.items),
    pickupPoints: Array.isArray(o.pickupPoints) ? o.pickupPoints : [],
    pricing: slimPricing(o.pricing),
    payment: slimPayment(o.payment),
    paymentMethod: o.payment?.method || o.paymentMethod,
    total: o.total ?? o.pricing?.total,
    deliveryFee: o.deliveryFee ?? o.pricing?.deliveryFee,
    riderEarning: o.riderEarning,
    earnings: o.earnings ?? o.riderEarning,
    dispatch: slimDispatch(o.dispatch),
    dispatchLeg: o.dispatchLeg,
    dispatchOfferType: o.dispatchOfferType,
    assignedDispatchLeg: o.assignedDispatchLeg,
    deliveryPartnerId: o.deliveryPartnerId,
    deliveryMode: o.deliveryMode,
    isFoodQuickDelivery: o.isFoodQuickDelivery,
    deliveryState: o.deliveryState,
    deliveryVerification: o.deliveryVerification
      ? {
          dropOtp: {
            required: Boolean(o.deliveryVerification?.dropOtp?.required),
            verified: Boolean(o.deliveryVerification?.dropOtp?.verified),
          },
          pickup: o.deliveryVerification?.pickup,
          drop: o.deliveryVerification?.drop,
        }
      : undefined,
    distanceKm: o.distanceKm,
    deliveryDistanceKm: o.deliveryDistanceKm,
    offerTimeoutSec: o.offerTimeoutSec,
    etaPromise: o.etaPromise,
    note: o.note,
    restaurantNote: o.restaurantNote,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    deliveredAt: o.deliveredAt,
  };
}

/** Detail view for tracking / order details (user or restaurant). */
export function toOrderDetailDto(orderLike, { role = "USER" } = {}) {
  const list = toOrderListItemDto(orderLike, { role });
  const o = asPlain(orderLike);
  return {
    ...list,
    statusHistory: Array.isArray(o.statusHistory)
      ? o.statusHistory.map((entry) => ({
          at: entry?.at,
          from: entry?.from,
          to: entry?.to,
          byRole: entry?.byRole,
          byId: entry?.byId,
          note: entry?.note,
        }))
      : [],
    pickupPoints: o.pickupPoints,
    deliveryState: o.deliveryState,
    deliveryVerification: o.deliveryVerification
      ? {
          dropOtp: {
            required: Boolean(o.deliveryVerification?.dropOtp?.required),
            verified: Boolean(o.deliveryVerification?.dropOtp?.verified),
          },
        }
      : undefined,
    handoverOtp: o.handoverOtp,
    dispatch: slimDispatch(o.dispatch) || o.dispatch,
    dispatchPlan: o.dispatchPlan
      ? {
          strategy: o.dispatchPlan.strategy,
          legs: Array.isArray(o.dispatchPlan.legs)
            ? o.dispatchPlan.legs.map((leg) => ({
                legId: leg.legId,
                pickupType: leg.pickupType,
                sourceId: leg.sourceId,
                sourceName: leg.sourceName,
                deliveryPartnerId: slimPartnerRef(leg.deliveryPartnerId) || leg.deliveryPartnerId,
                status: leg.status,
              }))
            : [],
        }
      : undefined,
    lastRiderLocation: o.lastRiderLocation,
    etaPromise: o.etaPromise,
    sla: o.sla,
    review: o.review,
  };
}

/** Socket status event — already small; normalize shape. */
export function toOrderStatusSocketDto(orderLike, extras = {}) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id || o.orderMongoId);
  return {
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || mongoId,
    orderStatus: o.orderStatus || o.status,
    status: o.orderStatus || o.status,
    deliveryState: o.deliveryState,
    updatedAt: o.updatedAt || new Date().toISOString(),
    ...extras,
  };
}

/**
 * Mongo projection: exclude heavy internal arrays from list queries.
 * Positive select lists are brittle across roles; exclude is safer.
 */
export const ORDER_LIST_PROJECTION =
  "-statusHistory -__v -deliveryOtp -dispatch.offeredTo -dispatch.huntLog -dispatch.attempts -payment.razorpay.signature";

/** Detail must include statusHistory (admin / restaurant timeline). */
export const ORDER_DETAIL_PROJECTION =
  "-__v -dispatch.offeredTo -dispatch.huntLog -dispatch.attempts -payment.razorpay.signature";

/**
 * Drop null/undefined keys (and empty nested objects after slim).
 * Keeps 0 / false / "" — those are meaningful for list UIs.
 * Preserves ObjectId / Date / non-plain objects (do not walk their internals).
 */
function omitNullish(value) {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.map((entry) => omitNullish(entry));
  }
  if (typeof value !== "object") {
    return value;
  }
  if (value instanceof Date) {
    return value;
  }
  // ObjectId, Buffer, etc. — stringify-friendly identity fields must stay intact.
  if (value.constructor && value.constructor !== Object) {
    return value;
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null || entry === undefined) continue;
    const next = omitNullish(entry);
    if (next === null || next === undefined) continue;
    if (
      typeof next === "object" &&
      !Array.isArray(next) &&
      !(next instanceof Date) &&
      (!next.constructor || next.constructor === Object) &&
      Object.keys(next).length === 0
    ) {
      continue;
    }
    out[key] = next;
  }
  return out;
}

/**
 * Restaurant order LIST — nested inclusion projection.
 * Fetch only fields the list DTO needs (do not load full nested trees then discard).
 * Detail screens use getOrderById + ORDER_DETAIL_PROJECTION separately.
 *
 * Dead paths removed (not on FoodOrder / never written / DTO-derived):
 * - top-level address.* (canonical is deliveryAddress; DTO aliases address)
 * - paymentMethod, paymentStatus, paymentCollectionStatus, total (DTO-derived)
 * - pricing.taxes, pricing.itemSubtotal (DTO aliases from tax/subtotal)
 * - tracking.preparing.timestamp (never written; FE falls back to createdAt)
 * - review.*, feedback.*, top-level rating (Feedback uses ratings.restaurant)
 */
export const RESTAURANT_ORDER_LIST_SELECT = [
  "orderId",
  "orderStatus",
  "createdAt",
  "updatedAt",
  "deliveredAt",
  "cancelledAt",
  "scheduledAt",
  "cancelledBy",
  "cancellationReason",
  "statusHistory",
  "rejectionReason",
  "customerName",
  "customerPhone",
  "note",
  "restaurantNote",
  "sendCutlery",
  "deliveryFleet",
  "deliveryMode",
  "estimatedDeliveryTime",
  // Address text only (no GeoJSON location) — deliveryAddress is canonical
  "deliveryAddress.formattedAddress",
  "deliveryAddress.address",
  "deliveryAddress.street",
  "deliveryAddress.label",
  "deliveryAddress.additionalDetails",
  "deliveryAddress.landmark",
  "deliveryAddress.addressLine1",
  "deliveryAddress.addressLine2",
  "deliveryAddress.area",
  "deliveryAddress.city",
  "deliveryAddress.state",
  "deliveryAddress.zipCode",
  "deliveryAddress.postalCode",
  // Items — list thumbnails + veg badge + quick filter
  "items.name",
  "items.foodName",
  "items.quantity",
  "items.price",
  "items.image",
  "items.isVeg",
  "items.type",
  "items.orderType",
  // Pricing — popup / AllOrders / print fee lines
  "pricing.total",
  "pricing.subtotal",
  "pricing.tax",
  "pricing.packagingFee",
  "pricing.discount",
  "pricing.deliveryFee",
  "pricing.platformFee",
  "pricing.quickDeliveryFee",
  "pricing.quickRestaurantShare",
  "pricing.quickSharePcts.restaurant",
  "pricing.quickSharePcts.platform",
  "pricing.quickSharePcts.rider",
  "pricing.restaurantCommission",
  "pricing.restaurantCommissionPercentage",
  "payment.method",
  "payment.amountDue",
  "payment.amount",
  "userId",
  "restaurantId",
  "restaurantName",
  "deliveryPartnerId",
  "dispatch.status",
  "dispatch.deliveryPartnerId",
  "etaPromise.max",
  "ratings.restaurant.rating",
  "ratings.restaurant.comment",
].join(" ");

function slimRestaurantListAddress(addr) {
  if (!addr || typeof addr !== "object") return undefined;
  return omitNullish({
    formattedAddress: addr.formattedAddress,
    address: addr.address,
    street: addr.street,
    label: addr.label,
    additionalDetails: addr.additionalDetails,
    landmark: addr.landmark,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2,
    area: addr.area,
    city: addr.city,
    state: addr.state,
    zipCode: addr.zipCode,
    postalCode: addr.postalCode,
  });
}

function slimRestaurantListItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    omitNullish({
      name: item?.name || item?.foodName,
      quantity: item?.quantity,
      price: item?.price,
      image: item?.image || undefined,
      isVeg: item?.isVeg,
      type: item?.type,
      orderType: item?.orderType,
    }),
  );
}

function slimRestaurantListPricing(pricing) {
  if (!pricing || typeof pricing !== "object") return undefined;
  const tax = pricing.tax ?? pricing.taxes;
  const subtotal = pricing.subtotal ?? pricing.itemSubtotal;
  // Keep alias pairs: tax/taxes, subtotal/itemSubtotal (FE reads both)
  return omitNullish({
    total: pricing.total,
    itemSubtotal: pricing.itemSubtotal ?? subtotal,
    subtotal,
    tax,
    taxes: pricing.taxes ?? tax,
    packagingFee: pricing.packagingFee,
    discount: pricing.discount,
    deliveryFee: pricing.deliveryFee,
    platformFee: pricing.platformFee,
  });
}

function slimRestaurantListPayment(payment) {
  if (!payment || typeof payment !== "object") return undefined;
  return omitNullish({
    method: payment.method,
    amountDue: payment.amountDue,
    amount: payment.amount,
  });
}

function slimRestaurantListEta(etaPromise) {
  if (!etaPromise || typeof etaPromise !== "object") return undefined;
  if (etaPromise.max == null && etaPromise.min == null) return undefined;
  // List UI only reads .max (OrdersMain ETA); omit .min
  return omitNullish({ max: etaPromise.max });
}

function slimRestaurantListRatings(ratings) {
  if (!ratings || typeof ratings !== "object") return undefined;
  const restaurant = ratings.restaurant;
  if (!restaurant) return undefined;
  return omitNullish({
    restaurant: {
      rating: restaurant.rating,
      comment: restaurant.comment,
    },
  });
}

function slimRestaurantListUser(userId) {
  if (!userId) return userId;
  if (typeof userId !== "object") return userId;
  return omitNullish({
    _id: userId._id,
    name: userId.name,
    phone: userId.phone,
    profileImage: userId.profileImage,
  });
}

function slimRestaurantListPartner(partner) {
  if (!partner) return undefined;
  if (typeof partner !== "object") return partner;
  return omitNullish({
    _id: partner._id,
    name: partner.name,
    phone: partner.phone,
    rating: partner.rating,
  });
}

/**
 * RestaurantOrderListDTO — fields proven used by restaurant list consumers
 * (OrdersMain, OrdersPage, AllOrdersPage, Feedback, Notifications, useRestaurantNotifications, print).
 * Does NOT replace getOrderById detail payloads.
 * Alias pairs preserved. Null keys omitted.
 */
export function toRestaurantOrderListDto(orderLike) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id || o.orderMongoId);
  const orderStatus = o.orderStatus || o.status;
  const addr = slimRestaurantListAddress(o.deliveryAddress || o.address);
  const partner =
    o.dispatch?.deliveryPartnerId ||
    o.deliveryPartnerId ||
    null;
  const partnerSlim = slimRestaurantListPartner(partner);
  const pricing = slimRestaurantListPricing(o.pricing);
  const ratings = slimRestaurantListRatings(o.ratings);
  const ratingValue = o.rating ?? o.ratings?.restaurant?.rating;
  const etaPromise = slimRestaurantListEta(o.etaPromise);
  const estimatedDeliveryTime =
    o.estimatedDeliveryTime ?? (etaPromise?.max != null ? etaPromise.max : undefined);

  const dispatch =
    o.dispatch || partnerSlim
      ? omitNullish({
          status: o.dispatch?.status,
          deliveryPartnerId: partnerSlim,
        })
      : undefined;

  return omitNullish({
    _id: idStr(o._id) || o._id,
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || o.order_id || mongoId,
    orderStatus,
    status: orderStatus,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    deliveredAt: o.deliveredAt || o.deliveryState?.deliveredAt,
    cancelledAt: o.cancelledAt,
    scheduledAt: o.scheduledAt,
    cancelledBy: o.cancelledBy,
    cancellationReason: cancellationReasonForDto(o),
    rejectionReason: o.rejectionReason,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    userId: slimRestaurantListUser(o.userId),
    restaurantId:
      typeof o.restaurantId === "object"
        ? omitNullish({
            _id: o.restaurantId._id,
            name: o.restaurantId.name || o.restaurantId.restaurantName,
          })
        : o.restaurantId,
    restaurantName: o.restaurantName,
    note: o.note,
    restaurantNote: o.restaurantNote,
    sendCutlery: o.sendCutlery,
    deliveryFleet: o.deliveryFleet,
    deliveryMode: o.deliveryMode || "basic",
    estimatedDeliveryTime,
    deliveryAddress: addr,
    address: addr,
    items: slimRestaurantListItems(o.items),
    pricing,
    payment: slimRestaurantListPayment(o.payment),
    paymentMethod: o.payment?.method || o.paymentMethod,
    total: pricing?.total ?? o.total,
    deliveryPartnerId: partnerSlim,
    dispatch,
    etaPromise,
    ratings,
    review: o.review
      ? omitNullish({
          rating: o.review.rating,
          comment: o.review.comment,
          text: o.review.text,
        })
      : undefined,
    feedback: o.feedback
      ? omitNullish({
          rating: o.feedback.rating,
          comment: o.feedback.comment,
          text: o.feedback.text,
        })
      : undefined,
    rating: ratingValue,
  });
}

/**
 * User order LIST — nested inclusion projection for GET /food/orders.
 * Detail/tracking use GET /food/orders/:id + ORDER_DETAIL_PROJECTION.
 */
export const USER_ORDER_LIST_SELECT = [
  "orderId",
  "orderType",
  "orderStatus",
  "createdAt",
  "updatedAt",
  "scheduledAt",
  "deliveredAt",
  "cancelledBy",
  "cancellationReason",
  "estimatedDeliveryTime",
  "deliveryMode",
  // Address text only (no GeoJSON)
  "deliveryAddress.formattedAddress",
  "deliveryAddress.address",
  "deliveryAddress.street",
  "deliveryAddress.label",
  "deliveryAddress.additionalDetails",
  "deliveryAddress.landmark",
  "deliveryAddress.addressLine1",
  "deliveryAddress.addressLine2",
  "deliveryAddress.area",
  "deliveryAddress.city",
  "deliveryAddress.state",
  "deliveryAddress.zipCode",
  "deliveryAddress.postalCode",
  "address.formattedAddress",
  "address.address",
  "address.street",
  "address.label",
  "address.additionalDetails",
  "address.landmark",
  "address.addressLine1",
  "address.addressLine2",
  "address.area",
  "address.city",
  "address.state",
  "address.zipCode",
  "address.postalCode",
  // Items — history card + reorder
  "items._id",
  "items.id",
  "items.itemId",
  "items.name",
  "items.foodName",
  "items.variantName",
  "items.quantity",
  "items.price",
  "items.image",
  "items.description",
  "items.isVeg",
  "items.category",
  "items.type",
  "items.sourceName",
  "pickupPoints.sourceName",
  "pickupPoints.image",
  "pickupPoints.name",
  "restaurantImage",
  // Pricing — Orders.jsx fee lines
  "pricing.total",
  "pricing.subtotal",
  "pricing.deliveryFee",
  "pricing.tax",
  "pricing.platformFee",
  "pricing.packagingFee",
  "pricing.discount",
  "pricing.couponCode",
  "pricing.appliedCoupon",
  "payment.method",
  "payment.status",
  "payment.refund",
  "paymentMethod",
  "restaurantId",
  "restaurantName",
  "ratings.restaurant.rating",
  "ratings.restaurant.comment",
  "ratings.deliveryPartner.rating",
  "ratings.deliveryPartner.comment",
  "dispatch.deliveryPartnerId",
  "dispatch.status",
  "deliveryState.status",
  "deliveryState.currentPhase",
  "deliveryState.deliveredAt",
  "etaPromise.min",
  "etaPromise.max",
  "etaPromise.mid",
  "etaPromise.startsAt",
  "etaPromise.endsAt",
  "etaPromise.prepMinutes",
  "etaPromise.kitchenPrepMinutes",
  "etaPromise.travelMinutes",
  "eta.min",
  "eta.max",
  "sla.breached",
  "sla.compensationAmount",
  "total",
].join(" ");

function slimUserListAddress(addr) {
  if (!addr || typeof addr !== "object") return addr || {};
  return {
    formattedAddress: addr.formattedAddress,
    address: addr.address,
    street: addr.street,
    label: addr.label,
    additionalDetails: addr.additionalDetails,
    landmark: addr.landmark,
    addressLine1: addr.addressLine1,
    addressLine2: addr.addressLine2,
    area: addr.area,
    city: addr.city,
    state: addr.state,
    zipCode: addr.zipCode,
    postalCode: addr.postalCode,
  };
}

function slimUserListItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    _id: item?._id,
    id: item?.id || item?._id,
    itemId: item?.itemId || item?._id || item?.id,
    name: item?.name || item?.foodName,
    foodName: item?.foodName || item?.name,
    variantName: item?.variantName || "",
    quantity: item?.quantity,
    price: item?.price,
    image: item?.image || null,
    description: item?.description || null,
    isVeg: item?.isVeg,
    category: item?.category,
    type: item?.type,
    sourceName: item?.sourceName || "",
  }));
}

function slimUserListPricing(pricing) {
  if (!pricing || typeof pricing !== "object") return undefined;
  const couponCode =
    pricing.couponCode ||
    pricing.appliedCoupon?.code ||
    pricing.appliedCoupon?.couponCode ||
    undefined;
  return {
    total: pricing.total,
    subtotal: pricing.subtotal,
    deliveryFee: pricing.deliveryFee,
    tax: pricing.tax,
    platformFee: pricing.platformFee,
    packagingFee: pricing.packagingFee,
    discount: pricing.discount,
    couponCode,
  };
}

function slimUserListPayment(payment) {
  if (!payment || typeof payment !== "object") return undefined;
  return {
    method: payment.method,
    status: payment.status,
    refund: slimRefund(payment.refund),
  };
}

function slimUserListRestaurant(restaurantId) {
  if (!restaurantId) return restaurantId;
  if (typeof restaurantId !== "object") return restaurantId;
  const area = restaurantId.area || restaurantId.location?.area || "";
  const city = restaurantId.city || restaurantId.location?.city || "";
  return {
    _id: restaurantId._id,
    restaurantName: restaurantId.restaurantName || restaurantId.name,
    name: restaurantId.name || restaurantId.restaurantName,
    slug: restaurantId.slug || null,
    profileImage: restaurantId.profileImage,
    area,
    city,
    location: { area, city },
  };
}

function slimUserListPartner(partner) {
  if (!partner) return partner;
  if (typeof partner !== "object") return partner;
  return {
    _id: partner._id,
    name: partner.name,
    phone: partner.phone,
  };
}

function slimUserListRatings(ratings) {
  if (!ratings || typeof ratings !== "object") return undefined;
  const out = {};
  if (ratings.restaurant) {
    out.restaurant = {
      rating: ratings.restaurant.rating,
      comment: ratings.restaurant.comment,
    };
  }
  if (ratings.deliveryPartner) {
    out.deliveryPartner = {
      rating: ratings.deliveryPartner.rating,
      comment: ratings.deliveryPartner.comment,
    };
  }
  return Object.keys(out).length ? out : undefined;
}

function slimUserListEta(etaPromise) {
  if (!etaPromise || typeof etaPromise !== "object") return undefined;
  if (
    etaPromise.min == null &&
    etaPromise.max == null &&
    !etaPromise.endsAt &&
    !etaPromise.startsAt
  ) {
    return undefined;
  }
  return omitNullish({
    min: etaPromise.min,
    max: etaPromise.max,
    mid: etaPromise.mid,
    startsAt: etaPromise.startsAt,
    endsAt: etaPromise.endsAt,
    prepMinutes: etaPromise.prepMinutes ?? etaPromise.kitchenPrepMinutes,
    kitchenPrepMinutes: etaPromise.kitchenPrepMinutes ?? etaPromise.prepMinutes,
    travelMinutes: etaPromise.travelMinutes,
  });
}

function slimUserListSla(sla) {
  if (!sla || typeof sla !== "object") return undefined;
  if (!sla.breached && sla.compensationAmount == null) return undefined;
  return {
    breached: Boolean(sla.breached),
    compensationAmount: sla.compensationAmount,
  };
}

/**
 * UserOrderListDTO — list surfaces only:
 * Orders.jsx, OrderTrackingCard, OrderTracking list-fallback,
 * Support.jsx, Cart pagination.total, socket identity matching.
 * Omits LEGACY unused: note, activatedAt, preparationTime, review.
 */
export function toUserOrderListDto(orderLike) {
  const o = asPlain(orderLike);
  const mongoId = idStr(o._id || o.orderMongoId);
  const orderStatus = o.orderStatus || o.status;
  const addr = slimUserListAddress(o.deliveryAddress || o.address);
  const partner =
    o.deliveryPartnerId ||
    o.dispatch?.deliveryPartnerId ||
    null;
  const partnerSlim = slimUserListPartner(partner);
  const restaurant = slimUserListRestaurant(o.restaurantId);
  const pickupPoints = Array.isArray(o.pickupPoints)
    ? o.pickupPoints
        .map((point) => ({
          sourceName: point?.sourceName || point?.name || point?.shopName || "",
          name: point?.name || point?.sourceName || "",
          image: point?.image || point?.shopImage || "",
        }))
        .filter((point) => point.sourceName || point.image)
    : [];
  const pickupName = pickupPoints[0]?.sourceName || "";
  const pickupImage = pickupPoints[0]?.image || "";
  const itemStoreName = (Array.isArray(o.items) ? o.items : []).find(
    (item) => String(item?.sourceName || "").trim(),
  )?.sourceName;
  const pricing = slimUserListPricing(o.pricing);
  const etaPromise = slimUserListEta(o.etaPromise);
  const sla = slimUserListSla(o.sla);
  const ratings = slimUserListRatings(o.ratings);
  const eta = o.eta
    ? { min: o.eta.min, max: o.eta.max }
    : o.estimatedDeliveryTime
      ? { min: o.estimatedDeliveryTime, max: o.estimatedDeliveryTime }
      : undefined;

  const dto = {
    _id: o._id,
    orderMongoId: o.orderMongoId || mongoId,
    orderId: o.orderId || mongoId,
    orderType: o.orderType || "food",
    orderStatus,
    status: orderStatus,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    scheduledAt: o.scheduledAt,
    deliveredAt: o.deliveredAt || o.deliveryState?.deliveredAt || null,
    cancelledBy: o.cancelledBy,
    cancellationReason: cancellationReasonForDto(o),
    estimatedDeliveryTime: o.estimatedDeliveryTime,
    deliveryMode: o.deliveryMode || "basic",
    deliveryAddress: addr,
    address: addr,
    items: slimUserListItems(o.items),
    pricing,
    payment: slimUserListPayment(o.payment),
    paymentMethod: o.payment?.method || o.paymentMethod,
    restaurantId: restaurant,
    restaurantName:
      o.restaurantName ||
      restaurant?.restaurantName ||
      restaurant?.name ||
      pickupName ||
      itemStoreName ||
      undefined,
    storeName:
      o.storeName ||
      o.sellerName ||
      o.restaurantName ||
      pickupName ||
      itemStoreName ||
      undefined,
    restaurantImage:
      o.restaurantImage ||
      o.storeImage ||
      restaurant?.profileImage ||
      pickupImage ||
      undefined,
    storeImage: o.storeImage || o.restaurantImage || pickupImage || undefined,
    pickupPoints,
    deliveryPartnerId: partnerSlim,
    deliveryPartnerName: partnerSlim?.name || o.deliveryPartnerName,
    deliveryPartnerPhone: partnerSlim?.phone || o.deliveryPartnerPhone,
    deliveryState: o.deliveryState
      ? {
          status: o.deliveryState.status,
          currentPhase: o.deliveryState.currentPhase,
        }
      : undefined,
    total: pricing?.total ?? o.total,
  };

  const dispatchSlim = slimDispatch(o.dispatch);
  if (dispatchSlim) {
    dto.dispatch = {
      status: dispatchSlim.status,
    };
  }

  if (ratings) dto.ratings = ratings;
  if (etaPromise) dto.etaPromise = etaPromise;
  if (eta) dto.eta = eta;
  if (sla) dto.sla = sla;

  return dto;
}
