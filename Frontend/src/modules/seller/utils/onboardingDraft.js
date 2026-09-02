import { clearSellerOnboardingResume } from "./sellerSession";

/**
 * Browser draft for half-finished seller onboarding.
 * Keyed by phone so logout + a different seller OTP never reuses another shop's fields.
 */
export const SELLER_ONBOARDING_DRAFT_KEY = "sellerOnboardingDraft";

export const normalizeSellerDraftPhone = (value = "") =>
  String(value || "").replace(/\D/g, "").slice(-10);

export const readSellerOnboardingDraft = () => {
  try {
    const raw = localStorage.getItem(SELLER_ONBOARDING_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const writeSellerOnboardingDraft = (draft) => {
  try {
    localStorage.setItem(SELLER_ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be full or blocked; the form still works from memory.
  }
};

export const clearSellerOnboardingDraft = () => {
  try {
    localStorage.removeItem(SELLER_ONBOARDING_DRAFT_KEY);
    sessionStorage.removeItem("sellerReonboard");
    clearSellerOnboardingResume();
  } catch {
    // Nothing to recover from here.
  }
};

export const SELLER_ONBOARDING_DISCARD_KEY = "sellerOnboardingDiscardedPhone";

export const markSellerOnboardingDiscarded = (phone) => {
  try {
    const digits = normalizeSellerDraftPhone(phone);
    if (digits) {
      localStorage.setItem(SELLER_ONBOARDING_DISCARD_KEY, digits);
    }
  } catch {
    // ignore
  }
};

export const consumeSellerOnboardingDiscarded = (phone) => {
  try {
    const discarded = localStorage.getItem(SELLER_ONBOARDING_DISCARD_KEY);
    const digits = normalizeSellerDraftPhone(phone);
    if (discarded && digits && discarded === digits) {
      localStorage.removeItem(SELLER_ONBOARDING_DISCARD_KEY);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
};

/** Only restore a draft that belongs to the same seller phone. */
export const draftMatchesSellerPhone = (draft, phone) => {
  const draftPhone = normalizeSellerDraftPhone(
    draft?.phone || draft?.form?.phone || "",
  );
  const sellerPhone = normalizeSellerDraftPhone(phone);
  return Boolean(draftPhone && sellerPhone && draftPhone === sellerPhone);
};
