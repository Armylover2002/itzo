import mongoose from 'mongoose';
import { QuickProduct } from '../models/product.model.js';
import { QuickWishlist } from '../models/wishlist.model.js';

const approvedProductFilter = {
  $or: [
    { isActive: true },
    { isActive: { $exists: false } },
    { status: 'active' },
  ],
  $and: [
    {
      $or: [
        { approvalStatus: { $exists: false } },
        { approvalStatus: 'approved' },
      ],
    },
  ],
};

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = String(req.headers['x-quick-session'] || req.query.sessionId || req.body.sessionId || '').trim();
  return sessionId ? { sessionId } : null;
};

const parseIdsOnly = (value) => String(value).trim().toLowerCase() === 'true';

const normalizeVariantId = (value) => String(value ?? '').trim();

const sameItem = (item, productId, variantId) =>
  String(item.productId) === String(productId) && normalizeVariantId(item.variantId) === variantId;

const getWishlistDocument = async (idQuery) =>
  QuickWishlist.findOneAndUpdate(
    idQuery,
    { $setOnInsert: { ...idQuery, items: [] } },
    { upsert: true, new: true }
  );

const buildWishlistResponse = async (wishlistDoc, { idsOnly = false } = {}) => {
  const items = Array.isArray(wishlistDoc?.items)
    ? wishlistDoc.items.filter((item) => mongoose.isValidObjectId(item.productId))
    : [];

  if (idsOnly || items.length === 0) {
    return {
      id: wishlistDoc?._id || null,
      products: items.map((item) => ({
        id: String(item.productId),
        _id: String(item.productId),
        variantId: normalizeVariantId(item.variantId),
      })),
    };
  }

  const productIds = [...new Set(items.map((item) => String(item.productId)))];
  const products = await QuickProduct.find({
    _id: { $in: productIds },
    ...approvedProductFilter,
  }).lean();

  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  // One entry per (product, variant) pair — a product liked under two
  // different variants shows up as two distinct wishlist rows, each carrying
  // its own variantId/variantName so the UI can tell them apart.
  const result = items
    .map((item) => {
      const product = productMap[String(item.productId)];
      if (!product) return null;
      const variantId = normalizeVariantId(item.variantId);
      const variant = variantId
        ? (product.variants || []).find((v) => String(v._id) === variantId || v.name === variantId)
        : null;
      return {
        ...product,
        variantId,
        variantName: variant?.name || '',
      };
    })
    .filter(Boolean);

  return {
    id: wishlistDoc?._id || null,
    products: result,
  };
};

export const getWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const result = await buildWishlistResponse(wishlist, { idsOnly: parseIdsOnly(req.query.idsOnly) });
  return res.json({ success: true, result });
};

export const addToWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId, variantId } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const vId = normalizeVariantId(variantId);
  const alreadySaved = wishlist.items.some((item) => sameItem(item, productId, vId));
  if (!alreadySaved) {
    wishlist.items.push({ productId, variantId: vId });
    await wishlist.save();
  }

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};

export const removeFromWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.params;
  const variantId = normalizeVariantId(req.query.variantId ?? req.body?.variantId);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  wishlist.items = wishlist.items.filter((item) => !sameItem(item, productId, variantId));
  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};

export const toggleWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId, variantId } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const vId = normalizeVariantId(variantId);
  const existingIndex = wishlist.items.findIndex((item) => sameItem(item, productId, vId));

  if (existingIndex >= 0) {
    wishlist.items.splice(existingIndex, 1);
  } else {
    wishlist.items.push({ productId, variantId: vId });
  }

  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};
