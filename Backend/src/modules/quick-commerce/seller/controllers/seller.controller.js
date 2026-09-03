import ms from "ms";
import mongoose from "mongoose";
import {
  createOrUpdateOtp,
  verifyOtp,
} from "../../../../core/otp/otp.service.js";
import {
  signAccessToken,
  signRefreshToken,
} from "../../../../core/auth/token.util.js";
import { FoodRefreshToken } from "../../../../core/refreshTokens/refreshToken.model.js";
import { config } from "../../../../config/env.js";
import { getIO, rooms } from "../../../../config/socket.js";
import { logger } from "../../../../utils/logger.js";
import { uploadImageBuffer } from "../../../../services/upload.service.js";
import { sendError, sendResponse } from "../../../../utils/response.js";
import { ValidationError } from "../../../../core/auth/errors.js";
import { Seller } from "../models/seller.model.js";
import { SellerNotification } from "../models/sellerNotification.model.js";
import { SellerOrder } from "../models/sellerOrder.model.js";
import { SellerProduct } from "../models/sellerProduct.model.js";
import { SellerReturn } from "../models/sellerReturn.model.js";
import { SellerStockAdjustment } from "../models/sellerStockAdjustment.model.js";
import { SellerTransaction } from "../models/sellerTransaction.model.js";
import { QuickOrder } from "../../models/order.model.js";
import { ReturnOtp } from "../../returns/models/returnOtp.model.js";
import { FoodDeliveryPartner } from "../../../food/delivery/models/deliveryPartner.model.js";
import {
  buildDeliverySocketPayload,
  haversineKm,
  notifyOwnerSafely,
} from "../../../food/orders/services/order.helpers.js";
import { getSellerCommissionSnapshot } from "../../admin/services/commission.service.js";
import * as quickOrderService from "../../services/quickOrder.service.js";
import * as returnOtpService from "../../returns/services/returnOtp.service.js";
import {
  buildSellerProfilePatch,
  mergeSellerPendingProfileChanges,
  restoreStagedFieldsFromSnapshot,
  sellerHadPriorApproval,
  serializeSellerPendingProfileChanges,
  splitSellerReviewablePatch,
} from "../../shared/pendingProfileChanges.js";
import { upsertSellerNotification } from "../services/sellerNotify.service.js";
import {
  buildSellerCategoryTree,
  resolveSellerCategoryIds,
  syncSellerInventoryNotification,
} from "../services/sellerCatalog.service.js";
import { getActiveFeeSettings } from "../../admin/services/billing.service.js";

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
  const { commissionAmount } = await getSellerCommissionSnapshot(
    sellerId,
    sellerSubtotal,
  );
  const sellerReceivable = Math.max(
    0,
    Number((sellerSubtotal - commissionAmount).toFixed(2)),
  );

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

  return {
    orderType: order?.orderType === "mixed" ? "mixed" : "quick",
    parentOrderId: order?._id || null,
    sellerId,
    orderId: order?.orderId,
    customer: {
      name:
        order?.userId?.name ||
        addr?.name ||
        order?.customer?.name ||
        "Customer",
      phone: addr?.phone || order?.customer?.phone || "",
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
      total: sellerSubtotal + allocatedDeliveryFee,
      receivable: sellerReceivable,
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

  await Promise.all(
    missingDocs.map((doc) =>
      SellerOrder.findOneAndUpdate(
        { sellerId: doc.sellerId, orderId: doc.orderId },
        { $set: doc },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
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
  const scored = onlinePartners
    .map((partner) => {
      const lat = Number(partner.lastLat);
      const lng = Number(partner.lastLng);
      const isStale =
        !partner.lastLocationAt ||
        Date.now() - new Date(partner.lastLocationAt).getTime() > STALE_GPS_MS;

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || isStale) {
        return {
          partnerId: partner._id,
          distanceKm: null,
          score: Number.MAX_SAFE_INTEGER,
          name: partner.name || "Delivery Partner",
          phone: partner.phone || "",
        };
      }

      const distanceKm = haversineKm(origin.lat, origin.lng, lat, lng);
      return {
        partnerId: partner._id,
        distanceKm,
        score: Number.isFinite(distanceKm)
          ? distanceKm
          : Number.MAX_SAFE_INTEGER,
        name: partner.name || "Delivery Partner",
        phone: partner.phone || "",
      };
    })
    .filter(
      (partner) => partner.distanceKm == null || partner.distanceKm <= maxKm,
    )
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, limit));

  return scored;
};
const currency = (value) => `₹${num(value, 0).toLocaleString("en-IN")}`;
const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const createSellerSku = () =>
  `SKU-${Date.now().toString(36).slice(-6).toUpperCase()}`;

const serializeSellerProfile = (seller) => ({
  _id: seller._id,
  name: seller.name,
  shopName: seller.shopName,
  phone: seller.phoneLast10 || seller.phone || "",
  email: seller.email || "",
  role: "Seller",
  isActive: seller.isActive !== false,
  isVerified: seller.isVerified !== false,
  approved: seller.approved !== false,
  approvalStatus:
    seller.approvalStatus ||
    (seller.approved === false ? "pending" : "approved"),
  onboardingSubmitted: seller.onboardingSubmitted === true,
  approvalNotes: seller.approvalNotes || "",
  previousRejectionNotes: seller.previousRejectionNotes || seller.approvalNotes || "",
  isReapplied: seller.isReapplied === true || Boolean(seller.reappliedAt) || (seller.approvalStatus === "pending" && Boolean(seller.previousRejectionNotes || seller.rejectedAt)),
  reappliedAt: seller.reappliedAt || null,
  reapplicationCount: seller.reapplicationCount || 0,
  approvedAt: seller.approvedAt || null,
  rejectedAt: seller.rejectedAt || null,
  location: seller.location || null,
  serviceRadius: num(seller.serviceRadius, 5),
  address: seller.location?.formattedAddress || seller.location?.address || "",
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
    panImage: seller.documents?.panImage || "",
    gstRegistered: seller.documents?.gstRegistered === true,
    gstNumber: seller.documents?.gstNumber || "",
    gstLegalName: seller.documents?.gstLegalName || "",
    gstImage: seller.documents?.gstImage || "",
    fssaiNumber: seller.documents?.fssaiNumber || "",
    fssaiImage: seller.documents?.fssaiImage || "",
    fssaiExpiry: seller.documents?.fssaiExpiry || null,
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

const uploadFileOrBase64ToCloudinary = async (fileOrUrl, folder) => {
  if (fileOrUrl && fileOrUrl.buffer) {
    return await uploadImageBuffer(fileOrUrl.buffer, folder);
  }
  if (typeof fileOrUrl === "string" && fileOrUrl.startsWith("data:image/")) {
    const match = fileOrUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match && match[2]) {
      const buffer = Buffer.from(match[2], "base64");
      return await uploadImageBuffer(buffer, folder);
    }
  }
  return typeof fileOrUrl === "string" ? fileOrUrl : "";
};

const MAX_PRODUCT_VARIANTS = 5;
const MAX_VARIANT_IMAGES = 3;
const MIN_VARIANT_IMAGES = 1;

/**
 * Parses the seller's variants payload, uploads each variant's new image
 * files (multipart field `variantImages_<index>`), merges them with any
 * kept existing image URLs, and enforces the 1-5 variant / 1-3 image rules.
 * Every product is variant-only now — there is no separate base price/stock.
 */
const parseVariants = async (raw, req, fallback = {}) => {
  let parsed = raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = [];
    }
  }

  const list = arr(parsed).filter((variant) => str(variant?.name));
  if (list.length === 0) {
    throw new ValidationError("At least one variant is required");
  }
  if (list.length > MAX_PRODUCT_VARIANTS) {
    throw new ValidationError(`A product can have at most ${MAX_PRODUCT_VARIANTS} variants`);
  }

  const variants = [];
  for (let index = 0; index < list.length; index += 1) {
    const variant = list[index];
    const name = str(variant?.name) || `Variant ${index + 1}`;

    const existingImages = arr(variant?.images)
      .map((url) => str(url))
      .filter((url) => url.startsWith("http"));

    const newFiles = arr(req.files?.[`variantImages_${index}`]);
    const uploadedNew = newFiles.length
      ? (
          await Promise.all(
            newFiles.map((file) =>
              uploadFileOrBase64ToCloudinary(file, "quick-commerce/products/variants"),
            ),
          )
        ).filter(Boolean)
      : [];

    const images = [...existingImages, ...uploadedNew].slice(0, MAX_VARIANT_IMAGES);
    if (images.length < MIN_VARIANT_IMAGES) {
      throw new ValidationError(`"${name}" needs at least ${MIN_VARIANT_IMAGES} image`);
    }

    const price = num(variant?.price, fallback.price);
    if (!(price > 0)) {
      throw new ValidationError(`"${name}" needs a price greater than 0`);
    }

    variants.push({
      name,
      price,
      salePrice: num(variant?.salePrice, fallback.salePrice),
      stock: Math.max(0, num(variant?.stock, fallback.stock)),
      sku: str(variant?.sku) || fallback.sku || createSellerSku(),
      images,
    });
  }

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
  return {
    ...doc,
    id: doc._id,
  };
};

const sellerScope = (req) => req.user?.userId;

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
        .select("_id orderId orderStatus workflowStatus updatedAt")
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

  await Promise.all(
    updates.map((u) =>
      SellerOrder.updateOne({ _id: u.id, sellerId }, { $set: u.patch }),
    ),
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
      .select("orderId customer pricing deliveredAt updatedAt createdAt")
      .lean();

    await Promise.all(
      deliveredOrders
        .map((o) => {
          const receivable =
            Number(o?.pricing?.receivable) ||
            Math.max(
              0,
              num(o?.pricing?.subtotal) - num(o?.pricing?.commission),
            );
          if (!Number.isFinite(receivable) || receivable <= 0) return null;

          return SellerTransaction.findOneAndUpdate(
            {
              sellerId,
              type: "Order Payment",
              orderId: String(o.orderId || "").trim(),
            },
            {
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
            { upsert: true, new: true, setDefaultsOnInsert: true },
          );
        })
        .filter(Boolean),
    );
  }
};

const parseProductPayloadAsync = async (req, existingProduct = null) => {
  // Every product is variant-only now: price, stock, and photos all come
  // from the variants array — there is no separate base price/stock/photo.
  const variants = await parseVariants(req.body?.variants, req, {
    price: req.body?.price,
    salePrice: req.body?.salePrice,
    stock: req.body?.stock,
    sku: req.body?.sku,
  });
  const firstVariant = variants[0];

  const totalStock = variants.reduce((sum, v) => sum + Math.max(0, num(v.stock)), 0);
  const allVariantImages = variants.flatMap((v) => v.images);
  const mainImageUrl = allVariantImages[0] || existingProduct?.mainImage || "";
  const finalGalleryUrls = allVariantImages.slice(1);

  return {
    name: str(req.body?.name) || existingProduct?.name || "Untitled Product",
    slug:
      slugify(
        str(req.body?.slug) || str(req.body?.name) || existingProduct?.slug,
      ) || slugify(existingProduct?.name),
    sku:
      str(req.body?.sku) ||
      existingProduct?.sku ||
      firstVariant?.sku ||
      createSellerSku(),
    description:
      str(req.body?.description) || existingProduct?.description || "",
    // Price/stock/MRP always reflect the current variants — they are the
    // single source of truth, never a stale value carried over from before.
    price: firstVariant.price,
    salePrice: firstVariant.salePrice,
    stock: totalStock,
    lowStockAlert: Math.max(
      0,
      num(req.body?.lowStockAlert, existingProduct?.lowStockAlert ?? 5),
    ),
    brand: str(req.body?.brand) || existingProduct?.brand || "",
    mainImage: mainImageUrl,
    image: mainImageUrl || existingProduct?.image || "",
    galleryImages: finalGalleryUrls,
    mrp: num(req.body?.mrp, firstVariant.price ?? existingProduct?.mrp ?? 0),
    status:
      str(req.body?.status).toLowerCase() === "inactive"
        ? "inactive"
        : "active",
    isActive: str(req.body?.status).toLowerCase() === "inactive" ? false : true,
    approvalStatus: existingProduct?.approvalStatus || "pending",
    approvedAt:
      (existingProduct?.approvalStatus || "pending") === "approved"
        ? existingProduct?.approvedAt || new Date()
        : null,
    variants,
  };
};

const createAuthTokens = async (sellerId) => {
  const payload = { userId: String(sellerId), role: "SELLER" };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  const ttlMs = ms(config.jwtRefreshExpiresIn || "7d");
  const expiresAt = new Date(Date.now() + ttlMs);

  await FoodRefreshToken.create({
    userId: sellerId,
    token: refreshToken,
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

    const receivable =
      Number(order?.pricing?.receivable) ||
      Math.max(
        0,
        num(order?.pricing?.subtotal) - num(order?.pricing?.commission),
      );
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
    if (digits.length < 10) {
      return sendError(res, 400, "Enter a valid phone number");
    }

    const otp = await createOrUpdateOtp(phone);
    const shouldExposeOtp = config.useDefaultOtp;

    return sendResponse(res, 200, "OTP sent successfully", {
      phone,
      deliveryMode: shouldExposeOtp ? "debug" : "sms",
      ...(shouldExposeOtp ? { otp } : {}),
    });
  } catch (error) {
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
    let seller = await Seller.findOne({
      $or: [
        { phone },
        { phoneDigits: digits },
        ...(phoneSuffix ? [{ phoneLast10: phoneSuffix }] : []),
      ],
    });

    if (seller && seller.isDeleted) {
      if (seller.deletionRequest?.reason === 'Account self-deleted by seller') {
        return sendError(res, 403, "Account with this number earlier deleted by seller.");
      }
      return sendError(res, 403, "Your account has been deleted by admin. Please contact support.");
    }

    if (!seller) {
      return sendError(res, 404, "Seller account not found. Please register or apply for a seller account.");
    }

    seller.isVerified = true;
    seller.lastLogin = new Date();
    await seller.save();

    const { accessToken, refreshToken } = await createAuthTokens(seller._id);

    return sendResponse(res, 200, "Seller login successful", {
      accessToken,
      refreshToken,
      seller: serializeSellerProfile(seller),
    });
  } catch (error) {
    return sendError(res, 400, error.message || "OTP verification failed");
  }
};

export const getSellerCategoryTreeController = async (_req, res) => {
  try {
    const tree = await buildSellerCategoryTree();
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

    const query = { sellerId };
    if (stockStatus === "in") query.stock = { $gt: 0 };
    if (stockStatus === "out") query.stock = 0;

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
    );

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
    const basePayload = await parseProductPayloadAsync(req);
    const categoryIds = await resolveSellerCategoryIds({
      headerId: req.body?.headerId,
      categoryId: req.body?.categoryId,
      subcategoryId: req.body?.subcategoryId,
    });

    const product = await SellerProduct.create({
      sellerId,
      ...basePayload,
      ...categoryIds,
    });

    await syncSellerInventoryNotification(sellerId, product);

    const populated = await populateProductQuery(
      SellerProduct.findById(product._id),
    ).lean();

    return res
      .status(201)
      .json({ success: true, result: serializeProduct(populated) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return sendError(res, 400, error.message);
    }
    if (error?.code === 11000) {
      return sendError(res, 400, "Product slug or SKU already exists");
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

    const categoryIds = await resolveSellerCategoryIds({
      headerId: req.body?.headerId || existing.headerId,
      categoryId: req.body?.categoryId || existing.categoryId,
      subcategoryId: req.body?.subcategoryId || existing.subcategoryId,
    });

    const payload = await parseProductPayloadAsync(req, existing);

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
    if (error instanceof ValidationError) {
      return sendError(res, 400, error.message);
    }
    if (error?.code === 11000) {
      return sendError(res, 400, "Product slug or SKU already exists");
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
    const variantId = str(req.body?.variantId);
    const quantity = num(req.body?.quantity);
    const type = str(req.body?.type) || "Correction";

    const product = await SellerProduct.findOne({ _id: productId, sellerId });
    if (!product) {
      return sendError(res, 404, "Product not found");
    }
    if (!Array.isArray(product.variants) || product.variants.length === 0) {
      return sendError(res, 400, "Product has no variants to adjust");
    }

    // Adjust the requested variant (or the only one, if the product has just one).
    const variant = variantId
      ? product.variants.id(variantId)
      : product.variants.length === 1
        ? product.variants[0]
        : null;
    if (!variant) {
      return sendError(res, 400, "variantId is required for products with multiple variants");
    }

    const nextVariantStock = Math.max(0, num(variant.stock) + quantity);
    variant.stock = nextVariantStock;

    const totalStock = product.variants.reduce((sum, v) => sum + Math.max(0, num(v.stock)), 0);
    product.stock = totalStock;
    product.status = totalStock === 0 ? "inactive" : "active";
    await product.save();

    await SellerStockAdjustment.create({
      sellerId,
      productId: product._id,
      variantId: variant._id,
      variantName: variant.name,
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
    const seller = await Seller.findById(sellerScope(req)).lean();
    if (!seller) {
      return sendError(res, 404, "Seller not found");
    }

    return res.json({
      success: true,
      result: serializeSellerProfile(seller),
    });
  } catch (error) {
    return sendError(
      res,
      500,
      error.message || "Failed to load seller profile",
    );
  }
};

export const updateSellerProfileData = async (seller, req) => {
    const files = req.files && typeof req.files === 'object' ? req.files : {};
    const profileSnapshot = seller.toObject();

    if (req.body?.name !== undefined)
      seller.name = str(req.body.name) || seller.name;
    if (req.body?.shopName !== undefined)
      seller.shopName = str(req.body.shopName) || seller.shopName;
    if (req.body?.phone !== undefined) {
      const newPhone = str(req.body.phone) || seller.phone;
      seller.phone = newPhone;
      seller.phoneDigits = normalizePhone(newPhone);
      seller.phoneLast10 = last10(newPhone);
    }
    if (req.body?.email !== undefined)
      seller.email = str(req.body.email).toLowerCase();

    const lat = optionalNumber(req.body?.lat);
    const lng = optionalNumber(req.body?.lng);
    const address = str(req.body?.address);
    const radius = num(req.body?.radius, seller.serviceRadius ?? 5);
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

    seller.serviceRadius = Math.max(1, Math.min(100, radius || 5));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
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
          coordinates: [0, 0],
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

    // Upload images
    let uploadedUpiQr = "";
    const upiQrImageInput = files?.upiQrImage?.[0] || bankInfoBody.upiQrImage || req.body?.upiQrImage || req.body?.upiQrCode;
    if (upiQrImageInput !== undefined) {
      uploadedUpiQr = await uploadFileOrBase64ToCloudinary(upiQrImageInput, "seller/upi-qr");
      if (uploadedUpiQr || typeof upiQrImageInput === "string") {
        seller.bankInfo.upiQrImage = uploadedUpiQr || upiQrImageInput;
      }
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
      req.body?.shopLicenseNumber !== undefined ||
      documentsBody.shopLicenseNumber !== undefined
    ) {
      seller.documents.shopLicenseNumber = str(
        documentsBody.shopLicenseNumber ?? req.body.shopLicenseNumber,
        "",
      );
    }

    let uploadedShopLicense = "";
    const shopLicenseImageInput = files?.shopLicenseImage?.[0] || documentsBody.shopLicenseImage || req.body?.shopLicenseImage;
    if (shopLicenseImageInput !== undefined) {
      uploadedShopLicense = await uploadFileOrBase64ToCloudinary(shopLicenseImageInput, "seller/shop-license");
      if (uploadedShopLicense || typeof shopLicenseImageInput === "string") {
        seller.documents.shopLicenseImage = uploadedShopLicense || shopLicenseImageInput;
      }
    }

    let uploadedPan = "";
    const panImageInput = files?.panImage?.[0] || documentsBody.panImage || req.body?.panImage;
    if (panImageInput !== undefined) {
      uploadedPan = await uploadFileOrBase64ToCloudinary(panImageInput, "seller/pan");
      if (uploadedPan || typeof panImageInput === "string") {
        seller.documents.panImage = uploadedPan || panImageInput;
      }
    }

    let uploadedGst = "";
    const gstImageInput = files?.gstImage?.[0] || documentsBody.gstImage || req.body?.gstImage;
    if (gstImageInput !== undefined) {
      uploadedGst = await uploadFileOrBase64ToCloudinary(gstImageInput, "seller/gst");
      if (uploadedGst || typeof gstImageInput === "string") {
        seller.documents.gstImage = uploadedGst || gstImageInput;
      }
    }

    let uploadedFssai = "";
    const fssaiImageInput = files?.fssaiImage?.[0] || documentsBody.fssaiImage || req.body?.fssaiImage;
    if (fssaiImageInput !== undefined) {
      uploadedFssai = await uploadFileOrBase64ToCloudinary(fssaiImageInput, "seller/fssai");
      if (uploadedFssai || typeof fssaiImageInput === "string") {
        seller.documents.fssaiImage = uploadedFssai || fssaiImageInput;
      }
    }

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
      seller.shopInfo.businessType = str(
        shopInfoBody.businessType ?? req.body.businessType,
        "",
      );
    }
    if (
      req.body?.alternatePhone !== undefined ||
      shopInfoBody.alternatePhone !== undefined
    ) {
      const alt = str(
        shopInfoBody.alternatePhone ?? req.body.alternatePhone,
        "",
      );
      seller.shopInfo.alternatePhone = alt;
      seller.alternatePhoneDigits = normalizePhone(alt);
      seller.alternatePhoneLast10 = last10(alt);
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

    let uploadedShopImage = "";
    const shopImageInput = files?.shopImage?.[0] || shopInfoBody.shopImage || req.body?.shopImage;
    if (shopImageInput !== undefined) {
      uploadedShopImage = await uploadFileOrBase64ToCloudinary(shopImageInput, "seller/shop-image");
      if (uploadedShopImage || typeof shopImageInput === "string") {
        seller.shopInfo.shopImage = uploadedShopImage || shopImageInput;
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
          upiQrImage: uploadedUpiQr,
          shopImage: uploadedShopImage,
          fssaiImage: uploadedFssai,
          shopLicenseImage: uploadedShopLicense,
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

        try {
          const { notifyAdminsSafely } = await import(
            "../../../../core/notifications/firebase.service.js"
          );
          void notifyAdminsSafely({
            title: "Seller profile update pending",
            body: `${seller.shopName || seller.name || "A seller"} submitted profile changes for admin review.`,
            data: {
              type: "seller_profile_updated",
              subType: "seller",
              id: String(seller._id),
              link: "/admin/quick-commerce/sellers/pending",
            },
          });
        } catch {}

        try {
          const io = getIO();
          if (io) {
            io.to(rooms.admin()).emit("admin_notification", {
              type: "seller_profile_updated",
              sellerId: String(seller._id),
            });
          }
        } catch {}

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
      const wasRejectedBefore =
        seller.approvalStatus === "rejected" ||
        Boolean(seller.rejectedAt) ||
        Boolean(seller.previousRejectionNotes) ||
        seller.isReapplied === true;

      if (wasRejectedBefore) {
        seller.isReapplied = true;
        seller.reappliedAt = new Date();
        seller.reapplicationCount = (seller.reapplicationCount || 0) + 1;
        if (seller.approvalNotes) {
          seller.previousRejectionNotes = seller.approvalNotes;
        }
      }

      seller.onboardingSubmitted = true;
      seller.approved = false;
      seller.approvalStatus = "pending";
      seller.approvalNotes = "";
      seller.approvedAt = null;

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
      } catch {}

      try {
        const io = getIO();
        if (io) {
          io.to(rooms.admin()).emit("admin_notification", {
            type: "seller_onboarding_submitted",
            sellerId: String(seller._id),
          });
        }
      } catch {}

      await upsertSellerNotification(seller._id, {
        key: `onboarding:${String(seller._id)}:submitted`,
        type: "system",
        title: "Onboarding submitted successfully",
        message:
          "We received your store details. Our team is reviewing your application and you will be notified once it is approved.",
        link: "/seller",
      });
    }
};

export const deleteSellerProfileController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return sendError(res, 404, "Seller not found");
    }

    if (seller.isDeleted) {
      return sendError(res, 404, "Seller already deleted");
    }

    await Seller.updateOne(
      { _id: seller._id },
      {
        $set: {
          isDeleted: true,
          isActive: false,
          'deletionRequest.status': 'approved',
          'deletionRequest.requestedAt': new Date(),
          'deletionRequest.reason': 'Account self-deleted by seller'
        }
      }
    );

    // Clear active sessions for this seller
    const { FoodRefreshToken } = await import('../../../../core/refreshTokens/refreshToken.model.js');
    await Promise.all([
      FoodRefreshToken.deleteMany({ userId: seller._id }),
      Seller.updateOne(
        { _id: seller._id },
        { $set: { fcmTokens: [], fcmTokenMobile: [] } }
      ),
    ]);

    return res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    return sendError(
      res,
      500,
      error.message || "Failed to delete seller profile",
    );
  }
};

export const updateSellerProfileController = async (req, res) => {
  try {
    const seller = await Seller.findById(sellerScope(req));
    if (!seller) {
      return sendError(res, 404, "Seller not found");
    }

    await updateSellerProfileData(seller, req);

    await seller.save();

    return res.json({
      success: true,
      result: serializeSellerProfile(seller),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return sendError(
        res,
        400,
        "Phone or email already belongs to another seller",
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
      items: { $elemMatch: { sourceId: sellerKey, type: "quick" } }
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

    const items = await Promise.all(
      parentOrders.map(async (po) => {
        let so = existingMap.get(String(po._id));
        const parentStatus = String(po?.orderStatus || "").toLowerCase();

        if (!so) {
          const doc = await buildSellerOrderFromParentOrder(po, sellerId);
          if (doc) {
            so = await SellerOrder.findOneAndUpdate(
              { parentOrderId: po._id, sellerId },
              { $set: doc },
              { upsert: true, new: true, setDefaultsOnInsert: true },
            ).lean();
          }
        } else if (parentStatus === "delivered" && so.status !== "delivered") {
          so = await SellerOrder.findOneAndUpdate(
            { _id: so._id },
            {
              $set: {
                status: "delivered",
                workflowStatus: "DELIVERED",
                deliveredAt:
                  po.deliveryState?.deliveredAt || po.updatedAt || new Date(),
              },
            },
            { new: true },
          ).lean();
        } else if (
          parentStatus.startsWith("cancel") &&
          so.status !== "cancelled"
        ) {
          so = await SellerOrder.findOneAndUpdate(
            { _id: so._id },
            { $set: { status: "cancelled", workflowStatus: "CANCELLED" } },
            { new: true },
          ).lean();
        }
        return so;
      }),
    );

    const filteredItems = items.filter(Boolean);

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

    const enrichedItems = filteredItems.map((item) => {
      const quickOrder = quickOrderMap.get(String(item.orderId));
      const acceptedPartner = quickOrder?.dispatch?.deliveryPartnerId
        ? deliveryPartnerMap.get(String(quickOrder.dispatch.deliveryPartnerId))
        : null;

      const subtotal = num(item.pricing?.subtotal);
      const commission = num(item.pricing?.commission);
      const receivable =
        num(item.pricing?.receivable) || Math.max(0, subtotal - commission);

      return {
        ...item,
        pricing: {
          ...item.pricing,
          receivable,
        },
        orderType: item.orderType || quickOrder?.orderType || "quick",
        dispatchStatus: quickOrder?.dispatch?.status || "unassigned",
        deliveryPartner: acceptedPartner
          ? {
              _id: acceptedPartner._id,
              name: acceptedPartner.name || "Delivery Partner",
              phone: acceptedPartner.phone || "",
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

    const result = await quickOrderService.updateSellerOrderStatus(
      orderId,
      sellerId,
      nextStatus,
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
      .select("shopName name phone location")
      .lean();
    const origin =
      quickOrderService.getSellerLocation(seller) ||
      quickOrderService.getOrderAddressPoint(quickOrder);

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
      status: "unassigned",
      deliveryPartnerId: null,
      assignedAt: null,
      acceptedAt: null,
      offeredTo: [
        ...(quickOrder.dispatch?.offeredTo || []).filter(Boolean),
        ...(nearbyPartners || []).map((p) => ({
          partnerId: p.partnerId,
          at: now,
          action: "offered",
        })),
      ],
    };
    await quickOrder.save();

    const io = getIO();
    const deliveryPayload = {
      ...buildDeliverySocketPayload(quickOrder, seller),
      orderId: quickOrder.orderId,
      orderMongoId: quickOrder._id?.toString?.(),
      orderStatus: String(quickOrder.orderStatus || "pending").toLowerCase(),
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

export const getSellerReturnsController = async (req, res) => {
  try {
    let items = await SellerReturn.find({ sellerId: sellerScope(req) })
      .populate('returnRequestId', 'evidenceImages returnReason adminNotes')
      .populate('assignment.deliveryPartnerId', 'name phone vehicleType vehicleNumber')
      .sort({ returnRequestedAt: -1 })
      .lean();

    items = await Promise.all(items.map(async (item) => {
      if (item.returnStatus === 'seller_otp_pending') {
        const otpDoc = await ReturnOtp.findOne({ 
          sellerReturnId: item._id, 
          type: 'seller', 
          verified: false,
          expiresAt: { $gt: new Date() }
        }).select('+plainOtp').sort({ createdAt: -1 }).lean();
        if (otpDoc?.plainOtp) {
          item.handoffOtp = otpDoc.plainOtp;
        }
      }
      return item;
    }));

    return res.json({ success: true, result: { items } });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to load returns");
  }
};

export const getSellerReturnOtpController = async (req, res) => {
  try {
    const { sellerReturnId } = req.params;
    const sellerId = sellerScope(req);
    
    // Verify ownership
    const sellerReturn = await SellerReturn.findOne({ _id: sellerReturnId, sellerId });
    if (!sellerReturn) {
      return sendError(res, 404, "Return request not found");
    }

    if (sellerReturn.returnStatus !== 'seller_otp_pending') {
      return sendError(res, 400, "OTP is not available yet or has already been used");
    }

    const otpDoc = await ReturnOtp.findOne({ 
      sellerReturnId: sellerReturn._id, 
      type: 'seller', 
      verified: false,
      expiresAt: { $gt: new Date() }
    }).select('+plainOtp').sort({ createdAt: -1 }).lean();

    if (!otpDoc || !otpDoc.plainOtp) {
      return sendError(res, 400, "OTP has expired or does not exist. Please wait for the rider to trigger a resend.");
    }

    return res.json({ success: true, result: { otp: otpDoc.plainOtp, expiresAt: otpDoc.expiresAt } });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to fetch return OTP");
  }
};

export const approveSellerReturnController = async (req, res) => {
  try {
    const updated = await SellerReturn.findOneAndUpdate(
      { sellerId: sellerScope(req), orderId: req.params.orderId },
      { $set: { returnStatus: "return_approved", returnRejectedReason: "" } },
      { new: true },
    ).lean();

    if (!updated) {
      return sendError(res, 404, "Return request not found");
    }

    return res.json({ success: true, result: updated });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to approve return");
  }
};

export const rejectSellerReturnController = async (req, res) => {
  try {
    const updated = await SellerReturn.findOneAndUpdate(
      { sellerId: sellerScope(req), orderId: req.params.orderId },
      {
        $set: {
          returnStatus: "return_rejected",
          returnRejectedReason: str(req.body?.reason),
        },
      },
      { new: true },
    ).lean();

    if (!updated) {
      return sendError(res, 404, "Return request not found");
    }

    return res.json({ success: true, result: updated });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to reject return");
  }
};

export const getSellerEarningsController = async (req, res) => {
  try {
    const sellerId = sellerScope(req);

    // Ensure seller legs reflect parent delivery/cancellation even if realtime sync missed it.
    await reconcileSellerDeliveredOrders(sellerId);

    const [transactions, orders] = await Promise.all([
      SellerTransaction.find({ sellerId }).sort({ createdAt: -1 }).lean(),
      SellerOrder.find({ sellerId, status: "delivered" })
        .select("orderId customer pricing createdAt updatedAt deliveredAt")
        .lean(),
    ]);

    // Source of truth: delivered SellerOrders (net receivable). Transactions are used for withdrawals and for
    // historical order-payment entries when present.
    const orderNetEarnings = orders.reduce((sum, o) => {
      const receivable =
        Number(o?.pricing?.receivable) ||
        Math.max(0, num(o?.pricing?.subtotal) - num(o?.pricing?.commission));
      return sum + num(receivable);
    }, 0);

    const txnNetEarnings = transactions
      .filter((item) => item.type === "Order Payment")
      .reduce((sum, item) => sum + num(item.amount), 0);

    const totalNetEarnings =
      orderNetEarnings > 0 ? orderNetEarnings : txnNetEarnings;

    // Sum all refund deductions (stored as negative amounts) and apply to
    // net earnings so the seller's balance correctly reflects money owed back.
    const totalRefundDeductions = transactions
      .filter((item) => item.type === 'Refund')
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

    const netEarningsAfterRefunds = totalNetEarnings - totalRefundDeductions;

    const grossSales = orders.reduce(
      (sum, o) => sum + num(o.pricing?.total),
      0,
    );
    const totalCommission = orders.reduce(
      (sum, o) => sum + num(o.pricing?.commission),
      0,
    );
    const subtotal = orders.reduce(
      (sum, o) => sum + num(o.pricing?.subtotal),
      0,
    );
    const deliveryFees = grossSales - subtotal;

    const totalWithdrawn = transactions
      .filter((item) => item.type === 'Withdrawal' && item.status === 'Settled')
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);
    const pendingPayouts = transactions
      .filter(
        (item) =>
          item.type === 'Withdrawal' &&
          ['Pending', 'Processing'].includes(String(item.status || '')),
      )
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

    // settledBalance: what the seller can actually withdraw.
    // May be negative if refunds exceed earnings — seller owes the platform.
    // The frontend uses Math.max(0, ...) for the withdrawable amount separately.
    const settledBalance = netEarningsAfterRefunds - totalWithdrawn - pendingPayouts;

    // Ledger: merge "Order Payment" entries from transactions with synthetic ones from delivered orders.
    // Avoid duplicates by (type + orderId/reference).
    const existingOrderRefs = new Set(
      transactions
        .filter((t) => t.type === "Order Payment")
        .map((t) => String(t.orderId || t.reference || t._id || ""))
        .filter(Boolean),
    );
    const syntheticOrderTxns = orders
      .filter((o) => !existingOrderRefs.has(String(o.orderId || "")))
      .map((o) => ({
        _id: o._id,
        reference: String(o.orderId || ""),
        orderId: String(o.orderId || ""),
        type: "Order Payment",
        amount:
          Number(o?.pricing?.receivable) ||
          Math.max(0, num(o?.pricing?.subtotal) - num(o?.pricing?.commission)),
        status: "Settled",
        customer: o?.customer?.name || "Customer",
        createdAt: o?.deliveredAt || o?.updatedAt || o?.createdAt,
      }));

    const mergedLedger = [...transactions, ...syntheticOrderTxns].sort(
      (a, b) => {
        const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      },
    );

    const balances = {
      totalRevenue: netEarningsAfterRefunds, // Keeping field name for backward compatibility
      totalNetEarnings: netEarningsAfterRefunds,
      grossSales,
      totalCommission,
      deliveryFees,
      totalWithdrawn,
      settledBalance: Math.max(0, settledBalance), // Clamp to 0 for display; raw negative tracked in netEarningsAfterRefunds
      pendingPayouts,
      totalRefundDeductions,                       // Exposed so frontend can display "Total Refunds" stat
    };

    return res.json({
      success: true,
      result: {
        balances,
        monthlyChart:
          orders.length > 0
            ? monthlyRevenueChartFromOrders(orders)
            : monthlyRevenueChart(transactions),
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
    const amount = Math.abs(num(req.body?.amount));
    const requestedMethod = str(
      req.body?.paymentMethod || req.body?.method,
    ).toLowerCase();
    if (!amount) {
      return sendError(res, 400, "Enter a valid withdrawal amount");
    }

    const feeSettings = await getActiveFeeSettings();
    const minW = Number(feeSettings?.minWithdrawal ?? 0);
    const maxW = feeSettings?.maxWithdrawal != null ? Number(feeSettings.maxWithdrawal) : null;
    if (minW > 0 && amount < minW) {
      return sendError(res, 400, `Minimum withdrawal amount is ${currency(minW)}`);
    }
    if (maxW != null && maxW > 0 && amount > maxW) {
      return sendError(res, 400, `Maximum withdrawal amount is ${currency(maxW)}`);
    }

    // Validate the requested payment method and its required fields
    if (!["qr", "upi", "bank_transfer"].includes(requestedMethod)) {
      return sendError(res, 400, "Select a payment method: QR Code, UPI, or Bank Transfer");
    }

    const sellerDoc = await Seller.findById(sellerId).lean();
    const bodyUpiId = str(req.body?.upiId).trim();
    const bodyBankName = str(req.body?.bankName).trim();
    const bodyAccountHolder = str(req.body?.accountHolderName).trim();
    const bodyAccountNumber = str(req.body?.accountNumber).trim();
    const bodyIfsc = str(req.body?.ifscCode).trim().toUpperCase();
    const bodyQrImage = str(req.body?.qrCodeImage).trim();

    const finalUpiId = bodyUpiId || str(sellerDoc?.bankInfo?.upiId).trim();
    const finalQrImage = bodyQrImage || str(sellerDoc?.bankInfo?.upiQrImage).trim();
    const finalBankName = bodyBankName || str(sellerDoc?.bankInfo?.bankName).trim();
    const finalAccountHolder = bodyAccountHolder || str(sellerDoc?.bankInfo?.accountHolderName).trim() || str(sellerDoc?.name).trim();
    const finalAccountNumber = bodyAccountNumber || str(sellerDoc?.bankInfo?.accountNumber).trim();
    const finalIfsc = bodyIfsc || (sellerDoc?.bankInfo?.ifscCode ? str(sellerDoc.bankInfo.ifscCode).trim().toUpperCase() : "");

    if (requestedMethod === "qr" && !finalQrImage) {
      return sendError(res, 400, "Please upload your QR code image or save it in profile");
    }
    if (requestedMethod === "upi" && !finalUpiId) {
      return sendError(res, 400, "Please enter your UPI ID or save it in profile");
    }
    if (requestedMethod === "bank_transfer") {
      if (!finalBankName || !finalAccountHolder || !finalAccountNumber || !finalIfsc) {
        return sendError(res, 400, "Please fill all bank details (Bank Name, Account Holder, Account Number, IFSC)");
      }
    }

    const [transactions, deliveredOrders] = await Promise.all([
      SellerTransaction.find({ sellerId }).lean(),
      SellerOrder.find({ sellerId, status: "delivered" })
        .select("pricing")
        .lean(),
    ]);

    const orderNetEarnings = (deliveredOrders || []).reduce((sum, o) => {
      const receivable =
        Number(o?.pricing?.receivable) ||
        Math.max(0, num(o?.pricing?.subtotal) - num(o?.pricing?.commission));
      return sum + num(receivable);
    }, 0);

    const txnNetEarnings = transactions
      .filter((item) => item.type === 'Order Payment')
      .reduce((sum, item) => sum + num(item.amount), 0);

    const netEarnings =
      orderNetEarnings > 0 ? orderNetEarnings : txnNetEarnings;

    // Subtract all refund deductions so sellers cannot withdraw money they owe
    // back to the platform as a result of customer returns.
    const totalRefundDeductions = transactions
      .filter((item) => item.type === 'Refund')
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

    const netEarningsAfterRefunds = netEarnings - totalRefundDeductions;

    const totalWithdrawn = transactions
      .filter((item) => item.type === 'Withdrawal' && item.status === 'Settled')
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

    const pendingPayouts = transactions
      .filter(
        (item) =>
          item.type === 'Withdrawal' &&
          ['Pending', 'Processing'].includes(String(item.status || '')),
      )
      .reduce((sum, item) => sum + Math.abs(num(item.amount)), 0);

    const available = Math.max(
      0,
      netEarningsAfterRefunds - totalWithdrawn - pendingPayouts,
    );
    if (amount > available) {
      return sendError(
        res,
        400,
        `Insufficient balance. Available: ${currency(available)}`,
      );
    }

    const customerLabel =
      requestedMethod === "qr" ? "QR Code" :
      requestedMethod === "upi" ? "UPI Transfer" : "Bank Transfer";

    const created = await SellerTransaction.create({
      sellerId,
      type: "Withdrawal",
      amount: -amount,
      status: "Pending",
      reference: `WDR-${Date.now()}`,
      customer: customerLabel,
      paymentMethod: requestedMethod,
      bankDetails: {
        bankName: finalBankName,
        accountHolderName: finalAccountHolder,
        accountNumber: finalAccountNumber,
        accountNumberLast4: finalAccountNumber ? finalAccountNumber.slice(-4) : "",
        ifscCode: finalIfsc,
        upiId: finalUpiId,
        qrCodeImage: finalQrImage,
      },
    });

    return res.status(201).json({ success: true, result: created.toObject() });
  } catch (error) {
    return sendError(res, 500, error.message || "Failed to create withdrawal");
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
        (num(order?.pricing?.receivable) ||
          Math.max(
            0,
            num(order?.pricing?.subtotal) - num(order?.pricing?.commission),
          )),
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
        const receivable =
          num(order?.pricing?.receivable) ||
          Math.max(
            0,
            num(order?.pricing?.subtotal) - num(order?.pricing?.commission),
          );
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
