import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import { sendResponse } from '../../../utils/response.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { QuickOrder } from '../models/order.model.js';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerCoupon } from '../models/sellerCoupon.model.js';
import { SellerCouponUsage } from '../models/sellerCouponUsage.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { getHeaderCommissionSnapshot, resolveHeaderRatesByProduct } from '../admin/services/commission.service.js';
import {
  calculateQuickPricing,
  getRiderEarning as getQuickRiderEarning,
} from '../admin/services/billing.service.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { FoodTransaction } from '../../food/orders/models/foodTransaction.model.js';
import { emitQuickCommerceStatusUpdate } from '../services/quickStatusRealtime.service.js';
import { getSellerLocation, getOrderAddressPoint } from '../services/quickOrder.service.js';
import { assertQuickDeliveryInServiceArea } from '../services/quick-zone-lookup.service.js';
import { roadDistanceDetails } from '../../food/orders/services/order.helpers.js';
import { resolveReturnEligibilityForOrder } from '../services/quickReturn.service.js';
import { toQuickCustomerOrderDetail, mapQuickCustomerPricing } from '../utils/customerOrder.dto.js';
import { attachReturnSummaryToOrder, loadReturnsByOrderIds } from '../utils/orderReturnSummary.helpers.js';
import { FoodDeliveryPartner } from '../../food/delivery/models/deliveryPartner.model.js';
import { allocateQuickCouponEarnings } from '../utils/quickCouponEarnings.helpers.js';
import {
  buildCartLineKey,
  resolveVariantLabel,
  resolveVariantStock,
  resolveVariantUnitPrice,
  stripCompositeProductId,
} from '../utils/variant.helpers.js';
import {
  isStoreCurrentlyOpen,
  buildShopClosedMessage,
} from '../utils/timeFormat.helpers.js';
import {
  decrementQuickOrderItemsStock,
  restoreQuickOrderItemsStock,
  restoreQuickOrderStockOnce,
} from '../utils/stock.helpers.js';
import { processQuickOrderRefund } from '../services/quickRefund.service.js';
import { fanOutQuickSellerOrdersForParent } from '../services/quickSellerOrderFanout.service.js';
import { deductWalletBalance, refundWalletBalance } from '../../food/user/services/userWallet.service.js';
import {
    getGlobalPaymentSettings,
    assertPaymentMethodAllowed,
} from '../../common/services/globalPaymentSettings.service.js';
import { getDeliveryCashLimitSettings } from '../../food/admin/services/admin.service.js';
import {
    createRazorpayOrder,
    fetchRazorpayPayment,
    getRazorpayKeyId,
    isRazorpayConfigured,
    verifyPaymentSignature,
} from '../../food/orders/helpers/razorpay.helper.js';
import * as orderService from '../../food/orders/services/order.service.js';
import { z } from 'zod';
import { ForbiddenError, ValidationError } from '../../../core/auth/errors.js';
import { getQuickCoupons } from '../services/content.service.js';
import {
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  isQuickCouponNotStarted,
} from '../utils/coupon.helpers.js';
import {
  getQuickSellerCouponUsageConsumer,
  consumeQuickSellerCouponUsage,
  assertQuickSellerCouponUsageAvailable,
  restoreSellerCouponUsageForOrder,
} from '../utils/sellerCouponUsage.helpers.js';
import {
  consumeAdminQuickCouponUsage,
  restoreAdminQuickCouponUsage,
  findAdminQuickCouponByCode,
} from '../utils/adminCouponUsage.helpers.js';

import { publicProductVisibilityFilter } from '../utils/productVisibility.helpers.js';

const approvedProductFilter = publicProductVisibilityFilter;

const getQuickSessionIdFromRequest = (req) =>
  String(req.headers['x-quick-session'] || req.body?.sessionId || req.query?.sessionId || '').trim();

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = getQuickSessionIdFromRequest(req);
  return sessionId ? { sessionId } : null;
};

async function resolveServerQuickDiscount({ couponCode, couponSource: explicitSource, subtotal, items, userId = null, sessionId = null }) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) return { discount: 0, couponCode: null };

  let coupon = null;
  let couponSource = '';
  const expectedSource = String(explicitSource || '').toLowerCase();

  if (expectedSource !== 'admin') {
    const sellerIdRaw = (Array.isArray(items) ? items : []).find(
      (item) => item?.sellerId || item?.seller?._id || item?.quickStoreId || item?.storeId,
    );
    const sellerCandidate =
      sellerIdRaw?.sellerId?._id ||
      sellerIdRaw?.sellerId ||
      sellerIdRaw?.seller?._id ||
      sellerIdRaw?.quickStoreId ||
      sellerIdRaw?.storeId;
    const sellerId = String(
      (sellerCandidate && typeof sellerCandidate === 'object'
        ? sellerCandidate._id || sellerCandidate.id
        : sellerCandidate) || '',
    ).trim();
    if (sellerId && sellerId !== 'quick-commerce' && mongoose.isValidObjectId(sellerId)) {
      const sellerCoupon = await SellerCoupon.findOne({
        sellerId: new mongoose.Types.ObjectId(sellerId),
        code: code,
        status: 'Approved',
        isActive: { $ne: false },
      }).lean();
      if (sellerCoupon && isQuickCouponCurrentlyValid(sellerCoupon)) {
        coupon = {
          ...sellerCoupon,
          code: sellerCoupon.code,
          minOrderValue: sellerCoupon.minOrderValue,
        };
        couponSource = 'restaurant';
      }
    }
  }

  if (!coupon && expectedSource !== 'restaurant' && expectedSource !== 'seller') {
    const adminCoupons = await getQuickCoupons();
    const adminCoupon = (Array.isArray(adminCoupons) ? adminCoupons : []).find(
      (entry) => String(entry?.code || '').toUpperCase() === code,
    );
    if (adminCoupon) {
      coupon = adminCoupon;
      couponSource = 'admin';
    }
  }

  if (!coupon) {
    throw new ValidationError('Coupon not found or expired');
  }
  if (!isQuickCouponCurrentlyValid(coupon)) {
    if (isQuickCouponExpired(coupon)) throw new ValidationError('This coupon has expired');
    if (isQuickCouponNotStarted(coupon)) throw new ValidationError('This coupon is not active yet');
    throw new ValidationError('This coupon is not active');
  }

  const { assertQuickFirstOrderOnly } = await import('../utils/couponValidation.helpers.js');
  await assertQuickFirstOrderOnly(coupon, { userId, sessionId });

  const minOrder = Number(coupon.minOrderValue || coupon.minOrder || 0);
  if (minOrder > 0 && Number(subtotal || 0) < minOrder) {
    throw new ValidationError(`Minimum order value of ₹${minOrder} required for this coupon`);
  }

  const discountType = String(coupon.discountType || 'flat').toLowerCase();
  const discountValue = Number(coupon.discountValue || coupon.discount || 0);
  const maxDiscount = Number(coupon.maxDiscount || coupon.maxDiscountValue || 0);
  const isFreeDelivery = discountType === 'free_delivery';

  if (couponSource === 'restaurant') {
    await assertQuickSellerCouponUsageAvailable(coupon, { userId, sessionId });
  }

  let discount = 0;
  if (isFreeDelivery) {
    discount = 0;
  } else if (discountType === 'percent' || discountType === 'percentage') {
    discount = Math.round((Number(subtotal || 0) * discountValue) / 100);
    if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  } else {
    discount = discountValue;
  }

  return {
    discount: Math.max(0, Math.min(discount, Number(subtotal || 0))),
    couponCode: String(coupon.code || code).toUpperCase(),
    couponSource,
    couponType: isFreeDelivery
      ? 'free_delivery'
      : String(coupon.couponType || '').toLowerCase(),
    discountType,
  };
}

/** Match orders owned by logged-in user and/or the active quick session. */
const buildOrderAccessQuery = (req) => {
  const ownershipClauses = [];
  if (req.user?.userId) ownershipClauses.push({ userId: req.user.userId });
  const sessionId = getQuickSessionIdFromRequest(req);
  if (sessionId) ownershipClauses.push({ sessionId });
  if (!ownershipClauses.length) return null;
  return ownershipClauses.length === 1 ? ownershipClauses[0] : { $or: ownershipClauses };
};

function validateOrderRatingsDto(body) {
  const schema = z.object({
    restaurantRating: z.number().min(1).max(5).optional(),
    sellerRating: z.number().min(1).max(5).optional(),
    deliveryPartnerRating: z.number().min(1).max(5).optional(),
    restaurantComment: z.string().max(500).optional(),
    sellerComment: z.string().max(500).optional(),
    deliveryPartnerComment: z.string().max(500).optional()
  });
  const result = schema.safeParse(body || {});
  if (!result.success) {
    throw new ValidationError(result.error.errors?.[0]?.message || 'Validation failed');
  }
  return result.data;
}

const getOrderPayableAmount = (order) => {
  const pricing = order?.pricing || {};
  // pricing.total already includes: subtotal + deliveryFee + platformFee + gst - discount
  // No need to add platformFee again here.
  const total = Number(pricing.total ?? order?.total ?? 0);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
};

const normalizeOrderSummary = (order) => {
  const amount = getOrderPayableAmount(order);
  const paymentMethod = order?.payment?.method || order?.paymentMethod || 'cash';
  const paymentStatus = order?.payment?.status || order?.paymentStatus || '';

  return {
    id: order._id,
    _id: order._id,
    orderId: order.orderId,
    orderNumber: order.orderId,
    total: amount,
    totalAmount: amount,
    payableAmount: amount,
    amount,
    status: order.orderStatus,
    orderStatus: order.orderStatus,
    workflowStatus: order.workflowStatus || '',
    paymentMethod,
    paymentStatus,
    payment: order.payment || {},
    itemCount: Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      : 0,
    createdAt: order.createdAt,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          itemId: item.itemId || item.productId || '',
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          variantName: item.variantName || item.notes || '',
          notes: item.notes || item.variantName || '',
          ...(item.pharmacyDetails ? { pharmacyDetails: item.pharmacyDetails } : {}),
        }))
      : [],
    pricing: mapQuickCustomerPricing(order.pricing || {}),
    address: order.deliveryAddress || order.address || null,
    deliveryAddress: order.deliveryAddress || order.address || null,
    pickupPoints: Array.isArray(order.pickupPoints) ? order.pickupPoints : [],
    note: order.note || '',
  };
};

const normalizeDeliveryAddress = (address) => {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.address || address.street || '').trim();
  const city = String(address.city || '').trim();
  const additionalDetails = String(address.landmark || address.additionalDetails || '').trim();
  const phone = String(address.phone || '').trim();
  const name = String(address.name || '').trim();
  const label = ['Home', 'Office', 'Other'].includes(address.type) ? address.type : 'Other';
  const state = String(address.state || '').trim();
  const zipCode = String(address.zipCode || address.pincode || '').trim();
  const lat = Number(
    address.location?.lat ??
      (Array.isArray(address.location?.coordinates)
        ? address.location.coordinates[1]
        : undefined),
  );
  const lng = Number(
    address.location?.lng ??
      (Array.isArray(address.location?.coordinates)
        ? address.location.coordinates[0]
        : undefined),
  );
  const formattedAddress = [street, additionalDetails, city, state, zipCode]
    .map((part) => String(part || '').trim())
    .filter((part) => part && part.toUpperCase() !== 'NA')
    .join(', ');

  return {
    label,
    name,
    street,
    additionalDetails,
    city: city || street,
    state: state || city || 'India',
    zipCode,
    phone,
    ...(formattedAddress ? { formattedAddress } : {}),
    ...(Number.isFinite(lat) && Number.isFinite(lng)
      ? {
          location: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        }
      : {}),
  };
};

const buildQuickPickupPointFromSeller = (seller, sellerId) => {
  if (!seller || !sellerId) return null;
  const location = seller.location || {};
  const coordinates = Array.isArray(location.coordinates) && location.coordinates.length === 2
    ? location.coordinates
    : (Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
        ? [Number(location.longitude), Number(location.latitude)]
        : undefined);
  const addressText = [
    location.formattedAddress,
    location.address,
    seller.shopInfo?.address,
    seller.shopInfo?.formattedAddress,
  ]
    .map((part) => String(part || '').trim())
    .find(Boolean) || '';

  return {
    pickupType: 'quick',
    sourceId: String(sellerId),
    sourceName: String(seller.shopName || seller.name || 'Store').trim(),
    address: addressText,
    phone: String(seller.phone || '').trim(),
    ...(coordinates ? { location: { coordinates } } : {}),
  };
};

const normalizeRequestedItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const productId = stripCompositeProductId(
        item?.productId || item?.itemId || item?.id || item?._id || '',
      );
      const variantName = String(
        item?.variantName || item?.selectedVariant?.name || '',
      ).trim();
      const variantKey = String(
        item?.variantKey ||
          item?.selectedVariant?._id ||
          item?.selectedVariant?.id ||
          '',
      ).trim();
      const variantSku = String(
        item?.variantSku || item?.selectedVariant?.sku || '',
      ).trim();

      return {
        productId,
        quantity: Math.max(1, Number(item?.quantity || 1)),
        variantName,
        variantKey,
        variantSku,
        price: Number(item?.price),
        lineKey: buildCartLineKey(productId, variantKey, variantName),
      };
    })
    .filter((item) => item.productId && mongoose.isValidObjectId(item.productId));
};

const buildRequestedItemMetaMap = (items = []) =>
  items.reduce((acc, item) => {
    acc[item.lineKey || item.productId] = item;
    return acc;
  }, {});

const resolveLineItemMeta = (productId, variantMeta = {}, metaMap = {}) => {
  const keys = [
    buildCartLineKey(
      productId,
      variantMeta.variantKey,
      variantMeta.variantName,
    ),
    String(productId),
  ];
  for (const key of keys) {
    if (metaMap[key]) return metaMap[key];
  }
  return variantMeta;
};

const emitQuickOrderStatusUpdate = (order, message = '') => {
  try {
    void emitQuickCommerceStatusUpdate(order, { message });
  } catch {
    // best-effort realtime update
  }
};

export const placeOrder = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const cart = await QuickCart.findOne(idQuery).lean();
    const quickSessionId = getQuickSessionIdFromRequest(req);
    const requestedItems = normalizeRequestedItems(req.body?.items);
    const requestedMetaMap = buildRequestedItemMetaMap(requestedItems);
    const sourceItems =
      requestedItems.length > 0
        ? requestedItems
        : (Array.isArray(cart?.items) && cart.items.length > 0
            ? cart.items.map((item) => ({
                productId: stripCompositeProductId(item.productId),
                quantity: Math.max(1, Number(item.quantity || 1)),
                variantName: String(item.variantName || '').trim(),
                variantKey: String(item.variantKey || '').trim(),
                variantSku: String(item.variantSku || '').trim(),
                price: Number(item.unitPrice || 0),
                lineKey: buildCartLineKey(
                  item.productId,
                  item.variantKey,
                  item.variantName,
                ),
              }))
            : []);

    if (sourceItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const productIds = sourceItems.map((item) => stripCompositeProductId(item.productId));
    const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
    const productMap = products.reduce((acc, product) => {
      acc[String(product._id)] = product;
      return acc;
    }, {});

    let items = sourceItems
      .map((item) => {
        const productId = stripCompositeProductId(item.productId);
        const product = productMap[String(productId)];
        if (!product) return null;
        const requestedMeta = resolveLineItemMeta(productId, item, requestedMetaMap);
        const variantName = resolveVariantLabel(product, requestedMeta);
        const unitPrice = resolveVariantUnitPrice(product, requestedMeta);
        return {
          productId: product._id,
          sellerId: product.sellerId || null,
          name: product.name,
          image: product.image || product.mainImage || '',
          price: unitPrice,
          quantity: item.quantity,
          variantName,
          variantKey: requestedMeta.variantKey || '',
          variantSku: requestedMeta.variantSku || '',
          packingFee: Number(product.packingFee || 0),
        };
      })
      .filter(Boolean);

    if (items.length === 0 && requestedItems.length > 0 && sourceItems !== requestedItems) {
      const fallbackProductIds = requestedItems.map((item) => item.productId);
      const fallbackProducts = await QuickProduct.find({
        _id: { $in: fallbackProductIds },
        ...approvedProductFilter,
      }).lean();
      const fallbackProductMap = fallbackProducts.reduce((acc, product) => {
        acc[String(product._id)] = product;
        return acc;
      }, {});

      items = requestedItems
        .map((item) => {
          const product = fallbackProductMap[String(item.productId)];
          if (!product) return null;
          const variantName = resolveVariantLabel(product, item);
          const unitPrice = resolveVariantUnitPrice(product, item);
          return {
            productId: product._id,
            sellerId: product.sellerId || null,
            name: product.name,
            image: product.image || product.mainImage || '',
            price: unitPrice,
            quantity: item.quantity,
            variantName,
            variantKey: item.variantKey || '',
            variantSku: item.variantSku || '',
            packingFee: Number(product.packingFee || 0),
          };
        })
        .filter(Boolean);
    }

    if (items.length === 0) {
      logger.warn(`Quick placeOrder: No valid items found for productIds: ${JSON.stringify(productIds)} using idQuery: ${JSON.stringify(idQuery)}`);
      return res.status(400).json({ success: false, message: 'No valid items found in cart' });
    }

    const orderSellerIds = [
      ...new Set(
        items
          .map((item) => (item.sellerId ? String(item.sellerId) : ''))
          .filter(Boolean),
      ),
    ];
    if (orderSellerIds.length > 1) {
      return res.status(400).json({
        success: false,
        code: 'MULTI_SELLER_NOT_ALLOWED',
        message: 'Quick Commerce orders support only one seller per order.',
      });
    }

    if (orderSellerIds.length === 1) {
      const orderSeller = await Seller.findById(orderSellerIds[0])
        .select('shopInfo.openingHours')
        .lean();
      const openingHours = orderSeller?.shopInfo?.openingHours || '';
      if (!isStoreCurrentlyOpen(openingHours)) {
        return res.status(400).json({
          success: false,
          code: 'SHOP_CLOSED',
          message: buildShopClosedMessage(openingHours),
        });
      }
    }

    // Validate stock for all items
    for (const item of items) {
      const prodIdStr = String(item.productId);
      const product = products.find((p) => String(p._id) === prodIdStr) ||
                      (typeof fallbackProducts !== 'undefined' ? fallbackProducts.find((p) => String(p._id) === prodIdStr) : null);
      if (product) {
        const availableStock = resolveVariantStock(product, item);
        if (item.quantity > availableStock) {
          const variantSuffix = item.variantName ? ` (${item.variantName})` : '';
          return res.status(400).json({
            success: false,
            message: `Only ${availableStock} items are available in stock for ${product.name}${variantSuffix}.`,
          });
        }
      }
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const { discount, couponCode, couponSource, couponType } = await resolveServerQuickDiscount({
      couponCode: req.body?.couponCode,
      couponSource: req.body?.couponSource || req.body?.source,
      subtotal,
      items,
      userId: idQuery.userId || null,
      sessionId: quickSessionId || idQuery.sessionId || null,
    });
    let deliveryAddress = normalizeDeliveryAddress(req.body?.address);
    if (!deliveryAddress) {
      return res.status(400).json({
        success: false,
        code: 'DELIVERY_ADDRESS_REQUIRED',
        message: 'Delivery address is required',
      });
    }

    if (idQuery.userId) {
      const customerUser = await FoodUser.findById(idQuery.userId)
        .select('name phone email')
        .lean();
      if (deliveryAddress) {
        if (!deliveryAddress.name && customerUser?.name) {
          deliveryAddress.name = String(customerUser.name).trim();
        }
        if (!deliveryAddress.phone && customerUser?.phone) {
          deliveryAddress.phone = String(customerUser.phone).trim();
        }
      }
    }

    const deliveryCoords = getOrderAddressPoint({ deliveryAddress });
    if (!deliveryCoords) {
      return res.status(400).json({
        success: false,
        code: 'DELIVERY_COORDS_REQUIRED',
        message: 'Delivery location coordinates are required',
      });
    }

    try {
      await assertQuickDeliveryInServiceArea(deliveryCoords.lat, deliveryCoords.lng);
    } catch (zoneErr) {
      if (zoneErr instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          code: 'OUT_OF_SERVICE',
          message: zoneErr.message,
        });
      }
      throw zoneErr;
    }

    const firstProduct = products[0];
    const sellerId = firstProduct?.sellerId;
    const seller = sellerId ? await Seller.findById(sellerId).select('location').lean() : null;
    if (!seller) {
      return res.status(400).json({
        success: false,
        code: 'SELLER_NOT_FOUND',
        message: 'Seller could not be resolved for this order',
      });
    }

    const sellerCoords = getSellerLocation(seller);
    if (!sellerCoords) {
      return res.status(400).json({
        success: false,
        code: 'SELLER_LOCATION_REQUIRED',
        message: 'Store location is not configured. Cannot calculate delivery distance.',
      });
    }

    const distanceResult = await roadDistanceDetails(
      sellerCoords.lat,
      sellerCoords.lng,
      deliveryCoords.lat,
      deliveryCoords.lng,
    );

    if (!Number.isFinite(distanceResult?.distanceKm) || distanceResult.distanceKm < 0) {
      return res.status(400).json({
        success: false,
        code: 'DISTANCE_UNAVAILABLE',
        message: 'Unable to calculate delivery distance for this address',
      });
    }

    const distanceKm = distanceResult.distanceKm;
    const distanceEstimated = Boolean(distanceResult.estimated);

    const packagingFee = items.reduce(
      (sum, item) => sum + Number(item.packingFee || 0) * Number(item.quantity || 0),
      0,
    );

    const { pricing } = await calculateQuickPricing({
      subtotal,
      discount,
      products,
      distanceKm,
      couponType,
      packagingFee,
      items: items.map((item) => ({
        productId: item.productId,
        price: item.price,
        quantity: item.quantity,
      })),
    });

    // Mongoose pricingSchema only has 'tax', not 'gst'. Map gst to tax so it gets saved.
    pricing.tax = pricing.gst;

    // Recalculate total with synced tax + packaging + handling (authoritative charge).
    pricing.total = Math.max(
      0,
      subtotal +
        Number(pricing.deliveryFee || 0) +
        Number(pricing.platformFee || 0) +
        Number(pricing.tax || 0) +
        Number(pricing.packagingFee || packagingFee || 0) +
        Number(pricing.handlingFee || 0) -
        discount,
    );

    const deliveryFee = Number(pricing.deliveryFee || 0);
    const total = Number(pricing.total || 0);
    const orderNumber = `QC${Date.now().toString().slice(-8)}`;
    const paymentModeRaw = String(req.body?.paymentMode || 'COD').toUpperCase();
    const isOnlinePayment = paymentModeRaw === 'ONLINE';
    const isWalletPayment = paymentModeRaw === 'WALLET';
    const paymentMode = isOnlinePayment ? 'razorpay' : isWalletPayment ? 'wallet' : 'cash';
    const sellerPaymentMode = isOnlinePayment || isWalletPayment ? 'online' : 'cash';
    // Online orders reach sellers only after Razorpay payment is verified.
    const shouldFanOutSellerOrders = !isOnlinePayment;

    if (isWalletPayment && !idQuery.userId) {
      return res.status(400).json({
        success: false,
        message: 'Please log in to pay with wallet',
      });
    }

    const paymentSettings = await getGlobalPaymentSettings();
    const paymentCheck = assertPaymentMethodAllowed(paymentMode, paymentSettings);
    if (!paymentCheck.allowed) {
      return res.status(400).json({
        success: false,
        message: paymentCheck.message,
      });
    }

    // Block deactivated accounts for all payment modes (optionalAuth alone is not enough).
    // COD flag is enforced only for cash.
    if (idQuery.userId) {
      const orderingUser = await FoodUser.findById(idQuery.userId)
        .select('isCodAllowed isActive')
        .lean();
      if (!orderingUser || orderingUser.isActive === false) {
        throw new ForbiddenError('User account is deactivated');
      }
      if (paymentMode === 'cash' && orderingUser.isCodAllowed === false) {
        throw new ForbiddenError('Cash on Delivery is not available for this account');
      }
    }

    if (paymentMode === 'cash') {
      const cashLimitSettings = await getDeliveryCashLimitSettings();
      const codOrderLimit = Number(cashLimitSettings?.deliveryCashLimit || 0);
      if (Number.isFinite(codOrderLimit) && codOrderLimit > 0 && total > codOrderLimit) {
        throw new ValidationError(
          `Cash on Delivery is not available for orders above ₹${Math.round(codOrderLimit)}.`,
        );
      }
    }

    // Calculate rider earning using actual distance
    const riderEarning = await getQuickRiderEarning(distanceKm);

    const sellerBuckets = new Map();
    // @deprecated multi-seller bucketing — validated to single seller above; kept for SellerOrder fan-out.
    items.forEach((item) => {
      const bucketSellerId = item.sellerId ? String(item.sellerId) : '';
      if (!bucketSellerId) return;
      if (!sellerBuckets.has(bucketSellerId)) sellerBuckets.set(bucketSellerId, []);
      sellerBuckets.get(bucketSellerId).push(item);
    });

    const sellerIdsForPickup = [...sellerBuckets.keys()];
    const sellersForPickup = sellerIdsForPickup.length
      ? await Seller.find({ _id: { $in: sellerIdsForPickup } })
          .select('shopName name phone location shopInfo')
          .lean()
      : [];
    const sellerPickupMap = sellersForPickup.reduce((acc, sellerDoc) => {
      acc[String(sellerDoc._id)] = sellerDoc;
      return acc;
    }, {});
    const pickupPoints = sellerIdsForPickup
      .map((bucketSellerId) => buildQuickPickupPointFromSeller(sellerPickupMap[bucketSellerId], bucketSellerId))
      .filter(Boolean);
    const sellerNameById = sellerIdsForPickup.reduce((acc, bucketSellerId) => {
      const sellerDoc = sellerPickupMap[bucketSellerId];
      acc[bucketSellerId] = String(sellerDoc?.shopName || sellerDoc?.name || 'Store').trim();
      return acc;
    }, {});

    const consumerContext = getQuickSellerCouponUsageConsumer({
      userId: idQuery.userId || null,
      sessionId: quickSessionId || idQuery.sessionId || null,
    });
    let sellerCouponForUsage = null;
    let sellerCouponUsageConsumed = false;
    let adminCouponForUsage = null;
    let adminCouponUsageConsumed = false;
    const rollbackSellerCouponUsage = async () => {
      if (!sellerCouponUsageConsumed || !sellerCouponForUsage) return;
      await Promise.allSettled([
        SellerCoupon.updateOne(
          { _id: sellerCouponForUsage._id, usedCount: { $gte: 1 } },
          { $inc: { usedCount: -1 } },
        ),
        SellerCouponUsage.updateOne(
          {
            couponId: sellerCouponForUsage._id,
            consumerKey: consumerContext.consumerKey,
          },
          {
            $inc: { count: -1 },
            $set: { lastUsedAt: new Date() },
          },
        ),
      ]);
      sellerCouponUsageConsumed = false;
    };
    const rollbackAdminCouponUsage = async () => {
      if (!adminCouponUsageConsumed || !adminCouponForUsage) return;
      await restoreAdminQuickCouponUsage(adminCouponForUsage);
      adminCouponUsageConsumed = false;
    };
    const rollbackCouponUsage = async () => {
      await rollbackSellerCouponUsage();
      await rollbackAdminCouponUsage();
    };

    const headerRatesByProduct = await resolveHeaderRatesByProduct(products);
    const order = await QuickOrder.create({
      orderType: 'quick',
      orderId: orderNumber,
      sessionId: quickSessionId || idQuery.sessionId || '',
      userId: idQuery.userId || null,
      items: items.map((item) => {
        const rates = headerRatesByProduct.get(String(item.productId)) || {};
        return {
          itemId: String(item.productId),
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
          type: 'quick',
          sourceId: String(item.sellerId || item.productId),
          sourceName: sellerNameById[String(item.sellerId || '')] || '',
          variantName: item.variantName || '',
          notes: item.variantName || '',
          headerId: rates.headerId || '',
          returnsEnabled: rates.returnsEnabled !== false,
          returnWindowHours: Number(rates.returnWindowHours) > 0 ? Number(rates.returnWindowHours) : 72,
        };
      }),
      pickupPoints,
      pricing: {
        ...pricing,
        subtotal,
        discount,
        couponCode: couponCode || null,
        appliedCoupon: couponCode ? {
            code: couponCode,
            discount: discount,
            source: couponSource,
            couponType,
        } : undefined,
        // Online (razorpay) usage is counted only after payment verify.
        couponUsageConsumed: false,
        total,
        deliveryDistanceKm: distanceKm,
        distanceEstimated,
      },
      deliveryAddress,
      timeSlot: req.body?.timeSlot || 'now',
      payment: {
        method: paymentMode,
        status: isOnlinePayment ? 'created' : isWalletPayment ? 'paid' : 'cod_pending',
        amountDue: Math.max(0, total),  // total already includes platformFee
      },
      orderStatus: 'placed',
      riderEarning: riderEarning || 0,
      platformProfit: allocateQuickCouponEarnings({
        couponSource,
        discount,
        platformFee: Number(pricing.platformFee || 0),
        deliveryFee,
        riderEarning: riderEarning || 0,
      }).platformProfit,
      statusHistory: [
        {
          byRole: 'SYSTEM',
          from: '',
          to: 'placed',
          note: 'Quick commerce order placed',
        },
      ],
    });

    if (couponCode && couponSource === 'restaurant' && !isOnlinePayment) {
      sellerCouponForUsage = await SellerCoupon.findOne({
        sellerId: firstProduct?.sellerId ? new mongoose.Types.ObjectId(String(firstProduct.sellerId)) : null,
        code: String(couponCode).trim().toUpperCase(),
        status: 'Approved',
        isActive: { $ne: false },
      }).lean();

      if (sellerCouponForUsage && !isQuickCouponCurrentlyValid(sellerCouponForUsage)) {
        sellerCouponForUsage = null;
      }

      if (sellerCouponForUsage) {
        try {
          await consumeQuickSellerCouponUsage(sellerCouponForUsage, consumerContext);
          sellerCouponUsageConsumed = true;
          order.pricing = {
            ...(order.pricing?.toObject?.() || order.pricing || {}),
            couponUsageConsumed: true,
          };
          await order.save();
        } catch (usageErr) {
          await QuickOrder.deleteOne({ _id: order._id });
          throw usageErr;
        }
      }
    }

    if (couponCode && couponSource === 'admin' && !isOnlinePayment) {
      adminCouponForUsage = await findAdminQuickCouponByCode(couponCode);
      if (adminCouponForUsage && !isQuickCouponCurrentlyValid(adminCouponForUsage)) {
        adminCouponForUsage = null;
      }
      if (adminCouponForUsage) {
        try {
          await consumeAdminQuickCouponUsage(adminCouponForUsage);
          adminCouponUsageConsumed = true;
          order.pricing = {
            ...(order.pricing?.toObject?.() || order.pricing || {}),
            couponUsageConsumed: true,
          };
          await order.save();
        } catch (usageErr) {
          await QuickOrder.deleteOne({ _id: order._id });
          throw usageErr;
        }
      }
    }

    let razorpayPayload = null;

    if (paymentMode === "razorpay" && isRazorpayConfigured()) {
      const amountPaise = Math.round(total * 100);
      if (amountPaise >= 100) {
        try {
          const rzOrder = await createRazorpayOrder(amountPaise, "INR", order.orderId);
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
          await order.save();
        } catch (err) {
          logger.error(`Quick Razorpay order creation failed: ${err?.message || err}`);
        }
      }
    }

    if (isWalletPayment) {
      try {
        await deductWalletBalance(
          idQuery.userId,
          total,
          'Quick commerce order payment',
          {
            orderId: order.orderId,
            source: 'quick_order_payment',
            orderType: 'quick',
          },
        );
      } catch (walletErr) {
        await rollbackCouponUsage();
        await QuickOrder.deleteOne({ _id: order._id });
        return res.status(400).json({
          success: false,
          message: walletErr?.message || 'Insufficient wallet balance',
        });
      }
    }

    let stockAdjusted = false;
    try {
      if (!isOnlinePayment) {
        await decrementQuickOrderItemsStock(items);
        stockAdjusted = true;
      }
    } catch (stockErr) {
      logger.error(
        `Quick stock deduction failed for ${order.orderId}: ${stockErr?.message || stockErr}`,
      );

      if (isWalletPayment && idQuery.userId) {
        try {
          await refundWalletBalance(
            idQuery.userId,
            total,
            'Quick commerce order payment reversal',
            {
              orderId: order.orderId,
              source: 'quick_order_payment_reversal',
              orderType: 'quick',
            },
          );
        } catch (refundErr) {
          logger.error(
            `Quick wallet refund reversal failed for ${order.orderId}: ${refundErr?.message || refundErr}`,
          );
        }
      }

      await rollbackCouponUsage();

      await QuickOrder.deleteOne({ _id: order._id });

      return res.status(409).json({
        success: false,
        message: 'Some items are no longer available. Please refresh your cart and try again.',
      });
    }

    const sellerOrdersResults = sellerBuckets.size > 0
        ? await Promise.all(Array.from(sellerBuckets.entries()).map(async ([sellerId, sellerItems]) => {
            const sellerSubtotal = sellerItems.reduce(
              (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
              0,
            );
            // Packing fee is configured per product by the seller.
            // It must be credited 100% to the seller (never admin/platform).
            const sellerPackingFee = sellerItems.reduce(
              (sum, item) => sum + Number(item.packingFee || 0) * Number(item.quantity || 0),
              0,
            );
            const allocatedDeliveryFee = Number(
              ((deliveryFee * sellerSubtotal) / Math.max(subtotal, 1)).toFixed(2),
            );

            // Commission from Header Category rates on this seller's line items
            const { commissionAmount } = await getHeaderCommissionSnapshot(
              sellerItems.map((item) => ({
                productId: item.productId,
                price: item.price,
                quantity: item.quantity,
              })),
              products,
            );
            const {
              sellerDiscount,
              productEarnings: sellerProductEarnings,
              receivable: sellerReceivable,
            } = allocateQuickCouponEarnings({
              couponSource,
              discount,
              sellerSubtotal,
              commission: commissionAmount,
              packingFee: sellerPackingFee,
            });

            return {
              orderType: 'quick',
              parentOrderId: order._id,
              sellerId,
              orderId: order.orderId,
              customer: {
                name: String(req.body?.address?.name || 'Customer').trim() || 'Customer',
                phone: String(req.body?.address?.phone || '').trim(),
              },
              items: sellerItems.map((item) => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
                variantName: item.variantName || '',
              })),
              pricing: {
                subtotal: sellerSubtotal,
                commission: commissionAmount,
                productEarnings: sellerProductEarnings,
                packingFee: sellerPackingFee,
                couponDiscount: sellerDiscount,
                total: sellerSubtotal + allocatedDeliveryFee,
                receivable: sellerReceivable,
              },
              status: 'pending',
              workflowStatus: 'SELLER_PENDING',
              sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
              address: {
                address: deliveryAddress?.street || '',
                city: deliveryAddress?.city || '',
                ...(deliveryAddress?.state
                  ? { state: deliveryAddress.state }
                  : {}),
                ...(deliveryAddress?.zipCode
                  ? { zipCode: deliveryAddress.zipCode }
                  : {}),
                ...(Array.isArray(deliveryAddress?.location?.coordinates)
                  ? {
                      location: {
                        lat: deliveryAddress.location.coordinates[1],
                        lng: deliveryAddress.location.coordinates[0],
                      },
                    }
                  : {}),
              },
              payment: {
                method: sellerPaymentMode,
              },
            };
          }))
        : [];

    if (couponSource === 'admin') {
      const { platformProfit } = allocateQuickCouponEarnings({
        couponSource: 'admin',
        discount,
        platformFee: Number(pricing.platformFee || 0),
        deliveryFee,
        riderEarning: riderEarning || 0,
      });
      await QuickOrder.updateOne(
        { _id: order._id },
        {
          $set: {
            platformProfit,
          },
        },
      );
      order.platformProfit = platformProfit;
    }

    const sellerOrders = sellerOrdersResults;

    try {
      await foodTransactionService.createInitialTransaction(order);
    } catch (txnErr) {
      logger.error(
        `Quick createInitialTransaction failed for ${order.orderId}: ${txnErr?.message || txnErr}`,
      );
    }

    try {
      await QuickCart.findOneAndUpdate(idQuery, { $set: { items: [] } }, { upsert: false });
    } catch (cartErr) {
      logger.error(`Quick cart clear failed for ${order.orderId}: ${cartErr?.message || cartErr}`);
      if (stockAdjusted) {
        try {
          await restoreQuickOrderItemsStock(order.items);
        } catch (restoreErr) {
          logger.error(
            `Quick stock restore failed after cart clear failure for ${order.orderId}: ${
              restoreErr?.message || restoreErr
            }`,
          );
        }
      }
      if (isWalletPayment && idQuery.userId) {
        try {
          await refundWalletBalance(
            idQuery.userId,
            total,
            'Quick commerce order payment reversal',
            {
              orderId: order.orderId,
              source: 'quick_order_payment_reversal',
              orderType: 'quick',
            },
          );
        } catch (refundErr) {
          logger.error(
            `Quick wallet refund reversal failed for ${order.orderId}: ${refundErr?.message || refundErr}`,
          );
        }
      }
      await rollbackCouponUsage();
      await QuickOrder.deleteOne({ _id: order._id });
      return res.status(500).json({
        success: false,
        message: 'Failed to finalize order. Please try again.',
      });
    }

    emitQuickOrderStatusUpdate(order, 'Quick order placed successfully.');

    if (shouldFanOutSellerOrders) {
      void fanOutQuickSellerOrdersForParent(order).catch((error) => {
        logger.error(`Quick seller order fanout failed for ${order.orderId}: ${error?.message || error}`);
      });
    }

    if (idQuery.userId) {
      try {
        const { notifyOwnerSafely } = await import(
          '../../food/orders/services/order.helpers.js'
        );
        const paymentMethod = String(order?.payment?.method || '').toLowerCase();
        const paymentStatus = String(order?.payment?.status || '').toLowerCase();
        const awaitingOnline =
          ['razorpay', 'online'].includes(paymentMethod) && paymentStatus !== 'paid';
        await notifyOwnerSafely(
          { ownerType: 'USER', ownerId: idQuery.userId },
          {
            title: awaitingOnline
              ? 'Complete Payment to Confirm Order'
              : 'Quick Order Confirmed!',
            body: awaitingOnline
              ? `Order #${order.orderId} is created. Please complete payment to confirm.`
              : `Your quick order #${order.orderId} has been placed successfully.`,
            data: {
              type: awaitingOnline ? 'order_created_pending_payment' : 'order_created',
              orderId: String(order.orderId),
              orderMongoId: String(order._id),
              link: `/quick/orders/${order.orderId}`,
            },
          },
        );
      } catch (userNotifyErr) {
        logger.warn(
          `Quick placeOrder user notify failed: ${userNotifyErr?.message || userNotifyErr}`,
        );
      }
    }

    return res.status(201).json({
      success: true,
      result: normalizeOrderSummary(order),
      razorpay: razorpayPayload,
    });
  } catch (error) {
    logger.error(`Quick placeOrder failed: ${error?.message || error}`);
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      success: false,
      error: error?.message || 'Failed to place quick order',
      message: error?.message || 'Failed to place quick order',
    });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const accessQuery = buildOrderAccessQuery(req);
    if (!accessQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const razorpayPaymentId = String(
      req.body?.razorpay_payment_id || req.body?.razorpayPaymentId || '',
    ).trim();
    const razorpayOrderId = String(
      req.body?.razorpay_order_id || req.body?.razorpayOrderId || '',
    ).trim();
    const razorpaySignature = String(
      req.body?.razorpay_signature || req.body?.razorpaySignature || '',
    ).trim();

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Invalid payment verification payload' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const order = await QuickOrder.findOne({
      orderType: 'quick',
      $and: [
        accessQuery,
        { $or: orderIdentityQuery },
      ],
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (order.payment?.status === 'paid') {
      return res.json({ success: true, message: 'Payment already verified' });
    }

    const expectedRazorpayOrderId = String(order.payment?.razorpay?.orderId || '').trim();
    if (!expectedRazorpayOrderId || razorpayOrderId !== expectedRazorpayOrderId) {
      return res.status(400).json({ success: false, message: 'Payment order mismatch' });
    }

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    if (isRazorpayConfigured()) {
      const fetchedPayment = await fetchRazorpayPayment(razorpayPaymentId);
      const fetchedOrderId = String(fetchedPayment?.order_id || '').trim();
      const fetchedStatus = String(fetchedPayment?.status || '').toLowerCase();
      const fetchedAmount = Number(fetchedPayment?.amount || 0);
      const expectedAmount = Math.round(Number(order.payment?.amountDue || order.pricing?.total || 0) * 100);
      if (fetchedOrderId !== expectedRazorpayOrderId) {
        return res.status(400).json({ success: false, message: 'Payment order mismatch' });
      }
      if (fetchedStatus !== 'captured') {
        return res.status(400).json({ success: false, message: 'Payment not captured' });
      }
      if (!Number.isFinite(expectedAmount) || expectedAmount < 100 || fetchedAmount !== expectedAmount) {
        return res.status(400).json({ success: false, message: 'Payment amount mismatch' });
      }
    }

    const paidOrder = await QuickOrder.findOneAndUpdate(
      {
        _id: order._id,
        'payment.status': { $ne: 'paid' },
      },
      {
        $set: {
          'payment.status': 'paid',
          'payment.razorpay.paymentId': razorpayPaymentId,
          'payment.razorpay.signature': razorpaySignature,
        },
      },
      { new: true },
    );
    if (!paidOrder) {
      const latest = await QuickOrder.findById(order._id).select('payment.status').lean();
      if (String(latest?.payment?.status || '').toLowerCase() === 'paid') {
        return res.json({ success: true, message: 'Payment already verified' });
      }
      return res.status(409).json({ success: false, message: 'Payment verification in progress. Retry once.' });
    }

    try {
      await decrementQuickOrderItemsStock(
        Array.isArray(paidOrder.items)
          ? paidOrder.items.map((item) => ({
              productId: item.itemId || item.productId,
              quantity: item.quantity,
              variantName: item.variantName || item.notes || '',
              variantKey: item.variantKey || '',
              variantSku: item.variantSku || '',
            }))
          : [],
      );
    } catch (stockErr) {
      await QuickOrder.updateOne(
        { _id: paidOrder._id, 'payment.razorpay.paymentId': razorpayPaymentId },
        {
          $set: {
            'payment.status': 'created',
            'payment.razorpay.paymentId': '',
            'payment.razorpay.signature': '',
          },
        },
      );
      throw stockErr;
    }

    // Count coupon usage only after online payment succeeds.
    if (paidOrder.pricing?.couponUsageConsumed !== true) {
      const appliedSource = String(paidOrder.pricing?.appliedCoupon?.source || '').toLowerCase();
      const appliedCode = String(
        paidOrder.pricing?.appliedCoupon?.code || paidOrder.pricing?.couponCode || '',
      )
        .trim()
        .toUpperCase();

      if (appliedSource === 'restaurant' || appliedSource === 'seller') {
        try {
          const consumerContext = getQuickSellerCouponUsageConsumer({
            userId: paidOrder.userId || null,
            sessionId: paidOrder.sessionId || null,
          });
          const sellerCoupon = await SellerCoupon.findOne({
            code: appliedCode,
            status: 'Approved',
            isActive: { $ne: false },
          }).lean();
          if (sellerCoupon) {
            await consumeQuickSellerCouponUsage(sellerCoupon, consumerContext);
            await QuickOrder.updateOne(
              { _id: paidOrder._id },
              { $set: { 'pricing.couponUsageConsumed': true } },
            );
            paidOrder.pricing = {
              ...(paidOrder.pricing?.toObject?.() || paidOrder.pricing || {}),
              couponUsageConsumed: true,
            };
          }
        } catch (usageErr) {
          logger.error(
            `Quick seller coupon consume failed after payment for ${paidOrder.orderId}: ${usageErr?.message || usageErr}`,
          );
          // Payment already captured — do not fail verification; coupon over-use is logged for ops.
        }
      } else if (appliedSource === 'admin' && appliedCode) {
        try {
          const adminCoupon = await findAdminQuickCouponByCode(appliedCode);
          if (adminCoupon) {
            await consumeAdminQuickCouponUsage(adminCoupon);
            await QuickOrder.updateOne(
              { _id: paidOrder._id },
              { $set: { 'pricing.couponUsageConsumed': true } },
            );
            paidOrder.pricing = {
              ...(paidOrder.pricing?.toObject?.() || paidOrder.pricing || {}),
              couponUsageConsumed: true,
            };
          }
        } catch (usageErr) {
          logger.error(
            `Quick admin coupon consume failed after payment for ${paidOrder.orderId}: ${usageErr?.message || usageErr}`,
          );
        }
      }
    }

    try {
      const existingTxn = await FoodTransaction.findOne({ orderId: paidOrder._id }).select('_id').lean();
      if (!existingTxn) {
        await foodTransactionService.createInitialTransaction(paidOrder);
      }
      await foodTransactionService.updateTransactionStatus(paidOrder._id, 'captured', {
        status: 'captured',
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
        note: 'Quick commerce payment verified',
        recordedByRole: 'USER',
        recordedById: paidOrder.userId,
      });
    } catch (txnErr) {
      logger.error(
        `Quick verifyPayment transaction sync failed for ${paidOrder.orderId}: ${txnErr?.message || txnErr}`,
      );
    }

    await fanOutQuickSellerOrdersForParent(paidOrder);

    if (paidOrder.userId) {
      try {
        const { notifyOwnerSafely } = await import(
          '../../food/orders/services/order.helpers.js'
        );
        await notifyOwnerSafely(
          { ownerType: 'USER', ownerId: paidOrder.userId },
          {
            title: 'Payment Successful! ✅',
            body: `We have received your payment for Order #${paidOrder.orderId}.`,
            data: {
              type: 'payment_success',
              orderId: String(paidOrder.orderId),
              orderMongoId: String(paidOrder._id),
              link: `/quick/orders/${paidOrder.orderId}`,
            },
          },
        );
      } catch (userNotifyErr) {
        logger.warn(
          `Quick verifyPayment user notify failed: ${userNotifyErr?.message || userNotifyErr}`,
        );
      }
    }

    return res.json({ success: true, message: 'Payment verified successfully' });
  } catch (error) {
    logger.error(`Quick verifyPayment failed: ${error?.message || error}`);
    return res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};

export const getMyOrders = async (req, res) => {
  const accessQuery = buildOrderAccessQuery(req);

  if (!accessQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const { page, limit } = req.query;
  const hasPagination = !!page;

  let orders = [];
  let total = 0;
  let totalPages = 0;
  let hasMore = false;
  let parsedLimit = 20;
  let parsedPage = 1;
  const baseQuery = { ...accessQuery, orderType: 'quick' };

  if (hasPagination) {
    parsedPage = Math.max(1, parseInt(page, 10) || 1);
    parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
    const skip = (parsedPage - 1) * parsedLimit;
    
    [orders, total] = await Promise.all([
      QuickOrder.find(baseQuery).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(parsedLimit).lean(),
      QuickOrder.countDocuments(baseQuery)
    ]);
    totalPages = Math.ceil(total / parsedLimit);
    hasMore = parsedPage < totalPages;
  } else {
    orders = await QuickOrder.find(baseQuery).sort({ createdAt: -1, _id: -1 }).lean();
  }

  const sellerIds = [
    ...new Set(
      orders
        .map((order) =>
          String(order?.items?.find((item) => item?.type === 'quick')?.sourceId || order?.items?.[0]?.sourceId || '').trim(),
        )
        .filter((value) => mongoose.Types.ObjectId.isValid(value)),
    ),
  ];

  const sellers = sellerIds.length
    ? await Seller.find({ _id: { $in: sellerIds } }).select('_id name shopName').lean()
    : [];
  const sellerMap = sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});

  const mappedOrders = orders.map((order) => {
    const normalized = normalizeOrderSummary(order);
    const sellerId = String(
      order?.items?.find((item) => item?.type === 'quick')?.sourceId || order?.items?.[0]?.sourceId || '',
    ).trim();
    const seller = sellerMap[sellerId] || null;

    return {
      ...normalized,
      sellerId: seller?._id || null,
      storeName: seller?.shopName || seller?.name || '',
      seller: seller
        ? {
            _id: seller._id,
            name: seller.name || '',
            shopName: seller.shopName || seller.name || 'Store',
          }
        : null,
    };
  });

  if (hasPagination) {
    return res.json({
      success: true,
      result: mappedOrders,
      results: mappedOrders,
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,
      hasMore
    });
  }

  return res.json({
    success: true,
    result: mappedOrders,
    results: mappedOrders,
  });
};

export const getOrderById = async (req, res) => {
  try {
    const accessQuery = buildOrderAccessQuery(req);

    if (!accessQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      orderType: 'quick',
      $and: [
        accessQuery,
        { $or: orderIdentityQuery },
      ],
    };

    const order = await QuickOrder.findOne(query).select('+deliveryOtp').lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const sellerOrder = await SellerOrder.findOne({ orderId: order.orderId }).lean();
    const partnerId =
      order?.dispatch?.deliveryPartnerId?._id ||
      order?.dispatch?.deliveryPartnerId ||
      order?.deliveryPartnerId ||
      null;
    const [seller, customer, deliveryPartner] = await Promise.all([
      sellerOrder?.sellerId
        ? Seller.findById(sellerOrder.sellerId)
            .select('_id name shopName phone location shopInfo')
            .lean()
        : Promise.resolve(null),
      order?.userId
        ? FoodUser.findById(order.userId).select('_id name phone').lean()
        : Promise.resolve(null),
      partnerId && mongoose.isValidObjectId(String(partnerId))
        ? FoodDeliveryPartner.findById(partnerId)
            .select('_id name phone rating totalRatings profilePhoto')
            .lean()
        : Promise.resolve(null),
    ]);

    const dropOtp = order.deliveryVerification?.dropOtp || {};
    const handoverOtp = String(order.deliveryOtp || '').trim();
    const returnEligibility = await resolveReturnEligibilityForOrder(order);
    const returnsByOrderId = await loadReturnsByOrderIds([order.orderId].filter(Boolean));
    const returnAttachment = attachReturnSummaryToOrder(
      order,
      returnsByOrderId.get(String(order.orderId || '')) || [],
    );

    return res.json({
      success: true,
      result: toQuickCustomerOrderDetail({
        order,
        seller,
        sellerOrder,
        customer,
        deliveryPartner,
        returnEligibility,
        returnSummary: returnAttachment.returnSummary,
        handoverOtp:
          dropOtp.required && !dropOtp.verified && handoverOtp ? handoverOtp : '',
      }),
    });
  } catch (error) {
    logger.error(`Quick getOrderById failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to load quick order',
    });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const accessQuery = buildOrderAccessQuery(req);

    if (!accessQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const rawOrderId = String(req.params.orderId || '').trim();
    if (!rawOrderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderIdentityQuery = [{ orderId: rawOrderId }];
    if (mongoose.isValidObjectId(rawOrderId)) {
      orderIdentityQuery.unshift({ _id: rawOrderId });
    }

    const query = {
      orderType: 'quick',
      $and: [
        accessQuery,
        { $or: orderIdentityQuery },
      ],
    };

    const order = await QuickOrder.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentStatus = String(order.orderStatus || '').toLowerCase();
    const workflowStatus = String(order.workflowStatus || '').toUpperCase();
    const deliveryPhase = String(order.deliveryState?.currentPhase || '').toLowerCase();
    const terminalStatuses = new Set([
      'picked_up',
      'delivered',
      'cancelled_by_user',
      'cancelled_by_restaurant',
      'cancelled_by_admin',
    ]);
    const nonCancellableWorkflowStatuses = new Set(['OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']);
    const nonCancellableDeliveryPhases = new Set([
      'en_route_to_delivery',
      'at_drop',
      'delivered',
      'completed',
    ]);

    if (
      terminalStatuses.has(currentStatus) ||
      nonCancellableWorkflowStatuses.has(workflowStatus) ||
      nonCancellableDeliveryPhases.has(deliveryPhase)
    ) {
      return res.status(400).json({
        success: false,
        message: currentStatus === 'delivered'
          ? 'Delivered orders cannot be cancelled'
          : 'Order can no longer be cancelled once delivery is in progress',
      });
    }

    const cancellationReason = String(req.body?.reason || 'Quick commerce order cancelled by user').trim();
    const paymentMethod = String(order.payment?.method || '').trim().toLowerCase();
    const requestedRefundTo =
      paymentMethod === 'wallet'
        ? 'wallet'
        : req.body?.refundTo === 'wallet' || req.body?.refundTo === 'gateway'
          ? req.body.refundTo
          : 'gateway';

    const paymentStatusUpdate =
      order.payment?.method === 'cash' && order.payment?.status !== 'paid'
        ? { 'payment.status': 'failed' }
        : {};

    const claimedOrder = await QuickOrder.findOneAndUpdate(
      {
        _id: order._id,
        orderStatus: { $nin: Array.from(terminalStatuses) },
        workflowStatus: { $nin: Array.from(nonCancellableWorkflowStatuses) },
        $or: [
          { 'deliveryState.currentPhase': { $exists: false } },
          { 'deliveryState.currentPhase': null },
          { 'deliveryState.currentPhase': { $nin: Array.from(nonCancellableDeliveryPhases) } },
        ],
      },
      {
        $set: {
          orderStatus: 'cancelled_by_user',
          workflowStatus: 'CANCELLED',
          cancelledBy: 'user',
          cancellationReason,
          ...paymentStatusUpdate,
        },
        $push: {
          statusHistory: {
            byRole: 'USER',
            from: currentStatus || '',
            to: 'cancelled_by_user',
            note: cancellationReason,
          },
        },
      },
      { new: true },
    );

    if (!claimedOrder) {
      return res.status(400).json({
        success: false,
        message: 'Order can no longer be cancelled',
      });
    }

    const refundResult = await processQuickOrderRefund(claimedOrder, {
      refundTo: requestedRefundTo,
      cancelledBy: 'user',
      reason: cancellationReason,
    });
    await claimedOrder.save();

    const shouldRestoreStock =
      claimedOrder.payment?.method !== 'razorpay' ||
      ['paid', 'refunded'].includes(String(claimedOrder.payment?.status || '').toLowerCase());
    if (shouldRestoreStock) {
      await restoreQuickOrderStockOnce(claimedOrder);
    }

    try {
      await restoreSellerCouponUsageForOrder(claimedOrder);
    } catch (couponRestoreErr) {
      logger.warn(
        `Quick cancelOrder coupon restore failed for ${claimedOrder.orderId}: ${couponRestoreErr?.message || couponRestoreErr}`,
      );
    }

    try {
      const isOnlinePaid =
        String(claimedOrder.payment?.status || '').toLowerCase() === 'paid' ||
        String(claimedOrder.payment?.status || '').toLowerCase() === 'refunded';
      await foodTransactionService.updateTransactionStatus(claimedOrder._id, 'cancelled_by_user', {
        status:
          claimedOrder.payment?.status === 'refunded'
            ? 'refunded'
            : isOnlinePaid
              ? 'captured'
              : 'failed',
        note: cancellationReason,
        recordedByRole: 'USER',
        recordedById: claimedOrder.userId,
      });
    } catch (txnErr) {
      logger.warn(
        `Quick cancelOrder transaction sync failed for ${claimedOrder.orderId}: ${txnErr?.message || txnErr}`,
      );
    }

    await SellerOrder.updateMany(
      {
        orderId: claimedOrder.orderId,
        status: { $nin: ['cancelled', 'delivered'] },
      },
      {
        $set: {
          status: 'cancelled',
          workflowStatus: 'CANCELLED',
          cancellationReason,
        },
      },
    );

    const cancellationMessage =
      refundResult?.message || 'Quick order cancelled successfully.';
    emitQuickOrderStatusUpdate(claimedOrder, cancellationMessage);

    return res.json({
      success: true,
      message: cancellationMessage,
      refund: refundResult || null,
      result: {
        id: claimedOrder._id,
        _id: claimedOrder._id,
        orderId: claimedOrder.orderId,
        orderNumber: claimedOrder.orderId,
        status: claimedOrder.orderStatus,
        payment: claimedOrder.payment || {},
      },
    });
  } catch (error) {
    logger.error(`Quick cancelOrder failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to cancel quick order',
    });
  }
};

export async function submitOrderRatingsController(req, res, next) {
  try {
    const userId = req.user?.userId;
    const orderId = req.params.orderId;
    const dto = validateOrderRatingsDto(req.body);
    const order = await orderService.submitOrderRatings(orderId, userId, dto);
    return sendResponse(res, 200, 'Ratings submitted successfully', { order });
  } catch (err) {
    next(err);
  }
};
