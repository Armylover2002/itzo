import mongoose from 'mongoose';
import { FoodUser } from '../../../core/users/user.model.js';
import { FoodRefreshToken } from '../../../core/refreshTokens/refreshToken.model.js';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickOrder } from '../models/order.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { SellerNotification } from '../seller/models/sellerNotification.model.js';
import { SellerOrder } from '../seller/models/sellerOrder.model.js';
import { updateSellerProfileData } from '../seller/controllers/seller.controller.js';
import { QuickZone } from '../models/quick_zone.model.js';
import { capPolygonPoints } from '../../../utils/geo.js';
import { QuickCoupon } from '../models/coupon.model.js';
import { processRefund as processFoodRefund } from '../../food/admin/services/admin.service.js';
import { getIO, rooms } from '../../../config/socket.js';
import { uploadImageBuffer } from '../../../services/upload.service.js';
import {
  buildApplySellerPendingProfileChanges,
  buildDiscardSellerPendingProfileChanges,
} from '../shared/pendingProfileChanges.js';
import { upsertSellerNotification } from '../seller/services/sellerNotify.service.js';
import {
  getQuickCommerceDeliveryWithdrawals,
  getQuickCommerceFinanceLedger,
  getQuickCommerceFinancePayouts,
  getQuickCommerceFinanceSummary,
  getQuickCommerceSellerWithdrawals,
  updateQuickCommerceWithdrawalStatus,
} from "../services/finance.service.js";
import {
  getAdminBanners as getBannersService,
  getAdminBannerById as getBannerByIdService,
  createAdminBanner as createBannerService,
  updateAdminBanner as updateBannerService,
  deleteAdminBanner as deleteBannerService,
  toggleAdminBannerStatus as toggleBannerStatusService,
} from '../services/banner.service.js';

const toCategory = (category) => ({
  id: category._id,
  _id: category._id,
  name: category.name,
  slug: category.slug,
  image: category.image,
  accentColor: category.accentColor,
  description: category.description || '',
  type: category.type || 'header',
  status: category.status || (category.isActive ? 'active' : 'inactive'),
  parentId: category.parentId || null,
  iconId: category.iconId || '',
  headerColor: category.headerColor || category.accentColor,
  sortOrder: category.sortOrder,
  isActive: category.isActive,
  approvalStatus: category.approvalStatus || 'approved',
  approvedAt: category.approvedAt || null,
});

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
  description: product.description || '',
  stock: Number(product.stock || 0),
  status: product.status || (product.isActive ? 'active' : 'inactive'),
  brand: product.brand || '',
  sku: product.sku || '',
  variants: Array.isArray(product.variants) ? product.variants : [],
  isFeatured: Boolean(product.isFeatured),
  badge: product.badge,
  isActive: product.isActive,
  approvalStatus: product.approvalStatus || 'approved',
  approvedAt: product.approvedAt || null,
  sellerId: product.sellerId || null,
  seller: product.seller || null,
  storeName: product.storeName || '',
  restaurantName: product.restaurantName || '',
});

const toSellerRequest = (seller, extras = {}) => {
  const isReapplied =
    seller.isReapplied === true ||
    Boolean(seller.reappliedAt) ||
    (seller.approvalStatus === 'pending' && Boolean(seller.previousRejectionNotes)) ||
    (seller.approvalStatus === 'pending' && Boolean(seller.rejectedAt));

  return {
    id: seller._id,
    _id: seller._id,
    shopName: seller.shopName || seller.name || 'Store',
    ownerName: seller.name || 'Seller',
    email: seller.email || '',
    phone: seller.phoneLast10 || seller.phone || '',
    location: seller.location?.formattedAddress || seller.location?.address || '',
    category: seller.shopInfo?.businessType || 'General',
    applicationDate: seller.reappliedAt || seller.createdAt,
    approvedAt: seller.approvedAt || null,
    rejectedAt: seller.rejectedAt || null,
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
    // Drives the on/off switch in the admin list: an inactive seller keeps its
    // catalogue but is hidden from the storefront.
    isActive: seller.isActive !== false,
    onboardingSubmitted: seller.onboardingSubmitted === true,
    bankInfo: seller.bankInfo || {},
    documents: seller.documents || {},
    shopInfo: seller.shopInfo || {},
    approvalNotes: seller.approvalNotes || '',
    previousRejectionNotes: seller.previousRejectionNotes || seller.approvalNotes || '',
    isReapplied,
    reappliedAt: seller.reappliedAt || null,
    reapplicationCount: seller.reapplicationCount || 0,
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
  };
};

const buildProductSellerMap = async (products = []) => {
  const sellerIds = [...new Set(
    products
      .map((product) => String(product?.sellerId || '').trim())
      .filter(Boolean),
  )];

  if (!sellerIds.length) return {};

  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id shopName name')
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
      }
    : null;

  return {
    ...product,
    sellerId: product?.sellerId || sellerInfo?._id || null,
    seller: sellerInfo,
    storeName: sellerInfo?.shopName || sellerInfo?.name || '',
    restaurantName: sellerInfo?.shopName || sellerInfo?.name || '',
  };
};

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

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

const buildQuickAdminOrderResponse = (order, sellerMap = {}, sellerOrderMap = {}) => {
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
    pricingTotal + platformFee,
  );

  const quickItems = Array.isArray(order?.items) ? order.items.filter((item) => item?.type === 'quick') : [];
  const firstSellerId = String(quickItems[0]?.sourceId || '');
  const seller = sellerMap[firstSellerId] || null;
  const sellerOrder = sellerOrderMap[String(order?.orderId || '')] || null;
  const itemCount = Array.isArray(order?.items)
    ? order.items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
    : 0;

  return {
    id: order._id,
    _id: order._id,
    orderId: order.orderId,
    orderNumber: order.orderId,
    orderType: order.orderType || 'quick',
    total: payableTotal,
    amount: payableTotal,
    status: legacyQuickStatusFromOrder(order),
    orderStatus: order.orderStatus || '',
    workflowStatus: order.workflowStatus || '',
    workflowVersion: order.workflowVersion || 1,
    returnStatus: order.returnStatus || '',
    itemCount,
    items: Array.isArray(order.items) ? order.items : [],
    pricing: order.pricing || {},
    payment: order.payment || {},
    sessionId: order.sessionId || '',
    createdAt: order.createdAt || null,
    updatedAt: order.updatedAt || null,
    customer: {
      name:
        sellerOrder?.customer?.name ||
        order.customer?.name ||
        order.shippingAddress?.name ||
        order.deliveryAddress?.name ||
        'Unknown',
      phone:
        sellerOrder?.customer?.phone ||
        order.customer?.phone ||
        order.deliveryAddress?.phone ||
        '',
      email: order.customer?.email || '',
    },
    seller: seller
      ? {
          _id: seller._id,
          shopName: seller.shopName || seller.name || 'Store',
          name: seller.name || seller.shopName || 'Store',
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
        }
      : null,
  };
};

const getCategoryImage = async (req) => {
  if (req.file?.buffer) {
    return uploadImageBuffer(req.file.buffer, 'quick-commerce/categories');
  }
  return String(req.body?.image || '').trim();
};

const getBannerImage = async (req) => {
  if (req.file?.buffer) {
    return uploadImageBuffer(req.file.buffer, 'quick-commerce/banners');
  }
  return String(req.body?.image || '').trim();
};

const getProductImages = async (req) => {
  const mainFile = req.files?.mainImage?.[0];
  const galleryFiles = Array.isArray(req.files?.galleryImages) ? req.files.galleryImages : [];

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

export const getAdminStats = async (_req, res) => {
  const [categories, products, orders, sellers, users, revenueAgg] = await Promise.all([
    QuickCategory.countDocuments({ isActive: true }),
    QuickProduct.countDocuments({ isActive: true }),
    QuickOrder.countDocuments({ orderType: { $in: ['quick', 'mixed'] } }),
    Seller.countDocuments({ approvalStatus: 'approved' }),
    FoodUser.countDocuments({ role: 'USER' }),
    QuickOrder.aggregate([
      { $match: { orderType: { $in: ['quick', 'mixed'] } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]),
  ]);

  return res.json({
    success: true,
    result: {
      categories,
      products,
      orders,
      sellers,
      users,
      revenue: Number(revenueAgg?.[0]?.total || 0),
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

/**
 * Category hierarchy contract (single source of truth for both create and update):
 *   header      -> top level, no parent, identified by an icon (no image needed)
 *   category    -> "Main" level, must sit under a header, must have an image
 *   subcategory -> must sit under a Main category, must have an image
 */
const CATEGORY_LEVELS = {
  header: { label: 'Header category', parentType: null },
  category: { label: 'Main category', parentType: 'header' },
  subcategory: { label: 'Subcategory', parentType: 'category' },
};

/**
 * Validates the parent link and the mandatory icon/image for a category level.
 * Returns an error message string when invalid, or null when the payload is fine.
 */
const validateCategoryHierarchy = async ({ type, parentId, iconId, image }) => {
  const level = CATEGORY_LEVELS[type];
  if (!level) {
    return `Invalid category type "${type}". Expected header, category or subcategory.`;
  }

  if (!level.parentType) {
    // Header: never nested, and the icon is what represents it in the UI.
    if (parentId) return 'A header category cannot be placed under another category.';
    if (!String(iconId || '').trim()) return 'Icon is required for a header category.';
    return null;
  }

  // Main / Sub: parent is mandatory and must be exactly one level above.
  if (!mongoose.isValidObjectId(parentId)) {
    return `Please select a ${CATEGORY_LEVELS[level.parentType].label.toLowerCase()} for this ${level.label.toLowerCase()}.`;
  }

  const parent = await QuickCategory.findById(parentId).select('type name').lean();
  if (!parent) return 'Selected parent category no longer exists.';
  if ((parent.type || 'header') !== level.parentType) {
    return `A ${level.label.toLowerCase()} must be created under a ${CATEGORY_LEVELS[level.parentType].label.toLowerCase()}.`;
  }

  if (!String(image || '').trim()) return `Image is required for a ${level.label.toLowerCase()}.`;
  return null;
};

/**
 * Collects a category and every descendant beneath it (breadth-first on parentId),
 * so deletes and impact previews always operate on the whole branch.
 */
const collectCategoryBranchIds = async (rootId) => {
  const ids = [String(rootId)];
  let frontier = [rootId];

  while (frontier.length) {
    const children = await QuickCategory.find({ parentId: { $in: frontier } })
      .select('_id')
      .lean();
    if (!children.length) break;
    frontier = children.map((child) => child._id);
    ids.push(...frontier.map(String));
  }

  return ids;
};

const branchProductFilter = (categoryIds) => ({
  $or: [
    { categoryId: { $in: categoryIds } },
    { subcategoryId: { $in: categoryIds } },
    { headerId: { $in: categoryIds } },
  ],
});

/**
 * Walks up the parent chain and returns the first ancestor that is switched off.
 * A category can only go live when every ancestor above it is live, so this is
 * what blocks "activate a child while its header is still inactive".
 */
const findInactiveAncestor = async (parentId) => {
  let currentId = parentId;
  const seen = new Set();

  while (currentId && !seen.has(String(currentId))) {
    seen.add(String(currentId));
    const parent = await QuickCategory.findById(currentId)
      .select('_id name type status isActive parentId')
      .lean();
    if (!parent) return null; // orphaned link — nothing above to block on
    if (parent.status === 'inactive' || parent.isActive === false) return parent;
    currentId = parent.parentId;
  }

  return null;
};

/**
 * Switches a whole branch (the category, everything nested under it, and every
 * product attached to any of them) on or off in one go.
 *
 * Products are only ever flipped between active/inactive — never deleted — so a
 * seller's catalogue survives and comes back when the branch is restored.
 */
const setBranchActiveState = async (rootId, makeActive) => {
  const branchIds = await collectCategoryBranchIds(rootId);
  const status = makeActive ? 'active' : 'inactive';

  const [categories, products] = await Promise.all([
    QuickCategory.updateMany(
      { _id: { $in: branchIds } },
      { $set: { status, isActive: makeActive } },
    ),
    QuickProduct.updateMany(
      branchProductFilter(branchIds),
      { $set: { status, isActive: makeActive } },
    ),
  ]);

  return {
    categoryCount: categories.modifiedCount || 0,
    productCount: products.modifiedCount || 0,
  };
};

export const createCategory = async (req, res) => {
  const {
    name,
    accentColor,
    sortOrder,
    description,
    type,
    status,
    approvalStatus,
    parentId,
    iconId,
    headerColor,
  } = req.body || {};
  const image = await getCategoryImage(req);

  if (!name) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }

  const resolvedType = type || 'header';
  const resolvedParentId = mongoose.isValidObjectId(parentId) ? parentId : null;
  const hierarchyError = await validateCategoryHierarchy({
    type: resolvedType,
    parentId: resolvedParentId,
    iconId,
    image,
  });
  if (hierarchyError) {
    return res.status(400).json({ success: false, message: hierarchyError });
  }

  const baseSlug = slugify(name);
  const count = await QuickCategory.countDocuments({ slug: { $regex: `^${baseSlug}` } });
  const slug = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug;

  const category = await QuickCategory.create({
    name,
    slug,
    image,
    description: description || '',
    type: resolvedType,
    status: status || 'active',
    approvalStatus:
      resolvedType === 'subcategory'
        ? (approvalStatus || 'pending')
        : (approvalStatus || 'approved'),
    approvedAt:
      (resolvedType === 'subcategory' ? approvalStatus || 'pending' : approvalStatus || 'approved') === 'approved'
        ? new Date()
        : null,
    parentId: resolvedParentId,
    iconId: iconId || '',
    headerColor: headerColor || accentColor || '#0c831f',
    accentColor: accentColor || '#0c831f',
    sortOrder: Number(sortOrder || 0),
    isActive: (status || 'active') === 'active',
  });

  return res.status(201).json({ success: true, result: toCategory(category) });
}

export const updateCategory = async (req, res) => {
  const category = await QuickCategory.findById(req.params.categoryId);
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const image = await getCategoryImage(req);
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
    headerColor,
  } = req.body || {};

  // Re-validate the hierarchy against the merged (existing + incoming) values so an
  // edit can never leave a category orphaned, mis-nested, or without its icon/image.
  const nextType = type !== undefined ? (type || 'header') : (category.type || 'header');
  const nextParentId =
    parentId !== undefined
      ? (mongoose.isValidObjectId(parentId) ? String(parentId) : null)
      : (category.parentId ? String(category.parentId) : null);

  if (nextParentId && nextParentId === String(category._id)) {
    return res.status(400).json({ success: false, message: 'A category cannot be its own parent.' });
  }
  if (nextParentId) {
    const branchIds = await collectCategoryBranchIds(category._id);
    if (branchIds.includes(nextParentId)) {
      return res.status(400).json({
        success: false,
        message: 'A category cannot be moved under one of its own subcategories.',
      });
    }
  }

  const hierarchyError = await validateCategoryHierarchy({
    type: nextType,
    parentId: nextParentId,
    iconId: iconId !== undefined ? iconId : category.iconId,
    image: image || category.image,
  });
  if (hierarchyError) {
    return res.status(400).json({ success: false, message: hierarchyError });
  }

  // --- Activation rules -----------------------------------------------------
  // A category may only go live when its whole parent chain is live. Turning one
  // off, or moving it under a live parent, cascades down the branch afterwards.
  const wasActive = category.status !== 'inactive' && category.isActive !== false;
  const nextStatus = status !== undefined ? status : (wasActive ? 'active' : 'inactive');
  const willBeActive = nextStatus === 'active';
  const parentChanged = String(category.parentId || '') !== String(nextParentId || '');

  // Resolved once and reused: it both blocks an explicit activation and decides
  // whether a move is allowed to bring the branch back online.
  const blockingAncestor = await findInactiveAncestor(nextParentId);

  if (willBeActive && blockingAncestor) {
    return res.status(400).json({
      success: false,
      message: `"${blockingAncestor.name}" is inactive, so this category cannot go live. Activate "${blockingAncestor.name}" first, or move this one under an active category.`,
    });
  }

  if (name !== undefined) category.name = name;
  if (slug !== undefined) category.slug = slugify(slug || name || category.name);
  if (image) category.image = image;
  if (description !== undefined) category.description = description;
  if (type !== undefined) category.type = type || 'header';
  if (status !== undefined) {
    category.status = status;
    category.isActive = status === 'active';
  }
  if (approvalStatus !== undefined) {
    category.approvalStatus = approvalStatus || 'pending';
    category.approvedAt = category.approvalStatus === 'approved' ? new Date() : null;
  }
  if (accentColor !== undefined) category.accentColor = accentColor || '#0c831f';
  if (headerColor !== undefined) category.headerColor = headerColor || category.accentColor;
  if (sortOrder !== undefined) category.sortOrder = parseNumber(sortOrder, 0);
  if (parentId !== undefined) category.parentId = mongoose.isValidObjectId(parentId) ? parentId : null;
  if (iconId !== undefined) category.iconId = iconId || '';

  // Re-linking a switched-off category under a live parent brings it back by
  // itself — that is how an unlinked branch is recovered after its parent was
  // deleted. An explicit status in the request always wins over this.
  const reactivatedByMove =
    parentChanged && !wasActive && status === undefined && !!nextParentId && !blockingAncestor;
  if (reactivatedByMove) {
    category.status = 'active';
    category.isActive = true;
  }

  await category.save();

  // Cascade the resulting state down the branch: switching a parent off takes its
  // children and their products with it, and switching it back on restores them.
  const isNowActive = category.status !== 'inactive' && category.isActive !== false;
  let cascade = null;
  if (isNowActive !== wasActive) {
    cascade = await setBranchActiveState(category._id, isNowActive);
  }

  return res.json({
    success: true,
    result: toCategory(category),
    cascade: cascade
      ? {
          activated: isNowActive,
          categoryCount: cascade.categoryCount,
          productCount: cascade.productCount,
        }
      : null,
  });
};

/**
 * Preview what a delete would remove, so the admin UI can show an accurate
 * confirmation before anything is destroyed.
 */
export const getCategoryDeleteImpact = async (req, res) => {
  const { categoryId } = req.params;
  if (!mongoose.isValidObjectId(categoryId)) {
    return res.status(400).json({ success: false, message: 'Invalid category id' });
  }

  const category = await QuickCategory.findById(categoryId).select('name type').lean();
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const branchIds = await collectCategoryBranchIds(categoryId);
  const descendantIds = branchIds.slice(1);

  const [descendants, productCount] = await Promise.all([
    descendantIds.length
      ? QuickCategory.find({ _id: { $in: descendantIds } }).select('name type').lean()
      : [],
    QuickProduct.countDocuments(branchProductFilter(branchIds)),
  ]);

  return res.json({
    success: true,
    result: {
      category: { id: category._id, name: category.name, type: category.type || 'header' },
      mainCategoryCount: descendants.filter((item) => (item.type || '') === 'category').length,
      subcategoryCount: descendants.filter((item) => (item.type || '') === 'subcategory').length,
      totalCategoryCount: branchIds.length,
      productCount,
    },
  });
};

/**
 * Removes a single category and switches off everything that depended on it.
 *
 * Only the target category is destroyed. Its children survive as *unlinked*
 * (parentId cleared) and switched off, and everything deeper stays attached to
 * them but is switched off too — so the admin can re-link a branch under another
 * parent later and bring it, and its products, straight back.
 */
export const removeCategory = async (req, res) => {
  const { categoryId } = req.params;
  if (!mongoose.isValidObjectId(categoryId)) {
    return res.status(400).json({ success: false, message: 'Invalid category id' });
  }

  const category = await QuickCategory.findById(categoryId).select('_id name type').lean();
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const branchIds = await collectCategoryBranchIds(categoryId);
  const descendantIds = branchIds.slice(1);

  // Both flags are written because the storefront treats a missing flag as visible.
  const deactivatedProducts = await QuickProduct.updateMany(
    branchProductFilter(branchIds),
    { $set: { status: 'inactive', isActive: false } },
  );

  let deactivatedCategories = 0;
  if (descendantIds.length) {
    const result = await QuickCategory.updateMany(
      { _id: { $in: descendantIds } },
      { $set: { status: 'inactive', isActive: false } },
    );
    deactivatedCategories = result.modifiedCount || 0;

    // Direct children lose their parent link so the admin can spot them as
    // "unlinked" and move them under a different parent.
    await QuickCategory.updateMany({ parentId: categoryId }, { $set: { parentId: null } });
  }

  await QuickCategory.deleteOne({ _id: categoryId });

  return res.json({
    success: true,
    result: {
      deleted: true,
      deletedCategoryCount: 1,
      deactivatedCategoryCount: deactivatedCategories,
      deactivatedProductCount: deactivatedProducts.modifiedCount || 0,
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
    page = 1,
    limit = 50,
  } = req.query || {};
  const query = {};

  const categoryFilter = categoryId || category;
  if (categoryFilter && mongoose.isValidObjectId(categoryFilter)) {
    query.$or = [
      { categoryId: categoryFilter },
      { subcategoryId: categoryFilter },
      { headerId: categoryFilter },
    ];
  }
  if (search) query.name = { $regex: String(search).trim(), $options: 'i' };
  if (status && status !== 'all') {
    query.status = status;
    query.isActive = status === 'active';
  }
  if (approvalStatus && approvalStatus !== 'all') query.approvalStatus = approvalStatus;

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 100));

  const [products, total] = await Promise.all([
    QuickProduct.find(query)
      .populate('headerId categoryId subcategoryId', 'name slug')
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

export const createProduct = async (req, res) => {
  const {
    name,
    categoryId,
    subcategoryId,
    headerId,
    price,
    mrp,
    salePrice,
    badge,
    description,
    stock,
    lowStockAlert,
    status,
    approvalStatus,
    brand,
    sku,
    isFeatured,
    deliveryTime,
    variants,
  } = req.body || {};
  const images = await getProductImages(req);

  if (!name || !categoryId || !mongoose.isValidObjectId(categoryId)) {
    return res.status(400).json({ success: false, message: 'name and valid categoryId are required' });
  }

  const category = await QuickCategory.findById(categoryId).lean();
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  const baseSlug = slugify(name);
  const count = await QuickProduct.countDocuments({ slug: { $regex: `^${baseSlug}` } });
  const slug = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug;

  const product = await QuickProduct.create({
    name,
    slug,
    image: images.image,
    mainImage: images.mainImage,
    galleryImages: images.galleryImages,
    categoryId,
    subcategoryId: mongoose.isValidObjectId(subcategoryId) ? subcategoryId : null,
    headerId: mongoose.isValidObjectId(headerId) ? headerId : null,
    description: description || '',
    price: Number(price || 0),
    mrp: Number(mrp || salePrice || price || 0),
    salePrice: Number(salePrice || 0),
    brand: brand || '',
    sku: sku || '',
    stock: parseNumber(stock, 0),
    lowStockAlert: parseNumber(lowStockAlert, 5),
    status: status || 'active',
    approvalStatus: approvalStatus || 'approved',
    approvedAt: (approvalStatus || 'approved') === 'approved' ? new Date() : null,
    isFeatured: parseBool(isFeatured, false),
    variants: parseVariants(variants),
    deliveryTime: deliveryTime || '10 mins',
    badge: badge || '',
    isActive: (status || 'active') === 'active',
  });

  return res.status(201).json({ success: true, result: toProduct(product) });
};

export const updateProduct = async (req, res) => {
  const product = await QuickProduct.findById(req.params.productId);
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const body = req.body || {};

  // Admin is view-only on seller-owned products — the only write it may make
  // is toggling visibility (status). Full edits (variants, pricing, photos,
  // etc.) stay with the seller.
  if (product.sellerId) {
    const allowedKeys = new Set(['status']);
    const requestedKeys = Object.keys(body);
    const hasFiles = req.files && Object.keys(req.files).length > 0;
    const hasDisallowedField = requestedKeys.some((key) => !allowedKeys.has(key));
    if (hasFiles || hasDisallowedField) {
      return res.status(403).json({
        success: false,
        message: 'Admins can only show or hide seller products, not edit them',
      });
    }
  }

  const images = await getProductImages(req);

  // Remembered before the assignments below so we can tell whether the product
  // was actually moved to a different category.
  const originalCategoryId = product.categoryId ? String(product.categoryId) : '';
  const originalSubcategoryId = product.subcategoryId ? String(product.subcategoryId) : '';

  if (body.name !== undefined) product.name = body.name;
  if (body.slug !== undefined || body.name !== undefined) {
    product.slug = slugify(body.slug || body.name || product.name);
  }
  if (body.categoryId && mongoose.isValidObjectId(body.categoryId)) product.categoryId = body.categoryId;
  if (body.subcategoryId !== undefined) product.subcategoryId = mongoose.isValidObjectId(body.subcategoryId) ? body.subcategoryId : null;
  if (body.headerId !== undefined) product.headerId = mongoose.isValidObjectId(body.headerId) ? body.headerId : null;
  if (body.description !== undefined) product.description = body.description;
  if (body.price !== undefined) product.price = parseNumber(body.price, product.price);
  if (body.mrp !== undefined || body.salePrice !== undefined || body.price !== undefined) {
    product.mrp = parseNumber(body.mrp, parseNumber(body.salePrice, parseNumber(body.price, product.mrp)));
  }
  if (body.salePrice !== undefined) product.salePrice = parseNumber(body.salePrice, 0);
  if (body.brand !== undefined) product.brand = body.brand || '';
  if (body.sku !== undefined) product.sku = body.sku || '';
  if (body.stock !== undefined) product.stock = parseNumber(body.stock, 0);
  if (body.lowStockAlert !== undefined) product.lowStockAlert = parseNumber(body.lowStockAlert, 5);
  if (body.status !== undefined) {
    product.status = body.status || 'active';
    product.isActive = product.status === 'active';
  }
  if (body.approvalStatus !== undefined) {
    product.approvalStatus = body.approvalStatus || 'pending';
    product.approvedAt = product.approvalStatus === 'approved' ? new Date() : null;
  }
  if (body.isFeatured !== undefined) product.isFeatured = parseBool(body.isFeatured, false);
  if (body.variants !== undefined) product.variants = parseVariants(body.variants);
  if (body.deliveryTime !== undefined) product.deliveryTime = body.deliveryTime || '10 mins';
  if (body.badge !== undefined) product.badge = body.badge || '';
  if (images.mainImage) {
    product.mainImage = images.mainImage;
    product.image = images.image;
  }
  if (Array.isArray(images.galleryImages) && images.galleryImages.length > 0) {
    product.galleryImages = images.galleryImages;
  }

  // Older products were stored without an mrp, which the schema now requires.
  // Backfilling from the price keeps those records saveable instead of failing
  // validation on every edit.
  if (product.mrp === undefined || product.mrp === null) {
    product.mrp = parseNumber(product.price, 0);
  }

  // Moving a switched-off product into a live category brings it back — this is
  // how products recover after the category they belonged to was deleted or
  // switched off. An explicit status in the request still wins.
  const categoryChanged =
    (body.categoryId && String(body.categoryId) !== String(originalCategoryId || '')) ||
    (body.subcategoryId !== undefined &&
      String(body.subcategoryId || '') !== String(originalSubcategoryId || ''));

  if (categoryChanged && body.status === undefined && product.isActive === false) {
    const targetCategoryId = product.subcategoryId || product.categoryId;
    const targetCategory = targetCategoryId
      ? await QuickCategory.findById(targetCategoryId).select('_id status isActive parentId').lean()
      : null;
    const targetIsLive =
      targetCategory &&
      targetCategory.status !== 'inactive' &&
      targetCategory.isActive !== false &&
      !(await findInactiveAncestor(targetCategory.parentId));

    if (targetIsLive) {
      product.status = 'active';
      product.isActive = true;
    }
  }

  await product.save();
  const populated = await QuickProduct.findById(product._id)
    .populate('headerId categoryId subcategoryId', 'name slug')
    .lean();
  return res.json({ success: true, result: toProduct(populated) });
};

export const processRefund = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { refundAmount, refundTo } = req.body;
    
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order id' });
    }
    
    // Reuse the battle-tested Food module refund logic
    const updated = await processFoodRefund(orderId, refundAmount, refundTo);
    
    // Optional: Send notification if needed (handled in service or here)
    const order = await mongoose.model('FoodOrder').findById(orderId).lean();
    if (order && order.userId) {
      try {
        const { notifyOwnersSafely } = await import('../../../core/notifications/firebase.service.js');
        await notifyOwnersSafely(
          [{ ownerType: 'USER', ownerId: order.userId }],
          {
            title: 'Refund Processed! 💸',
            body: `Your refund of ₹${refundAmount || order.totalAmount || order.total || order.pricing?.total || 0} for Order #${order.orderId} has been processed successfully.`,
            image: 'https://i.ibb.co/3m2Yh7r/Appzeto-Brand-Image.png',
            data: {
              type: 'refund_processed',
              orderId: String(order.orderId),
              orderMongoId: String(order._id)
            }
          }
        );
      } catch (notifyErr) {
        console.error('Failed to send refund notification:', notifyErr);
      }
    }
    
    res.status(200).json({ success: true, message: 'Refund processed successfully', data: updated });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const removeProduct = async (req, res) => {
  await QuickProduct.findByIdAndDelete(req.params.productId);
  return res.json({ success: true, result: { deleted: true } });
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
      case 'refunded':
        query['payment.status'] = 'refunded';
        break;
      case 'returned':
      default:
        break;
    }
  }

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  const [orders, total] = await Promise.all([
    QuickOrder.find(query)
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

  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id shopName name')
    .lean();

  const sellerOrders = await SellerOrder.find({ orderId: { $in: orders.map((order) => order.orderId).filter(Boolean) } })
    .select('_id orderId status workflowStatus customer address')
    .lean();

  const sellerMap = sellers.reduce((acc, s) => {
    acc[String(s._id)] = s;
    return acc;
  }, {});

  const sellerOrderMap = sellerOrders.reduce((acc, sellerOrder) => {
    acc[String(sellerOrder.orderId)] = sellerOrder;
    return acc;
  }, {});

  return res.json({
    success: true,
    result: {
      items: orders.map((order) => buildQuickAdminOrderResponse(order, sellerMap, sellerOrderMap)),
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

  const order = await QuickOrder.findOne(query).lean();
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const quickItems = Array.isArray(order.items) ? order.items.filter((item) => item?.type === 'quick') : [];
  const sellerIds = [...new Set(quickItems.map((item) => String(item?.sourceId || '')).filter(Boolean))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [sellers, sellerOrders] = await Promise.all([
    Seller.find({ _id: { $in: sellerIds } }).select('_id shopName name location').lean(),
    SellerOrder.find({ orderId: order.orderId }).select('_id orderId status workflowStatus customer address').lean(),
  ]);

  const sellerMap = sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});
  const sellerOrderMap = sellerOrders.reduce((acc, sellerOrder) => {
    acc[String(sellerOrder.orderId)] = sellerOrder;
    return acc;
  }, {});

  return res.json({
    success: true,
    result: buildQuickAdminOrderResponse(order, sellerMap, sellerOrderMap),
  });
};

export const getAdminCustomers = async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query || {};
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = Math.max(1, Math.min(parseInt(limit, 10) || 50, 200));
  const skip = (currentPage - 1) * perPage;
  const normalizedSearch = String(search || '').trim().toLowerCase();

  const filter = { role: 'USER' };
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
      const platformFee = Number(order.pricing?.platformFee || 0);
      const payableTotal = Math.max(
        0,
        Number(order.payment?.amountDue || 0),
        Number(order.payableAmount || 0),
        Number(order.totalAmount || 0),
        Number(order.amount || 0),
        Number(order.total || 0),
        pricingTotal + platformFee,
      );

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
    userId: { $in: [user._id, String(user._id)] }
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const totalSpent = orders
    .filter(o => o.orderStatus === 'delivered')
    .reduce((sum, o) => {
      const pricingTotal = Number(o.pricing?.total || 0);
      const platformFee = Number(o.pricing?.platformFee || 0);
      const payableTotal = Math.max(
        0,
        Number(o.payment?.amountDue || 0),
        Number(o.payableAmount || 0),
        Number(o.totalAmount || 0),
        Number(o.amount || 0),
        Number(o.total || 0),
        pricingTotal + platformFee,
      );
      return sum + payableTotal;
    }, 0);

  const name = user.name || 'Customer';
  const result = {
    id: String(user._id),
    name: name,
    email: user.email || '',
    phone: user.phone || '',
    avatar: user.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
    status: user.isActive === false ? 'inactive' : 'active',
    isActive: user.isActive !== false,
    walletBalance: Number(user.walletBalance || 0),
    isVerified: Boolean(user.isVerified),
    isCodAllowed: user.isCodAllowed !== false,
    joinedDate: user.createdAt,
    totalOrders: orders.length,
    totalSpent,
    lastOrderDate: orders[0]?.createdAt || null,
    addresses: (user.addresses || []).map(addr => ({
      id: addr._id,
      label: addr.label || 'Home',
      fullAddress: [addr.street, addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.zipCode || '',
      isDefault: addr.isDefault
    })),
    recentOrders: orders.slice(0, 10).map(o => {
      const pricingTotal = Number(o.pricing?.total || 0);
      const platformFee = Number(o.pricing?.platformFee || 0);
      const payableTotal = Math.max(
        0,
        Number(o.payment?.amountDue || 0),
        Number(o.payableAmount || 0),
        Number(o.totalAmount || 0),
        Number(o.amount || 0),
        Number(o.total || 0),
        pricingTotal + platformFee,
      );

      return {
        id: `#${o.orderId || o._id}`,
        rawId: String(o.orderId || o._id),
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

export const updateAdminCustomerStatus = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid customer ID' });
  }

  const { isActive } = req.body || {};
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
  }

  const updateFields = { isActive };
  if (isActive) {
    updateFields.isDeleted = false;
    updateFields['deletionRequest.status'] = 'none';
  }

  const user = await FoodUser.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true }
  ).lean();

  if (!user) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  // If customer is being deactivated, delete all active refresh tokens to terminate sessions
  if (!isActive) {
    await FoodRefreshToken.deleteMany({ userId: user._id });
  }

  return res.json({
    success: true,
    message: `Customer ${isActive ? 'activated' : 'deactivated'} successfully`,
    result: {
      id: String(user._id),
      status: user.isActive === false ? 'inactive' : 'active',
      isActive: user.isActive !== false,
    }
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

  if (status === 'deleted') {
    query.isDeleted = true;
  } else {
    query.isDeleted = { $ne: true };
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

export const getAdminSellerById = async (req, res) => {
  try {
    const sellerId = req.params.id;
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' });
    }
    const seller = await Seller.findById(sellerId).lean();
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    return res.json({ success: true, result: seller });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch seller details' });
  }
};

/**
 * Switches a seller on or off. An inactive seller keeps its catalogue, but the
 * storefront stops serving that seller's products (see the catalog controller's
 * hidden-seller filter), so nothing has to be deleted to take a shop offline.
 */
export const updateAdminSellerStatus = async (req, res) => {
  const sellerId = req.params.id;
  if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
    return res.status(400).json({ success: false, message: 'Invalid seller ID' });
  }

  const seller = await Seller.findById(sellerId).select('_id shopName name isActive isDeleted');
  if (!seller || seller.isDeleted) {
    return res.status(404).json({ success: false, message: 'Seller not found' });
  }

  const makeActive =
    typeof req.body?.isActive === 'boolean'
      ? req.body.isActive
      : String(req.body?.isActive ?? req.body?.status ?? '').toLowerCase() === 'true' ||
        String(req.body?.status || '').toLowerCase() === 'active';

  seller.isActive = makeActive;
  await seller.save();

  const productCount = await QuickProduct.countDocuments({ sellerId: seller._id });

  return res.json({
    success: true,
    result: {
      id: seller._id,
      isActive: seller.isActive,
      shopName: seller.shopName || seller.name || 'Store',
      productCount,
    },
  });
};

export const softDeleteAdminSeller = async (req, res) => {
  try {
    const sellerId = req.params.id;
    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' });
    }

    // Verify password — same flow as contacts view / customer delete
    const passwordInput = req.body.password || req.query.password;
    const password = passwordInput ? passwordInput.trim() : "";

    const { GlobalSettings } = await import('../../common/models/settings.model.js');
    const settings = await GlobalSettings.findOne();

    if (settings && settings.contactsViewPassword) {
      if (!password || password !== settings.contactsViewPassword.trim()) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }
    if (seller.isDeleted) {
      return res.status(404).json({ success: false, message: 'Seller already deleted' });
    }

    await Seller.updateOne(
      { _id: seller._id },
      {
        $set: {
          isDeleted: true,
          isActive: false,
          'deletionRequest.status': 'approved',
          'deletionRequest.requestedAt': new Date(),
          'deletionRequest.reason': 'Deleted by admin'
        }
      }
    );

    // Invalidate sessions and clear tokens
    const { FoodRefreshToken } = await import('../../../core/refreshTokens/refreshToken.model.js');
    await Promise.all([
        FoodRefreshToken.deleteMany({ userId: seller._id }),
        Seller.updateOne(
            { _id: seller._id },
            { $set: { fcmTokens: [], fcmTokenMobile: [] } }
        ),
    ]);

    return res.json({ success: true, message: 'Seller deleted successfully', data: { seller } });
  } catch (error) {
    console.error('Error soft deleting seller:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
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

    try {
      const io = getIO();
      if (io) {
        io.to(rooms.seller(updated._id)).emit('seller_live_update', {
          type: 'seller_profile_approved',
          seller: toSellerRequest(updated),
        });
      }
    } catch {}

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

  // Approval mail with the partnership certificate attached. Fired on every
  // approval, including one that follows a rejection and re-application, and
  // deliberately not awaited so a slow mail server never blocks the response.
  if (seller.email) {
    import('../../../utils/email.js')
      .then(({ sendPartnerApprovalCertificateEmail }) =>
        sendPartnerApprovalCertificateEmail(seller.email, {
          type: 'seller',
          partnerName: seller.shopName || seller.name || 'Store',
          partnerId: String(seller._id),
          onboardingDate: seller.approvedAt,
        }),
      )
      .catch((error) =>
        console.error('Failed to send seller approval certificate email:', error.message),
      );
  }

  try {
    const io = getIO();
    if (io) {
      io.to(rooms.seller(seller._id)).emit('seller_live_update', {
        type: 'seller_approved',
        seller: toSellerRequest(seller),
      });
    }
  } catch {}

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

    try {
      const io = getIO();
      if (io) {
        io.to(rooms.seller(updated._id)).emit('seller_live_update', {
          type: 'seller_profile_rejected',
          seller: toSellerRequest(updated),
        });
      }
    } catch {}

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
  seller.previousRejectionNotes = reason;
  seller.isReapplied = false;
  await seller.save();

  await upsertSellerNotification(seller._id, {
    key: `onboarding:${String(seller._id)}:decision`,
    type: 'system',
    title: 'Your application needs changes',
    message: reason
      ? `Your application was not approved. Note from our team: ${reason}`
      : 'Your application needs updates. Please correct your details and submit again.',
    link: '/seller/onboarding',
  });

  try {
    const io = getIO();
    if (io) {
      io.to(rooms.seller(seller._id)).emit('seller_live_update', {
        type: 'seller_rejected',
        seller: toSellerRequest(seller),
      });
    }
  } catch {}

  return res.json({
    success: true,
    message: 'Seller request rejected',
    result: toSellerRequest(seller),
  });
};

export const updateAdminSellerProfile = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const seller = await Seller.findById(sellerId);
    
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    await updateSellerProfileData(seller, req);
    await seller.save();

    return res.json({
      success: true,
      message: 'Seller profile updated successfully',
      result: toSellerRequest(seller),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: 'Phone or email already belongs to another seller' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Failed to update seller profile' });
  }
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

  const isCircle = body.shapeType === 'circle' && body.center && Number.isFinite(Number(body.radiusMeters));

  const zone = await QuickZone.create({
    name,
    zoneName: body.zoneName && String(body.zoneName).trim() ? String(body.zoneName).trim() : name,
    country: body.country ? String(body.country).trim() : 'India',
    serviceLocation: body.serviceLocation ? String(body.serviceLocation).trim() : name,
    unit: body.unit === 'miles' ? 'miles' : 'kilometer',
    isActive: body.isActive !== false,
    coordinates: capPolygonPoints(coordinates.map((coord) => ({
      latitude: Number(coord?.latitude ?? coord?.lat),
      longitude: Number(coord?.longitude ?? coord?.lng),
    }))),
    ...(isCircle && {
      shapeType: 'circle',
      center: {
        latitude: Number(body.center.latitude),
        longitude: Number(body.center.longitude),
      },
      radiusMeters: Number(body.radiusMeters),
    }),
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
    zone.coordinates = capPolygonPoints(body.coordinates.map((coord) => ({
      latitude: Number(coord?.latitude ?? coord?.lat),
      longitude: Number(coord?.longitude ?? coord?.lng),
    })));
  }
  if (body.shapeType === 'circle' && body.center && Number.isFinite(Number(body.radiusMeters))) {
    zone.shapeType = 'circle';
    zone.center = {
      latitude: Number(body.center.latitude),
      longitude: Number(body.center.longitude),
    };
    zone.radiusMeters = Number(body.radiusMeters);
  } else if (body.shapeType === 'polygon') {
    zone.shapeType = 'polygon';
    zone.center = undefined;
    zone.radiusMeters = undefined;
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

export const getAdminFinanceSummary = async (_req, res) => {
  const result = await getQuickCommerceFinanceSummary();
  return res.json({ success: true, result });
};

export const getAdminFinanceLedger = async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 25) || 25));
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

export const getAdminDeliveryWithdrawals = async (req, res) => {
  try {
    const result = await getQuickCommerceDeliveryWithdrawals({
      page: req.query?.page,
      limit: req.query?.limit,
      status: req.query?.status,
      search: req.query?.search,
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load delivery withdrawals",
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

// Coupon Management
export const getAdminCoupons = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    const now = new Date();

    if (status && status !== 'all') {
      if (status === 'active') {
        query.isActive = true;
        query.$and = [
          { $or: [{ validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } }] },
          { $or: [{ validTill: null }, { validTill: { $exists: false } }, { validTill: { $gte: now } }] },
        ];
      } else if (status === 'expired') {
        query.validTill = { $lt: now };
      } else if (status === 'scheduled') {
        query.validFrom = { $gt: now };
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }
    const coupons = await QuickCoupon.find(query)
      .populate('sellerId', 'name storeName shopName phone shopInfo logo avatar image')
      .populate('sellerIds', 'name storeName shopName phone shopInfo logo avatar image')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, result: coupons });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
};

export const createAdminCoupon = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.code) {
      body.code = String(body.code).trim().toUpperCase();
    }
    // Dates formatting: ensure start of day and end of day so same-day coupons remain valid
    if (body.validFrom) {
      const fromDate = new Date(body.validFrom);
      if (!isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        body.validFrom = fromDate;
      }
    } else {
      delete body.validFrom;
    }

    if (body.validTill) {
      const tillDate = new Date(body.validTill);
      if (!isNaN(tillDate.getTime())) {
        tillDate.setHours(23, 59, 59, 999);
        body.validTill = tillDate;
      }
    } else {
      delete body.validTill;
    }

    // Sanitize optional numbers
    ['maxDiscount', 'usageLimit', 'minOrderValue'].forEach(k => {
      if (body[k] === '' || body[k] === null || body[k] === undefined) {
        delete body[k];
      } else {
        body[k] = Number(body[k]);
      }
    });

    if (body.discountValue !== undefined) {
      body.discountValue = Number(body.discountValue);
    }

    if (body.scope === 'seller') {
      let ids = [];
      if (Array.isArray(body.sellerIds)) {
        ids = body.sellerIds.filter(Boolean);
      } else if (body.sellerId) {
        ids = [body.sellerId];
      }
      body.sellerIds = ids;
      body.sellerId = ids[0] || null;
      body.scope = 'seller';
    } else {
      body.scope = 'all';
      body.sellerId = null;
      body.sellerIds = [];
    }

    if (!body.couponType) {
      body.couponType = 'generic';
    }

    if (!body.title) body.title = body.code || '';
    const coupon = await QuickCoupon.create(body);
    const populated = await QuickCoupon.findById(coupon._id)
      .populate('sellerId', 'name storeName shopName phone shopInfo logo avatar image')
      .populate('sellerIds', 'name storeName shopName phone shopInfo logo avatar image')
      .lean();
    return res.status(201).json({ success: true, result: populated || coupon });
  } catch (error) {
    console.error('[createAdminCoupon] Error:', error.message);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A coupon with this code already exists' });
    }
    return res.status(400).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
};

export const updateAdminCoupon = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.code) {
      body.code = String(body.code).trim().toUpperCase();
    }
    if (body.validFrom) {
      const fromDate = new Date(body.validFrom);
      if (!isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0);
        body.validFrom = fromDate;
      }
    } else if (body.validFrom === '' || body.validFrom === null) {
      delete body.validFrom;
    }

    if (body.validTill) {
      const tillDate = new Date(body.validTill);
      if (!isNaN(tillDate.getTime())) {
        tillDate.setHours(23, 59, 59, 999);
        body.validTill = tillDate;
      }
    } else if (body.validTill === '' || body.validTill === null) {
      delete body.validTill;
    }

    ['maxDiscount', 'usageLimit'].forEach(k => {
      if (body[k] === '' || body[k] === null || body[k] === undefined) {
        delete body[k];
      } else {
        body[k] = Number(body[k]);
      }
    });

    if (body.discountValue !== undefined && body.discountValue !== '') {
      body.discountValue = Number(body.discountValue);
    }
    if (body.minOrderValue !== undefined && body.minOrderValue !== '') {
      body.minOrderValue = Number(body.minOrderValue);
    }

    if (body.scope === 'seller') {
      let ids = [];
      if (Array.isArray(body.sellerIds)) {
        ids = body.sellerIds.filter(Boolean);
      } else if (body.sellerId) {
        ids = [body.sellerId];
      }
      body.sellerIds = ids;
      body.sellerId = ids[0] || null;
      body.scope = 'seller';
    } else if (body.scope === 'all') {
      body.scope = 'all';
      body.sellerId = null;
      body.sellerIds = [];
    }

    const coupon = await QuickCoupon.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true })
      .populate('sellerId', 'name storeName shopName phone shopInfo logo avatar image')
      .populate('sellerIds', 'name storeName shopName phone shopInfo logo avatar image');
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.json({ success: true, result: coupon });
  } catch (error) {
    console.error('[updateAdminCoupon] Error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update coupon' });
  }
};

export const deleteAdminCoupon = async (req, res) => {
  try {
    const coupon = await QuickCoupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete coupon' });
  }
};

// ==========================================
// Banner Management (Marketing Tools)
// ==========================================

export const getAdminBannersController = async (req, res) => {
  try {
    const data = await getBannersService(req.query);
    return res.json({ success: true, ...data });
  } catch (error) {
    console.error('[getAdminBannersController] Error:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch banners' });
  }
};

export const getAdminBannerByIdController = async (req, res) => {
  try {
    const banner = await getBannerByIdService(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    return res.json({ success: true, result: banner });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to fetch banner' });
  }
};

export const createAdminBannerController = async (req, res) => {
  try {
    const image = await getBannerImage(req);
    if (!image) {
      return res.status(400).json({ success: false, message: 'Banner image is required' });
    }

    const payload = {
      ...req.body,
      image,
    };

    if (!payload.title || !payload.title.trim()) {
      return res.status(400).json({ success: false, message: 'Banner title is required' });
    }

    const banner = await createBannerService(payload);
    return res.status(201).json({ success: true, result: banner });
  } catch (error) {
    console.error('[createAdminBannerController] Error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Failed to create banner' });
  }
};

export const updateAdminBannerController = async (req, res) => {
  try {
    const payload = { ...req.body };

    if (req.file?.buffer) {
      payload.image = await uploadImageBuffer(req.file.buffer, 'quick-commerce/banners');
    }

    const banner = await updateBannerService(req.params.id, payload);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    return res.json({ success: true, result: banner });
  } catch (error) {
    console.error('[updateAdminBannerController] Error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Failed to update banner' });
  }
};

export const toggleAdminBannerStatusController = async (req, res) => {
  try {
    const banner = await toggleBannerStatusService(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: 'Banner not found' });
    return res.json({ success: true, result: banner });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to toggle banner status' });
  }
};

export const deleteAdminBannerController = async (req, res) => {
  try {
    const deleted = await deleteBannerService(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Banner not found' });
    return res.json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Failed to delete banner' });
  }
};

