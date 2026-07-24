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
} from '../../food/orders/helpers/razorpay.helper.js';
import {
  calculateQuickPricing,
  getRiderEarning as getQuickRiderEarning,
} from '../admin/services/billing.service.js';
import * as foodTransactionService from '../../food/orders/services/foodTransaction.service.js';
import { emitQuickCommerceStatusUpdate } from '../services/quickStatusRealtime.service.js';

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
    const sourceItems =
      Array.isArray(cart?.items) && cart.items.length > 0 ? cart.items : requestedItems;

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
        const unitPrice =
          Number(product.salePrice || 0) > 0
            ? Number(product.salePrice)
            : Number(product.price || 0);
        return {
          productId: product._id,
          sellerId: product.sellerId || null,
          name: product.name,
          image: product.image || product.mainImage || '',
          price: unitPrice,
          quantity: item.quantity,
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
          const unitPrice =
            Number(product.salePrice || 0) > 0
              ? Number(product.salePrice)
              : Number(product.price || 0);
          return {
            productId: product._id,
            sellerId: product.sellerId || null,
            name: product.name,
            image: product.image || product.mainImage || '',
            price: unitPrice,
            quantity: item.quantity,
          };
        })
        .filter(Boolean);
    }

    if (items.length === 0) {
      logger.warn(`Quick placeOrder: No valid items found for productIds: ${JSON.stringify(productIds)} using idQuery: ${JSON.stringify(idQuery)}`);
      return res.status(400).json({ success: false, message: 'No valid items found in cart' });
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = Math.max(0, Number(req.body?.discountTotal || 0));
    const { pricing } = await calculateQuickPricing({
      subtotal,
      discount,
      products,
    });
    const deliveryFee = Number(pricing.deliveryFee || 0);
    const total = Number(pricing.total || 0);
    const orderNumber = `QC${Date.now().toString().slice(-8)}`;
    const isOnlinePayment = String(req.body?.paymentMode || 'COD').toUpperCase() === 'ONLINE';
    const paymentMode = isOnlinePayment ? 'razorpay' : 'cash';
    const sellerPaymentMode = isOnlinePayment ? 'online' : 'cash';
    const shouldFanOutSellerOrders = true;
    const deliveryAddress = normalizeDeliveryAddress(req.body?.address);
    const amountDue = Math.max(0, total + Number(pricing.platformFee || 0));

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

    // Calculate rider earning (using base payout if distance is unknown/short)
    const riderEarning = await getQuickRiderEarning(0.1);

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
      deliveryAddress,
      timeSlot: req.body?.timeSlot || 'now',
      payment: {
        method: paymentMode,
        status: paymentMode === 'razorpay' ? 'created' : 'cod_pending',
        amountDue,
        ...(rpOrderId ? { razorpay: { orderId: rpOrderId, paymentId: '', signature: '' } } : {})
      },
      orderStatus: 'placed',
      riderEarning: riderEarning || 0,
      platformProfit: Math.max(
        0,
        deliveryFee + Number(pricing.platformFee || 0) - (riderEarning || 0),
      ), // Initial guess, will be updated with commission
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
            const sellerSubtotal = sellerItems.reduce(
              (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
              0,
            );
            const allocatedDeliveryFee = Number(
              ((deliveryFee * sellerSubtotal) / Math.max(subtotal, 1)).toFixed(2),
            );

            // Calculate commission for this specific seller
            const { commissionAmount } = await getSellerCommissionSnapshot(sellerId, sellerSubtotal);
            const sellerReceivable = Math.max(
              0,
              Number((sellerSubtotal - commissionAmount).toFixed(2)),
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
                total: sellerSubtotal + allocatedDeliveryFee,
                receivable: sellerReceivable,
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
      const platformProfit = Math.max(
        0,
        deliveryFee +
          Number(pricing.platformFee || 0) +
          totalSellerCommission -
          (riderEarning || 0),
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

    const order = await QuickOrder.findOne(query).select('+deliveryOtp').lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const sellerOrder = await SellerOrder.findOne({ orderId: order.orderId }).lean();
    const seller =
      sellerOrder?.sellerId
        ? await Seller.findById(sellerOrder.sellerId).select('_id name shopName location').lean()
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
          name: '',
          address: deliveryAddress.street || '',
          city: deliveryAddress.city || '',
          phone: deliveryAddress.phone || '',
          ...(deliveryCoords ? { location: deliveryCoords } : {}),
        },
        seller: seller
          ? {
              _id: seller._id,
              id: seller._id,
              name: seller.shopName || seller.name || 'Store',
              shopName: seller.shopName || seller.name || 'Store',
              location: seller.location || null,
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

    if (order.payment?.method === 'cash') {
      order.payment.status = 'failed';
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

