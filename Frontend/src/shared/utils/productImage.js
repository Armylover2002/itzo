import { resolveQuickImageUrl } from '@/modules/quickCommerce/user/utils/image';

/** Default product thumbnail when none uploaded or URL fails to load. */
export const DEFAULT_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&w=400&q=80';

const pickImageCandidate = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return null;
  return (
    value.mainImage ||
    value.image ||
    value.images?.[0] ||
    value.galleryImages?.[0] ||
    null
  );
};

/** Resolve a product/image field to a usable URL, or the default thumbnail. */
export const resolveProductImageSrc = (productOrUrl) => {
  const candidate = pickImageCandidate(productOrUrl);
  const resolved = resolveQuickImageUrl(candidate);
  return resolved || DEFAULT_PRODUCT_IMAGE;
};

export const handleProductImageError = (event) => {
  const img = event?.currentTarget;
  if (!img || img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = DEFAULT_PRODUCT_IMAGE;
};
