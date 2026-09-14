/**
 * Internal alternate Food order pricing calculator (Feature branch).
 * NOT wired to production routes — live pricing uses `calculateOrder` in order.service.js.
 * Kept restored for merge reconstruction / future wiring.
 */
import mongoose from 'mongoose';
import { FoodOrder } from '../models/order.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodOfferUsage } from '../../admin/models/offerUsage.model.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { resolveRestaurantCommissionPercentage } from '../../constants/commission.constants.js';
import { resolveRestaurantDocument } from '../../shared/restaurantIdentity.util.js';
import { roadDistanceKm } from './order.helpers.js';

function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings) {
  const distance = Number(distanceKm);
  if (!Number.isFinite(distance) || distance < 0) return 0;

  if (Array.isArray(feeSettings?.deliveryDistanceSlabs) && feeSettings.deliveryDistanceSlabs.length > 0) {
    const baseSlab = feeSettings.deliveryDistanceSlabs.find((s) => Number(s.fromKm || 0) === 0);
    
    if (!baseSlab) {
      // Fallback: If no base slab exists starting at 0, do traditional range matching
      const matchedSlab = feeSettings.deliveryDistanceSlabs.find(
        (slab) => distance >= Number(slab.fromKm) && distance <= Number(slab.toKm)
      );
      if (matchedSlab) {
        return roundCurrency(Number(matchedSlab.deliveryFee));
      }
      const sortedSlabs = [...feeSettings.deliveryDistanceSlabs].sort((a, b) => Number(b.toKm) - Number(a.toKm));
      if (sortedSlabs.length > 0 && distance > Number(sortedSlabs[0].toKm)) {
        return roundCurrency(Number(sortedSlabs[0].deliveryFee));
      }
      return 60;
    }

    const baseFee = Number(baseSlab.deliveryFee || 0);
    const baseMax = Number(baseSlab.toKm || 0);

    // If distance is within the base slab (e.g. 0-5 km)
    if (distance <= baseMax) {
      return roundCurrency(baseFee);
    }

    // Distance is greater than baseMax (e.g. > 5 km).
    const sorted = [...feeSettings.deliveryDistanceSlabs].sort((a, b) => Number(a.fromKm || 0) - Number(b.fromKm || 0));
    let totalFee = baseFee;

    for (const slab of sorted) {
      const slabMin = Number(slab.fromKm || 0);
      if (slabMin === 0) continue; // Skip base slab as it is already included

      const slabMax = slab.toKm == null ? null : Number(slab.toKm);
      const rate = Number(slab.deliveryFee || 0);

      if (distance <= slabMin) continue;

      const upper = slabMax == null ? distance : Math.min(distance, slabMax);
      const kmInSlab = Math.max(0, upper - slabMin);

      if (kmInSlab > 0) {
        totalFee += kmInSlab * rate;
      }
    }

    return roundCurrency(totalFee);
  }

  // Pure distance-based default: 60 delivery fee
  return 60;
}

function resolveSponsorRule(subtotal, distanceKm, sponsorRules = []) {
  const safeSubtotal = Number(subtotal);
  const safeDistance = Number(distanceKm);
  if (!Number.isFinite(safeSubtotal) || !Number.isFinite(safeDistance)) return null;

  const normalizedRules = (Array.isArray(sponsorRules) ? sponsorRules : [])
    .map((rule, index) => ({
      index,
      minOrderAmount: Number(rule?.minOrderAmount),
      maxOrderAmount:
        rule?.maxOrderAmount == null || rule?.maxOrderAmount === ''
          ? null
          : Number(rule.maxOrderAmount),
      maxDistanceKm: Number(rule?.maxDistanceKm),
      sponsorType: String(rule?.sponsorType || '').trim().toUpperCase(),
      sponsoredKm:
        rule?.sponsoredKm == null || rule?.sponsoredKm === ''
          ? null
          : Number(rule.sponsoredKm),
    }))
    .filter((rule) =>
      Number.isFinite(rule.minOrderAmount) &&
      Number.isFinite(rule.maxDistanceKm) &&
      ["USER_FULL", "RESTAURANT_FULL", "SPLIT"].includes(rule.sponsorType),
    )
    .sort((a, b) => {
      if (b.minOrderAmount !== a.minOrderAmount) return b.minOrderAmount - a.minOrderAmount;
      if (a.maxDistanceKm !== b.maxDistanceKm) return a.maxDistanceKm - b.maxDistanceKm;
      return a.index - b.index;
    });

  return normalizedRules.find((rule) => {
    const orderOk =
      safeSubtotal >= rule.minOrderAmount &&
      (rule.maxOrderAmount == null || safeSubtotal <= rule.maxOrderAmount);
    return orderOk && safeDistance <= rule.maxDistanceKm;
  }) || null;
}

export async function calculateOrderPricing(userId, dto) {
  // Option B: inbound restaurantId may be business code or Mongo _id.
  const restaurant = await resolveRestaurantDocument(dto.restaurantId);
  if (!restaurant) throw new ValidationError("Restaurant not found");
  if (restaurant.status !== "approved")
    throw new ValidationError("Restaurant not available");
  const resolvedRestaurantObjectId = restaurant._id;

  const items = Array.isArray(dto.items) ? dto.items : [];
  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
    0,
  );

  const feeDoc = await FoodFeeSettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();
  const feeSettings = {
    deliveryFee: 25,
    baseDistanceKm: 3,
    baseDeliveryFee: 25,
    perKmCharge: 10,
    sponsorRules: [],
    platformFee: 5,
    gstRate: 5,
    ...(feeDoc || {}),
  };
  feeSettings.deliveryDistanceSlabs = Array.isArray(feeSettings.deliveryDistanceSlabs)
    ? feeSettings.deliveryDistanceSlabs
    : [];

  const packagingFee = 0;
  const platformFee = Number(feeSettings.platformFee || 0);

  const restaurantCoords = restaurant?.location?.coordinates;
  const customerCoords = dto?.address?.location?.coordinates;
  const distanceKm =
    Array.isArray(restaurantCoords) &&
    restaurantCoords.length === 2 &&
    Array.isArray(customerCoords) &&
    customerCoords.length === 2
      ? await roadDistanceKm(
          Number(restaurantCoords[1]),
          Number(restaurantCoords[0]),
          Number(customerCoords[1]),
          Number(customerCoords[0]),
        )
      : 0;

  const totalDeliveryFee = calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings);
  const matchedRule = (Array.isArray(feeSettings?.deliveryDistanceSlabs) && feeSettings.deliveryDistanceSlabs.length > 0)
    ? null
    : resolveSponsorRule(subtotal, distanceKm, feeSettings.sponsorRules);
  let restaurantDeliveryFee = 0;
  let userDeliveryFee = totalDeliveryFee;
  let sponsoredKm = 0;
  let deliverySponsorType = 'USER_FULL';

  if (matchedRule?.sponsorType === 'RESTAURANT_FULL') {
    restaurantDeliveryFee = totalDeliveryFee;
    userDeliveryFee = 0;
    sponsoredKm = roundCurrency(distanceKm);
    deliverySponsorType = 'RESTAURANT_FULL';
  } else if (matchedRule?.sponsorType === 'SPLIT') {
    const safeSponsoredKm = Math.max(0, Math.min(Number(distanceKm || 0), Number(matchedRule.sponsoredKm || 0)));
    restaurantDeliveryFee = Math.min(
      totalDeliveryFee,
      calculateBaseDeliveryFeeForDistance(safeSponsoredKm, feeSettings),
    );
    userDeliveryFee = Math.max(0, roundCurrency(totalDeliveryFee - restaurantDeliveryFee));
    sponsoredKm = roundCurrency(safeSponsoredKm);
    deliverySponsorType = 'SPLIT';
  }
  const deliveryFee = roundCurrency(userDeliveryFee);

  const gstRate = Number(feeSettings.gstRate || 0);
  const tax =
    Number.isFinite(gstRate) && gstRate > 0
      ? Math.round(subtotal * (gstRate / 100))
      : 0;

  let discount = 0;
  let appliedCoupon = null;
  const codeRaw = dto.couponCode
    ? String(dto.couponCode).trim().toUpperCase()
    : "";

  if (codeRaw) {
    const now = new Date();
    let offer = await FoodOffer.findOne({ couponCode: codeRaw }).lean();
    if (offer) {
      const statusOk = offer.status === "active";
      const startOk = !offer.startDate || now >= new Date(offer.startDate);
      const endOk = !offer.endDate || now < new Date(offer.endDate);
      const scopeOk =
        offer.restaurantScope !== "selected" ||
        String(offer.restaurantId || "") === String(resolvedRestaurantObjectId || "");
      const minOk = subtotal >= (Number(offer.minOrderValue) || 0);
      let usageOk = true;
      if (
        Number(offer.usageLimit) > 0 &&
        Number(offer.usedCount || 0) >= Number(offer.usageLimit)
      ) {
        usageOk = false;
      }

      let perUserOk = true;
      if (userId && Number(offer.perUserLimit) > 0) {
        const usage = await FoodOfferUsage.findOne({
          offerId: offer._id,
          userId,
        }).lean();
        if (usage && Number(usage.count) >= Number(offer.perUserLimit)) {
          perUserOk = false;
        }
      }

      let firstOrderOk = true;
      if (userId && offer.customerScope === "first-time") {
        const c = await FoodOrder.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
        });
        firstOrderOk = c === 0;
      }
      if (userId && offer.isFirstOrderOnly === true) {
        const c2 = await FoodOrder.countDocuments({
          userId: new mongoose.Types.ObjectId(userId),
        });
        if (c2 > 0) firstOrderOk = false;
      }

      const allowed =
        statusOk &&
        startOk &&
        endOk &&
        scopeOk &&
        minOk &&
        usageOk &&
        perUserOk &&
        firstOrderOk;

      if (allowed) {
        if (offer.discountType === "percentage") {
          const raw = subtotal * (Number(offer.discountValue) / 100);
          const capped = Number(offer.maxDiscount)
            ? Math.min(raw, Number(offer.maxDiscount))
            : raw;
          discount = Math.max(0, Math.min(subtotal, Math.floor(capped)));
        } else {
          discount = Math.max(
            0,
            Math.min(subtotal, Math.floor(Number(offer.discountValue) || 0)),
          );
        }
        appliedCoupon = { code: codeRaw, discount };
      }
    } else {
      const { RestaurantCoupon } = await import('../../admin/models/restaurantCoupon.model.js');
      const restCoupon = resolvedRestaurantObjectId
        ? await RestaurantCoupon.findOne({
            couponCode: codeRaw,
            status: 'Approved',
            restaurantId: new mongoose.Types.ObjectId(resolvedRestaurantObjectId),
          }).lean()
        : null;

      if (restCoupon) {
        const endOk = !restCoupon.expiryDate || now < new Date(restCoupon.expiryDate);
        const minOk = subtotal >= (Number(restCoupon.minOrderAmount) || 0);
        let usageOk = true;
        if (
          Number(restCoupon.usageLimit) > 0 &&
          Number(restCoupon.usedCount || 0) >= Number(restCoupon.usageLimit)
        ) {
          usageOk = false;
        }

        const allowed = endOk && minOk && usageOk;

        if (allowed) {
          if (restCoupon.discountType === "percentage") {
            const raw = subtotal * (Number(restCoupon.discountValue) / 100);
            discount = Math.max(0, Math.min(subtotal, Math.floor(raw)));
          } else {
            discount = Math.max(
              0,
              Math.min(subtotal, Math.floor(Number(restCoupon.discountValue) || 0)),
            );
          }
          appliedCoupon = { code: codeRaw, discount };
        }
      }
    }
  }

  const total = Math.max(
    0,
    subtotal + packagingFee + deliveryFee + platformFee + tax - discount,
  );

  const commissionPercentage = resolveRestaurantCommissionPercentage(
    restaurant?.commissionPercentage,
  );
  const restaurantCommission = roundCurrency(subtotal * (commissionPercentage / 100));

  return {
    pricing: {
      subtotal,
      tax,
      packagingFee,
      deliveryFee,
      totalDeliveryFee: roundCurrency(totalDeliveryFee),
      userDeliveryFee: roundCurrency(userDeliveryFee),
      restaurantDeliveryFee: roundCurrency(restaurantDeliveryFee),
      sponsoredDelivery: roundCurrency(restaurantDeliveryFee) > 0,
      sponsoredKm,
      deliveryDistanceKm: roundCurrency(distanceKm),
      deliverySponsorType,
      platformFee,
      discount,
      restaurantCommissionPercentage: commissionPercentage,
      restaurantCommission,
      total,
      currency: "INR",
      couponCode: appliedCoupon?.code || codeRaw || null,
      appliedCoupon,
    },
  };
}
