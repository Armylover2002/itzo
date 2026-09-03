import mongoose from 'mongoose';
import { QuickCart } from '../models/cart.model.js';
import { QuickProduct } from '../models/product.model.js';
import { calculateQuickPricing } from '../admin/services/billing.service.js';

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
  const cart = await QuickCart.findOne(idQuery).lean();
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

  const items = cart.items
    .map((item) => {
      const product = productMap[String(item.productId)];
      if (!product) return null;
      const unitPrice =
        Number(product.salePrice || 0) > 0
          ? Number(product.salePrice)
          : Number(product.price || 0);
      const mrp = Number(product.mrp || product.price || unitPrice || 0);

      return {
        id: String(product._id),
        productId: String(product._id),
        categoryId: product.categoryId ? String(product.categoryId) : null,
        subcategoryId: product.subcategoryId ? String(product.subcategoryId) : null,
        headerId: product.headerId ? String(product.headerId) : null,
        name: product.name,
        image: product.mainImage || product.image || '',
        mainImage: product.mainImage || product.image || '',
        price: unitPrice,
        salePrice: Number(product.salePrice || 0),
        mrp,
        originalPrice: mrp,
        unit: product.unit,
        quantity: item.quantity,
        lineTotal: item.quantity * unitPrice,
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const { pricing } = await calculateQuickPricing({
    subtotal,
    products,
  });

  return {
    items,
    subtotal,
    deliveryFee: Number(pricing?.deliveryFee || 0),
    handlingFee: Number(pricing?.platformFee || 0),
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
  const { productId } = req.body;
  const quantity = Number(req.body.quantity || 1);

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const product = await QuickProduct.findOne({ _id: productId, ...approvedProductFilter }).lean();
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const cart = await QuickCart.findOneAndUpdate(
    idQuery,
    { $setOnInsert: buildCartInsertDoc(idQuery) },
    { upsert: true, new: true }
  );

  const itemIndex = cart.items.findIndex((item) => String(item.productId) === String(productId));
  if (itemIndex >= 0) {
    cart.items[itemIndex].quantity = Math.max(1, cart.items[itemIndex].quantity + Math.max(1, quantity));
  } else {
    cart.items.push({ productId, quantity: Math.max(1, quantity) });
  }

  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const updateCartItem = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId, quantity } = req.body;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const qty = Number(quantity);
  const cart = await QuickCart.findOne(idQuery);

  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  const itemIndex = cart.items.findIndex((item) => String(item.productId) === String(productId));
  if (itemIndex < 0) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }

  if (!Number.isFinite(qty) || qty <= 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    cart.items[itemIndex].quantity = Math.floor(qty);
  }

  await cart.save();
  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const removeCartItem = async (req, res) => {
  const idQuery = resolveId(req);
  const { productId } = req.params;

  if (!idQuery || !productId) {
    return res.status(400).json({ success: false, message: 'sessionId/userId and productId are required' });
  }

  const cart = await QuickCart.findOne(idQuery);
  if (!cart) {
    return res.status(404).json({ success: false, message: 'Cart not found' });
  }

  cart.items = cart.items.filter((item) => String(item.productId) !== String(productId));
  await cart.save();

  const result = await mapCart(idQuery);
  return res.json({ success: true, result });
};

export const clearCart = async (req, res) => {
  const idQuery = resolveId(req);
  if (!idQuery) {
    return res.status(400).json({ success: false, message: 'sessionId or userId is required' });
  }

  await QuickCart.findOneAndUpdate(
    idQuery,
    {
      $set: { items: [] },
      $setOnInsert: buildCartInsertDoc(idQuery),
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

