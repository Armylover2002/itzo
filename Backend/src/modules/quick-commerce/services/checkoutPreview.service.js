import mongoose from 'mongoose';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerCoupon } from '../models/sellerCoupon.model.js';
import { calculateQuickPricing } from '../admin/services/billing.service.js';
import { getSellerLocation } from './quickOrder.service.js';
import { roadDistanceDetails } from '../../food/orders/services/order.helpers.js';
import { getQuickCoupons } from './content.service.js';
import { ValidationError } from '../../../core/auth/errors.js';
import {
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  isQuickCouponNotStarted,
} from '../utils/coupon.helpers.js';
import { assertQuickSellerCouponUsageAvailable } from '../utils/sellerCouponUsage.helpers.js';
import {
  buildCartLineKey,
  resolveVariantLabel,
  resolveVariantStock,
  resolveVariantUnitPrice,
  stripCompositeProductId,
} from '../utils/variant.helpers.js';
import { publicProductVisibilityFilter } from '../utils/productVisibility.helpers.js';

const approvedProductFilter = publicProductVisibilityFilter;

export async function resolveServerQuickDiscount({
  couponCode,
  couponSource: explicitSource,
  subtotal,
  items,
  userId = null,
  sessionId = null,
}) {
  const code = String(couponCode || '').trim().toUpperCase();
  if (!code) return { discount: 0, couponCode: null, couponSource: '', couponType: '' };

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
        code,
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

const loadPreviewItemsFromCart = async (idQuery) => {
  const cart = await QuickCart.findOne(idQuery).lean();
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { items: [], products: [] };
  }

  const productIds = cart.items
    .map((item) => stripCompositeProductId(item.productId))
    .filter((id) => mongoose.isValidObjectId(id));

  const products = await QuickProduct.find({
    _id: { $in: productIds },
    ...approvedProductFilter,
  }).lean();
  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  const items = cart.items
    .map((item) => {
      const product = productMap[String(item.productId)];
      if (!product) return null;
      const variantMeta = {
        variantName: item.variantName || '',
        variantKey: item.variantKey || '',
        variantSku: item.variantSku || '',
        price: Number(item.unitPrice || 0),
      };
      const unitPrice = resolveVariantUnitPrice(product, variantMeta);
      const variantLabel = resolveVariantLabel(product, variantMeta);
      return {
        productId: product._id,
        sellerId: product.sellerId || null,
        name: product.name,
        price: unitPrice,
        quantity: Math.max(1, Number(item.quantity || 1)),
        variantName: variantLabel,
        variantKey: variantMeta.variantKey || '',
        variantSku: variantMeta.variantSku || '',
        packingFee: Number(product.packingFee || 0),
        lineKey: buildCartLineKey(product._id, variantMeta.variantKey, variantMeta.variantName),
        stock: resolveVariantStock(product, variantMeta),
      };
    })
    .filter(Boolean);

  return { items, products };
};

/**
 * Server-authoritative cart/checkout bill preview (same math as placeOrder).
 */
export async function buildQuickCheckoutPreview({
  idQuery,
  latitude = null,
  longitude = null,
  couponCode = null,
  couponSource = null,
} = {}) {
  if (!idQuery) {
    const err = new ValidationError('sessionId or userId is required');
    err.statusCode = 400;
    throw err;
  }

  const { items, products } = await loadPreviewItemsFromCart(idQuery);
  if (!items.length) {
    return {
      items: [],
      subtotal: 0,
      discount: 0,
      deliveryFee: 0,
      handlingFee: 0,
      packagingFee: 0,
      platformFee: 0,
      gst: 0,
      tax: 0,
      total: 0,
      distanceKm: 0,
      distanceEstimated: false,
      couponCode: null,
      couponType: '',
      currency: 'INR',
      source: 'server',
    };
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

  let discount = 0;
  let resolvedCouponCode = null;
  let couponType = '';
  let discountError = null;
  try {
    const discountResult = await resolveServerQuickDiscount({
      couponCode,
      couponSource,
      subtotal,
      items,
      userId: idQuery.userId || null,
      sessionId: idQuery.sessionId || null,
    });
    discount = Number(discountResult.discount || 0);
    resolvedCouponCode = discountResult.couponCode || null;
    couponType = discountResult.couponType || '';
  } catch (err) {
    // Preview should still return fees if coupon is invalid; surface soft error.
    if (String(couponCode || '').trim()) {
      discountError = err?.message || 'Invalid coupon';
    }
  }

  const packagingFee = items.reduce(
    (sum, item) => sum + Number(item.packingFee || 0) * Number(item.quantity || 0),
    0,
  );

  let distanceKm = 0;
  let distanceEstimated = false;
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const sellerId = items.find((item) => item.sellerId)?.sellerId;
    if (sellerId) {
      const seller = await Seller.findById(sellerId).select('location').lean();
      const sellerCoords = getSellerLocation(seller);
      if (sellerCoords) {
        const distanceResult = await roadDistanceDetails(
          sellerCoords.lat,
          sellerCoords.lng,
          lat,
          lng,
        );
        if (Number.isFinite(distanceResult?.distanceKm) && distanceResult.distanceKm >= 0) {
          distanceKm = distanceResult.distanceKm;
          distanceEstimated = Boolean(distanceResult.estimated);
        }
      }
    }
  }

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

  const tax = Number(pricing?.gst || pricing?.tax || 0);
  const deliveryFee = Number(pricing?.deliveryFee || 0);
  const handlingFee = Number(pricing?.handlingFee || 0);
  const platformFee = Number(pricing?.platformFee || 0);
  const packaging = Number(pricing?.packagingFee || packagingFee || 0);
  const total = Math.max(
    0,
    subtotal + deliveryFee + platformFee + tax + packaging + handlingFee - discount,
  );

  return {
    items: items.map((item) => ({
      productId: String(item.productId),
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      variantName: item.variantName || '',
      packingFee: item.packingFee,
      lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
      sellerId: item.sellerId ? String(item.sellerId) : '',
    })),
    subtotal,
    discount,
    deliveryFee,
    handlingFee,
    packagingFee: packaging,
    platformFee,
    gst: tax,
    tax,
    total,
    distanceKm,
    distanceEstimated,
    couponCode: resolvedCouponCode,
    couponType,
    currency: 'INR',
    source: 'server',
    ...(discountError ? { couponError: discountError } : {}),
  };
}
