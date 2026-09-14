const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Number(num(value).toFixed(2));

/** Cancelled / cancelled_by_* — no paid earnings should count. */
export const isQuickOrderCancelled = (order = {}) => {
  const status = String(order?.status || order?.orderStatus || '')
    .trim()
    .toLowerCase();
  return status.includes('cancel');
};

/**
 * Canonical QC money split for admin transaction / order UIs.
 * Prefers API-enriched fields; falls back to pricing + sellerEarnings.
 *
 * Admin earning = platformFee + GST + commission + (deliveryFee − deliveryRider) − adminCoupon
 *                 − refunded GST (after completed returns)
 * Packing fee is seller-owned (never counted in admin earning).
 * Return pickup fee: seller → rider pass-through (admin net 0). Deduct from seller, add to rider.
 * Cancelled orders: seller / rider / admin paid earnings are always 0.
 */
export const getQuickOrderMoneyBreakdown = (order = {}) => {
  const pricing = order.pricing || {};
  const sellerEarnings = order.sellerEarnings || order.sellerOrder?.pricing || {};
  const returnSummary = order.returnSummary || {};
  const cancelled = isQuickOrderCancelled(order);
  const couponSource = String(
    pricing.appliedCoupon?.source || order.couponSource || '',
  )
    .trim()
    .toLowerCase();

  const subtotal = num(pricing.subtotal);
  const rawDiscount = Math.max(
    0,
    num(pricing.discount ?? pricing.appliedCoupon?.discount),
  );
  // Corrupted rows sometimes store full subtotal as "discount" — prefer return coupon share / sane cap.
  const returnCouponShare = (Array.isArray(returnSummary.returns) ? returnSummary.returns : []).reduce(
    (sum, row) => sum + num(row?.pricing?.couponShare),
    0,
  );
  const discount =
    subtotal > 0 && rawDiscount >= subtotal
      ? round2(returnCouponShare > 0 && returnCouponShare < rawDiscount ? returnCouponShare : Math.min(rawDiscount, subtotal * 0.1))
      : round2(rawDiscount);

  const adminDiscount =
    couponSource === 'admin'
      ? discount
      : Math.max(0, num(order.adminDiscount ?? pricing.adminDiscount ?? sellerEarnings.adminDiscount));
  const sellerCoupon =
    couponSource === 'restaurant' || couponSource === 'seller'
      ? discount
      : Math.max(0, num(sellerEarnings.couponDiscount ?? order.sellerCouponDiscount));

  const userPaidGross = num(order.amount ?? order.total ?? pricing.total);
  const refundedAmount = Math.max(0, num(order.refundedAmount));
  const netAfterReturn = Number.isFinite(Number(order.netAfterReturn))
    ? num(order.netAfterReturn)
    : Math.max(0, userPaidGross - refundedAmount);
  let userPaid = refundedAmount > 0 ? netAfterReturn : userPaidGross;
  const hasReturn = Boolean(order.hasReturn || refundedAmount > 0 || returnSummary?.isRefundCompleted);

  const platformFee = num(pricing.platformFee);
  const deliveryFee = num(pricing.deliveryFee);
  const tax = num(pricing.tax ?? pricing.gst);
  const handling = num(pricing.handlingFee);
  const packagingFee = num(pricing.packagingFee ?? pricing.packingFee);
  const packingFee = Math.max(0, num(sellerEarnings.packingFee ?? packagingFee));
  const commission = Math.max(
    0,
    num(
      sellerEarnings.commissionAtSale ??
        sellerEarnings.commission ??
        order.commission ??
        pricing.commission,
    ),
  );

  const refundedTaxShare = round2(
    Number.isFinite(Number(order.refundedTaxShare))
      ? num(order.refundedTaxShare)
      : (Array.isArray(returnSummary.returns) ? returnSummary.returns : []).reduce((sum, row) => {
          const status = String(row?.refundStatus || '').toLowerCase();
          if (status !== 'completed') return sum;
          return sum + num(row?.pricing?.taxShare);
        }, 0),
  );

  const returnPickupFee = round2(
    Number.isFinite(Number(order.returnPickupFee))
      ? num(order.returnPickupFee)
      : Number.isFinite(Number(sellerEarnings.returnPickupFee))
        ? num(sellerEarnings.returnPickupFee)
        : Number.isFinite(Number(returnSummary.totalReturnPickupFee))
          ? num(returnSummary.totalReturnPickupFee)
          : 0,
  );

  const returnPickupPaidByAdmin = round2(
    Number.isFinite(Number(order.returnPickupPaidByAdmin))
      ? num(order.returnPickupPaidByAdmin)
      : Number.isFinite(Number(returnSummary.totalReturnPickupPaidByAdmin))
        ? num(returnSummary.totalReturnPickupPaidByAdmin)
        : (Array.isArray(returnSummary.returns) ? returnSummary.returns : []).reduce(
            (sum, row) => sum + num(row?.returnPickupPaidByAdmin),
            0,
          ),
  );

  const returnRiderEarning = round2(
    Number.isFinite(Number(order.returnRiderEarning))
      ? num(order.returnRiderEarning)
      : Number.isFinite(Number(returnSummary.totalReturnRiderEarning))
        ? num(returnSummary.totalReturnRiderEarning)
        : returnPickupFee,
  );

  const productEarnings = round2(
    Number.isFinite(Number(sellerEarnings.productEarnings))
      ? num(sellerEarnings.productEarnings)
      : Math.max(0, subtotal - commission - sellerCoupon),
  );

  const receivableGross = round2(
    Number.isFinite(Number(sellerEarnings.receivableGross))
      ? num(sellerEarnings.receivableGross)
      : Number.isFinite(Number(sellerEarnings.receivable)) &&
          Number.isFinite(Number(sellerEarnings.returnPickupFee))
        ? num(sellerEarnings.receivable) + num(sellerEarnings.returnPickupFee)
        : Number.isFinite(Number(sellerEarnings.receivable))
          ? num(sellerEarnings.receivable)
          : productEarnings + packingFee,
  );

  let sellerGross = receivableGross;
  // Packing stays with seller after return — never show gross below packing when refund completed.
  if ((returnSummary?.isRefundCompleted || refundedAmount > 0) && packingFee > 0) {
    sellerGross = round2(Math.max(sellerGross, packingFee));
  }

  let sellerEarned = round2(
    Number.isFinite(Number(sellerEarnings.receivable))
      ? num(sellerEarnings.receivable)
      : Math.max(0, sellerGross - returnPickupFee),
  );

  const deliveryRiderEarning = round2(
    Number.isFinite(Number(order.deliveryRiderEarning))
      ? num(order.deliveryRiderEarning)
      : num(pricing.riderEarning),
  );

  // Prefer total from API (delivery + return). Never use total for delivery-margin math.
  let riderEarned = round2(
    Number.isFinite(Number(order.deliveryRiderEarning)) || returnRiderEarning > 0
      ? deliveryRiderEarning + returnRiderEarning
      : Math.max(deliveryRiderEarning, num(order.riderEarning)),
  );

  const deliveryMargin = round2(
    Number.isFinite(Number(order.deliveryMargin))
      ? num(order.deliveryMargin)
      : deliveryFee - deliveryRiderEarning,
  );

  let adminEarnedGross = round2(
    Number.isFinite(Number(order.adminEarningBeforeReturn))
      ? num(order.adminEarningBeforeReturn)
      : platformFee + tax + commission + deliveryMargin - adminDiscount,
  );

  let adminEarned = round2(
    Number.isFinite(Number(order.adminEarning))
      ? num(order.adminEarning)
      : adminEarnedGross - refundedTaxShare - returnPickupPaidByAdmin,
  );

  // Cancelled trips never contribute to paid earnings totals / settlement columns.
  if (cancelled) {
    sellerGross = 0;
    sellerEarned = 0;
    riderEarned = 0;
    adminEarnedGross = 0;
    adminEarned = 0;
    // COD / unpaid cancel: customer never paid. Prepaid refunded cancel: keep net after refund.
    const paymentStatus = String(order?.payment?.status || '').trim().toLowerCase();
    const wasCollected =
      ['paid', 'captured', 'success', 'completed', 'settled'].includes(paymentStatus) ||
      Boolean(order?.payment?.paidAt || order?.payment?.collectedAt);
    if (!wasCollected) {
      userPaid = 0;
    } else if (refundedAmount > 0) {
      userPaid = netAfterReturn;
    } else {
      // Cancelled after pay but refund not recorded yet — do not count as settled paid earning.
      userPaid = 0;
    }
  }

  return {
    userPaid: round2(userPaid),
    userPaidGross: round2(userPaidGross),
    refundedAmount: round2(refundedAmount),
    netAfterReturn: round2(netAfterReturn),
    hasReturn,
    isCancelled: cancelled,
    subtotal: round2(subtotal),
    platformFee: round2(platformFee),
    deliveryFee: round2(deliveryFee),
    tax: round2(tax),
    refundedTaxShare: cancelled ? 0 : refundedTaxShare,
    handling: round2(handling),
    packagingFee: round2(packagingFee),
    packingFee: cancelled ? 0 : round2(packingFee),
    returnPickupFee: cancelled ? 0 : returnPickupFee,
    returnPickupPaidByAdmin: cancelled ? 0 : returnPickupPaidByAdmin,
    adminEarningBeforePickup: cancelled
      ? 0
      : round2(
          Number.isFinite(Number(order.adminEarningBeforePickup))
            ? num(order.adminEarningBeforePickup)
            : adminEarned + returnPickupPaidByAdmin,
        ),
    discount: round2(discount),
    adminDiscount: round2(adminDiscount),
    sellerCoupon: round2(sellerCoupon),
    couponSource,
    commission: cancelled ? 0 : round2(commission),
    productEarnings: cancelled ? 0 : productEarnings,
    sellerGross,
    sellerEarned,
    deliveryRiderEarning: cancelled ? 0 : deliveryRiderEarning,
    returnRiderEarning: cancelled ? 0 : returnRiderEarning,
    riderEarned,
    deliveryMargin: cancelled ? 0 : deliveryMargin,
    adminEarned,
    adminEarnedGross,
  };
};
