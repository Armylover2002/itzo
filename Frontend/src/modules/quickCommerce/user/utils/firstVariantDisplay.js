/**
 * Prefer first in-stock variant for storefront card/list display.
 * Parent product.price may lag; variants are the source of truth.
 * Also attaches selectedVariant + composite cart line id so card adds match PDP.
 */
import {
  applyVariantToProduct,
  variantsWithoutPlaceholder,
} from "./productMeta";

const variantName = (variant) => String(variant?.name || "").trim();

const isDefaultVariant = (variant) => {
  const name = variantName(variant).toLowerCase();
  return !name || name === "default";
};

const isInStock = (variant) => Number(variant?.stock || 0) > 0;

/** Named / real variants the shopper can pick (excludes a lone Default row). */
export const getSelectableVariants = (product = {}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const named = variants.filter((variant) => !isDefaultVariant(variant));
  if (named.length > 0) return named;
  return variantsWithoutPlaceholder(variants).filter((variant) => !isDefaultVariant(variant));
};

export const getFirstSellableVariant = (product = {}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const named = variants.filter((variant) => {
    if (isDefaultVariant(variant)) return variants.length === 1;
    return true;
  });
  const pool = named.length ? named : variants;
  return pool.find(isInStock) || pool[0] || null;
};

/** True when the shopper should pick a pack/size before adding. */
export const hasVariantPicker = (product = {}) => getSelectableVariants(product).length >= 1;

/** Sum of all variant stocks, or parent stock when there are no variants. */
export const getProductAvailableStock = (product = {}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length > 0) {
    return variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.stock || 0)), 0);
  }
  return Math.max(0, Number(product.totalStock ?? product.stock ?? 0));
};

export const isProductSoldOut = (product = {}) => getProductAvailableStock(product) <= 0;

export const withFirstVariantDisplay = (product = {}) => {
  if (!product || typeof product !== "object") return product;
  const first = getFirstSellableVariant(product);
  if (!first) return product;
  return applyVariantToProduct(product, first);
};
