import mongoose from 'mongoose';

/**
 * Current Quick Commerce policy (production):
 * ONE CART = ONE SELLER | ONE ORDER = ONE SELLER | ONE RETURN = ONE SELLERRETURN
 */
export const SINGLE_SELLER_POLICY = true;

export const SELLER_MISMATCH_CODE = 'SELLER_MISMATCH';
export const MULTI_SELLER_NOT_ALLOWED_CODE = 'MULTI_SELLER_NOT_ALLOWED';

export const normalizeSellerId = (value) => {
  const raw = value?._id || value?.id || value;
  const str = String(raw || '').trim();
  if (!str || !mongoose.Types.ObjectId.isValid(str)) return 'DEFAULT_SELLER';
  return str;
};

export const resolveProductSellerId = (product = {}) => normalizeSellerId(product?.sellerId);

export const collectSellerIdsFromProducts = (products = []) => {
  const ids = new Set();
  for (const product of products) {
    const sellerId = resolveProductSellerId(product);
    if (sellerId) ids.add(sellerId);
  }
  return ids;
};

export const assertSingleSellerFromIds = (sellerIds, { context = 'cart' } = {}) => {
  const unique = [...sellerIds].filter(Boolean);
  if (unique.length <= 1) return unique[0] || '';

  const message =
    context === 'order'
      ? 'Quick Commerce orders support only one seller per order.'
      : 'Your cart contains items from multiple sellers. Clear your cart to continue.';

  const error = new Error(message);
  error.code = MULTI_SELLER_NOT_ALLOWED_CODE;
  error.status = 400;
  throw error;
};

export const assertNoSellerMismatch = (existingSellerIds, newSellerId) => {
  const normalizedNew = normalizeSellerId(newSellerId);
  if (!normalizedNew) return;

  if (existingSellerIds.size === 0) return;
  if (existingSellerIds.size === 1 && existingSellerIds.has(normalizedNew)) return;

  const error = new Error(
    'Your cart contains items from another seller. Clear your current cart to add this product.',
  );
  error.code = SELLER_MISMATCH_CODE;
  error.status = 400;
  throw error;
};
