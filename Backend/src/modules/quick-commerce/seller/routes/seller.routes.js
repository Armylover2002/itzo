import express from "express";
import { authMiddleware, sellerProfileAuth } from "../../../../core/auth/auth.middleware.js";
import { requireRoles } from "../../../../core/roles/role.middleware.js";
import { upload } from "../../../../middleware/upload.js";
import { sendError } from "../../../../utils/response.js";
import {
  authRateLimiter,
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
} from "../../../../middleware/rateLimit.js";
import {
  adjustSellerStockController,
  approveSellerReturnController,
  createSellerProductController,
  deleteSellerProductController,
  getSellerCategoryTreeController,
  getSellerEarningsController,
  getSellerNotificationsController,
  getSellerOrdersController,
  getSellerProductByIdController,
  getSellerProductsController,
  getSellerProfileController,
  getSellerReturnsController,
  getSellerStatsController,
  getSellerWithdrawalSettingsController,
  getSellerStockHistoryController,
  markAllSellerNotificationsReadController,
  markSellerNotificationReadController,
  rejectSellerReturnController,
  requestSellerReturnPickupController,
  resendSellerOrderDispatchController,
  requestSellerOtpController,
  requestSellerWithdrawalController,
  updateSellerOrderStatusController,
  updateSellerProductController,
  updateSellerProfileController,
  verifySellerOtpController,
  listSellerCouponsController,
  createSellerCouponController,
  updateSellerCouponController,
  deleteSellerCouponController,
  deleteSellerAccountController,
  bulkUploadSellerProductsController,
} from "../controllers/seller.controller.js";

const router = express.Router();
const sellerOnly = [authMiddleware, requireRoles("SELLER")];
const sellerProfileOnly = [sellerProfileAuth, requireRoles("SELLER")];
const otpRequestGuards = [authRateLimiter, otpRequestRateLimiter];
const otpVerifyGuards = [authRateLimiter, otpVerifyRateLimiter];
const productUpload = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err?.code === "LIMIT_FILE_SIZE") {
        return sendError(res, 400, "Each product image must be under 5MB");
      }
      if (err?.code === "LIMIT_FILE_COUNT") {
        return sendError(res, 400, "Too many images. Maximum 3 photos per variant.");
      }
      if (err?.code === "LIMIT_UNEXPECTED_FILE") {
        return sendError(
          res,
          400,
          "Unexpected image field. Use variant photos (max 3 per variant).",
        );
      }
      return sendError(res, 400, err.message || "Failed to upload product images");
    }

    // Controllers expect fields() shape: { fieldName: File[] }
    if (Array.isArray(req.files)) {
      req.files = req.files.reduce((grouped, file) => {
        const key = String(file?.fieldname || "").trim();
        if (!key) return grouped;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(file);
        return grouped;
      }, {});
    } else if (!req.files || typeof req.files !== "object") {
      req.files = {};
    }

    next();
  });
};
const sellerProfileUpload = upload.fields([
  { name: "upiQrImage", maxCount: 1 },
  { name: "shopImage", maxCount: 1 },
  { name: "shopLicenseImage", maxCount: 1 },
  { name: "medicalLicenseImage", maxCount: 1 },
  { name: "fssaiImage", maxCount: 1 },
]);

router.post("/auth/request-otp", ...otpRequestGuards, requestSellerOtpController);
router.post("/auth/verify-otp", ...otpVerifyGuards, verifySellerOtpController);

router.get("/categories/tree", ...sellerOnly, getSellerCategoryTreeController);

router.get("/products", ...sellerOnly, getSellerProductsController);
router.get("/products/:productId", ...sellerOnly, getSellerProductByIdController);

router.post("/products", ...sellerOnly, productUpload, createSellerProductController);
router.post("/products/bulk", ...sellerOnly, upload.single("csvFile"), bulkUploadSellerProductsController);
router.put(
  "/products/:productId",
  ...sellerOnly,
  productUpload,
  updateSellerProductController,
);
router.delete("/products/:productId", ...sellerOnly, deleteSellerProductController);

router.get("/stock-history", ...sellerOnly, getSellerStockHistoryController);
router.post("/stock-adjustments", ...sellerOnly, adjustSellerStockController);

router.get("/profile", ...sellerProfileOnly, getSellerProfileController);
router.put(
  "/profile",
  ...sellerProfileOnly,
  sellerProfileUpload,
  updateSellerProfileController,
);
router.delete("/profile", ...sellerOnly, deleteSellerAccountController);

router.get("/notifications", ...sellerOnly, getSellerNotificationsController);
router.put(
  "/notifications/mark-all-read",
  ...sellerOnly,
  markAllSellerNotificationsReadController,
);
router.put(
  "/notifications/:notificationId/read",
  ...sellerOnly,
  markSellerNotificationReadController,
);

router.get("/orders", ...sellerOnly, getSellerOrdersController);
router.put("/orders/:orderId/status", ...sellerOnly, updateSellerOrderStatusController);
router.post("/orders/:orderId/resend-dispatch", ...sellerOnly, resendSellerOrderDispatchController);

router.get("/returns", ...sellerOnly, getSellerReturnsController);
router.put("/returns/:orderId/approve", ...sellerOnly, approveSellerReturnController);
router.put("/returns/:orderId/reject", ...sellerOnly, rejectSellerReturnController);
router.post("/returns/:orderId/request-pickup", ...sellerOnly, requestSellerReturnPickupController);

router.get("/earnings", ...sellerOnly, getSellerEarningsController);
router.get("/withdrawal-settings", ...sellerOnly, getSellerWithdrawalSettingsController);
router.post("/withdrawals", ...sellerOnly, requestSellerWithdrawalController);
router.get("/stats", ...sellerOnly, getSellerStatsController);

router.get("/coupons", ...sellerOnly, listSellerCouponsController);
router.post("/coupons", ...sellerOnly, createSellerCouponController);
router.put("/coupons/:id", ...sellerOnly, updateSellerCouponController);
router.delete("/coupons/:id", ...sellerOnly, deleteSellerCouponController);



export default router;
