export const stripCompositeProductId = (value) =>
  String(value || '').split('::')[0].trim();

const normalizeVariantToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const buildCartLineKey = (productId, variantKey = '', variantName = '') => {
  const base = stripCompositeProductId(productId);
  const key = String(variantKey || variantName || '').trim();
  return key ? `${base}::${key}` : base;
};

export const matchProductVariant = (
  product,
  { variantName = '', variantKey = '', variantSku = '' } = {},
) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (!variants.length) return null;

  const normalizedName = normalizeVariantToken(variantName);
  const normalizedKey = normalizeVariantToken(variantKey);
  const normalizedSku = normalizeVariantToken(variantSku);

  if (normalizedKey) {
    const byKey = variants.find((variant) => {
      const candidate = String(
        variant?._id || variant?.id || variant?.sku || variant?.name || '',
      )
        .trim()
        .toLowerCase();
      return candidate === normalizedKey;
    });
    if (byKey) return byKey;
  }

  if (normalizedSku) {
    const bySku = variants.find(
      (variant) =>
        String(variant?.sku || '').trim().toLowerCase() === normalizedSku,
    );
    if (bySku) return bySku;
  }

  if (normalizedName) {
    const byName = variants.find(
      (variant) => normalizeVariantToken(variant?.name) === normalizedName,
    );
    if (byName) return byName;

    const compactName = normalizedName.replace(/\s+/g, '');
    const byCompactName = variants.find(
      (variant) => normalizeVariantToken(variant?.name).replace(/\s+/g, '') === compactName,
    );
    if (byCompactName) return byCompactName;
  }

  return null;
};

export const resolveVariantLabel = (product, meta = {}) => {
  const explicit = String(meta?.variantName || '').trim();
  if (explicit) return explicit;
  const variant = matchProductVariant(product, meta);
  return variant?.name ? String(variant.name).trim() : '';
};

/**
 * Resolve unit price from catalog only. Never trust client/request prices.
 */
export const resolveVariantUnitPrice = (product, meta = {}) => {
  const variant = matchProductVariant(product, meta);
  if (variant) {
    const salePrice = Number(variant.salePrice || 0);
    const basePrice = Number(variant.price || 0);
    if (salePrice > 0) return salePrice;
    if (basePrice > 0) return basePrice;
  }

  const productSalePrice = Number(product?.salePrice || 0);
  if (productSalePrice > 0) return productSalePrice;
  return Number(product?.price || 0);
};

export const resolveVariantStock = (product, meta = {}) => {
  const variant = matchProductVariant(product, meta);
  if (variant) return Number(variant.stock ?? 0);
  return Number(product?.stock ?? 0);
};
