import {
  applyVariantToProduct,
  getVariantKey,
  variantsMatch,
} from "./productMeta";
import { getFirstSellableVariant, getSelectableVariants, withFirstVariantDisplay } from "./firstVariantDisplay";

export const normalizeWishlistProductId = (value) =>
  String(value ?? "").split("::")[0].trim();

export const buildWishlistVariantMeta = (product = {}) => {
  const variant = product.selectedVariant || null;
  if (variant) {
    return {
      variantKey: getVariantKey(variant),
      variantName: String(variant.name || "").trim(),
      variantSku: String(variant.sku || "").trim(),
    };
  }
  return {
    variantKey:
      String(product.variantKey || product.wishlistVariantKey || "").trim(),
    variantName:
      String(product.variantName || product.wishlistVariantName || "").trim(),
    variantSku:
      String(product.variantSku || product.wishlistVariantSku || "").trim(),
  };
};

export const buildWishlistApiPayload = (product = {}) => {
  const productId = normalizeWishlistProductId(
    product.productId || product.id || product._id,
  );
  const variantMeta = buildWishlistVariantMeta(product);
  return { productId, ...variantMeta };
};

export const isSameWishlistVariantEntry = (item = {}, variant = null) => {
  if (!variant) return Boolean(item);
  const savedVariant = resolveWishlistVariant(item);
  if (savedVariant && variantsMatch(savedVariant, variant)) return true;

  const itemKey = String(
    item.variantKey || item.wishlistVariantKey || getVariantKey(savedVariant) || "",
  ).trim();
  const nextKey = getVariantKey(variant);
  return Boolean(itemKey && nextKey && itemKey === nextKey);
};

export const isSameWishlistVariant = (item = {}, variantMeta = {}) => {
  const itemKey = String(item.variantKey || item.wishlistVariantKey || "").trim();
  const nextKey = String(variantMeta.variantKey || "").trim();
  if (itemKey && nextKey) return itemKey === nextKey;
  return (
    String(item.variantName || item.wishlistVariantName || "") ===
      String(variantMeta.variantName || "") &&
    String(item.variantSku || item.wishlistVariantSku || "") ===
      String(variantMeta.variantSku || "")
  );
};

export const resolveWishlistVariant = (product = {}) => {
  if (!product || typeof product !== "object") return null;
  const variants = getSelectableVariants(product);
  if (!variants.length) return null;

  const saved = product.selectedVariant;
  if (saved) {
    const savedKey = getVariantKey(saved);
    const match = variants.find((variant) => getVariantKey(variant) === savedKey);
    if (match) return match;
  }

  const meta = buildWishlistVariantMeta(product);
  if (meta.variantKey) {
    const byKey = variants.find((variant) => getVariantKey(variant) === meta.variantKey);
    if (byKey) return byKey;
  }
  if (meta.variantSku) {
    const bySku = variants.find(
      (variant) => String(variant.sku || "").trim() === meta.variantSku,
    );
    if (bySku) return bySku;
  }
  if (meta.variantName) {
    const byName = variants.find(
      (variant) => String(variant.name || "").trim() === meta.variantName,
    );
    if (byName) return byName;
  }

  return null;
};

export const withWishlistVariantDisplay = (product = {}) => {
  if (!product || typeof product !== "object") return product;
  const savedVariant = resolveWishlistVariant(product);
  if (savedVariant) return applyVariantToProduct(product, savedVariant);
  return withFirstVariantDisplay(product);
};

export const mergeWishlistVariantFields = (product = {}, fallback = {}) => {
  const meta = buildWishlistVariantMeta({ ...fallback, ...product });
  const savedVariant = resolveWishlistVariant({ ...fallback, ...product, ...meta });
  return {
    ...product,
    ...meta,
    wishlistVariantKey: meta.variantKey,
    wishlistVariantName: meta.variantName,
    wishlistVariantSku: meta.variantSku,
    selectedVariant: savedVariant || product.selectedVariant || fallback.selectedVariant || null,
  };
};

export const buildWishlistEntryId = (productId, variantMeta = {}) => {
  const normalizedId = normalizeWishlistProductId(productId);
  const variantKey = String(
    variantMeta.variantKey ||
      getVariantKey(variantMeta) ||
      variantMeta.variantSku ||
      variantMeta.variantName ||
      "",
  ).trim();
  return variantKey ? `${normalizedId}::${variantKey}` : normalizedId;
};

export const getWishlistFallbackKey = (item = {}) => {
  const productId = normalizeWishlistProductId(item.id || item._id || item.productId);
  const meta = buildWishlistVariantMeta(item);
  return buildWishlistEntryId(productId, meta);
};

export const getWishlistItemForProduct = (wishlist = [], productId) => {
  const normalizedId = normalizeWishlistProductId(productId);
  return (
    wishlist.find(
      (item) => normalizeWishlistProductId(item.id || item._id) === normalizedId,
    ) || null
  );
};

export const getWishlistItemForVariant = (wishlist = [], productId, variant = null) => {
  const normalizedId = normalizeWishlistProductId(productId);
  if (!variant) return getWishlistItemForProduct(wishlist, normalizedId);
  return (
    wishlist.find((item) => {
      if (normalizeWishlistProductId(item.id || item._id) !== normalizedId) return false;
      return isSameWishlistVariantEntry(item, variant);
    }) || null
  );
};

export const isWishlistVariantMatch = (item = {}, variant = null) => {
  if (!variant) return true;
  return isSameWishlistVariantEntry(item, variant);
};
