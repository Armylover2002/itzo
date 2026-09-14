import mongoose from 'mongoose';
import { getIO, rooms } from '../../../config/socket.js';
import { logger } from '../../../utils/logger.js';
import { QuickOrder } from '../models/order.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { getHeaderCommissionSnapshot } from '../admin/services/commission.service.js';
import { isQuickOrderVisibleToSeller } from '../utils/sellerOrderVisibility.helpers.js';
import { resolveQuickOrderCustomer, isGenericCustomerLabel } from '../utils/customer.helpers.js';
import { allocateQuickCouponEarnings } from '../utils/quickCouponEarnings.helpers.js';

const emitQuickSellerOrders = async (sellerOrders) => {
  try {
    const io = getIO();
    if (!Array.isArray(sellerOrders) || sellerOrders.length === 0) return;

    let upsertSellerNotification = null;
    try {
      ({ upsertSellerNotification } = await import('../seller/services/sellerNotify.service.js'));
    } catch (importErr) {
      logger.warn(`Seller notify import failed: ${importErr?.message || importErr}`);
    }

    for (const sellerOrder of sellerOrders) {
      if (!sellerOrder?.sellerId) continue;
      const payload = {
        orderId: sellerOrder.orderId,
        sellerOrderId: sellerOrder._id?.toString?.() || '',
        status: sellerOrder.status,
        workflowStatus: sellerOrder.workflowStatus,
        items: sellerOrder.items || [],
        pricing: sellerOrder.pricing || {},
        createdAt: sellerOrder.createdAt || new Date(),
      };

      if (io) {
        io.to(rooms.seller(sellerOrder.sellerId)).emit('new_order', payload);
        io.to(rooms.seller(sellerOrder.sellerId)).emit('order:new', payload);
        io.to(rooms.seller(sellerOrder.sellerId)).emit('play_notification_sound', {
          audience: 'seller',
          type: 'new_order',
          orderId: sellerOrder.orderId,
          sellerOrderId: sellerOrder._id?.toString?.() || '',
        });
      }

      if (typeof upsertSellerNotification === 'function') {
        const saved = await upsertSellerNotification(sellerOrder.sellerId, {
          key: `order:${sellerOrder.orderId}:new`,
          type: 'order',
          title: 'New quick order received',
          message: `Order ${sellerOrder.orderId} is waiting for seller action.`,
          link: '/seller/orders',
          metadata: {
            orderId: sellerOrder.orderId,
            sellerOrderId: sellerOrder._id?.toString?.() || '',
            orderType: 'quick',
          },
        });
        if (!saved) {
          try {
            const { notifyOwnerSafely } = await import(
              '../../../core/notifications/firebase.service.js'
            );
            await notifyOwnerSafely(
              { ownerType: 'SELLER', ownerId: sellerOrder.sellerId },
              {
                title: 'New quick order received',
                body: `Order ${sellerOrder.orderId} is waiting for seller action.`,
                data: {
                  type: 'new_seller_order',
                  orderId: sellerOrder.orderId,
                  sellerOrderId: sellerOrder._id?.toString?.() || '',
                  link: '/seller/orders',
                },
              },
            );
          } catch (pushErr) {
            logger.warn(`Seller push fallback failed: ${pushErr?.message || pushErr}`);
          }
        }
      }
    }
  } catch (error) {
    logger.warn(`emitQuickSellerOrders failed: ${error?.message || error}`);
  }
};

export const buildQuickSellerOrderDocsFromParent = async (parentOrder) => {
  const quickItems = (Array.isArray(parentOrder?.items) ? parentOrder.items : [])
    .filter((item) => item?.type === 'quick');

  const sellerBuckets = new Map();
  // @deprecated multi-seller bucketing — ONE ORDER = ONE SELLER; kept for SellerOrder fan-out compatibility.
  quickItems.forEach((item) => {
    const sellerId = String(item?.sourceId || '').trim();
    if (!sellerId || !mongoose.isValidObjectId(sellerId)) return;
    if (!sellerBuckets.has(sellerId)) sellerBuckets.set(sellerId, []);
    sellerBuckets.get(sellerId).push(item);
  });

  if (!sellerBuckets.size) return [];

  const deliveryAddress = parentOrder?.deliveryAddress || {};
  const deliveryFee = Number(parentOrder?.pricing?.deliveryFee || 0);
  const subtotal = Number(parentOrder?.pricing?.subtotal || 0);
  const totalPackagingFee = Number(parentOrder?.pricing?.packagingFee || 0);
  const paymentMethod = String(parentOrder?.payment?.method || '').trim().toLowerCase();
  const sellerPaymentMode = ['cash', 'cod'].includes(paymentMethod) ? 'cash' : 'online';
  const customer = resolveQuickOrderCustomer(parentOrder);

  return Promise.all(
    Array.from(sellerBuckets.entries()).map(async ([sellerId, sellerItems]) => {
      const sellerSubtotal = sellerItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      );
      const allocatedDeliveryFee = Number(
        ((deliveryFee * sellerSubtotal) / Math.max(subtotal, 1)).toFixed(2),
      );
      const { commissionAmount } = await getHeaderCommissionSnapshot(
        sellerItems.map((item) => ({
          productId: item.itemId || item.productId,
          price: item.price,
          quantity: item.quantity,
        })),
      );
      const appliedCoupon = parentOrder?.pricing?.appliedCoupon;
      const allocatedPackingFee = subtotal > 0
        ? Number(((totalPackagingFee * sellerSubtotal) / subtotal).toFixed(2))
        : totalPackagingFee;
      const sellerPackingFee = Number(allocatedPackingFee || 0);
      const {
        sellerDiscount,
        productEarnings: sellerProductEarnings,
        receivable,
      } = allocateQuickCouponEarnings({
        couponSource: appliedCoupon?.source,
        discount: appliedCoupon?.discount || parentOrder?.pricing?.discount || 0,
        sellerSubtotal,
        commission: commissionAmount,
        packingFee: sellerPackingFee,
      });

      return {
        orderType: 'quick',
        parentOrderId: parentOrder._id,
        sellerId,
        orderId: parentOrder.orderId,
        customer: {
          name: customer.name,
          phone: customer.phone,
        },
        items: sellerItems.map((item) => ({
          productId: item.itemId || item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || '',
          variantName: item.variantName || item.notes || '',
        })),
        pricing: {
          subtotal: sellerSubtotal,
          commission: commissionAmount,
          productEarnings: sellerProductEarnings,
          packingFee: sellerPackingFee,
          couponDiscount: sellerDiscount,
          total: sellerSubtotal + allocatedDeliveryFee,
          receivable,
        },
        status: 'pending',
        workflowStatus: 'SELLER_PENDING',
        sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
        address: {
          address: deliveryAddress?.street || deliveryAddress?.address || '',
          city: deliveryAddress?.city || '',
          ...(deliveryAddress?.state ? { state: deliveryAddress.state } : {}),
          ...(deliveryAddress?.zipCode ? { zipCode: deliveryAddress.zipCode } : {}),
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
    }),
  );
};

export const fanOutQuickSellerOrdersForParent = async (parentOrder) => {
  if (!parentOrder || !isQuickOrderVisibleToSeller(parentOrder)) {
    return [];
  }

  let hydratedOrder = parentOrder?.toObject ? parentOrder.toObject() : parentOrder;
  const preliminaryCustomer = resolveQuickOrderCustomer(hydratedOrder);
  if (isGenericCustomerLabel(preliminaryCustomer.name) && hydratedOrder?.userId) {
    const withUser = await QuickOrder.findById(hydratedOrder._id)
      .populate('userId', 'name phone email')
      .lean();
    if (withUser) hydratedOrder = withUser;
  }

  const sellerOrders = await buildQuickSellerOrderDocsFromParent(hydratedOrder);
  if (!sellerOrders.length) return [];

  const upserts = await Promise.all(
    sellerOrders.map((doc) =>
      SellerOrder.findOneAndUpdate(
        { sellerId: doc.sellerId, orderId: doc.orderId },
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  const created = upserts.filter(Boolean);
  await emitQuickSellerOrders(created);
  return created;
};
