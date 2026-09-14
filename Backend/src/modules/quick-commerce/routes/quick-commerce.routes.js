import express from "express";
import faqRoutes from "./faq.routes.js";
import { upload } from "../../../middleware/upload.js";
import {
  getCategories,
  getCoupons,
  applyCoupon,
  getHomeData,
  getBootstrapData,
  getExperienceSectionsLean,
  getHeroConfigLean,
  getOfferSectionsLean,
  getHomeTilesLean,
  getOffers,
  getProductById,
  getProductReviews,
  submitProductReview,
  getProducts,
  getStores,
  getStoreDetails,
} from "../controllers/catalog.controller.js";
import {
  addToCart,
  clearCart,
  getCart,
  previewCheckout,
  removeCartItem,
  updateCartItem,
} from "../controllers/cart.controller.js";
import {
  cancelOrder,
  getMyOrders,
  getOrderById,
  placeOrder,
  verifyPayment,
  submitOrderRatingsController,
} from "../controllers/order.controller.js";
import {
  cancelReturnRequestController,
  createReturnRequestController,
  getAdminReturnByIdController,
  getReturnFinanceReportController,
  getReturnPickupOtpController,
  getReturnStatusController,
  getSellerFinanceLedgerController,
  listAdminReturnsController,
  passReturnQualityCheckController,
  confirmReturnPayoutController,
  processAdminReturnRefundController,
} from "../controllers/return.controller.js";
import { getUserWalletController } from "../../food/user/controllers/userWallet.controller.js";
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
  getAdminCustomers,
  getAdminCustomerById,
  deleteAdminOrder,
  getAdminProducts,
  getAdminProductById,
  getAdminStats,
  rejectAdminSellerRequest,
  removeCategory,
  removeProduct,
  updateCategory,
  updateProduct,
  getAdminZones,
  getAdminZoneById,
  createAdminZone,
  updateAdminZone,
  deleteAdminZone,
  listPublicZones,
  detectQuickZonePublic,
  getAdminExperienceSections,
  createAdminExperienceSection,
  updateAdminExperienceSection,
  deleteAdminExperienceSection,
  reorderAdminExperienceSections,
  getAdminHeroConfig,
  setAdminHeroConfig,
  getAdminOfferSections,
  createAdminOfferSection,
  updateAdminOfferSection,
  deleteAdminOfferSection,
  reorderAdminOfferSections,
  getAdminHomeTiles,
  createAdminHomeTile,
  updateAdminHomeTile,
  deleteAdminHomeTile,
  reorderAdminHomeTiles,
  updateAdminHomeHeadings,
  getAdminFinanceSummary,
  getAdminFinanceLedger,
  getAdminFinancePayouts,
  getAdminSellerWithdrawals,
  getAdminSellerTransactions,
  updateAdminWithdrawalStatus,
  getAdminSellerCouponRequests,
  updateAdminSellerCouponRequestStatus,
  getAdminCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  getExpiredSellerLicenses,
} from "../controllers/admin.controller.js";
import {
  createOrUpdateFeeSettings,
  getFeeSettings,
  getPublicBillingSettings,
} from "../controllers/billing.controller.js";
import * as notificationBroadcastController from "../../food/admin/controllers/notificationBroadcast.controller.js";
import {
  geocodeAddress,
  reverseGeocode,
  geocodePlaceId,
} from "../controllers/location.controller.js";

import { authMiddleware, checkPermission } from "../../../core/auth/auth.middleware.js";
import { requireRoles } from "../../../core/roles/role.middleware.js";
import { verifyAccessToken } from "../../../core/auth/token.util.js";
import { FoodUser } from "../../../core/users/user.model.js";

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;
  if (!token) {
    return next();
  }
  try {
    const decoded = verifyAccessToken(token);
    // Deactivated customers must not use QC authenticated-optional routes with a live access token.
    if (decoded.role === "USER") {
      FoodUser.findById(decoded.userId)
        .select("isActive")
        .lean()
        .then((doc) => {
          if (!doc || doc.isActive === false) {
            return res.status(401).json({
              success: false,
              message: "User account is deactivated",
            });
          }
          req.user = { userId: decoded.userId, role: decoded.role };
          next();
        })
        .catch(() =>
          res.status(401).json({ success: false, message: "Authentication failed" }),
        );
      return;
    }
    req.user = { userId: decoded.userId, role: decoded.role };
  } catch (e) {
    // ignore guest
  }
  next();
};

const router = express.Router();
const adminOnly = [authMiddleware, requireRoles("ADMIN")];
const adminOrEmployee = [authMiddleware, requireRoles("ADMIN", "EMPLOYEE")];

router.get("/health", (_req, res) =>
  res.json({ success: true, module: "quick-commerce", status: "ok" }),
);

// ─── Performance: Single bootstrap call for homepage ──────────────────────────────
router.get("/bootstrap", getBootstrapData);

router.get("/home", getHomeData);
// Lean dedicated endpoints (replaces heavy getHomeData bridges)
router.get("/experience", getExperienceSectionsLean);
router.get("/experience/hero", getHeroConfigLean);
router.get("/offer-sections", getOfferSectionsLean);
router.get("/home-tiles", getHomeTilesLean);
router.get("/offers", getOffers);
router.get("/coupons", getCoupons);
router.post("/coupons/apply", applyCoupon);
router.get("/categories", getCategories);
router.get("/products", getProducts);
router.get("/products/:productId/reviews", getProductReviews);
router.post("/products/reviews", optionalAuth, submitProductReview);
router.get("/products/:productId", getProductById);
router.get("/zones/public", listPublicZones);
router.get("/zones/detect", detectQuickZonePublic);
router.get("/billing/settings", getPublicBillingSettings);
router.get("/stores", getStores);
router.get("/stores/:storeId", getStoreDetails);

// Location endpoints
router.get("/location/geocode", geocodeAddress);
router.get("/location/reverse-geocode", reverseGeocode);
router.get("/location/geocode-place", geocodePlaceId);

router.get("/cart", optionalAuth, getCart);
router.post("/cart/preview", optionalAuth, previewCheckout);
router.post("/checkout/preview", optionalAuth, previewCheckout);
router.post("/cart/add", optionalAuth, addToCart);
router.put("/cart/update", optionalAuth, updateCartItem);
router.delete("/cart/remove/:productId", optionalAuth, removeCartItem);
router.delete("/cart/clear", optionalAuth, clearCart);

router.post("/orders", optionalAuth, placeOrder);
router.get("/orders", optionalAuth, getMyOrders);
router.get("/orders/:orderId", optionalAuth, getOrderById);
router.post("/orders/:orderId/verify-payment", optionalAuth, verifyPayment);
router.post("/orders/:orderId/cancel", optionalAuth, cancelOrder);
router.post("/orders/:orderId/returns", authMiddleware, createReturnRequestController);
router.get("/orders/:orderId/returns", authMiddleware, getReturnStatusController);
router.get("/orders/:orderId/returns/pickup-otp", authMiddleware, getReturnPickupOtpController);
router.post("/orders/:orderId/returns/cancel", authMiddleware, cancelReturnRequestController);
router.patch("/orders/:orderId/ratings", authMiddleware, submitOrderRatingsController);
router.get("/wallet/balance", authMiddleware, getUserWalletController);
router.get("/wallet/transactions", authMiddleware, getUserWalletController);
router.post("/support/ticket", optionalAuth, createSupportTicketController);
router.get("/support/my-tickets", optionalAuth, listMySupportTicketsController);

router.get("/wishlist", optionalAuth, getWishlist);
router.post("/wishlist/add", optionalAuth, addToWishlist);
router.delete("/wishlist/remove/:productId", optionalAuth, removeFromWishlist);
router.post("/wishlist/toggle", optionalAuth, toggleWishlist);

// Admin endpoints (quick-commerce dashboard)
router.get("/admin/stats", ...adminOrEmployee, checkPermission("quick", "view"), getAdminStats);
router.get("/admin/categories", ...adminOrEmployee, checkPermission("quick::core_management::categories", "view"), getAdminCategories);
router.post(
  "/admin/categories",
  ...adminOrEmployee,
  checkPermission("quick::core_management::categories", "create"),
  upload.single("image"),
  createCategory,
);
router.put(
  "/admin/categories/:categoryId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::categories", "edit"),
  upload.single("image"),
  updateCategory,
);
router.delete("/admin/categories/:categoryId", ...adminOrEmployee, checkPermission("quick::core_management::categories", "delete"), removeCategory);
router.get("/admin/products", ...adminOrEmployee, checkPermission("quick::core_management::products", "view"), getAdminProducts);
router.get("/admin/products/:productId", ...adminOrEmployee, checkPermission("quick::core_management::products", "view"), getAdminProductById);
router.post(
  "/admin/products",
  ...adminOrEmployee,
  checkPermission("quick::core_management::products", "create"),
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 8 },
    ...Array.from({ length: 5 }, (_, index) => ({
      name: `variantImages_${index}`,
      maxCount: 3,
    })),
  ]),
  createProduct,
);
router.put(
  "/admin/products/:productId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::products", "edit"),
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 8 },
    ...Array.from({ length: 5 }, (_, index) => ({
      name: `variantImages_${index}`,
      maxCount: 3,
    })),
  ]),
  updateProduct,
);
router.delete("/admin/products/:productId", ...adminOrEmployee, checkPermission("quick::core_management::products", "delete"), removeProduct);
router.get("/admin/orders", ...adminOrEmployee, checkPermission("quick::core_management::orders", "view"), getAdminOrders);
router.get("/admin/orders/:orderId", ...adminOrEmployee, checkPermission("quick::core_management::orders", "view"), getAdminOrderById);
router.delete("/admin/orders/:orderId", ...adminOrEmployee, checkPermission("quick::core_management::orders", "delete"), deleteAdminOrder);

router.get(
  "/admin/returns",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "view"),
  listAdminReturnsController,
);
router.get(
  "/admin/returns/:returnId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "view"),
  getAdminReturnByIdController,
);
router.post(
  "/admin/returns/:returnId/refund",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "edit"),
  processAdminReturnRefundController,
);
router.post(
  "/admin/returns/:returnId/quality-pass",
  ...adminOrEmployee,
  checkPermission("quick::core_management::orders", "edit"),
  passReturnQualityCheckController,
);
router.post(
  "/admin/returns/:returnId/confirm-payout",
  ...adminOrEmployee,
  checkPermission("quick::core_management::wallet", "edit"),
  confirmReturnPayoutController,
);
router.get(
  "/admin/finance/returns/report",
  ...adminOrEmployee,
  checkPermission("quick::core_management::wallet", "view"),
  getReturnFinanceReportController,
);
router.get(
  "/admin/finance/sellers/:sellerId/ledger",
  ...adminOrEmployee,
  checkPermission("quick::core_management::wallet", "view"),
  getSellerFinanceLedgerController,
);

// Finance (quick-commerce admin wallet & ledger)
router.get("/admin/finance/summary", ...adminOrEmployee, checkPermission("quick::core_management::wallet", "view"), getAdminFinanceSummary);
router.get("/admin/finance/ledger", ...adminOrEmployee, checkPermission("quick::core_management::wallet", "view"), getAdminFinanceLedger);
router.get("/admin/finance/payouts", ...adminOrEmployee, checkPermission("quick::core_management::wallet", "view"), getAdminFinancePayouts);
router.get(
  "/admin/withdrawals/sellers",
  ...adminOrEmployee,
  checkPermission("quick::core_management::withdrawals", "view"),
  getAdminSellerWithdrawals,
);
router.get(
  "/admin/seller-transactions",
  ...adminOrEmployee,
  checkPermission("quick::core_management::seller_payments", "view"),
  getAdminSellerTransactions,
);

router.patch(
  "/admin/withdrawals/:withdrawalId",
  ...adminOrEmployee,
  checkPermission("quick::core_management::withdrawals", "edit"),
  updateAdminWithdrawalStatus,
);



router.get("/admin/customers", ...adminOrEmployee, checkPermission("quick::core_management::customers", "view"), getAdminCustomers);
router.get("/admin/customers/:id", ...adminOrEmployee, checkPermission("quick::core_management::customers", "view"), getAdminCustomerById);
router.get(
  "/admin/support-tickets",
  ...adminOrEmployee,
  checkPermission("quick::core_management::customer_support::tickets", "view"),
  getAdminSupportTicketsController,
);
router.patch(
  "/admin/support-tickets/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::customer_support::tickets", "edit"),
  updateAdminSupportTicketController,
);
router.get("/admin/seller-requests", ...adminOrEmployee, checkPermission("quick::core_management::seller_requests", "view"), getAdminSellerRequests);
router.put(
  "/admin/seller-requests/:sellerId/approve",
  ...adminOrEmployee,
  checkPermission("quick::core_management::seller_requests", "edit"),
  approveAdminSellerRequest,
);
router.put(
  "/admin/seller-requests/:sellerId/reject",
  ...adminOrEmployee,
  checkPermission("quick::core_management::seller_requests", "edit"),
  rejectAdminSellerRequest,
);
router.get("/admin/zones", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "view"), getAdminZones);
router.get("/admin/zones/:zoneId", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "view"), getAdminZoneById);
router.post("/admin/zones", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "create"), createAdminZone);
router.patch("/admin/zones/:zoneId", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "edit"), updateAdminZone);
router.delete("/admin/zones/:zoneId", ...adminOrEmployee, checkPermission("quick::core_management::zone_setup", "delete"), deleteAdminZone);



// Experience Sections Management
router.get(
  "/admin/experience/sections",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "view"),
  getAdminExperienceSections,
);
router.post(
  "/admin/experience/sections",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  createAdminExperienceSection,
);
router.put(
  "/admin/experience/sections/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  updateAdminExperienceSection,
);
router.delete(
  "/admin/experience/sections/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  deleteAdminExperienceSection,
);
router.post(
  "/admin/experience/sections/reorder",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::experience_studio", "edit"),
  reorderAdminExperienceSections,
);

router.get("/admin/experience/hero", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::hero_categories", "view"), getAdminHeroConfig);
router.post("/admin/experience/hero", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::hero_categories", "edit"), setAdminHeroConfig);

// Offer Sections Management
router.get("/admin/offer-sections", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::offer_sections", "view"), getAdminOfferSections);
router.post("/admin/offer-sections", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"), createAdminOfferSection);
router.put("/admin/offer-sections/:id", ...adminOrEmployee, checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"), updateAdminOfferSection);
router.delete(
  "/admin/offer-sections/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  deleteAdminOfferSection,
);
router.post(
  "/admin/offer-sections/reorder",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  reorderAdminOfferSections,
);

// Fast Fav + More tiles (Explore-style home cards)
router.get(
  "/admin/home-tiles",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "view"),
  getAdminHomeTiles,
);
router.post(
  "/admin/home-tiles",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  upload.single("image"),
  createAdminHomeTile,
);
router.put(
  "/admin/home-tiles/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  upload.single("image"),
  updateAdminHomeTile,
);
router.delete(
  "/admin/home-tiles/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  deleteAdminHomeTile,
);
router.post(
  "/admin/home-tiles/reorder",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  reorderAdminHomeTiles,
);
router.put(
  "/admin/home-headings",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::offer_sections", "edit"),
  updateAdminHomeHeadings,
);

// Broadcast Notifications
router.post(
  "/admin/notifications/broadcast",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::notifications", "create"),
  notificationBroadcastController.createBroadcastNotificationController
);
router.get(
  "/admin/notifications/broadcast",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::notifications", "view"),
  notificationBroadcastController.getBroadcastNotificationsController
);
router.delete(
  "/admin/notifications/broadcast/:id",
  ...adminOrEmployee,
  checkPermission("quick::core_management::marketing_tools::notifications", "delete"),
  notificationBroadcastController.deleteBroadcastNotificationController
);

router.get(
  "/admin/notifications/license-expired",
  ...adminOrEmployee,
  checkPermission("quick::core_management::sellers", "view"),
  getExpiredSellerLicenses
);

router.get("/admin/fee-settings", ...adminOrEmployee, checkPermission("quick::core_management::billing", "view"), getFeeSettings);
router.put("/admin/fee-settings", ...adminOrEmployee, checkPermission("quick::core_management::billing", "edit"), createOrUpdateFeeSettings);


// Admin Seller Coupon Requests (QC marketing tools)
router.get('/admin/seller-coupon-requests', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::seller_coupon_request', 'view'), getAdminSellerCouponRequests);
router.patch('/admin/seller-coupon-requests/:id/status', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::seller_coupon_request', 'edit'), updateAdminSellerCouponRequestStatus);
// Admin Coupon Management
router.get('/admin/coupons', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::coupons', 'view'), getAdminCoupons);
router.post('/admin/coupons', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::coupons', 'create'), createCoupon);
router.put('/admin/coupons/:couponId', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::coupons', 'edit'), updateCoupon);
router.delete('/admin/coupons/:couponId', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::coupons', 'delete'), deleteCoupon);
router.patch('/admin/coupons/:couponId/toggle-status', ...adminOrEmployee, checkPermission('quick::core_management::marketing_tools::coupons', 'edit'), toggleCouponStatus);
router.use(faqRoutes);

export default router;
