import mongoose from 'mongoose';
import { QuickProduct } from '../models/product.model.js';
import { QuickWishlist } from '../models/wishlist.model.js';
import { publicProductVisibilityFilter } from '../utils/productVisibility.helpers.js';
import {
  attachWishlistVariantToProduct,
  extractWishlistProductIds,
  findWishlistEntry,
  normalizeWishlistEntries,
  parseWishlistVariantMeta,
  removeWishlistEntry,
  upsertWishlistEntry,
} from '../utils/wishlist.helpers.js';

const approvedProductFilter = publicProductVisibilityFilter;

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

const getWishlistDocumentReadOnly = async (idQuery) =>
  QuickWishlist.findOne(idQuery).lean();

const buildWishlistResponse = async (wishlistDoc, { idsOnly = false, sellerIds = null } = {}) => {
  const entries = normalizeWishlistEntries(wishlistDoc?.products);
  const productIds = extractWishlistProductIds(entries);

  if (idsOnly) {
    return {
      id: wishlistDoc?._id || null,
      products: entries.map((entry) => ({
        productId: String(entry.productId),
        variantKey: entry.variantKey || '',
        variantName: entry.variantName || '',
        variantSku: entry.variantSku || '',
      })),
    };
  }

  if (!productIds.length) {
    return {
      id: wishlistDoc?._id || null,
      products: [],
    };
  }

  const query = {
    _id: { $in: productIds },
    ...approvedProductFilter,
  };
  if (Array.isArray(sellerIds)) {
    query.sellerId = sellerIds.length ? { $in: sellerIds } : { $in: [] };
  }

  const products = await QuickProduct.find(query).lean();
  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  return {
    id: wishlistDoc?._id || null,
    products: entries
      .map((entry) => {
        const product = productMap[String(entry.productId)];
        if (!product) return null;
        return attachWishlistVariantToProduct(product, entry);
      })
      .filter(Boolean),
  };
};

export const getWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  let sellerIds = null;
  const lat = Number(req.query?.lat ?? req.query?.latitude);
  const lng = Number(req.query?.lng ?? req.query?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const { resolveZoneCatalogScope } = await import('../services/zoneCatalogScope.service.js');
    const scope = await resolveZoneCatalogScope({ lat, lng });
    sellerIds = scope.sellerIds || [];
  }

  const wishlist = await getWishlistDocumentReadOnly(idQuery);
  const result = await buildWishlistResponse(wishlist, {
    idsOnly: parseIdsOnly(req.query.idsOnly),
    sellerIds,
  });
  return res.json({ success: true, result });
};

export const addToWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.body;
  const variantMeta = parseWishlistVariantMeta(req.body);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const entries = normalizeWishlistEntries(wishlist.products);
  wishlist.products = upsertWishlistEntry(entries, productId, variantMeta);
  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};

export const removeFromWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.params;
  const variantMeta = parseWishlistVariantMeta(req.query || {});

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const entries = normalizeWishlistEntries(wishlist.products);
  const hasVariantHint =
    variantMeta.variantKey || variantMeta.variantName || variantMeta.variantSku;
  wishlist.products = removeWishlistEntry(
    entries,
    productId,
    hasVariantHint ? variantMeta : null,
  );
  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};

export const toggleWishlist = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.body;
  const variantMeta = parseWishlistVariantMeta(req.body);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const wishlist = await getWishlistDocument(idQuery);
  const entries = normalizeWishlistEntries(wishlist.products);
  const existing = findWishlistEntry(entries, productId, variantMeta);

  if (existing) {
    wishlist.products = removeWishlistEntry(entries, productId, variantMeta);
  } else {
    wishlist.products = upsertWishlistEntry(entries, productId, variantMeta);
  }

  await wishlist.save();

  const result = await buildWishlistResponse(wishlist, { idsOnly: false });
  return res.json({ success: true, result });
};
