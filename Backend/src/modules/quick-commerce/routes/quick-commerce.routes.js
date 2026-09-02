import express from "express";
import { upload } from "../../../middleware/upload.js";
import {
  getCategories,
  getCoupons,
  applyCoupon,
  getHomeData,
  getPublicBanners,
  getProductById,
  getProductReviews,
  submitProductReview,
  getProducts,
} from "../controllers/catalog.controller.js";
import {
  addToCart,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "../controllers/cart.controller.js";
import {
  cancelOrder,
  getMyOrders,
  getOrderById,
  placeOrder,
  verifyPayment,
} from "../controllers/order.controller.js";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  toggleWishlist,
} from "../controllers/wishlist.controller.js";
import {
  createSupportTicketController,
  listMySupportTicketsController,
  getAdminSupportTicketsController,
  updateAdminSupportTicketController,
} from "../controllers/support.controller.js";
import {
  approveAdminSellerRequest,
  getAdminSellerRequests,
  createCategory,
  createProduct,
  getAdminCategories,
  getAdminOrders,
  getAdminOrderById,
  processRefund,
  getAdminCustomers,
  getAdminCustomerById,
  deleteAdminOrder,
  getAdminProducts,
  getAdminStats,
  rejectAdminSellerRequest,
  softDeleteAdminSeller,
  getAdminSellerById,
  removeCategory,
  getCategoryDeleteImpact,
  removeProduct,
  updateCategory,
  updateProduct,
  updateAdminSellerProfile,
  getAdminZones,
  getAdminZoneById,
  createAdminZone,
  updateAdminZone,
  deleteAdminZone,
  listPublicZones,
  getAdminFinanceSummary,
  getAdminFinanceLedger,
  getAdminFinancePayouts,
  getAdminSellerWithdrawals,
  getAdminDeliveryWithdrawals,
  updateAdminWithdrawalStatus,
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  getAdminBannersController,
  getAdminBannerByIdController,
  createAdminBannerController,
  updateAdminBannerController,
  toggleAdminBannerStatusController,
  deleteAdminBannerController,
} from "../controllers/admin.controller.js";
import {
  getSellerCommissionBootstrap,
  getSellerCommissions,
  getSellerCommissionById,
  createSellerCommission,
  updateSellerCommission,
  deleteSellerCommission,
  toggleSellerCommissionStatus,
} from "../controllers/adminCommission.controller.js";
import { sellerProfileUpload } from "../seller/routes/seller.routes.js";
import {
  createDeliveryCommissionRule,
  createOrUpdateFeeSettings,
  deleteDeliveryCommissionRule,
  getDeliveryCommissionRules,
  getFeeSettings,
  getPublicBillingSettings,
  toggleDeliveryCommissionRuleStatus,
  updateDeliveryCommissionRule,
} from "../controllers/billing.controller.js";
import {
  geocodeAddress,
  reverseGeocode,
} from "../controllers/location.controller.js";

import { authMiddleware } from "../../../core/auth/auth.middleware.js";
import { requireRoles } from "../../../core/roles/role.middleware.js";
import { verifyAccessToken } from "../../../core/auth/token.util.js";

/**
 * Express 4 does not forward rejected promises from async handlers, so a throw
 * inside one leaves the request hanging until the client times out. Wrapping the
 * handler routes the error to the error middleware and returns a real response.
 */
const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = { userId: decoded.userId, role: decoded.role };
    } catch (e) {
      // ignore guest
    }
  }
  next();
};

const router = express.Router();
const adminOnly = [authMiddleware, requireRoles("ADMIN")];

router.get("/health", (_req, res) =>
  res.json({ success: true, module: "quick-commerce", status: "ok" }),
);

router.get("/home", getHomeData);
router.get("/banners/public", getPublicBanners);
router.get("/coupons", getCoupons);
router.post("/coupons/apply", applyCoupon);
router.get("/categories", getCategories);
router.get("/products", getProducts);
router.get("/products/:productId/reviews", getProductReviews);
router.post("/products/reviews", optionalAuth, submitProductReview);
router.get("/products/:productId", getProductById);
router.get("/zones/public", listPublicZones);
router.get("/billing/settings", getPublicBillingSettings);

// Location endpoints
router.get("/location/geocode", geocodeAddress);
router.get("/location/reverse-geocode", reverseGeocode);

router.get("/cart", optionalAuth, getCart);
router.post("/cart/add", optionalAuth, addToCart);
router.put("/cart/update", optionalAuth, updateCartItem);
router.delete("/cart/remove/:productId", optionalAuth, removeCartItem);
router.delete("/cart/clear", optionalAuth, clearCart);

router.post("/orders", optionalAuth, placeOrder);
router.post("/orders/verify-payment", optionalAuth, verifyPayment);
router.get("/orders", optionalAuth, getMyOrders);
router.get("/orders/:orderId", optionalAuth, getOrderById);
router.post("/orders/:orderId/cancel", optionalAuth, cancelOrder);
router.post("/support/ticket", optionalAuth, createSupportTicketController);
router.get("/support/my-tickets", optionalAuth, listMySupportTicketsController);

router.get("/wishlist", optionalAuth, getWishlist);
router.post("/wishlist/add", optionalAuth, addToWishlist);
router.delete("/wishlist/remove/:productId", optionalAuth, removeFromWishlist);
router.post("/wishlist/toggle", optionalAuth, toggleWishlist);

// Admin endpoints (quick-commerce dashboard)
router.get("/admin/stats", ...adminOnly, getAdminStats);
router.get("/admin/categories", ...adminOnly, wrap(getAdminCategories));
router.post(
  "/admin/categories",
  ...adminOnly,
  upload.single("image"),
  wrap(createCategory),
);
router.put(
  "/admin/categories/:categoryId",
  ...adminOnly,
  upload.single("image"),
  wrap(updateCategory),
);
router.get(
  "/admin/categories/:categoryId/delete-impact",
  ...adminOnly,
  wrap(getCategoryDeleteImpact),
);
router.delete("/admin/categories/:categoryId", ...adminOnly, wrap(removeCategory));
router.get("/admin/products", ...adminOnly, wrap(getAdminProducts));
router.post(
  "/admin/products",
  ...adminOnly,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 8 },
  ]),
  wrap(createProduct),
);
router.put(
  "/admin/products/:productId",
  ...adminOnly,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 8 },
  ]),
  wrap(updateProduct),
);
router.delete("/admin/products/:productId", ...adminOnly, wrap(removeProduct));
router.get("/admin/orders", ...adminOnly, getAdminOrders);
router.get("/admin/orders/:orderId", ...adminOnly, getAdminOrderById);
router.post("/admin/orders/:orderId/refund", ...adminOnly, processRefund);
router.delete("/admin/orders/:orderId", ...adminOnly, deleteAdminOrder);

// Finance (quick-commerce admin wallet & ledger)
router.get("/admin/finance/summary", ...adminOnly, getAdminFinanceSummary);
router.get("/admin/finance/ledger", ...adminOnly, getAdminFinanceLedger);
router.get("/admin/finance/payouts", ...adminOnly, getAdminFinancePayouts);
router.get(
  "/admin/withdrawals/sellers",
  ...adminOnly,
  getAdminSellerWithdrawals,
);
router.get(
  "/admin/withdrawals/delivery",
  ...adminOnly,
  getAdminDeliveryWithdrawals,
);
router.patch(
  "/admin/withdrawals/:withdrawalId",
  ...adminOnly,
  updateAdminWithdrawalStatus,
);
router.get("/admin/customers", ...adminOnly, getAdminCustomers);
router.get("/admin/customers/:id", ...adminOnly, getAdminCustomerById);
router.get(
  "/admin/support-tickets",
  ...adminOnly,
  getAdminSupportTicketsController,
);
router.patch(
  "/admin/support-tickets/:id",
  ...adminOnly,
  updateAdminSupportTicketController,
);
router.get("/admin/seller-requests", ...adminOnly, getAdminSellerRequests);
router.put(
  "/admin/seller-requests/:sellerId/approve",
  ...adminOnly,
  approveAdminSellerRequest,
);
router.put(
  "/admin/seller-requests/:sellerId/reject",
  ...adminOnly,
  rejectAdminSellerRequest,
);
router.put(
  "/admin/seller-requests/:sellerId/profile",
  ...adminOnly,
  sellerProfileUpload,
  updateAdminSellerProfile
);
router.patch(
  "/admin/sellers/:id/soft-delete",
  ...adminOnly,
  softDeleteAdminSeller
);
router.get("/admin/sellers/:id", ...adminOnly, getAdminSellerById);
router.get("/admin/zones", ...adminOnly, getAdminZones);
router.get("/admin/zones/:zoneId", ...adminOnly, getAdminZoneById);
router.post("/admin/zones", ...adminOnly, createAdminZone);
router.patch("/admin/zones/:zoneId", ...adminOnly, updateAdminZone);
router.delete("/admin/zones/:zoneId", ...adminOnly, deleteAdminZone);

// Seller Commission Management
router.get(
  "/admin/seller-commissions/bootstrap",
  ...adminOnly,
  getSellerCommissionBootstrap,
);
router.get("/admin/seller-commissions", ...adminOnly, getSellerCommissions);
router.get(
  "/admin/seller-commissions/:id",
  ...adminOnly,
  getSellerCommissionById,
);
router.post("/admin/seller-commissions", ...adminOnly, createSellerCommission);
router.put(
  "/admin/seller-commissions/:id",
  ...adminOnly,
  updateSellerCommission,
);
router.delete(
  "/admin/seller-commissions/:id",
  ...adminOnly,
  deleteSellerCommission,
);
router.patch(
  "/admin/seller-commissions/:id/toggle-status",
  ...adminOnly,
  toggleSellerCommissionStatus,
);
router.get("/admin/fee-settings", ...adminOnly, getFeeSettings);
router.put("/admin/fee-settings", ...adminOnly, createOrUpdateFeeSettings);
router.get(
  "/admin/delivery/commission-rules",
  ...adminOnly,
  getDeliveryCommissionRules,
);
router.post(
  "/admin/delivery/commission-rules",
  ...adminOnly,
  createDeliveryCommissionRule,
);
router.patch(
  "/admin/delivery/commission-rules/:id",
  ...adminOnly,
  updateDeliveryCommissionRule,
);
router.delete(
  "/admin/delivery/commission-rules/:id",
  ...adminOnly,
  deleteDeliveryCommissionRule,
);
router.patch(
  "/admin/delivery/commission-rules/:id/status",
  ...adminOnly,
  toggleDeliveryCommissionRuleStatus,
);

// Admin Coupon Management
router.get("/admin/coupons", ...adminOnly, getAdminCoupons);
router.post("/admin/coupons", ...adminOnly, createAdminCoupon);
router.put("/admin/coupons/:id", ...adminOnly, updateAdminCoupon);
router.delete("/admin/coupons/:id", ...adminOnly, deleteAdminCoupon);

// Admin Banner Management (Marketing Tools)
router.get("/admin/banners", ...adminOnly, getAdminBannersController);
router.get("/admin/banners/:id", ...adminOnly, getAdminBannerByIdController);
router.post(
  "/admin/banners",
  ...adminOnly,
  upload.single("image"),
  createAdminBannerController
);
router.put(
  "/admin/banners/:id",
  ...adminOnly,
  upload.single("image"),
  updateAdminBannerController
);
router.patch(
  "/admin/banners/:id/status",
  ...adminOnly,
  toggleAdminBannerStatusController
);
router.delete(
  "/admin/banners/:id",
  ...adminOnly,
  deleteAdminBannerController
);

export default router;
