import mongoose from 'mongoose';
import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickReview } from '../models/review.model.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { Seller } from '../seller/models/seller.model.js';
import {
  getQuickCategories,
  getQuickCoupons,
  getQuickExperienceSections,
  getQuickHeroConfig,
  getQuickOfferSections,
  getQuickOffers,
  getQuickSettings,
  getQuickHomeTiles,
  getQuickHomeHeadings,
} from '../services/content.service.js';
import {
  isQuickCouponCurrentlyValid,
  isQuickCouponExpired,
  isQuickCouponNotStarted,
} from '../utils/coupon.helpers.js';
import {
  assertQuickSellerCouponUsageAvailable,
} from '../utils/sellerCouponUsage.helpers.js';
import {
  escapeRegex,
  publicProductVisibilityFilter,
} from '../utils/productVisibility.helpers.js';
import { isStoreCurrentlyOpen } from '../utils/timeFormat.helpers.js';
import {
  resolveZoneCatalogScope,
  buildZoneProductFilter,
  toZoneServiceMeta,
  filterSectionsByZoneSellers,
} from '../services/zoneCatalogScope.service.js';

const setNoCache = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

const setPublicCache = (res, maxAge = 300) => {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
};

/** Zone-scoped responses must not be shared across users/locations. */
const setPrivateCache = (res, maxAge = 30) => {
  res.set('Cache-Control', `private, max-age=${maxAge}`);
};

const parseRequestCoords = (req = {}) => {
  const rawLat = req.query?.lat ?? req.query?.latitude;
  const rawLng = req.query?.lng ?? req.query?.longitude;
  // Empty string must not become Number('') === 0 (null island).
  if (rawLat === undefined || rawLat === null || rawLat === '' ||
      rawLng === undefined || rawLng === null || rawLng === '') {
    return { lat: null, lng: null };
  }
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
};

const approvedOrLegacyFilter = {
  $and: [
    {
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    },
  ],
};

const publicCategoryFilter = {
  $and: [
    {
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { isActive: true },
        { isActive: { $exists: false } },
      ],
    },
    {
      $or: [
        { type: { $ne: 'subcategory' } },
        approvedOrLegacyFilter,
      ],
    },
  ],
};

const publicProductFilter = publicProductVisibilityFilter;

const mapCategory = (category) => {
  // Do not default missing type to 'header' — that makes mid-level nodes
  // incorrectly become the GST/commission authority.
  const type = category.type || 'category';
  const result = {
    id: category._id,
    _id: category._id,
    name: category.name,
    slug: category.slug,
    image: category.image || '',
    status: category.status || (category.isActive ? 'active' : 'inactive'),
    type,
    parentId: category.parentId || null,
    color: category.accentColor || category.headerColor || '#0c831f',
  };

  // Fees / icon / headerColor are header-only (source of truth for pricing + nav theme).
  if (type === 'header') {
    result.iconId = category.iconId || '';
    result.headerColor = category.headerColor || category.accentColor || '#0c831f';
    result.handlingFees = Number(category.handlingFees || 0);
    result.adminCommission = Number(category.adminCommission || 0);
    result.commission = Number(category.adminCommission || 0);
    result.gst = Number(category.gst || 0);
    result.returnsEnabled = category.returnsEnabled !== false;
    result.returnWindowHours = Number(category.returnWindowHours || 72);
    result.businessType = category.businessType || 'quick_commerce';
  }

  return result;
};

const buildSellerMap = async (products = []) => {
  const sellerIds = [...new Set(
    products
      .map((product) => String(product?.sellerId || '').trim())
      .filter(Boolean)
  )];

  if (!sellerIds.length) return {};

  const sellers = await Seller.find({ _id: { $in: sellerIds } })
    .select('_id shopName name shopInfo.openingHours')
    .lean();

  return sellers.reduce((acc, seller) => {
    acc[String(seller._id)] = seller;
    return acc;
  }, {});
};

const toMoney = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** List price (MRP) + selling price for storefront, tolerant of legacy bad mrp/sale swaps. */
const resolveStorefrontPricing = ({ price, salePrice, mrp } = {}) => {
  const listCandidate = Math.max(toMoney(price), toMoney(salePrice), toMoney(mrp));
  const base = toMoney(price);
  const sale = toMoney(salePrice);
  const sell =
    sale > 0 && listCandidate > 0 && sale < listCandidate
      ? sale
      : base || sale || listCandidate;

  return {
    price: base || sell,
    salePrice: sale,
    mrp: listCandidate || sell,
    originalPrice: listCandidate || sell,
    displayPrice: sell || base,
  };
};

const mapPublicVariant = (variant = {}) => {
  const pricing = resolveStorefrontPricing({
    price: variant.price,
    salePrice: variant.salePrice,
    mrp: variant.mrp,
  });
  const mapped = {
    _id: variant._id,
    id: variant._id || variant.id,
    name: variant.name || '',
    price: pricing.displayPrice,
    salePrice: pricing.salePrice,
    originalPrice: pricing.originalPrice,
    mrp: pricing.mrp,
    stock: Math.max(0, Number(variant.stock || 0)),
    sku: variant.sku || '',
  };
  if (variant.strength) mapped.strength = variant.strength;
  if (variant.packType) mapped.packType = variant.packType;
  if (Number(variant.packQuantity) > 0) mapped.packQuantity = Number(variant.packQuantity);
  if (variant.unit) mapped.unit = variant.unit;
  if (Array.isArray(variant.images) && variant.images.length) {
    mapped.images = variant.images.filter(Boolean);
  }
  return mapped;
};

const mapProduct = (product, sellerMap = {}) => {
  const seller = sellerMap[String(product?.sellerId || '')] || null;
  const mappedVariants = Array.isArray(product.variants)
    ? product.variants.map(mapPublicVariant)
    : [];
  const firstVariant =
    mappedVariants.find((variant) => Number(variant.stock || 0) > 0) ||
    mappedVariants[0] ||
    null;
  const pricing = resolveStorefrontPricing(
    firstVariant
      ? {
          price: firstVariant.price,
          salePrice: firstVariant.salePrice,
          mrp: firstVariant.originalPrice || firstVariant.mrp,
        }
      : {
          price: product.price,
          salePrice: product.salePrice,
          mrp: product.mrp,
        },
  );
  const weight = firstVariant?.name || product.weight || '';
  const unit = product.unit || weight || '';
  const displayStock = firstVariant
    ? Number(firstVariant.stock || 0)
    : Number(product.stock || 0);
  const openingHours = seller?.shopInfo?.openingHours || '';
  const isShopOpen = isStoreCurrentlyOpen(openingHours);

  return {
    id: product._id,
    _id: product._id,
    name: product.name,
    slug: product.slug,
    sku: product.sku || '',
    image: product.mainImage || product.image,
    mainImage: product.mainImage || product.image,
    galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
    categoryId: product.categoryId,
    subcategoryId: product.subcategoryId || null,
    headerId: product.headerId || null,
    // Storefront cards/detail use first variant pricing when variants exist.
    price: pricing.displayPrice,
    salePrice: pricing.salePrice,
    mrp: pricing.mrp,
    originalPrice: pricing.originalPrice,
    packingFee: Number(product.packingFee || 0),
    weight,
    unit,
    stock: displayStock,
    totalStock: Number(product.stock || 0),
    lowStockAlert: Number(product.lowStockAlert ?? 5),
    status: product.status || (product.isActive ? 'active' : 'inactive'),
    brand: product.brand || '',
    description: product.description || '',
    tags: Array.isArray(product.tags) ? product.tags : [],
    variants: mappedVariants,
    pharmacyDetails:
      product.pharmacyDetails &&
      typeof product.pharmacyDetails === 'object' &&
      Object.keys(product.pharmacyDetails).length > 0
        ? product.pharmacyDetails
        : undefined,
    deliveryTime: product.deliveryTime || '10 mins',
    rating: product.rating,
    badge: product.badge,
    approvalStatus: product.approvalStatus || 'approved',
    sellerId: product.sellerId || seller?._id || null,
    seller: seller
      ? {
          _id: seller._id,
          id: seller._id,
          name: seller.name || '',
          shopName: seller.shopName || seller.name || 'Store',
          openingHours,
          shopInfo: { openingHours },
        }
      : null,
    storeName: seller?.shopName || seller?.name || '',
    restaurantName: seller?.shopName || seller?.name || '',
    openingHours,
    isShopOpen,
  };
};

/** Lean product payload for homepage bootstrap (home cards only — detail page fetches full product). */
const mapBootstrapProduct = (product, sellerMap = {}) => {
  const full = mapProduct(product, sellerMap);
  return {
    id: full.id,
    _id: full._id,
    name: full.name,
    slug: full.slug,
    image: full.image,
    mainImage: full.mainImage,
    categoryId: full.categoryId,
    subcategoryId: full.subcategoryId,
    headerId: full.headerId,
    price: full.price,
    salePrice: full.salePrice,
    mrp: full.mrp,
    originalPrice: full.originalPrice,
    packingFee: full.packingFee,
    unit: full.unit,
    stock: full.stock,
    status: full.status,
    deliveryTime: full.deliveryTime,
    approvalStatus: full.approvalStatus,
    sellerId: full.sellerId,
    storeName: full.storeName,
    restaurantName: full.restaurantName,
    openingHours: full.openingHours,
    isShopOpen: full.isShopOpen,
    weight: full.weight,
    variants: full.variants,
    pharmacyDetails: full.pharmacyDetails,
    brand: full.brand,
    description: full.description,
    galleryImages: full.galleryImages,
    seller: full.seller
      ? {
          _id: full.seller._id,
          id: full.seller.id,
          name: full.seller.name,
          shopName: full.seller.shopName,
          openingHours: full.seller.openingHours,
        }
      : null,
  };
};

const slimCategoryRef = (item = {}) => ({
  _id: item._id,
  name: item.name,
  slug: item.slug,
  image: item.image || '',
  type: item.type || 'category',
  businessType: item.businessType || undefined,
  parentId: item.parentId || null,
  status: item.status || 'active',
});

/** Drop Mongo metadata + heavy nested category fields from experience sections. */
const slimBootstrapExperienceSection = (section = {}) => {
  const config = section.config && typeof section.config === 'object'
    ? { ...section.config }
    : {};

  if (config.categories?.items && Array.isArray(config.categories.items)) {
    config.categories = {
      ...config.categories,
      items: config.categories.items.map(slimCategoryRef),
    };
  }

  if (config.banners?.items && Array.isArray(config.banners.items)) {
    config.banners = {
      ...config.banners,
      items: config.banners.items.map((b) => ({
        imageUrl: b.imageUrl || '',
        title: b.title || '',
        subtitle: b.subtitle || '',
        linkType: b.linkType || '',
        linkValue: b.linkValue || '',
        status: b.status || 'active',
      })),
    };
  }

  if (config.products?.items && Array.isArray(config.products.items)) {
    config.products = {
      ...config.products,
      items: config.products.items.map((p) => ({
        _id: p._id || p.id,
        id: p.id || p._id,
        name: p.name,
        image: p.mainImage || p.image || '',
        price: p.price,
        salePrice: p.salePrice,
        mrp: p.mrp || p.originalPrice,
        sellerId: p.sellerId,
      })),
    };
  }

  return {
    _id: section._id,
    pageType: section.pageType,
    headerId: section.headerId ?? null,
    headerIds: Array.isArray(section.headerIds) ? section.headerIds : [],
    showOnAllTab: Boolean(section.showOnAllTab),
    displayType: section.displayType,
    title: section.title || '',
    status: section.status || 'active',
    config,
    order: Number(section.order) || 0,
  };
};

export const getHomeData = async (req, res) => {
  setPrivateCache(res, 30);
  const pageType = req.query?.pageType || 'home';
  const headerId = req.query?.headerId || null;
  const coords = parseRequestCoords(req);
  const zoneScope = await resolveZoneCatalogScope(coords);
  const zoneMeta = toZoneServiceMeta(zoneScope);
  const productQuery = buildZoneProductFilter(publicProductFilter, zoneScope.sellerIds);

  const [categories, products, settings, heroConfig, experienceSections, offerSections] = await Promise.all([
    getQuickCategories(),
    zoneScope.serviceAvailable
      ? QuickProduct.find(productQuery).sort({ createdAt: -1 }).limit(18).lean()
      : Promise.resolve([]),
    getQuickSettings(),
    getQuickHeroConfig({ pageType, headerId }),
    getQuickExperienceSections({ pageType, headerId }),
    getQuickOfferSections(),
  ]);
  const scopedExperience = filterSectionsByZoneSellers(experienceSections, zoneScope.sellerIds);
  const scopedOffers = filterSectionsByZoneSellers(offerSections, zoneScope.sellerIds);
  const sellerMap = await buildSellerMap(products);

  const fallbackHero = {
    title: 'Blinkit style quick delivery',
    subtitle: 'Groceries delivered in minutes',
    banners: {
      items: [
        {
          imageUrl: '/assets/ExperienceBanner.png',
          title: '',
          subtitle: '',
          linkType: 'none',
          linkValue: '',
          status: 'active',
        },
      ],
    },
    categoryIds: categories.slice(0, 5).map((category) => String(category._id)),
  };

  const resolvedHero = heroConfig
    ? {
        ...heroConfig,
        banners: heroConfig.banners || { items: [] },
        categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
      }
    : fallbackHero;

  // No synthetic Best Sellers / fallback sections — only admin-configured experience sections.
  const resolvedSections = Array.isArray(scopedExperience) ? scopedExperience : [];

  const homeData = {
    settings: settings || {},
    categories: categories.map(mapCategory),
    bestSellers: products.map((product) => mapProduct(product, sellerMap)),
    hero: resolvedHero,
    sections: resolvedSections,
    offerSections: scopedOffers,
    ...zoneMeta,
  };

  // Partial returns for specialized frontend calls
  if (req.path.includes('/hero')) {
    return res.json({ success: true, result: resolvedHero });
  }

  if (req.path.includes('/experience')) {
    return res.json({ success: true, result: resolvedSections, ...zoneMeta });
  }

  if (req.path.includes('/offer-sections')) {
    return res.json({ success: true, results: scopedOffers, ...zoneMeta });
  }

  return res.json({
    success: true,
    result: homeData,
  });
};

// ─── Bootstrap endpoint — single request mein sab kuch ────────────────────────
// Ye naya endpoint 5 separate frontend calls ko 1 mein replace karta hai.
// Cache: 2 minutes (content.service.js mein already 5-min in-memory cache hai)
export const getBootstrapData = async (req, res) => {
  setPrivateCache(res, 30);

  try {
    const coords = parseRequestCoords(req);
    const zoneScope = await resolveZoneCatalogScope(coords);
    const zoneMeta = toZoneServiceMeta(zoneScope);
    const productQuery = buildZoneProductFilter(publicProductFilter, zoneScope.sellerIds);

    // Parallel fetch — content.service.js in-memory cache serves most of these.
    const [categories, products, heroConfig, experienceSections, offerSections, homeTiles, homeHeadings] = await Promise.all([
      getQuickCategories(),
      zoneScope.serviceAvailable
        ? QuickProduct.find(productQuery)
            .select('_id name slug mainImage image categoryId subcategoryId headerId price salePrice mrp packingFee unit weight stock status isActive approvalStatus deliveryTime rating badge sellerId variants pharmacyDetails brand description galleryImages')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean()
        : Promise.resolve([]),
      getQuickHeroConfig({ pageType: 'home', headerId: null }),
      getQuickExperienceSections({ pageType: 'home', headerId: null }),
      zoneScope.serviceAvailable ? getQuickOfferSections() : Promise.resolve([]),
      getQuickHomeTiles({ status: 'active' }),
      getQuickHomeHeadings(),
    ]);

    const scopedExperience = filterSectionsByZoneSellers(experienceSections, zoneScope.sellerIds);
    const scopedOffers = filterSectionsByZoneSellers(offerSections, zoneScope.sellerIds);

    const sellerMap = products.length > 0 ? await buildSellerMap(products) : {};

    const resolvedHero = heroConfig
      ? {
          banners: {
            items: Array.isArray(heroConfig.banners?.items)
              ? heroConfig.banners.items.map((b) => ({
                  imageUrl: b.imageUrl || '',
                  title: b.title || '',
                  subtitle: b.subtitle || '',
                  linkType: b.linkType || '',
                  linkValue: b.linkValue || '',
                  status: b.status || 'active',
                }))
              : [],
          },
          categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
        }
      : { banners: { items: [] }, categoryIds: [] };

    return res.json({
      success: true,
      result: {
        categories: categories.map(mapCategory),
        products: products.map((p) => mapBootstrapProduct(p, sellerMap)),
        heroConfig: resolvedHero,
        experienceSections: (scopedExperience.length ? scopedExperience : []).map(slimBootstrapExperienceSection),
        offerSections: (scopedOffers || []).map(slimBootstrapExperienceSection),
        homeTiles: (homeTiles || []).map((tile) => ({
          _id: tile._id,
          title: tile.title || '',
          image: tile.image || tile.imageUrl || '',
          linkType: tile.linkType || '',
          linkValue: tile.linkValue || '',
          status: tile.status || 'active',
          order: Number(tile.order) || 0,
        })),
        homeHeadings: homeHeadings || { fastFavHeading: 'Fast Fav', moreHeading: 'More' },
        ...zoneMeta,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Bootstrap fetch failed' });
  }
};

// ─── Lean experience endpoint — bina poora getHomeData chalaye ─────────────────
export const getExperienceSectionsLean = async (req, res) => {
  setPrivateCache(res, 30);
  try {
    const pageType = req.query?.pageType || 'home';
    const headerId = req.query?.headerId || null;
    const coords = parseRequestCoords(req);
    const zoneScope = await resolveZoneCatalogScope(coords);
    const zoneMeta = toZoneServiceMeta(zoneScope);
    if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
      console.log('[quick-commerce] /experience incoming', {
        pageType,
        headerId,
        headerIdType: typeof headerId,
      });
    }
    const sections = await getQuickExperienceSections({ pageType, headerId });
    const scoped = filterSectionsByZoneSellers(sections, zoneScope.sellerIds);
    if (process.env.DEBUG_QUICK_EXPERIENCE === 'true') {
      console.log('[quick-commerce] /experience outgoing', {
        count: Array.isArray(scoped) ? scoped.length : 0,
        ids: Array.isArray(scoped) ? scoped.map((s) => String(s?._id)) : [],
        displayTypes: Array.isArray(scoped) ? scoped.map((s) => s?.displayType) : [],
        titles: Array.isArray(scoped) ? scoped.map((s) => s?.title) : [],
      });
    }
    return res.json({ success: true, result: scoped, ...zoneMeta });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch experience sections' });
  }
};

// ─── Lean hero endpoint — bina poora getHomeData chalaye ──────────────────────
export const getHeroConfigLean = async (req, res) => {
  setPublicCache(res, 60); // short TTL so admin hero edits appear quickly
  try {
    const pageType = req.query?.pageType || 'home';
    const headerId = req.query?.headerId || null;
    const heroConfig = await getQuickHeroConfig({ pageType, headerId });
    const resolved = heroConfig
      ? {
          ...heroConfig,
          banners: heroConfig.banners || { items: [] },
          categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
        }
      : { banners: { items: [] }, categoryIds: [] };
    return res.json({ success: true, result: resolved });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch hero config' });
  }
};

// ─── Lean offer-sections endpoint — bina poora getHomeData chalaye ────────────
export const getOfferSectionsLean = async (req, res) => {
  setPrivateCache(res, 30);
  try {
    const coords = parseRequestCoords(req);
    const zoneScope = await resolveZoneCatalogScope(coords);
    const zoneMeta = toZoneServiceMeta(zoneScope);
    const offerSections = await getQuickOfferSections();
    const scoped = filterSectionsByZoneSellers(offerSections, zoneScope.sellerIds);
    return res.json({ success: true, results: scoped || [], ...zoneMeta });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch offer sections' });
  }
};

export const getHomeTilesLean = async (_req, res) => {
  setPublicCache(res, 60);
  try {
    const [homeTiles, homeHeadings] = await Promise.all([
      getQuickHomeTiles({ status: 'active' }),
      getQuickHomeHeadings(),
    ]);
    return res.json({
      success: true,
      results: homeTiles || [],
      headings: homeHeadings || { fastFavHeading: 'Fast Fav', moreHeading: 'More' },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch home tiles' });
  }
};

export const getCoupons = async (req, res) => {
  setNoCache(res);
  try {
    const adminCoupons = await getQuickCoupons();
    let results = (Array.isArray(adminCoupons) ? adminCoupons : []).map((c) => {
      const discountType = String(c.discountType || '').toLowerCase();
      const title =
        discountType === 'percent' || discountType === 'percentage'
          ? `${c.discountValue}% OFF`
          : discountType === 'free_delivery'
            ? 'Free Delivery'
            : `₹${c.discountValue || c.discount || 0} OFF`;
      return {
        ...c,
        id: c._id || c.id,
        code: c.code,
        title: c.title || title,
        description: c.description || title,
        discountType: c.discountType || (discountType === 'free_delivery' ? 'free_delivery' : discountType || 'fixed'),
        discountValue: Number(c.discountValue ?? c.discount ?? 0),
        maxDiscount: Number(c.maxDiscount || c.maxDiscountValue || 0),
        minOrderValue: Number(c.minOrderValue || c.minOrder || 0),
        isSellerCoupon: false,
        couponSource: 'admin',
      };
    });

    const sellerIdParams = []
      .concat(req.query?.sellerId || [])
      .concat(req.query?.sellerIds || [])
      .flatMap((value) => String(value || '').split(','))
      .map((value) => String(value || '').trim())
      .filter((value) => value && value !== 'quick-commerce' && mongoose.Types.ObjectId.isValid(value));

    let uniqueSellerIds = [...new Set(sellerIdParams)];

    // Fallback: resolve sellerIds from productIds when cart lines omit sellerId
    if (uniqueSellerIds.length === 0) {
      const productIdParams = []
        .concat(req.query?.productId || [])
        .concat(req.query?.productIds || [])
        .flatMap((value) => String(value || '').split(','))
        .map((value) => String(value || '').trim().split('::')[0])
        .filter((value) => value && mongoose.Types.ObjectId.isValid(value));

      if (productIdParams.length > 0) {
        const products = await QuickProduct.find({
          _id: { $in: productIdParams.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('sellerId')
          .lean();

        uniqueSellerIds = [
          ...new Set(
            products
              .map((product) => String(product?.sellerId || '').trim())
              .filter((id) => id && mongoose.Types.ObjectId.isValid(id)),
          ),
        ];
      }
    }

    if (uniqueSellerIds.length > 0) {
      const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
      const now = new Date();
      // Fetch approved/active seller coupons, then apply calendar-day validity in JS.
      // Date-only UTC midnight values break Mongo startOfDay comparisons in IST.
      const sellerCoupons = await SellerCoupon.find({
        sellerId: {
          $in: uniqueSellerIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
        status: 'Approved',
        isActive: { $ne: false },
      }).lean();

      const mappedSellerCoupons = sellerCoupons
        .filter((coupon) => isQuickCouponCurrentlyValid(coupon, now))
        .map((c) => {
          const discountType = String(c.discountType || '').toLowerCase();
          const title =
            discountType === 'percent' || discountType === 'percentage'
              ? `${c.discountValue}% OFF`
              : discountType === 'free_delivery'
                ? 'Free Delivery'
                : `₹${c.discountValue} FLAT OFF`;
          return {
            ...c,
            id: c._id,
            code: c.code,
            minOrderValue: c.minOrderValue,
            discountType: c.discountType,
            discountValue: Number(c.discountValue || 0),
            maxDiscount: Number(c.maxDiscount || c.maxDiscountValue || 0),
            title,
            description: c.description || title,
            validTill: c.validTill,
            isSellerCoupon: true,
            couponSource: 'seller',
          };
        });

      results = [...results, ...mappedSellerCoupons];
    }

    return res.json({ success: true, results, result: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
};

export const applyCoupon = async (req, res) => {
  setNoCache(res);
  const { code, cartTotal, items } = req.body;
  const consumerContext = {
    userId: req.user?.userId || req.body?.customerId || req.body?.userId || null,
    sessionId: String(req.headers['x-quick-session'] || req.body?.sessionId || '').trim(),
  };

  if (!code) {
    return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }

  const explicitSource = String(req.body?.couponSource || req.body?.source || '').toLowerCase();

  let coupon = null;

  // 1. Check seller coupon first if not explicitly admin
  if (explicitSource !== 'admin') {
    let sellerId = null;
    if (Array.isArray(items) && items.length > 0) {
      const firstItem = items.find(
        (item) =>
          item.sellerId ||
          item.seller?._id ||
          item.sellerId?._id ||
          item.quickStoreId ||
          item.storeId,
      );
      sellerId =
        firstItem?.sellerId?._id ||
        firstItem?.sellerId ||
        firstItem?.seller?._id ||
        firstItem?.quickStoreId ||
        firstItem?.storeId;
      if (sellerId && typeof sellerId === 'object') {
        sellerId = sellerId._id || sellerId.id || null;
      }
      sellerId = sellerId ? String(sellerId).trim() : null;
      if (sellerId === 'quick-commerce') sellerId = null;
    }

    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      const { SellerCoupon } = await import('../models/sellerCoupon.model.js');
      const now = new Date();
      const sellerCoupon = await SellerCoupon.findOne({
        sellerId: new mongoose.Types.ObjectId(sellerId),
        code: String(code).toUpperCase().trim(),
        status: 'Approved',
        isActive: { $ne: false },
      }).lean();

      if (sellerCoupon && isQuickCouponCurrentlyValid(sellerCoupon, now)) {
        coupon = {
          ...sellerCoupon,
          code: sellerCoupon.code,
          minOrderValue: sellerCoupon.minOrderValue,
          validTill: sellerCoupon.validTill,
          isSellerCoupon: true,
        };
      }
    }
  }

  // 2. Check admin coupon if not found and not explicitly restaurant/seller
  if (!coupon && explicitSource !== 'restaurant' && explicitSource !== 'seller') {
    const adminCoupons = await getQuickCoupons();
    coupon = adminCoupons.find(
      (c) => String(c.code || '').toUpperCase() === String(code).toUpperCase()
    );
  }

  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found or expired' });
  }

  if (coupon.isSellerCoupon) {
    try {
      await assertQuickSellerCouponUsageAvailable(coupon, consumerContext);
    } catch (usageErr) {
      return res.status(400).json({
        success: false,
        message: usageErr?.message || 'This coupon cannot be used right now',
      });
    }
  }

  if (!isQuickCouponCurrentlyValid(coupon)) {
    if (isQuickCouponExpired(coupon)) {
      return res.status(400).json({ success: false, message: 'This coupon has expired' });
    }
    if (isQuickCouponNotStarted(coupon)) {
      return res.status(400).json({ success: false, message: 'This coupon is not active yet' });
    }
    return res.status(400).json({ success: false, message: 'This coupon is not active' });
  }

  const minOrder = Number(coupon.minOrderValue || coupon.minOrder || 0);
  const total = Number(cartTotal || 0);
  if (minOrder > 0 && total < minOrder) {
    return res.status(400).json({
      success: false,
      message: `Minimum order value of ₹${minOrder} required for this coupon`,
    });
  }

  // Calculate discount
  let discountAmount = 0;
  const discountType = String(coupon.discountType || 'flat').toLowerCase();
  const discountValue = Number(coupon.discountValue || coupon.discount || 0);
  const maxDiscount = Number(coupon.maxDiscount || coupon.maxDiscountValue || 0);

  if (discountType === 'free_delivery') {
    discountAmount = 0;
  } else if (discountType === 'percent' || discountType === 'percentage') {
    discountAmount = Math.round((total * discountValue) / 100);
    if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
  } else {
    discountAmount = discountValue;
  }

  discountAmount = Math.min(discountAmount, total);

  return res.json({
    success: true,
    message: `Coupon ${coupon.code} applied successfully!`,
    result: {
      code: coupon.code,
      description: coupon.description,
      title:
        discountType === 'percent' || discountType === 'percentage'
          ? `${discountValue}% OFF`
          : discountType === 'free_delivery'
            ? 'Free Delivery'
            : `₹${discountValue} OFF`,
      discountAmount,
      discountType,
      couponType: String(coupon.couponType || '').toLowerCase(),
      discountValue,
      maxDiscount,
      minOrderValue: minOrder,
      isSellerCoupon: Boolean(coupon.isSellerCoupon),
      couponSource: coupon.isSellerCoupon ? 'seller' : 'admin',
    },
  });
};

export const getOffers = async (_req, res) => {
  setNoCache(res);
  const offers = await getQuickOffers();
  return res.json({ success: true, results: offers });
};

export const getCategories = async (req, res) => {
  // Short TTL: GST/commission rates must not stay stale after admin updates.
  setPublicCache(res, 30);

  const { tree, parentId } = req.query;
  const categories = await getQuickCategories({ parentId });
  const mapped = categories.map(mapCategory);

  if (tree === 'true' || tree === true) {
    // Optimized tree builder using a map instead of recursive filter
    const catMap = {};
    mapped.forEach(cat => {
      cat.children = [];
      catMap[String(cat._id)] = cat;
    });
    
    const root = [];
    mapped.forEach(cat => {
      if (cat.parentId && catMap[String(cat.parentId)]) {
        catMap[String(cat.parentId)].children.push(cat);
      } else {
        root.push(cat);
      }
    });
    return res.json({ success: true, results: root });
  }

  return res.json({ success: true, results: mapped });
};

export const getProducts = async (req, res) => {
  setPrivateCache(res, 30);

  const { categoryId, search, limit, page, sellerId } = req.query;
  const coords = parseRequestCoords(req);
  const zoneScope = await resolveZoneCatalogScope(coords);
  const zoneMeta = toZoneServiceMeta(zoneScope);
  const query = buildZoneProductFilter(publicProductFilter, zoneScope.sellerIds);

  if (!zoneScope.serviceAvailable) {
    const hasPagination = !!req.query.page;
    return res.json({
      success: true,
      result: {
        items: [],
        ...(hasPagination
          ? {
              total: 0,
              page: Math.max(1, parseInt(page, 10) || 1),
              limit: Math.max(1, Math.min(parseInt(limit, 10) || 20, 100)),
              totalPages: 0,
              hasMore: false,
            }
          : {}),
        ...zoneMeta,
      },
    });
  }

  if (categoryId) {
    query.$or = [
      { categoryId: categoryId },
      { subcategoryId: categoryId },
      { headerId: categoryId }
    ];
  }
  if (search) {
    const term = escapeRegex(String(search).trim().slice(0, 80));
    if (term) query.name = { $regex: term, $options: 'i' };
  }
  if (sellerId) {
    query.sellerId = sellerId;
  }

  // Backward compatible pagination
  const hasPagination = !!req.query.page;
  
  let products = [];
  let total = 0;
  let totalPages = 0;
  let hasMore = false;
  let parsedLimit = 50;
  let parsedPage = 1;

  if (hasPagination) {
    parsedPage = Math.max(1, parseInt(page, 10) || 1);
    parsedLimit = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
    const skip = (parsedPage - 1) * parsedLimit;
    
    [products, total] = await Promise.all([
      QuickProduct.find(query).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(parsedLimit).lean(),
      QuickProduct.countDocuments(query)
    ]);
    totalPages = Math.ceil(total / parsedLimit);
    hasMore = parsedPage < totalPages;
  } else {
    parsedLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 50;
    products = await QuickProduct.find(query).sort({ createdAt: -1, _id: -1 }).limit(parsedLimit).lean();
  }

  const sellerMap = await buildSellerMap(products);
  const hasAnyInZone = total > 0 || products.length > 0;
  const hasCategoryOrSearch = Boolean(categoryId || search);
  const effectiveMeta =
    !hasAnyInZone && !hasCategoryOrSearch
      ? {
          ...zoneMeta,
          serviceAvailable: false,
          serviceStatus: 'NO_PRODUCTS',
          message: zoneMeta.message || 'Services not available in your area',
        }
      : zoneMeta;

  const responsePayload = {
    success: true,
    result: {
      items: products.map((product) => mapProduct(product, sellerMap)),
      ...effectiveMeta,
    },
  };

  if (hasPagination) {
    responsePayload.result.total = total;
    responsePayload.result.page = parsedPage;
    responsePayload.result.limit = parsedLimit;
    responsePayload.result.totalPages = totalPages;
    responsePayload.result.hasMore = hasMore;
  }

  return res.json(responsePayload);
};

export const getProductById = async (req, res) => {
  setPrivateCache(res, 30);

  const coords = parseRequestCoords(req);
  const zoneScope = await resolveZoneCatalogScope(coords);
  const zoneMeta = toZoneServiceMeta(zoneScope);

  const product = await QuickProduct.findOne({ _id: req.params.productId, ...publicProductFilter }).lean();

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const inZone =
    zoneScope.serviceAvailable &&
    zoneScope.sellerIds.some((id) => String(id) === String(product.sellerId || ''));

  if (!inZone) {
    return res.status(404).json({
      success: false,
      message: zoneMeta.message || 'Services not available in your area',
      ...zoneMeta,
    });
  }

  const sellerMap = await buildSellerMap([product]);

  return res.json({
    success: true,
    result: mapProduct(product, sellerMap),
    ...zoneMeta,
  });
};

export const getProductReviews = async (req, res) => {
  setPublicCache(res, 300); // 5 minutes cache
  const { productId } = req.params;

  try {
    const reviews = await QuickReview.find({
      productId,
      status: 'approved',
    }).populate('userId', 'name profileImage').sort({ createdAt: -1 }).lean();

    return res.json({
      success: true,
      results: reviews,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
    });
  }
};

export const submitProductReview = async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required to submit a review',
    });
  }

  if (!productId || !rating || !comment) {
    return res.status(400).json({
      success: false,
      message: 'Product ID, rating, and comment are required',
    });
  }

  try {
    const [product, user] = await Promise.all([
      QuickProduct.findById(productId),
      FoodUser.findById(userId).select('name profileImage'),
    ]);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const review = await QuickReview.create({
      productId,
      userId,
      userName: user?.name || 'Customer',
      userAvatar: user?.profileImage || '',
      rating: Number(rating),
      comment: String(comment).trim(),
      status: 'approved', // Auto-approving for now as per simple implementation, or can be 'pending'
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      result: review,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit review',
    });
  }
};

export const getStoreDetails = async (req, res) => {
  setPublicCache(res, 300);
  try {
    const { storeId } = req.params;
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ success: false, message: 'Invalid store ID' });
    }
    const seller = await Seller.findById(storeId).select('_id name shopName location shopInfo.openingHours shopInfo.shopImage').lean();
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Store not found' });
    }
    return res.json({
      success: true,
      result: {
        _id: seller._id,
        id: seller._id,
        name: seller.name || '',
        shopName: seller.shopName || seller.name || 'Store',
        location: seller.location || null,
        shopImage: seller.shopInfo?.shopImage || '',
        openingHours: seller.shopInfo?.openingHours || ''
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch store details' });
  }
};

export const getStores = async (req, res) => {
  setPrivateCache(res, 30);
  try {
    const coords = parseRequestCoords(req);
    const zoneScope = await resolveZoneCatalogScope(coords);
    const zoneMeta = toZoneServiceMeta(zoneScope);

    let query = { approvalStatus: 'approved', isActive: true, accountStatus: 'active' };

    if (zoneScope.serviceAvailable && zoneScope.sellerIds.length > 0) {
      query._id = { $in: zoneScope.sellerIds };
    } else if (!zoneScope.serviceAvailable && (coords.lat !== null || coords.lng !== null)) {
      return res.json({ success: true, results: [], ...zoneMeta });
    }

    const sellers = await Seller.find(query)
      .select('_id name shopName location shopInfo.shopImage shopInfo.openingHours rating')
      .lean();

    return res.json({
      success: true,
      results: sellers.map(seller => ({
        _id: seller._id,
        id: seller._id,
        name: seller.name || '',
        shopName: seller.shopName || seller.name || 'Store',
        location: seller.location || null,
        shopImage: seller.shopInfo?.shopImage || '',
        openingHours: seller.shopInfo?.openingHours || '',
        rating: seller.rating || 0
      })),
      ...zoneMeta
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch stores' });
  }
};
