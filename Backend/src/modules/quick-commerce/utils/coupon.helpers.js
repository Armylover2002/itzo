export const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Parse coupon date inputs as local calendar days.
 * Date-only strings ("YYYY-MM-DD") must not use UTC midnight parsing,
 * or IST servers/forms shift the day on save/edit.
 */
export const parseCouponCalendarDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return startOfDay(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    return startOfDay(new Date(year, month - 1, day));
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
};

export const normalizeCouponValidFrom = (value) => parseCouponCalendarDate(value);

export const normalizeCouponValidTill = (value) => parseCouponCalendarDate(value);

export const isQuickCouponExpired = (coupon, now = new Date()) => {
  const till = coupon?.validTill;
  if (!till) return false;
  return startOfDay(now).getTime() > startOfDay(new Date(till)).getTime();
};

export const isQuickCouponNotStarted = (coupon, now = new Date()) => {
  const from = coupon?.validFrom;
  if (!from) return false;
  return startOfDay(now).getTime() < startOfDay(new Date(from)).getTime();
};

export const isQuickCouponCurrentlyValid = (coupon, now = new Date()) => {
  if (coupon?.isActive === false) return false;
  const status = String(coupon?.status || '').trim().toLowerCase();
  if (status === 'inactive' || status === 'expired' || status === 'rejected' || status === 'pending') {
    return false;
  }
  if (isQuickCouponNotStarted(coupon, now)) return false;
  if (isQuickCouponExpired(coupon, now)) return false;
  return true;
};

export const getQuickCouponEffectiveStatus = (coupon, now = new Date()) => {
  if (coupon?.isActive === false || String(coupon?.status || '').toLowerCase() === 'inactive') {
    return 'inactive';
  }
  if (String(coupon?.status || '').toLowerCase() === 'expired' || isQuickCouponExpired(coupon, now)) {
    return 'expired';
  }
  if (isQuickCouponNotStarted(coupon, now)) {
    return 'scheduled';
  }
  if (isQuickCouponCurrentlyValid(coupon, now)) {
    return 'active';
  }
  return 'inactive';
};

/**
 * Inclusive calendar-day window.
 * Seller coupons often store date-only values as UTC midnight (e.g. 2026-07-25T00:00:00.000Z).
 * Comparing those against local startOfDay breaks in positive-offset timezones (IST):
 * validFrom "today" at UTC midnight is still AFTER local midnight, so the coupon never lists.
 * Use endOfDay for validFrom and startOfDay for validTill so the whole calendar day is included.
 */
export const buildQuickCouponDateQuery = (now = new Date()) => {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  return {
    $and: [
      {
        $or: [
          { validFrom: null },
          { validFrom: { $exists: false } },
          { validFrom: { $lte: todayEnd } },
        ],
      },
      {
        $or: [
          { validTill: null },
          { validTill: { $exists: false } },
          { validTill: { $gte: todayStart } },
        ],
      },
    ],
  };
};

export const enrichQuickCoupon = (coupon, now = new Date()) => ({
  ...coupon,
  effectiveStatus: getQuickCouponEffectiveStatus(coupon, now),
  isEffectivelyActive: isQuickCouponCurrentlyValid(coupon, now),
});
