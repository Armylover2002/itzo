import mongoose from "mongoose";
import { FoodOrder, FoodSettings } from "../models/order.model.js";
import { FoodRestaurant } from "../../restaurant/models/restaurant.model.js";
import { Seller } from "../../../quick-commerce/seller/models/seller.model.js";
import { FoodDeliveryPartner } from "../../delivery/models/deliveryPartner.model.js";
import { FoodDailyPass } from "../../subscriptions/models/foodDailyPass.model.js";
import { UserSubscription } from "../../user/models/userSubscription.model.js";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);
import {
  ValidationError,
  NotFoundError,
} from "../../../../core/auth/errors.js";
import { logger } from "../../../../utils/logger.js";
import { config } from "../../../../config/env.js";
import { getIO, rooms } from "../../../../config/socket.js";
import { addOrderJob } from "../../../../queues/producers/order.producer.js";
import {
  buildDeliverySocketPayload,
  buildOrderIdentityFilter,
  haversineKm,
  notifyOwnerSafely,
  notifyOwnersSafely,
} from "./order.helpers.js";

export async function filterEligiblePartners(partners) {
  if (!partners.length) return [];
  if (config.nodeEnv !== "production") return partners;
  
  const partnerIds = partners.map(p => p.partnerId);
  const today = dayjs().tz("Asia/Kolkata").format("YYYY-MM-DD");
  
  const [activePasses, activeSubs] = await Promise.all([
    FoodDailyPass.find({
      userId: { $in: partnerIds },
      userType: "DELIVERY_PARTNER",
      date: today,
      expiresAt: { $gt: new Date() }
    }).select("userId").lean(),
    UserSubscription.find({
      deliveryBoyId: { $in: partnerIds },
      status: { $in: ["active", "grace"] }
    }).select("deliveryBoyId status expiryDate gracePeriodUntil cancelAtCycleEnd").lean()
  ]);

  const now = new Date();
  const validSubPartnerIds = [];
  const expiredSubIds = [];
  const expiredPartnerIds = [];

  for (const sub of activeSubs) {
    let isValid = true;
    if (sub.status === 'active' || sub.status === 'grace') {
      if (sub.cancelAtCycleEnd) {
        if (sub.expiryDate && new Date(sub.expiryDate) < now) {
          isValid = false;
        }
      } else {
        if (sub.expiryDate && new Date(sub.expiryDate) < now) {
          const graceUntil = sub.gracePeriodUntil 
            ? new Date(sub.gracePeriodUntil) 
            : dayjs(sub.expiryDate).add(24, 'hours').toDate();
          if (graceUntil < now) {
            isValid = false;
          }
        }
      }
    }

    if (isValid) {
      validSubPartnerIds.push(sub.deliveryBoyId.toString());
    } else {
      expiredSubIds.push(sub._id);
      expiredPartnerIds.push(sub.deliveryBoyId);
    }
  }

  // Self-heal expired subscription records and set partners offline
  if (expiredSubIds.length > 0) {
    logger.warn(`Dispatch Eligibility: Found ${expiredSubIds.length} expired rider subscriptions. Self-healing database records.`);
    UserSubscription.updateMany(
      { _id: { $in: expiredSubIds } },
      { $set: { status: 'expired' } }
    ).catch(err => logger.error(`Failed to self-heal expired subscriptions in dispatcher: ${err.message}`));

    if (expiredPartnerIds.length > 0) {
      FoodDeliveryPartner.updateMany(
        { _id: { $in: expiredPartnerIds } },
        { $set: { availabilityStatus: 'offline', isActive: false } }
      )
      .then(res => logger.info(`Dispatch Eligibility: Forced ${res.modifiedCount} expired delivery partners offline.`))
      .catch(err => logger.error(`Failed to force expired delivery partners offline in dispatcher: ${err.message}`));
    }
  }

  const eligibleIds = new Set([
    ...activePasses.map(p => p.userId.toString()),
    ...validSubPartnerIds
  ]);

  return partners.filter(p => eligibleIds.has(p.partnerId.toString()));
}

export async function listNearbyOnlineDeliveryPartners(
  sourceId,
  { maxKm = 15, limit = 25, sourceType = "food" } = {},
) {
  if (!sourceId) return { partners: [], source: null };
  const sId = (sourceId?._id || sourceId).toString();

  let source = null;
  if (sourceType === "quick") {
    source = await Seller.findById(sId).lean();
  } else {
    source = await FoodRestaurant.findById(sId).lean();
  }

  if (!source?.location?.coordinates?.length) {
    const partners = await FoodDeliveryPartner.find({
      status: "approved",
      availabilityStatus: "online",
    })
      .select("_id status name")
      .limit(Math.max(1, limit))
      .lean();

    return {
      source,
      partners: partners.map((p) => ({ partnerId: p._id, distanceKm: null })),
    };
  }

  const [rLng, rLat] = source.location.coordinates;
  const allOnline = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
  })
    .select("_id status lastLat lastLng lastLocationAt name")
    .lean();

  const scored = [];
  const allowedStatuses =
    process.env.NODE_ENV === "production"
      ? ["approved"]
      : ["approved", "pending"];
  const STALE_GPS_MS = 10 * 60 * 1000;

  for (const p of allOnline) {
    if (!allowedStatuses.includes(p.status)) continue;

    const isStale =
      !p.lastLocationAt ||
      Date.now() - new Date(p.lastLocationAt).getTime() > STALE_GPS_MS;
    if (p.lastLat == null || p.lastLng == null || isStale) {
      scored.push({ partnerId: p._id, distanceKm: 999, status: p.status });
      continue;
    }

    const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
    if (Number.isFinite(d) && d <= maxKm) {
      scored.push({ partnerId: p._id, distanceKm: d, status: p.status });
    }
  }

  scored.sort((a, b) => a.distanceKm - b.distanceKm);
  const picked = scored.slice(0, Math.max(1, limit));

  if (picked.length === 0) {
    const anyOnline = await FoodDeliveryPartner.find({
      status: { $in: allowedStatuses },
      availabilityStatus: "online",
    })
      .select("_id status name")
      .limit(Math.max(1, limit))
      .lean();

    return {
      source,
      partners: anyOnline.map((p) => ({
        partnerId: p._id,
        distanceKm: null,
        status: p.status,
      })),
    };
  }

  const final =
    config.env === "production"
      ? picked.filter((p) => p.status === "approved")
      : picked;

  const eligible = await filterEligiblePartners(final);
  return { source, partners: eligible };
}

export async function getDispatchSettings() {
  return { dispatchMode: "auto" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  // Always set to auto
  await FoodSettings.findOneAndUpdate(
    { key: "dispatch" },
    {
      $set: {
        dispatchMode: "auto",
        updatedBy: { role: "ADMIN", adminId, at: new Date() },
      },
    },
    { upsert: true, new: true },
  );
  return getDispatchSettings();
}

export async function tryAutoAssign(orderId, options = {}) {
  const attempt = options.attempt || 1;
  const lockTimeout = 55000; // 55 seconds lock interval

  const order = await FoodOrder.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(orderId),
      $or: [
        { "dispatch.status": "unassigned" },
        {
          "dispatch.status": "assigned",
          "dispatch.acceptedAt": { $exists: false },
          "dispatch.assignedAt": { $lt: new Date(Date.now() - lockTimeout) },
        },
      ],
      "dispatch.dispatchingAt": { $exists: false },
    },
    {
      $set: { "dispatch.dispatchingAt": new Date() },
    },
    { new: true },
  ).populate(["restaurantId", "userId"]);

  if (!order) {
    logger.info(
      `tryAutoAssign: Skip for ${orderId} (already dispatching, accepted, or multi-attempt lock active).`,
    );
    return null;
  }

  try {
    const offeredIds = (order.dispatch?.offeredTo || []).map((o) =>
      o.partnerId.toString(),
    );

    // RADIUS EXPANSION LOGIC
    // Attempt 1: 15km, Attempt 2: 25km, Attempt 3: 40km, Attempt 4+: 60km
    let maxKm = 15;
    if (attempt === 2) maxKm = 25;
    if (attempt === 3) maxKm = 40;
    if (attempt >= 4) maxKm = 60;

    const isQuickOrder = order.orderType === "quick";
    const quickSellerId =
      options.quickSellerId ||
      order.items?.find((item) => item?.type === "quick" && item?.sourceId)
        ?.sourceId ||
      order.pickupPoints?.find(
        (point) => point?.pickupType === "quick" && point?.sourceId,
      )?.sourceId;
    const dispatchSourceId = isQuickOrder ? quickSellerId : order.restaurantId;
    const searchOptions = {
      maxKm,
      limit: 15,
      sourceType: isQuickOrder ? "quick" : "food",
    };
    const { partners, source } = await listNearbyOnlineDeliveryPartners(
      dispatchSourceId,
      searchOptions,
    );

    // TIERED ALERT LOGIC
    // Phase 2: Broadcast to all (Attempt 3+)
    // Phase 3: Admin Alert (Attempt 5+ or roughly 5 mins)
    const isPhase2 = attempt >= 3;
    const isPhase3 = attempt >= 6; // ~6 minutes (60s * 6)

    if (isPhase3) {
      logger.error(
        `[CRITICAL] Order ${order._id} unassigned for ${attempt} mins. Triggering Admin Alert (Phase 3).`,
      );
      // Notify Admin via Push (Web/Mobile)
      try {
        await notifyOwnersSafely(
          [{ ownerType: "ADMIN", ownerId: "GLOBAL" }], // Use GLOBAL or specific admin group if defined
          {
            title: "Unassigned Order Crisis!",
            body: `Order #${order.order_id || order._id} has not been picked up for 5+ minutes. Manual intervention required!`,
            data: {
              type: "admin_alert_unassigned",
              orderId: order._id.toString(),
            },
          },
        );
      } catch (err) {
        logger.warn(`Admin notification failed: ${err.message}`);
      }
    }

    const eligible = partners.filter(
      (p) => !offeredIds.includes(p.partnerId.toString()),
    );

    if (eligible.length === 0) {
      logger.info(
        `tryAutoAssign: No NEW eligible partners in ${maxKm}km for order ${order._id}. Restarting hunt...`,
      );

      // If we ran out of new eligible partners, we might want to re-offer to everyone (Phase 2 style)
      const io = getIO();
      if (io && partners.length > 0) {
        const payload = buildDeliverySocketPayload(order, source);
        for (const p of partners) {
          const roomName = rooms.delivery(p.partnerId);
          io.to(roomName).emit("new_order_available", {
            ...payload,
            pickupDistanceKm: p.distanceKm,
          });
        }
      }

      // Re-queue itself to keep trying
      await addOrderJob(
        {
          action: "DISPATCH_TIMEOUT_CHECK",
          orderMongoId: order._id.toString(),
          orderId: order._id.toString(),
          attempt: attempt + 1,
        },
        { delay: 30000 },
      ); // Retry faster (30s) if no one found

      return { ...order.toObject(), notifiedCount: 0 };
    }

    const io = getIO();
    const payload = buildDeliverySocketPayload(order, source);

    if (isPhase2) {
      // PHASE 2 BROADCAST: Notify everyone remaining
      logger.info(
        `[Phase 2] Broadcasting order ${order._id} to ${eligible.length} riders.`,
      );
      for (const p of eligible) {
        const roomName = rooms.delivery(p.partnerId);
        if (io) {
          io.to(roomName).emit("new_order", {
            ...payload,
            pickupDistanceKm: p.distanceKm,
          });
          io.to(roomName).emit("new_order_available", {
            ...payload,
            pickupDistanceKm: p.distanceKm,
          });
          io.to(roomName).emit("play_notification_sound", {
            orderId: order.orderId,
            orderMongoId: order._id.toString(),
          });
        }
      }
    } else {
      // PHASE 1: Target best rider only
      const p = eligible[0];
      const roomName = rooms.delivery(p.partnerId);
      logger.info(
        `[Phase 1] Offering order ${order._id} to best rider ${p.partnerId} (${p.distanceKm}km)`,
      );
      if (io) {
        io.to(roomName).emit("new_order", {
          ...payload,
          pickupDistanceKm: p.distanceKm,
        });
        io.to(roomName).emit("new_order_available", {
          ...payload,
          pickupDistanceKm: p.distanceKm,
        });
        io.to(roomName).emit("play_notification_sound", {
          orderId: order.orderId,
          orderMongoId: order._id.toString(),
        });
      }

      try {
        await notifyOwnerSafely(
          { ownerType: "DELIVERY_PARTNER", ownerId: p.partnerId },
          {
            title: "New order assigned!",
            body: `You have 60 seconds to accept Order #${order.order_id || order._id}.`,
            data: { type: "new_order", orderId: order._id.toString() },
          },
        );
      } catch (err) {
        logger.warn(
          `Push notification failed for partner ${p.partnerId}: ${err.message}`,
        );
      }
    }

    const offeredToEntries = eligible.map((p) => ({
      partnerId: p.partnerId,
      at: new Date(),
      action: "offered",
    }));

    order.dispatch.status = "unassigned";
    order.dispatch.deliveryPartnerId = null;
    order.dispatch.offeredTo.push(...offeredToEntries);
    await order.save();

    // Re-check in 60s
    await addOrderJob(
      {
        action: "DISPATCH_TIMEOUT_CHECK",
        orderMongoId: order._id.toString(),
        orderId: order._id.toString(),
        attempt: attempt + 1,
      },
      { delay: 60000 },
    );

    return { ...order.toObject(), notifiedCount: eligible.length };
  } finally {
    await FoodOrder.findByIdAndUpdate(orderId, {
      $unset: { "dispatch.dispatchingAt": "" },
    });
  }
}

export async function processDispatchTimeout(orderId, partnerId) {
  const order = await FoodOrder.findById(orderId);
  if (!order) return;

  const stillAssigned =
    order.dispatch?.status === "assigned" &&
    String(order.dispatch?.deliveryPartnerId) === String(partnerId) &&
    !order.dispatch?.acceptedAt;

  if (stillAssigned) {
    logger.info(
      `Dispatch timeout for partner ${partnerId} on order ${orderId}. Re-trying hunt...`,
    );
    const offer = order.dispatch.offeredTo.find(
      (o) =>
        String(o.partnerId) === String(partnerId) && o.action === "offered",
    );
    if (offer) offer.action = "timeout";

    order.dispatch.status = "unassigned";
    order.dispatch.deliveryPartnerId = null;
    await order.save();

    const attempt = (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(orderId, { attempt });
  } else if (order.dispatch?.status === "unassigned") {
    // If it's already unassigned (e.g. from a previous timeout), just keep hunting
    const attempt = (order.dispatch?.offeredTo?.length || 0) + 1;
    await tryAutoAssign(orderId, { attempt });
  }
}

export async function resendDeliveryNotificationRestaurant(
  orderId,
  restaurantId,
) {
  const identity = buildOrderIdentityFilter(orderId);
  const order = await FoodOrder.findOne({
    ...identity,
    restaurantId: new mongoose.Types.ObjectId(restaurantId),
  });

  if (!order) throw new NotFoundError("Order not found");

  const activeStatuses = [
    "confirmed",
    "preparing",
    "ready_for_pickup",
    "ready",
  ];
  if (!activeStatuses.includes(order.orderStatus)) {
    throw new ValidationError(
      `Cannot resend notification for order in status: ${order.orderStatus}`,
    );
  }

  if (order.dispatch?.status === "accepted") {
    throw new ValidationError(
      "A delivery partner has already accepted this order.",
    );
  }

  order.dispatch.status = "unassigned";
  order.dispatch.deliveryPartnerId = null;
  order.dispatch.offeredTo = [];
  order.dispatch.dispatchingAt = undefined;
  await order.save();

  const res = await tryAutoAssign(order._id, { attempt: 3 });
  return {
    success: true,
    notifiedCount: res?.notifiedCount || 0,
  };
}
