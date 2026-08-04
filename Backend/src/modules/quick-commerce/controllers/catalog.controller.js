import { QuickCategory } from '../models/category.model.js';
import { QuickProduct } from '../models/product.model.js';
import { QuickReview } from '../models/review.model.js';
import { FoodUser } from '../../../core/users/user.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { ensureQuickCommerceSeedData } from '../services/seed.service.js';
import {
  getQuickCategories,
  getQuickCoupons,
  getQuickExperienceSections,
  getQuickHeroConfig,
  getQuickOfferSections,
  getQuickOffers,
  getQuickSettings,
} from '../services/content.service.js';

const setNoCache = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

const setPublicCache = (res, maxAge = 300) => {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
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

const publicProductFilter = {
  $and: [
    approvedOrLegacyFilter,
    {
      $or: [
        { status: 'active' },
        { status: { $exists: false } },
        { isActive: true },
        { isActive: { $exists: false } },
      ],
    },
  ],
};

const mapCategory = (category) => ({
  id: category._id,
  _id: category._id,
  name: category.name,
  slug: category.slug,
  image: category.image,
  status: category.status || (category.isActive ? 'active' : 'inactive'),
  type: category.type || 'header',
  parentId: category.parentId || null,
  iconId: category.iconId || '',
  headerColor: category.headerColor || category.accentColor,
  handlingFees: Number(category.handlingFees || 0),
  adminCommission: Number(category.adminCommission || 0),
  color: category.accentColor,
  approvalStatus: category.approvalStatus || 'approved',
});

const buildSellerMap = async (products = []) => {
  const sellerIds = [...new Set(
    products
      .map((product) => String(product?.sellerId || '').trim())
      .filter(Boolean)
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

const mapProduct = (product, sellerMap = {}) => {
  const seller = sellerMap[String(product?.sellerId || '')] || null;
  return ({
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
  salePrice: product.salePrice || 0,
  originalPrice: product.mrp,
  weight: product.unit,
  unit: product.unit,
  stock: Number(product.stock || 0),
  status: product.status || (product.isActive ? 'active' : 'inactive'),
  brand: product.brand || '',
  description: product.description || '',
  tags: Array.isArray(product.tags) ? product.tags : [],
  variants: Array.isArray(product.variants) ? product.variants : [],
  deliveryTime: product.deliveryTime,
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
      }
    : null,
  storeName: seller?.shopName || seller?.name || '',
  restaurantName: seller?.shopName || seller?.name || '',
});
};

export const getHomeData = async (req, res) => {
  setPublicCache(res, 60); // 1 minute cache
  await ensureQuickCommerceSeedData();

  const pageType = req.query?.pageType || 'home';
  const headerId = req.query?.headerId || null;

  const [categories, products, settings, heroConfig, experienceSections, offerSections] = await Promise.all([
    getQuickCategories(),
    QuickProduct.find(publicProductFilter).sort({ createdAt: -1 }).limit(18).lean(),
    getQuickSettings(),
    getQuickHeroConfig({ pageType, headerId }),
    getQuickExperienceSections({ pageType, headerId }),
    getQuickOfferSections(),
  ]);
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

  const fallbackSections = [
    {
      _id: 'best-sellers-section',
      title: 'Best Sellers',
      displayType: 'products',
      config: {
        products: {
          productIds: products.slice(0, 6).map((product) => String(product._id)),
          rows: 1,
          columns: 2,
          singleRowScrollable: true,
        },
      },
    },
  ];

  const resolvedHero = heroConfig
    ? {
        ...heroConfig,
        banners: heroConfig.banners || { items: [] },
        categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
      }
    : fallbackHero;

  const resolvedSections = experienceSections.length ? experienceSections : fallbackSections;

  const homeData = {
    settings: settings || {},
    categories: categories.map(mapCategory),
    bestSellers: products.map((product) => mapProduct(product, sellerMap)),
    hero: resolvedHero,
    sections: resolvedSections,
    offerSections,
  };

  return res.json({
    success: true,
    result: homeData,
  });
};

export const getExperienceOnly = async (req, res) => {
  setPublicCache(res, 60);
  const pageType = req.query?.pageType || 'home';
  const headerId = req.query?.headerId || null;
  const sections = await getQuickExperienceSections({ pageType, headerId });
  const fallbackSections = [
    {
      _id: 'best-sellers-section',
      title: 'Best Sellers',
      displayType: 'products',
      config: { products: { productIds: [], rows: 1, columns: 2, singleRowScrollable: true } },
    },
  ];
  return res.json({ success: true, result: sections.length ? sections : fallbackSections });
};

export const getHeroOnly = async (req, res) => {
  setPublicCache(res, 60);
  const pageType = req.query?.pageType || 'home';
  const headerId = req.query?.headerId || null;
  const heroConfig = await getQuickHeroConfig({ pageType, headerId });
  const fallbackHero = {
    title: 'Blinkit style quick delivery',
    subtitle: 'Groceries delivered in minutes',
    banners: { items: [{ imageUrl: '/assets/ExperienceBanner.png', title: '', subtitle: '', linkType: 'none', linkValue: '', status: 'active' }] },
    categoryIds: [],
  };
  const resolvedHero = heroConfig
    ? {
        ...heroConfig,
        banners: heroConfig.banners || { items: [] },
        categoryIds: Array.isArray(heroConfig.categoryIds) ? heroConfig.categoryIds : [],
      }
    : fallbackHero;
  return res.json({ success: true, result: resolvedHero });
};

export const getOfferSectionsOnly = async (_req, res) => {
  setPublicCache(res, 60);
  const offerSections = await getQuickOfferSections();
  return res.json({ success: true, results: offerSections || [] });
};

export const getCoupons = async (_req, res) => {
  setNoCache(res);
  const coupons = await getQuickCoupons();
  
  const now = new Date();
  const validCoupons = coupons.filter(c => {
    if (c.validTill && new Date(c.validTill) < now) return false;
    if (c.validFrom && new Date(c.validFrom) > now) return false;
    return true;
  });

  return res.json({ success: true, results: validCoupons });
};

export const applyCoupon = async (req, res) => {
  setNoCache(res);
  const { code, cartTotal } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, message: 'Coupon code is required' });
  }

  const coupons = await getQuickCoupons();
  const coupon = coupons.find(
    (c) => String(c.code || '').toUpperCase() === String(code).toUpperCase()
  );

  if (!coupon) {
    return res.status(404).json({ success: false, message: 'Coupon not found or expired' });
  }

  const now = new Date();
  if (coupon.validTill && new Date(coupon.validTill) < now) {
    return res.status(400).json({ success: false, message: 'This coupon has expired' });
  }

  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    return res.status(400).json({ success: false, message: 'This coupon is not active yet' });
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

  if (discountType === 'percent' || discountType === 'percentage') {
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
      discountAmount,
      discountType,
      discountValue,
    },
  });
};

export const getOffers = async (_req, res) => {
  setNoCache(res);
  const offers = await getQuickOffers();
  return res.json({ success: true, results: offers });
};

export const getCategories = async (req, res) => {
  setPublicCache(res, 300); // 5 minutes cache
  await ensureQuickCommerceSeedData();

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
  setPublicCache(res, 60);
  await ensureQuickCommerceSeedData();

  const { categoryId, search, limit, sortBy } = req.query;
  const query = { ...publicProductFilter };

  if (categoryId) {
    query.$or = [
      { categoryId: categoryId },
      { subcategoryId: categoryId },
      { headerId: categoryId }
    ];
  }
  if (search) query.name = { $regex: String(search).trim(), $options: 'i' };

  const parsedLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 50;
  
  let sortOption = { createdAt: -1 };
  if (sortBy === 'price_asc') {
      sortOption = { price: 1, createdAt: -1 };
  }
  
  const products = await QuickProduct.find(query).sort(sortOption).limit(parsedLimit).lean();
  const sellerMap = await buildSellerMap(products);

  return res.json({
    success: true,
    result: {
      items: products.map((product) => mapProduct(product, sellerMap)),
    },
  });
};

export const getProductById = async (req, res) => {
  setPublicCache(res, 600); // 10 minutes cache
  await ensureQuickCommerceSeedData();

  const product = await QuickProduct.findOne({ _id: req.params.productId, ...publicProductFilter }).lean();

  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const sellerMap = await buildSellerMap([product]);

  return res.json({ success: true, result: mapProduct(product, sellerMap) });
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

