import express from 'express';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhook.controller.js';

/** ✅ NEW: Webhook Routes Module */
const router = express.Router();

/**
 * Endpoint for Razorpay payment/refund events (Public)
 * Path: /api/v1/payments/webhook/razorpay
 */
router.post('/razorpay', handleRazorpayWebhook);

export default router;
