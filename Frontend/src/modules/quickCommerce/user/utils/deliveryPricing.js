// Client-side mirror of Backend/src/modules/quick-commerce/admin/services/billing.service.js
// distance + sponsor-rule delivery pricing. Used only for instant checkout previews —
// the backend recomputes this authoritatively when the order is actually placed.

export const DEFAULT_QUICK_BILLING_SETTINGS = {
  deliveryFee: 25,
  baseDistanceKm: 3,
  baseDeliveryFee: 25,
  perKmCharge: 10,
  sponsorRules: [],
  platformFee: 0,
  gstRate: 0,
};

export const calculateBaseDeliveryFeeForDistance = (distanceKm, feeSettings) => {
  const distance = Number(distanceKm);
  const baseDistance = Number(feeSettings?.baseDistanceKm || 0);
  const baseFee = Number(feeSettings?.baseDeliveryFee ?? feeSettings?.deliveryFee ?? 0);
  const perKmCharge = Number(feeSettings?.perKmCharge || 0);

  if (!Number.isFinite(distance) || distance <= baseDistance) {
    return Math.max(0, baseFee);
  }
  return Math.max(0, baseFee + (distance - baseDistance) * perKmCharge);
};

export const resolveDeliverySponsorRule = (subtotal, distanceKm, sponsorRules = []) => {
  const safeSubtotal = Number(subtotal);
  const safeDistance = Number(distanceKm);
  if (!Number.isFinite(safeSubtotal) || !Number.isFinite(safeDistance)) return null;

  const normalizedRules = (Array.isArray(sponsorRules) ? sponsorRules : [])
    .map((rule, index) => ({
      index,
      minOrderAmount: Number(rule?.minOrderAmount),
      maxOrderAmount:
        rule?.maxOrderAmount == null || rule?.maxOrderAmount === '' ? null : Number(rule.maxOrderAmount),
      maxDistanceKm: Number(rule?.maxDistanceKm),
      sponsorType: String(rule?.sponsorType || '').trim().toUpperCase(),
      sponsoredKm:
        rule?.sponsoredKm == null || rule?.sponsoredKm === '' ? null : Number(rule.sponsoredKm),
    }))
    .filter(
      (rule) =>
        Number.isFinite(rule.minOrderAmount) &&
        Number.isFinite(rule.maxDistanceKm) &&
        ['USER_FULL', 'SELLER_FULL', 'SPLIT'].includes(rule.sponsorType),
    )
    .sort((a, b) => {
      if (b.minOrderAmount !== a.minOrderAmount) return b.minOrderAmount - a.minOrderAmount;
      if (a.maxDistanceKm !== b.maxDistanceKm) return a.maxDistanceKm - b.maxDistanceKm;
      return a.index - b.index;
    });

  return (
    normalizedRules.find((rule) => {
      const orderOk =
        safeSubtotal >= rule.minOrderAmount && (rule.maxOrderAmount == null || safeSubtotal <= rule.maxOrderAmount);
      return orderOk && safeDistance <= rule.maxDistanceKm;
    }) || null
  );
};

export const calculateDeliverySplit = (subtotal, distanceKm, feeSettings = DEFAULT_QUICK_BILLING_SETTINGS) => {
  const totalDeliveryFee = calculateBaseDeliveryFeeForDistance(distanceKm, feeSettings);
  const matchedRule = resolveDeliverySponsorRule(subtotal, distanceKm, feeSettings?.sponsorRules);

  let sellerDeliveryFee = 0;
  let userDeliveryFee = totalDeliveryFee;
  let sponsoredKm = 0;
  let deliverySponsorType = 'USER_FULL';

  if (matchedRule?.sponsorType === 'SELLER_FULL') {
    sellerDeliveryFee = totalDeliveryFee;
    userDeliveryFee = 0;
    sponsoredKm = distanceKm;
    deliverySponsorType = 'SELLER_FULL';
  } else if (matchedRule?.sponsorType === 'SPLIT') {
    const safeSponsoredKm = Math.max(0, Math.min(Number(distanceKm || 0), Number(matchedRule.sponsoredKm || 0)));
    sellerDeliveryFee = Math.min(totalDeliveryFee, calculateBaseDeliveryFeeForDistance(safeSponsoredKm, feeSettings));
    userDeliveryFee = Math.max(0, totalDeliveryFee - sellerDeliveryFee);
    sponsoredKm = safeSponsoredKm;
    deliverySponsorType = 'SPLIT';
  }

  return {
    totalDeliveryFee,
    userDeliveryFee,
    sellerDeliveryFee,
    sponsoredKm,
    deliveryDistanceKm: Number(distanceKm || 0),
    deliverySponsorType,
  };
};
