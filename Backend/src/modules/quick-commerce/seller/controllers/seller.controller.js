import crypto from "crypto";
import ms from "ms";
import mongoose from "mongoose";
import {
  createOrUpdateOtp,
  verifyOtp,
} from "../../../../core/otp/otp.service.js";
import {
  signAccessToken,
  signRefreshToken,
  signSellerRegistrationToken,
} from "../../../../core/auth/token.util.js";
import { FoodRefreshToken } from "../../../../core/refreshTokens/refreshToken.model.js";
import { config } from "../../../../config/env.js";
import { getIO, rooms } from "../../../../config/socket.js";
import { logger } from "../../../../utils/logger.js";
import { uploadImageBuffer } from "../../../../services/cloudinary.service.js";
import { sendError, sendResponse } from "../../../../utils/response.js";
import { headerMatchesSellerBusinessType } from "../../utils/category.helpers.js";
import { Seller } from "../models/seller.model.js";
import { SellerNotification } from "../models/sellerNotification.model.js";
import { SellerOrder } from "../models/sellerOrder.model.js";
import { SellerProduct } from "../models/sellerProduct.model.js";
import { QuickCategory } from "../../models/category.model.js";
import { SellerReturn } from "../models/sellerReturn.model.js";
import { recordSellerReturnDecision, requestSellerReturnPickup } from "../../services/quickReturn.service.js";
import { serializeReturnForSeller, mergeSellerReturnOrderContext } from "../../utils/return.helpers.js";
import { computeSellerSettledWithdrawBalance, syncSellerDeliveredOrderPaymentCredits } from "../../services/sellerLedger.service.js";
import { getActiveFeeSettings } from "../../admin/services/billing.service.js";
import { SellerStockAdjustment } from "../models/sellerStockAdjustment.model.js";
import { SellerTransaction } from "../models/sellerTransaction.model.js";
import { QuickOrder } from "../../models/order.model.js";
import { resolveQuickOrderCancellationReason } from "../../utils/cancellation.helpers.js";
import {
  buildSellerProfilePatch,
  mergeSellerPendingProfileChanges,
  restoreStagedFieldsFromSnapshot,
  sellerHadPriorApproval,
  serializeSellerPendingProfileChanges,
  splitSellerReviewablePatch,
} from "../../shared/pendingProfileChanges.js";
import { getSellerVisibleQuickOrderPaymentFilter, isQuickOrderVisibleToSeller } from "../../utils/sellerOrderVisibility.helpers.js";
import { resolveQuickOrderCustomer } from "../../utils/customer.helpers.js";
import { resolveSellerReceivable } from "../../utils/sellerReceivable.helpers.js";
import { attachReturnSummaryToOrder, loadReturnsByOrderIds } from "../../utils/orderReturnSummary.helpers.js";
import { allocateQuickCouponEarnings } from "../../utils/quickCouponEarnings.helpers.js";
import { FoodDeliveryPartner } from "../../../food/delivery/models/deliveryPartner.model.js";
import {
  buildDeliverySocketPayload,
  notifyOwnerSafely,
} from "../../../food/orders/services/order.helpers.js";
import { scorePointsByRoadDistance } from "../../../../services/roadDistance.service.js";
import { getHeaderCommissionSnapshot } from "../../admin/services/commission.service.js";
import * as quickOrderService from "../../services/quickOrder.service.js";
import {
  buildSellerCategoryTree,
  resolveSellerCategoryIds,
  syncSellerInventoryNotification,
} from "../services/sellerCatalog.service.js";
import { validateCategoryImageFile } from "../../utils/category.helpers.js";
import { upsertSellerNotification } from "../services/sellerNotify.service.js";
import {
  escapeRegex,
  effectiveStockExpr,
} from "../../utils/productVisibility.helpers.js";
import { QuickZone } from "../../models/quick_zone.model.js";
import { isPointInPolygon } from "../../../../utils/geo.js";

const MAX_BULK_CSV_PRODUCTS = 500;

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const last10 = (value) => normalizePhone(value).slice(-10);
const normalizeBusinessType = (value) =>
  String(value || "quick_commerce").trim().toLowerCase().replace(/\s+/g, "_");
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const optionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const optionalDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const optionalBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
};
const str = (value, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;
const arr = (value) => (Array.isArray(value) ? value : []);
// Redundant getOrderAddressPoint removed in favor of quickOrderService.getOrderAddressPoint

const PHARMACY_DOSAGE_FORMS = new Set([
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "drops",
  "cream",
  "ointment",
  "powder",
  "spray",
  "inhaler",
  "medical_device",
  "other",
]);

const PHARMACY_PACK_TYPES = new Set([
  "strip",
  "bottle",
  "box",
  "tube",
  "vial",
  "device",
]);

const PHARMACY_UNITS = new Set([
  "tablet",
  "capsule",
  "ml",
  "gm",
  "piece",
  "vial",
  "strip",
]);

const PHARMACY_VARIANT_PACK_TYPES = new Set([
  "strip",
  "bottle",
  "box",
  "tube",
  "vial",
  "device",
  "piece",
]);

const sanitizePharmacyVariantMeta = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const strength = str(source.strength);
  const packType = normalizeBusinessType(source.packType ?? source.pack_type);
  const packQuantityRaw = source.packQuantity ?? source.pack_quantity;
  const packQuantity =
    packQuantityRaw === "" || packQuantityRaw === null || packQuantityRaw === undefined
      ? null
      : num(packQuantityRaw, null);
  const unit = normalizeBusinessType(source.unit);

  return {
    ...(strength ? { strength } : {}),
    ...(PHARMACY_VARIANT_PACK_TYPES.has(packType) ? { packType } : {}),
    ...(Number.isFinite(packQuantity) && packQuantity > 0 ? { packQuantity } : {}),
    ...(PHARMACY_UNITS.has(unit) ? { unit } : {}),
  };
};

const stripPharmacyVariantMeta = (variant = {}) => {
  if (!variant || typeof variant !== "object") return variant;
  const { strength: _s, packType: _pt, packQuantity: _pq, unit: _u, ...rest } = variant;
  return rest;
};

const PHARMACY_DRUG_CLASSIFICATIONS = new Set([
  "otc",
  "prescription",
  "ayurvedic",
  "homeopathic",
  "surgical",
  "medical_device",
  "other",
]);

const sanitizePharmacyDetails = (raw = {}) => {
  const source = raw && typeof raw === "object" ? raw : {};

  // Backwards compatibility: accept `classification` and/or string `prescriptionRequired` from older UIs.
  const drugClassificationRaw =
    source.drugClassification ?? source.classification ?? "";
  const prescriptionRaw =
    source.prescriptionRequired ?? source.prescription ?? false;

  const dosageForm = normalizeBusinessType(source.dosageForm || source.dosage_form || "");
  const packType = normalizeBusinessType(source.packType || source.pack_type || "");
  const unit = normalizeBusinessType(source.unit || "");
  const drugClassification = normalizeBusinessType(drugClassificationRaw);

  const packQuantityNum = num(source.packQuantity ?? source.pack_quantity, 0);

  return {
    genericName: str(source.genericName || source.generic_name),
    manufacturer: str(source.manufacturer),
    composition: str(source.composition),
    strength: str(source.strength),
    dosageForm: PHARMACY_DOSAGE_FORMS.has(dosageForm) ? dosageForm : "other",
    packType: PHARMACY_PACK_TYPES.has(packType) ? packType : "",
    packQuantity: Number.isFinite(packQuantityNum) ? packQuantityNum : 0,
    unit: PHARMACY_UNITS.has(unit) ? unit : "",
    storageCondition: str(source.storageCondition || source.storage_condition),
    prescriptionRequired: optionalBoolean(prescriptionRaw, false),
    drugClassification: PHARMACY_DRUG_CLASSIFICATIONS.has(drugClassification)
      ? drugClassification
      : "otc",

    // Keep these for existing data and regulatory tracking.
    drugLicenseNumber: str(source.drugLicenseNumber || source.drug_license_number),
    hsnCode: str(source.hsnCode || source.hsn_code),
    batchNumber: str(source.batchNumber || source.batch_number),
    mfgDate: str(source.mfgDate || source.mfg_date),
    expDate: str(source.expDate || source.exp_date),

    // Legacy field; keep if present.
    packSize: str(source.packSize || source.pack_size),
  };
};

const validatePharmacyDetails = (details = {}) => {
  const errors = [];
  if (!str(details.genericName)) errors.push("pharmacyDetails.genericName is required");
  if (!str(details.manufacturer)) errors.push("pharmacyDetails.manufacturer is required");
  if (!str(details.dosageForm)) errors.push("pharmacyDetails.dosageForm is required");
  if (!str(details.packType)) errors.push("pharmacyDetails.packType is required");
  if (!Number.isFinite(Number(details.packQuantity)) || Number(details.packQuantity) <= 0) {
    errors.push("pharmacyDetails.packQuantity must be a positive number");
  }
  if (!str(details.unit)) errors.push("pharmacyDetails.unit is required");
  if (!str(details.drugClassification)) errors.push("pharmacyDetails.drugClassification is required");
  return errors;
};

const buildSellerAddressFromParentOrder = (order) => {
  const coords = order?.deliveryAddress?.location?.coordinates;
  return {
    address: String(order?.deliveryAddress?.street || "").trim(),
    city: String(order?.deliveryAddress?.city || "").trim(),
    ...(Array.isArray(coords) && coords.length === 2
      ? {
        location: {
          lat: Number(coords[1]),
          lng: Number(coords[0]),
        },
      }
      : {}),
  };
};

const buildSellerOrderFromParentOrder = async (order, sellerId) => {
  const sellerKey = String(sellerId || "").trim();
  if (!sellerKey) return null;
  if (!isQuickOrderVisibleToSeller(order)) return null;

  const quickItems = Array.isArray(order?.items)
    ? order.items.filter(
      (item) =>
        item?.type === "quick" &&
        String(item?.sourceId || "").trim() === sellerKey,
    )
    : [];
  if (!quickItems.length) return null;

  const quickSubtotal = (Array.isArray(order?.items) ? order.items : [])
    .filter((item) => item?.type === "quick")
    .reduce(
      (sum, item) =>
        sum + Number(item?.price || 0) * Number(item?.quantity || 0),
      0,
    );
  const sellerSubtotal = quickItems.reduce(
    (sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0),
    0,
  );
  const allocatedDeliveryFee =
    quickSubtotal > 0
      ? Number(
        (
          (Number(order?.pricing?.deliveryFee || 0) * sellerSubtotal) /
          quickSubtotal
        ).toFixed(2),
      )
      : 0;
  const { commissionAmount } = await getHeaderCommissionSnapshot(
    quickItems.map((item) => ({
      productId: item?.itemId || item?.productId || item?._id,
      price: item?.price,
      quantity: item?.quantity,
    })),
  );
  const appliedCoupon = order?.pricing?.appliedCoupon;
  const totalPackagingFee = Number(order?.pricing?.packagingFee || 0);
  const allocatedPackingFee =
    quickSubtotal > 0
      ? Number(((totalPackagingFee * sellerSubtotal) / quickSubtotal).toFixed(2))
      : totalPackagingFee;
  const {
    sellerDiscount,
    productEarnings: sellerProductEarnings,
    receivable: sellerTotalEarnings,
  } = allocateQuickCouponEarnings({
    couponSource: appliedCoupon?.source,
    discount: appliedCoupon?.discount || order?.pricing?.discount || 0,
    sellerSubtotal,
    commission: commissionAmount,
    packingFee: allocatedPackingFee,
  });

  const parentStatus = String(order?.orderStatus || "pending").toLowerCase();
  let sellerStatus = "pending";
  let workflowStatus = "SELLER_PENDING";

  if (parentStatus === "delivered") {
    sellerStatus = "delivered";
    workflowStatus = "DELIVERED";
  } else if (parentStatus.startsWith("cancel")) {
    sellerStatus = "cancelled";
    workflowStatus = "CANCELLED";
  } else if (
    ["confirmed", "preparing", "ready_for_pickup", "ready", "picked_up", "out_for_delivery"].includes(
      parentStatus,
    )
  ) {
    sellerStatus = parentStatus;
    workflowStatus = parentStatus.toUpperCase();
  }

  const addr = order?.deliveryAddress;
  const customer = resolveQuickOrderCustomer(order);

  return {
    orderType: order?.orderType === "mixed" ? "mixed" : "quick",
    parentOrderId: order?._id || null,
    sellerId,
    orderId: order?.orderId,
    customer: {
      name: customer.name,
      phone: customer.phone || addr?.phone || "",
    },
    items: quickItems.map((item) => ({
      productId: mongoose.isValidObjectId(String(item?.itemId || ""))
        ? new mongoose.Types.ObjectId(String(item.itemId))
        : null,
      name: item?.name || "Item",
      price: Number(item?.price || 0),
      quantity: Math.max(1, Number(item?.quantity || 1)),
      image: item?.image || "",
    })),
    pricing: {
      subtotal: sellerSubtotal,
      commission: commissionAmount,
      productEarnings: sellerProductEarnings,
      packingFee: allocatedPackingFee,
      couponDiscount: sellerDiscount,
      total: sellerSubtotal + allocatedDeliveryFee,
      receivable: sellerTotalEarnings,
    },
    status: sellerStatus,
    workflowStatus: workflowStatus,
    deliveredAt: order?.deliveryState?.deliveredAt || (parentStatus === "delivered" ? order.updatedAt : null),
    sellerPendingExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
    address: {
      address:
        [addr?.street, addr?.additionalDetails].filter(Boolean).join(", ") ||
        addr?.address ||
        "",
      city: addr?.city || "",
      location: addr?.location
        ? {
          lat: addr.location.coordinates?.[1],
          lng: addr.location.coordinates?.[0],
        }
        : undefined,
    },
    payment: {
      method: ["cash", "cod"].includes(
        String(order?.payment?.method || "").toLowerCase(),
      )
        ? "cash"
        : "online",
    },
  };
};

const resolveParentQuickOrder = (
  sellerOrder,
  { populateUser = false } = {},
) => {
  const parentOrderId = sellerOrder?.parentOrderId;
  const orderId = String(sellerOrder?.orderId || "").trim();

  const baseQuery = {
    orderType: { $in: ["quick", "mixed"] },
  };

  let query = null;
  if (mongoose.isValidObjectId(String(parentOrderId || ""))) {
    query = QuickOrder.findOne({
      ...baseQuery,
      _id: new mongoose.Types.ObjectId(String(parentOrderId)),
    });
  } else if (orderId) {
    query = QuickOrder.findOne({
      ...baseQuery,
      orderId,
    });
  }

  if (!query) return null;
  if (populateUser) query = query.populate("userId");
  return query;
};

const backfillSellerOrdersFromParentOrders = async (sellerId) => {
  const sellerKey = String(sellerId || "").trim();
  if (!sellerKey) return;

  const [existingSellerOrders, mixedOrders] = await Promise.all([
    SellerOrder.find({ sellerId }).select("orderId").lean(),
    QuickOrder.find({
      orderType: { $in: ["mixed", "quick"] },
      items: { $elemMatch: { type: "quick", sourceId: sellerKey } },
      ...getSellerVisibleQuickOrderPaymentFilter(),
    })
      .select("_id orderId orderType items pricing deliveryAddress payment")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean(),
  ]);

  const existingOrderIds = new Set(
    existingSellerOrders
      .map((item) => String(item.orderId || "").trim())
      .filter(Boolean),
  );

  const missingDocs = (
    await Promise.all(
      mixedOrders
        .filter(
          (order) => !existingOrderIds.has(String(order.orderId || "").trim()),
        )
        .map((order) => buildSellerOrderFromParentOrder(order, sellerId)),
    )
  ).filter(Boolean);

  if (!missingDocs.length) return;

  // Single batched round-trip instead of one upsert per missing order.
  // The returned docs were not used, so bulkWrite is behaviourally equivalent.
  await SellerOrder.bulkWrite(
    missingDocs.map((doc) => ({
      updateOne: {
        filter: { sellerId: doc.sellerId, orderId: doc.orderId },
        update: { $set: doc },
        upsert: true,
        setDefaultsOnInsert: true,
      },
    })),
  );
};

const listNearbyOnlineDeliveryPartnersByCoords = async (
  origin,
  { maxKm = 15, limit = 10 } = {},
) => {
  const onlinePartners = await FoodDeliveryPartner.find({
    availabilityStatus: "online",
    status: {
      $in:
        process.env.NODE_ENV === "production"
          ? ["approved"]
          : ["approved", "pending"],
    },
  })
    .select("_id name phone lastLat lastLng lastLocationAt")
    .lean();

  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return onlinePartners.slice(0, Math.max(1, limit)).map((partner) => ({
      partnerId: partner._id,
      distanceKm: null,
      name: partner.name || "Delivery Partner",
      phone: partner.phone || "",
    }));
  }

  const STALE_GPS_MS = 10 * 60 * 1000;
  const candidates = onlinePartners
    .map((partner) => {
      const lat = Number(partner.lastLat);
      const lng = Number(partner.lastLng);
      const isStale =
        !partner.lastLocationAt ||
        Date.now() - new Date(partner.lastLocationAt).getTime() > STALE_GPS_MS;

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || isStale) {
        return null;
      }

      return {
        partnerId: partner._id,
        lat,
        lng,
        name: partner.name || "Delivery Partner",
        phone: partner.phone || "",
      };
    })
    .filter(Boolean);

  const scored = await scorePointsByRoadDistance(origin, candidates, { maxKm });
  return scored.slice(0, Math.max(1, limit));
};
const currency = (value) => `₹${num(value, 0).toLocaleString("en-IN")}`;
const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const createSellerSku = () =>
  `SKU-${Date.now().toString(36).slice(-5).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

/** Parent SKU + variant name so multi-variant rows never share one code. */
const assignUniqueVariantSkus = (variants = [], productSku = "") => {
  const base = str(productSku) || createSellerSku();
  const used = new Set();

  return arr(variants).map((variant, index) => {
    let sku = str(variant?.sku);
    const needsSku =
      !sku ||
      used.has(sku) ||
      (arr(variants).length > 1 && sku === base);

    if (needsSku) {
      const namePart = slugify(variant?.name)
        .replace(/-/g, "")
        .toUpperCase()
        .slice(0, 10);
      const suffix = namePart || `V${index + 1}`;
      sku = `${base}-${suffix}`;
      let n = 2;
      while (used.has(sku)) {
        sku = `${base}-${suffix}-${n}`;
        n += 1;
      }
    }

    used.add(sku);
    return { ...variant, sku };
  });
};

/** Sale/discount must not exceed the listed price (MRP side). */
const MAX_PRODUCT_VARIANTS = 5;
const MIN_VARIANT_IMAGES = 1;
const MAX_VARIANT_IMAGES = 3;

const parseVariantImageUrls = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => str(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => str(item)).filter(Boolean);
      }
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
};

const enrichVariantsWithImages = async (req, variants, existingProduct = null) => {
  const existingVariants = arr(existingProduct?.variants);
  const hasNamedVariantUploads = variants.some((_, index) =>
    arr(req.files?.[`variantImages_${index}`]).length,
  );
  const sharedUploadQueue = hasNamedVariantUploads
    ? []
    : [...arr(req.files?.mainImage), ...arr(req.files?.galleryImages)];

  return Promise.all(
    variants.map(async (variant, index) => {
      const existing =
        existingVariants[index] ||
        existingVariants.find((item) => str(item?.name) === str(variant?.name)) ||
        null;
      const bodyImages = parseVariantImageUrls(variant?.images).filter(
        (url) => !url.startsWith("data:"),
      );
      let uploads = arr(req.files?.[`variantImages_${index}`]);
      if (!uploads.length && sharedUploadQueue.length) {
        const requested = Math.max(0, Number(variant?.imageFileCount) || 0);
        const remainingNeedCount = variants.slice(index).filter((item) => {
          const existingUrls = parseVariantImageUrls(item?.images).filter(
            (url) => !String(url).startsWith("data:"),
          ).length;
          return existingUrls < MIN_VARIANT_IMAGES || Number(item?.imageFileCount) > 0;
        }).length;
        const fairShare =
          remainingNeedCount > 0
            ? Math.ceil(sharedUploadQueue.length / remainingNeedCount)
            : 0;
        const take = Math.min(
          MAX_VARIANT_IMAGES - bodyImages.length,
          requested || fairShare,
          sharedUploadQueue.length,
        );
        uploads = sharedUploadQueue.splice(0, Math.max(0, take));
      }

      for (const file of uploads) {
        const imageError = validateCategoryImageFile(file);
        if (imageError) {
          const err = new Error(imageError);
          err.statusCode = 400;
          throw err;
        }
      }

      const uploadedUrls = uploads.length
        ? await Promise.all(
            uploads
              .filter((file) => file?.buffer)
              .map((file) =>
                uploadImageBuffer(file.buffer, "quick-commerce/products/variants"),
              ),
          )
        : [];

      const imagesProvided =
        variant?.images !== undefined || uploads.length > 0;

      let merged = [...bodyImages, ...uploadedUrls]
        .filter(Boolean)
        .filter((url, idx, all) => all.indexOf(url) === idx);

      if (!imagesProvided && arr(existing?.images).length) {
        merged = arr(existing.images).map((url) => str(url)).filter(Boolean);
      }

      const { imageFileCount: _imageFileCount, ...variantRest } = variant || {};

      return {
        ...variantRest,
        images: merged.slice(0, MAX_VARIANT_IMAGES),
      };
    }),
  );
};

const deriveProductImagesFromVariants = (variants = []) => {
  const allImages = variants
    .flatMap((variant) => arr(variant?.images))
    .map((url) => str(url))
    .filter(Boolean)
    .filter((url, idx, all) => all.indexOf(url) === idx);
  const firstVariantImages = arr(variants[0]?.images)
    .map((url) => str(url))
    .filter(Boolean);

  return {
    mainImage: firstVariantImages[0] || allImages[0] || "",
    galleryImages: allImages.slice(firstVariantImages[0] ? 1 : 0),
  };
};

const validateProductPricing = (payload = {}) => {
  const variants = arr(payload.variants);
  if (!variants.length) {
    return "Add at least one variant with name, price, and stock";
  }
  if (variants.length > MAX_PRODUCT_VARIANTS) {
    return `Maximum ${MAX_PRODUCT_VARIANTS} variants allowed per product`;
  }

  for (const variant of variants) {
    const name = str(variant?.name);
    const variantPrice = num(variant?.price);
    const variantSale = num(variant?.salePrice);
    const variantStock = num(variant?.stock);
    const variantImages = arr(variant?.images).map((url) => str(url)).filter(Boolean);
    if (!name) {
      return "Each variant needs a name (e.g. 1kg, 500ml)";
    }
    if (!(variantPrice > 0)) {
      return `Variant "${name || "item"}": price must be greater than 0`;
    }
    if (variantStock < 0 || !Number.isFinite(variantStock)) {
      return `Variant "${name}": stock must be 0 or more`;
    }
    if (variantSale > 0 && variantSale > variantPrice) {
      return `Variant "${name}": sale price (₹${variantSale}) cannot be higher than price (₹${variantPrice})`;
    }
    if (variantImages.length < MIN_VARIANT_IMAGES) {
      return `Variant "${name}": add at least ${MIN_VARIANT_IMAGES} photo`;
    }
    if (variantImages.length > MAX_VARIANT_IMAGES) {
      return `Variant "${name}": maximum ${MAX_VARIANT_IMAGES} photos allowed`;
    }
  }

  return null;
};

/** OTP signup seeds a unique `@seller.local` email and used to seed "Seller 1234" names.
 *  Those must never show up as if the seller typed them. */
const isSystemPlaceholderEmail = (email = "") =>
  String(email).toLowerCase().includes("@seller.local");

const isSystemPlaceholderName = (name = "") =>
  /^Seller(\s+\d+)?$/i.test(String(name || "").trim());

const isSystemPlaceholderShopName = (shopName = "") =>
  /^Store(\s+\d+)?$/i.test(String(shopName || "").trim());

const publicSellerName = (seller) =>
  isSystemPlaceholderName(seller?.name) ? "" : seller?.name || "";

const publicSellerShopName = (seller) =>
  isSystemPlaceholderShopName(seller?.shopName) ? "" : seller?.shopName || "";

const publicSellerEmail = (seller) =>
  isSystemPlaceholderEmail(seller?.email) ? "" : seller?.email || "";

const serializeSellerAuthSession = (seller) => ({
  _id: seller._id,
  name: publicSellerName(seller),
  shopName: publicSellerShopName(seller),
  phone: seller.phoneLast10 || seller.phone || "",
  email: publicSellerEmail(seller),
  approved: seller.approved !== false,
  approvalStatus:
    seller.approvalStatus ||
    (seller.approved === false ? "pending" : "approved"),
  onboardingSubmitted: seller.onboardingSubmitted === true,
  approvalNotes: seller.approvalNotes || "",
});

const serializeSellerProfile = (seller) => ({
  _id: seller._id,
  name: publicSellerName(seller),
  shopName: publicSellerShopName(seller),
  phone: seller.phoneLast10 || seller.phone || "",
  email: publicSellerEmail(seller),
  role: "Seller",
  isActive: seller.isActive !== false,
  isVerified: seller.isVerified !== false,
  approved: seller.approved !== false,
  approvalStatus:
    seller.approvalStatus ||
    (seller.approved === false ? "pending" : "approved"),
  onboardingSubmitted: seller.onboardingSubmitted === true,
  approvalNotes: seller.approvalNotes || "",
  approvedAt: seller.approvedAt || null,
  rejectedAt: seller.rejectedAt || null,
  location: seller.location || null,
  address: seller.location?.formattedAddress || seller.location?.address || "",
  rating: num(seller.rating, 0),
  totalRatings: num(seller.totalRatings, 0),
  bankInfo: {
    bankName: seller.bankInfo?.bankName || "",
    accountHolderName: seller.bankInfo?.accountHolderName || "",
    accountNumber: seller.bankInfo?.accountNumber || "",
    ifscCode: seller.bankInfo?.ifscCode || "",
    accountType: seller.bankInfo?.accountType || "",
    upiId: seller.bankInfo?.upiId || "",
    upiQrImage: seller.bankInfo?.upiQrImage || "",
  },
  documents: {
    panNumber: seller.documents?.panNumber || "",
    gstRegistered: seller.documents?.gstRegistered === true,
    gstNumber: seller.documents?.gstNumber || "",
    gstLegalName: seller.documents?.gstLegalName || "",
    fssaiNumber: seller.documents?.fssaiNumber || "",
    fssaiImage: seller.documents?.fssaiImage || "",
    fssaiExpiry: seller.documents?.fssaiExpiry || null,
    medicalLicenseNumber: seller.documents?.medicalLicenseNumber || "",
    medicalLicenseImage: seller.documents?.medicalLicenseImage || "",
    medicalLicenseExpiry: seller.documents?.medicalLicenseExpiry || null,
    shopLicenseNumber: seller.documents?.shopLicenseNumber || "",
    shopLicenseImage: seller.documents?.shopLicenseImage || "",
    shopLicenseExpiry: seller.documents?.shopLicenseExpiry || null,
    isDocumentsVerified: seller.documents?.isDocumentsVerified === true,
  },
  shopInfo: {
    businessType: seller.shopInfo?.businessType || "",
    alternatePhone: seller.shopInfo?.alternatePhone || "",
    supportEmail: seller.shopInfo?.supportEmail || "",
    openingHours: seller.shopInfo?.openingHours || "",
    zoneId: seller.shopInfo?.zoneId || null,
    zoneSource: seller.shopInfo?.zoneSource || "",
    zoneName: seller.shopInfo?.zoneName || "",
    shopImage: seller.shopInfo?.shopImage || "",
  },
  wasEverApproved: seller.wasEverApproved === true,
  hasPendingProfileUpdate: seller.pendingProfileChanges?.hasPendingUpdate === true,
  pendingProfileChanges: serializeSellerPendingProfileChanges(seller),
});

const objectIdOrNull = (value) =>
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const toDataUrl = (file) =>
  file ? `data:${file.mimetype};base64,${file.buffer.toString("base64")}` : "";

const parseTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseVariants = (raw, fallback = {}) => {
  let parsed = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }

  const variants = arr(parsed)
    .map((variant, index) => ({
      name: str(variant?.name) || `Variant ${index + 1}`,
      price: num(variant?.price, fallback.price),
      salePrice: num(variant?.salePrice, fallback.salePrice),
      stock: Math.max(0, num(variant?.stock, fallback.stock)),
      // Leave blank — assignUniqueVariantSkus fills parent-based unique codes.
      sku: str(variant?.sku),
      images: parseVariantImageUrls(variant?.images).slice(0, MAX_VARIANT_IMAGES),
      imageFileCount: Math.max(0, Number(variant?.imageFileCount) || 0),
      // Pharmacy-only optional metadata (will be stripped for non-pharmacy sellers).
      ...sanitizePharmacyVariantMeta(variant),
    }))
    .filter((variant) => variant.name);

  return variants;
};

const populateProductQuery = (query) =>
  query
    .populate("headerId", "name")
    .populate("categoryId", "name")
    .populate("subcategoryId", "name");

const serializeProduct = (product) => {
  if (!product) return null;
  const doc =
    typeof product.toObject === "function"
      ? product.toObject({ virtuals: true })
      : { ...product };

  const variants = arr(doc.variants).map((variant) => {
    const cleaned = { ...(variant?.toObject?.() || variant) };
    if (!str(cleaned.strength)) delete cleaned.strength;
    if (!str(cleaned.packType)) delete cleaned.packType;
    if (!num(cleaned.packQuantity)) delete cleaned.packQuantity;
    if (!str(cleaned.unit)) delete cleaned.unit;
    return cleaned;
  });

  return {
    ...doc,
    variants,
    id: doc._id,
  };
};

const sellerScope = (req) => req.user?.userId;

const isOrphanDraftSeller = (seller) => {
  if (!seller || seller.onboardingSubmitted === true) return false;
  if (String(seller.approvalStatus || "") !== "draft") return false;
  if (str(seller.shopInfo?.businessType)) return false;
  if (seller.shopInfo?.zoneId) return false;
  if (str(seller.documents?.panNumber)) return false;
  if (str(seller.documents?.shopLicenseNumber)) return false;
  if (str(seller.bankInfo?.accountNumber)) return false;
  if (seller.location?.latitude != null || seller.location?.coordinates?.length) {
    return false;
  }
  return true;
};

const findSellerByPhone = async (phone) => {
  const digits = normalizePhone(phone);
  const phoneSuffix = digits.slice(-10);
  const matches = await Seller.find({
    $or: [
      { phoneDigits: digits },
      ...(phoneSuffix ? [{ phoneLast10: phoneSuffix }] : []),
      { phone },
      { alternatePhoneDigits: digits },
      ...(phoneSuffix ? [{ alternatePhoneLast10: phoneSuffix }] : []),
    ],
  })
    .sort({
      approved: -1,
      onboardingSubmitted: -1,
      createdAt: -1,
    })
    .limit(1)
    .exec();

  return matches[0] || null;
};

const resolveSellerFromRequest = async (req) => {
  if (req.user?.userId) {
    return Seller.findById(req.user.userId);
  }
  if (req.sellerOnboarding) {
    return findSellerByPhone(
      req.sellerOnboarding.phoneDigits || req.sellerOnboarding.phone,
    );
  }
  return null;
};

const sellerHasOnboardingIntent = (body = {}, files = {}) => {
  const keys = [
    "businessType",
    "name",
    "shopName",
    "email",
    "zoneId",
    "zoneSource",
    "zoneName",
    "lat",
    "lng",
    "address",
    "alternatePhone",
    "supportEmail",
    "openingHours",
    "bankName",
    "accountNumber",
    "ifscCode",
    "upiId",
    "panNumber",
    "gstNumber",
    "fssaiNumber",
    "medicalLicenseNumber",
    "shopLicenseNumber",
    "submitForApproval",
  ];
  if (keys.some((key) => str(body?.[key]))) return true;
  return Object.values(files).some(
    (entries) => Array.isArray(entries) && entries[0]?.buffer,
  );
};

const createSellerFromOnboarding = async (onboarding = {}, body = {}) => {
  const digits = normalizePhone(onboarding.phoneDigits || onboarding.phone);
  const phoneSuffix = digits.slice(-10);
  const suffix = phoneSuffix || digits || Date.now().toString().slice(-4);
  const phone =
    str(body.phone) ||
    (phoneSuffix ? `+91 ${phoneSuffix}` : String(onboarding.phone || ""));

  return Seller.create({
    name: str(body.name) || "",
    shopName: str(body.shopName) || "",
    phone,
    phoneDigits: digits,
    phoneLast10: phoneSuffix,
    email: str(body.email).toLowerCase() || `seller${suffix}@seller.local`,
    isVerified: true,
    isActive: true,
    approved: false,
    approvalStatus: "draft",
    onboardingSubmitted: false,
    lastLogin: new Date(),
  });
};

const buildEmptySellerProfile = (onboarding = {}) => {
  const phoneLast10 =
    onboarding.phoneLast10 || normalizePhone(onboarding.phone).slice(-10);
  return {
    _id: null,
    name: "",
    shopName: "",
    phone: phoneLast10 || onboarding.phone || "",
    email: "",
    role: "Seller",
    isActive: true,
    isVerified: true,
    approved: false,
    approvalStatus: "draft",
    onboardingSubmitted: false,
    approvalNotes: "",
    location: null,
    address: "",
    bankInfo: {
      bankName: "",
      accountHolderName: "",
      accountNumber: "",
      ifscCode: "",
      accountType: "",
      upiId: "",
      upiQrImage: "",
    },
    documents: {
      panNumber: "",
      gstRegistered: false,
      gstNumber: "",
      gstLegalName: "",
      fssaiNumber: "",
      fssaiImage: "",
      fssaiExpiry: null,
      medicalLicenseNumber: "",
      medicalLicenseImage: "",
      medicalLicenseExpiry: null,
      shopLicenseNumber: "",
      shopLicenseImage: "",
      shopLicenseExpiry: null,
      isDocumentsVerified: false,
    },
    shopInfo: {
      businessType: "",
      alternatePhone: "",
      supportEmail: "",
      openingHours: "",
      zoneId: null,
      zoneSource: "",
      zoneName: "",
      shopImage: "",
    },
    wasEverApproved: false,
    hasPendingProfileUpdate: false,
    pendingProfileChanges: null,
  };
};

const reconcileSellerDeliveredOrders = async (sellerId) => {
  // Backfill: if parent quick order is delivered/cancelled but seller leg didn't update, fix it.
  const candidates = await SellerOrder.find({
    sellerId,
    status: {
      $in: [
        "pending",
        "confirmed",
        "packed",
        "ready_for_pickup",
        "out_for_delivery",
      ],
    },
  })
    .select("_id orderId parentOrderId status workflowStatus deliveredAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  if (!candidates.length) return;

  const parentIds = candidates
    .map((o) => o.parentOrderId)
    .filter(Boolean)
    .map((id) => String(id));

  const parentOrders = parentIds.length
    ? await QuickOrder.find({ _id: { $in: parentIds } })
      .select("_id orderId orderStatus workflowStatus updatedAt pricing.subtotal pricing.packagingFee")
      .lean()
    : [];

  const parentMap = new Map(parentOrders.map((p) => [String(p._id), p]));

  const updates = [];
  for (const so of candidates) {
    const parent = so.parentOrderId
      ? parentMap.get(String(so.parentOrderId))
      : null;
    const parentStatus = String(parent?.orderStatus || "").toLowerCase();
    if (!parent || !parentStatus) continue;

    if (parentStatus === "delivered") {
      updates.push({
        id: so._id,
        patch: {
          status: "delivered",
          workflowStatus: "DELIVERED",
          deliveredAt: so.deliveredAt || parent.updatedAt || new Date(),
        },
      });
    } else if (parentStatus.startsWith("cancelled")) {
      updates.push({
        id: so._id,
        patch: {
          status: "cancelled",
          workflowStatus: "CANCELLED",
        },
      });
    }
  }

  if (!updates.length) return;

  // Batch the status patches into a single round-trip.
  await SellerOrder.bulkWrite(
    updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id, sellerId },
        update: { $set: u.patch },
      },
    })),
  );

  // Best-effort: also ensure Order Payment transactions exist for newly-delivered legs.
  const deliveredIds = updates
    .filter((u) => u.patch.status === "delivered")
    .map((u) => String(u.id));
  if (deliveredIds.length) {
    const deliveredOrders = await SellerOrder.find({
      _id: { $in: deliveredIds },
      sellerId,
    })
      .select("orderId customer parentOrderId pricing deliveredAt updatedAt createdAt")
      .lean();

    const paymentOps = deliveredOrders
      .map((o) => {
        const baseReceivable = resolveSellerReceivable(o?.pricing);
        // If this SellerOrder doc doesn't have packingFee stored, allocate parent packagingFee at delivery-time.
        const packingFeeStored = Number(o?.pricing?.packingFee || 0);
        let receivable = baseReceivable;
        if (!(packingFeeStored > 0) && o?.parentOrderId) {
          const parent = parentMap.get(String(o.parentOrderId));
          const parentPackingFee = Number(parent?.pricing?.packagingFee || 0);
          const parentSubtotal = Number(parent?.pricing?.subtotal || 0);
          const sellerSubtotal = Number(o?.pricing?.subtotal || 0);
          const allocatedPackingFee =
            parentSubtotal > 0
              ? Number(((parentPackingFee * sellerSubtotal) / parentSubtotal).toFixed(2))
              : parentPackingFee;
          receivable = baseReceivable + allocatedPackingFee;
        }

        if (!Number.isFinite(receivable) || receivable <= 0) return null;

        return {
          updateOne: {
            filter: {
              sellerId,
              type: "Order Payment",
              orderId: String(o.orderId || "").trim(),
            },
            update: {
              $set: {
                amount: receivable,
                status: "Settled",
                reference: String(o.orderId || "").trim(),
                customer: o?.customer?.name || "Customer",
                createdAt:
                  o?.deliveredAt || o?.updatedAt || o?.createdAt || new Date(),
              },
              $setOnInsert: {
                sellerId,
                type: "Order Payment",
                orderId: String(o.orderId || "").trim(),
                reason: "",
              },
            },
            upsert: true,
            setDefaultsOnInsert: true,
          },
        };
      })
      .filter(Boolean);

    if (paymentOps.length) {
      await SellerTransaction.bulkWrite(paymentOps);
    }
  }
};

const parseProductPayload = async (req, existingProduct = null) => {
  const mainUpload = arr(req.files?.mainImage)[0];
  const galleryUploads = arr(req.files?.galleryImages);

  let bodyGallery = [];
  if (req.body?.galleryImages) {
    if (Array.isArray(req.body.galleryImages)) {
      bodyGallery = req.body.galleryImages.map(img => String(img || "").trim()).filter(Boolean);
    } else if (typeof req.body.galleryImages === "string") {
      try {
        const parsed = JSON.parse(req.body.galleryImages);
        if (Array.isArray(parsed)) {
          bodyGallery = parsed.map(img => String(img || "").trim()).filter(Boolean);
        } else if (parsed && typeof parsed === "string") {
          bodyGallery = parsed.split(",").map(img => img.trim()).filter(Boolean);
        }
      } catch {
        bodyGallery = req.body.galleryImages.split(",").map(img => img.trim()).filter(Boolean);
      }
    }
  }

  let variants = parseVariants(req.body?.variants, {
    price: req.body?.price,
    salePrice: req.body?.salePrice,
    stock: req.body?.stock,
    sku: req.body?.sku,
    weight: req.body?.weight,
  });
  variants = await enrichVariantsWithImages(req, variants, existingProduct);
  const firstVariant = variants[0] || {};
  const derivedImages = deriveProductImagesFromVariants(variants);

  let pharmacyDetails = {};
  try {
    pharmacyDetails = req.body?.pharmacyDetails
      ? (typeof req.body.pharmacyDetails === 'string' ? JSON.parse(req.body.pharmacyDetails) : req.body.pharmacyDetails)
      : existingProduct?.pharmacyDetails || {};
  } catch (err) {
    pharmacyDetails = existingProduct?.pharmacyDetails || {};
  }

  // Variant photos are already uploaded in enrichVariantsWithImages.
  // Only upload leftover cover/gallery files if variants did not produce images.
  const uploadedMainImage =
    derivedImages.mainImage || !mainUpload?.buffer
      ? ""
      : await uploadImageBuffer(mainUpload.buffer, "quick-commerce/products/main");

  const uploadedGallery =
    derivedImages.galleryImages.length || !galleryUploads.length
      ? []
      : await Promise.all(
          galleryUploads
            .filter((f) => f?.buffer)
            .map((file) =>
              uploadImageBuffer(file.buffer, "quick-commerce/products/gallery"),
            ),
        );

  const galleryProvided = req.body?.galleryImages !== undefined;
  const galleryImages = galleryProvided
    ? [...bodyGallery, ...uploadedGallery]
        .filter(Boolean)
        .filter((url, idx, all) => all.indexOf(url) === idx)
    : derivedImages.galleryImages.length
      ? derivedImages.galleryImages
      : [...bodyGallery, ...uploadedGallery, ...arr(existingProduct?.galleryImages)]
          .filter(Boolean)
          .filter((url, idx, all) => all.indexOf(url) === idx);

  const resolvedMainImage =
    uploadedMainImage ||
    str(req.body?.mainImage) ||
    derivedImages.mainImage ||
    existingProduct?.mainImage ||
    "";

  const price = variants.length
    ? num(firstVariant?.price, 0)
    : num(req.body?.price, existingProduct?.price ?? 0);
  const salePrice = variants.length
    ? num(firstVariant?.salePrice, 0)
    : num(req.body?.salePrice, existingProduct?.salePrice ?? 0);
  // MRP is the list price — never default it to the discounted salePrice alone.
  const mrp = num(
    req.body?.mrp,
    Math.max(price, salePrice, num(existingProduct?.mrp, 0)),
  );

  const stockFromVariants = variants.length
    ? variants.reduce((sum, variant) => sum + Math.max(0, num(variant?.stock)), 0)
    : null;

  const productSku =
    str(req.body?.sku) ||
    existingProduct?.sku ||
    createSellerSku();

  return {
    name: str(req.body?.name) || existingProduct?.name || "Untitled Product",
    slug:
      slugify(
        str(req.body?.slug) || str(req.body?.name) || existingProduct?.slug,
      ) || slugify(existingProduct?.name),
    sku: productSku,
    description:
      str(req.body?.description) || existingProduct?.description || "",
    price,
    salePrice,
    stock: Math.max(
      0,
      stockFromVariants != null
        ? stockFromVariants
        : num(req.body?.stock, existingProduct?.stock ?? 0),
    ),
    lowStockAlert: Math.max(
      0,
      num(req.body?.lowStockAlert, existingProduct?.lowStockAlert ?? 5),
    ),
    brand: str(req.body?.brand) || existingProduct?.brand || "",
    weight: str(req.body?.weight) || existingProduct?.weight || "",
    tags: parseTags(req.body?.tags ?? existingProduct?.tags),
    mainImage: resolvedMainImage,
    image:
      resolvedMainImage ||
      existingProduct?.image ||
      "",
    galleryImages,
    mrp,
    unit:
      str(req.body?.unit) ||
      str(req.body?.weight) ||
      str(firstVariant?.name) ||
      existingProduct?.unit ||
      "",
    status:
      str(req.body?.status).toLowerCase() === "inactive"
        ? "inactive"
        : "active",
    isActive: str(req.body?.status).toLowerCase() === "inactive" ? false : true,
    approvalStatus: existingProduct?.approvalStatus || "approved",
    approvedAt:
      (existingProduct?.approvalStatus || "approved") === "approved"
        ? existingProduct?.approvedAt || new Date()
        : null,
    variants: assignUniqueVariantSkus(variants, productSku),
    pharmacyDetails,
    packingFee: num(req.body?.packingFee, existingProduct?.packingFee ?? 0),
  };
};

const createAuthTokens = async (sellerId) => {
  const payload = { userId: String(sellerId), role: "SELLER" };
  const accessToken = signAccessToken(payload);
  const familyId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ ...payload, familyId });
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: sellerId,
    token: refreshToken,
    familyId,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

const availableWithdrawalBalance = (transactions) => {
  const totalRevenue = transactions
    .filter((item) => item.type === "Order Payment")
    .reduce((sum, item) => sum + num(item.amount), 0);
  const totalWithdrawn = transactions
    .filter((item) => item.type === "Withdrawal" && item.status === "Settled")
    .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);
  const pendingPayouts = transactions
    .filter(
      (item) =>
        item.type === "Withdrawal" &&
        ["Pending", "Processing"].includes(String(item.status || "")),
    )
    .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

  return Math.max(0, totalRevenue - totalWithdrawn - pendingPayouts);
};

const monthlyRevenueChart = (transactions) => {
  const buckets = new Map();
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.set(`${date.getFullYear()}-${date.getMonth()}`, {
      name: date.toLocaleDateString("en-IN", { month: "short" }),
      revenue: 0,
    });
  }

  transactions
    .filter((item) => item.type === "Order Payment")
    .forEach((item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const bucket = buckets.get(
        `${createdAt.getFullYear()}-${createdAt.getMonth()}`,
      );
      if (bucket) {
        bucket.revenue += num(item.amount);
      }
    });

  return Array.from(buckets.values());
};

const monthlyRevenueChartFromOrders = (orders) => {
  const buckets = new Map();
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.set(`${date.getFullYear()}-${date.getMonth()}`, {
      name: date.toLocaleDateString("en-IN", { month: "short" }),
      revenue: 0,
    });
  }

  (Array.isArray(orders) ? orders : []).forEach((order) => {
    const effectiveAt =
      order?.deliveredAt || order?.updatedAt || order?.createdAt;
    const when = effectiveAt ? new Date(effectiveAt) : null;
    if (!when || Number.isNaN(when.getTime())) return;

    const bucket = buckets.get(`${when.getFullYear()}-${when.getMonth()}`);
    if (!bucket) return;

    const receivable = resolveSellerReceivable(order?.pricing);
    bucket.revenue += num(receivable);
  });

  return Array.from(buckets.values());
};

const serializeLedger = (transactions) =>
  transactions.map((item) => ({
    id: item.reference || String(item._id),
    type: item.type,
    amount: item.amount,
    status: item.status,
    date: item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("en-IN")
      : "",
    time: item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
      : "",
    customer:
      item.type === "Withdrawal"
        ? item.customer || "Bank Transfer"
        : item.customer || "Customer",
    method:
      item.paymentMethod || (item.bankDetails?.upiId ? "UPI" : "Bank Transfer"),
    bankDetails: item.bankDetails || null,
    processedAt: item.processedAt || null,
    ref: item.orderId || item.reference || String(item._id),
    reason: item.reason || "",
    createdAt: item.createdAt,
  }));

export const requestSellerOtpController = async (req, res) => {
  try {
    const phone = str(req.body?.phone);
    const digits = normalizePhone(phone);
    const phoneSuffix = digits.slice(-10);

    if (phoneSuffix.length !== 10) {
      return sendError(res, 400, "Enter a valid 10-digit phone number");
    }

    // Persist OTP against last-10 + E.164 forms so verify matches login phone formats.
    const otpPhone = `+91${phoneSuffix}`;
    const otp = await createOrUpdateOtp(otpPhone);
    const hasSmsProvider = Boolean(config.smsApiKey && config.smsSenderId);
    const isLocalRequest = ["localhost", "127.0.0.1", "::1"].includes(
      String(req.hostname || "").toLowerCase(),
    );
    const shouldExposeOtp =
      config.nodeEnv !== "production" ||
      config.useDefaultOtp ||
      (!hasSmsProvider && isLocalRequest);

    return sendResponse(res, 200, "OTP sent successfully", {
      phone: `+91 ${phoneSuffix}`,
      deliveryMode: hasSmsProvider ? "sms" : (shouldExposeOtp ? "debug" : "sms"),
      ...(shouldExposeOtp ? { otp } : {}),
    });
  } catch (error) {
    logger.error(`Seller request OTP failed: ${error.message}`);
    return sendError(res, 400, error.message || "Failed to send OTP");
  }
};

export const verifySellerOtpController = async (req, res) => {
  try {
    const phone = str(req.body?.phone);
    const otp = str(req.body?.otp);

    if (!phone || !otp) {
      return sendError(res, 400, "Phone and OTP are required");
    }

    const verification = await verifyOtp(phone, otp);
    if (!verification.valid) {
      return sendError(
        res,
        401,
        verification.reason || "OTP verification failed",
      );
    }

    const digits = normalizePhone(phone);
    const phoneSuffix = digits.slice(-10);
    
    // A seller registers two numbers during onboarding and signs in with either of them.
    const allSellers = await Seller.find({
      $or: [
        { phoneDigits: digits },
        ...(phoneSuffix ? [{ phoneLast10: phoneSuffix }] : []),
        { phone },
        { alternatePhoneDigits: digits },
        ...(phoneSuffix ? [{ alternatePhoneLast10: phoneSuffix }] : []),
      ],
    }).sort({ 
      // Prefer: approved > pending > draft, and onboarded > not, and newer > older
      approved: -1, 
      onboardingSubmitted: -1, 
      createdAt: -1 
    });

    let seller = allSellers[0]; // Take the first one (preferred one)

    if (seller && isOrphanDraftSeller(seller)) {
      await Seller.deleteOne({ _id: seller._id });
      seller = null;
    }

    if (!seller) {
      const registrationToken = signSellerRegistrationToken(phone);
      return sendResponse(res, 200, "OTP verified. Continue seller onboarding.", {
        accessToken: registrationToken,
        registrationToken,
        needsOnboarding: true,
        seller: {
          phone: phoneSuffix || phone,
          approved: false,
          approvalStatus: "draft",
          onboardingSubmitted: false,
        },
      });
    } else {
      if (seller.isActive === false || seller.isDeleted === true || seller.accountStatus === 'deleted') {
        return sendError(
          res,
          403,
          "Your account has been deleted/deactivated. Please contact support."
        );
      }
      
      // Backfill phoneDigits and phoneLast10 if they're missing
      if (!seller.phoneDigits || !seller.phoneLast10) {
        seller.phoneDigits = digits;
        seller.phoneLast10 = phoneSuffix;
      }
      
      seller.isVerified = true;
      seller.lastLogin = new Date();
      await seller.save();
    }

    const { accessToken, refreshToken } = await createAuthTokens(seller._id);

    return sendResponse(res, 200, "Seller login successful", {
      accessToken,
      refreshToken,
      seller: serializeSellerAuthSession(seller),
    });
  } catch (error) {
    return sendError(res, 400, error.message || "OTP verification failed");
  }
};

export const getSellerCategoryTreeController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const seller = await Seller.findById(sellerId).select("shopInfo.businessType").lean();
    const sellerBusinessType = normalizeBusinessType(seller?.shopInfo?.businessType);
    const tree = await buildSellerCategoryTree(sellerBusinessType);
    return res.json({ success: true, result: tree });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load categories");
  }
};

export const getSellerProductsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const page = Math.max(1, num(req.query?.page, 1));
    const limit = Math.max(1, Math.min(100, num(req.query?.limit, 20)));
    const skip = (page - 1) * limit;
    const stockStatus = str(req.query?.stockStatus).toLowerCase();
    const status = str(req.query?.status).toLowerCase();
    const search = str(req.query?.search || req.query?.q).trim();
    const categoryId = str(req.query?.categoryId || req.query?.category);
    const minPrice = optionalNumber(req.query?.minPrice);
    const maxPrice = optionalNumber(req.query?.maxPrice);

    const query = { sellerId };
    const exprAnd = [];

    if (status === "active" || status === "inactive") {
      query.status = status;
      query.isActive = status === "active";
    }

    if (mongoose.isValidObjectId(categoryId)) {
      query.$or = [
        { categoryId },
        { subcategoryId: categoryId },
        { headerId: categoryId },
      ];
    }

    if (search) {
      const term = escapeRegex(search.slice(0, 80));
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: term, $options: "i" } },
            { sku: { $regex: term, $options: "i" } },
            { brand: { $regex: term, $options: "i" } },
            { "variants.sku": { $regex: term, $options: "i" } },
          ],
        },
      ];
    }

    if (minPrice !== null || maxPrice !== null) {
      exprAnd.push({
        $let: {
          vars: {
            effectivePrice: {
              $cond: [
                { $gt: [{ $ifNull: ["$salePrice", 0] }, 0] },
                "$salePrice",
                { $ifNull: ["$price", 0] },
              ],
            },
          },
          in: {
            $and: [
              ...(minPrice !== null
                ? [{ $gte: ["$$effectivePrice", minPrice] }]
                : []),
              ...(maxPrice !== null
                ? [{ $lte: ["$$effectivePrice", maxPrice] }]
                : []),
            ],
          },
        },
      });
    }

    // Variant-aware stock filters (parent stock alone is unreliable).
    if (stockStatus === "in") {
      exprAnd.push({ $gt: [effectiveStockExpr, 0] });
    } else if (stockStatus === "out") {
      exprAnd.push({ $eq: [effectiveStockExpr, 0] });
    } else if (stockStatus === "low") {
      exprAnd.push({
        $and: [
          { $gt: [effectiveStockExpr, 0] },
          { $lte: [effectiveStockExpr, 10] },
        ],
      });
    }

    if (exprAnd.length) {
      query.$expr = { $and: exprAnd };
    }

    const [items, total] = await Promise.all([
      populateProductQuery(
        SellerProduct.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
      ).lean(),
      SellerProduct.countDocuments(query),
    ]);

    return res.json({
      success: true,
      result: {
        items: items.map(serializeProduct),
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load products");
  }
};

export const getSellerProductByIdController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const { productId } = req.params;

    const product = await populateProductQuery(
      SellerProduct.findOne({ _id: productId, sellerId }),
    ).lean();

    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    return res.json({ success: true, result: serializeProduct(product) });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load product");
  }
};

export const createSellerProductController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const clientRequestId = str(req.body?.clientRequestId);
    if (clientRequestId) {
      const existingByRequest = await SellerProduct.findOne({
        sellerId,
        clientRequestId,
      }).lean();
      if (existingByRequest) {
        const populated = await populateProductQuery(
          SellerProduct.findById(existingByRequest._id),
        ).lean();
        return res.status(200).json({
          success: true,
          result: serializeProduct(populated),
          reused: true,
        });
      }
    }

    const seller = await Seller.findById(sellerId).select("shopInfo.businessType approvalStatus").lean();
    const sellerBusinessType = normalizeBusinessType(seller?.shopInfo?.businessType);

    const basePayload = await parseProductPayload(req);
    const pricingError = validateProductPricing(basePayload);
    if (pricingError) {
      return sendError(res, 400, pricingError);
    }
    // Pharmacy has been retired: ignore any pharmacyDetails sent by mistake.
    basePayload.pharmacyDetails = {};
    basePayload.variants = arr(basePayload.variants).map(stripPharmacyVariantMeta);

    if (basePayload.variants && basePayload.variants.length > 0) {
      basePayload.stock = basePayload.variants.reduce(
        (sum, v) => sum + (Number(v.stock) || 0),
        0,
      );
      const first = basePayload.variants[0] || {};
      basePayload.price = Number(first.price) || 0;
      basePayload.salePrice = Number(first.salePrice) || 0;
      basePayload.mrp = Math.max(
        Number(basePayload.price) || 0,
        Number(basePayload.salePrice) || 0,
        Number(basePayload.mrp) || 0,
      );
    }

    const categoryIds = await resolveSellerCategoryIds({
      headerId: req.body?.headerId,
      categoryId: req.body?.categoryId,
      subcategoryId: req.body?.subcategoryId,
      allowDefaultFallback: false,
      sellerBusinessType,
    });

    const sellerApproved = seller?.approvalStatus === "approved";
    basePayload.approvalStatus = sellerApproved ? "approved" : "pending";
    basePayload.approvedAt = sellerApproved ? new Date() : null;
    basePayload.isActive = basePayload.status === "active";

    const product = await SellerProduct.create({
      sellerId,
      ...basePayload,
      ...categoryIds,
      ...(clientRequestId ? { clientRequestId } : {}),
    });

    await syncSellerInventoryNotification(sellerId, product);

    const populated = await populateProductQuery(
      SellerProduct.findById(product._id),
    ).lean();

    return res
      .status(201)
      .json({ success: true, result: serializeProduct(populated) });
  } catch (error) {
    if (error?.statusCode === 400) {
      return sendError(res, 400, error.message);
    }
    if (error?.code === 11000) {
      const sellerId = sellerScope(req);
      const clientRequestId = str(req.body?.clientRequestId);
      if (clientRequestId) {
        const existingByRequest = await SellerProduct.findOne({
          sellerId,
          clientRequestId,
        }).lean();
        if (existingByRequest) {
          const populated = await populateProductQuery(
            SellerProduct.findById(existingByRequest._id),
          ).lean();
          return res.status(200).json({
            success: true,
            result: serializeProduct(populated),
            reused: true,
          });
        }
      }
      const keys = error.keyPattern ? Object.keys(error.keyPattern) : [];
      const slug = slugify(str(req.body?.slug) || str(req.body?.name));
      if (keys.includes("slug") && slug) {
        const existingBySlug = await SellerProduct.findOne({
          sellerId,
          slug,
        }).lean();
        if (existingBySlug) {
          const populated = await populateProductQuery(
            SellerProduct.findById(existingBySlug._id),
          ).lean();
          return res.status(200).json({
            success: true,
            result: serializeProduct(populated),
            reused: true,
          });
        }
        return sendError(res, 400, "Product slug already exists in your store");
      }
      if (keys.includes("sku")) {
        return sendError(res, 400, "SKU already exists in your store");
      }
      return sendError(res, 400, "Product slug or SKU already exists in your store");
    }
    return sendError(res, 500, error.message || "Failed to create product");
  }
};

export const updateSellerProductController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const { productId } = req.params;
    const existing = await SellerProduct.findOne({ _id: productId, sellerId });
    if (!existing) {
      return sendError(res, 404, "Product not found");
    }

    const seller = await Seller.findById(sellerId).select("shopInfo.businessType").lean();
    const sellerBusinessType = normalizeBusinessType(seller?.shopInfo?.businessType);

    const categoryIds = await resolveSellerCategoryIds({
      headerId: req.body?.headerId || existing.headerId,
      categoryId: req.body?.categoryId || existing.categoryId,
      subcategoryId: req.body?.subcategoryId || existing.subcategoryId,
      allowDefaultFallback: false,
      sellerBusinessType,
    });

    const payload = await parseProductPayload(req, existing);
    const pricingError = validateProductPricing(payload);
    if (pricingError) {
      return sendError(res, 400, pricingError);
    }
    // Pharmacy has been retired: ignore any pharmacyDetails sent by mistake.
    payload.pharmacyDetails = existing?.pharmacyDetails || {};
    payload.variants = arr(payload.variants).map(stripPharmacyVariantMeta);

    if (payload.variants && payload.variants.length > 0) {
      payload.stock = payload.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      const first = payload.variants[0] || {};
      payload.price = Number(first.price) || 0;
      payload.salePrice = Number(first.salePrice) || 0;
      payload.mrp = Math.max(
        Number(payload.price) || 0,
        Number(payload.salePrice) || 0,
        Number(payload.mrp) || 0,
      );
    }

    // Sellers cannot self-approve; preserve existing approval fields.
    payload.approvalStatus = existing.approvalStatus || payload.approvalStatus;
    payload.approvedAt = existing.approvedAt || payload.approvedAt;
    payload.isActive = payload.status === "active";

    Object.assign(existing, {
      ...payload,
      ...categoryIds,
    });

    await existing.save();
    await syncSellerInventoryNotification(sellerId, existing);

    const populated = await populateProductQuery(
      SellerProduct.findById(existing._id),
    ).lean();

    return res.json({ success: true, result: serializeProduct(populated) });
  } catch (error) {
    if (error?.statusCode === 400) {
      return sendError(res, 400, error.message);
    }
    if (error?.code === 11000) {
      const keys = error.keyPattern ? Object.keys(error.keyPattern) : [];
      if (keys.includes("slug")) {
        return sendError(res, 400, "Product slug already exists in your store");
      }
      if (keys.includes("sku")) {
        return sendError(res, 400, "SKU already exists in your store");
      }
      return sendError(res, 400, "Product slug or SKU already exists in your store");
    }
    return sendError(res, 500, error.message || "Failed to update product");
  }
};

export const deleteSellerProductController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const { productId } = req.params;
    const deleted = await SellerProduct.findOneAndDelete({
      _id: productId,
      sellerId,
    });

    if (!deleted) {
      return sendError(res, 404, "Product not found");
    }

    await SellerNotification.deleteMany({
      sellerId,
      key: {
        $in: [`inventory:${deleted._id}:low`, `inventory:${deleted._id}:out`],
      },
    });

    return res.json({ success: true, result: { deleted: true } });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to delete product");
  }
};

export const getSellerStockHistoryController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const history = await SellerStockAdjustment.find({ sellerId })
      .populate("productId", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      success: true,
      result: history.map((item) => ({
        ...item,
        variantId: item.variantId || null,
        variantName: item.variantName || "",
        product: item.productId
          ? {
            _id: item.productId._id,
            name: item.productId.name,
          }
          : null,
      })),
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load stock history");
  }
};

export const adjustSellerStockController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const productId = str(req.body?.productId);
    const quantity = num(req.body?.quantity);
    const type = str(req.body?.type) || "Correction";
    const variantId = str(req.body?.variantId);

    if (!productId) {
      return sendError(res, 400, "productId is required");
    }
    if (!Number.isFinite(quantity) || quantity === 0) {
      return sendError(res, 400, "Enter a non-zero quantity to adjust");
    }

    const product = await SellerProduct.findOne({ _id: productId, sellerId });
    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    let adjustedVariant = null;

    if (variants.length === 0) {
      product.stock = Math.max(0, num(product.stock) + quantity);
    } else {
      if (variants.length > 1 && !variantId) {
        return sendError(res, 400, "Select which variant to adjust");
      }

      adjustedVariant =
        variants.find(
          (v) =>
            String(v?._id || "") === variantId ||
            String(v?.id || "") === variantId ||
            (variantId && str(v?.sku) && str(v.sku) === variantId),
        ) || (variants.length === 1 ? variants[0] : null);

      if (!adjustedVariant) {
        return sendError(res, 404, "Variant not found on this product");
      }

      adjustedVariant.stock = Math.max(0, num(adjustedVariant.stock) + quantity);
      product.stock = variants.reduce(
        (sum, v) => sum + Math.max(0, num(v.stock)),
        0,
      );
      product.markModified("variants");
    }

    product.status = product.stock === 0 ? "inactive" : "active";
    product.isActive = product.stock > 0;
    await product.save();

    await SellerStockAdjustment.create({
      sellerId,
      productId: product._id,
      variantId: adjustedVariant?._id || null,
      variantName: str(adjustedVariant?.name),
      type,
      quantity,
      note: str(req.body?.note),
    });

    await syncSellerInventoryNotification(sellerId, product);

    return res.json({ success: true, result: serializeProduct(product) });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to adjust stock");
  }
};

export const getSellerProfileController = async (req, res) => {
  try {
    const seller = await resolveSellerFromRequest(req);
    if (!seller) {
      if (!req.sellerOnboarding) {
        return sendError(res, 404, "Seller not found");
      }
      return res.json({
        success: true,
        result: buildEmptySellerProfile(req.sellerOnboarding),
      });
    }

    const sellerId = seller._id;

    if (Object.prototype.hasOwnProperty.call(seller, "serviceRadius")) {
      await Seller.updateOne({ _id: sellerId }, { $unset: { serviceRadius: "" } });
      delete seller.serviceRadius;
    }

    const sellerDoc = seller.toObject ? seller.toObject() : seller;

    return res.json({
      success: true,
      result: serializeSellerProfile(sellerDoc),
    });
  } catch (error) {
    return sendError(
      res,
      500,
      error.message || "Failed to load seller profile",
    );
  }
};

const resolveEffectiveZoneSource = (shopInfoBody = {}, body = {}, fallback = "") => {
  if (body?.zoneSource !== undefined || shopInfoBody.zoneSource !== undefined) {
    const zoneSource = str(shopInfoBody.zoneSource ?? body.zoneSource, "").toLowerCase();
    return zoneSource === "quick" ? "quick" : zoneSource === "food" ? "food" : "";
  }
  return String(fallback || "").toLowerCase();
};

const validateSellerLocationInZone = async (zoneId, zoneSource, lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!zoneId) {
    return "Select a service zone before pinning your store location";
  }

  const source = resolveEffectiveZoneSource({}, {}, zoneSource);
  if (source === "quick" || !source) {
    const zone = await QuickZone.findById(zoneId)
      .select("coordinates name zoneName")
      .lean();
    if (!zone) return "Selected service zone was not found";
    const coordinates = Array.isArray(zone.coordinates) ? zone.coordinates : [];
    if (
      coordinates.length >= 3 &&
      !isPointInPolygon(lat, lng, coordinates)
    ) {
      const label = zone.name || zone.zoneName || "your selected zone";
      return `Store location must be inside ${label}. Pin your shop within the highlighted zone on the map.`;
    }
  }

  return null;
};

export const updateSellerProfileController = async (req, res) => {
  try {
    const files = req.files && typeof req.files === "object" ? req.files : {};
    let seller = await resolveSellerFromRequest(req);

    if (!seller) {
      if (!req.sellerOnboarding) {
        return sendError(res, 404, "Seller not found");
      }
      if (!sellerHasOnboardingIntent(req.body, files)) {
        return sendError(
          res,
          400,
          "Save your store details to create your seller profile",
        );
      }
      seller = await createSellerFromOnboarding(req.sellerOnboarding, req.body);
    }

    const resetOnboarding = optionalBoolean(req.body?.resetOnboarding, false);
    const canResetOnboarding =
      resetOnboarding &&
      seller.approvalStatus !== "approved" &&
      seller.approvalStatus !== "pending";

    if (canResetOnboarding) {
      seller.name = "";
      seller.shopName = "";
      if (!isSystemPlaceholderEmail(seller.email)) {
        const suffix = last10(seller.phone) || String(seller._id).slice(-6);
        seller.email = `seller${suffix}@seller.local`;
      }
      seller.bankInfo = {};
      seller.documents = {};
      seller.shopInfo = {
        businessType: "",
        alternatePhone: "",
        supportEmail: "",
        openingHours: "",
        zoneId: null,
        zoneSource: "",
        zoneName: "",
        shopImage: "",
      };
      seller.location = undefined;
      seller.markModified("bankInfo");
      seller.markModified("documents");
      seller.markModified("shopInfo");
      seller.markModified("location");
      await seller.save();
      return res.json({
        success: true,
        result: serializeSellerProfile(seller),
      });
    }

    const profileSnapshot = {
      name: seller.name,
      shopName: seller.shopName,
      email: seller.email,
      phone: seller.phone,
      location: seller.location
        ? JSON.parse(JSON.stringify(seller.location))
        : null,
      bankInfo: JSON.parse(JSON.stringify(seller.bankInfo || {})),
      documents: JSON.parse(JSON.stringify(seller.documents || {})),
      shopInfo: JSON.parse(JSON.stringify(seller.shopInfo || {})),
    };

    if (req.body?.name !== undefined)
      seller.name = str(req.body.name) || seller.name;
    if (req.body?.shopName !== undefined)
      seller.shopName = str(req.body.shopName) || seller.shopName;
    if (req.body?.phone !== undefined)
      seller.phone = str(req.body.phone) || seller.phone;
    if (req.body?.email !== undefined) {
      const nextEmail = str(req.body.email).toLowerCase();
      // Blank form values must not wipe the unique `@seller.local` seed email — that
      // would collide across draft sellers once more than one has `email: ""`.
      if (nextEmail) {
        seller.email = nextEmail;
      }
    }

    const lat = optionalNumber(req.body?.lat);
    const lng = optionalNumber(req.body?.lng);
    const address = str(req.body?.address);
    const bankInfoBody =
      req.body?.bankInfo && typeof req.body.bankInfo === "object"
        ? req.body.bankInfo
        : {};
    const documentsBody =
      req.body?.documents && typeof req.body.documents === "object"
        ? req.body.documents
        : {};
    const shopInfoBody =
      req.body?.shopInfo && typeof req.body.shopInfo === "object"
        ? req.body.shopInfo
        : {};
    const submitForApproval = optionalBoolean(
      req.body?.submitForApproval,
      false,
    );

    const effectiveZoneId =
      req.body?.zoneId !== undefined || shopInfoBody.zoneId !== undefined
        ? objectIdOrNull(shopInfoBody.zoneId ?? req.body.zoneId)
        : seller.shopInfo?.zoneId ?? null;
    const effectiveZoneSource = resolveEffectiveZoneSource(
      shopInfoBody,
      req.body,
      seller.shopInfo?.zoneSource,
    );

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const zoneError = await validateSellerLocationInZone(
        effectiveZoneId,
        effectiveZoneSource,
        lat,
        lng,
      );
      if (zoneError) return sendError(res, 400, zoneError);

      seller.location = {
        type: "Point",
        coordinates: [lng, lat],
        latitude: lat,
        longitude: lng,
        formattedAddress: address || (seller.location ? (seller.location.formattedAddress || seller.location.address) : ""),
        address: address || (seller.location ? seller.location.address : ""),
      };
      seller.markModified("location");
    } else if (address) {
      if (!seller.location) {
        seller.location = {
          type: "Point",
          coordinates: [0, 0], // Default coordinates if missing but address provided
          latitude: 0,
          longitude: 0,
          formattedAddress: address,
          address: address,
        };
      } else {
        seller.location.formattedAddress = address;
        seller.location.address = address;
      }
      seller.markModified("location");
    }

    seller.bankInfo = seller.bankInfo || {};
    if (
      req.body?.bankName !== undefined ||
      bankInfoBody.bankName !== undefined
    ) {
      seller.bankInfo.bankName = str(
        bankInfoBody.bankName ?? req.body.bankName,
        "",
      );
    }
    if (
      req.body?.accountHolderName !== undefined ||
      bankInfoBody.accountHolderName !== undefined
    ) {
      seller.bankInfo.accountHolderName = str(
        bankInfoBody.accountHolderName ?? req.body.accountHolderName,
        "",
      );
    }
    if (
      req.body?.accountNumber !== undefined ||
      bankInfoBody.accountNumber !== undefined
    ) {
      seller.bankInfo.accountNumber = str(
        bankInfoBody.accountNumber ?? req.body.accountNumber,
        "",
      );
    }
    if (
      req.body?.ifscCode !== undefined ||
      bankInfoBody.ifscCode !== undefined
    ) {
      seller.bankInfo.ifscCode = str(
        bankInfoBody.ifscCode ?? req.body.ifscCode,
        "",
      );
    }
    if (
      req.body?.accountType !== undefined ||
      bankInfoBody.accountType !== undefined
    ) {
      seller.bankInfo.accountType = str(
        bankInfoBody.accountType ?? req.body.accountType,
        "",
      );
    }
    if (req.body?.upiId !== undefined || bankInfoBody.upiId !== undefined) {
      seller.bankInfo.upiId = str(bankInfoBody.upiId ?? req.body.upiId, "");
    }
    if (
      req.body?.upiQrImage !== undefined ||
      req.body?.upiQrCode !== undefined ||
      bankInfoBody.upiQrImage !== undefined
    ) {
      // Empty multipart text fields must not wipe a previously uploaded QR URL.
      const nextUpiQr = str(
        bankInfoBody.upiQrImage ?? req.body.upiQrImage ?? req.body.upiQrCode,
        "",
      );
      if (nextUpiQr) seller.bankInfo.upiQrImage = nextUpiQr;
    }

    seller.documents = seller.documents || {};
    if (
      req.body?.panNumber !== undefined ||
      documentsBody.panNumber !== undefined
    ) {
      seller.documents.panNumber = str(
        documentsBody.panNumber ?? req.body.panNumber,
        "",
      );
    }
    if (
      req.body?.gstRegistered !== undefined ||
      documentsBody.gstRegistered !== undefined
    ) {
      seller.documents.gstRegistered = optionalBoolean(
        documentsBody.gstRegistered ?? req.body.gstRegistered,
        seller.documents.gstRegistered === true,
      );
    }
    if (
      req.body?.gstNumber !== undefined ||
      documentsBody.gstNumber !== undefined
    ) {
      seller.documents.gstNumber = str(
        documentsBody.gstNumber ?? req.body.gstNumber,
        "",
      );
    }
    if (
      req.body?.gstLegalName !== undefined ||
      documentsBody.gstLegalName !== undefined
    ) {
      seller.documents.gstLegalName = str(
        documentsBody.gstLegalName ?? req.body.gstLegalName,
        "",
      );
    }
    if (
      req.body?.fssaiNumber !== undefined ||
      documentsBody.fssaiNumber !== undefined
    ) {
      seller.documents.fssaiNumber = str(
        documentsBody.fssaiNumber ?? req.body.fssaiNumber,
        "",
      );
    }
    if (
      req.body?.fssaiExpiry !== undefined ||
      documentsBody.fssaiExpiry !== undefined
    ) {
      seller.documents.fssaiExpiry = optionalDate(
        documentsBody.fssaiExpiry ?? req.body.fssaiExpiry,
      );
    }
    if (
      req.body?.fssaiImage !== undefined ||
      documentsBody.fssaiImage !== undefined
    ) {
      const nextFssaiImage = str(
        documentsBody.fssaiImage ?? req.body.fssaiImage,
        "",
      );
      if (nextFssaiImage) seller.documents.fssaiImage = nextFssaiImage;
    }
    if (
      req.body?.medicalLicenseNumber !== undefined ||
      documentsBody.medicalLicenseNumber !== undefined
    ) {
      seller.documents.medicalLicenseNumber = str(
        documentsBody.medicalLicenseNumber ?? req.body.medicalLicenseNumber,
        "",
      );
    }
    if (
      req.body?.medicalLicenseImage !== undefined ||
      documentsBody.medicalLicenseImage !== undefined
    ) {
      const nextMedicalImage = str(
        documentsBody.medicalLicenseImage ?? req.body.medicalLicenseImage,
        "",
      );
      if (nextMedicalImage) seller.documents.medicalLicenseImage = nextMedicalImage;
    }
    if (
      req.body?.medicalLicenseExpiry !== undefined ||
      documentsBody.medicalLicenseExpiry !== undefined
    ) {
      seller.documents.medicalLicenseExpiry = optionalDate(
        documentsBody.medicalLicenseExpiry ?? req.body.medicalLicenseExpiry,
      );
    }
    if (
      req.body?.shopLicenseNumber !== undefined ||
      documentsBody.shopLicenseNumber !== undefined
    ) {
      seller.documents.shopLicenseNumber = str(
        documentsBody.shopLicenseNumber ?? req.body.shopLicenseNumber,
        "",
      );
    }
    if (
      req.body?.shopLicenseImage !== undefined ||
      documentsBody.shopLicenseImage !== undefined
    ) {
      const nextShopLicenseImage = str(
        documentsBody.shopLicenseImage ?? req.body.shopLicenseImage,
        "",
      );
      if (nextShopLicenseImage) seller.documents.shopLicenseImage = nextShopLicenseImage;
    }
    // Upload independent document images concurrently to reduce request latency.
    const [
      uploadedUpiQrImage,
      uploadedShopImage,
      uploadedFssaiImage,
      uploadedMedicalLicenseImage,
      uploadedShopLicenseImage,
    ] = await Promise.all([
      files?.upiQrImage?.[0]?.buffer
        ? uploadImageBuffer(files.upiQrImage[0].buffer, "seller/upi-qr")
        : Promise.resolve(""),
      files?.shopImage?.[0]?.buffer
        ? uploadImageBuffer(files.shopImage[0].buffer, "seller/shop-image")
        : Promise.resolve(""),
      files?.fssaiImage?.[0]?.buffer
        ? uploadImageBuffer(files.fssaiImage[0].buffer, "seller/fssai")
        : Promise.resolve(""),
      files?.medicalLicenseImage?.[0]?.buffer
        ? uploadImageBuffer(files.medicalLicenseImage[0].buffer, "seller/medical-license")
        : Promise.resolve(""),
      files?.shopLicenseImage?.[0]?.buffer
        ? uploadImageBuffer(files.shopLicenseImage[0].buffer, "seller/shop-license")
        : Promise.resolve(""),
    ]);

    if (uploadedUpiQrImage) seller.bankInfo.upiQrImage = uploadedUpiQrImage;
    seller.shopInfo = seller.shopInfo || {};
    if (uploadedShopImage) seller.shopInfo.shopImage = uploadedShopImage;
    if (uploadedFssaiImage) seller.documents.fssaiImage = uploadedFssaiImage;
    if (uploadedMedicalLicenseImage) {
      seller.documents.medicalLicenseImage = uploadedMedicalLicenseImage;
    }
    if (uploadedShopLicenseImage) seller.documents.shopLicenseImage = uploadedShopLicenseImage;

    if (
      req.body?.shopLicenseExpiry !== undefined ||
      documentsBody.shopLicenseExpiry !== undefined
    ) {
      seller.documents.shopLicenseExpiry = optionalDate(
        documentsBody.shopLicenseExpiry ?? req.body.shopLicenseExpiry,
      );
    }
    if (
      req.body?.isDocumentsVerified !== undefined ||
      documentsBody.isDocumentsVerified !== undefined
    ) {
      seller.documents.isDocumentsVerified = optionalBoolean(
        documentsBody.isDocumentsVerified ?? req.body.isDocumentsVerified,
        seller.documents.isDocumentsVerified === true,
      );
    }

    seller.shopInfo = seller.shopInfo || {};
    if (
      req.body?.businessType !== undefined ||
      shopInfoBody.businessType !== undefined
    ) {
      const nextBusinessType = str(
        shopInfoBody.businessType ?? req.body.businessType,
        "",
      );
      if (nextBusinessType.trim().toLowerCase() === "pharmacy") {
        return res.status(400).json({
          success: false,
          message: "Pharmacy registration is no longer supported. Please select Quick Commerce.",
        });
      }
      seller.shopInfo.businessType = nextBusinessType;
    }
    if (
      req.body?.alternatePhone !== undefined ||
      shopInfoBody.alternatePhone !== undefined
    ) {
      const alternatePhone = str(
        shopInfoBody.alternatePhone ?? req.body.alternatePhone,
        "",
      );
      const alternateLast10 = last10(alternatePhone);

      if (alternateLast10) {
        if (alternateLast10 === last10(seller.phone)) {
          return sendError(
            res,
            400,
            "Alternate number cannot be the same as your login number",
          );
        }

        const numberTaken = await Seller.findOne({
          _id: { $ne: seller._id },
          isDeleted: { $ne: true },
          accountStatus: { $ne: "deleted" },
          $or: [
            { phoneLast10: alternateLast10 },
            { alternatePhoneLast10: alternateLast10 },
          ],
        })
          .select("_id")
          .lean();

        if (numberTaken) {
          return sendError(
            res,
            409,
            "This alternate number is already registered with another seller",
          );
        }
      }

      seller.shopInfo.alternatePhone = alternatePhone;
    }
    if (
      req.body?.supportEmail !== undefined ||
      shopInfoBody.supportEmail !== undefined
    ) {
      seller.shopInfo.supportEmail = str(
        shopInfoBody.supportEmail ?? req.body.supportEmail,
        "",
      );
    }
    if (
      req.body?.openingHours !== undefined ||
      shopInfoBody.openingHours !== undefined
    ) {
      seller.shopInfo.openingHours = str(
        shopInfoBody.openingHours ?? req.body.openingHours,
        "",
      );
    }
    if (req.body?.zoneId !== undefined || shopInfoBody.zoneId !== undefined) {
      seller.shopInfo.zoneId = objectIdOrNull(
        shopInfoBody.zoneId ?? req.body.zoneId,
      );
    }
    if (
      req.body?.zoneSource !== undefined ||
      shopInfoBody.zoneSource !== undefined
    ) {
      const zoneSource = str(
        shopInfoBody.zoneSource ?? req.body.zoneSource,
        "",
      ).toLowerCase();
      seller.shopInfo.zoneSource =
        zoneSource === "quick" ? "quick" : zoneSource === "food" ? "food" : "";
    }
    if (
      req.body?.zoneName !== undefined ||
      shopInfoBody.zoneName !== undefined
    ) {
      seller.shopInfo.zoneName = str(
        shopInfoBody.zoneName ?? req.body.zoneName,
        "",
      );
    }
    if (
      req.body?.shopImage !== undefined ||
      shopInfoBody.shopImage !== undefined
    ) {
      const nextShopImage = str(
        shopInfoBody.shopImage ?? req.body.shopImage,
        "",
      );
      if (nextShopImage) seller.shopInfo.shopImage = nextShopImage;
    }

    const zoneChanged =
      req.body?.zoneId !== undefined || shopInfoBody.zoneId !== undefined;
    if (zoneChanged) {
      const locationLat = Number.isFinite(lat)
        ? lat
        : Number(seller.location?.latitude ?? seller.location?.coordinates?.[1]);
      const locationLng = Number.isFinite(lng)
        ? lng
        : Number(seller.location?.longitude ?? seller.location?.coordinates?.[0]);
      if (Number.isFinite(locationLat) && Number.isFinite(locationLng)) {
        const zoneError = await validateSellerLocationInZone(
          seller.shopInfo.zoneId,
          seller.shopInfo.zoneSource,
          locationLat,
          locationLng,
        );
        if (zoneError) return sendError(res, 400, zoneError);
      }
    }

    const requiresProfileReview =
      sellerHadPriorApproval(seller) && !submitForApproval;

    if (requiresProfileReview) {
      const patch = buildSellerProfilePatch({
        body: req.body,
        bankInfoBody,
        documentsBody,
        shopInfoBody,
        uploaded: {
          upiQrImage: uploadedUpiQrImage,
          shopImage: uploadedShopImage,
          fssaiImage: uploadedFssaiImage,
          medicalLicenseImage: uploadedMedicalLicenseImage,
          shopLicenseImage: uploadedShopLicenseImage,
        },
        lat,
        lng,
        address,
      });

      const { stagedPatch, shouldStage } = splitSellerReviewablePatch(
        profileSnapshot,
        patch,
        { requiresReview: true },
      );

      if (shouldStage) {
        restoreStagedFieldsFromSnapshot(seller, profileSnapshot, stagedPatch);
        seller.pendingProfileChanges = mergeSellerPendingProfileChanges(
          seller.pendingProfileChanges,
          stagedPatch,
          profileSnapshot,
        );
        seller.markModified("pendingProfileChanges");

        const isExistingApprovedSeller =
          String(seller.approvalStatus || "").toLowerCase() === "approved" ||
          seller.wasEverApproved === true;

        try {
          const { notifyAdminsSafely } = await import(
            "../../../../core/notifications/firebase.service.js"
          );
          void notifyAdminsSafely({
            title: isExistingApprovedSeller
              ? "Seller profile update pending"
              : "Seller profile changes pending",
            body: isExistingApprovedSeller
              ? `${seller.shopName || seller.name || "An approved seller"} updated their store profile and needs admin re-approval.`
              : `${seller.shopName || seller.name || "A seller"} submitted profile changes for admin review.`,
            data: {
              type: "seller_profile_updated",
              subType: "seller",
              id: String(seller._id),
              link: "/admin/quick-commerce/sellers/pending",
            },
          });
        } catch (notifyErr) {
          console.warn("Failed to notify admins of seller profile update:", notifyErr?.message);
        }

        try {
          const { emitAdminBellRefresh } = await import(
            "../../../../core/notifications/ownerInboxNotify.js"
          );
          await emitAdminBellRefresh({
            type: "seller_profile_updated",
            sellerId: String(seller._id),
          });
        } catch (socketErr) {
          console.warn("Failed to emit admin_notification:", socketErr?.message);
        }

        await upsertSellerNotification(seller._id, {
          key: `profile-update:${String(seller._id)}:submitted`,
          type: "system",
          title: "Profile changes submitted",
          message:
            "Your requested profile changes are with our team for review. Customers still see your current approved details until admin approves.",
          link: "/seller/profile",
        });
      }
    }

    if (submitForApproval) {
      const razorpayOrderId = str(req.body?.razorpayOrderId);
      const razorpayPaymentId = str(req.body?.razorpayPaymentId);
      const razorpaySignature = str(req.body?.razorpaySignature);

      if (seller.approvalStatus !== "rejected") {
        // Verify onboarding fee payment if required
        const { verifyAndConsumeOnboardingPayment } = await import("../../../common/services/onboardingFee.service.js");
        await verifyAndConsumeOnboardingPayment({
          role: "SELLER",
          paymentDetails: { razorpayOrderId, razorpayPaymentId, razorpaySignature },
          userDetails: { name: seller.name, phone: seller.phone, email: seller.email },
          entityId: seller._id
        });
      }

      seller.onboardingSubmitted = true;
      seller.approved = false;
      seller.approvalStatus = "pending";
      seller.approvedAt = null;
      seller.rejectedAt = null;

      try {
        const { notifyAdminsSafely } = await import(
          "../../../../core/notifications/firebase.service.js"
        );
        void notifyAdminsSafely({
          title: "New seller onboarding",
          body: `${seller.shopName || seller.name || "A seller"} submitted their store for approval.`,
          data: {
            type: "seller_onboarding_submitted",
            subType: "seller",
            id: String(seller._id),
            link: "/admin/quick-commerce/sellers/pending",
          },
        });
      } catch (notifyErr) {
        console.warn("Failed to notify admins of seller onboarding:", notifyErr?.message);
      }

      try {
        const { emitAdminBellRefresh } = await import(
          "../../../../core/notifications/ownerInboxNotify.js"
        );
        await emitAdminBellRefresh({ type: "seller_onboarding_submitted" });
      } catch (err) {
        console.warn("Failed to emit admin_notification:", err.message);
      }
    }

    await seller.save();
    await Seller.updateOne({ _id: seller._id }, { $unset: { serviceRadius: "" } });

    if (submitForApproval) {
      // Confirms the submission inside the seller's own notification bell, so the seller has a
      // record of it after the success toast is gone.
      await upsertSellerNotification(seller._id, {
        key: `onboarding:${String(seller._id)}:submitted`,
        type: "system",
        title: "Onboarding submitted successfully",
        message:
          "We received your store details. Our team is reviewing your application and you will be notified once it is approved.",
      });
    }

    return res.json({
      success: true,
      result: serializeSellerProfile(seller),
      ...(submitForApproval
        ? await createAuthTokens(seller._id)
        : {}),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(
        res,
        400,
        "This phone number, alternate number or email already belongs to another seller",
      );
    }
    return sendError(
      res,
      500,
      error.message || "Failed to update seller profile",
    );
  }
};

export const getSellerNotificationsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const notifications = await SellerNotification.find({ sellerId })
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    return res.json({
      success: true,
      result: {
        notifications,
        items: notifications,
        unreadCount: notifications.filter((item) => !item.isRead).length,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load notifications");
  }
};

export const markSellerNotificationReadController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const updated = await SellerNotification.findOneAndUpdate(
      { _id: req.params.notificationId, sellerId },
      { $set: { isRead: true } },
      { new: true },
    ).lean();

    if (!updated) {
      return sendError(res, 404, "Notification not found");
    }

    return res.json({ success: true, result: updated });
  } catch (error) {
    return sendError(
      res,
      500,
      error.message || "Failed to update notification",
    );
  }
};

export const markAllSellerNotificationsReadController = async (req, res) => {
  try {
    await SellerNotification.updateMany(
      { sellerId: sellerScope(req), isRead: false },
      { $set: { isRead: true } },
    );

    return res.json({ success: true, result: { success: true } });
  } catch (error) {
    return sendError(
      res,
      500,
      error.message || "Failed to update notifications",
    );
  }
};

export const getSellerOrdersController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const sellerKey = String(sellerId);

    const page = Math.max(1, num(req.query?.page, 1));
    const limit = Math.max(1, Math.min(100, num(req.query?.limit, 50)));
    const skip = (page - 1) * limit;

    // Use parent collection as the source of truth as requested
    const parentQuery = {
      items: { $elemMatch: { sourceId: sellerKey, type: "quick" } },
      ...getSellerVisibleQuickOrderPaymentFilter(),
    };

    if (req.query?.startDate || req.query?.endDate) {
      parentQuery.createdAt = {};
      if (req.query?.startDate) {
        parentQuery.createdAt.$gte = new Date(`${req.query.startDate}T00:00:00.000Z`);
      }
      if (req.query?.endDate) {
        parentQuery.createdAt.$lte = new Date(`${req.query.endDate}T23:59:59.999Z`);
      }
    }

    const [parentOrders, total] = await Promise.all([
      QuickOrder.find(parentQuery)
        .populate("userId", "name phone email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      QuickOrder.countDocuments(parentQuery),
    ]);

    if (!parentOrders.length) {
      return res.json({
        success: true,
        result: { items: [], total: 0, page, limit, totalPages: 0 },
      });
    }

    const parentIds = parentOrders.map((p) => p._id);
    const existingSellerOrders = await SellerOrder.find({
      parentOrderId: { $in: parentIds },
      sellerId,
    }).lean();

    const existingMap = new Map(
      existingSellerOrders.map((so) => [String(so.parentOrderId), so]),
    );

    // Collect every required mutation first, then apply them all in a single
    // bulkWrite (previously this issued up to 2 writes PER row on every list
    // read). Missing seller-order docs are built for upsert; status-drift rows
    // get patched. Behaviour and final DB state are identical to the per-row
    // findOneAndUpdate approach.
    const bulkOps = [];
    const parentsNeedingBuild = [];

    for (const po of parentOrders) {
      const so = existingMap.get(String(po._id));
      const parentStatus = String(po?.orderStatus || "").toLowerCase();

      if (!so) {
        parentsNeedingBuild.push(po);
      } else if (parentStatus === "delivered" && so.status !== "delivered") {
        bulkOps.push({
          updateOne: {
            filter: { _id: so._id },
            update: {
              $set: {
                status: "delivered",
                workflowStatus: "DELIVERED",
                deliveredAt:
                  po.deliveryState?.deliveredAt || po.updatedAt || new Date(),
              },
            },
          },
        });
      } else if (parentStatus.startsWith("cancel") && so.status !== "cancelled") {
        bulkOps.push({
          updateOne: {
            filter: { _id: so._id },
            update: { $set: { status: "cancelled", workflowStatus: "CANCELLED" } },
          },
        });
      }
    }

    if (parentsNeedingBuild.length) {
      const buildResults = await Promise.all(
        parentsNeedingBuild.map(async (po) => ({
          po,
          doc: await buildSellerOrderFromParentOrder(po, sellerId),
        })),
      );
      for (const { po, doc } of buildResults) {
        if (!doc) continue;
        bulkOps.push({
          updateOne: {
            filter: { parentOrderId: po._id, sellerId },
            update: { $set: doc },
            upsert: true,
            setDefaultsOnInsert: true,
          },
        });
      }
    }

    let finalSellerOrders = existingSellerOrders;
    if (bulkOps.length) {
      await SellerOrder.bulkWrite(bulkOps);
      // Re-read fresh state once so the response reflects created/updated docs.
      finalSellerOrders = await SellerOrder.find({
        parentOrderId: { $in: parentIds },
        sellerId,
      }).lean();
    }

    const finalMap = new Map(
      finalSellerOrders.map((so) => [String(so.parentOrderId), so]),
    );

    // Preserve original ordering (follows parentOrders) and null-filtering.
    const filteredItems = parentOrders
      .map((po) => finalMap.get(String(po._id)))
      .filter(Boolean);

    const quickOrderMap = new Map(
      parentOrders.map((order) => [String(order.orderId), order]),
    );

    const deliveryPartnerIds = parentOrders
      .map((order) => order?.dispatch?.deliveryPartnerId)
      .filter(Boolean);

    const deliveryPartners = deliveryPartnerIds.length
      ? await FoodDeliveryPartner.find({ _id: { $in: deliveryPartnerIds } })
        .select("_id name phone vehicleType vehicleNumber")
        .lean()
      : [];

    const deliveryPartnerMap = new Map(
      deliveryPartners.map((partner) => [String(partner._id), partner]),
    );

    const returnsByOrderId = await loadReturnsByOrderIds(
      filteredItems.map((item) => item.orderId).filter(Boolean),
    );

    const enrichedItems = filteredItems.map((item) => {
      const quickOrder = quickOrderMap.get(String(item.orderId));
      const acceptedPartner = quickOrder?.dispatch?.deliveryPartnerId
        ? deliveryPartnerMap.get(String(quickOrder.dispatch.deliveryPartnerId))
        : null;
      const returnAttachment = attachReturnSummaryToOrder(
        quickOrder || item,
        returnsByOrderId.get(String(item.orderId || '')) || [],
      );

      // Packing fee is seller-owned. For legacy SellerOrder rows that don't have packingFee stored,
      // allocate from the parent QuickOrder's aggregated pricing.packagingFee.
      const parentPackingFee = Number(quickOrder?.pricing?.packagingFee || 0);
      const parentSubtotal = Number(quickOrder?.pricing?.subtotal || 0);
      const sellerSubtotal = Number(item?.pricing?.subtotal || 0);

      const allocatedPackingFee =
        parentSubtotal > 0
          ? Number(((parentPackingFee * sellerSubtotal) / parentSubtotal).toFixed(2))
          : parentPackingFee;

      const packingFeeStored = Number(item?.pricing?.packingFee || 0);
      const packingFee = packingFeeStored > 0 ? packingFeeStored : allocatedPackingFee;

      const receivableStored = resolveSellerReceivable(item.pricing);

      let productEarnings;
      if (
        item?.pricing?.productEarnings !== null &&
        item?.pricing?.productEarnings !== undefined &&
        item?.pricing?.productEarnings !== '' &&
        Number.isFinite(Number(item.pricing.productEarnings))
      ) {
        // Prefer stored product earnings (may be negative after seller coupon).
        productEarnings = Number(item.pricing.productEarnings);
      } else if (packingFeeStored > 0) {
        productEarnings = Number(receivableStored - packingFee);
      } else {
        // Legacy rows: receivable stored is product earnings only.
        productEarnings = Number(receivableStored);
      }

      const couponDiscountStored = Number(item?.pricing?.couponDiscount || 0);
      const couponDiscount =
        couponDiscountStored > 0
          ? couponDiscountStored
          : Math.max(
              0,
              Number(
                (
                  Number(item?.pricing?.subtotal || 0) -
                  Number(item?.pricing?.commission || 0) -
                  productEarnings
                ).toFixed(2),
              ),
            );
      const receivable = productEarnings + packingFee;

      let riderPhone = "";
      if (acceptedPartner) {
        const orderStatus = String(quickOrder?.orderStatus || "").toLowerCase();
        const deliveryStatus = String(quickOrder?.deliveryState?.status || "").toLowerCase();
        const reachedPickup =
          deliveryStatus === "reached_pickup" ||
          deliveryStatus === "picked_up" ||
          ["picked_up", "reached_drop", "delivered"].includes(orderStatus);
        const photoUploaded = !!quickOrder?.deliveryState?.billImageUrl;

        riderPhone = (reachedPickup && photoUploaded)
          ? (acceptedPartner.phone || "")
          : "Hidden until photo upload";
      }

      return {
        ...item,
        customer: resolveQuickOrderCustomer(quickOrder, item),
        address: quickOrder?.deliveryAddress || item?.deliveryAddress || null,
        pricing: {
          ...item.pricing,
          packingFee,
          productEarnings,
          couponDiscount: Number.isFinite(couponDiscount) ? Math.max(0, couponDiscount) : 0,
          receivable,
        },
        cancellationReason: resolveQuickOrderCancellationReason(quickOrder, item),
        orderType: (item.orderType || quickOrder?.orderType) === "mixed" ? "mixed" : "quick",
        dispatchStatus: quickOrder?.dispatch?.status || "unassigned",
        statusHistory: Array.isArray(quickOrder?.statusHistory) ? quickOrder.statusHistory : [],
        payment: quickOrder?.payment || item.payment || null,
        createdAt: quickOrder?.createdAt || item.createdAt || null,
        updatedAt: quickOrder?.updatedAt || item.updatedAt || null,
        returnStatus: returnAttachment.returnStatus || quickOrder?.returnStatus || '',
        returnStatusLabel: returnAttachment.returnStatusLabel || '',
        refundStatus: returnAttachment.returnSummary?.refundStatus || '',
        refundStatusLabel: returnAttachment.returnSummary?.refundStatusLabel || '',
        hasReturn: returnAttachment.hasReturn,
        returnSummary: returnAttachment.returnSummary,
        originalPaidTotal: returnAttachment.originalPaidTotal,
        refundedAmount: returnAttachment.refundedAmount,
        netAfterReturn: returnAttachment.netAfterReturn,
        deliveryPartner: acceptedPartner
          ? {
            _id: acceptedPartner._id,
            name: acceptedPartner.name || "Delivery Partner",
            phone: riderPhone,
            vehicleType: acceptedPartner.vehicleType || "",
            vehicleNumber: acceptedPartner.vehicleNumber || "",
          }
          : null,
      };
    });

    return res.json({
      success: true,
      result: {
        items: enrichedItems,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load orders");
  }
};

export const updateSellerOrderStatusController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const nextStatus = str(
      req.body?.status || req.body?.orderStatus,
    ).toLowerCase();
    const orderId = req.params.orderId;
    const reason = str(req.body?.reason || req.body?.cancellationReason);

    if (!nextStatus) {
      return sendError(res, 400, "Status is required");
    }

    // Sellers can only manually change status to 'confirmed', 'packed', or 'cancelled'
    // 'out_for_delivery' and 'delivered' are managed automatically by the delivery partner app
    const restrictedStatuses = ["out_for_delivery", "delivered"];
    if (restrictedStatuses.includes(nextStatus)) {
      return sendError(
        res,
        403,
        `Sellers cannot manually change order status to ${nextStatus.replace(/_/g, " ")}. This status is updated automatically by the delivery partner.`,
      );
    }

    if (nextStatus === "cancelled" && !reason) {
      return sendError(res, 400, "Cancellation reason is required");
    }

    const result = await quickOrderService.updateSellerOrderStatus(
      orderId,
      sellerId,
      nextStatus,
      reason,
    );
    return sendResponse(res, 200, "Order status updated", result);
  } catch (error) {
    logger.error(
      `Update seller order status failed: ${error?.message || error}`,
    );
    return sendError(
      res,
      error.statusCode || 500,
      error.message || "Failed to update order status",
    );
  }
};

export const resendSellerOrderDispatchController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const objectId = objectIdOrNull(req.params.orderId);
    const sellerOrder = await SellerOrder.findOne({
      sellerId,
      $or: [
        { orderId: req.params.orderId },
        ...(objectId ? [{ _id: objectId }] : []),
      ],
    }).lean();

    if (!sellerOrder) {
      return sendError(res, 404, "Order not found");
    }

    const quickOrder = await resolveParentQuickOrder(sellerOrder, {
      populateUser: true,
    });

    if (!quickOrder) {
      return sendError(res, 404, "Parent order not found");
    }

    if (
      [
        "delivered",
        "cancelled_by_user",
        "cancelled_by_restaurant",
        "cancelled_by_admin",
      ].includes(String(quickOrder.orderStatus || "").toLowerCase())
    ) {
      return sendError(res, 400, "This order can no longer be reassigned");
    }

    if (
      quickOrder.dispatch?.status === "accepted" &&
      quickOrder.dispatch?.deliveryPartnerId
    ) {
      return sendError(
        res,
        400,
        "A delivery partner has already accepted this order",
      );
    }

    const seller = await Seller.findById(sellerId)
      .select("shopName name phone location shopInfo")
      .lean();
    const origin = quickOrderService.getSellerLocation(seller);
    if (!origin) {
      return sendError(
        res,
        400,
        "Seller store location is not configured. Please update your store address in profile.",
      );
    }

    const nearbyPartners = await listNearbyOnlineDeliveryPartnersByCoords(
      origin,
      {
        maxKm: 15,
        limit: 15,
      },
    );

    const closestPartner = nearbyPartners[0];
    if (!closestPartner?.partnerId) {
      return sendError(res, 404, "No nearby online delivery partner found");
    }

    const now = new Date();
    quickOrder.dispatch = {
      ...(quickOrder.dispatch?.toObject?.() || quickOrder.dispatch || {}),
      modeAtCreation: quickOrder.dispatch?.modeAtCreation || "auto",
      status: "assigned",
      deliveryPartnerId: closestPartner.partnerId,
      assignedAt: now,
      acceptedAt: null,
      offeredTo: [
        ...(quickOrder.dispatch?.offeredTo || []).filter(Boolean),
        {
          partnerId: closestPartner.partnerId,
          at: now,
          action: "offered",
        },
      ],
    };
    await quickOrder.save();

    const io = getIO();
    const deliveryPayload = {
      ...buildDeliverySocketPayload(quickOrder, seller),
      orderId: quickOrder.orderId,
      orderMongoId: quickOrder._id?.toString?.(),
      restaurantName:
        seller?.shopName || seller?.name || "Quick Commerce Seller",
      restaurantPhone: seller?.phone || "",
      dispatch: quickOrder.dispatch,
      sourceType: "quick",
    };

    if (io) {
      for (const partner of nearbyPartners || []) {
        const deliveryRoom = rooms.delivery(partner.partnerId);
        const payloadWithDistance = {
          ...deliveryPayload,
          pickupDistanceKm: partner.distanceKm,
        };
        io.to(deliveryRoom).emit("new_order", payloadWithDistance);
        io.to(deliveryRoom).emit("new_order_available", payloadWithDistance);
        io.to(deliveryRoom).emit("play_notification_sound", {
          orderId: quickOrder.orderId,
          orderMongoId: quickOrder._id?.toString?.(),
        });

        await notifyOwnerSafely(
          { ownerType: "DELIVERY_PARTNER", ownerId: partner.partnerId },
          {
            title: "New nearby order",
            body: `Order #${quickOrder.orderId} is ready for pickup.`,
            data: {
              type: "new_order",
              orderId: quickOrder.orderId,
              orderMongoId: quickOrder._id?.toString?.(),
              link: "/delivery",
            },
          },
        );
      }
    }

    return sendResponse(res, 200, "Driver notified again", {
      orderId: quickOrder.orderId,
      dispatchStatus: quickOrder.dispatch?.status || "assigned",
      notifiedPartner: {
        _id: closestPartner.partnerId,
        name: closestPartner.name || "Delivery Partner",
        phone: closestPartner.phone || "",
        distanceKm: closestPartner.distanceKm,
      },
    });
  } catch (error) {
    logger.error(`Resend seller dispatch failed: ${error?.message || error}`);
    return sendError(
      res,
      500,
      error.message || "Failed to resend driver notification",
    );
  }
};

const enrichSellerReturnsWithOrderContext = async (returnDocs = [], sellerId) => {
  if (!returnDocs.length) return [];

  const orderIds = [...new Set(returnDocs.map((doc) => doc.orderId).filter(Boolean))];
  const partnerIds = [
    ...new Set(
      returnDocs
        .map((doc) => doc.dispatch?.deliveryPartnerId)
        .filter((id) => id && mongoose.isValidObjectId(String(id))),
    ),
  ];

  const [sellerOrders, parentOrders, deliveryPartners] = await Promise.all([
    SellerOrder.find({ sellerId, orderId: { $in: orderIds } })
      .select("orderId address customer")
      .lean(),
    QuickOrder.find({ orderId: { $in: orderIds } })
      .select("orderId deliveryAddress")
      .lean(),
    partnerIds.length
      ? FoodDeliveryPartner.find({ _id: { $in: partnerIds } })
          .select("name phone")
          .lean()
      : Promise.resolve([]),
  ]);

  const sellerOrderMap = new Map(sellerOrders.map((row) => [row.orderId, row]));
  const parentOrderMap = new Map(parentOrders.map((row) => [row.orderId, row]));
  const partnerMap = new Map(deliveryPartners.map((row) => [String(row._id), row]));

  return returnDocs.map((doc) => {
    const serialized = serializeReturnForSeller(doc);
    const sellerOrder = sellerOrderMap.get(doc.orderId);
    const parentOrder = parentOrderMap.get(doc.orderId);
    const partner = partnerMap.get(String(doc.dispatch?.deliveryPartnerId || ""));

    return {
      ...mergeSellerReturnOrderContext(serialized, {
        sellerOrder,
        deliveryAddress: parentOrder?.deliveryAddress,
      }),
      deliveryPartner: partner
        ? {
            id: String(partner._id),
            name: partner.name || "Delivery Partner",
            phone: partner.phone || "",
          }
        : null,
    };
  });
};

export const getSellerReturnsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const items = await SellerReturn.find({ sellerId })
      .select('+sellerOtp')
      .sort({ returnRequestedAt: -1 })
      .lean();

    const enriched = await enrichSellerReturnsWithOrderContext(items, sellerId);

    return res.json({
      success: true,
      result: { items: enriched },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load returns");
  }
};

export const approveSellerReturnController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const { returnDoc, pickupDispatch } = await recordSellerReturnDecision({
      sellerId,
      orderId: req.params.orderId,
      decision: "approve",
      reason: str(req.body?.reason),
      actorRole: "SELLER",
      actorId: sellerId,
    });

    if (!returnDoc) {
      return sendError(res, 404, "Return request not found");
    }

    const populated = await SellerReturn.findById(returnDoc._id)
      .select("+sellerOtp")
      .lean();

    const [enriched] = await enrichSellerReturnsWithOrderContext([populated], sellerId);

    if (pickupDispatch && pickupDispatch.success === false) {
      return res.status(422).json({
        success: false,
        message:
          pickupDispatch.message ||
          'Return approved but pickup dispatch failed — no nearby delivery partner found',
        result: {
          ...enriched,
          pickupDispatch,
        },
      });
    }

    return res.json({
      success: true,
      result: {
        ...enriched,
        pickupDispatch,
      },
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return sendError(res, status, error.message || "Failed to approve return");
  }
};

export const rejectSellerReturnController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const { returnDoc } = await recordSellerReturnDecision({
      sellerId,
      orderId: req.params.orderId,
      decision: "reject",
      reason: str(req.body?.reason),
      actorRole: "SELLER",
      actorId: sellerId,
    });

    if (!returnDoc) {
      return sendError(res, 404, "Return request not found");
    }

    const [enriched] = await enrichSellerReturnsWithOrderContext(
      [returnDoc.toObject()],
      sellerId,
    );
    return res.json({ success: true, result: enriched });
  } catch (error) {
    const status = error?.statusCode || 500;
    return sendError(res, status, error.message || "Failed to reject return");
  }
};

export const requestSellerReturnPickupController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const result = await requestSellerReturnPickup({
      sellerId,
      orderId: req.params.orderId,
      actorId: sellerId,
    });

    return res.json({
      success: true,
      result,
    });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to request return pickup',
      ...(error?.dispatchAudit ? { dispatchAudit: error.dispatchAudit } : {}),
      ...(error?.pickupDispatch ? { pickupDispatch: error.pickupDispatch } : {}),
    });
  }
};

export const getSellerEarningsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);

    // Ensure seller legs reflect parent delivery/cancellation even if realtime sync missed it.
    await reconcileSellerDeliveredOrders(sellerId);

    // Backfill stock + receivable (+ ledger) for completed returns that missed side-effects.
    try {
      const {
        ensureReturnRefundSideEffects,
        applyReturnSellerFinance,
      } = await import("../../services/quickReturnFinance.service.js");
      const pendingSideEffects = await SellerReturn.find({
        sellerId,
        refundStatus: "completed",
        $or: [
          { "finance.sellerLedgerApplied": { $ne: true } },
          { "finance.stockRestoredAt": null },
          { "finance.stockRestoredAt": { $exists: false } },
          { "finance.sellerReceivableAdjusted": { $ne: true } },
        ],
      })
        .limit(25)
        .exec();
      for (const ret of pendingSideEffects) {
        if (!ret.finance?.sellerLedgerApplied) {
          await applyReturnSellerFinance(ret, {
            actorRole: "SYSTEM",
            reason: "Backfill return seller finance",
          });
        } else {
          await ensureReturnRefundSideEffects(ret);
        }
      }
    } catch (sideEffectErr) {
      logger.warn(
        `[SellerEarnings] Return side-effect backfill skipped: ${sideEffectErr?.message || sideEffectErr}`,
      );
    }

    // Align Order Payment credits with current receivables so withdraw checks match this UI.
    try {
      await syncSellerDeliveredOrderPaymentCredits(sellerId);
    } catch (syncErr) {
      logger.warn(
        `[SellerEarnings] Order Payment sync skipped: ${syncErr?.message || syncErr}`,
      );
    }

    const [transactions, orders] = await Promise.all([
      SellerTransaction.find({ sellerId }).sort({ createdAt: -1 }).lean(),
      SellerOrder.find({ sellerId, status: "delivered" })
        .select("orderId parentOrderId customer pricing createdAt updatedAt deliveredAt")
        .lean(),
    ]);

    const parentIds = orders
      .map((o) => (o?.parentOrderId ? String(o.parentOrderId) : ""))
      .filter(Boolean);
    const parentOrders = parentIds.length
      ? await QuickOrder.find({ _id: { $in: parentIds } })
          .select("_id pricing.subtotal pricing.packagingFee")
          .lean()
      : [];
    const parentOrderMap = new Map(
      parentOrders.map((p) => [String(p._id), p]),
    );

    const resolveOrderReceivableWithPacking = (sellerOrderDoc) => {
      const baseReceivable = resolveSellerReceivable(sellerOrderDoc?.pricing);
      const packingFeeStored = Number(sellerOrderDoc?.pricing?.packingFee || 0);
      if (packingFeeStored > 0) return num(baseReceivable);

      const parent = sellerOrderDoc?.parentOrderId
        ? parentOrderMap.get(String(sellerOrderDoc.parentOrderId))
        : null;
      const parentPackingFee = Number(parent?.pricing?.packagingFee || 0);
      const parentSubtotal = Number(parent?.pricing?.subtotal || 0);
      const sellerSubtotal = Number(sellerOrderDoc?.pricing?.subtotal || 0);

      const allocatedPackingFee =
        parentSubtotal > 0
          ? Number(
              ((parentPackingFee * sellerSubtotal) / parentSubtotal).toFixed(2),
            )
          : parentPackingFee;

      return num(baseReceivable) + num(allocatedPackingFee);
    };

    // Source of truth: delivered SellerOrders (net receivable after return clawbacks).
    const orderNetEarnings = orders.reduce((sum, o) => {
      const receivable = resolveOrderReceivableWithPacking(o);
      return sum + num(receivable);
    }, 0);

    // Pickup fees are extra debits outside SellerOrder receivable.
    const returnPickupFeeTotal = transactions
      .filter((item) => String(item.type || "") === "RETURN_PICKUP_FEE")
      .reduce((sum, item) => sum + num(item.amount), 0);

    // Legacy returns: receivable may not have been clawed yet — include RETURN_REFUND once.
    const legacyReturnRefundTotal = transactions
      .filter((item) => String(item.type || "") === "RETURN_REFUND")
      .reduce((sum, item) => sum + num(item.amount), 0);

    const clawedReceivableTotal = await SellerReturn.aggregate([
      {
        $match: {
          sellerId: new mongoose.Types.ObjectId(String(sellerId)),
          "finance.sellerReceivableAdjusted": true,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$finance.sellerReceivableClawed", 0] } },
        },
      },
    ])
      .then((rows) => num(rows?.[0]?.total))
      .catch(() => 0);

    // If receivable already clawed, ignore RETURN_REFUND txns to avoid double-counting.
    const returnRefundForBalance =
      clawedReceivableTotal > 0 ? 0 : legacyReturnRefundTotal;

    const totalNetEarnings = Math.max(
      0,
      orderNetEarnings + returnPickupFeeTotal + returnRefundForBalance,
    );

    const grossSales = orders.reduce(
      (sum, o) => sum + num(o.pricing?.subtotal),
      0,
    );
    const totalCommission = orders.reduce(
      (sum, o) => sum + num(o.pricing?.commission),
      0,
    );
    const totalCouponDiscount = orders.reduce(
      (sum, o) => sum + num(o.pricing?.couponDiscount),
      0,
    );
    const totalPackingFee = orders.reduce((sum, o) => {
      const stored = num(o.pricing?.packingFee);
      if (stored > 0) return sum + stored;
      // Legacy rows: packing is inside receivable after product earnings.
      const receivable = num(o.pricing?.receivable);
      const productEarnings = Number.isFinite(Number(o.pricing?.productEarnings))
        ? num(o.pricing.productEarnings)
        : num(o.pricing?.subtotal) - num(o.pricing?.commission) - num(o.pricing?.couponDiscount);
      return sum + Math.max(0, receivable - productEarnings);
    }, 0);
    const deliveryFees = orders.reduce(
      (sum, o) =>
        sum + Math.max(0, num(o.pricing?.total) - num(o.pricing?.subtotal)),
      0,
    );

    const totalWithdrawn = transactions
      .filter((item) => item.type === "Withdrawal" && item.status === "Settled")
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);
    const pendingPayouts = transactions
      .filter(
        (item) =>
          item.type === "Withdrawal" &&
          ["Pending", "Processing"].includes(String(item.status || "")),
      )
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

    // Ledger can be negative after seller coupons; withdrawable balance stays non-negative.
    const settledBalance = Math.max(
      0,
      totalNetEarnings - totalWithdrawn - pendingPayouts,
    );

    // Ledger: override/construct "Order Payment" credits using the same packing-fee-aware receivable.
    // This keeps the ledger consistent with wallet balances.
    const nonOrderPaymentTxns = transactions.filter(
      (t) => t.type !== "Order Payment",
    );

    const orderPaymentTxns = orders.map((o) => {
      const orderId = String(o?.orderId || "");
      const existing = transactions.find(
        (t) => t.type === "Order Payment" && String(t.orderId || t.reference || "") === orderId,
      );

      const amount = resolveOrderReceivableWithPacking(o);
      const createdAt =
        existing?.createdAt || o?.deliveredAt || o?.updatedAt || o?.createdAt;

      if (existing) {
        return {
          ...existing,
          amount,
          status: "Settled",
          customer: o?.customer?.name || existing.customer || "Customer",
          createdAt,
        };
      }

      return {
        _id: o._id,
        reference: orderId,
        orderId,
        type: "Order Payment",
        amount,
        status: "Settled",
        customer: o?.customer?.name || "Customer",
        createdAt,
      };
    });

    const mergedLedger = [...nonOrderPaymentTxns, ...orderPaymentTxns].sort(
      (a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      },
    );

    const balances = {
      totalRevenue: totalNetEarnings, // Keeping field name for backward compatibility
      totalNetEarnings,
      grossSales,
      totalCommission,
      totalCouponDiscount,
      totalPackingFee,
      deliveryFees,
      totalWithdrawn,
      settledBalance,
      pendingPayouts,
    };

    return res.json({
      success: true,
      result: {
        balances,
        monthlyChart:
          orderPaymentTxns.length > 0
            ? monthlyRevenueChart(orderPaymentTxns)
            : monthlyRevenueChartFromOrders(orders),
        ledger: serializeLedger(mergedLedger),
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load earnings");
  }
};

export const requestSellerWithdrawalController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    // Ensure Order Payment credits exist for delivered legs before validating withdrawals.
    await reconcileSellerDeliveredOrders(sellerId);
    const amount = Math.abs(num(req.body?.amount));
    const requestedMethod = str(
      req.body?.paymentMethod || req.body?.method,
    ).toLowerCase();
    if (!amount) {
      return sendError(res, 400, "Enter a valid withdrawal amount");
    }

    const seller = await Seller.findById(sellerId).select("bankInfo").lean();

    const bankInfo = seller?.bankInfo || {};
    const hasUpi = Boolean(str(bankInfo.upiId));
    const hasBank =
      Boolean(str(bankInfo.bankName)) &&
      Boolean(str(bankInfo.accountHolderName)) &&
      Boolean(str(bankInfo.accountNumber)) &&
      Boolean(str(bankInfo.ifscCode));
    const paymentMethod =
      requestedMethod === "upi" && hasUpi
        ? "upi"
        : hasBank
          ? "bank_transfer"
          : hasUpi
            ? "upi"
            : "";

    if (!paymentMethod) {
      return sendError(
        res,
        400,
        "Add a bank account or UPI ID before requesting withdrawal",
      );
    }

    // Same source of truth as earnings "Available Balance" (orders + pickup fees − withdrawals).
    const balance = await computeSellerSettledWithdrawBalance(sellerId);
    const effectiveAvailable = Math.max(0, Number(balance.available || 0));

    if (amount > effectiveAvailable) {
      return sendError(
        res,
        400,
        `Insufficient balance. Available: ${currency(effectiveAvailable)}`,
      );
    }

    const feeSettings = await getActiveFeeSettings();
    const minWithdrawal = Math.max(0, Number(feeSettings?.minWithdrawalAmount || 0));
    const maxWithdrawal = Math.max(0, Number(feeSettings?.maxWithdrawalAmount || 0));
    if (minWithdrawal > 0 && amount < minWithdrawal) {
      return sendError(
        res,
        400,
        `Minimum withdrawal amount is ${currency(minWithdrawal)}`,
      );
    }
    if (maxWithdrawal > 0 && amount > maxWithdrawal) {
      return sendError(
        res,
        400,
        `Maximum withdrawal amount is ${currency(maxWithdrawal)}`,
      );
    }

    const created = await SellerTransaction.create({
      sellerId,
      type: "Withdrawal",
      amount: -amount,
      status: "Pending",
      reference: `WDR-${Date.now()}`,
      customer: paymentMethod === "upi" ? "UPI Transfer" : "Bank Transfer",
      paymentMethod,
      bankDetails: {
        bankName: bankInfo.bankName || "",
        accountHolderName: bankInfo.accountHolderName || "",
        accountNumber: bankInfo.accountNumber || "",
        accountNumberLast4: String(bankInfo.accountNumber || "").slice(-4),
        ifscCode: bankInfo.ifscCode || "",
        upiId: bankInfo.upiId || "",
        upiQrImage: bankInfo.upiQrImage || "",
      },
    });

    try {
      const { notifyAdminsSafely } = await import(
        "../../../../core/notifications/firebase.service.js"
      );
      const { emitAdminBellRefresh } = await import(
        "../../../../core/notifications/ownerInboxNotify.js"
      );
      void notifyAdminsSafely({
        title: "Seller withdrawal request",
        body: `₹${amount} withdrawal requested by a seller.`,
        data: {
          type: "seller_withdrawal",
          id: String(created._id),
          link: "/admin/quick-commerce/withdrawals",
        },
      });
      void emitAdminBellRefresh({ type: "seller_withdrawal" });
    } catch (err) {
      console.warn("Failed to notify admins of seller withdrawal:", err?.message);
    }

    return res.status(201).json({ success: true, result: created.toObject() });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to create withdrawal");
  }
};

export const getSellerWithdrawalSettingsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const [feeSettings, seller] = await Promise.all([
      getActiveFeeSettings(),
      Seller.findById(sellerId).select("bankInfo").lean(),
    ]);
    const bankInfo = seller?.bankInfo || {};
    return res.json({
      success: true,
      result: {
        minWithdrawalAmount: Math.max(0, Number(feeSettings?.minWithdrawalAmount || 0)),
        maxWithdrawalAmount: Math.max(0, Number(feeSettings?.maxWithdrawalAmount || 0)),
        bankInfo: {
          bankName: bankInfo.bankName || "",
          accountHolderName: bankInfo.accountHolderName || "",
          accountNumber: bankInfo.accountNumber || "",
          accountNumberLast4: String(bankInfo.accountNumber || "").slice(-4),
          ifscCode: bankInfo.ifscCode || "",
          accountType: bankInfo.accountType || "",
          upiId: bankInfo.upiId || "",
          upiQrImage: bankInfo.upiQrImage || "",
        },
        hasUpi: Boolean(String(bankInfo.upiId || "").trim()),
        hasBank:
          Boolean(String(bankInfo.bankName || "").trim()) &&
          Boolean(String(bankInfo.accountHolderName || "").trim()) &&
          Boolean(String(bankInfo.accountNumber || "").trim()) &&
          Boolean(String(bankInfo.ifscCode || "").trim()),
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load withdrawal settings");
  }
};

export const getSellerStatsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const range = str(req.query?.range, "daily").toLowerCase();
    const [orders, products, transactions] = await Promise.all([
      SellerOrder.find({ sellerId }).sort({ createdAt: -1 }).lean(),
      populateProductQuery(SellerProduct.find({ sellerId })).lean(),
      SellerTransaction.find({ sellerId }).sort({ createdAt: -1 }).lean(),
    ]);

    const deliveredOrders = orders.filter((o) => o.status === "delivered");

    const totalSales = deliveredOrders.reduce(
      (sum, order) =>
        sum +
        resolveSellerReceivable(order?.pricing),
      0,
    );
    const totalOrders = deliveredOrders.length;
    const avgOrderValue = totalOrders ? totalSales / totalOrders : 0;

    const chartBuckets = new Map();
    const now = new Date();
    if (range === "monthly") {
      for (let offset = 5; offset >= 0; offset -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        chartBuckets.set(`${date.getFullYear()}-${date.getMonth()}`, {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          name: date.toLocaleDateString("en-IN", { month: "short" }),
          sales: 0,
          traffic: 0,
        });
      }
    } else if (range === "weekly") {
      for (let offset = 3; offset >= 0; offset -= 1) {
        chartBuckets.set(`week-${offset}`, {
          key: `week-${offset}`,
          name: `W${4 - offset}`,
          sales: 0,
          traffic: 0,
        });
      }
    } else {
      for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date(now);
        date.setDate(now.getDate() - offset);
        chartBuckets.set(
          `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
          {
            key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
            name: date.toLocaleDateString("en-IN", { weekday: "short" }),
            sales: 0,
            traffic: 0,
          },
        );
      }
    }

    orders.forEach((order) => {
      const createdAt = order.createdAt ? new Date(order.createdAt) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;

      const key =
        range === "monthly"
          ? `${createdAt.getFullYear()}-${createdAt.getMonth()}`
          : range === "weekly"
            ? `week-${Math.min(
              3,
              Math.floor((now - createdAt) / (7 * 24 * 60 * 60 * 1000)),
            )}`
            : `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;

      const bucket = chartBuckets.get(key);
      if (!bucket) return;

      // Sales chart should only reflect earnings from delivered orders
      if (order.status === "delivered") {
        const receivable = resolveSellerReceivable(order?.pricing);
        bucket.sales += receivable;
      }
      bucket.traffic += 1;
    });

    const categoryMixMap = new Map();
    products.forEach((product) => {
      const label =
        product?.categoryId?.name || product?.subcategoryId?.name || "Catalog";
      categoryMixMap.set(label, (categoryMixMap.get(label) || 0) + 1);
    });

    const topProductsMap = new Map();
    deliveredOrders.forEach((order) => {
      arr(order.items).forEach((item) => {
        const name = str(item.name, "Item");
        if (!topProductsMap.has(name)) {
          topProductsMap.set(name, { name, sales: 0, revenue: 0 });
        }
        const current = topProductsMap.get(name);
        current.sales += num(item.quantity, 1);
        current.revenue += num(item.price) * num(item.quantity, 1);
      });
    });

    const balances = {
      totalRevenue: transactions
        .filter((item) => item.type === "Order Payment")
        .reduce((sum, item) => sum + num(item.amount), 0),
    };

    return res.json({
      success: true,
      result: {
        overview: {
          totalSales: currency(totalSales),
          totalOrders: String(totalOrders),
          avgOrderValue: currency(avgOrderValue),
          conversionRate: `${Math.max(
            0,
            Math.min(
              99,
              Math.round(
                products.length ? (totalOrders / products.length) * 25 : 0,
              ),
            ),
          )}%`,
          salesTrend: "+0%",
          ordersTrend: "+0%",
        },
        salesTrend: Array.from(chartBuckets.values()),
        categoryMix: Array.from(categoryMixMap.entries()).map(
          ([subject, count]) => ({
            subject,
            A: count,
          }),
        ),
        topProducts: Array.from(topProductsMap.values())
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5)
          .map((item) => ({
            ...item,
            revenue: currency(item.revenue),
            trend: Math.max(0, Math.round(item.sales * 1.5)),
          })),
        trafficSources: [
          {
            name: "Direct",
            value: totalOrders ? Math.max(1, Math.round(totalOrders * 0.5)) : 0,
            color: "#0f172a",
          },
          {
            name: "Repeat",
            value: totalOrders ? Math.max(1, Math.round(totalOrders * 0.3)) : 0,
            color: "#16a34a",
          },
          {
            name: "Search",
            value: totalOrders ? Math.max(1, Math.round(totalOrders * 0.2)) : 0,
            color: "#2563eb",
          },
        ],
        insights: {
          topCity: orders[0]?.address?.city || "Local",
          peakTime: orders[0]?.createdAt
            ? `${String(new Date(orders[0].createdAt).getHours()).padStart(
              2,
              "0",
            )}:00`
            : "12:00",
          topDevice: balances.totalRevenue > 0 ? "Mobile" : "N/A",
        },
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load stats");
  }
};

export const listSellerCouponsController = async (req, res, next) => {
  try {
    const sellerId = sellerScope(req);
    const { listSellerCoupons } = await import("../services/sellerCoupon.service.js");
    const coupons = await listSellerCoupons(sellerId);
    return sendResponse(res, 200, "Coupons fetched successfully", coupons);
  } catch (error) {
    next(error);
  }
};

export const createSellerCouponController = async (req, res, next) => {
  try {
    const sellerId = sellerScope(req);
    const { createSellerCoupon } = await import("../services/sellerCoupon.service.js");
    const coupon = await createSellerCoupon(sellerId, req.body || {});
    return sendResponse(res, 201, "Coupon created and pending approval", coupon);
  } catch (error) {
    next(error);
  }
};

export const updateSellerCouponController = async (req, res, next) => {
  try {
    const sellerId = sellerScope(req);
    const couponId = req.params.id;
    const { updateSellerCoupon } = await import("../services/sellerCoupon.service.js");
    const coupon = await updateSellerCoupon(sellerId, couponId, req.body || {});
    return sendResponse(res, 200, "Coupon updated and pending approval", coupon);
  } catch (error) {
    next(error);
  }
};

export const deleteSellerCouponController = async (req, res, next) => {
  try {
    const sellerId = sellerScope(req);
    const couponId = req.params.id;
    const { deleteSellerCoupon } = await import("../services/sellerCoupon.service.js");
    const result = await deleteSellerCoupon(sellerId, couponId);
    return sendResponse(res, 200, "Coupon deleted successfully", result);
  } catch (error) {
    next(error);
  }
};

export const deleteSellerAccountController = async (req, res, next) => {
  try {
    const sellerId = sellerScope(req);
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return sendError(res, 404, "Seller profile not found");
    }

    // Soft delete
    seller.isDeleted = true;
    seller.accountStatus = "deleted";
    seller.isActive = false;
    await seller.save();

    // Invalidate/delete all active refresh tokens for this seller
    const { FoodRefreshToken } = await import("../../../../core/refreshTokens/refreshToken.model.js");
    await FoodRefreshToken.deleteMany({ userId: sellerId });

    return sendResponse(res, 200, "Seller account soft deleted successfully");
  } catch (error) {
    next(error);
  }
};


const parseCSV = (text) => {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row.map(cell => cell.trim()));
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row.map(cell => cell.trim()));
  }
  return lines;
};

export const bulkUploadSellerProductsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const seller = await Seller.findById(sellerId).select("shopInfo.businessType approvalStatus").lean();
    const sellerBusinessType = String(seller?.shopInfo?.businessType || "").trim().toLowerCase();
    const isPharmacy = sellerBusinessType === "pharmacy" || sellerBusinessType === "pharmacies";

    if (!req.file) {
      return sendError(res, 400, "Please upload a CSV file");
    }

    const csvText = req.file.buffer.toString("utf-8");
    const rows = parseCSV(csvText);

    if (rows.length < 2) {
      return sendError(res, 400, "CSV file is empty or only contains headers");
    }

    if (rows.length - 1 > MAX_BULK_CSV_PRODUCTS * 20) {
      return sendError(
        res,
        400,
        `CSV is too large. Maximum ${MAX_BULK_CSV_PRODUCTS} products per upload.`,
      );
    }

    const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());

    // ─── Aliases ────────────────────────────────────────────────────────────
    const nameAliases = ["name", "title", "product title", "productname"];
    const descriptionAliases = ["description", "about", "about this item", "aboutitem", "desc"];
    const brandAliases = ["brand", "brand name", "brandname"];
    const skuAliases = ["sku", "product code", "productcode", "code"];
    const priceAliases = ["price", "standard price", "selling price"];
    const salePriceAliases = ["saleprice", "sale price", "discounted price", "discountedprice"];
    const stockAliases = ["stock", "quantity", "qty", "stock level", "inventory"];
    const lowStockAlertAliases = ["lowstockalert", "low stock alert", "alert limit"];
    const headerIdAliases = ["headerid", "header_id", "main group id", "maingroupid"];
    const headerAliases = ["header", "main group", "maingroup", "group"];
    const categoryIdAliases = ["categoryid", "category_id", "specific category id"];
    const categoryAliases = ["category", "specific category", "specificcategory"];
    const subcategoryIdAliases = ["subcategoryid", "subcategory_id", "sub-category id"];
    const subcategoryAliases = ["subcategory", "sub-category", "sub category"];
    const mainImageAliases = ["mainimage", "main image", "cover photo", "image url", "image"];
    const galleryImagesAliases = ["galleryimages", "gallery images", "photos", "additional images"];
    const statusAliases = ["status", "state", "publish status"];
    const variantNameAliases = ["variantname", "variant name", "weight", "size", "unit"];
    const variantPriceAliases = ["variantprice", "variant price"];
    const variantSalePriceAliases = ["variantsaleprice", "variant sale price", "variant discounted price"];
    const variantStockAliases = ["variantstock", "variant stock", "variant quantity"];
    const variantSkuAliases = ["variantsku", "variant sku", "variant code"];
    const variantsAliases = ["variants", "variant list"];
    const tagsAliases = ["tags", "product tags"];
    const genericNameAliases = ["genericname", "generic name", "salt"];
    const manufacturerAliases = ["manufacturer", "company", "maker"];
    const compositionAliases = ["composition", "ingredients"];
    const strengthAliases = ["strength", "dose strength"];
    const dosageFormAliases = ["dosageform", "dosage form", "form"];
    const packTypeAliases = ["packtype", "pack type", "packaging"];
    const packQuantityAliases = ["packquantity", "pack quantity", "qty per pack"];
    const unitAliases = ["unit", "measurement unit"];
    const storageConditionAliases = ["storagecondition", "storage condition", "storage"];
    const prescriptionRequiredAliases = ["prescriptionrequired", "prescription required", "rx required"];
    const drugClassificationAliases = ["drugclassification", "drug classification", "schedule"];
    const drugLicenseNumberAliases = ["druglicensenumber", "drug license number", "dl number"];
    const hsnCodeAliases = ["hsncode", "hsn code", "hsn"];
    const batchNumberAliases = ["batchnumber", "batch number", "batch no"];
    const mfgDateAliases = ["mfgdate", "mfg date", "manufacturing date"];
    const expDateAliases = ["expdate", "exp date", "expiry date"];
    const packSizeAliases = ["packsize", "pack size"];

    // ─── Check required header ───────────────────────────────────────────────
    const hasAnyHeader = (aliases) => aliases.some((a) => headers.includes(a.toLowerCase()));

    if (!hasAnyHeader(nameAliases)) {
      return sendError(res, 400, "CSV is missing the product title/name column.");
    }

    // ─── Helper: get value by aliases ────────────────────────────────────────
    const getVal = (row, aliases) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toLowerCase());
        if (idx !== -1) return String(row[idx] || "").trim();
      }
      return "";
    };

    // ─── Load categories once ────────────────────────────────────────────────
    const dbCategories = await QuickCategory.find({
      isActive: { $ne: false },
      status: { $ne: 'inactive' },
    }).lean();
    const categoriesMap = new Map(dbCategories.map((c) => [String(c._id), c]));

    // FIX: O(1) category name lookup instead of O(n) .find() per product
    const categoryNameMap = new Map(
      dbCategories.map((c) => [
        `${c.type}:${String(c.parentId || "")}:${String(c.name || "").trim().toLowerCase()}`,
        c,
      ])
    );

    const findCategoryByName = (name, type, parentId = null) => {
      const key = `${type}:${String(parentId || "")}:${String(name || "").trim().toLowerCase()}`;
      return categoryNameMap.get(key) || null;
    };

    // ─── Group rows by product name ──────────────────────────────────────────
    const errors = [];
    const productGroups = new Map();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || (row.length === 1 && !row[0])) continue;

      const rowNum = i + 1;
      const name = getVal(row, nameAliases);

      if (!name) {
        errors.push(`Row ${rowNum}: Product Title/Name is required.`);
        continue;
      }

      const nameKey = name.toLowerCase().trim();
      if (!productGroups.has(nameKey)) productGroups.set(nameKey, []);
      productGroups.get(nameKey).push({ row, rowNum });
    }

    // ─── Validate all product groups, collect errors first ──────────────────
    const productsToCreate = [];

    for (const [, group] of productGroups) {
      if (errors.length > 100) {
        errors.push("Too many validation errors. Showing first 100.");
        break;
      }

      const firstItem = group[0];
      const firstRow = firstItem.row;
      const mainRowNum = firstItem.rowNum;

      const name = getVal(firstRow, nameAliases);
      const description = getVal(firstRow, descriptionAliases);
      const brand = getVal(firstRow, brandAliases);
      const statusStr = getVal(firstRow, statusAliases).toLowerCase();
      const lowStockAlertStr = getVal(firstRow, lowStockAlertAliases) || "5";
      const mainImage = getVal(firstRow, mainImageAliases);
      const galleryImagesStr = getVal(firstRow, galleryImagesAliases);

      const groupErrors = [];

      let pharmacyDetails = undefined;
      if (isPharmacy) {
        const genericName = getVal(firstRow, genericNameAliases);
        const manufacturer = getVal(firstRow, manufacturerAliases);
        const dosageForm = getVal(firstRow, dosageFormAliases) || "tablet";
        const packType = getVal(firstRow, packTypeAliases) || "strip";
        const packQuantity = parseInt(getVal(firstRow, packQuantityAliases), 10) || 10;
        const unit = getVal(firstRow, unitAliases) || "tablet";

        if (!genericName || !manufacturer) {
          groupErrors.push(`Row ${mainRowNum}: Generic Name and Manufacturer are required for medicines.`);
        }

        pharmacyDetails = {
          genericName,
          manufacturer,
          composition: getVal(firstRow, compositionAliases),
          strength: getVal(firstRow, strengthAliases),
          dosageForm,
          packType,
          packQuantity,
          unit,
          storageCondition: getVal(firstRow, storageConditionAliases),
          prescriptionRequired: getVal(firstRow, prescriptionRequiredAliases).toLowerCase() === "yes" || getVal(firstRow, prescriptionRequiredAliases).toLowerCase() === "true",
          drugClassification: getVal(firstRow, drugClassificationAliases) || "otc",
          drugLicenseNumber: getVal(firstRow, drugLicenseNumberAliases),
          hsnCode: getVal(firstRow, hsnCodeAliases),
          batchNumber: getVal(firstRow, batchNumberAliases),
          mfgDate: getVal(firstRow, mfgDateAliases),
          expDate: getVal(firstRow, expDateAliases),
          packSize: getVal(firstRow, packSizeAliases),
        };
      }

      if (statusStr && statusStr !== "active" && statusStr !== "inactive") {
        groupErrors.push(`Row ${mainRowNum}: Status must be either 'active' or 'inactive'.`);
      }

      const lowStockAlert = parseInt(lowStockAlertStr, 10);
      if (lowStockAlertStr && (isNaN(lowStockAlert) || lowStockAlert < 0)) {
        groupErrors.push(
          `Row ${mainRowNum}: Low Stock Alert must be a valid number greater than or equal to 0.`
        );
      }

      let resolvedHeaderId = null;
      let resolvedCategoryId = null;
      let resolvedSubcategoryId = null;

      const headerIdStr = getVal(firstRow, headerIdAliases);
      const headerNameStr = getVal(firstRow, headerAliases);
      const categoryIdStr = getVal(firstRow, categoryIdAliases);
      const categoryNameStr = getVal(firstRow, categoryAliases);
      const subcategoryIdStr = getVal(firstRow, subcategoryIdAliases);
      const subcategoryNameStr = getVal(firstRow, subcategoryAliases);

      if (headerIdStr && mongoose.Types.ObjectId.isValid(headerIdStr)) {
        const node = categoriesMap.get(headerIdStr);
        if (node && node.type === "header") resolvedHeaderId = headerIdStr;
      }
      if (!resolvedHeaderId && headerNameStr) {
        const node = findCategoryByName(headerNameStr, "header");
        if (node) resolvedHeaderId = String(node._id);
      }
      if (!resolvedHeaderId) {
        groupErrors.push(
          `Row ${mainRowNum}: Main Group (headerId or name) is missing, invalid, or does not exist.`
        );
      }

      if (resolvedHeaderId) {
        const headerNode = categoriesMap.get(resolvedHeaderId);
        if (headerNode && !headerMatchesSellerBusinessType(headerNode, sellerBusinessType)) {
          groupErrors.push(
            `Row ${mainRowNum}: Main Group "${headerNode.name}" does not match your business type (${isPharmacy ? "Pharmacy" : "Quick Commerce"}).`,
          );
          resolvedHeaderId = null;
        }
      }

      if (resolvedHeaderId) {
        if (categoryIdStr && mongoose.Types.ObjectId.isValid(categoryIdStr)) {
          const node = categoriesMap.get(categoryIdStr);
          if (node && node.type === "category" && String(node.parentId) === resolvedHeaderId) {
            resolvedCategoryId = categoryIdStr;
          }
        }
        if (!resolvedCategoryId && categoryNameStr) {
          const node = findCategoryByName(categoryNameStr, "category", resolvedHeaderId);
          if (node) resolvedCategoryId = String(node._id);
        }
      }
      if (!resolvedCategoryId) {
        groupErrors.push(
          `Row ${mainRowNum}: Specific Category (categoryId or name) is missing, invalid, or does not belong to the selected Main Group.`
        );
      }

      if (resolvedCategoryId) {
        if (subcategoryIdStr && mongoose.Types.ObjectId.isValid(subcategoryIdStr)) {
          const node = categoriesMap.get(subcategoryIdStr);
          if (
            node &&
            node.type === "subcategory" &&
            String(node.parentId) === resolvedCategoryId
          ) {
            resolvedSubcategoryId = subcategoryIdStr;
          }
        }
        if (!resolvedSubcategoryId && subcategoryNameStr) {
          const node = findCategoryByName(subcategoryNameStr, "subcategory", resolvedCategoryId);
          if (node) resolvedSubcategoryId = String(node._id);
        }
      }
      if (!resolvedSubcategoryId) {
        groupErrors.push(
          `Row ${mainRowNum}: Sub-Category (subcategoryId or name) is missing, invalid, or does not belong to the selected Category.`
        );
      }

      if (mainImage && !/^https?:\/\/.+/i.test(mainImage)) {
        groupErrors.push(
          `Row ${mainRowNum}: Main Cover Photo URL is invalid. It must start with http:// or https://.`
        );
      }

      const galleryImages = [];
      if (galleryImagesStr) {
        const urls = galleryImagesStr
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean);
        for (const url of urls) {
          if (!/^https?:\/\/.+/i.test(url)) {
            groupErrors.push(
              `Row ${mainRowNum}: Gallery image URL '${url}' is invalid. It must start with http:// or https://.`
            );
          } else {
            galleryImages.push(url);
          }
        }
      }

      const variantsList = [];

      for (const { row, rowNum } of group) {
        const inlineVariantsStr = getVal(row, variantsAliases);

        if (inlineVariantsStr) {
          let inlineList = [];

          if (inlineVariantsStr.startsWith("[")) {
            try {
              inlineList = JSON.parse(inlineVariantsStr);
            } catch {
              groupErrors.push(`Row ${rowNum}: Invalid JSON format in variants column.`);
            }
          } else {
            const parts = inlineVariantsStr
              .split(/[;/]/)
              .map((p) => p.trim())
              .filter(Boolean);
            parts.forEach((part) => {
              const subParts = part.split(":").map((sp) => sp.trim());
              inlineList.push({
                name: subParts[0],
                price: parseFloat(subParts[1] || "0"),
                salePrice: parseFloat(subParts[2] || subParts[1] || "0"),
                stock: parseInt(subParts[3] || "0", 10),
              });
            });
          }

          inlineList.forEach((v, vIdx) => {
            const vLabel = `${rowNum} (variant #${vIdx + 1})`;
            const vName = v.name || "Default";
            const vPrice = parseFloat(v.price);
            const vSalePrice = parseFloat(v.salePrice ?? v.price);
            const vStock = parseInt(v.stock, 10);

            if (isNaN(vPrice) || vPrice < 0)
              groupErrors.push(`Row ${vLabel}: Variant price must be a valid number >= 0.`);
            if (isNaN(vSalePrice) || vSalePrice < 0)
              groupErrors.push(`Row ${vLabel}: Variant discounted price must be a valid number >= 0.`);
            if (isNaN(vStock) || vStock < 0)
              groupErrors.push(`Row ${vLabel}: Variant stock must be a valid number >= 0.`);

            variantsList.push({
              name: vName,
              price: isNaN(vPrice) ? 0 : vPrice,
              salePrice: isNaN(vSalePrice) ? (isNaN(vPrice) ? 0 : vPrice) : vSalePrice,
              stock: isNaN(vStock) ? 0 : vStock,
            });
          });
        } else {
          const vName = getVal(row, variantNameAliases) || "Default";
          const priceStr = getVal(row, variantPriceAliases) || getVal(row, priceAliases);
          const salePriceStr = getVal(row, variantSalePriceAliases) || getVal(row, salePriceAliases);
          const stockStr = getVal(row, variantStockAliases) || getVal(row, stockAliases);

          const price = parseFloat(priceStr);
          const salePrice = salePriceStr ? parseFloat(salePriceStr) : price;
          const stock = parseInt(stockStr, 10);

          if (isNaN(price) || price < 0)
            groupErrors.push(`Row ${rowNum}: Price must be a valid number >= 0.`);
          if (salePriceStr && (isNaN(salePrice) || salePrice < 0))
            groupErrors.push(`Row ${rowNum}: Discounted Price must be a valid number >= 0.`);
          if (isNaN(stock) || stock < 0)
            groupErrors.push(`Row ${rowNum}: Stock must be a valid number >= 0.`);

          variantsList.push({
            name: vName,
            price: isNaN(price) ? 0 : price,
            salePrice: isNaN(salePrice) ? (isNaN(price) ? 0 : price) : salePrice,
            stock: isNaN(stock) ? 0 : stock,
          });
        }
      }

      if (variantsList.length === 0) {
        groupErrors.push(`Row ${mainRowNum}: Product must have at least one variant.`);
      }

      errors.push(...groupErrors);

      if (groupErrors.length === 0 && errors.length === 0) {
        // Generate unique main SKU based on product name
        const cleanName = String(name || "")
          .toUpperCase()
          .trim()
          .replace(/[^A-Z0-9\s-]/g, "")
          .replace(/[\s-]+/g, "-");
        
        const baseSku = `SKU-${cleanName}`.substring(0, 40);
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const productSku = `${baseSku}-${randomSuffix}`;

        // Map SKUs to variants list with name-based suffixes
        const finalizedVariants = [];
        const variantSkuSet = new Set();
        variantsList.forEach((v, idx) => {
          const vName = v.name || "Default";
          let vSkuSuffix = `V${idx + 1}`;
          if (vName && vName.toLowerCase() !== "default") {
            const cleanVariant = String(vName)
              .toUpperCase()
              .trim()
              .replace(/[^A-Z0-9\s-]/g, "")
              .replace(/[\s-]+/g, "-");
            if (cleanVariant) {
              vSkuSuffix = cleanVariant;
            }
          }
          let proposedSku = `${productSku}-${vSkuSuffix}`;
          if (variantSkuSet.has(proposedSku)) {
            proposedSku = `${productSku}-${vSkuSuffix}-V${idx + 1}`;
          }
          variantSkuSet.add(proposedSku);
          finalizedVariants.push({
            ...v,
            sku: proposedSku
          });
        });

        const firstVariant = finalizedVariants[0];
        const finalSlug = `${slugify(name)}-${Math.random().toString(36).substring(2, 7)}`;
        const status = statusStr === "inactive" ? "inactive" : "active";
        const tagsStr = getVal(firstRow, tagsAliases);
        const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];
        const totalStock = finalizedVariants.reduce(
          (sum, v) => sum + Math.max(0, num(v.stock)),
          0,
        );
        const isDefaultVariantOnly =
          finalizedVariants.length === 1 &&
          String(finalizedVariants[0].name || "").trim() === "Default";
        const parentStock = isDefaultVariantOnly
          ? Math.max(0, num(firstVariant.stock))
          : totalStock;

        if (productsToCreate.length >= MAX_BULK_CSV_PRODUCTS) {
          errors.push(
            `Row ${i + 1}: Exceeded maximum of ${MAX_BULK_CSV_PRODUCTS} products per upload.`,
          );
          break;
        }

        productsToCreate.push({
          sellerId,
          name,
          slug: finalSlug,
          sku: productSku,
          description,
          price: firstVariant.price,
          salePrice: firstVariant.salePrice,
          mrp: Math.max(num(firstVariant.salePrice), num(firstVariant.price)),
          stock: parentStock,
          lowStockAlert: isNaN(lowStockAlert) ? 5 : lowStockAlert,
          brand,
          weight: firstVariant.name !== "Default" ? firstVariant.name : "",
          unit: firstVariant.name !== "Default" ? firstVariant.name : "",
          tags,
          mainImage: mainImage || "",
          image: mainImage || "",
          galleryImages,
          headerId: new mongoose.Types.ObjectId(resolvedHeaderId),
          categoryId: new mongoose.Types.ObjectId(resolvedCategoryId),
          subcategoryId: new mongoose.Types.ObjectId(resolvedSubcategoryId),
          status,
          isActive: status === "active",
          approvalStatus: seller.approvalStatus === "approved" ? "approved" : "pending",
          approvedAt: seller.approvalStatus === "approved" ? new Date() : null,
          pharmacyDetails,
          variants: finalizedVariants,
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "CSV Validation Failed",
        errors,
      });
    }

    // ─── Batch insert all products in one DB call ────────────────────────────
    const createdProducts = await SellerProduct.insertMany(productsToCreate);

    // FIX: Run all notification syncs in parallel instead of sequential awaits
    await Promise.all(
      createdProducts.map((product) => syncSellerInventoryNotification(sellerId, product))
    );

    const totalVariants = createdProducts.reduce((sum, p) => sum + p.variants.length, 0);

    return res.json({
      success: true,
      message: `Successfully imported ${createdProducts.length} products with a total of ${totalVariants} variants.`,
      result: { count: createdProducts.length },
    });
  } catch (error) {
    return sendError(res, 500, error.message || "Bulk upload failed");
  }
};

export {
  parseProductPayload,
  validateProductPricing,
  sanitizePharmacyDetails,
  validatePharmacyDetails,
  sanitizePharmacyVariantMeta,
  stripPharmacyVariantMeta,
};

