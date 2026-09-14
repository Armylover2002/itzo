import mongoose from 'mongoose';
import { ValidationError } from '../../../core/auth/errors.js';
import { logger } from '../../../utils/logger.js';
import { roadDistanceKm } from '../../food/orders/services/order.helpers.js';
import { QuickOrder } from '../models/order.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { getActiveFeeSettings, calculateRiderEarningBreakdown, getRiderEarning } from '../admin/services/billing.service.js';
import { getSellerLocation, getOrderAddressPoint } from '../services/quickOrder.service.js';
import {
  RETURN_OTP_MAX_ATTEMPTS,
  RETURN_OTP_TTL_MS,
  RETURN_TRIP_TYPE,
  DISPATCH_DOCUMENT_TYPES,
} from '../utils/dispatchDocument.constants.js';
import { generateReturnOtp, resolveReturnPickupCharge } from './return.helpers.js';
import { resolveQuickOrderCustomer, isGenericCustomerLabel } from './customer.helpers.js';
import { FoodUser } from '../../../core/users/user.model.js';

export { resolveReturnPickupCharge };

const num = (value) => Number(value || 0);

export const stampReturnOtps = (returnDoc) => {
  const expiresAt = new Date(Date.now() + RETURN_OTP_TTL_MS);
  returnDoc.customerOtp = generateReturnOtp();
  returnDoc.sellerOtp = generateReturnOtp();
  returnDoc.customerOtpExpiresAt = expiresAt;
  returnDoc.sellerOtpExpiresAt = expiresAt;
  returnDoc.customerOtpAttempts = 0;
  returnDoc.sellerOtpAttempts = 0;
  return returnDoc;
};

export const verifyReturnOtp = ({
  returnDoc,
  role,
  otp,
  incrementOnFailure = true,
}) => {
  const normalizedOtp = String(otp || '').trim();
  if (!normalizedOtp) throw new ValidationError('OTP is required');

  const isCustomer = role === 'customer';
  const field = isCustomer ? 'customerOtp' : 'sellerOtp';
  const expiresField = isCustomer ? 'customerOtpExpiresAt' : 'sellerOtpExpiresAt';
  const attemptsField = isCustomer ? 'customerOtpAttempts' : 'sellerOtpAttempts';

  const expected = String(returnDoc?.[field] || '').trim();
  const expiresAt = returnDoc?.[expiresField] ? new Date(returnDoc[expiresField]) : null;
  const attempts = num(returnDoc?.[attemptsField]);

  if (!expected) throw new ValidationError('OTP is not configured for this return');
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    throw new ValidationError('OTP has expired');
  }
  if (attempts >= RETURN_OTP_MAX_ATTEMPTS) {
    throw new ValidationError('Maximum OTP attempts exceeded');
  }

  if (expected !== normalizedOtp) {
    if (incrementOnFailure) {
      returnDoc[attemptsField] = attempts + 1;
    }
    throw new ValidationError('Invalid OTP');
  }

  return true;
};

/** Persist sub-km distances with 3dp (same raw haversine as order placement). */
const normalizeStoredPickupDistanceKm = (rawKm) => {
  const d = Number(rawKm);
  if (!Number.isFinite(d) || d <= 0) return 0;
  return Math.round(d * 1000) / 1000;
};

const resolveReturnPickupCoords = (parentOrder, seller) => ({
  customerCoords: parentOrder ? getOrderAddressPoint(parentOrder) : null,
  sellerCoords: seller ? getSellerLocation(seller) : null,
});

export const computePickupDistanceKm = async (customerCoords, sellerCoords) => {
  if (!customerCoords || !sellerCoords) return 0;
  const raw = await roadDistanceKm(
    customerCoords.lat,
    customerCoords.lng,
    sellerCoords.lat,
    sellerCoords.lng,
  );
  return normalizeStoredPickupDistanceKm(raw);
};

export const computeReturnPickupPricing = async ({ customerCoords, sellerCoords } = {}) => {
  if (!customerCoords || !sellerCoords) {
    return {
      pickupDistanceKm: 0,
      distanceKm: 0,
      calculatedPickupCharge: 0,
      riderEarning: 0,
      pickupPricingBreakdown: null,
    };
  }

  const rawDistanceKm = await roadDistanceKm(
    customerCoords.lat,
    customerCoords.lng,
    sellerCoords.lat,
    sellerCoords.lng,
  );
  const pickupDistanceKm = normalizeStoredPickupDistanceKm(rawDistanceKm);
  const feeSettings = await getActiveFeeSettings();
  const breakdown = calculateRiderEarningBreakdown(feeSettings, rawDistanceKm);
  const earning = Number(breakdown.earning || 0) || (await getRiderEarning(rawDistanceKm));
  const pickupPricingBreakdown = {
    earning,
    distanceKm: pickupDistanceKm,
    basePayout: Number(breakdown.basePayout || 0),
    baseFee: Number(breakdown.basePayout || 0),
    perKmRate: Number(breakdown.perKmRate || 0),
    baseKm: Number(breakdown.baseKm || 0),
    extraKm: Number(breakdown.extraKm || 0),
  };

  return {
    pickupDistanceKm,
    distanceKm: pickupDistanceKm,
    calculatedPickupCharge: earning,
    riderEarning: earning,
    pickupPricingBreakdown,
  };
};

export const applyReturnPickupPricingToDoc = async (returnDoc) => {
  if (!returnDoc) return returnDoc;

  const ctx = await loadReturnPickupContext(returnDoc, { forceRecalculate: true });
  returnDoc.pickupDistanceKm = ctx.pickupDistanceKm;
  returnDoc.calculatedPickupCharge = ctx.calculatedPickupCharge;
  returnDoc.pickupPricingBreakdown = ctx.pickupPricingBreakdown;
  returnDoc.riderEarning = ctx.riderEarning;
  return returnDoc;
};

export const loadReturnPickupContext = async (returnDoc, { forceRecalculate = false } = {}) => {
  const parentOrder = returnDoc?.parentOrderId
    ? await QuickOrder.findById(returnDoc.parentOrderId).lean()
    : await QuickOrder.findOne({
        orderId: returnDoc.orderId,
        orderType: { $in: ['quick', 'mixed'] },
      }).lean();

  const seller = await Seller.findById(returnDoc.sellerId).lean();
  const { customerCoords, sellerCoords } = resolveReturnPickupCoords(parentOrder, seller);
  const computedDistanceKm = await computePickupDistanceKm(customerCoords, sellerCoords);

  const storedCharge = num(returnDoc?.calculatedPickupCharge);
  const storedRider = num(returnDoc?.riderEarning);
  const legacyCharge = num(returnDoc?.returnDeliveryCommission);

  if (!forceRecalculate && (storedCharge > 0 || storedRider > 0 || legacyCharge > 0)) {
    const charge = resolveReturnPickupCharge(returnDoc);
    const pickupDistanceKm =
      computedDistanceKm > 0 ? computedDistanceKm : num(returnDoc?.pickupDistanceKm);
    const storedBreakdown = returnDoc?.pickupPricingBreakdown || null;
    const pickupPricingBreakdown = storedBreakdown
      ? { ...storedBreakdown, distanceKm: pickupDistanceKm }
      : null;

    return {
      parentOrder,
      seller,
      customerCoords,
      sellerCoords,
      pickupDistanceKm,
      calculatedPickupCharge: storedCharge || charge,
      riderEarning: charge,
      pickupPricingBreakdown,
    };
  }

  const pricing = await computeReturnPickupPricing({ customerCoords, sellerCoords });
  if (pricing.calculatedPickupCharge <= 0 && legacyCharge > 0) {
    pricing.riderEarning = legacyCharge;
    pricing.calculatedPickupCharge = 0;
  }

  if (pricing.riderEarning <= 0 && !legacyCharge) {
    logger.warn(
      `[ReturnPickup] Delivery commission rules produced zero earning for return ${returnDoc?._id || returnDoc?.orderId || 'unknown'} — configure distance slabs in Billing.`,
    );
  }

  return {
    parentOrder,
    seller,
    customerCoords,
    sellerCoords,
    ...pricing,
  };
};

export const buildReturnDeliverySocketPayload = async (returnDoc, context = null) => {
  const ctx = context || (await loadReturnPickupContext(returnDoc));
  const { parentOrder, seller, customerCoords, sellerCoords } = ctx;

  const customerAddress = parentOrder?.deliveryAddress || {};
  let hydratedParent = parentOrder || {};
  const rawUser = hydratedParent?.userId;
  const userAlreadyPopulated = Boolean(
    rawUser &&
      typeof rawUser === 'object' &&
      (rawUser.name || rawUser.fullName || rawUser.phone || rawUser.email),
  );
  const parentUserId = userAlreadyPopulated
    ? rawUser._id || rawUser.id
    : rawUser || returnDoc?.userId;
  if (!userAlreadyPopulated && parentUserId) {
    try {
      const user = await FoodUser.findById(parentUserId).select('name fullName phone').lean();
      if (user) hydratedParent = { ...hydratedParent, userId: user };
    } catch {
      /* keep unpopulated parent */
    }
  }
  const resolvedCustomer = resolveQuickOrderCustomer(hydratedParent);
  const fromReturnDoc = String(returnDoc?.customer?.name || '').trim();
  const resolvedCustomerName = !isGenericCustomerLabel(fromReturnDoc)
    ? fromReturnDoc
    : resolvedCustomer.name || customerAddress?.name || 'Customer';
  const resolvedCustomerPhone =
    returnDoc?.customer?.phone ||
    resolvedCustomer.phone ||
    customerAddress?.phone ||
    parentOrder?.userPhone ||
    '';
  const customerAddressText = [
    customerAddress.formattedAddress,
    customerAddress.street || customerAddress.address,
    customerAddress.city,
    customerAddress.state,
    customerAddress.zipCode,
  ]
    .filter(Boolean)
    .join(', ');

  const sellerAddressText = [
    seller?.location?.formattedAddress,
    seller?.location?.address,
    seller?.shopInfo?.formattedAddress,
  ]
    .filter(Boolean)
    .join(', ');

  const storeName = seller?.shopName || seller?.name || 'Seller store';
  const sellerName = seller?.name || seller?.shopName || 'Seller';
  const sellerPhone = seller?.phone || '';
  const resolvedCharge = resolveReturnPickupCharge(returnDoc?.toObject?.() || returnDoc);
  const resolvedRiderEarning = Math.max(resolvedCharge, num(ctx.riderEarning));
  const breakdown = ctx.pickupPricingBreakdown || returnDoc?.pickupPricingBreakdown || null;
  const pickupDistanceKm = num(ctx.pickupDistanceKm ?? returnDoc?.pickupDistanceKm);

  const returnId = String(returnDoc._id);
  const pickupPoint = {
    legId: `return-pickup:${returnId}`,
    pickupType: 'quick',
    sourceId: String(returnDoc.userId || ''),
    sourceName: resolvedCustomerName,
    address: customerAddressText,
    phone: resolvedCustomerPhone,
    location: customerCoords
      ? {
          coordinates: [customerCoords.lng, customerCoords.lat],
          lat: customerCoords.lat,
          lng: customerCoords.lng,
          address: customerAddressText,
        }
      : undefined,
  };

  const dropPoint = {
    legId: `return-drop:${returnId}`,
    pickupType: 'quick',
    sourceId: String(returnDoc.sellerId || ''),
    sourceName: storeName,
    address: sellerAddressText,
    phone: sellerPhone,
    location: sellerCoords
      ? {
          coordinates: [sellerCoords.lng, sellerCoords.lat],
          lat: sellerCoords.lat,
          lng: sellerCoords.lng,
          address: sellerAddressText,
        }
      : undefined,
  };

  return {
    documentType: DISPATCH_DOCUMENT_TYPES.SELLER_RETURN,
    tripType: RETURN_TRIP_TYPE,
    tripLabel: 'Return Pickup',
    displayTitle: 'Return Pickup',
    returnId,
    orderMongoId: returnId,
    orderId: returnDoc.orderId,
    parentOrderId: returnDoc.orderId,
    sellerId: String(returnDoc.sellerId || ''),
    customerId: returnDoc.userId ? String(returnDoc.userId) : '',
    orderType: 'quick',
    orderStatus: returnDoc.returnStatus,
    status: returnDoc.returnStatus,
    returnStatus: returnDoc.returnStatus,
    items: returnDoc.returnItems || [],
    pricing: { subtotal: num(returnDoc.returnRefundAmount), total: num(returnDoc.returnRefundAmount) },
    total: num(returnDoc.returnRefundAmount),
    paymentMethod: 'prepaid',
    restaurantName: storeName,
    restaurantAddress: sellerAddressText,
    restaurantPhone: sellerPhone,
    storeName,
    storeAddress: sellerAddressText,
    storePhone: sellerPhone,
    sellerName,
    sellerPhone,
    seller: seller
      ? {
          _id: String(seller._id || ''),
          name: sellerName,
          shopName: storeName,
          phone: sellerPhone,
          location: seller.location || {},
        }
      : undefined,
    restaurantLocation: sellerCoords
      ? {
          latitude: sellerCoords.lat,
          longitude: sellerCoords.lng,
          address: sellerAddressText,
          coordinates: [sellerCoords.lng, sellerCoords.lat],
        }
      : {},
    deliveryAddress: customerAddress,
    customerAddress: customerAddressText,
    customerLocation: customerCoords,
    customerName: resolvedCustomerName,
    customerPhone: resolvedCustomerPhone,
    userName: resolvedCustomerName,
    userPhone: resolvedCustomerPhone,
    pickupPoints: [pickupPoint],
    dropPoint,
    dispatchLeg: pickupPoint,
    dispatch: returnDoc.dispatch || {},
    riderEarning: resolvedRiderEarning,
    earnings: resolvedRiderEarning,
    calculatedPickupCharge: num(returnDoc?.calculatedPickupCharge) || resolvedRiderEarning,
    returnPickupFee: resolvedRiderEarning,
    tripEarning: resolvedRiderEarning,
    walletEarning: resolvedRiderEarning,
    deliveryFee: resolvedRiderEarning,
    pickupDistanceKm,
    distanceKm: pickupDistanceKm,
    pickupPricingBreakdown: breakdown,
    deliveryState: returnDoc.deliveryState || {},
    note: returnDoc.returnReason || '',
    createdAt: returnDoc.createdAt,
    updatedAt: returnDoc.updatedAt,
  };
};

export const normalizePickupImageEntries = (images = [], { actorId, actorRole = 'DELIVERY_PARTNER' } = {}) => {
  const list = Array.isArray(images) ? images : images ? [images] : [];
  const normalized = list
    .map((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        if (!url) return null;
        return {
          url,
          uploadedAt: new Date(),
          uploadedBy: actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : undefined,
          uploadedByRole: actorRole,
          metadata: {},
        };
      }
      if (entry && typeof entry === 'object') {
        const url = String(entry.url || entry.imageUrl || '').trim();
        if (!url) return null;
        return {
          url,
          uploadedAt: entry.uploadedAt ? new Date(entry.uploadedAt) : new Date(),
          uploadedBy:
            entry.uploadedBy && mongoose.Types.ObjectId.isValid(entry.uploadedBy)
              ? entry.uploadedBy
              : actorId && mongoose.Types.ObjectId.isValid(actorId)
                ? actorId
                : undefined,
          uploadedByRole: entry.uploadedByRole || actorRole,
          metadata: entry.metadata || {},
        };
      }
      return null;
    })
    .filter(Boolean);

  if (!normalized.length) {
    throw new ValidationError('At least one pickup image is required');
  }

  return normalized.slice(0, 8);
};

export const serializeReturnForDelivery = async (returnDoc, context = null) => {
  const ctx = context || (await loadReturnPickupContext(returnDoc));
  return buildReturnDeliverySocketPayload(returnDoc, ctx);
};
