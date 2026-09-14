/**
 * Customer-facing Quick Commerce order payloads.
 * Quick orders reuse the FoodOrder collection, so raw lean docs contain many
 * food-only / internal fields. Never spread the full document to clients.
 */

import { resolveQuickOrderCancellationReason } from './cancellation.helpers.js';

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const str = (value, fallback = '') => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') {
    const nested =
      value.formattedAddress ||
      value.address ||
      value.shopName ||
      value.name ||
      value.label ||
      value.title;
    if (nested != null && nested !== value) return str(nested, fallback);
    return fallback;
  }
  const text = String(value).trim();
  return text || fallback;
};

const mapQuickOrderItem = (item = {}) => ({
  itemId: item.itemId || item.productId || item._id || '',
  name: str(item.name, 'Item'),
  type: 'quick',
  sourceId: item.sourceId || item.sellerId || '',
  sourceName: str(item.sourceName || item.sellerName || item.storeName, ''),
  price: num(item.price),
  quantity: num(item.quantity),
  isVeg: Boolean(item.isVeg),
  image: item.image || item.mainImage || null,
  variantName: str(item.variantName || item.notes),
  notes: str(item.notes || item.variantName),
  ...(item.headerId ? { headerId: str(item.headerId) } : {}),
  ...(item.returnsEnabled !== undefined ? { returnsEnabled: Boolean(item.returnsEnabled) } : {}),
  ...(item.returnWindowHours != null ? { returnWindowHours: num(item.returnWindowHours) } : {}),
  ...(item.pharmacyDetails ? { pharmacyDetails: item.pharmacyDetails } : {}),
});

const mapPickupPoint = (point = {}, sellerFallback = null) => {
  const coords = Array.isArray(point?.location?.coordinates)
    ? point.location.coordinates
    : Array.isArray(sellerFallback?.location?.coordinates)
      ? sellerFallback.location.coordinates
      : null;

  return {
    pickupType: 'quick',
    sourceId: point.sourceId || sellerFallback?._id || sellerFallback?.id || '',
    sourceName: str(
      point.sourceName || sellerFallback?.shopName || sellerFallback?.name,
      'Store',
    ),
    address: str(
      point.address ||
        sellerFallback?.address ||
        sellerFallback?.location?.formattedAddress ||
        sellerFallback?.location?.address,
    ),
    phone: str(point.phone || sellerFallback?.phone || sellerFallback?.phoneNumber),
    image: str(
      point.image ||
        sellerFallback?.shopImage ||
        sellerFallback?.image ||
        sellerFallback?.shopInfo?.shopImage,
    ) || null,
    ...(coords
      ? {
          location: {
            type: 'Point',
            coordinates: coords,
            ...(point.location?.formattedAddress || sellerFallback?.location?.formattedAddress
              ? {
                  formattedAddress: str(
                    point.location?.formattedAddress ||
                      sellerFallback?.location?.formattedAddress,
                  ),
                  address: str(
                    point.location?.address ||
                      sellerFallback?.location?.address ||
                      point.address,
                  ),
                }
              : {}),
          },
        }
      : {}),
  };
};

/** Bill fields customers need — drop food/internal finance noise. */
export const mapQuickCustomerPricing = (pricing = {}) => ({
  subtotal: num(pricing.subtotal),
  tax: num(pricing.tax ?? pricing.gst),
  gst: num(pricing.gst ?? pricing.tax),
  packagingFee: num(pricing.packagingFee ?? pricing.packingFee),
  deliveryFee: num(pricing.deliveryFee),
  platformFee: num(pricing.platformFee),
  handlingFee: num(pricing.handlingFee),
  discount: num(pricing.discount),
  couponCode: pricing.couponCode || null,
  appliedCoupon: pricing.appliedCoupon
    ? {
        code: pricing.appliedCoupon.code || null,
        discount: num(pricing.appliedCoupon.discount),
        source: pricing.appliedCoupon.source || null,
      }
    : { code: null, discount: 0, source: null },
  deliveryDistanceKm: num(pricing.deliveryDistanceKm),
  distanceEstimated: Boolean(pricing.distanceEstimated),
  total: num(pricing.total),
  currency: str(pricing.currency, 'INR'),
});

const mapCustomerPayment = (payment = {}) => {
  const refund = payment.refund || null;
  return {
    method: str(payment.method),
    status: str(payment.status),
    amountDue: num(payment.amountDue),
    ...(refund
      ? {
          refund: {
            status: str(refund.status),
            amount: num(refund.amount),
            refundId: str(refund.refundId),
            processedMethod: str(refund.processedMethod || refund.requestedMethod),
            reason: str(refund.reason),
            processedAt: refund.processedAt || null,
            requestedAt: refund.requestedAt || null,
          },
        }
      : {}),
    ...(payment.razorpay?.orderId || payment.razorpay?.paymentId
      ? {
          razorpay: {
            orderId: str(payment.razorpay?.orderId),
            paymentId: str(payment.razorpay?.paymentId),
          },
        }
      : {}),
  };
};

const mapStatusHistory = (history = []) =>
  (Array.isArray(history) ? history : []).map((entry) => ({
    at: entry.at || entry.createdAt || null,
    byRole: str(entry.byRole, 'SYSTEM'),
    from: str(entry.from),
    to: str(entry.to),
    note: str(entry.note),
  }));

const mapEtaPromise = (eta = {}) => {
  if (!eta || typeof eta !== 'object') return null;
  return {
    min: eta.min ?? null,
    max: eta.max ?? null,
    mid: eta.mid ?? null,
    startsAt: eta.startsAt || null,
    endsAt: eta.endsAt || null,
    prepMinutes: eta.prepMinutes ?? eta.kitchenPrepMinutes ?? null,
  };
};

const mapSla = (sla = {}) => {
  if (!sla || typeof sla !== 'object') return null;
  return {
    breached: Boolean(sla.breached),
    delayMinutes: num(sla.delayMinutes),
    compensationAmount: num(sla.compensationAmount),
    compensationStatus: str(sla.compensationStatus),
  };
};

const mongooseIsObjectIdLike = (value) => {
  if (value == null || typeof value === 'object') return false;
  return /^[a-f\d]{24}$/i.test(String(value));
};

const mapDeliveryPartnerPayload = (partner) => {
  if (!partner) return null;
  if (typeof partner !== 'object' || mongooseIsObjectIdLike(partner)) return null;
  const name = str(partner.name || partner.fullName || partner.displayName);
  const phone = str(partner.phone || partner.phoneNumber);
  if (!name && !phone && !(partner._id || partner.id)) return null;
  return {
    _id: partner._id || partner.id || null,
    id: partner._id || partner.id || null,
    name: name || 'Delivery Partner',
    phone,
    phoneNumber: phone,
    avatar: str(partner.avatar || partner.profilePhoto || partner.profilePicture || partner.profileImage) || null,
    rating: Number.isFinite(Number(partner.rating)) ? Number(partner.rating) : null,
    totalRatings: Number(partner.totalRatings || 0),
  };
};

const mapDispatch = (dispatch = {}, deliveryPartner = null) => {
  const partnerPayload = mapDeliveryPartnerPayload(deliveryPartner);
  return {
    status: str(dispatch.status, 'unassigned'),
    deliveryPartnerId: partnerPayload || dispatch.deliveryPartnerId || null,
  };
};

const mapDeliveryState = (state = {}) => ({
  currentPhase: str(state.currentPhase),
  status: str(state.status),
  reachedPickupAt: state.reachedPickupAt || null,
  reachedDropAt: state.reachedDropAt || null,
  pickedUpAt: state.pickedUpAt || null,
  deliveredAt: state.deliveredAt || null,
  billImageUrl: str(state.billImageUrl),
  ...(state.currentLocation ? { currentLocation: state.currentLocation } : {}),
});

const mapCustomerAddress = (deliveryAddress = {}, fallbackCoords = null) => {
  const street = str(deliveryAddress.street || deliveryAddress.address);
  const formattedAddress = str(
    deliveryAddress.formattedAddress ||
      [
        street,
        deliveryAddress.additionalDetails,
        deliveryAddress.city,
        deliveryAddress.state,
        deliveryAddress.zipCode || deliveryAddress.pincode,
      ]
        .map((part) => str(part))
        .filter(Boolean)
        .join(', '),
  );

  const coords = Array.isArray(deliveryAddress.location?.coordinates)
    ? deliveryAddress.location.coordinates
    : fallbackCoords
      ? [fallbackCoords.lng, fallbackCoords.lat]
      : null;

  const lat = Number(
    deliveryAddress.location?.lat ??
      deliveryAddress.location?.latitude ??
      (coords ? coords[1] : undefined) ??
      fallbackCoords?.lat,
  );
  const lng = Number(
    deliveryAddress.location?.lng ??
      deliveryAddress.location?.longitude ??
      (coords ? coords[0] : undefined) ??
      fallbackCoords?.lng,
  );

  return {
    type: str(deliveryAddress.label || deliveryAddress.type, 'Other'),
    name: str(deliveryAddress.name),
    street,
    address: street,
    additionalDetails: str(deliveryAddress.additionalDetails),
    formattedAddress: formattedAddress || street,
    city: str(deliveryAddress.city),
    state: str(deliveryAddress.state),
    zipCode: str(deliveryAddress.zipCode || deliveryAddress.pincode),
    phone: str(deliveryAddress.phone),
    ...(Number.isFinite(lat) && Number.isFinite(lng)
      ? {
          location: {
            type: 'Point',
            coordinates: [lng, lat],
            lat,
            lng,
          },
        }
      : {}),
  };
};

const mapSellerPayload = (seller) => {
  if (!seller) return null;
  const shopImage = str(seller.shopImage || seller.image || seller.shopInfo?.shopImage);
  const phone = str(seller.phone || seller.phoneNumber || seller.shopInfo?.alternatePhone);
  const address = str(
    seller.address || seller.location?.formattedAddress || seller.location?.address,
  );

  return {
    _id: seller._id,
    id: seller._id || seller.id,
    name: str(seller.shopName || seller.name, 'Store'),
    shopName: str(seller.shopName || seller.name, 'Store'),
    phone,
    phoneNumber: phone,
    image: shopImage || null,
    shopImage: shopImage || null,
    address,
    location: seller.location || null,
    shopInfo: {
      shopImage: shopImage || '',
      alternatePhone: str(seller.shopInfo?.alternatePhone),
    },
  };
};

/**
 * Build a lean customer order detail for GET /quick-commerce/orders/:id
 */
export const toQuickCustomerOrderDetail = ({
  order,
  seller = null,
  sellerOrder = null,
  customer = null,
  deliveryPartner = null,
  returnEligibility = null,
  returnSummary = null,
  handoverOtp = '',
} = {}) => {
  if (!order) return null;

  const sellerPayload = mapSellerPayload(seller);
  const deliveryPartnerPayload = mapDeliveryPartnerPayload(
    deliveryPartner ||
      (typeof order?.dispatch?.deliveryPartnerId === 'object'
        ? order.dispatch.deliveryPartnerId
        : null),
  );
  const deliveryAddress = order.deliveryAddress || {};
  const deliveryCoords = Array.isArray(deliveryAddress.location?.coordinates)
    ? {
        lat: Number(deliveryAddress.location.coordinates[1]),
        lng: Number(deliveryAddress.location.coordinates[0]),
      }
    : null;

  const address = mapCustomerAddress(deliveryAddress, deliveryCoords);
  const customerName = str(
    customer?.name ||
      customer?.fullName ||
      address.name ||
      deliveryAddress.name ||
      sellerOrder?.customer?.name,
  );
  const customerPhone = str(
    customer?.phone ||
      address.phone ||
      deliveryAddress.phone ||
      sellerOrder?.customer?.phone,
  );
  if (customerName && !address.name) address.name = customerName;
  if (customerPhone && !address.phone) address.phone = customerPhone;

  const cancellationReason = resolveQuickOrderCancellationReason(order, sellerOrder);
  const dropOtp = order.deliveryVerification?.dropOtp || {};
  const pickupSource =
    Array.isArray(order.pickupPoints) && order.pickupPoints.length > 0
      ? order.pickupPoints.map((point) => mapPickupPoint(point, sellerPayload))
      : sellerPayload
        ? [mapPickupPoint({}, sellerPayload)]
        : [];

  const pricing = mapQuickCustomerPricing(order.pricing || {});
  const payment = mapCustomerPayment(order.payment || {});
  const userIdPayload = customer
    ? {
        _id: customer._id || customer.id || order.userId,
        id: customer._id || customer.id || order.userId,
        name: customerName,
        fullName: customerName,
        phone: customerPhone,
      }
    : order.userId || null;

  return {
    id: order._id,
    _id: order._id,
    orderType: 'quick',
    orderId: order.orderId,
    orderNumber: order.orderId,
    sessionId: order.sessionId || null,
    userId: userIdPayload,
    userName: customerName,
    customerName,
    userPhone: customerPhone,
    customerPhone,
    customer: customerName || customerPhone
      ? { name: customerName, phone: customerPhone }
      : null,
    orderStatus: order.orderStatus,
    status: order.orderStatus,
    workflowStatus: order.workflowStatus || sellerOrder?.workflowStatus || '',
    items: (Array.isArray(order.items) ? order.items : []).map(mapQuickOrderItem),
    pickupPoints: pickupSource,
    deliveryAddress: {
      label: address.type,
      type: address.type,
      name: address.name,
      street: address.street,
      address: address.street || address.address,
      additionalDetails: address.additionalDetails,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      phone: address.phone,
      ...(address.location ? { location: address.location } : {}),
      ...(address.formattedAddress ? { formattedAddress: address.formattedAddress } : {}),
    },
    address,
    pricing,
    payment,
    paymentMethod: payment.method,
    paymentStatus: payment.status,
    deliveryMode: str(order.deliveryMode, 'basic'),
    etaPromise: mapEtaPromise(order.etaPromise),
    sla: mapSla(order.sla),
    note: str(order.note),
    cancellationReason,
    cancelledBy: order.cancelledBy || null,
    statusHistory: mapStatusHistory(order.statusHistory),
    dispatch: mapDispatch(order.dispatch || {}, deliveryPartnerPayload),
    deliveryPartner: deliveryPartnerPayload,
    deliveryPartnerId: deliveryPartnerPayload || order.dispatch?.deliveryPartnerId || null,
    deliveryPartnerName: deliveryPartnerPayload?.name || '',
    deliveryPartnerPhone: deliveryPartnerPayload?.phone || '',
    deliveryState: mapDeliveryState(order.deliveryState || {}),
    deliveryVerification: {
      dropOtp: {
        required: Boolean(dropOtp.required),
        verified: Boolean(dropOtp.verified),
      },
    },
    ...(dropOtp.required && !dropOtp.verified && handoverOtp
      ? { handoverOtp: String(handoverOtp) }
      : {}),
    seller: sellerPayload,
    restaurantName: sellerPayload?.shopName || sellerPayload?.name || '',
    storeName: sellerPayload?.shopName || sellerPayload?.name || '',
    sellerName: sellerPayload?.shopName || sellerPayload?.name || '',
    restaurantImage: sellerPayload?.shopImage || null,
    storeImage: sellerPayload?.shopImage || null,
    sellerImage: sellerPayload?.shopImage || null,
    restaurantPhone: sellerPayload?.phone || '',
    restaurantAddress: sellerPayload?.address || '',
    sellerOrder: sellerOrder
      ? {
          _id: sellerOrder._id,
          status: sellerOrder.status,
          workflowStatus: sellerOrder.workflowStatus,
          cancellationReason: str(sellerOrder.cancellationReason),
          customer: sellerOrder.customer || null,
        }
      : null,
    ratings: order.ratings || null,
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    deliveredAt:
      order.deliveryState?.deliveredAt ||
      order.deliveredAt ||
      null,
    ...(returnEligibility
      ? {
          returnEligibility,
          canReturn: Boolean(returnEligibility.canReturn),
          returnsEnabled: Boolean(returnEligibility.returnsEnabled),
          returnWindowHours: num(returnEligibility.returnWindowHours),
          returnExpiryAt: returnEligibility.returnExpiryAt || null,
          remainingSeconds: num(returnEligibility.remainingSeconds),
          remainingHours: num(returnEligibility.remainingHours),
          returnWindowExpired: Boolean(returnEligibility.returnWindowExpired),
          itemEligibility: returnEligibility.itemEligibility || {},
        }
      : {}),
    ...(returnSummary
      ? {
          returnStatus: returnSummary.returnStatus || order.returnStatus || '',
          returnStatusLabel: returnSummary.returnStatusLabel || '',
          hasReturn: Boolean(returnSummary.hasReturn),
          returnSummary,
          returns: returnSummary.returns || [],
          originalPaidTotal: returnSummary.originalPaidTotal,
          refundedAmount: returnSummary.refundedAmount,
          netAfterReturn: returnSummary.netAfterReturn,
        }
      : {
          returnStatus: order.returnStatus || '',
          hasReturn: Boolean(order.returnStatus),
        }),
  };
};
