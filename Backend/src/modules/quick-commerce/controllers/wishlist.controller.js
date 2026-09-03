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

const getWishlistDocument = async (idQuery) =>
  QuickWishlist.findOneAndUpdate(
    idQuery,
    { $setOnInsert: { ...idQuery, products: [] } },
    { upsert: true, new: true }
  );

const buildWishlistResponse = async (wishlistDoc, { idsOnly = false } = {}) => {
  const productIds = Array.isArray(wishlistDoc?.products)
    ? wishlistDoc.products.map((id) => String(id)).filter((id) => mongoose.isValidObjectId(id))
    : [];

  if (idsOnly || productIds.length === 0) {
    return {
      id: wishlistDoc?._id || null,
      products: productIds,
    };
  }

  const products = await QuickProduct.find({
    _id: { $in: productIds },
    ...approvedProductFilter,
  }).lean();

  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  return {
    id: wishlistDoc?._id || null,
    products: productIds.map((productId) => productMap[productId]).filter(Boolean),
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
  const { productId } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const nextIds = new Set(wishlist.products.map((id) => String(id)));
  nextIds.add(String(productId));
  wishlist.products = [...nextIds];
  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};

export const removeFromWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.params;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  wishlist.products = wishlist.products.filter((id) => String(id) !== String(productId));
  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};

export const toggleWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const currentIds = wishlist.products.map((id) => String(id));

  if (currentIds.includes(String(productId))) {
    wishlist.products = wishlist.products.filter((id) => String(id) !== String(productId));
  } else {
    wishlist.products = [...wishlist.products, productId];
  }

  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};
