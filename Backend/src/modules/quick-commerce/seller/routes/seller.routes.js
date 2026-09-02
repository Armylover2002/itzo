import express from "express";
import { authMiddleware } from "../../../../core/auth/auth.middleware.js";
import { requireRoles } from "../../../../core/roles/role.middleware.js";
import { upload } from "../../../../middleware/upload.js";
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
  getSellerReturnOtpController,
  getSellerReturnsController,
  getSellerStatsController,
  getSellerStockHistoryController,
  markAllSellerNotificationsReadController,
  markSellerNotificationReadController,
  rejectSellerReturnController,
  resendSellerOrderDispatchController,
  requestSellerOtpController,
  requestSellerWithdrawalController,
  updateSellerOrderStatusController,
  updateSellerProductController,
  updateSellerProfileController,
  deleteSellerProfileController,
  verifySellerOtpController,
} from "../controllers/seller.controller.js";

const router = express.Router();
const sellerOnly = [authMiddleware, requireRoles("SELLER")];
const productUpload = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 8 },
]);
export const sellerProfileUpload = upload.fields([
  { name: "shopImage", maxCount: 1 },
  { name: "shopPhoto", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "image", maxCount: 1 },
  { name: "upiQrImage", maxCount: 1 },
  { name: "upiQrCode", maxCount: 1 },
  { name: "shopLicenseImage", maxCount: 1 },
  { name: "panImage", maxCount: 1 },
  { name: "gstImage", maxCount: 1 },
  { name: "fssaiImage", maxCount: 1 },
  { name: "aadharImage", maxCount: 1 },
  { name: "chequeImage", maxCount: 1 },
  { name: "documentImage", maxCount: 1 },
]);

router.post("/auth/request-otp", requestSellerOtpController);
router.post("/auth/verify-otp", verifySellerOtpController);

router.get("/categories/tree", ...sellerOnly, getSellerCategoryTreeController);

router.get("/products", ...sellerOnly, getSellerProductsController);
router.get("/products/:productId", ...sellerOnly, getSellerProductByIdController);
router.post("/products", ...sellerOnly, productUpload, createSellerProductController);
router.put(
  "/products/:productId",
  ...sellerOnly,
  productUpload,
  updateSellerProductController,
);
router.delete("/products/:productId", ...sellerOnly, deleteSellerProductController);

router.get("/stock-history", ...sellerOnly, getSellerStockHistoryController);
router.post("/stock-adjustments", ...sellerOnly, adjustSellerStockController);

router.get("/profile", ...sellerOnly, getSellerProfileController);
router.put(
  "/profile",
  ...sellerOnly,
  sellerProfileUpload,
  updateSellerProfileController,
);
router.delete("/profile", ...sellerOnly, deleteSellerProfileController);

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
router.get("/returns/:sellerReturnId/otp", ...sellerOnly, getSellerReturnOtpController);
router.put("/returns/:orderId/approve", ...sellerOnly, approveSellerReturnController);
router.put("/returns/:orderId/reject", ...sellerOnly, rejectSellerReturnController);

router.get("/earnings", ...sellerOnly, getSellerEarningsController);
router.post("/withdrawals", ...sellerOnly, requestSellerWithdrawalController);
router.get("/stats", ...sellerOnly, getSellerStatsController);

export default router;
