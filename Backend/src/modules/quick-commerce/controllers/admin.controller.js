import mongoose from 'mongoose';
import { FoodUser } from '../../../core/users/user.model.js';
import { FoodDeliveryPartner } from '../../food/delivery/models/deliveryPartner.model.js';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickOrder } from '../models/order.model.js';
import { QuickCart } from '../models/cart.model.js';
import { QuickWishlist } from '../models/wishlist.model.js';
import { QuickReview } from '../models/review.model.js';
import { QuickHeroConfig } from '../models/heroConfig.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { SellerStockAdjustment } from '../seller/models/sellerStockAdjustment.model.js';
import { SellerNotification } from '../seller/models/sellerNotification.model.js';
import { upsertSellerNotification } from '../seller/services/sellerNotify.service.js';
import {
  parseProductPayload,
  validateProductPricing,
  stripPharmacyVariantMeta,
} from '../seller/controllers/seller.controller.js';
import {
  resolveSellerCategoryIds,
  syncSellerInventoryNotification,
} from '../seller/services/sellerCatalog.service.js';
import { QuickZone } from '../models/quick_zone.model.js';
import { assertNoZoneOverlap, ZONE_OVERLAP_MESSAGE } from '../../../utils/zoneOverlap.js';
import { buildPaginationOptions, PAGINATION_DEFAULTS } from '../../../utils/helpers.js';
import { detectQuickZoneForPoint } from '../services/quick-zone-lookup.service.js';
import {
  buildApplySellerPendingProfileChanges,
  buildDiscardSellerPendingProfileChanges,
} from '../shared/pendingProfileChanges.js';
import { resolveQuickOrderCancellationReason } from '../utils/cancellation.helpers.js';
import {
  attachReturnSummaryToOrder,
  loadReturnsByOrderIds,
  getCompletedReturnRefundTotals,
} from '../utils/orderReturnSummary.helpers.js';
import { resolveQuickOrderCustomer } from '../utils/customer.helpers.js';
import { uploadImageBuffer } from '../../../services/cloudinary.service.js';
import { getIO, rooms } from '../../../config/socket.js';
import {
  getQuickExperienceSections,
  createQuickExperienceSection,
  updateQuickExperienceSection,
  deleteQuickExperienceSection,
  setQuickHeroConfig,
  getQuickHeroConfig,
  getAllQuickHeroConfigs,
  getQuickOfferSections,
  createQuickOfferSection,
  updateQuickOfferSection,
  deleteQuickOfferSection,
  reorderQuickOfferSections,
  getQuickHomeTiles,
  createQuickHomeTile,
  updateQuickHomeTile,
  deleteQuickHomeTile,
  reorderQuickHomeTiles,
  updateQuickHomeHeadings,
  getQuickHomeHeadings,
  getAdminQuickCoupons,
  createAdminQuickCoupon,
  updateAdminQuickCoupon,
  deleteAdminQuickCoupon,
  toggleAdminQuickCouponStatus,
  clearContentCache,
} from '../services/content.service.js';
import {
  generateUniqueSlug,
  parseReturnWindowHours,
  slugify,
  validateCategoryFields,
  validateCategoryImageFile,
  validateCategoryParent,
  VALID_BUSINESS_TYPES,
} from '../utils/category.helpers.js';
import { effectiveStockExpr, escapeRegex } from '../utils/productVisibility.helpers.js';
import {
  cascadeCategoryDeactivation,
  cascadeCategoryReactivation,
  collectDescendantCategoryIds,
  deactivateProductsUnderCategories,
} from '../services/categoryCascade.service.js';
import {
  getQuickCommerceFinanceLedger,
  getQuickCommerceFinancePayouts,
  getQuickCommerceFinanceSummary,
  getQuickCommerceSellerWithdrawals,
  getQuickCommerceSellerTransactions,
  updateQuickCommerceWithdrawalStatus,
} from "../services/finance.service.js";

const toCategory = (category) => {
  const type = category.type || 'header';
  const result = {
    id: category._id,
    _id: category._id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    accentColor: category.accentColor,
    description: category.description || '',
    type,
    status: category.status || (category.isActive ? 'active' : 'inactive'),
    parentId: category.parentId || null,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    approvalStatus: category.approvalStatus || 'approved',
  };

  // Commission / GST / returns / handling fees are header-only (source of truth for the tree).
  if (type === 'header') {
    result.businessType = category.businessType || 'quick_commerce';
    result.adminCommission = Number(category.adminCommission || 0);
    result.gst = Number(category.gst || 0);
    result.handlingFees = Number(category.handlingFees || 0);
    result.headerColor = category.headerColor || category.accentColor || '#0c831f';
    result.returnsEnabled = category.returnsEnabled !== false;
    result.returnWindowHours = Number(category.returnWindowHours || 72);
  }

  if (category.iconId) result.iconId = category.iconId;

  return result;
};

const toProduct = (product) => ({
  id: product._id,
  _id: product._id,
  name: product.name,
  slug: product.slug,
  image: product.mainImage || product.image,
  mainImage: product.mainImage || product.image,
  galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
  categoryId: product.categoryId,
  subcategoryId: product.subcategoryId || null,
  headerId: product.headerId || null,
  price: product.price,
  mrp: product.mrp,
  salePrice: product.salePrice || 0,
  unit: product.unit,
  description: product.description || '',
  stock: Number(product.stock || 0),
  lowStockAlert: Number(product.lowStockAlert ?? 5),
  packingFee: Number(product.packingFee || 0),
  status: product.status || (product.isActive ? 'active' : 'inactive'),
  brand: product.brand || '',
  weight: product.weight || '',
  sku: product.sku || '',
  tags: Array.isArray(product.tags) ? product.tags : [],
  variants: Array.isArray(product.variants) ? product.variants : [],
  pharmacyDetails: product.pharmacyDetails && typeof product.pharmacyDetails === 'object' ? product.pharmacyDetails : {},
  headerBusinessType: product.headerId?.businessType || '',
  sellerBusinessType: product.seller?.shopInfo?.businessType || '',
  isFeatured: Boolean(product.isFeatured),
  badge: product.badge,
  isActive: product.isActive,
  deactivatedByParentId: product.deactivatedByParentId || null,
  approvalStatus: product.approvalStatus || 'approved',
  approvedAt: product.approvedAt || null,
  sellerId: product.sellerId || null,
  seller: product.seller || null,
  storeName: product.storeName || '',
  restaurantName: product.restaurantName || '',
});

const buildProductSellerMap = async (products = []) => {
  const sellerIds = [...new Set(
    products
      .map((product) => String(product?.sellerId || '').trim())
      .filter(Boolean),
  )];

  if (!sellerIds.length) return {};

  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id shopName name shopInfo.businessType')
    .lean();

  return sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});
};

const withProductSeller = (product, sellerMap = {}) => {
  const seller = sellerMap[String(product?.sellerId || '')] || null;
  const sellerInfo = seller
    ? {
        _id: seller._id,
        id: seller._id,
        name: seller.name || '',
        shopName: seller.shopName || seller.name || 'Store',
        shopInfo: seller.shopInfo || {},
      }
    : null;

  return {
    ...product,
    sellerId: product?.sellerId || sellerInfo?._id || null,
    seller: sellerInfo,
    storeName: sellerInfo?.shopName || sellerInfo?.name || '',
    restaurantName: sellerInfo?.shopName || sellerInfo?.name || '',
    sellerBusinessType: sellerInfo?.shopInfo?.businessType || '',
  };
};

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

const parseVariants = (value = '[]') => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map((variant) => ({
      name: String(variant?.name || '').trim(),
      price: parseNumber(variant?.price, 0),
      salePrice: parseNumber(variant?.salePrice, 0),
      stock: parseNumber(variant?.stock, 0),
      sku: String(variant?.sku || '').trim(),
    })) : [];
  } catch {
    return [];
  }
};

const QUICK_CANCELLED_STATUSES = ['cancelled', 'cancelled_by_user', 'cancelled_by_restaurant', 'cancelled_by_admin'];
const QUICK_DASHBOARD_CATEGORY_COLORS = ['#FF6B6B', '#4F46E5', '#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9'];
const QUICK_PROCESSING_WORKFLOW_STATUSES = ['SELLER_ACCEPTED', 'DELIVERY_SEARCH', 'DELIVERY_ASSIGNED', 'PICKUP_READY'];
const QUICK_PROCESSING_ORDER_STATUSES = ['confirmed', 'packed'];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getQuickDashboardPeriodRange = (period = 'overall', now = new Date()) => {
  const normalized = String(period || 'overall').toLowerCase();

  switch (normalized) {
    case 'today':
      return { start: startOfDay(now), end: now };
    case 'week':
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)),
        end: now,
      };
    case 'month':
      return {
        start: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)),
        end: now,
      };
    case 'year':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        end: now,
      };
    default:
      return null;
  }
};

const getQuickDashboardPreviousRange = (period = 'overall', currentRange = null) => {
  if (!currentRange?.start || !currentRange?.end) return null;

  const normalized = String(period || 'overall').toLowerCase();
  const spanMs = currentRange.end.getTime() - currentRange.start.getTime();

  switch (normalized) {
    case 'today': {
      const previousEnd = new Date(currentRange.start.getTime() - 1);
      return {
        start: startOfDay(previousEnd),
        end: previousEnd,
      };
    }
    case 'week':
    case 'month':
    case 'year': {
      const previousEnd = new Date(currentRange.start.getTime() - 1);
      return {
        start: new Date(previousEnd.getTime() - spanMs),
        end: previousEnd,
      };
    }
    default:
      return null;
  }
};

const buildQuickItemsFilterExpr = (sellerIds = []) => {
  const sellerIdStrings = Array.isArray(sellerIds)
    ? sellerIds.map((sellerId) => String(sellerId)).filter(Boolean)
    : [];

  return {
    $filter: {
      input: { $ifNull: ['$items', []] },
      as: 'item',
      cond: sellerIdStrings.length > 0
        ? {
            $and: [
              { $eq: ['$$item.type', 'quick'] },
              { $in: ['$$item.sourceId', sellerIdStrings] },
            ],
          }
        : { $eq: ['$$item.type', 'quick'] },
    },
  };
};

const buildQuickItemsRevenueExpr = (sellerIds = []) => ({
  $sum: {
    $map: {
      input: buildQuickItemsFilterExpr(sellerIds),
      as: 'item',
      in: {
        $multiply: [
          { $ifNull: ['$$item.price', 0] },
          { $ifNull: ['$$item.quantity', 0] },
        ],
      },
    },
  },
});

const buildQuickItemsCountExpr = (sellerIds = []) => ({
  $sum: {
    $map: {
      input: buildQuickItemsFilterExpr(sellerIds),
      as: 'item',
      in: { $ifNull: ['$$item.quantity', 0] },
    },
  },
});

const buildQuickOrderStatusGroupStage = (sellerIds = []) => {
  const quickRevenueExpr = buildQuickItemsRevenueExpr(sellerIds);
  const quickItemCountExpr = buildQuickItemsCountExpr(sellerIds);

  return {
    $group: {
      _id: null,
      totalOrders: { $sum: 1 },
      pending: {
        $sum: {
          $cond: [
            {
              $or: [
                { $in: ['$orderStatus', ['pending', 'placed']] },
                { $in: ['$workflowStatus', ['CREATED', 'SELLER_PENDING']] },
              ],
            },
            1,
            0,
          ],
        },
      },
      processing: {
        $sum: {
          $cond: [
            {
              $or: [
                { $in: ['$orderStatus', QUICK_PROCESSING_ORDER_STATUSES] },
                { $in: ['$workflowStatus', QUICK_PROCESSING_WORKFLOW_STATUSES] },
              ],
            },
            1,
            0,
          ],
        },
      },
      outForDelivery: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ['$orderStatus', 'out_for_delivery'] },
                { $eq: ['$workflowStatus', 'OUT_FOR_DELIVERY'] },
              ],
            },
            1,
            0,
          ],
        },
      },
      delivered: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ['$orderStatus', 'delivered'] },
                { $eq: ['$workflowStatus', 'DELIVERED'] },
              ],
            },
            1,
            0,
          ],
        },
      },
      cancelled: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ['$workflowStatus', 'CANCELLED'] },
                { $in: ['$orderStatus', QUICK_CANCELLED_STATUSES] },
              ],
            },
            1,
            0,
          ],
        },
      },
      totalRevenue: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ['$orderStatus', 'delivered'] },
                { $eq: ['$workflowStatus', 'DELIVERED'] },
              ],
            },
            quickRevenueExpr,
            0,
          ],
        },
      },
      totalItemsSold: {
        $sum: {
          $cond: [
            {
              $or: [
                { $eq: ['$orderStatus', 'delivered'] },
                { $eq: ['$workflowStatus', 'DELIVERED'] },
              ],
            },
            quickItemCountExpr,
            0,
          ],
        },
      },
    },
  };
};

const getQuickDashboardTimelineConfig = (period = 'overall', now = new Date()) => {
  const normalized = String(period || 'overall').toLowerCase();

  if (normalized === 'today') {
    const start = startOfDay(now);
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      key: `${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}-${hour}`,
      label: `${String(hour).padStart(2, '0')}:00`,
    }));

    return {
      match: { createdAt: { $gte: start, $lte: now } },
      groupId: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        hour: { $hour: '$createdAt' },
      },
      keyOf: (id) => `${id?.year}-${id?.month}-${id?.day}-${id?.hour}`,
      buckets,
    };
  }

  if (normalized === 'week') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return {
        key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      };
    });

    return {
      match: { createdAt: { $gte: start, $lte: now } },
      groupId: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      },
      keyOf: (id) => `${id?.year}-${id?.month}-${id?.day}`,
      buckets,
    };
  }

  if (normalized === 'month') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    const buckets = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      return {
        key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      };
    });

    return {
      match: { createdAt: { $gte: start, $lte: now } },
      groupId: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
      },
      keyOf: (id) => `${id?.year}-${id?.month}-${id?.day}`,
      buckets,
    };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    };
  });

  return {
    match: { createdAt: { $gte: start, $lte: now } },
    groupId: {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
    },
    keyOf: (id) => `${id?.year}-${id?.month}`,
    buckets,
  };
};

const getQuickRevenueFromOrderItems = (order = {}, sellerIdSet = null) => {
  return Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => {
        if (item?.type !== 'quick') return sum;
        if (sellerIdSet && !sellerIdSet.has(String(item?.sourceId || ''))) return sum;
        return sum + (Number(item?.price || 0) * Number(item?.quantity || 0));
      }, 0)
    : 0;
};

const getQuickItemCountFromOrderItems = (order = {}, sellerIdSet = null) => {
  return Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => {
        if (item?.type !== 'quick') return sum;
        if (sellerIdSet && !sellerIdSet.has(String(item?.sourceId || ''))) return sum;
        return sum + Number(item?.quantity || 0);
      }, 0)
    : 0;
};

const formatQuickStatusLabel = (status = '') =>
  String(status || 'pending')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const legacyQuickStatusFromOrder = (order = {}) => {
  const workflowStatus = String(order?.workflowStatus || '').toUpperCase();
  const rawStatus = String(order?.orderStatus || order?.status || '').toLowerCase();

  if (workflowStatus === 'OUT_FOR_DELIVERY') return 'out_for_delivery';
  if (workflowStatus === 'DELIVERED') return 'delivered';
  if (workflowStatus === 'CANCELLED' || QUICK_CANCELLED_STATUSES.includes(rawStatus)) return 'cancelled';
  if (workflowStatus === 'SELLER_ACCEPTED' || workflowStatus === 'DELIVERY_SEARCH' || workflowStatus === 'DELIVERY_ASSIGNED' || workflowStatus === 'PICKUP_READY') {
    return 'confirmed';
  }
  if (rawStatus === 'out_for_delivery') return 'out_for_delivery';
  if (rawStatus === 'delivered') return 'delivered';
  if (rawStatus === 'confirmed' || rawStatus === 'packed') return rawStatus;
  return 'pending';
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const aggregateSellerOrderEarnings = (sellerOrders = [], parentOrder = null, returnSummary = null) => {
  const list = Array.isArray(sellerOrders) ? sellerOrders.filter(Boolean) : [];
  const pricing = parentOrder?.pricing || {};
  const couponSource = String(pricing?.appliedCoupon?.source || '').toLowerCase();
  const rawDiscount = Math.max(0, Number(pricing?.discount || pricing?.appliedCoupon?.discount || 0));
  const parentSubtotal = Math.max(0, Number(pricing.subtotal || 0));
  const returnCouponShare = (Array.isArray(returnSummary?.returns) ? returnSummary.returns : []).reduce(
    (sum, row) => sum + Number(row?.pricing?.couponShare || 0),
    0,
  );
  // Guard against corrupted coupon amounts (e.g. discount accidentally stored as full subtotal).
  const discount =
    parentSubtotal > 0 && rawDiscount >= parentSubtotal
      ? roundMoney(
          returnCouponShare > 0 && returnCouponShare < rawDiscount
            ? returnCouponShare
            : parentSubtotal * 0.1,
        )
      : rawDiscount;
  const adminDiscount = couponSource === 'admin' ? discount : 0;
  const sellerCouponFromParent =
    couponSource === 'restaurant' || couponSource === 'seller' ? discount : 0;

  if (list.length === 0) {
    const subtotal = Number(pricing.subtotal || 0);
    const packingFee = Math.max(0, Number(pricing.packagingFee || pricing.packingFee || 0));
    const returnPickupFee = Math.max(0, Number(returnSummary?.totalReturnPickupFee || 0));
    const receivableGross = roundMoney(subtotal - sellerCouponFromParent + packingFee);
    return {
      subtotal: roundMoney(subtotal),
      commission: 0,
      couponDiscount: roundMoney(sellerCouponFromParent),
      packingFee: roundMoney(packingFee),
      productEarnings: roundMoney(subtotal - sellerCouponFromParent),
      receivableGross,
      returnPickupFee: roundMoney(returnPickupFee),
      receivable: roundMoney(receivableGross),
      adminDiscount: roundMoney(adminDiscount),
    };
  }

  const subtotal = list.reduce((sum, row) => sum + Number(row?.pricing?.subtotal || 0), 0);
  let commission = list.reduce((sum, row) => {
    const atSale = Number(row?.pricing?.commissionAtSale);
    const current = Number(row?.pricing?.commission || 0);
    return sum + (Number.isFinite(atSale) && atSale > 0 ? atSale : current);
  }, 0);
  const couponDiscount = list.reduce(
    (sum, row) => sum + Number(row?.pricing?.couponDiscount || 0),
    0,
  );
  const packingFee = list.reduce((sum, row) => {
    const stored = Number(row?.pricing?.packingFee || 0);
    return sum + (stored > 0 ? stored : 0);
  }, 0);
  const packingFallback =
    packingFee > 0
      ? packingFee
      : Math.max(0, Number(pricing.packagingFee || pricing.packingFee || 0));
  const productEarnings = list.reduce((sum, row) => {
    if (row?.pricing?.productEarnings != null && Number.isFinite(Number(row.pricing.productEarnings))) {
      return sum + Number(row.pricing.productEarnings);
    }
    return (
      sum +
      Number(row?.pricing?.subtotal || 0) -
      Number(row?.pricing?.commission || 0) -
      Number(row?.pricing?.couponDiscount || 0)
    );
  }, 0);
  let receivable = list.reduce((sum, row) => {
    if (row?.pricing?.receivable != null && Number.isFinite(Number(row.pricing.receivable))) {
      return sum + Number(row.pricing.receivable);
    }
    const rowPacking = Number(row?.pricing?.packingFee || 0);
    const rowProduct =
      row?.pricing?.productEarnings != null
        ? Number(row.pricing.productEarnings)
        : Number(row?.pricing?.subtotal || 0) -
          Number(row?.pricing?.commission || 0) -
          Number(row?.pricing?.couponDiscount || 0);
    return sum + rowProduct + rowPacking;
  }, 0);

  let resolvedReceivable =
    receivable > 0 || list.some((row) => row?.pricing?.receivable != null)
      ? receivable
      : productEarnings + packingFallback;

  // After completed returns, packing must remain with seller even if an older claw wiped receivable.
  if (returnSummary?.isRefundCompleted && packingFallback > 0) {
    resolvedReceivable = Math.max(resolvedReceivable, packingFallback);
  }

  const returnPickupFee = Math.max(0, Number(returnSummary?.totalReturnPickupFee || 0));
  const netReceivable = roundMoney(resolvedReceivable);

  // If an older return zeroed commission, restore sale-time commission for admin reporting.
  if (returnSummary?.isRefundCompleted && commission <= 0 && parentSubtotal > 0) {
    const clawed = Number(returnSummary?.totalSellerClawed) > 0
      ? Number(returnSummary.totalSellerClawed)
      : (Array.isArray(returnSummary?.returns) ? returnSummary.returns : []).reduce(
          (sum, row) => sum + Number(row?.sellerReceivableClawed || row?.finance?.sellerReceivableClawed || 0),
          0,
        );
    let inferred = roundMoney(parentSubtotal - sellerCouponFromParent - clawed);
    if (inferred < 0 && packingFallback > 0) {
      inferred = roundMoney(parentSubtotal - sellerCouponFromParent - Math.max(0, clawed - packingFallback));
    }
    if (clawed > 0 && inferred >= 0) {
      commission = Math.min(inferred, parentSubtotal);
    } else if (adminDiscount > 0) {
      commission = adminDiscount;
    }
  }

  return {
    subtotal: roundMoney(subtotal || Number(pricing.subtotal || 0)),
    commission: roundMoney(commission),
    couponDiscount: roundMoney(couponDiscount || sellerCouponFromParent),
    packingFee: roundMoney(packingFallback),
    productEarnings: roundMoney(productEarnings),
    receivableGross: roundMoney(resolvedReceivable),
    returnPickupFee: roundMoney(returnPickupFee),
    receivable: netReceivable,
    adminDiscount: roundMoney(adminDiscount),
  };
};

const formatAdminDeliveryAddress = (address = {}, sellerOrderAddress = {}) => {
  const src = address && Object.keys(address).length ? address : sellerOrderAddress || {};
  const street = String(src.street || src.address || src.line1 || '').trim();
  const formatted = String(
    src.formattedAddress ||
      [
        street,
        src.additionalDetails,
        src.landmark,
        src.city,
        src.state,
        src.zipCode || src.pincode,
      ]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join(', '),
  ).trim();

  return {
    ...src,
    street,
    address: street || formatted,
    formattedAddress: formatted || street,
    city: String(src.city || '').trim(),
    state: String(src.state || '').trim(),
    zipCode: String(src.zipCode || src.pincode || '').trim(),
    phone: String(src.phone || '').trim(),
    name: String(src.name || '').trim(),
    landmark: String(src.landmark || src.additionalDetails || '').trim(),
    location: src.location || null,
  };
};

const normalizeAdminPayment = (payment = {}, pricing = {}) => {
  const method = String(payment.method || payment.mode || 'cash').trim().toLowerCase();
  const rawStatus = String(payment.status || '').trim().toLowerCase();
  const status =
    rawStatus === 'paid' || rawStatus === 'captured' || rawStatus === 'success'
      ? 'completed'
      : rawStatus || (method === 'cash' || method === 'cod' ? 'cod_pending' : 'pending');

  return {
    ...payment,
    method,
    status,
    transactionId:
      payment.transactionId ||
      payment.txnId ||
      payment.razorpayPaymentId ||
      payment.razorpay_payment_id ||
      payment.paymentId ||
      '',
    amountDue: Number(payment.amountDue ?? pricing.total ?? 0),
    amountPaid: Number(
      payment.amountPaid ??
        (status === 'completed' ? pricing.total || payment.amountDue || 0 : 0),
    ),
  };
};

const buildQuickAdminOrderResponse = (order, sellerMap = {}, sellerOrderMap = {}, deliveryPartner = null, returnSummary = null) => {
  const paymentAmountDue = Number(order?.payment?.amountDue || 0);
  const payableAmount = Number(order?.payableAmount || 0);
  const totalAmount = Number(order?.totalAmount || 0);
  const amount = Number(order?.amount || 0);
  const total = Number(order?.total || 0);
  const pricingTotal = Number(order?.pricing?.total || 0);
  const platformFee = Number(order?.pricing?.platformFee || 0);
  const payableTotal = Math.max(
    0,
    paymentAmountDue,
    payableAmount,
    totalAmount,
    amount,
    total,
    pricingTotal,
  );

  const quickItems = Array.isArray(order?.items) ? order.items.filter((item) => item?.type === 'quick') : [];
  const firstSellerId = String(quickItems[0]?.sourceId || '');
  const seller = sellerMap[firstSellerId] || null;
  const sellerOrderEntry = sellerOrderMap[String(order?.orderId || '')] || null;
  const sellerOrders = Array.isArray(sellerOrderEntry)
    ? sellerOrderEntry
    : sellerOrderEntry
      ? [sellerOrderEntry]
      : [];
  const sellerOrder = sellerOrders[0] || null;
  const sellerEarnings = aggregateSellerOrderEarnings(sellerOrders, order, returnSummary);
  const tax = Number(order?.pricing?.tax ?? order?.pricing?.gst ?? 0);
  const couponSource = String(order?.pricing?.appliedCoupon?.source || '').toLowerCase();
  const parentSubtotal = Math.max(0, Number(order?.pricing?.subtotal || 0));
  const rawDiscount = Math.max(
    0,
    Number(order?.pricing?.discount || order?.pricing?.appliedCoupon?.discount || 0),
  );
  const discount =
    parentSubtotal > 0 && rawDiscount >= parentSubtotal
      ? Number(sellerEarnings.adminDiscount || sellerEarnings.couponDiscount || 0)
      : rawDiscount;
  const adminDiscount =
    couponSource === 'admin' ? discount : Number(sellerEarnings.adminDiscount || 0);
  // Delivery rider only — return pickup is an admin cost for new returns.
  const deliveryRiderEarning = Number(order?.riderEarning || order?.pricing?.riderEarning || 0);
  const returnPickupFee = Math.max(
    0,
    Number(returnSummary?.totalReturnPickupFee || sellerEarnings.returnPickupFee || 0),
  );
  const returnPickupPaidByAdmin = Math.max(
    0,
    Number(returnSummary?.totalReturnPickupPaidByAdmin || 0),
  );
  const returnRiderEarning = Math.max(
    0,
    Number(returnSummary?.totalReturnRiderEarning || returnPickupFee),
  );
  const riderEarning = roundMoney(deliveryRiderEarning + returnRiderEarning);
  const deliveryMargin = roundMoney(
    Number(order?.pricing?.deliveryFee || 0) - deliveryRiderEarning,
  );
  const refundedTaxShare = roundMoney(
    (Array.isArray(returnSummary?.returns) ? returnSummary.returns : []).reduce((sum, row) => {
      const refundStatus = String(row?.refundStatus || '').toLowerCase();
      if (refundStatus !== 'completed') return sum;
      return sum + Number(row?.pricing?.taxShare || 0);
    }, 0),
  );
  // Admin keeps packing out of earning. After completed returns, refunded GST leaves admin.
  const adminEarningBeforeReturn = roundMoney(
    platformFee +
      tax +
      Number(sellerEarnings.commission || 0) +
      deliveryMargin -
      adminDiscount,
  );
  const adminEarningBeforePickup = roundMoney(adminEarningBeforeReturn - refundedTaxShare);
  const adminEarning = roundMoney(adminEarningBeforePickup - returnPickupPaidByAdmin);
  const itemCount = Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
    : 0;

  const customer = resolveQuickOrderCustomer(order, sellerOrder);
  const address = formatAdminDeliveryAddress(order.deliveryAddress || {}, sellerOrder?.address || {});
  if (!customer.phone && address.phone) customer.phone = address.phone;
  if ((!customer.name || customer.name === 'Customer') && address.name) customer.name = address.name;

  const partnerDoc =
    deliveryPartner ||
    (order?.dispatch?.deliveryPartnerId && typeof order.dispatch.deliveryPartnerId === 'object'
      ? order.dispatch.deliveryPartnerId
      : null);
  const deliveryBoy = partnerDoc
    ? {
        _id: partnerDoc._id || partnerDoc.id || null,
        id: partnerDoc._id || partnerDoc.id || null,
        name: partnerDoc.name || 'Delivery Partner',
        phone: partnerDoc.phone || partnerDoc.phoneNumber || '',
        vehicleType: partnerDoc.vehicleType || '',
        vehicleNumber: partnerDoc.vehicleNumber || '',
        profilePhoto: partnerDoc.profilePhoto || '',
      }
    : null;

  const sellerAddress = String(
    seller?.address ||
      seller?.location?.formattedAddress ||
      seller?.location?.address ||
      '',
  ).trim();

  return {
    id: order._id,
    _id: order._id,
    orderId: order.orderId,
    orderNumber: order.orderId,
    orderType: order.orderType || "quick",
    total: payableTotal,
    amount: payableTotal,
    status: legacyQuickStatusFromOrder(order),
    orderStatus: order.orderStatus || '',
    workflowStatus: order.workflowStatus || '',
    workflowVersion: order.workflowVersion || 1,
    returnStatus: returnSummary?.returnStatus || order.returnStatus || '',
    returnStatusLabel: returnSummary?.returnStatusLabel || '',
    hasReturn: Boolean(returnSummary?.hasReturn),
    returnSummary: returnSummary || null,
    originalPaidTotal: returnSummary?.originalPaidTotal ?? roundMoney(payableTotal),
    refundedAmount: returnSummary?.refundedAmount || 0,
    netAfterReturn: returnSummary?.netAfterReturn ?? roundMoney(payableTotal),
    itemCount,
    items: Array.isArray(order.items) ? order.items : [],
    pricing: order.pricing || {},
    payment: normalizeAdminPayment(order.payment || {}, order.pricing || {}),
    timeSlot: order.timeSlot || order.deliverySlot || 'now',
    note: order.note || '',
    riderEarning: roundMoney(riderEarning),
    deliveryRiderEarning: roundMoney(deliveryRiderEarning),
    returnRiderEarning: roundMoney(returnRiderEarning),
    returnPickupFee: roundMoney(returnPickupFee),
    returnPickupPaidByAdmin: roundMoney(returnPickupPaidByAdmin),
    adminEarningBeforePickup: roundMoney(adminEarningBeforePickup),
    platformProfit:
      order.platformProfit != null
        ? roundMoney(order.platformProfit)
        : roundMoney(
            Number(order?.pricing?.deliveryFee || 0) +
              platformFee -
              deliveryRiderEarning -
              adminDiscount,
          ),
    adminEarning,
    adminEarningBeforeReturn,
    refundedTaxShare,
    deliveryMargin,
    sellerEarnings,
    adminDiscount: roundMoney(adminDiscount),
    sessionId: order.sessionId || '',
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    customer,
    deliveryBoy,
    deliveryPartner: deliveryBoy,
    dispatch: {
      status: order?.dispatch?.status || 'unassigned',
      deliveryPartnerId: deliveryBoy || order?.dispatch?.deliveryPartnerId || null,
    },
    seller: seller
      ? {
          _id: seller._id,
          shopName: seller.shopName || seller.name || 'Store',
          name: seller.name || seller.shopName || 'Store',
          phone: seller.phone || seller.phoneNumber || seller.shopInfo?.alternatePhone || '',
          address: sellerAddress,
          location: seller.location || null,
          businessType: seller?.shopInfo?.businessType || '',
        }
      : null,
    storeName: seller?.shopName || seller?.name || '',
    sellerOrder: sellerOrder
      ? {
          _id: sellerOrder._id,
          status: sellerOrder.status,
          workflowStatus: sellerOrder.workflowStatus,
          customer: sellerOrder.customer || {},
          address: sellerOrder.address || {},
          cancellationReason: sellerOrder.cancellationReason || '',
          pricing: sellerEarnings,
        }
      : null,
    cancellationReason: resolveQuickOrderCancellationReason(order, sellerOrder),
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
    address,
  };
};

const getCategoryImage = async (req) => {
  if (req.file?.buffer) {
    const imageError = validateCategoryImageFile(req.file);
    if (imageError) {
      const error = new Error(imageError);
      error.statusCode = 400;
      throw error;
    }
    return uploadImageBuffer(req.file.buffer, 'quick-commerce/categories');
  }
  return String(req.body?.image || '').trim();
};

const getProductImages = async (req) => {
  const mainFile = req.files?.mainImage?.[0];
  const galleryFiles = Array.isArray(req.files?.galleryImages) ? req.files.galleryImages : [];

  for (const file of [mainFile, ...galleryFiles].filter(Boolean)) {
    const imageError = validateCategoryImageFile(file);
    if (imageError) {
      const error = new Error(imageError);
      error.statusCode = 400;
      throw error;
    }
  }

  const mainImage = mainFile?.buffer
    ? await uploadImageBuffer(mainFile.buffer, 'quick-commerce/products/main')
    : String(req.body?.mainImage || req.body?.image || '').trim();

  const existingGallery = []
    .concat(req.body?.galleryImages || [])
    .flat()
    .filter(Boolean)
    .map((value) => String(value).trim());

  const uploadedGallery = await Promise.all(
    galleryFiles.map((file) => uploadImageBuffer(file.buffer, 'quick-commerce/products/gallery'))
  );

  const galleryImages = [...existingGallery, ...uploadedGallery].filter(Boolean);

  return {
    mainImage,
    galleryImages,
    image: mainImage || galleryImages[0] || '',
  };
};

const buildCategoryTree = (categories) => {
  const byId = new Map();
  const roots = [];

  categories.forEach((category) => {
    byId.set(String(category._id), { ...toCategory(category), children: [] });
  });

  byId.forEach((category) => {
    const parentId = category.parentId ? String(category.parentId) : null;
    if (parentId && byId.has(parentId)) {
      byId.get(parentId).children.push(category);
    } else {
      roots.push(category);
    }
  });

  return roots;
};

const toSellerRequest = (seller, extras = {}) => ({
  id: seller._id,
  _id: seller._id,
  shopName: seller.shopName || seller.name || 'Store',
  ownerName: seller.name || 'Seller',
  email: seller.email || '',
  phone: seller.phoneLast10 || seller.phone || '',
  location: seller.location?.formattedAddress || seller.location?.address || '',
  category: seller.shopInfo?.businessType || 'General',
  applicationDate: seller.createdAt,
  approvedAt: seller.approvedAt || null,
  zoneId: seller.shopInfo?.zoneId || null,
  zoneName: seller.shopInfo?.zoneName || '',
  productCount: Number(extras.productCount) || 0,
  status:
    seller.approvalStatus ||
    (seller.approved === false ? 'pending' : 'approved'),
  approvalStatus:
    seller.approvalStatus ||
    (seller.approved === false ? 'pending' : 'approved'),
  approved: seller.approved !== false,
  onboardingSubmitted: seller.onboardingSubmitted === true,
  bankInfo: seller.bankInfo || {},
  documents: seller.documents || {},
  shopInfo: seller.shopInfo || {},
  approvalNotes: seller.approvalNotes || '',
  wasEverApproved: seller.wasEverApproved === true,
  hasPendingProfileUpdate: seller.pendingProfileChanges?.hasPendingUpdate === true,
  pendingProfileChanges: seller.pendingProfileChanges?.hasPendingUpdate
    ? {
        hasPendingUpdate: true,
        proposed: seller.pendingProfileChanges.proposed || {},
        previous: seller.pendingProfileChanges.previous || {},
        changeTypes: seller.pendingProfileChanges.changeTypes || [],
        reason: seller.pendingProfileChanges.reason || '',
        requestedAt: seller.pendingProfileChanges.requestedAt || null,
      }
    : null,
  profileUpdateRequestedAt: seller.pendingProfileChanges?.requestedAt || null,
});

export const getAdminStats = async (req, res) => {
  const period = String(req.query?.period || 'overall').toLowerCase();
  const zoneId = mongoose.Types.ObjectId.isValid(req.query?.zoneId)
    ? new mongoose.Types.ObjectId(String(req.query.zoneId))
    : null;

  const currentRange = getQuickDashboardPeriodRange(period);
  const previousRange = getQuickDashboardPreviousRange(period, currentRange);
  const timelineConfig = getQuickDashboardTimelineConfig(period);

  const sellerBaseFilter = {
    approvalStatus: 'approved',
    approved: { $ne: false },
    isDeleted: { $ne: true },
    accountStatus: { $ne: 'deleted' },
  };
  if (zoneId) sellerBaseFilter['shopInfo.zoneId'] = zoneId;

  const pendingSellerFilter = {};
  if (zoneId) pendingSellerFilter['shopInfo.zoneId'] = zoneId;

  const approvedSellers = await Seller.find(sellerBaseFilter).select('_id shopName name rating totalRatings').lean();
  const sellerIds = approvedSellers.map((seller) => seller._id);
  const sellerIdStrings = sellerIds.map((sellerId) => String(sellerId));
  const sellerIdSet = new Set(sellerIdStrings);
  const sellerMap = approvedSellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});

  const orderMatch = {
    orderType: { $in: ['quick', 'mixed'] },
    items: {
      $elemMatch: sellerIdStrings.length > 0
        ? { type: 'quick', sourceId: { $in: sellerIdStrings } }
        : { type: 'quick' },
    },
  };
  if (currentRange) {
    orderMatch.createdAt = { $gte: currentRange.start, $lte: currentRange.end };
  }

  const previousOrderMatch = previousRange
    ? {
        orderType: { $in: ['quick', 'mixed'] },
        items: {
          $elemMatch: sellerIdStrings.length > 0
            ? { type: 'quick', sourceId: { $in: sellerIdStrings } }
            : { type: 'quick' },
        },
        createdAt: { $gte: previousRange.start, $lte: previousRange.end },
      }
    : null;

  const productMatch = {
    sellerId: sellerIds.length > 0 ? { $in: sellerIds } : { $exists: true, $ne: null },
    approvalStatus: 'approved',
  };

  const currentApprovedSellersCount = approvedSellers.length;
  const previousApprovedSellersCount = currentRange
    ? await Seller.countDocuments({
        ...sellerBaseFilter,
        createdAt: { $lt: currentRange.start },
      })
    : currentApprovedSellersCount;

  const [
    orderSummaryAgg,
    previousOrderSummaryAgg,
    recentOrders,
    revenueTrendAgg,
    customerIds,
    previousCustomerIds,
    activeProducts,
    categoryCount,
    productInventorySummaryAgg,
    inventoryAlertsAgg,
    pendingSellers,
    totalZones,
    topProductsAgg,
    topCategoriesAgg,
    topSellersAgg,
  ] = await Promise.all([
    QuickOrder.aggregate([
      { $match: orderMatch },
      buildQuickOrderStatusGroupStage(sellerIds),
    ]),
    previousOrderMatch
      ? QuickOrder.aggregate([
          { $match: previousOrderMatch },
          buildQuickOrderStatusGroupStage(sellerIds),
        ])
      : Promise.resolve([]),
    QuickOrder.find(orderMatch)
      .populate('userId', 'name phone')
      .select('orderId orderStatus workflowStatus createdAt items userId')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    QuickOrder.aggregate([
      { $match: { ...orderMatch, ...timelineConfig.match } },
      {
        $group: {
          _id: timelineConfig.groupId,
          revenue: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$orderStatus', 'delivered'] },
                    { $eq: ['$workflowStatus', 'DELIVERED'] },
                  ],
                },
                buildQuickItemsRevenueExpr(sellerIds),
                0,
              ],
            },
          },
          orders: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
    ]),
    QuickOrder.distinct('userId', { ...orderMatch, userId: { $ne: null } }),
    previousOrderMatch
      ? QuickOrder.distinct('userId', { ...previousOrderMatch, userId: { $ne: null } })
      : Promise.resolve([]),
    QuickProduct.countDocuments({ ...productMatch, isActive: true, status: 'active' }),
    QuickCategory.countDocuments({ approvalStatus: 'approved', isActive: true }),
    QuickProduct.aggregate([
      { $match: productMatch },
      { $addFields: { effectiveStock: effectiveStockExpr } },
      {
        $group: {
          _id: null,
          lowStockProducts: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$effectiveStock', 0] },
                    { $lte: ['$effectiveStock', { $ifNull: ['$lowStockAlert', 5] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          outOfStockProducts: {
            $sum: {
              $cond: [{ $lte: ['$effectiveStock', 0] }, 1, 0],
            },
          },
        },
      },
    ]),
    QuickProduct.aggregate([
      { $match: productMatch },
      { $addFields: { effectiveStock: effectiveStockExpr } },
      {
        $match: {
          $expr: {
            $or: [
              { $lte: ['$effectiveStock', 0] },
              {
                $and: [
                  { $gt: ['$effectiveStock', 0] },
                  { $lte: ['$effectiveStock', { $ifNull: ['$lowStockAlert', 5] }] },
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'quick_seller_profiles',
          localField: 'sellerId',
          foreignField: '_id',
          as: 'seller',
        },
      },
      {
        $lookup: {
          from: 'quick_categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: 1,
          mainImage: 1,
          stock: '$effectiveStock',
          threshold: { $ifNull: ['$lowStockAlert', 5] },
          storeName: { $ifNull: ['$seller.shopName', '$seller.name'] },
          categoryName: '$category.name',
          status: {
            $cond: [{ $lte: ['$effectiveStock', 0] }, 'out_of_stock', 'low_stock'],
          },
        },
      },
      { $sort: { stock: 1, updatedAt: -1, createdAt: -1 } },
      { $limit: 6 },
    ]),
    Seller.countDocuments({ ...pendingSellerFilter, approvalStatus: 'pending' }),
    QuickZone.countDocuments(zoneId ? { _id: zoneId } : {}),
    QuickOrder.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $match: sellerIdStrings.length > 0
          ? { 'items.type': 'quick', 'items.sourceId': { $in: sellerIdStrings } }
          : { 'items.type': 'quick' },
      },
      {
        $group: {
          _id: '$items.itemId',
          name: { $first: '$items.name' },
          quantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.price', 0] },
                { $ifNull: ['$items.quantity', 0] },
              ],
            },
          },
          orders: { $addToSet: '$orderId' },
        },
      },
      { $sort: { quantity: -1, revenue: -1 } },
      { $limit: 6 },
    ]),
    QuickOrder.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $match: sellerIdStrings.length > 0
          ? { 'items.type': 'quick', 'items.sourceId': { $in: sellerIdStrings } }
          : { 'items.type': 'quick' },
      },
      {
        $addFields: {
          productObjectId: {
            $convert: {
              input: '$items.itemId',
              to: 'objectId',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'quick_products',
          localField: 'productObjectId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'quick_categories',
          localField: 'product.categoryId',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$category._id',
          name: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.price', 0] },
                { $ifNull: ['$items.quantity', 0] },
              ],
            },
          },
          quantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
          color: { $first: { $ifNull: ['$category.accentColor', '$category.headerColor'] } },
        },
      },
      { $sort: { revenue: -1, quantity: -1 } },
      { $limit: 6 },
    ]),
    QuickOrder.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $match: sellerIdStrings.length > 0
          ? { 'items.type': 'quick', 'items.sourceId': { $in: sellerIdStrings } }
          : { 'items.type': 'quick' },
      },
      {
        $group: {
          _id: '$items.sourceId',
          name: { $first: '$items.sourceName' },
          quantity: { $sum: { $ifNull: ['$items.quantity', 0] } },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.price', 0] },
                { $ifNull: ['$items.quantity', 0] },
              ],
            },
          },
          orders: { $addToSet: '$orderId' },
        },
      },
      { $sort: { revenue: -1, quantity: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const orderSummary = orderSummaryAgg?.[0] || {};
  const previousOrderSummary = previousOrderSummaryAgg?.[0] || {};
  const inventorySummary = productInventorySummaryAgg?.[0] || {};

  const topProductIds = topProductsAgg
    .map((item) => item?._id)
    .filter((item) => mongoose.Types.ObjectId.isValid(item))
    .map((item) => new mongoose.Types.ObjectId(String(item)));

  const topProductDocs = topProductIds.length > 0
    ? await QuickProduct.find({ _id: { $in: topProductIds } })
        .populate('categoryId', 'name')
        .select('_id name mainImage image stock lowStockAlert sellerId categoryId')
        .lean()
    : [];

  const topProductDocMap = topProductDocs.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  const revenueHistoryMap = revenueTrendAgg.reduce((acc, bucket) => {
    acc[timelineConfig.keyOf(bucket._id)] = bucket;
    return acc;
  }, {});

  const revenueHistory = timelineConfig.buckets.map((bucket) => {
    const match = revenueHistoryMap[bucket.key];
    return {
      name: bucket.label,
      revenue: Number(match?.revenue || 0),
      orders: Number(match?.orders || 0),
    };
  });

  const totalRevenueRaw = Number(orderSummary.totalRevenue || 0);
  const returnTotals = await getCompletedReturnRefundTotals().catch(() => ({
    refundedAmount: 0,
    refundedTax: 0,
    count: 0,
  }));
  const totalRevenue = Math.max(0, totalRevenueRaw - Number(returnTotals.refundedAmount || 0));
  const totalOrders = Number(orderSummary.totalOrders || 0);
  const totalCustomers = customerIds.length;
  const lowStockProducts = Number(inventorySummary.lowStockProducts || 0);
  const outOfStockProducts = Number(inventorySummary.outOfStockProducts || 0);

  const recentReturnsByOrderId = await loadReturnsByOrderIds(
    recentOrders.map((order) => order.orderId).filter(Boolean),
  );

  const recentOrdersPayload = recentOrders.map((order) => {
    const sellerNames = Array.from(
      new Set(
        (order.items || [])
          .filter((item) => item?.type === 'quick')
          .filter((item) => !sellerIdSet.size || sellerIdSet.has(String(item?.sourceId || '')))
          .map((item) => item?.sourceName || sellerMap[String(item?.sourceId || '')]?.shopName || sellerMap[String(item?.sourceId || '')]?.name || 'Store')
          .filter(Boolean),
      ),
    );
    const status = legacyQuickStatusFromOrder(order);
    const originalAmount = Number(getQuickRevenueFromOrderItems(order, sellerIdSet));
    const returnAttachment = attachReturnSummaryToOrder(
      order,
      recentReturnsByOrderId.get(String(order.orderId || '')) || [],
    );

    return {
      id: order.orderId || String(order._id),
      orderId: order.orderId || String(order._id),
      customer: order.userId?.name || order.userId?.phone || 'Guest',
      seller: sellerNames.join(', '),
      status,
      statusText: formatQuickStatusLabel(status),
      returnStatus: returnAttachment.returnStatus || order.returnStatus || '',
      returnStatusLabel: returnAttachment.returnStatusLabel || '',
      hasReturn: returnAttachment.hasReturn,
      amount: originalAmount,
      originalPaidTotal: returnAttachment.originalPaidTotal || originalAmount,
      refundedAmount: returnAttachment.refundedAmount || 0,
      netAfterReturn: returnAttachment.netAfterReturn ?? originalAmount,
      itemCount: Number(getQuickItemCountFromOrderItems(order, sellerIdSet)),
      time: order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '',
      createdAt: order.createdAt || null,
    };
  });

  const topProducts = topProductsAgg.map((item, index) => {
    const product = topProductDocMap[String(item._id)] || {};
    const seller = sellerMap[String(product?.sellerId || '')] || null;
    return {
      id: item._id,
      name: item.name || product?.name || 'Unnamed product',
      cat: product?.categoryId?.name || 'Quick Commerce',
      quantity: Number(item.quantity || 0),
      orders: Array.isArray(item.orders) ? item.orders.length : 0,
      rev: Number(item.revenue || 0),
      revenue: Number(item.revenue || 0),
      stock: Number(product?.stock || 0),
      threshold: Number(product?.lowStockAlert || 5),
      image: product?.mainImage || product?.image || '',
      storeName: seller?.shopName || seller?.name || '',
      color: QUICK_DASHBOARD_CATEGORY_COLORS[index % QUICK_DASHBOARD_CATEGORY_COLORS.length],
    };
  });

  const categoryData = topCategoriesAgg.map((item, index) => ({
    id: item._id ? String(item._id) : `category-${index}`,
    name: item.name || 'Uncategorized',
    value: Number(item.quantity || 0),
    revenue: Number(item.revenue || 0),
    color: item.color || QUICK_DASHBOARD_CATEGORY_COLORS[index % QUICK_DASHBOARD_CATEGORY_COLORS.length],
  }));

  const sellerLeaderboard = topSellersAgg.map((sellerAgg) => {
    const seller = sellerMap[String(sellerAgg._id)] || null;
    return {
      id: String(sellerAgg._id || ''),
      name: seller?.shopName || seller?.name || sellerAgg.name || 'Store',
      rating: Number(seller?.rating || 0),
      reviews: Number(seller?.totalRatings || 0),
      recentOrders: Array.isArray(sellerAgg.orders) ? sellerAgg.orders.length : 0,
      quantity: Number(sellerAgg.quantity || 0),
      revenue: Number(sellerAgg.revenue || 0),
    };
  });

  return res.json({
    success: true,
    result: {
      overview: {
        totalRevenue,
        totalOrders,
        activeSellers: currentApprovedSellersCount,
        totalCustomers,
        activeProducts,
        totalCategories: categoryCount,
        lowStockProducts,
        outOfStockProducts,
        pendingSellers,
        totalZones,
        totalReturnRefunds: Number(returnTotals.refundedAmount || 0),
        totalReturnsCompleted: Number(returnTotals.count || 0),
        prevTotalRevenue: Number(previousOrderSummary.totalRevenue || 0),
        prevTotalOrders: Number(previousOrderSummary.totalOrders || 0),
        prevTotalCustomers: previousCustomerIds.length,
        prevActiveSellers: previousApprovedSellersCount,
      },
      orderStatus: {
        pending: Number(orderSummary.pending || 0),
        processing: Number(orderSummary.processing || 0),
        outForDelivery: Number(orderSummary.outForDelivery || 0),
        delivered: Number(orderSummary.delivered || 0),
        cancelled: Number(orderSummary.cancelled || 0),
      },
      revenueHistory,
      categoryData,
      recentOrders: recentOrdersPayload,
      topProducts,
      inventoryAlerts: inventoryAlertsAgg.map((item) => ({
        id: String(item._id),
        name: item.name || 'Unnamed product',
        stock: Number(item.stock || 0),
        threshold: Number(item.threshold || 0),
        storeName: item.storeName || 'Store',
        categoryName: item.categoryName || 'Quick Commerce',
        status: item.status || 'low_stock',
        image: item.mainImage || '',
      })),
      sellerLeaderboard,
      filters: {
        period,
        zoneId: zoneId ? String(zoneId) : 'all',
      },
    },
  });
};

export const getAdminCategories = async (_req, res) => {
  const {
    type,
    search,
    approvalStatus,
    tree,
    flat,
    page = 1,
    limit = 50,
  } = _req.query || {};

  const query = {};
  if (type && String(tree) !== 'true') query.type = String(type);
  if (search) query.name = { $regex: String(search).trim(), $options: 'i' };
  if (approvalStatus && approvalStatus !== 'all') query.approvalStatus = String(approvalStatus);

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = String(tree) === 'true' ? 5000 : Math.max(1, Math.min(parseInt(limit, 10) || 50, 1000));

  const [categories, total] = await Promise.all([
    QuickCategory.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(String(tree) === 'true' ? 0 : (currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    QuickCategory.countDocuments(query),
  ]);

  const mapped = categories.map(toCategory);
  if (String(tree) === 'true') {
    let fullTree = buildCategoryTree(categories);
    if (type) {
      const originalCount = fullTree.length;
      fullTree = fullTree.filter(root => 
        !root.parentId && 
        (String(root.type).toLowerCase() === String(type).toLowerCase() || !root.type || root.type === 'default')
      );
    }
    return res.json({ success: true, results: fullTree });
  }
  if (String(flat) === 'true') {
    return res.json({ success: true, results: mapped });
  }

  return res.json({
    success: true,
    result: {
      items: mapped,
      page: currentPage,
      limit: perPage,
      total,
    },
    results: mapped,
  });
};

export const createCategory = async (req, res) => {
  try {
    const {
      name,
      slug: slugInput,
      accentColor,
      sortOrder,
      description,
      type,
      status,
      approvalStatus,
      parentId,
      iconId,
      adminCommission,
      commission,
      gst,
      handlingFees,
      headerColor,
      businessType,
      returnsEnabled,
      returnWindowHours,
      returnWindowDays,
    } = req.body || {};

    const fieldError = validateCategoryFields({
      name,
      type,
      businessType,
      adminCommission,
      commission,
      gst,
      handlingFees,
      returnsEnabled,
      returnWindowHours,
      returnWindowDays,
      status,
      requireHeaderRates: String(type || 'header').toLowerCase() === 'header',
    });
    if (fieldError) {
      return res.status(400).json({ success: false, message: fieldError });
    }

    const parentValidation = await validateCategoryParent(type || 'header', parentId);
    if (parentValidation.error) {
      return res.status(400).json({ success: false, message: parentValidation.error });
    }

    const slugBase = slugInput ? slugify(slugInput) : slugify(name);
    const slug = await generateUniqueSlug(slugBase || name);
    const normalizedType = parentValidation.type || 'header';
    const normalizedBusinessType = VALID_BUSINESS_TYPES.includes(businessType)
      ? businessType
      : 'quick_commerce';

    // Header categories use icon library only — no custom image upload.
    if (normalizedType === 'header') {
      if (req.file) {
        return res.status(400).json({
          success: false,
          message: 'Header categories use icons only. Custom image upload is not allowed.',
        });
      }
      if (!String(iconId || '').trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please select an icon for the header category',
        });
      }
    }

    const image = normalizedType === 'header' ? '' : await getCategoryImage(req);

    const createPayload = {
      name: String(name).trim(),
      slug,
      image,
      description: description || '',
      type: normalizedType,
      status: status || 'active',
      approvalStatus: approvalStatus || 'approved',
      approvedAt: (approvalStatus || 'approved') === 'approved' ? new Date() : null,
      parentId: parentValidation.parentId,
      accentColor: accentColor || '#0c831f',
      sortOrder: Number(sortOrder || 0),
      isActive: (status || 'active') === 'active',
    };

    if (normalizedType === 'header') {
      const commissionSource =
        commission !== undefined && commission !== null && commission !== ''
          ? commission
          : adminCommission;
      createPayload.businessType = normalizedBusinessType;
      createPayload.iconId = iconId || '';
      createPayload.adminCommission = parseNumber(commissionSource, 0);
      createPayload.gst = parseNumber(gst, 0);
      createPayload.handlingFees = parseNumber(handlingFees, 0);
      createPayload.headerColor = headerColor || accentColor || '#0c831f';
      createPayload.returnsEnabled = parseBool(returnsEnabled, true);
      const parsedReturnHours = parseReturnWindowHours(returnWindowHours, returnWindowDays);
      createPayload.returnWindowHours = Number.isFinite(parsedReturnHours) ? parsedReturnHours : 72;
    }

    const category = await QuickCategory.create(createPayload);

    clearContentCache();
    return res.status(201).json({ success: true, result: toCategory(category) });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A category with this slug already exists' });
    }
    throw error;
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!mongoose.isValidObjectId(categoryId)) {
      return res.status(400).json({ success: false, message: 'Invalid category ID' });
    }

    const category = await QuickCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const {
      name,
      slug,
      accentColor,
      sortOrder,
      description,
      type,
      status,
      approvalStatus,
      parentId,
      iconId,
      adminCommission,
      commission,
      gst,
      handlingFees,
      headerColor,
      businessType,
      returnsEnabled,
      returnWindowHours,
      returnWindowDays,
    } = req.body || {};

    const fieldError = validateCategoryFields({
      name: name !== undefined ? name : category.name,
      type: type !== undefined ? type : category.type,
      businessType: businessType !== undefined ? businessType : category.businessType,
      adminCommission,
      commission,
      gst,
      handlingFees,
      returnsEnabled,
      returnWindowHours,
      returnWindowDays,
      status,
      requireHeaderRates: false,
    });
    if (fieldError) {
      return res.status(400).json({ success: false, message: fieldError });
    }

    const nextType = type !== undefined ? type : category.type;
    if (parentId !== undefined || type !== undefined) {
      const parentValidation = await validateCategoryParent(
        nextType,
        parentId !== undefined ? parentId : category.parentId,
        category._id,
      );
      if (parentValidation.error) {
        return res.status(400).json({ success: false, message: parentValidation.error });
      }
      category.parentId = parentValidation.parentId;
      category.type = parentValidation.type;
    }

    const effectiveType = category.type || nextType;
    if (effectiveType === 'header') {
      if (req.file) {
        return res.status(400).json({
          success: false,
          message: 'Header categories use icons only. Custom image upload is not allowed.',
        });
      }
      const nextIconId = iconId !== undefined ? iconId : category.iconId;
      if (!String(nextIconId || '').trim()) {
        return res.status(400).json({
          success: false,
          message: 'Please select an icon for the header category',
        });
      }
      // Drop any legacy custom image so icons remain the only visual source.
      category.image = '';
    } else {
      const image = await getCategoryImage(req);
      if (image) category.image = image;
    }

    if (name !== undefined) category.name = String(name).trim();
    if (slug !== undefined || name !== undefined) {
      const nextSlug = slugify(slug || name || category.name);
      category.slug = await generateUniqueSlug(nextSlug || category.name, category._id);
    }
    if (description !== undefined) category.description = description;
    if (category.type === 'header' && businessType !== undefined) {
      category.businessType = VALID_BUSINESS_TYPES.includes(businessType)
        ? businessType
        : 'quick_commerce';
    }
    const wasVisible = category.isActive !== false && category.status !== 'inactive';
    if (status !== undefined) {
      category.status = status;
      category.isActive = status === 'active';
      // Switching a category back on is only ever an explicit admin action, so it must not
      // stay stamped as "switched off by an ancestor".
      if (status === 'active') category.deactivatedByParentId = null;
    }
    const becomesVisible = category.isActive !== false && category.status !== 'inactive';
    if (approvalStatus !== undefined) {
      category.approvalStatus = approvalStatus || 'pending';
      category.approvedAt = category.approvalStatus === 'approved' ? new Date() : null;
    }
    if (accentColor !== undefined) category.accentColor = accentColor || '#0c831f';
    if (headerColor !== undefined) category.headerColor = headerColor || category.accentColor;
    if (sortOrder !== undefined) category.sortOrder = parseNumber(sortOrder, 0);
    if (iconId !== undefined) category.iconId = iconId || '';

    if (category.type === 'header') {
      const commissionSource =
        commission !== undefined && commission !== null && commission !== ''
          ? commission
          : adminCommission;
      if (commissionSource !== undefined) {
        category.adminCommission = parseNumber(commissionSource, category.adminCommission || 0);
      }
      if (gst !== undefined) category.gst = parseNumber(gst, category.gst || 0);
      if (handlingFees !== undefined) category.handlingFees = parseNumber(handlingFees, 0);
      if (returnsEnabled !== undefined) {
        category.returnsEnabled = parseBool(returnsEnabled, category.returnsEnabled !== false);
      }
      const parsedReturnHours = parseReturnWindowHours(returnWindowHours, returnWindowDays);
      if (parsedReturnHours !== null && Number.isFinite(parsedReturnHours)) {
        category.returnWindowHours = parsedReturnHours;
      }
    }

    await category.save();

    // The whole subtree follows the parent, so one admin toggle is enough — the storefront
    // and seller catalog filter on each row's own flags.
    let cascade = null;
    if (wasVisible && !becomesVisible) {
      cascade = await cascadeCategoryDeactivation(category._id);
    } else if (!wasVisible && becomesVisible) {
      cascade = await cascadeCategoryReactivation(category._id);
    }

    clearContentCache();
    return res.json({ success: true, result: toCategory(category), cascade });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'A category with this slug already exists' });
    }
    throw error;
  }
};

export const removeCategory = async (req, res) => {
  const { categoryId } = req.params;

  if (!mongoose.isValidObjectId(categoryId)) {
    return res.status(400).json({ success: false, message: 'Invalid category ID' });
  }

  const rootCategory = await QuickCategory.findById(categoryId).select('_id').lean();
  if (!rootCategory) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  // Delete the category tree, but keep every product document so it can be reassigned later.
  const rootObjId = new mongoose.Types.ObjectId(String(categoryId));
  const categoryIdsToDelete = [rootObjId, ...(await collectDescendantCategoryIds(rootObjId))];

  // Take linked products off the storefront without wiping them from the DB. Their
  // header/category/subcategory ids stay pointing at the deleted nodes until an admin
  // or seller moves them onto a live branch and switches them active again.
  const { productsDeactivated } = await deactivateProductsUnderCategories(categoryIdsToDelete);

  await QuickCategory.deleteMany({ _id: { $in: categoryIdsToDelete } });

  // Keep hero configs consistent: remove any deleted category ids.
  await QuickHeroConfig.updateMany({}, { $pull: { categoryIds: { $in: categoryIdsToDelete } } });
  clearContentCache();
  return res.json({
    success: true,
    result: {
      deleted: true,
      categoriesDeleted: categoryIdsToDelete.length,
      productsDeleted: 0,
      productsDeactivated,
    },
  });
};

export const getAdminProducts = async (req, res) => {
  const {
    categoryId,
    category,
    search,
    status,
    approvalStatus,
    businessType,
    sellerId,
    page = 1,
    limit = 50,
  } = req.query || {};
  // Exclude legacy mock/seed products (no seller) that show as shop "Admin".
  const query = {
    sellerId: { $ne: null, $exists: true },
  };

  const sellerFilter = String(sellerId || '').trim();
  if (sellerFilter && sellerFilter !== 'all' && mongoose.isValidObjectId(sellerFilter)) {
    query.sellerId = new mongoose.Types.ObjectId(sellerFilter);
  }

  const categoryFilter = categoryId || category;
  if (categoryFilter && mongoose.isValidObjectId(categoryFilter)) {
    query.$or = [
      { categoryId: categoryFilter },
      { subcategoryId: categoryFilter },
      { headerId: categoryFilter },
    ];
  }
  
  if (businessType && businessType !== 'all') {
    const headers = await QuickCategory.find({ type: 'header', businessType }).select('_id');
    query.headerId = { $in: headers.map(h => h._id) };
  }

  if (search) {
    const term = escapeRegex(String(search).trim().slice(0, 80));
    if (term) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { sku: { $regex: term, $options: 'i' } },
            { slug: { $regex: term, $options: 'i' } },
          ],
        },
      ];
    }
  }
  if (status && status !== 'all') {
    query.status = status;
    query.isActive = status === 'active';
  }
  if (approvalStatus && approvalStatus !== 'all') query.approvalStatus = approvalStatus;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));

  const [products, total] = await Promise.all([
    QuickProduct.find(query)
      .populate('headerId categoryId subcategoryId', 'name slug businessType type')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    QuickProduct.countDocuments(query),
  ]);
  const sellerMap = await buildProductSellerMap(products);

  return res.json({
    success: true,
    result: {
      items: products.map((product) => toProduct(withProductSeller(product, sellerMap))),
      page: currentPage,
      limit: perPage,
      total,
    },
  });
};

export const getAdminProductById = async (req, res) => {
  const productId = String(req.params.productId || '').trim();

  if (!mongoose.isValidObjectId(productId)) {
    return res.status(400).json({ success: false, message: 'Invalid product id' });
  }

  const product = await QuickProduct.findById(productId)
    .populate('headerId categoryId subcategoryId', 'name slug businessType type')
    .lean();

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const sellerMap = await buildProductSellerMap([product]);

  return res.json({
    success: true,
    result: toProduct(withProductSeller(product, sellerMap)),
  });
};

export const createProduct = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Admin cannot create products. Sellers manage their own catalog.',
  });
};

const productList = (value) => (Array.isArray(value) ? value : []);

export const updateProduct = async (req, res) => {
  try {
    const productId = String(req.params.productId || '').trim();
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product id' });
    }

    const product = await QuickProduct.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (!product.sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit legacy products without a seller',
      });
    }

    const categoryIds = await resolveSellerCategoryIds({
      headerId: req.body?.headerId || product.headerId,
      categoryId: req.body?.categoryId || product.categoryId,
      subcategoryId: req.body?.subcategoryId || product.subcategoryId,
      allowDefaultFallback: false,
    });

    const payload = await parseProductPayload(req, product);
    const pricingError = validateProductPricing(payload);
    if (pricingError) {
      return res.status(400).json({ success: false, message: pricingError });
    }

    payload.pharmacyDetails = product.pharmacyDetails || {};
    payload.variants = productList(payload.variants).map(stripPharmacyVariantMeta);

    if (payload.variants && payload.variants.length > 0) {
      payload.stock = payload.variants.reduce(
        (sum, variant) => sum + (Number(variant.stock) || 0),
        0,
      );
      const first = payload.variants[0] || {};
      payload.price = Number(first.price) || 0;
      payload.salePrice = Number(first.salePrice) || 0;
      payload.mrp = Math.max(
        Number(payload.price) || 0,
        Number(payload.salePrice) || 0,
        Number(payload.mrp) || 0,
      );
    }

    if (payload.status === 'active' && product.deactivatedByParentId) {
      const deactivatedParent = await QuickCategory.findById(product.deactivatedByParentId).lean();
      const parentStillInactive =
        deactivatedParent &&
        (deactivatedParent.isActive === false || deactivatedParent.status === 'inactive');

      if (parentStillInactive) {
        const categoriesChanged =
          String(categoryIds.headerId || '') !== String(product.headerId || '') ||
          String(categoryIds.categoryId || '') !== String(product.categoryId || '') ||
          String(categoryIds.subcategoryId || '') !== String(product.subcategoryId || '');

        if (!categoriesChanged) {
          return res.status(400).json({
            success: false,
            message:
              'Cannot activate this product while its category is inactive. Assign an active category first.',
          });
        }
      }
    }

    payload.approvalStatus = product.approvalStatus || 'approved';
    payload.approvedAt = product.approvedAt || null;
    payload.isActive = payload.status === 'active';

    Object.assign(product, { ...payload, ...categoryIds });

    if (payload.status === 'active') {
      product.deactivatedByParentId = null;
    }

    await product.save();
    await syncSellerInventoryNotification(product.sellerId, product);
    clearContentCache();

    const populated = await QuickProduct.findById(product._id)
      .populate('headerId categoryId subcategoryId', 'name slug businessType type')
      .lean();
    const sellerMap = await buildProductSellerMap([populated]);
    return res.json({
      success: true,
      result: toProduct(withProductSeller(populated, sellerMap)),
    });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product slug or SKU already exists in this store',
      });
    }
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update product',
    });
  }
};

export const removeProduct = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Products cannot be deleted by admin. Set the product to inactive instead.',
  });
};

export const getAdminOrders = async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query || {};
  const query = { orderType: { $in: ['quick', 'mixed'] } };
  if (status && status !== 'all') {
    switch (status) {
      case 'pending':
        query.$or = [
          { orderStatus: 'pending' },
          { workflowStatus: { $in: ['CREATED', 'SELLER_PENDING'] } },
        ];
        break;
      case 'processed':
        query.$or = [
          { orderStatus: { $in: ['confirmed', 'packed'] } },
          { workflowStatus: { $in: ['SELLER_ACCEPTED', 'DELIVERY_SEARCH', 'DELIVERY_ASSIGNED', 'PICKUP_READY'] } },
        ];
        break;
      case 'cancelled':
        query.orderStatus = { $in: QUICK_CANCELLED_STATUSES };
        break;
      case 'out-for-delivery':
        query.$or = [
          { orderStatus: 'out_for_delivery' },
          { workflowStatus: 'OUT_FOR_DELIVERY' },
        ];
        break;
      case 'delivered':
        query.$or = [
          { orderStatus: 'delivered' },
          { workflowStatus: 'DELIVERED' },
        ];
        break;
      default:
        break;
    }
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  const [orders, total] = await Promise.all([
    QuickOrder.find(query)
      .populate('userId', 'name phone email')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    QuickOrder.countDocuments(query),
  ]);

  const sellerIds = [...new Set(
    orders.flatMap(order => 
      (order.items || [])
        .filter(item => item.type === 'quick')
        .map(item => String(item.sourceId))
    )
  )].filter(id => mongoose.Types.ObjectId.isValid(id));

  const [sellers, sellerOrders] = await Promise.all([
    Seller.find({ _id: { $in: sellerIds } })
      .select('_id shopName name shopInfo.businessType')
      .lean(),
    SellerOrder.find({ orderId: { $in: orders.map((order) => order.orderId).filter(Boolean) } })
      .select('_id orderId status workflowStatus customer address cancellationReason pricing')
      .lean(),
  ]);

  const sellerMap = sellers.reduce((acc, s) => {
    acc[String(s._id)] = s;
    return acc;
  }, {});

  const sellerOrderMap = sellerOrders.reduce((acc, sellerOrder) => {
    const key = String(sellerOrder.orderId || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sellerOrder);
    return acc;
  }, {});

  const returnsByOrderId = await loadReturnsByOrderIds(orders.map((order) => order.orderId).filter(Boolean));

  // Heal legacy return clawbacks (packing wiped / commission zeroed) before reporting.
  try {
    const { healSellerOrderFinanceAfterReturn } = await import(
      '../services/quickReturnFinance.service.js'
    );
    let healedAny = false;
    for (const docs of returnsByOrderId.values()) {
      for (const doc of docs) {
        if (String(doc?.refundStatus || '').toLowerCase() !== 'completed') continue;
        const result = await healSellerOrderFinanceAfterReturn(doc);
        if (result?.healed) healedAny = true;
      }
    }
    if (healedAny) {
      const refreshed = await SellerOrder.find({
        orderId: { $in: orders.map((order) => order.orderId).filter(Boolean) },
      })
        .select('_id orderId status workflowStatus customer address cancellationReason pricing')
        .lean();
      Object.keys(sellerOrderMap).forEach((key) => {
        delete sellerOrderMap[key];
      });
      refreshed.forEach((sellerOrder) => {
        const key = String(sellerOrder.orderId || '');
        if (!key) return;
        if (!sellerOrderMap[key]) sellerOrderMap[key] = [];
        sellerOrderMap[key].push(sellerOrder);
      });
    }
  } catch {
    // non-fatal — reporting still applies display-time floors/inference
  }

  return res.json({
    success: true,
    result: {
      items: orders.map((order) => {
        const returnAttachment = attachReturnSummaryToOrder(
          order,
          returnsByOrderId.get(String(order.orderId || '')) || [],
        );
        return buildQuickAdminOrderResponse(
          order,
          sellerMap,
          sellerOrderMap,
          null,
          returnAttachment.returnSummary,
        );
      }),
      page: currentPage,
      limit: perPage,
      total,
    },
  });
};

export const getAdminOrderById = async (req, res) => {
  const rawOrderId = String(req.params.orderId || '').trim();

  if (!rawOrderId) {
    return res.status(400).json({ success: false, message: 'orderId is required' });
  }

  const query = {
    orderType: { $in: ['quick', 'mixed'] },
    $or: [
      { orderId: rawOrderId },
      ...(mongoose.isValidObjectId(rawOrderId) ? [{ _id: rawOrderId }] : []),
    ],
  };

  const order = await QuickOrder.findOne(query).populate('userId', 'name phone email').lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const quickItems = Array.isArray(order.items) ? order.items.filter((item) => item?.type === 'quick') : [];
  const sellerIds = [...new Set(quickItems.map((item) => String(item?.sourceId || '')).filter(Boolean))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const partnerId =
    order?.dispatch?.deliveryPartnerId?._id ||
    order?.dispatch?.deliveryPartnerId ||
    order?.deliveryPartnerId ||
    null;

  const [sellers, sellerOrders, deliveryPartner] = await Promise.all([
    Seller.find({ _id: { $in: sellerIds } })
      .select('_id shopName name phone phoneNumber location address shopInfo')
      .lean(),
    SellerOrder.find({ orderId: order.orderId })
      .select('_id orderId status workflowStatus customer address cancellationReason pricing')
      .lean(),
    partnerId && mongoose.isValidObjectId(String(partnerId))
      ? FoodDeliveryPartner.findById(partnerId)
          .select('_id name phone vehicleType vehicleNumber profilePhoto')
          .lean()
      : Promise.resolve(null),
  ]);

  const sellerMap = sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});
  const sellerOrderMap = sellerOrders.reduce((acc, sellerOrder) => {
    const key = String(sellerOrder.orderId || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sellerOrder);
    return acc;
  }, {});

  const returnsByOrderId = await loadReturnsByOrderIds([order.orderId].filter(Boolean));
  const returnAttachment = attachReturnSummaryToOrder(
    order,
    returnsByOrderId.get(String(order.orderId || '')) || [],
  );

  return res.json({
    success: true,
    result: buildQuickAdminOrderResponse(
      order,
      sellerMap,
      sellerOrderMap,
      deliveryPartner,
      returnAttachment.returnSummary,
    ),
  });
};

export const getAdminCustomers = async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query || {};
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  const skip = (currentPage - 1) * perPage;
  const normalizedSearch = String(search || '').trim().toLowerCase();

  const filter = { role: { $ne: 'ADMIN' } };
  if (normalizedSearch) {
    filter.$or = [
      { name: { $regex: normalizedSearch, $options: 'i' } },
      { email: { $regex: normalizedSearch, $options: 'i' } },
      { phone: { $regex: normalizedSearch, $options: 'i' } }
    ];
  }

  const [users, total] = await Promise.all([
    FoodUser.find(filter)
      .select('_id name email phone profileImage isActive createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .lean(),
    FoodUser.countDocuments(filter)
  ]);

  const userIds = users.map(u => u._id);
  const orders = await QuickOrder.find({ 
    userId: { $in: userIds },
    orderType: { $in: ['quick', 'mixed'] } 
  }).select('userId pricing createdAt').lean();

  const customerMap = new Map();
  users.forEach(u => {
    const name = u.name || 'Customer';
    customerMap.set(String(u._id), {
      id: String(u._id),
      name: name,
      email: u.email || '',
      phone: u.phone || '',
      avatar: u.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
      status: u.isActive === false ? 'inactive' : 'active',
      totalOrders: 0,
      totalSpent: 0,
      joinedDate: u.createdAt,
      lastOrderDate: null
    });
  });

  orders.forEach(order => {
    const customer = customerMap.get(String(order.userId));
    if (customer) {
      const pricingTotal = Number(order.pricing?.total || 0);
      const payableTotal = Math.max(pricingTotal, Number(order.payment?.amountDue || 0));

      customer.totalOrders += 1;
      customer.totalSpent += payableTotal;
      if (!customer.lastOrderDate || new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
        customer.lastOrderDate = order.createdAt;
      }
    }
  });

  return res.json({
    success: true,
    result: {
      items: Array.from(customerMap.values()),
      page: currentPage,
      limit: perPage,
      total
    }
  });
};

export const getAdminCustomerById = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid customer ID' });
  }

  const user = await FoodUser.findById(id).lean();
  if (!user) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  const orders = await QuickOrder.find({
    userId: user._id,
    orderType: { $in: ['quick', 'mixed'] }
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const totalSpent = orders
    .filter(o => o.orderStatus === 'delivered')
    .reduce((sum, o) => {
        const pricingTotal = Number(o.pricing?.total || 0);
        return sum + Math.max(pricingTotal, Number(o.payment?.amountDue || 0));   }, 0);

  const name = user.name || 'Customer';
  const result = {
    id: String(user._id),
    name: name,
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    status: user.isActive === false ? 'inactive' : 'active',
    joinedDate: user.createdAt,
    totalOrders: orders.length,
    totalSpent,
    lastOrderDate: orders[0]?.createdAt || null,
    addresses: (user.addresses || []).map(addr => ({
      id: addr._id,
      label: addr.label,
      fullAddress: `${addr.street}, ${addr.city}, ${addr.state} - ${addr.zipCode}`,
      city: addr.city,
      state: addr.state,
      pincode: addr.zipCode,
      isDefault: addr.isDefault
    })),
    recentOrders: orders.slice(0, 10).map(o => {
      const pricingTotal = Number(o.pricing?.total || 0);
      const payableTotal = Math.max(pricingTotal, Number(o.payment?.amountDue || 0));

      return {
        id: `#${o.orderId || o._id}`,
        date: o.createdAt,
        status: legacyQuickStatusFromOrder(o),
        amount: payableTotal,
        itemsCount: o.items?.length || 0
      };
    })
  };

  return res.json({
    success: true,
    result
  });
};

export const deleteAdminOrder = async (req, res) => {
  const rawOrderId = String(req.params.orderId || '').trim();

  if (!rawOrderId) {
    return res.status(400).json({ success: false, message: 'orderId is required' });
  }

  const orderQuery = {
    orderType: { $in: ['quick', 'mixed'] },
    $or: [
      { orderId: rawOrderId },
      ...(mongoose.isValidObjectId(rawOrderId) ? [{ _id: rawOrderId }] : []),
    ],
  };

  const order = await QuickOrder.findOne(orderQuery).lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const linkedSellerOrders = await SellerOrder.find({ orderId: order.orderId })
    .select('_id sellerId orderId')
    .lean();

  await Promise.all([
    QuickOrder.deleteOne({ _id: order._id }),
    SellerOrder.deleteMany({ orderId: order.orderId }),
  ]);

  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderId: order.orderId,
        orderMongoId: order._id?.toString?.() || '',
        message: 'Order deleted by admin',
      };

      if (order.userId) {
        io.to(rooms.user(order.userId)).emit('order_deleted', payload);
      }
      io.to(rooms.tracking(order.orderId)).emit('order_deleted', payload);

      linkedSellerOrders.forEach((sellerOrder) => {
        if (!sellerOrder?.sellerId) return;
        io.to(rooms.seller(sellerOrder.sellerId)).emit('order_deleted', {
          ...payload,
          sellerOrderId: sellerOrder._id?.toString?.() || '',
        });
      });

      if (order.dispatch?.deliveryPartnerId) {
        io.to(rooms.delivery(order.dispatch.deliveryPartnerId)).emit('order_deleted', payload);
      }
    }
  } catch {
    // best-effort realtime cleanup
  }

  return res.json({
    success: true,
    result: {
      deleted: true,
      orderId: order.orderId,
      sellerOrdersDeleted: linkedSellerOrders.length,
    },
  });
};

export const getAdminSellerRequests = async (req, res) => {
  const { status = 'pending', page = 1, limit = 50, search = '' } = req.query || {};
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));
  const query = {
    $nor: [
      {
        approvalStatus: 'draft',
        onboardingSubmitted: { $ne: true },
        'shopInfo.businessType': { $in: ['', null] },
        $and: [
          {
            $or: [
              { name: { $in: ['', null] } },
              { name: { $regex: /^Seller(\s+\d+)?$/i } },
            ],
          },
          {
            $or: [
              { shopName: { $in: ['', null] } },
              { shopName: { $regex: /^Store(\s+\d+)?$/i } },
            ],
          },
        ],
      },
    ],
  };

  if (status === 'pending') query.approvalStatus = 'pending';
  else if (status === 'approved') query.approvalStatus = 'approved';
  else if (status === 'rejected') query.approvalStatus = 'rejected';
  else if (status === 'draft') query.approvalStatus = 'draft';
  else if (status === 'review_queue') {
    query.$or = [
      { approvalStatus: { $in: ['pending', 'rejected'] } },
      { 'pendingProfileChanges.hasPendingUpdate': true },
    ];
  }

  const searchText = String(search || '').trim();
  if (searchText) {
    query.$or = [
      { name: { $regex: searchText, $options: 'i' } },
      { shopName: { $regex: searchText, $options: 'i' } },
      { email: { $regex: searchText, $options: 'i' } },
      { phone: { $regex: searchText, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Seller.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .lean(),
    Seller.countDocuments(query),
  ]);

  const productCountBySeller = {};
  if (items.length > 0) {
    const counts = await QuickProduct.aggregate([
      {
        $match: {
          sellerId: { $in: items.map((seller) => seller._id) },
        },
      },
      {
        $group: {
          _id: '$sellerId',
          count: { $sum: 1 },
        },
      },
    ]);
    counts.forEach((row) => {
      productCountBySeller[String(row._id)] = Number(row.count) || 0;
    });
  }

  return res.json({
    success: true,
    result: {
      items: items.map((seller) =>
        toSellerRequest(seller, {
          productCount: productCountBySeller[String(seller._id)] || 0,
        }),
      ),
      page: currentPage,
      limit: perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  });
};

export const approveAdminSellerRequest = async (req, res) => {
  const { sellerId } = req.params;
  const seller = await Seller.findById(sellerId);

  if (!seller) {
    return res.status(404).json({ success: false, message: 'Seller request not found' });
  }

  const isProfileReapproval =
    seller.approvalStatus === 'approved' &&
    seller.pendingProfileChanges?.hasPendingUpdate === true;

  if (isProfileReapproval) {
    const applyUpdate = buildApplySellerPendingProfileChanges(seller.pendingProfileChanges);
    const updated = await Seller.findByIdAndUpdate(sellerId, applyUpdate, {
      new: true,
      runValidators: false,
    });

    await upsertSellerNotification(updated._id, {
      key: `profile-update:${String(updated._id)}:approved`,
      type: 'system',
      title: 'Profile update approved',
      message: 'Your requested profile changes are now live.',
      link: '/seller/profile',
    });

    return res.json({
      success: true,
      message: 'Seller profile update approved',
      result: toSellerRequest(updated),
    });
  }

  seller.approved = true;
  seller.approvalStatus = 'approved';
  seller.onboardingSubmitted = true;
  seller.wasEverApproved = true;
  seller.approvedAt = new Date();
  seller.rejectedAt = null;
  seller.approvalNotes = String(req.body?.approvalNotes || '').trim();
  await seller.save();

  await upsertSellerNotification(seller._id, {
    key: `onboarding:${String(seller._id)}:decision`,
    type: 'system',
    title: 'Your store is approved',
    message: seller.approvalNotes
      ? `Your seller account is approved and live. Note from our team: ${seller.approvalNotes}`
      : 'Your seller account is approved. You can start adding products and taking orders.',
    link: '/seller',
  });

  return res.json({
    success: true,
    message: 'Seller approved successfully',
    result: toSellerRequest(seller),
  });
};

export const rejectAdminSellerRequest = async (req, res) => {
  const { sellerId } = req.params;
  const seller = await Seller.findById(sellerId);

  if (!seller) {
    return res.status(404).json({ success: false, message: 'Seller request not found' });
  }

  const reason = String(req.body?.approvalNotes || req.body?.reason || '').trim();
  const isProfileReapproval =
    seller.approvalStatus === 'approved' &&
    seller.pendingProfileChanges?.hasPendingUpdate === true;

  if (isProfileReapproval) {
    const discardUpdate = buildDiscardSellerPendingProfileChanges();
    const updated = await Seller.findByIdAndUpdate(
      sellerId,
      { $unset: discardUpdate.$unset },
      { new: true, runValidators: false },
    );

    await upsertSellerNotification(updated._id, {
      key: `profile-update:${String(updated._id)}:rejected`,
      type: 'system',
      title: 'Profile update rejected',
      message: reason
        ? `Your requested profile changes were rejected. Reason: ${reason}`
        : 'Your requested profile changes were rejected. Your current approved details remain active.',
      link: '/seller/profile',
    });

    return res.json({
      success: true,
      message: 'Seller profile update rejected',
      result: toSellerRequest(updated),
    });
  }

  seller.approved = false;
  seller.approvalStatus = 'rejected';
  seller.onboardingSubmitted = true;
  seller.approvedAt = null;
  seller.rejectedAt = new Date();
  seller.approvalNotes = reason;
  await seller.save();

  await upsertSellerNotification(seller._id, {
    key: `onboarding:${String(seller._id)}:decision`,
    type: 'system',
    title: 'Your application needs changes',
    message: seller.approvalNotes
      ? `Your seller application was rejected. Reason: ${seller.approvalNotes}`
      : 'Your seller application was rejected. Please review your details and submit again.',
    link: '/seller/onboarding',
  });

  return res.json({
    success: true,
    message: 'Seller request rejected',
    result: toSellerRequest(seller),
  });
};

export const getAdminZones = async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query || {};
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 1000));
  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: String(search).trim(), $options: 'i' } },
      { zoneName: { $regex: String(search).trim(), $options: 'i' } },
      { serviceLocation: { $regex: String(search).trim(), $options: 'i' } },
    ];
  }

  const [zones, total] = await Promise.all([
    QuickZone.find(filter).sort({ createdAt: -1 }).skip((currentPage - 1) * perPage).limit(perPage).lean(),
    QuickZone.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: { zones, total, page: currentPage, limit: perPage },
  });
};

export const listPublicZones = async (_req, res) => {
  const zones = await QuickZone.find({ isActive: true })
    .select('name zoneName serviceLocation country unit isActive coordinates createdAt')
    .sort({ createdAt: 1 })
    .lean();

  return res.json({
    success: true,
    message: 'Zones fetched successfully',
    data: { zones },
  });
};

export const detectQuickZonePublic = async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, message: 'lat and lng are required' });
  }

  const data = await detectQuickZoneForPoint(lat, lng);

  return res.json({
    success: true,
    message: data.status === 'IN_SERVICE' ? 'Zone detected' : 'Out of service',
    data,
  });
};

export const getAdminZoneById = async (req, res) => {
  const zone = await QuickZone.findById(req.params.zoneId).lean();
  if (!zone) {
    return res.status(404).json({ success: false, message: 'Zone not found' });
  }

  return res.json({ success: true, data: { zone } });
};

export const createAdminZone = async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : (body.zoneName && String(body.zoneName).trim()) || '';
  const coordinates = Array.isArray(body.coordinates) ? body.coordinates : [];

  if (!name) {
    return res.status(400).json({ success: false, message: 'Zone name is required' });
  }

  if (coordinates.length < 3) {
    return res.status(400).json({ success: false, message: 'Zone must have at least 3 coordinates' });
  }

  const normalizedCoordinates = coordinates.map((coord) => ({
    latitude: Number(coord?.latitude ?? coord?.lat),
    longitude: Number(coord?.longitude ?? coord?.lng),
  }));
  const country = body.country ? String(body.country).trim() : 'India';

  const overlapResult = await assertNoZoneOverlap(QuickZone, normalizedCoordinates, {
    extraFilter: { country },
  });
  if (overlapResult) {
    return res.status(409).json({ success: false, message: ZONE_OVERLAP_MESSAGE });
  }

  const zone = await QuickZone.create({
    name,
    zoneName: body.zoneName && String(body.zoneName).trim() ? String(body.zoneName).trim() : name,
    country,
    serviceLocation: body.serviceLocation ? String(body.serviceLocation).trim() : name,
    unit: body.unit === 'miles' ? 'miles' : 'kilometer',
    isActive: body.isActive !== false,
    coordinates: normalizedCoordinates,
  });

  return res.status(201).json({ success: true, data: { zone } });
};

export const updateAdminZone = async (req, res) => {
  const zone = await QuickZone.findById(req.params.zoneId);
  if (!zone) {
    return res.status(404).json({ success: false, message: 'Zone not found' });
  }

  const body = req.body || {};
  if (body.name !== undefined) zone.name = String(body.name || '').trim();
  if (body.zoneName !== undefined) zone.zoneName = String(body.zoneName || '').trim();
  if (body.country !== undefined) zone.country = String(body.country || '').trim() || 'India';
  if (body.serviceLocation !== undefined) zone.serviceLocation = String(body.serviceLocation || '').trim();
  if (body.unit !== undefined) zone.unit = body.unit === 'miles' ? 'miles' : 'kilometer';
  if (body.isActive !== undefined) zone.isActive = body.isActive !== false;
  if (Array.isArray(body.coordinates) && body.coordinates.length >= 3) {
    const normalizedCoordinates = body.coordinates.map((coord) => ({
      latitude: Number(coord?.latitude ?? coord?.lat),
      longitude: Number(coord?.longitude ?? coord?.lng),
    }));
    const overlapResult = await assertNoZoneOverlap(QuickZone, normalizedCoordinates, {
      excludeId: zone._id,
      extraFilter: { country: zone.country },
    });
    if (overlapResult) {
      return res.status(409).json({ success: false, message: ZONE_OVERLAP_MESSAGE });
    }
    zone.coordinates = normalizedCoordinates;
  }
  if (!zone.zoneName) zone.zoneName = zone.name;
  if (!zone.serviceLocation) zone.serviceLocation = zone.name;

  await zone.save();
  return res.json({ success: true, data: { zone: zone.toObject() } });
};

export const deleteAdminZone = async (req, res) => {
  const deleted = await QuickZone.findByIdAndDelete(req.params.zoneId);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Zone not found' });
  }

  return res.json({ success: true, data: { id: req.params.zoneId } });
};

export const getAdminExperienceSections = async (req, res) => {
  const { pageType = 'home', headerId = null, status = 'all' } = req.query || {};
  const sections = await getQuickExperienceSections({ pageType, headerId, status });
  return res.json({ success: true, results: sections });
};

export const createAdminExperienceSection = async (req, res) => {
  try {
    const section = await createQuickExperienceSection(req.body);
    clearContentCache();
    return res.status(201).json({ success: true, result: section });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to create section',
    });
  }
};

export const updateAdminExperienceSection = async (req, res) => {
  try {
    const section = await updateQuickExperienceSection(req.params.id, req.body);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    clearContentCache();
    return res.json({ success: true, result: section });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to update section',
    });
  }
};

export const deleteAdminExperienceSection = async (req, res) => {
  await deleteQuickExperienceSection(req.params.id);
  clearContentCache();
  return res.json({ success: true, result: { deleted: true } });
};

export const reorderAdminExperienceSections = async (req, res) => {
  await reorderQuickExperienceSections(req.body);
  clearContentCache();
  return res.json({ success: true, result: { reordered: true } });
};

export const getAdminHeroConfig = async (req, res) => {
  const { pageType = 'home', headerId = null, fetchAll = false } = req.query || {};
  if (fetchAll === 'true' || fetchAll === true) {
    const allConfigs = await getAllQuickHeroConfigs();
    return res.json({ success: true, results: allConfigs });
  }
  const config = await getQuickHeroConfig({ pageType, headerId });
  return res.json({ success: true, result: config || { banners: { items: [] }, categoryIds: [] } });
};

export const setAdminHeroConfig = async (req, res) => {
  const config = await setQuickHeroConfig(req.body);
  return res.json({ success: true, result: config });
};

export const getAdminOfferSections = async (req, res) => {
  const sections = await getQuickOfferSections({ ...req.query, status: req.query?.status || 'all' });
  return res.json({ success: true, results: sections });
};

export const createAdminOfferSection = async (req, res) => {
  const section = await createQuickOfferSection(req.body);
  return res.status(201).json({ success: true, result: section });
};

export const updateAdminOfferSection = async (req, res) => {
  const section = await updateQuickOfferSection(req.params.id, req.body);
  if (!section) {
    return res.status(404).json({ success: false, message: 'Section not found' });
  }
  return res.json({ success: true, result: section });
};

export const deleteAdminOfferSection = async (req, res) => {
  await deleteQuickOfferSection(req.params.id);
  return res.json({ success: true, result: { deleted: true } });
};

export const reorderAdminOfferSections = async (req, res) => {
  await reorderQuickOfferSections(req.body);
  return res.json({ success: true, result: { reordered: true } });
};

export const getAdminHomeTiles = async (req, res) => {
  const tiles = await getQuickHomeTiles({
    ...req.query,
    status: req.query?.status || 'all',
  });
  const headings = await getQuickHomeHeadings();
  return res.json({ success: true, results: tiles, headings });
};

export const createAdminHomeTile = async (req, res) => {
  try {
    let imageUrl = String(req.body?.imageUrl || '').trim();
    if (req.file?.buffer) {
      imageUrl = await uploadImageBuffer(req.file.buffer, 'quick-commerce/home-tiles');
    }
    const tile = await createQuickHomeTile({
      ...req.body,
      imageUrl,
    });
    return res.status(201).json({ success: true, result: tile });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Failed to create tile' });
  }
};

export const updateAdminHomeTile = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.file?.buffer) {
      payload.imageUrl = await uploadImageBuffer(req.file.buffer, 'quick-commerce/home-tiles');
    }
    const tile = await updateQuickHomeTile(req.params.id, payload);
    if (!tile) {
      return res.status(404).json({ success: false, message: 'Tile not found' });
    }
    return res.json({ success: true, result: tile });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message || 'Failed to update tile' });
  }
};

export const deleteAdminHomeTile = async (req, res) => {
  const deleted = await deleteQuickHomeTile(req.params.id);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Tile not found' });
  }
  return res.json({ success: true, result: { deleted: true } });
};

export const reorderAdminHomeTiles = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  await reorderQuickHomeTiles(items || []);
  return res.json({ success: true, result: { reordered: true } });
};

export const updateAdminHomeHeadings = async (req, res) => {
  const headings = await updateQuickHomeHeadings(req.body || {});
  return res.json({
    success: true,
    result: {
      fastFavHeading: headings?.fastFavHeading || 'Fast Fav',
      moreHeading: headings?.moreHeading || 'More',
    },
  });
};

export const getAdminFinanceSummary = async (_req, res) => {
  const result = await getQuickCommerceFinanceSummary();
  return res.json({ success: true, result });
};

export const getAdminFinanceLedger = async (req, res) => {
  const { page, limit } = buildPaginationOptions(req.query, {
    defaultLimit: PAGINATION_DEFAULTS.defaultLimit,
    maxLimit: 100,
  });
  const result = await getQuickCommerceFinanceLedger({ page, limit });
  return res.json({ success: true, result });
};

export const getAdminFinancePayouts = async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1) || 1);
  const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 100) || 100));
  const status = req.query?.status || "PENDING";
  const seller = String(req.query?.seller || "").toLowerCase() === "true";
  const result = await getQuickCommerceFinancePayouts({ seller, status, page, limit });
  return res.json({ success: true, result });
};

export const getAdminSellerWithdrawals = async (req, res) => {
  try {
    const result = await getQuickCommerceSellerWithdrawals({
      page: req.query?.page,
      limit: req.query?.limit,
      status: req.query?.status,
      search: req.query?.search,
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load seller withdrawals",
    });
  }
};

export const getAdminSellerTransactions = async (req, res) => {
  try {
    const result = await getQuickCommerceSellerTransactions({
      page: req.query?.page,
      limit: req.query?.limit,
      status: req.query?.status,
      type: req.query?.type,
      search: req.query?.search,
      sellerId: req.query?.sellerId,
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load seller transactions",
    });
  }
};



export const updateAdminWithdrawalStatus = async (req, res) => {
  try {
    const result = await updateQuickCommerceWithdrawalStatus(
      req.params.withdrawalId,
      req.body,
    );
    return res.json({ success: true, result });
  } catch (error) {
    const message = error.message || "Failed to update withdrawal";
    const statusCode = message.includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ success: false, message });
  }
};



// ─── Seller Coupon Requests (QC marketing tools) ─────────────────────────────

export const getAdminSellerCouponRequests = async (req, res) => {
  try {
    const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
    const sellerCoupons = await SellerCoupon.find({}).sort({ createdAt: -1 }).lean();
    const data = sellerCoupons.map((c) => ({ ...c, type: 'seller' }));
    return res.json({ success: true, data, results: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch seller coupon requests' });
  }
};

export const updateAdminSellerCouponRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = req.body?.status;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon request ID' });
    }
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected' });
    }

    const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
    const updated = await SellerCoupon.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Seller coupon request not found' });
    }

    clearContentCache();
    try {
      const { invalidateCache } = await import('../../../middleware/cache.js');
      await invalidateCache('quick_coupons*');
      await invalidateCache('quick_offers*');
    } catch (err) {
      console.error('Failed to invalidate cache on seller coupon status update:', err);
    }

    return res.json({
      success: true,
      message: `Seller coupon status updated to ${status} successfully`,
      data: { ...updated, type: 'seller' },
      result: { ...updated, type: 'seller' },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to update seller coupon status' });
  }
};

// ─── Coupon Management ───────────────────────────────────────────────────────

export const getAdminCoupons = async (req, res) => {
  try {
    const { status, search } = req.query || {};
    const coupons = await getAdminQuickCoupons({ status, search });
    return res.json({ success: true, results: coupons, result: coupons });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
};

export const createCoupon = async (req, res) => {
  try {
    const coupon = await createAdminQuickCoupon(req.body || {});
    return res.status(201).json({ success: true, result: coupon });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
};

export const updateCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await updateAdminQuickCoupon(couponId, req.body || {});
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.json({ success: true, result: coupon });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to update coupon' });
  }
};

export const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;
    await deleteAdminQuickCoupon(couponId);
    return res.json({ success: true, result: { deleted: true } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete coupon' });
  }
};

export const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;
    const coupon = await toggleAdminQuickCouponStatus(couponId);
    return res.json({ success: true, result: coupon });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to toggle coupon status' });
  }
};



export const getExpiredSellerLicenses = async (req, res, next) => {
  try {
    const { listExpiredSellerLicenses } = await import(
      '../seller/services/sellerLicenseExpiry.service.js'
    );
    const results = await listExpiredSellerLicenses();
    return res.json({ success: true, result: results, results });
  } catch (error) {
    next(error);
  }
};

