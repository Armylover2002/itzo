import { QuickSellerCommission } from '../models/sellerCommission.model.js';

const SELLER_COMMISSION_CACHE_MS = 60 * 1000;
let sellerCommissionRulesCache = null;
let sellerCommissionRulesLoadedAt = 0;

let sellerCommissionRulesPromise = null;

async function getActiveSellerCommissionRules() {
  const now = Date.now();
  if (
    sellerCommissionRulesCache &&
    now - sellerCommissionRulesLoadedAt < SELLER_COMMISSION_CACHE_MS
  ) {
    return sellerCommissionRulesCache;
  }

  if (sellerCommissionRulesPromise) {
    return sellerCommissionRulesPromise;
  }

  sellerCommissionRulesPromise = (async () => {
    try {
      const list = await QuickSellerCommission.find({
        status: { $ne: false },
      }).lean();
      sellerCommissionRulesCache = list || [];
      sellerCommissionRulesLoadedAt = Date.now();
      return sellerCommissionRulesCache;
    } finally {
      sellerCommissionRulesPromise = null;
    }
  })();

  return sellerCommissionRulesPromise;
}

export function computeSellerCommissionAmount(baseAmount, rule) {
  const safeBase = Math.max(0, Number(baseAmount) || 0);
  if (!Number.isFinite(safeBase) || safeBase < 0) return 0;

  const commissionType = rule?.defaultCommission?.type || 'percentage';
  const commissionValue = Math.max(
    0,
    Number(rule?.defaultCommission?.value ?? 0) || 0
  );

  let commissionAmount = 0;
  if (commissionType === 'percentage') {
    commissionAmount = safeBase * (commissionValue / 100);
  } else if (commissionType === 'amount') {
    commissionAmount = commissionValue;
  }

  // Round to 2 decimals and clamp to [0, base]
  commissionAmount = Math.round((commissionAmount || 0) * 100) / 100;
  commissionAmount = Math.max(0, Math.min(commissionAmount, safeBase));

  return { commissionAmount, commissionType, commissionValue, baseAmount: safeBase };
}

export async function getSellerCommissionSnapshot(sellerId, baseAmount) {
  if (!sellerId) {
    return {
      commissionAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      baseAmount,
    };
  }

  const rules = await getActiveSellerCommissionRules();
  const rule = rules.find((r) => String(r.sellerId) === String(sellerId)) || null;

  if (!rule) {
    return {
      commissionAmount: 0,
      commissionType: 'percentage',
      commissionValue: 0,
      baseAmount,
    };
  }

  return computeSellerCommissionAmount(baseAmount, rule);
}
