import mongoose from "mongoose";
import { getIO, rooms } from "../../../config/socket.js";
import { logger } from "../../../utils/logger.js";
import { SellerOrder } from "../seller/models/sellerOrder.model.js";
import { FoodDeliveryPartner } from "../../food/delivery/models/deliveryPartner.model.js";
import { isQuickOrderVisibleToSeller } from "../utils/sellerOrderVisibility.helpers.js";

const toObjectIdString = (value) => (value ? String(value) : "");

function uniqueStrings(values = []) {
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
}

function resolveQuickSellerIdsFromOrder(order) {
  if (!order) return [];
  const items = Array.isArray(order.items) ? order.items : [];
  const ids = items
    .filter((item) => item?.type === "quick")
    .map((item) => String(item?.sourceId || "").trim())
    .filter((id) => mongoose.isValidObjectId(id));
  return uniqueStrings(ids);
}

/**
 * Centralized realtime status emitter for quick-commerce (and mixed orders with quick legs).
 * Emits to: tracking room, user room (if any), seller rooms, delivery room (if assigned).
 * Emits both event names for backward compatibility: `order_status_update` and `order:status:update`.
 */
export async function emitQuickCommerceStatusUpdate(orderDoc, options = {}) {
  try {
    const io = getIO();
    if (!io || !orderDoc) return;

    const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc;
    const orderMongoId = toObjectIdString(orderDoc?._id || order?._id);
    const orderId = String(order?.orderId || order?.order_id || orderMongoId).trim();
    if (!orderId) return;

    const deliveryPartnerId = order?.dispatch?.deliveryPartnerId;
    let deliveryPartnerPayload = null;
    if (deliveryPartnerId) {
      try {
        const partner = await FoodDeliveryPartner.findById(deliveryPartnerId)
          .select("_id name phone vehicleType vehicleNumber")
          .lean();
        if (partner) {
          const orderStatus = String(order?.orderStatus || "").toLowerCase();
          const deliveryStatus = String(order?.deliveryState?.status || "").toLowerCase();
          const reachedPickup =
            deliveryStatus === "reached_pickup" ||
            deliveryStatus === "picked_up" ||
            ["picked_up", "reached_drop", "delivered"].includes(orderStatus);
          const photoUploaded = !!order?.deliveryState?.billImageUrl;

          const riderPhone = (reachedPickup && photoUploaded)
            ? (partner.phone || "")
            : "Hidden until photo upload";

          deliveryPartnerPayload = {
            _id: partner._id,
            name: partner.name || "Delivery Partner",
            phone: riderPhone,
            vehicleType: partner.vehicleType || "",
            vehicleNumber: partner.vehicleNumber || "",
          };
        }
      } catch (partnerErr) {
        logger.warn(`emitQuickCommerceStatusUpdate: failed to fetch partner: ${partnerErr.message}`);
      }
    }

    const payload = {
      orderMongoId,
      orderId,
      orderStatus: order?.orderStatus,
      workflowStatus: order?.workflowStatus || "",
      dispatchStatus: order?.dispatch?.status || "unassigned",
      deliveryPartner: deliveryPartnerPayload,
      deliveryState: order?.deliveryState,
      deliveryVerification: order?.deliveryVerification,
      ...(options.message ? { message: String(options.message) } : {}),
      ...(options.sellerId ? { sellerId: String(options.sellerId) } : {}),
      ...(options.sellerStatus ? { sellerStatus: String(options.sellerStatus) } : {}),
      ...(options.sellerWorkflowStatus
        ? { sellerWorkflowStatus: String(options.sellerWorkflowStatus) }
        : {}),
    };

    // Always emit to tracking (admins join tracking for live ops).
    io.to(rooms.tracking(orderId)).emit("order_status_update", payload);
    io.to(rooms.tracking(orderId)).emit("order:status:update", payload);

    if (order?.userId) {
      io.to(rooms.user(order.userId)).emit("order_status_update", payload);
      io.to(rooms.user(order.userId)).emit("order:status:update", payload);
    }

    if (deliveryPartnerId) {
      io.to(rooms.delivery(deliveryPartnerId)).emit("order_status_update", payload);
      io.to(rooms.delivery(deliveryPartnerId)).emit("order:status:update", payload);
    }

    const sellerIds = uniqueStrings([
      ...resolveQuickSellerIdsFromOrder(order),
      ...(Array.isArray(options.sellerIds) ? options.sellerIds : []),
    ]);

    let sellerIdsFromDb = [];
    if (orderMongoId && mongoose.isValidObjectId(orderMongoId)) {
      try {
        const rows = await SellerOrder.find({ parentOrderId: orderMongoId })
          .select("sellerId")
          .lean();
        sellerIdsFromDb = uniqueStrings(
          (rows || [])
            .map((row) => String(row?.sellerId || "").trim())
            .filter((id) => mongoose.isValidObjectId(id)),
        );
      } catch (err) {
        logger.warn(
          `emitQuickCommerceStatusUpdate: failed to read sellerIds for ${orderMongoId}: ${err?.message || err}`,
        );
      }
    }

    const finalSellerIds = isQuickOrderVisibleToSeller(order)
      ? uniqueStrings([...sellerIds, ...sellerIdsFromDb])
      : [];
    for (const sellerId of finalSellerIds) {
      io.to(rooms.seller(sellerId)).emit("order_status_update", payload);
      io.to(rooms.seller(sellerId)).emit("order:status:update", payload);
    }
  } catch (err) {
    logger.warn(`emitQuickCommerceStatusUpdate failed: ${err?.message || err}`);
  }
}

