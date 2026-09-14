/**
 * Shared client-side QC coupon form validation (admin + seller).
 * Same-day start/end allowed. End cannot be before start.
 */

/** Local calendar YYYY-MM-DD for date inputs (avoids UTC day-shift). */
export const toLocalDateInputValue = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const validateQuickCouponForm = (formData = {}) => {
  const code = String(formData.code || "").trim().toUpperCase();
  if (!code) return "Coupon code is required";
  if (code.length < 3) return "Coupon code must be at least 3 characters";
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    return "Coupon code may only contain letters, numbers, hyphen and underscore";
  }

  const discountType = String(formData.discountType || "").trim().toLowerCase();
  if (!["percentage", "fixed", "free_delivery"].includes(discountType)) {
    return "Select a valid discount type";
  }

  const discountValue = Number(formData.discountValue);
  if (discountType !== "free_delivery") {
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return "Discount value must be greater than 0";
    }
    if (discountType === "percentage" && discountValue > 100) {
      return "Percentage discount cannot exceed 100";
    }
  } else if (Number.isFinite(discountValue) && discountValue < 0) {
    return "Discount value cannot be negative";
  }

  if (formData.minOrderValue !== "" && formData.minOrderValue != null) {
    const minOrder = Number(formData.minOrderValue);
    if (!Number.isFinite(minOrder) || minOrder < 0) {
      return "Min order value must be a valid non-negative number";
    }
  }

  if (formData.maxDiscount !== "" && formData.maxDiscount != null) {
    const maxDiscount = Number(formData.maxDiscount);
    if (!Number.isFinite(maxDiscount) || maxDiscount < 0) {
      return "Max discount must be a valid non-negative number";
    }
  }

  if (formData.usageLimit !== "" && formData.usageLimit != null) {
    const usageLimit = Number(formData.usageLimit);
    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
      return "Total usage limit must be a whole number of at least 1";
    }
  }

  const perUserLimit = Number(formData.perUserLimit || 1);
  if (!Number.isInteger(perUserLimit) || perUserLimit < 1) {
    return "Per user limit must be a whole number of at least 1";
  }

  if (formData.usageLimit !== "" && formData.usageLimit != null) {
    const usageLimit = Number(formData.usageLimit);
    if (Number.isInteger(usageLimit) && perUserLimit > usageLimit) {
      return "Per user limit cannot exceed total usage limit";
    }
  }

  if (!formData.validFrom || !formData.validTill) {
    return "Start and end dates are required";
  }

  const from = new Date(`${formData.validFrom}T00:00:00`);
  const till = new Date(`${formData.validTill}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(till.getTime())) {
    return "Enter valid start and end dates";
  }
  if (till.getTime() < from.getTime()) {
    return "End date cannot be before start date";
  }

  return null;
};

export const buildQuickCouponPayload = (formData = {}) => {
  const discountType = String(formData.discountType || "percentage").toLowerCase();
  const discountValue =
    discountType === "free_delivery"
      ? Math.max(0, Number(formData.discountValue) || 0)
      : Number(formData.discountValue);

  return {
    code: String(formData.code || "").trim().toUpperCase(),
    discountType,
    discountValue,
    minOrderValue: Number(formData.minOrderValue) || 0,
    maxDiscount:
      formData.maxDiscount !== "" && formData.maxDiscount != null
        ? Number(formData.maxDiscount)
        : undefined,
    usageLimit:
      formData.usageLimit !== "" && formData.usageLimit != null
        ? Number(formData.usageLimit)
        : null,
    perUserLimit: formData.perUserLimit ? Number(formData.perUserLimit) : 1,
    validFrom: formData.validFrom,
    validTill: formData.validTill,
    firstOrderOnly: Boolean(formData.firstOrderOnly),
    description: String(formData.description || "").trim(),
  };
};
