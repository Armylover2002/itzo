/**
 * In-tab draft for seller "Add Product" so refresh keeps the method step,
 * active tab, and filled fields (File objects cannot be restored — data URLs can).
 */
import { hydrateVariantMedia } from "@/shared/utils/variantMedia";

export const newProductPublishId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `pub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const SELLER_PRODUCT_ADD_DRAFT_KEY = "sellerProductAddDraft";

export const readSellerProductAddDraft = () => {
  try {
    const raw = sessionStorage.getItem(SELLER_PRODUCT_ADD_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const writeSellerProductAddDraft = (draft) => {
  try {
    sessionStorage.setItem(SELLER_PRODUCT_ADD_DRAFT_KEY, JSON.stringify(draft));
    return;
  } catch {
    // Quota — retry without image payloads.
  }
  try {
    const slim = {
      ...draft,
      formData: draft?.formData
        ? {
            ...draft.formData,
            variants: Array.isArray(draft.formData.variants)
              ? draft.formData.variants.map((variant) => ({
                  ...variant,
                  media: [],
                }))
              : [],
          }
        : draft?.formData,
    };
    sessionStorage.setItem(SELLER_PRODUCT_ADD_DRAFT_KEY, JSON.stringify(slim));
  } catch {
    // Storage blocked; form still works from memory.
  }
};

export const clearSellerProductAddDraft = () => {
  try {
    sessionStorage.removeItem(SELLER_PRODUCT_ADD_DRAFT_KEY);
  } catch {
    // Nothing to recover from here.
  }
};

export const draftMatchesSeller = (draft, sellerId) => {
  const draftId = String(draft?.sellerId || "").trim();
  const id = String(sellerId || "").trim();
  return Boolean(draftId && id && draftId === id);
};

/** Drop non-serializable File blobs before writing to sessionStorage. */
export const serializeProductFormForDraft = (formData = {}) => {
  const { mainImageFile, galleryFiles, ...rest } = formData || {};
  const variants = Array.isArray(rest.variants)
    ? rest.variants.map((variant) => ({
        ...variant,
        media: Array.isArray(variant?.media)
          ? variant.media
              .map((item) => ({
                id: item?.id,
                preview:
                  typeof item?.preview === "string" &&
                  (item.preview.startsWith("data:") || item.preview.startsWith("http"))
                    ? item.preview
                    : typeof item?.url === "string" && item.url.startsWith("http")
                      ? item.url
                      : "",
                url:
                  typeof item?.url === "string" && item.url.startsWith("http")
                    ? item.url
                    : null,
              }))
              .filter((item) => item.preview || item.url)
          : [],
      }))
    : [];
  return {
    ...rest,
    variants,
  };
};

/** Rebuild File objects from persisted data URLs after a refresh. */
export const hydrateProductFormFromDraft = (formData = {}) => {
  const variants = Array.isArray(formData.variants)
    ? formData.variants.map((variant) => ({
        ...variant,
        media: hydrateVariantMedia(variant?.media),
      }))
    : [];
  return {
    ...formData,
    variants,
  };
};
