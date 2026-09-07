import mongoose from 'mongoose';
import { getIO, rooms } from '../../../config/socket.js';
import { logger } from '../../../utils/logger.js';
import { QuickOrder } from '../models/order.model.js';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { ReturnRequest } from '../returns/models/returnRequest.model.js';
import { SellerReturn } from '../seller/models/sellerReturn.model.js';
import { ReturnOtp } from '../returns/models/returnOtp.model.js';
import { getSellerCommissionSnapshot } from '../admin/services/commission.service.js';
import {
  createRazorpayOrder,
  isRazorpayConfigured,
  getRazorpayKeyId,
  verifyPaymentSignature,
  initiateRazorpayRefund
} from '../../food/orders/helpers/razorpay.helper.js';
import {
  calculateQuickPricing,
  calculateDeliverySplit,
  getActiveFeeSettings,
} from '../admin/services/billing.service.js';
import { haversineDistanceMeters } from '../../../utils/geo.js';
import { isShopCurrentlyOpen } from '../utils/shopTiming.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { deductWalletBalance, refundWalletBalance } from '../../food/user/services/userWallet.service.js';
import { emitQuickCommerceStatusUpdate } from '../services/quickStatusRealtime.service.js';

const USER_CANCEL_FULL_REFUND_WINDOW_MS = 30 * 1000;

const approvedProductFilter = {
  $or: [
    { isActive: true },
    { isActive: { $exists: false } },
    { status: 'active' },
  ],
  $and: [
    {
      $or: [
        { approvalStatus: { $exists: false } },
        { approvalStatus: 'approved' },
      ],
    },
  ],
};

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = String(req.headers['x-quick-session'] || req.body.sessionId || req.query.sessionId || '').trim();
  return sessionId ? { sessionId } : null;
};

const patchExistingOrderTax = (order) => {
  if (order && order.pricing) {
    if (!order.pricing.tax && !order.pricing.gst) {
      const p = order.pricing;
      const computedSum = (p.subtotal || 0) + (p.deliveryFee || 0) + (p.handlingFee || 0) + (p.platformFee || 0) + (p.packagingFee || 0) - (p.discount || 0) + (p.tip || 0);
      const diff = (p.total || 0) - computedSum;
      if (diff > 0) {
        order.pricing.tax = diff;
      }
    }
  }
};

const getOrderPayableAmount = (order) => {
  const pricing = order?.pricing || {};
  const pricingTotal = Number(pricing.total ?? order?.total ?? 0);
  const platformFee = Number(pricing.platformFee ?? 0);

  // In quick-commerce, `pricing.total` is subtotal + fees (delivery/handling/gst...) minus discounts.
  // Platform fee is stored separately and is part of what the customer pays.
  const computed =
    Number.isFinite(platformFee) && platformFee > 0
      ? pricingTotal + platformFee
      : pricingTotal;

  return Number.isFinite(computed) ? Math.max(0, computed) : 0;
};

const normalizeOrderSummary = (order) => {
  patchExistingOrderTax(order);
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
        }))
      : [],
    pricing: order.pricing || {},
  };
};

const normalizeDeliveryAddress = (address) => {
  if (!address || typeof address !== 'object') return null;

  const street = String(address.address || address.street || '').trim();
  const city = String(address.city || '').trim();
  const additionalDetails = String(address.landmark || address.additionalDetails || '').trim();
  const phone = String(address.phone || '').trim();
  const label = ['Home', 'Office', 'Other'].includes(address.type) ? address.type : 'Other';
  const lat = Number(address.location?.lat);
  const lng = Number(address.location?.lng);

  return {
    label,
    street,
    additionalDetails,
    city: city || 'NA',
    state: 'NA',
    zipCode: '',
    phone,
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

const normalizeRequestedItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      productId: String(item?.productId || item?.itemId || item?.id || item?._id || '').trim(),
      quantity: Math.max(1, Number(item?.quantity || 1)),
      // Preserve variant info for variant-aware pricing
      ...(item?.variantId ? { variantId: String(item.variantId).trim() } : {}),
      ...(item?.variantName ? { variantName: String(item.variantName).trim() } : {}),
      ...(item?.price != null ? { price: Number(item.price) } : {}),
    }))
    .filter((item) => item.productId && mongoose.isValidObjectId(item.productId));
};

const emitQuickOrderStatusUpdate = (order, message = '') => {
  try {
    void emitQuickCommerceStatusUpdate(order, { message });
  } catch {
    // best-effort realtime update
  }
};

const emitQuickSellerOrders = (sellerOrders) => {
  try {
    const io = getIO();
    if (!io || !Array.isArray(sellerOrders) || sellerOrders.length === 0) return;

    sellerOrders.forEach((sellerOrder) => {
      if (!sellerOrder?.sellerId) return;
      const payload = {
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder._id?.toString?.() || '',
        status: sellerOrder.status,
        workflowStatus: sellerOrder.workflowStatus,
        items: sellerOrder.items || [],
        pricing: sellerOrder.pricing || {},
        createdAt: sellerOrder.createdAt || new Date(),
      };

      io.to(rooms.seller(sellerOrder.sellerId)).emit('new_order', payload);
      io.to(rooms.seller(sellerOrder.sellerId)).emit('order:new', payload);
    });
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
    const requestedItems = normalizeRequestedItems(req.body?.items);
    // Prefer frontend-sent items when they contain variant info, since the
    // backend cart model cannot store variant data (only productId + quantity).
    const requestedHasVariants = requestedItems.some((item) => item.variantId || item.variantName);
    const sourceItems =
      requestedHasVariants && requestedItems.length > 0
        ? requestedItems
        : (Array.isArray(cart?.items) && cart.items.length > 0 ? cart.items : requestedItems);

    if (sourceItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const productIds = sourceItems.map((item) => item.productId);
    const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
    const productMap = products.reduce((acc, product) => {
      acc[String(product._id)] = product;
      return acc;
    }, {});

    let items = sourceItems
      .map((item) => {
        const product = productMap[String(item.productId)];
        if (!product) return null;

        // Use variant-specific pricing when variantId is provided
        let unitPrice;
        let itemName = product.name;
        if (item.variantId && Array.isArray(product.variants) && product.variants.length > 0) {
          const variant = product.variants.find((v) => String(v._id) === String(item.variantId));
          if (variant) {
            unitPrice = Number(variant.salePrice || 0) > 0
              ? Number(variant.salePrice)
              : Number(variant.price || 0);
            itemName = `${product.name} (${variant.name})`;
          }
        } else if (item.variantName && Array.isArray(product.variants) && product.variants.length > 0) {
          const variant = product.variants.find((v) => v.name === item.variantName);
          if (variant) {
            unitPrice = Number(variant.salePrice || 0) > 0
              ? Number(variant.salePrice)
              : Number(variant.price || 0);
            itemName = `${product.name} (${variant.name})`;
          }
        }
        // If variant was requested but not found in DB, skip item (never trust frontend price)
        if (!unitPrice && (item.variantId || item.variantName)) {
          logger.warn(`placeOrder: variant not found in DB, skipping item`, {
            productId: String(product._id),
            variantId: item.variantId || null,
            variantName: item.variantName || null,
          });
          return null;
        }
        // Default: use base product price
        if (!unitPrice) {
          unitPrice = Number(product.salePrice || 0) > 0
            ? Number(product.salePrice)
            : Number(product.price || 0);
        }

        return {
          productId: product._id,
          sellerId: product.sellerId || null,
          name: itemName,
          image: product.image || product.mainImage || '',
          price: unitPrice,
          quantity: item.quantity,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          ...(item.variantName ? { variantName: item.variantName } : {}),
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

          // Use variant-specific pricing when variantId is provided
          let unitPrice;
          let itemName = product.name;
          if (item.variantId && Array.isArray(product.variants) && product.variants.length > 0) {
            const variant = product.variants.find((v) => String(v._id) === String(item.variantId));
            if (variant) {
              unitPrice = Number(variant.salePrice || 0) > 0
                ? Number(variant.salePrice)
                : Number(variant.price || 0);
              itemName = `${product.name} (${variant.name})`;
            }
          } else if (item.variantName && Array.isArray(product.variants) && product.variants.length > 0) {
            const variant = product.variants.find((v) => v.name === item.variantName);
            if (variant) {
              unitPrice = Number(variant.salePrice || 0) > 0
                ? Number(variant.salePrice)
                : Number(variant.price || 0);
              itemName = `${product.name} (${variant.name})`;
            }
          }
          // If variant was requested but not found in DB, skip item (never trust frontend price)
          if (!unitPrice && (item.variantId || item.variantName)) {
            logger.warn(`placeOrder fallback: variant not found in DB, skipping item`, {
              productId: String(product._id),
              variantId: item.variantId || null,
              variantName: item.variantName || null,
            });
            return null;
          }
          if (!unitPrice) {
            unitPrice = Number(product.salePrice || 0) > 0
              ? Number(product.salePrice)
              : Number(product.price || 0);
          }

          return {
            productId: product._id,
            sellerId: product.sellerId || null,
            name: itemName,
            image: product.image || product.mainImage || '',
            price: unitPrice,
            quantity: item.quantity,
            ...(item.variantId ? { variantId: item.variantId } : {}),
            ...(item.variantName ? { variantName: item.variantName } : {}),
          };
        })
        .filter(Boolean);
    }

    if (items.length === 0) {
      logger.warn(`Quick placeOrder: No valid items found for productIds: ${JSON.stringify(productIds)} using idQuery: ${JSON.stringify(idQuery)}`);
      return res.status(400).json({ success: false, message: 'No valid items found in cart' });
    }

    // Verify all sellers for the items are currently open
    const orderSellerIds = [...new Set(items.map((it) => it.sellerId).filter(Boolean))];
    if (orderSellerIds.length > 0) {
      const orderSellers = await Seller.find({ _id: { $in: orderSellerIds } })
        .select('shopName shopInfo isActive approved isDeleted')
        .lean();

      for (const seller of orderSellers) {
        if (seller.isActive === false || seller.approved === false || seller.isDeleted === true) {
          return res.status(400).json({
            success: false,
            message: `${seller.shopName || 'A store in your cart'} is currently unavailable.`,
          });
        }
        const timing = isShopCurrentlyOpen(seller.shopInfo?.openingHours);
        if (!timing.isOpen) {
          return res.status(400).json({
            success: false,
            message: `${seller.shopName || 'Store'} is currently closed (${timing.timingText}). Cannot place order while store is closed.`,
          });
        }
      }
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = 0; // Never trust frontend discountTotal — only verified coupons can set a discount
    let validCouponCode = null;

    if (req.body?.couponCode) {
      const { QuickCoupon } = await import('../models/coupon.model.js');
      const coupon = await QuickCoupon.findOne({ code: String(req.body.couponCode).toUpperCase() });
      if (coupon && coupon.isActive) {
        const now = new Date();
        const isValidDate = (!coupon.validTill || new Date(coupon.validTill) >= now) && 
                            (!coupon.validFrom || new Date(coupon.validFrom) <= now);
        const isValidUsage = (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit);
        const isValidOrderValue = (!coupon.minOrderValue || subtotal >= coupon.minOrderValue);

        if (isValidDate && isValidUsage && isValidOrderValue) {
          let calcDiscount = 0;
          if (coupon.discountType === 'percentage') {
            calcDiscount = (subtotal * coupon.discountValue) / 100;
          } else if (coupon.discountType === 'flat' || coupon.discountType === 'fixed') {
            calcDiscount = coupon.discountValue;
          }
          if (coupon.maxDiscount && calcDiscount > coupon.maxDiscount) {
            calcDiscount = coupon.maxDiscount;
          }
          
          discount = calcDiscount;
          validCouponCode = coupon.code;
          await QuickCoupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });
        } else {
          return res.status(400).json({ success: false, message: 'Coupon invalid or expired' });
        }
      } else {
         return res.status(400).json({ success: false, message: 'Invalid coupon code' });
      }
    }

    const tip = Number(req.body?.selectedTip || req.body?.tip || 0);
    const deliveryAddress = normalizeDeliveryAddress(req.body?.address);

    const sellerBuckets = new Map();
    items.forEach((item) => {
      const sellerId = item.sellerId ? String(item.sellerId) : '';
      if (!sellerId) {
        logger.warn(`Quick placeOrder fan-out skipped: Product has no sellerId.`, {
          productId: item.productId,
          name: item.name,
          isPlatformFulfilled: true,
        });
        return;
      }
      if (!sellerBuckets.has(sellerId)) sellerBuckets.set(sellerId, []);
      sellerBuckets.get(sellerId).push(item);
    });

    const sellerIds = Array.from(sellerBuckets.keys());
    const sellers = sellerIds.length > 0 ? await Seller.find({ _id: { $in: sellerIds } }).lean() : [];
    const sellerMap = sellers.reduce((acc, seller) => {
      acc[String(seller._id)] = seller;
      return acc;
    }, {});

    // Distance-based delivery fee is computed per seller (their pickup point vs the
    // delivery address) and split between the customer and that seller per the
    // matched sponsor rule, then aggregated into the order-level delivery fee.
    const feeSettings = await getActiveFeeSettings();
    const customerCoords = Array.isArray(deliveryAddress?.location?.coordinates) && deliveryAddress.location.coordinates.length === 2
      ? deliveryAddress.location.coordinates
      : null;

    const sellerDeliverySplits = new Map();
    let aggUserDeliveryFee = 0;
    let aggSellerDeliveryFee = 0;
    let aggTotalDeliveryFee = 0;
    let maxDistanceKm = 0;
    const sponsorTypesSeen = new Set();

    for (const [sellerId, sellerItems] of sellerBuckets.entries()) {
      const seller = sellerMap[sellerId];
      const sellerSubtotal = sellerItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      );
      const sellerCoords = seller?.location?.coordinates;
      const distanceKm = Array.isArray(sellerCoords) && sellerCoords.length === 2 && customerCoords
        ? haversineDistanceMeters(sellerCoords[1], sellerCoords[0], customerCoords[1], customerCoords[0]) / 1000
        : 0;

      const split = calculateDeliverySplit(sellerSubtotal, distanceKm, feeSettings);
      sellerDeliverySplits.set(sellerId, { ...split, sellerSubtotal });
      aggUserDeliveryFee += split.userDeliveryFee;
      aggSellerDeliveryFee += split.sellerDeliveryFee;
      aggTotalDeliveryFee += split.totalDeliveryFee;
      maxDistanceKm = Math.max(maxDistanceKm, distanceKm);
      sponsorTypesSeen.add(split.deliverySponsorType);
    }

    // No items carried a sellerId (platform-fulfilled order) — fall back to a
    // single flat split on the whole subtotal so delivery fee is never silently 0.
    if (sellerBuckets.size === 0) {
      const fallbackSplit = calculateDeliverySplit(subtotal, 0, feeSettings);
      aggUserDeliveryFee = fallbackSplit.userDeliveryFee;
      aggSellerDeliveryFee = fallbackSplit.sellerDeliveryFee;
      aggTotalDeliveryFee = fallbackSplit.totalDeliveryFee;
      sponsorTypesSeen.add(fallbackSplit.deliverySponsorType);
    }

    const { pricing } = await calculateQuickPricing({
      subtotal,
      discount,
      tip,
      products,
    });

    // Override the flat single-distance estimate with the seller-aware aggregate.
    pricing.deliveryFee = Number(aggUserDeliveryFee.toFixed(2));
    pricing.totalDeliveryFee = Number(aggTotalDeliveryFee.toFixed(2));
    pricing.userDeliveryFee = pricing.deliveryFee;
    pricing.restaurantDeliveryFee = Number(aggSellerDeliveryFee.toFixed(2));
    pricing.sponsoredDelivery = aggSellerDeliveryFee > 0;
    pricing.sponsoredKm = Number(maxDistanceKm.toFixed(2));
    pricing.deliveryDistanceKm = Number(maxDistanceKm.toFixed(2));
    pricing.deliverySponsorType = sponsorTypesSeen.size === 1
      ? [...sponsorTypesSeen][0]
      : (sponsorTypesSeen.size > 1 ? 'SPLIT' : 'USER_FULL');
    pricing.total = Math.max(
      0,
      Number(pricing.subtotal || 0) +
        pricing.deliveryFee +
        Number(pricing.handlingFee || 0) +
        Number(pricing.platformFee || 0) +
        Number(pricing.tax || 0) -
        Number(pricing.discount || 0) +
        Number(pricing.tip || 0),
    );

    const deliveryFee = Number(pricing.deliveryFee || 0);
    const total = Number(pricing.total || 0);
    const orderNumber = `QC${Date.now().toString().slice(-8)}`;
    const paymentModeRaw = String(req.body?.paymentMode || 'COD').toUpperCase();
    const isOnlinePayment = paymentModeRaw === 'ONLINE';
    const isWalletPayment = paymentModeRaw === 'WALLET';
    const paymentMode = isOnlinePayment ? 'razorpay' : isWalletPayment ? 'wallet' : 'cash';
    const sellerPaymentMode = isOnlinePayment ? 'online' : isWalletPayment ? 'wallet' : 'cash';
    const shouldFanOutSellerOrders = true;
    const amountDue = Math.max(0, total);

    if (isWalletPayment) {
      if (!idQuery.userId) {
        return res.status(400).json({ success: false, message: 'Please log in to pay with your wallet' });
      }
      try {
        await deductWalletBalance(idQuery.userId, amountDue, `Payment for Order #${orderNumber}`, {
          orderNumber,
        });
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message || 'Failed to deduct wallet balance' });
      }
    }

    let razorpayPayload = null;
    let rpOrderId = null;
    if (paymentMode === 'razorpay' && isRazorpayConfigured()) {
      const amountPaise = Math.round(amountDue * 100);
      if (amountPaise >= 100) {
        try {
          const rzOrder = await createRazorpayOrder(amountPaise, "INR", orderNumber);
          rpOrderId = rzOrder.id;
          razorpayPayload = {
            key: getRazorpayKeyId(),
            orderId: rzOrder.id,
            amount: rzOrder.amount,
            currency: rzOrder.currency || "INR",
          };
        } catch (err) {
          logger.error(`Quick placeOrder Razorpay failed: ${err.message}`);
          return res.status(500).json({ success: false, message: 'Failed to initialize payment gateway' });
        }
      } else {
        return res.status(400).json({ success: false, message: 'Amount too low for online payment' });
      }
    }

    // Rider earning is the full distance-based delivery fee (before any
    // user/seller sponsor split) — whoever pays for delivery, the full
    // amount goes to the delivery partner as their earning.
    const riderEarning = Number(pricing.totalDeliveryFee || 0);

    const pickupPoints = [];
    for (const [sellerId, sellerItems] of sellerBuckets.entries()) {
      const seller = sellerMap[sellerId];
      if (seller) {
         pickupPoints.push({
           pickupType: 'quick',
           sourceId: sellerId,
           sourceName: seller.shopName || seller.name || 'Seller store',
           address: seller.location?.address || seller.location?.formattedAddress || seller.address || '',
           location: seller.location?.coordinates ? {
             type: 'Point',
             coordinates: seller.location.coordinates
           } : undefined,
           itemIds: sellerItems.map(i => String(i.productId))
         });
      }
    }

    const order = await QuickOrder.create({
      orderType: 'quick',
      orderId: orderNumber,
      sessionId: idQuery.sessionId || '',
      userId: idQuery.userId || null,
      items: items.map((item) => ({
        itemId: String(item.productId),
        name: item.name,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        type: 'quick',
        sourceId: String(item.sellerId || item.productId),
        sourceName: '',
      })),
      pickupPoints,
      pricing: {
        ...pricing,
        subtotal,
        total,
      },
      couponCode: validCouponCode || null,
      deliveryAddress,
      timeSlot: req.body?.timeSlot || 'now',
      payment: {
        method: paymentMode,
        status: paymentMode === 'razorpay' ? 'created' : paymentMode === 'wallet' ? 'paid' : 'cod_pending',
        amountDue,
        ...(rpOrderId ? { razorpay: { orderId: rpOrderId, paymentId: '', signature: '' } } : {})
      },
      orderStatus: 'placed',
      riderEarning: riderEarning || 0,
      // Delivery fee is now a pure pass-through to the rider (riderEarning ==
      // totalDeliveryFee), so it nets to zero here regardless of who paid for
      // it — platform profit comes only from platformFee (+ seller commission
      // below, once known).
      platformProfit: Math.max(0, Number(pricing.platformFee || 0)), // Initial guess, will be updated with commission
      statusHistory: [
        {
          byRole: 'SYSTEM',
          from: '',
          to: 'placed',
          note: 'Quick commerce order placed',
        },
      ],
    });

    const sellerOrdersResults = sellerBuckets.size > 0
        ? await Promise.all(Array.from(sellerBuckets.entries()).map(async ([sellerId, sellerItems]) => {
            const delivery = sellerDeliverySplits.get(sellerId) || {
              sellerSubtotal: 0,
              userDeliveryFee: 0,
              sellerDeliveryFee: 0,
            };
            const sellerSubtotal = delivery.sellerSubtotal;

            // Calculate commission for this specific seller
            const { commissionAmount } = await getSellerCommissionSnapshot(sellerId, sellerSubtotal);
            // Sellers on a SELLER_FULL/SPLIT sponsor rule absorb their portion of the
            // delivery fee, reducing what they receive for this order leg.
            const sellerReceivable = Math.max(
              0,
              Number((sellerSubtotal - commissionAmount - delivery.sellerDeliveryFee).toFixed(2)),
            );

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
              })),
              pricing: {
                subtotal: sellerSubtotal,
                commission: commissionAmount,
                total: sellerSubtotal + delivery.userDeliveryFee,
                receivable: sellerReceivable,
                deliveryFeeBorne: delivery.sellerDeliveryFee,
              },
              status: 'pending',
              workflowStatus: 'SELLER_PENDING',
              sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
              address: {
                address: deliveryAddress?.street || '',
                city: deliveryAddress?.city || '',
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

    const totalSellerCommission = sellerOrdersResults.reduce((sum, so) => sum + (so.pricing?.commission || 0), 0);
    
    // Update the main order with the total commission
    if (totalSellerCommission > 0) {
      // Delivery fee nets to zero (see placement above) — profit is platformFee + seller commission.
      const platformProfit = Math.max(
        0,
        Number(pricing.platformFee || 0) + totalSellerCommission,
      );
      await QuickOrder.updateOne(
        { _id: order._id },
        { 
          $set: { 
            'pricing.restaurantCommission': totalSellerCommission,
            platformProfit: platformProfit
          } 
        }
      );
      order.pricing.restaurantCommission = totalSellerCommission;
      order.platformProfit = platformProfit;
    }

    const sellerOrders = sellerOrdersResults;

    await QuickCart.findOneAndUpdate(idQuery, { $set: { items: [] } }, { upsert: false });

    emitQuickOrderStatusUpdate(order, 'Quick order placed successfully.');

    if (shouldFanOutSellerOrders) {
      void (async () => {
        try {
          if (!sellerOrders.length) return;
          // Idempotent upsert: protects against retries / duplicate placeOrder submissions.
          const upserts = await Promise.all(
            sellerOrders.map((doc) =>
              SellerOrder.findOneAndUpdate(
                { sellerId: doc.sellerId, orderId: doc.orderId },
                { $set: doc },
                { upsert: true, new: true, setDefaultsOnInsert: true },
              ),
            ),
          );
          emitQuickSellerOrders(upserts.filter(Boolean));
        } catch (error) {
          logger.error(`Quick seller order fanout failed for ${order.orderId}: ${error?.message || error}`);
        }
      })();
    }

    return res.status(201).json({
      success: true,
      result: {
        id: order._id,
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderId,
        total: getOrderPayableAmount(order),
        totalAmount: getOrderPayableAmount(order),
        payableAmount: getOrderPayableAmount(order),
        amount: getOrderPayableAmount(order),
        status: order.orderStatus,
        orderStatus: order.orderStatus,
        paymentMethod: order.payment?.method || paymentMode,
        paymentStatus: order.payment?.status || '',
        pricing: order.pricing || {},
        createdAt: order.createdAt,
      },
      ...(razorpayPayload ? { razorpay: razorpayPayload } : {}),
    });
  } catch (error) {
    logger.error(`Quick placeOrder failed: ${error?.message || error}`);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to place quick order',
    });
  }
};

export const getMyOrders = async (req, res) => {
  const idQuery = resolveId(req);

  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const skip = (page - 1) * limit;

  const totalOrders = await QuickOrder.countDocuments({ ...idQuery, orderType: 'quick' });
  const orders = await QuickOrder.find({ ...idQuery, orderType: 'quick' })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

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

  return res.json({
    success: true,
    result: mappedOrders,
    results: mappedOrders,
    pagination: {
      total: totalOrders,
      page,
      limit,
      hasMore: (page * limit) < totalOrders,
    }
  });
};

export const getOrderById = async (req, res) => {
  try {
    const idQuery = resolveId(req);

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
      $or: orderIdentityQuery,
    };

    const order = await QuickOrder.findOne(query).select('+deliveryOtp').populate('userId', 'name phone email').lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const sellerOrder = await SellerOrder.findOne({ orderId: order.orderId }).lean();
    const seller =
      sellerOrder?.sellerId
        ? await Seller.findById(sellerOrder.sellerId).select('_id name shopName location phone address').lean()
        : null;

    const returnRequest = await ReturnRequest.findOne({ orderId: order.orderId }).lean();
    let pickupOtp = null;
    if (returnRequest) {
      const activePickupLeg = await SellerReturn.findOne({
        returnRequestId: returnRequest._id,
        returnStatus: { $in: ['RETURN_PICKUP_ASSIGNED', 'PICKUP_EN_ROUTE', 'PICKUP_REACHED', 'PICKUP_OTP_PENDING'] }
      }).lean();

      if (activePickupLeg) {
        const otpDoc = await ReturnOtp.findOne({ 
          sellerReturnId: activePickupLeg._id, 
          type: 'pickup', 
          verified: false,
          expiresAt: { $gt: new Date() }
        }).select('+plainOtp').sort({ createdAt: -1 }).lean();
        
        if (otpDoc?.plainOtp) {
          pickupOtp = otpDoc.plainOtp;
        }
      }
    }

    const deliveryAddress = order.deliveryAddress || {};
    const deliveryCoords = Array.isArray(deliveryAddress.location?.coordinates)
      ? {
          lat: Number(deliveryAddress.location.coordinates[1]),
          lng: Number(deliveryAddress.location.coordinates[0]),
        }
      : null;
    const dropOtp = order.deliveryVerification?.dropOtp || {};
    const handoverOtp = String(order.deliveryOtp || '').trim();

    patchExistingOrderTax(order);

    return res.json({
      success: true,
      result: {
        ...order,
        id: order._id,
        _id: order._id,
        orderNumber: order.orderId,
        orderId: order.orderId,
        address: {
          type: deliveryAddress.label || 'Other',
          name: deliveryAddress.name || '',
          street: deliveryAddress.street || '',
          address: deliveryAddress.street || '',
          city: deliveryAddress.city || '',
          state: deliveryAddress.state || '',
          zipCode: deliveryAddress.zipCode || '',
          phone: deliveryAddress.phone || '',
          ...(deliveryCoords ? { location: deliveryCoords } : {}),
        },
        seller: seller
          ? {
              _id: seller._id,
              id: seller._id,
              name: seller.shopName || seller.name || 'Store',
              shopName: seller.shopName || seller.name || 'Store',
              phone: seller.phone || '',
              location: seller.location || null,
              address: seller.location?.formattedAddress || seller.location?.address || seller.address || '',
            }
          : null,
        sellerOrder: sellerOrder
          ? {
              _id: sellerOrder._id,
              status: sellerOrder.status,
              workflowStatus: sellerOrder.workflowStatus,
              address: sellerOrder.address || null,
            }
          : null,
        deliveryVerification: {
          ...(order.deliveryVerification || {}),
          dropOtp: {
            required: Boolean(dropOtp.required),
            verified: Boolean(dropOtp.verified),
          },
        },
        ...(dropOtp.required && !dropOtp.verified && handoverOtp
          ? { handoverOtp }
          : {}),
        returnRequest: returnRequest
          ? {
              _id: returnRequest._id,
              status: returnRequest.status,
              ...(pickupOtp ? { pickupOtp } : {}),
            }
          : null,
      },
    });
  } catch (error) {
    logger.error(`Quick getOrderById failed: ${error?.message || error}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch order details' });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const idQuery = resolveId(req);
    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const order = await QuickOrder.findOne({
      ...idQuery,
      $or: [{ _id: orderId }, { orderId: orderId }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    order.payment.status = 'paid';
    if (!order.payment.razorpay) order.payment.razorpay = {};
    order.payment.razorpay.paymentId = razorpayPaymentId;
    order.payment.razorpay.signature = razorpaySignature;
    
    order.statusHistory.push({
      byRole: 'USER',
      from: order.orderStatus,
      to: order.orderStatus,
      note: 'Payment verified successfully',
    });

    await order.save();
    emitQuickOrderStatusUpdate(order, 'Payment verified successfully');

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { payment: order.payment },
    });
  } catch (error) {
    logger.error(`Quick verifyPayment failed: ${error?.message || error}`);
    return res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};


export const cancelOrder = async (req, res) => {
  try {
    const idQuery = resolveId(req);

    if (!idQuery) {
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
      ...idQuery,
      orderType: 'quick',
      $or: orderIdentityQuery,
    };

    const order = await QuickOrder.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentStatus = String(order.orderStatus || '').toLowerCase();
    if (['delivered', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: currentStatus === 'delivered' ? 'Delivered orders cannot be cancelled' : 'Order is already cancelled',
      });
    }

    order.orderStatus = 'cancelled_by_user';
    order.workflowStatus = 'CANCELLED';
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.push({
      byRole: 'USER',
      from: currentStatus || '',
      to: 'cancelled_by_user',
      note: String(req.body?.reason || 'Quick commerce order cancelled by user').trim(),
    });

    const paymentMethod = String(order.payment?.method || '').toLowerCase();
    const isWalletPaid = paymentMethod === 'wallet' && (order.payment.status === 'paid' || order.payment.status === 'refunded');
    const isOnlinePaid = ['razorpay', 'razorpay_qr', 'online'].includes(paymentMethod) && (order.payment.status === 'paid' || order.payment.status === 'refunded');
    const refundTo = req.body?.refundTo;
    const requestedRefundMethod = refundTo === 'wallet' || refundTo === 'gateway' ? refundTo : 'gateway';
    const reason = req.body?.reason || '';

    const elapsedMs = Date.now() - new Date(order.createdAt).getTime();
    const isWithinRefundWindow = elapsedMs <= USER_CANCEL_FULL_REFUND_WINDOW_MS || ['created', 'placed'].includes(currentStatus);

    if (isWalletPaid) {
      if (isWithinRefundWindow) {
        try {
          await refundWalletBalance(req.user?._id || order.userId, order.pricing.total, `Refund for cancelled order #${order.orderId}`, {
            orderId: order._id,
            orderCustomId: order.orderId,
            source: 'user_cancel_wallet_refund'
          });
          order.payment.status = 'refunded';
          order.payment.refund = {
            status: 'processed',
            amount: order.pricing.total,
            refundId: `wallet_refund_${Date.now()}`,
            requestedMethod: 'wallet',
            processedMethod: 'wallet',
            requestedAt: new Date(),
            processedAt: new Date(),
            reason: reason
          };
          await foodTransactionService.updateTransactionStatus(order._id, 'refunded');
        } catch (err) {
          logger.error(`Quick User cancel automated wallet refund failed: ${err}`);
          order.payment.refund = {
            status: 'pending',
            amount: order.pricing.total,
            requestedMethod: 'wallet',
            requestedAt: new Date(),
            requestedByUser: true,
            reason: reason
          };
        }
      } else {
        order.payment.refund = {
          status: 'pending',
          amount: order.pricing.total,
          requestedMethod: 'wallet',
          requestedAt: new Date(),
          requestedByUser: true,
          reason: reason
        };
      }
    } else if (isOnlinePaid) {
      if (requestedRefundMethod === 'wallet' && isWithinRefundWindow) {
        try {
          await refundWalletBalance(req.user?._id || order.userId, order.pricing.total, `Refund for cancelled order #${order.orderId} (Refunded to wallet)`, {
            orderId: order._id,
            orderCustomId: order.orderId,
            source: 'user_cancel_online_to_wallet_refund'
          });
          order.payment.status = 'refunded';
          order.payment.refund = {
            status: 'processed',
            amount: order.pricing.total,
            refundId: `wallet_refund_${Date.now()}`,
            requestedMethod: 'wallet',
            processedMethod: 'wallet',
            requestedAt: new Date(),
            processedAt: new Date(),
            reason: reason
          };
          await foodTransactionService.updateTransactionStatus(order._id, 'refunded');
        } catch (err) {
          logger.error(`Quick User cancel online-to-wallet automated refund failed: ${err}`);
          order.payment.refund = {
            status: 'pending',
            amount: order.pricing.total,
            requestedMethod: 'wallet',
            requestedAt: new Date(),
            requestedByUser: true,
            reason: reason
          };
        }
      } else {
        order.payment.refund = {
          ...(order.payment.refund || {}),
          status: 'pending',
          amount: Number(order.pricing?.total || 0),
          refundId: '',
          requestedMethod: requestedRefundMethod,
          processedMethod: undefined,
          requestedAt: new Date(),
          requestedByUser: true,
          reason: reason,
          processedAt: null,
        };
      }
    } else if (!['paid', 'refunded'].includes(order.payment?.status)) {
      if (order.payment) {
        order.payment.status = 'cancelled';
      }
    }

    await order.save();

    await SellerOrder.updateMany(
      {
        orderId: order.orderId,
        status: { $nin: ['cancelled', 'delivered'] },
      },
      {
        $set: {
          status: 'cancelled',
          workflowStatus: 'CANCELLED',
        },
      },
    );

    emitQuickOrderStatusUpdate(order, 'Quick order cancelled successfully.');

    return res.json({
      success: true,
      result: {
        id: order._id,
        _id: order._id,
        orderId: order.orderId,
        orderNumber: order.orderId,
        status: order.orderStatus,
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

