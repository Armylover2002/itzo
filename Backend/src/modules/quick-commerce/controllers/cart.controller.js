import mongoose from 'mongoose';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { Seller } from '../seller/models/seller.model.js';
import { calculateQuickPricing } from '../admin/services/billing.service.js';
import { isStoreCurrentlyOpen, buildShopClosedMessage } from '../utils/timeFormat.helpers.js';
import {
  buildCartLineKey,
  matchProductVariant,
  resolveVariantLabel,
  resolveVariantStock,
  resolveVariantUnitPrice,
  stripCompositeProductId,
} from '../utils/variant.helpers.js';
import {
  assertNoSellerMismatch,
  collectSellerIdsFromProducts,
  resolveProductSellerId,
  SELLER_MISMATCH_CODE,
} from '../utils/singleSeller.helpers.js';

import { publicProductVisibilityFilter } from '../utils/productVisibility.helpers.js';
import { buildQuickCheckoutPreview } from '../services/checkoutPreview.service.js';

const approvedProductFilter = publicProductVisibilityFilter;

const getFirstSellableVariant = (product = {}) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return (
    variants.find((variant) => {
      const name = String(variant?.name || '').trim();
      if (!name || name.toLowerCase() === 'default') {
        return variants.length === 1;
      }
      return true;
    }) || variants[0] || null
  );
};

const resolveIncomingVariantMeta = (product, {
  variantName = '',
  variantKey = '',
  variantSku = '',
  unitPrice = 0,
} = {}) => {
  let name = String(variantName || '').trim();
  let key = String(variantKey || '').trim();
  let sku = String(variantSku || '').trim();

  let matched = matchProductVariant(product, {
    variantName: name,
    variantKey: key,
    variantSku: sku,
  });

  // Card adds without variant → bind to first sellable so PDP merge works
  if (!matched && !name && !key && !sku) {
    matched = getFirstSellableVariant(product);
  }

  if (matched) {
    name = String(matched.name || name || '').trim();
    key = String(matched._id || matched.id || key || name || '').trim();
    sku = String(matched.sku || sku || '').trim();
  }

  return {
    variantName: name,
    variantKey: key,
    variantSku: sku,
    price: Number(unitPrice || 0),
    matched,
  };
};

const findCartItemIndex = (cartItems = [], productId, variantMeta = {}, product = null) => {
  const targetId = String(productId || '');
  const incomingResolved = product
    ? matchProductVariant(product, variantMeta) || variantMeta.matched || null
    : null;
  const incomingKey = String(variantMeta.variantKey || '').trim().toLowerCase();
  const incomingName = String(variantMeta.variantName || '').trim().toLowerCase();

  return cartItems.findIndex((item) => {
    if (String(item.productId) !== targetId) return false;

    const itemKey = String(item.variantKey || '').trim();
    const itemName = String(item.variantName || '').trim();

    // Both empty → same bare product line
    if (!itemKey && !itemName && !incomingKey && !incomingName) return true;

    // Legacy empty line only merges into the product's first sellable variant
    if ((!itemKey && !itemName) && (incomingKey || incomingName)) {
      if (!product) return true;
      const first = getFirstSellableVariant(product);
      if (!first || !incomingResolved) return true;
      return (
        String(first._id || first.id || '').trim() ===
          String(incomingResolved._id || incomingResolved.id || '').trim() ||
        String(first.name || '').trim().toLowerCase() ===
          String(incomingResolved.name || '').trim().toLowerCase()
      );
    }
    // Incoming empty (pre-resolve edge): only match first-sellable named line
    if ((itemKey || itemName) && !incomingKey && !incomingName) {
      if (!product) return true;
      const first = getFirstSellableVariant(product);
      if (!first) return true;
      const itemResolved = matchProductVariant(product, {
        variantKey: itemKey,
        variantName: itemName,
        variantSku: item.variantSku || '',
      });
      if (!itemResolved) return false;
      return (
        String(first._id || first.id || '').trim() ===
          String(itemResolved._id || itemResolved.id || '').trim() ||
        String(first.name || '').trim().toLowerCase() ===
          String(itemResolved.name || '').trim().toLowerCase()
      );
    }

    if (itemKey && incomingKey && itemKey.toLowerCase() === incomingKey) return true;
    if (itemName && incomingName && itemName.toLowerCase() === incomingName) return true;

    if (product && incomingResolved) {
      const itemResolved = matchProductVariant(product, {
        variantKey: itemKey,
        variantName: itemName,
        variantSku: item.variantSku || '',
      });
      if (itemResolved && String(itemResolved._id || itemResolved.id) === String(incomingResolved._id || incomingResolved.id)) {
        return true;
      }
      if (
        itemResolved &&
        String(itemResolved.name || '').trim().toLowerCase() ===
          String(incomingResolved.name || '').trim().toLowerCase()
      ) {
        return true;
      }
    }

    return String(itemKey || itemName).toLowerCase() === String(incomingKey || incomingName);
  });
};

/** Collapse duplicate product+variant rows left by older clients. */
const toPlainCartItem = (item = {}) => {
  const raw = typeof item?.toObject === 'function' ? item.toObject() : item;
  return {
    productId: raw.productId,
    quantity: Number(raw.quantity || 0),
    variantName: String(raw.variantName || '').trim(),
    variantKey: String(raw.variantKey || '').trim(),
    variantSku: String(raw.variantSku || '').trim(),
    unitPrice: Number(raw.unitPrice || 0),
  };
};

const consolidateCartItems = (cartItems = [], productMap = {}) => {
  const merged = [];
  let changed = false;

  for (const rawItem of cartItems) {
    const item = toPlainCartItem(rawItem);
    if (!item.productId) {
      changed = true;
      continue;
    }

    const productId = String(item.productId);
    const product = productMap[productId] || null;
    const variantMeta = resolveIncomingVariantMeta(product || {}, {
      variantName: item.variantName || '',
      variantKey: item.variantKey || '',
      variantSku: item.variantSku || '',
      unitPrice: item.unitPrice || 0,
    });

    const existingIndex = findCartItemIndex(merged, productId, variantMeta, product);
    if (existingIndex >= 0) {
      changed = true;
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        productId: existing.productId,
        quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
        variantKey: existing.variantKey || variantMeta.variantKey || '',
        variantName: existing.variantName || variantMeta.variantName || '',
        variantSku: existing.variantSku || variantMeta.variantSku || '',
        unitPrice: existing.unitPrice || item.unitPrice || variantMeta.price || 0,
      };
      continue;
    }

    const next = {
      productId: item.productId,
      quantity: Math.max(1, Number(item.quantity || 1)),
      variantKey: variantMeta.variantKey || item.variantKey || '',
      variantName: variantMeta.variantName || item.variantName || '',
      variantSku: variantMeta.variantSku || item.variantSku || '',
      unitPrice: item.unitPrice || variantMeta.price || 0,
    };
    if (
      next.variantKey !== item.variantKey ||
      next.variantName !== item.variantName ||
      next.variantSku !== item.variantSku
    ) {
      changed = true;
    }
    merged.push(next);
  }

  if (merged.length !== cartItems.length) changed = true;
  return { items: merged, changed };
};

const resolveId = (req) => {
  if (req.user?.userId) return { userId: req.user.userId };
  const sessionId = String(req.headers['x-quick-session'] || req.query.sessionId || req.body.sessionId || '').trim();
  return sessionId ? { sessionId } : null;
};

const buildCartInsertDoc = (idQuery) => {
  if (!idQuery) return { items: [] };
  if (idQuery.userId) {
    return {
      userId: idQuery.userId,
      sessionId: `user:${String(idQuery.userId)}`,
      items: [],
    };
  }
  return {
    sessionId: String(idQuery.sessionId || '').trim(),
    items: [],
  };
};

const mapCart = async (idQuery) => {
  const cart = await QuickCart.findOne(idQuery);
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return { items: [], subtotal: 0, total: 0 };
  }

  const productIds = cart.items
    .map((item) => item.productId)
    .filter((id) => mongoose.isValidObjectId(id));

  const products = await QuickProduct.find({ _id: { $in: productIds }, ...approvedProductFilter }).lean();
  const productMap = products.reduce((acc, product) => {
    acc[String(product._id)] = product;
    return acc;
  }, {});

  const { items: consolidatedItems, changed } = consolidateCartItems(cart.items, productMap);
  if (changed) {
    cart.set('items', consolidatedItems);
    cart.markModified('items');
    await cart.save();
  }

  const items = consolidatedItems
    .map((item) => {
      const product = productMap[String(item.productId)];
      if (!product) return null;

      const variantMeta = {
        variantName: item.variantName || '',
        variantKey: item.variantKey || '',
        variantSku: item.variantSku || '',
        price: Number(item.unitPrice || 0),
      };
      const unitPrice = resolveVariantUnitPrice(product, variantMeta);
      const mrp = Number(product.mrp || product.price || unitPrice || 0);
      const variantLabel = resolveVariantLabel(product, variantMeta);
      const lineKey = buildCartLineKey(
        product._id,
        variantMeta.variantKey,
        variantMeta.variantName,
      );

      return {
        id: lineKey,
        productId: String(product._id),
        categoryId: product.categoryId ? String(product.categoryId) : null,
        subcategoryId: product.subcategoryId ? String(product.subcategoryId) : null,
        headerId: product.headerId ? String(product.headerId) : null,
        name: product.name,
        image: product.mainImage || product.image || '',
        mainImage: product.mainImage || product.image || '',
        price: unitPrice,
        // Line sale must follow variant unit price — product.salePrice is not the cart line price
        salePrice: unitPrice,
        mrp,
        originalPrice: Math.max(mrp, unitPrice),
        unit: product.unit,
        stock: resolveVariantStock(product, variantMeta),
        quantity: item.quantity,
        lineTotal: item.quantity * unitPrice,
        variantName: variantLabel,
        variantKey: variantMeta.variantKey,
        variantSku: variantMeta.variantSku,
        sellerId: product.sellerId ? String(product.sellerId) : '',
        quickStoreId: product.sellerId ? String(product.sellerId) : '',
        selectedVariant: variantLabel
          ? {
              name: variantLabel,
              sku: variantMeta.variantSku,
              _id: variantMeta.variantKey,
              price: unitPrice,
              salePrice: unitPrice,
              stock: resolveVariantStock(product, variantMeta),
            }
          : null,
        packingFee: Number(product.packingFee || 0),
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalPackingFee = items.reduce((acc, item) => acc + (item.packingFee * item.quantity), 0);
  const { pricing } = await calculateQuickPricing({
    subtotal,
    products,
    packagingFee: totalPackingFee,
    items: items.map((item) => ({
      productId: item.productId,
      price: item.price,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  });

  return {
    items,
    subtotal,
    deliveryFee: Number(pricing?.deliveryFee || 0),
    handlingFee: Number(pricing?.handlingFee || 0),
    packagingFee: Number(pricing?.packagingFee || 0),
    platformFee: Number(pricing?.platformFee || 0),
    tax: Number(pricing?.tax || 0),
    gst: Number(pricing?.gst || 0),
    total: Number(pricing?.total || subtotal),
  };
};

export const getCart = async (req, res) => {
  const idQuery = resolveId(req);

  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  const cart = await mapCart(idQuery);
  return res.json({ success: true, result: cart });
};

export const addToCart = async (req, res) => {
  const idQuery = resolveId(req);
  const productId = stripCompositeProductId(req.body.productId);
  const quantity = Number(req.body.quantity || 1);
  const variantName = String(req.body.variantName || req.body.selectedVariant?.name || '').trim();
  const variantKey = String(
    req.body.variantKey ||
      req.body.selectedVariant?._id ||
      req.body.selectedVariant?.id ||
      '',
  ).trim();
  const variantSku = String(req.body.variantSku || req.body.selectedVariant?.sku || '').trim();
  const unitPrice = Number(req.body.price || req.body.unitPrice || 0);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  // Check seller opening hours (onboarding openingHours, AM/PM or 24h)
  const sellerId = product.sellerId;
  if (sellerId && mongoose.isValidObjectId(sellerId)) {
    const seller = await Seller.findById(sellerId).select('shopInfo.openingHours').lean();
    if (seller) {
      const openingHours = seller.shopInfo?.openingHours || '';
      if (!isStoreCurrentlyOpen(openingHours)) {
        return res.status(400).json({
          success: false,
          code: 'SHOP_CLOSED',
          message: buildShopClosedMessage(openingHours),
        });
      }
    }
  }

  const variantMeta = resolveIncomingVariantMeta(product, {
    variantName,
    variantKey,
    variantSku,
    unitPrice,
  });
  const availableStock = resolveVariantStock(product, variantMeta);
  const resolvedUnitPrice = resolveVariantUnitPrice(product, variantMeta);

  const cart = await QuickCart.findOneAndUpdate(
    idQuery,
    { $setOnInsert: buildCartInsertDoc(idQuery) },
    { upsert: true, new: true }
  );

  const itemIndex = findCartItemIndex(cart.items, productId, variantMeta, product);
  const currentQty = itemIndex >= 0 ? cart.items[itemIndex].quantity : 0;
  const targetQty = currentQty + Math.max(1, quantity);

  if (targetQty > availableStock) {
    return res.status(400).json({
      success: false,
      message: `Only ${availableStock} items are available in stock.`,
    });
  }

  if (itemIndex < 0 && cart.items.length > 0) {
    const existingProductIds = cart.items
      .map((item) => item.productId)
      .filter((id) => mongoose.isValidObjectId(id));
    const existingProducts = existingProductIds.length
      ? await QuickProduct.find({ _id: { $in: existingProductIds } })
          .select('sellerId')
          .lean()
      : [];
    const existingSellerIds = collectSellerIdsFromProducts(existingProducts);
    try {
      assertNoSellerMismatch(existingSellerIds, resolveProductSellerId(product));
    } catch (error) {
      return res.status(400).json({
        success: false,
        code: error.code || SELLER_MISMATCH_CODE,
        message: error.message,
      });
    }
  }

  if (itemIndex >= 0) {
    cart.items[itemIndex].quantity = targetQty;
    cart.items[itemIndex].unitPrice = resolvedUnitPrice;
    // Upgrade legacy empty-variant rows to canonical keys
    if (!cart.items[itemIndex].variantKey && variantMeta.variantKey) {
      cart.items[itemIndex].variantKey = variantMeta.variantKey;
    }
    if (!cart.items[itemIndex].variantName && variantMeta.variantName) {
      cart.items[itemIndex].variantName = variantMeta.variantName;
    }
    if (!cart.items[itemIndex].variantSku && variantMeta.variantSku) {
      cart.items[itemIndex].variantSku = variantMeta.variantSku;
    }
  } else {
    cart.items.push({
      productId,
      quantity: Math.max(1, quantity),
      variantName: variantMeta.variantName,
      variantKey: variantMeta.variantKey,
      variantSku: variantMeta.variantSku,
      unitPrice: resolvedUnitPrice,
    });
  }

  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const updateCartItem = async (req, res) => {
  const idQuery = resolveId(req);
  const productId = stripCompositeProductId(req.body.productId);
  const rawVariantName = String(req.body.variantName || '').trim();
  const rawVariantKey = String(req.body.variantKey || '').trim();
  const { quantity } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const qty = Number(quantity);
  const cart = await QuickCart.findOne(idQuery);

  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  const variantMeta = resolveIncomingVariantMeta(product || {}, {
    variantName: rawVariantName,
    variantKey: rawVariantKey,
  });

  const itemIndex = findCartItemIndex(cart.items, productId, variantMeta, product);
  if (itemIndex < 0) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const cartItem = cart.items[itemIndex];
    const stockMeta = {
      variantName: cartItem.variantName || variantMeta.variantName,
      variantKey: cartItem.variantKey || variantMeta.variantKey,
      variantSku: cartItem.variantSku || variantMeta.variantSku || '',
      price: Number(cartItem.unitPrice || 0),
    };
    const availableStock = resolveVariantStock(product, stockMeta);
    const targetQty = Math.floor(qty);
    if (targetQty > availableStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${availableStock} items are available in stock.`,
      });
    }
    cart.items[itemIndex].quantity = targetQty;
    if (!cart.items[itemIndex].variantKey && variantMeta.variantKey) {
      cart.items[itemIndex].variantKey = variantMeta.variantKey;
    }
    if (!cart.items[itemIndex].variantName && variantMeta.variantName) {
      cart.items[itemIndex].variantName = variantMeta.variantName;
    }
  }

  await cart.save();
  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const removeCartItem = async (req, res) => {
  const idQuery = resolveId(req);
  const productId = stripCompositeProductId(req.params.productId);
  const variantKey = String(req.query.variantKey || '').trim();
  const variantName = String(req.query.variantName || '').trim();

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const cart = await QuickCart.findOne(idQuery);
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const product = await QuickProduct.findOne({ _id: productId }).select('variants').lean();
  const variantMeta = resolveIncomingVariantMeta(product || {}, {
    variantName,
    variantKey,
  });
  const removeIndex = findCartItemIndex(cart.items, productId, variantMeta, product);
  if (removeIndex >= 0) {
    cart.items.splice(removeIndex, 1);
  }

  await cart.save();
  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const clearCart = async (req, res) => {
  const idQuery = resolveId(req);
  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  // Never put `items` in both $set and $setOnInsert — Mongo throws
  // "Updating the path 'items' would create a conflict at 'items'".
  const insertDoc = buildCartInsertDoc(idQuery);
  const { items: _ignoredItems, ...insertWithoutItems } = insertDoc || {};

  await QuickCart.findOneAndUpdate(
    idQuery,
    {
      $set: { items: [] },
      ...(Object.keys(insertWithoutItems).length
        ? { $setOnInsert: insertWithoutItems }
        : {}),
    },
    { upsert: true, new: true }
  );
  return res.json({
    success: true,
    result: {
      items: [],
      subtotal: 0,
      deliveryFee: 0,
      handlingFee: 0,
      tax: 0,
      gst: 0,
      total: 0,
    },
  });
};

/**
 * Server-authoritative cart/checkout bill preview.
 * Body: { latitude?, longitude?, couponCode?, couponSource? }
 */
export const previewCheckout = async (req, res) => {
  try {
    const idQuery = resolveId(req);
    if (!idQuery) {
      return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
    }

    const result = await buildQuickCheckoutPreview({
      idQuery,
      latitude: req.body?.latitude ?? req.body?.lat ?? req.query?.latitude ?? req.query?.lat,
      longitude: req.body?.longitude ?? req.body?.lng ?? req.query?.longitude ?? req.query?.lng,
      couponCode: req.body?.couponCode || req.query?.couponCode || null,
      couponSource: req.body?.couponSource || req.body?.source || null,
    });

    return res.json({ success: true, result });
  } catch (error) {
    const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to preview checkout pricing',
    });
  }
};

