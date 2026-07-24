import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { QuickOrder } from '../src/modules/quick-commerce/models/order.model.js';
import { SellerOrder } from '../src/modules/quick-commerce/seller/models/sellerOrder.model.js';
import { Seller } from '../src/modules/quick-commerce/seller/models/seller.model.js';
import { FoodDeliveryPartner } from '../src/modules/food/delivery/models/deliveryPartner.model.js';
import { getSellerCommissionSnapshot } from '../src/modules/quick-commerce/admin/services/commission.service.js';
import { connectDB } from '../src/config/db.js';

const buildSellerOrderFromParentOrder = async (order, sellerId) => {
  const sellerKey = String(sellerId || "").trim();
  if (!sellerKey) return null;

  const quickItems = Array.isArray(order?.items)
    ? order.items.filter(
        (item) =>
          item?.type === "quick" &&
          String(item?.sourceId || "").trim() === sellerKey,
      )
    : [];
  if (!quickItems.length) return null;

  const quickSubtotal = (Array.isArray(order?.items) ? order.items : [])
    .filter((item) => item?.type === "quick")
    .reduce(
      (sum, item) =>
        sum + Number(item?.price || 0) * Number(item?.quantity || 0),
      0,
    );
  const sellerSubtotal = quickItems.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
  const allocatedDeliveryFee =
    quickSubtotal > 0
      ? Number(
          (
            (Number(order?.pricing?.deliveryFee || 0) * sellerSubtotal) /
            quickSubtotal
          ).toFixed(2),
        )
      : 0;
  const { commissionAmount } = await getSellerCommissionSnapshot(
    sellerId,
    sellerSubtotal,
  );
  const sellerReceivable = Math.max(
    0,
    Number((sellerSubtotal - commissionAmount).toFixed(2)),
  );

  const parentStatus = String(order?.orderStatus || "pending").toLowerCase();
  let sellerStatus = "pending";
  let workflowStatus = "SELLER_PENDING";

  const addr = order?.deliveryAddress;

  return {
    orderType: order?.orderType === "mixed" ? "mixed" : "quick",
    parentOrderId: order?._id || null,
    sellerId,
    orderId: order?.orderId,
    customer: {
      name: order?.userId?.name || addr?.name || order?.customer?.name || "Customer",
      phone: addr?.phone || order?.customer?.phone || "",
    },
    items: quickItems.map((item) => ({
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
      total: sellerSubtotal + allocatedDeliveryFee,
      receivable: sellerReceivable,
    },
    status: sellerStatus,
    workflowStatus: workflowStatus,
  };
};


const simulate = async () => {
  try {
    await connectDB();
    const order = await QuickOrder.findOne().sort({ createdAt: -1 }).lean();
    if (!order) {
      console.log('No order found!');
      return process.exit(0);
    }
    
    console.log(`Found QuickOrder: ${order.orderId}, items: ${order.items?.length}`);
    for(const item of order.items) {
       console.log(`Item sourceId: ${item.sourceId}, sellerId?: ${mongoose.isValidObjectId(item.sourceId)}`);
    }

    const sellerKey = String(order.items[0]?.sourceId);
    console.log(`Using sellerKey: ${sellerKey}`);

    const doc = await buildSellerOrderFromParentOrder(order, sellerKey);
    console.log('Generated Doc:', JSON.stringify(doc, null, 2));

    const so = await SellerOrder.findOneAndUpdate(
      { parentOrderId: order._id, sellerId: sellerKey },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    
    console.log('Saved SellerOrder successfully!');
    process.exit(0);
  } catch (err) {
    console.error('SIMULATION ERROR:', err);
    process.exit(1);
  }
};

simulate();
