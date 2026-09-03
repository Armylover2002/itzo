import mongoose from "mongoose";

/** Fields that require admin re-approval when an already-approved seller changes them. */
export const REVIEWABLE_ROOT_FIELDS = ["name", "shopName", "email", "phone", "location"];

export const REVIEWABLE_BANK_FIELDS = [
  "bankName",
  "accountHolderName",
  "accountNumber",
  "ifscCode",
  "accountType",
  "upiId",
  "upiQrImage",
];

export const REVIEWABLE_DOCUMENT_FIELDS = [
  "panNumber",
  "gstRegistered",
  "gstNumber",
  "gstLegalName",
  "fssaiNumber",
  "fssaiImage",
  "fssaiExpiry",
  "medicalLicenseNumber",
  "medicalLicenseImage",
  "medicalLicenseExpiry",
  "shopLicenseNumber",
  "shopLicenseImage",
  "shopLicenseExpiry",
];

export const REVIEWABLE_SHOP_FIELDS = [
  "alternatePhone",
  "supportEmail",
  "zoneId",
  "zoneSource",
  "zoneName",
  "shopImage",
];

const valuesEqual = (a, b) => {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    try {
      return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    } catch {
      return false;
    }
  }

  if (typeof a === "object" || typeof b === "object") {
    try {
      const normalize = (value) => {
        if (value == null) return null;
        if (value instanceof mongoose.Types.ObjectId) return String(value);
        if (value?._id) return String(value._id);
        return value;
      };
      return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
    } catch {
      return false;
    }
  }

  return String(a) === String(b);
};

export const sellerHadPriorApproval = (seller = {}) =>
  seller?.wasEverApproved === true ||
  seller?.approvedAt != null ||
  String(seller?.approvalStatus || "").toLowerCase() === "approved";

const pickChangedNested = (current = {}, incoming = {}, keys = []) => {
  const next = {};
  keys.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) return;
    if (valuesEqual(current?.[key], incoming[key])) return;
    next[key] = incoming[key];
  });
  return next;
};

/**
 * Build a normalized patch from flat request fields + uploaded image URLs.
 */
export const buildSellerProfilePatch = ({
  body = {},
  bankInfoBody = {},
  documentsBody = {},
  shopInfoBody = {},
  uploaded = {},
  lat,
  lng,
  address,
}) => {
  const patch = {};

  if (body.name !== undefined) patch.name = String(body.name || "").trim();
  if (body.shopName !== undefined) patch.shopName = String(body.shopName || "").trim();
  if (body.phone !== undefined) patch.phone = String(body.phone || "").trim();
  if (body.email !== undefined) {
    const email = String(body.email || "").trim().toLowerCase();
    if (email) patch.email = email;
  }

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    patch.location = {
      type: "Point",
      coordinates: [lng, lat],
      latitude: lat,
      longitude: lng,
      formattedAddress: address || "",
      address: address || "",
    };
  } else if (address) {
    patch.location = {
      formattedAddress: address,
      address,
    };
  }

  const bankInfo = {};
  REVIEWABLE_BANK_FIELDS.forEach((key) => {
    if (body[key] !== undefined || bankInfoBody[key] !== undefined) {
      bankInfo[key] = String(bankInfoBody[key] ?? body[key] ?? "").trim();
    }
  });
  if (uploaded.upiQrImage) bankInfo.upiQrImage = uploaded.upiQrImage;
  if (Object.keys(bankInfo).length) patch.bankInfo = bankInfo;

  const documents = {};
  REVIEWABLE_DOCUMENT_FIELDS.forEach((key) => {
    if (body[key] !== undefined || documentsBody[key] !== undefined) {
      if (key === "gstRegistered") {
        documents[key] = Boolean(documentsBody[key] ?? body[key]);
      } else {
        documents[key] = documentsBody[key] ?? body[key];
      }
    }
  });
  if (uploaded.fssaiImage) documents.fssaiImage = uploaded.fssaiImage;
  if (uploaded.medicalLicenseImage) documents.medicalLicenseImage = uploaded.medicalLicenseImage;
  if (uploaded.shopLicenseImage) documents.shopLicenseImage = uploaded.shopLicenseImage;
  if (Object.keys(documents).length) patch.documents = documents;

  const shopInfo = {};
  REVIEWABLE_SHOP_FIELDS.forEach((key) => {
    if (body[key] !== undefined || shopInfoBody[key] !== undefined) {
      const raw = shopInfoBody[key] ?? body[key];
      shopInfo[key] =
        typeof raw === "string" ? raw.trim() : raw;
    }
  });
  if (uploaded.shopImage) shopInfo.shopImage = uploaded.shopImage;
  if (Object.keys(shopInfo).length) patch.shopInfo = shopInfo;

  return patch;
};

export const splitSellerReviewablePatch = (
  snapshot = {},
  patch = {},
  { requiresReview = false } = {},
) => {
  if (!requiresReview) {
    return { livePatch: { ...patch }, stagedPatch: {}, shouldStage: false };
  }

  const livePatch = {};
  const stagedPatch = {};

  REVIEWABLE_ROOT_FIELDS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return;
    if (valuesEqual(snapshot?.[key], patch[key]) && key !== "location") return;
    if (key === "location") {
      const currentLoc = snapshot.location || {};
      const nextLoc = patch.location || {};
      const merged = {
        ...(currentLoc.toObject?.() || currentLoc),
        ...nextLoc,
      };
      if (valuesEqual(currentLoc, merged)) return;
      stagedPatch.location = merged;
      return;
    }
    stagedPatch[key] = patch[key];
  });

  [["bankInfo", REVIEWABLE_BANK_FIELDS], ["documents", REVIEWABLE_DOCUMENT_FIELDS], ["shopInfo", REVIEWABLE_SHOP_FIELDS]].forEach(
    ([group, fields]) => {
      if (!patch[group]) return;
      const currentGroup = snapshot[group] || {};
      const stagedGroup = pickChangedNested(currentGroup, patch[group], fields);
      const liveGroup = {};
      Object.entries(patch[group] || {}).forEach(([key, value]) => {
        if (fields.includes(key)) return;
        if (!valuesEqual(currentGroup?.[key], value)) liveGroup[key] = value;
      });
      if (Object.keys(stagedGroup).length) stagedPatch[group] = stagedGroup;
      if (Object.keys(liveGroup).length) livePatch[group] = liveGroup;
    },
  );

  return {
    livePatch,
    stagedPatch,
    shouldStage: Object.keys(stagedPatch).length > 0,
  };
};

export const mergeSellerPendingProfileChanges = (
  existingPending = {},
  stagedPatch = {},
  seller = {},
) => {
  const keys = Object.keys(stagedPatch || {});
  if (!keys.length) return existingPending || null;

  const previousPending =
    existingPending && typeof existingPending === "object" ? existingPending : {};
  const previousProposed =
    previousPending.proposed && typeof previousPending.proposed === "object"
      ? { ...previousPending.proposed }
      : {};
  const previousSnapshot =
    previousPending.previous && typeof previousPending.previous === "object"
      ? { ...previousPending.previous }
      : {};

  const nextProposed = { ...previousProposed, ...stagedPatch };
  const nextPrevious = { ...previousSnapshot };

  const snapshotValue = (group, key) => {
    if (group) return seller?.[group]?.[key] ?? null;
    return seller?.[key] ?? null;
  };

  keys.forEach((key) => {
    if (key === "location") {
      if (!nextPrevious.location) nextPrevious.location = seller.location || null;
      return;
    }
    if (typeof stagedPatch[key] === "object" && !Array.isArray(stagedPatch[key])) {
      Object.keys(stagedPatch[key]).forEach((nestedKey) => {
        if (!Object.prototype.hasOwnProperty.call(nextPrevious[key] || {}, nestedKey)) {
          nextPrevious[key] = { ...(nextPrevious[key] || {}) };
          nextPrevious[key][nestedKey] = snapshotValue(key, nestedKey);
        }
      });
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(nextPrevious, key)) {
      nextPrevious[key] = snapshotValue(null, key);
    }
  });

  const reasons = new Set(
    Array.isArray(previousPending.changeTypes)
      ? previousPending.changeTypes.filter(Boolean)
      : [],
  );
  if (stagedPatch.location || stagedPatch.shopInfo?.zoneId) reasons.add("location");
  if (stagedPatch.bankInfo) reasons.add("bank");
  if (stagedPatch.documents) reasons.add("documents");
  if (stagedPatch.shopInfo) reasons.add("shop");
  if (stagedPatch.name || stagedPatch.shopName || stagedPatch.email) {
    reasons.add("store_identity");
  }
  if (existingPending?.hasPendingUpdate || keys.length) reasons.add("profile_update");

  return {
    hasPendingUpdate: true,
    proposed: nextProposed,
    previous: nextPrevious,
    changeTypes: Array.from(reasons),
    requestedAt: new Date(),
    reason: Array.from(reasons).join(", ") || "profile_update",
  };
};

export const applyPatchToSellerDocument = (seller, patch = {}) => {
  Object.entries(patch).forEach(([key, value]) => {
    if (key === "location") {
      seller.location = {
        ...(seller.location?.toObject?.() || seller.location || {}),
        ...value,
      };
      if (value.coordinates) seller.location.type = "Point";
      seller.markModified("location");
      return;
    }
    if (key === "bankInfo" || key === "documents" || key === "shopInfo") {
      seller[key] = seller[key] || {};
      Object.assign(seller[key], value);
      seller.markModified(key);
      return;
    }
    seller[key] = value;
  });
};

export const buildApplySellerPendingProfileChanges = (pending = {}) => {
  const proposed =
    pending?.proposed && typeof pending.proposed === "object" ? pending.proposed : {};
  if (!Object.keys(proposed).length) {
    return { $unset: { pendingProfileChanges: 1 } };
  }

  const $set = {
    wasEverApproved: true,
    approved: true,
    approvalStatus: "approved",
    approvedAt: new Date(),
  };

  Object.entries(proposed).forEach(([key, value]) => {
    if (key === "bankInfo" || key === "documents" || key === "shopInfo") {
      Object.entries(value || {}).forEach(([nestedKey, nestedValue]) => {
        $set[`${key}.${nestedKey}`] = nestedValue;
      });
      return;
    }
    if (key === "location") {
      $set.location = value;
      return;
    }
    $set[key] = value;
  });

  return {
    $set,
    $unset: { pendingProfileChanges: 1 },
  };
};

export const restoreStagedFieldsFromSnapshot = (seller, snapshot = {}, stagedPatch = {}) => {
  Object.keys(stagedPatch).forEach((key) => {
    if (key === "bankInfo" || key === "documents" || key === "shopInfo") {
      seller[key] = seller[key] || {};
      Object.keys(stagedPatch[key] || {}).forEach((nestedKey) => {
        seller[key][nestedKey] = snapshot?.[key]?.[nestedKey];
      });
      seller.markModified(key);
      return;
    }
    if (key === "location") {
      seller.location = snapshot.location;
      seller.markModified("location");
      return;
    }
    seller[key] = snapshot[key];
  });
};

export const buildDiscardSellerPendingProfileChanges = () => ({
  $unset: { pendingProfileChanges: 1 },
});

export const serializeSellerPendingProfileChanges = (seller = {}) => {
  const pending = seller.pendingProfileChanges;
  if (!pending?.hasPendingUpdate) return null;
  return {
    hasPendingUpdate: true,
    proposed: pending.proposed || {},
    previous: pending.previous || {},
    changeTypes: Array.isArray(pending.changeTypes) ? pending.changeTypes : [],
    reason: pending.reason || "",
    requestedAt: pending.requestedAt || null,
  };
};
