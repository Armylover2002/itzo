import mongoose from 'mongoose';
import { matchProductVariant } from './variant.helpers.js';

export const normalizeWishlistEntries = (products = []) => {
  if (!Array.isArray(products)) return [];

  return products
    .map((entry) => {
      if (!entry) return null;

      if (typeof entry === 'object' && entry.productId) {
        return {
          productId: entry.productId,
          variantKey: String(entry.variantKey || '').trim(),
          variantName: String(entry.variantName || '').trim(),
          variantSku: String(entry.variantSku || '').trim(),
        };
      }

      const productId = String(entry?._id || entry?.id || entry || '').trim();
      if (!mongoose.isValidObjectId(productId)) return null;

      return {
        productId,
        variantKey: '',
        variantName: '',
        variantSku: '',
      };
    })
    .filter(Boolean);
};

export const extractWishlistProductIds = (entries = []) =>
  [...new Set(entries.map((entry) => String(entry.productId)).filter(Boolean))];

export const parseWishlistVariantMeta = (body = {}) => ({
  variantKey: String(body.variantKey || '').trim(),
  variantName: String(body.variantName || '').trim(),
  variantSku: String(body.variantSku || '').trim(),
});

export const isSameWishlistVariant = (entry, variantMeta = {}) => {
  const entryKey = String(entry?.variantKey || '').trim();
  const metaKey = String(variantMeta.variantKey || '').trim();
  if (entryKey && metaKey) return entryKey === metaKey;

  const entryName = String(entry?.variantName || '').trim();
  const metaName = String(variantMeta.variantName || '').trim();
  const entrySku = String(entry?.variantSku || '').trim();
  const metaSku = String(variantMeta.variantSku || '').trim();

  if (entrySku && metaSku && entrySku === metaSku) return true;
  if (entryName && metaName && entryName === metaName) return true;

  return entryName === metaName && entrySku === metaSku;
};

export const findWishlistEntry = (entries = [], productId, variantMeta = {}) => {
  const pid = String(productId);
  return (
    entries.find(
      (entry) =>
        String(entry.productId) === pid && isSameWishlistVariant(entry, variantMeta),
    ) || null
  );
};

export const upsertWishlistEntry = (entries, productId, variantMeta = {}) => {
  const pid = String(productId);
  const next = entries.filter(
    (entry) =>
      !(
        String(entry.productId) === pid && isSameWishlistVariant(entry, variantMeta)
      ),
  );
  next.push({
    productId,
    variantKey: String(variantMeta.variantKey || '').trim(),
    variantName: String(variantMeta.variantName || '').trim(),
    variantSku: String(variantMeta.variantSku || '').trim(),
  });
  return next;
};

export const removeWishlistEntry = (entries, productId, variantMeta = null) => {
  const pid = String(productId);
  if (!variantMeta) {
    return entries.filter((entry) => String(entry.productId) !== pid);
  }
  return entries.filter(
    (entry) =>
      !(String(entry.productId) === pid && isSameWishlistVariant(entry, variantMeta)),
  );
};

export const attachWishlistVariantToProduct = (product, entry) => {
  if (!product || !entry) return product;
  const matchedVariant = matchProductVariant(product, entry);
  return {
    ...product,
    wishlistVariantKey: entry.variantKey || '',
    wishlistVariantName: entry.variantName || '',
    wishlistVariantSku: entry.variantSku || '',
    selectedVariant: matchedVariant || null,
    variantKey: entry.variantKey || '',
    variantName: entry.variantName || '',
    variantSku: entry.variantSku || '',
  };
};
