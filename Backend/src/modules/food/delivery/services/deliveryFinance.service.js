import mongoose from "mongoose";
import { FoodOrder } from "../../orders/models/order.model.js";
import { FoodDeliveryWithdrawal } from "../models/foodDeliveryWithdrawal.model.js";
import {
  FoodDeliveryCashDeposit,
  ensureCashDepositIdempotencyIndexes,
} from "../models/foodDeliveryCashDeposit.model.js";
import { FoodDeliveryPartner } from "../models/deliveryPartner.model.js";
import { uploadImageBuffer } from "../../../../services/cloudinary.service.js";
import { DeliveryBonusTransaction } from "../../admin/models/deliveryBonusTransaction.model.js";
import { Transaction } from "../../../../core/payments/models/transaction.model.js";
import { getDeliveryCashLimitSettings } from "../../admin/services/admin.service.js";
import { ValidationError } from "../../../../core/auth/errors.js";
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyPaymentSignature,
} from "../../orders/helpers/razorpay.helper.js";

import { getTransactionsByEntity } from "../../../../core/payments/transaction.service.js";
import { FoodDeliveryWallet } from "../models/deliveryWallet.model.js";
import { creditWallet } from "../../../../core/payments/wallet.service.js";
import { logger } from "../../../../utils/logger.js";


/**
 * Enhanced wallet fetch for delivery partners.
 * Integrates:
 * 1. Historical orders (earnings)
 * 2. Admin bonuses
 * 3. Withdrawals (pending/payout)
 * 4. Cash collected vs limit
 */
export const getDeliveryPartnerWalletEnhanced = async (deliveryPartnerId) => {
  if (
    !deliveryPartnerId ||
    !mongoose.Types.ObjectId.isValid(deliveryPartnerId)
  ) {
    throw new ValidationError("Invalid delivery partner ID");
  }

  const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  const partner = await FoodDeliveryPartner.findById(partnerId).lean();
  if (!partner) throw new ValidationError("Delivery partner not found");

  // 1. Self-heal completed deliveries that missed wallet credits (e.g., due to disabled queues in local dev)
  try {
    const completedOrders = await FoodOrder.find({
      "dispatch.deliveryPartnerId": partnerId,
      orderStatus: "delivered",
    }).lean();

    if (completedOrders.length > 0) {
      const orderIds = completedOrders.map(o => o._id);
      const existingTxns = await Transaction.find({
        orderId: { $in: orderIds },
        type: "credit",
        status: "completed",
        category: { $in: ["delivery_earning", "platform_fee"] },
      }).select("orderId category entityType").lean();

      const riderCredited = new Set(
        existingTxns
          .filter((t) => t.category === "delivery_earning" && t.entityType === "deliveryBoy")
          .map((t) => String(t.orderId))
      );
      const platformCredited = new Set(
        existingTxns
          .filter((t) => t.category === "platform_fee" && t.entityType === "admin")
          .map((t) => String(t.orderId))
      );

      for (const order of completedOrders) {
        const orderKey = String(order._id);
        const riderEarning = Number(order.riderEarning || 0);
        const platformProfit = Number(order.platformProfit || 0);

        if (!riderCredited.has(orderKey) && riderEarning > 0) {
          const creditResult = await creditWallet({
            entityType: 'deliveryBoy',
            entityId: partnerId,
            amount: riderEarning,
            description: `Order ${order.orderId || order._id} - delivery earning (self-heal)`,
            category: 'delivery_earning',
            orderId: order._id,
            metadata: { orderId: order.orderId, paymentMethod: order.payment?.method }
          });

          if (!creditResult?.alreadyProcessed) {
            await FoodDeliveryWallet.updateOne(
              { deliveryPartnerId: partnerId },
              { $inc: { totalDeliveries: 1 } }
            );
            logger.info(`Self-healed credit for delivery partner ${partnerId} order ${order._id}`);
          }
        }

        // Heal platform profit independently (even if rider credit already exists).
        if (!platformCredited.has(orderKey) && platformProfit > 0) {
          try {
            await creditWallet({
              entityType: 'admin',
              entityId: 'platform',
              amount: platformProfit,
              description: `Order ${order.orderId || order._id} - platform profit (self-heal)`,
              category: 'platform_fee',
              orderId: order._id,
              metadata: { orderId: order.orderId, paymentMethod: order.payment?.method, riderEarning }
            });
          } catch (err) {
            logger.error(`Self-heal platform profit failed for order ${order._id}: ${err.message}`);
          }
        }
      }
    }
  } catch (err) {
    logger.error(`Self-healing delivery wallet credits failed: ${err.message}`);
  }

  // Optional test helper only — never gate on NODE_ENV alone (mis-set prod would wipe pendings)
  if (process.env.AUTO_REJECT_PENDING_DELIVERY_WITHDRAWALS === 'true') {
    try {
      const pendingWithdrawalsCount = await FoodDeliveryWithdrawal.countDocuments({
        deliveryPartnerId: partnerId,
        status: 'pending'
      });
      if (pendingWithdrawalsCount > 0) {
        await FoodDeliveryWithdrawal.updateMany(
          { deliveryPartnerId: partnerId, status: 'pending' },
          { $set: { status: 'rejected', rejectionReason: 'Auto-rejected for testing (AUTO_REJECT_PENDING_DELIVERY_WITHDRAWALS)' } }
        );
        logger.info(`Auto-rejected ${pendingWithdrawalsCount} pending withdrawals for partner ${partnerId}`);
      }
    } catch (err) {
      logger.error(`Auto-rejecting pending withdrawals failed: ${err.message}`);
    }
  }

  const [
    cashLimitSettings,
    walletDoc,
    totalBonusAgg,
    cashCollectedAgg,
    totalDepositedCashAgg,
    reservedDepositsAgg,
    pendingWithdrawalsAgg,
    transactionsResult,
    totalDeliveries,
    addonEarningsAgg,
  ] = await Promise.all([
    getDeliveryCashLimitSettings(),
    FoodDeliveryWallet.findOne({ deliveryPartnerId: partnerId }).lean(),
    DeliveryBonusTransaction.aggregate([
      { $match: { deliveryPartnerId: partnerId } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$amount", 0] } } } },
    ]),
    FoodOrder.aggregate([
      {
        $match: {
          "dispatch.deliveryPartnerId": partnerId,
          orderStatus: "delivered",
          "payment.method": { $in: ["cash", "cod", "cash_on_delivery"] },
        },
      },
      {
        $group: {
          _id: null,
          cashCollected: {
            $sum: {
              $let: {
                vars: {
                  amountDue: { $ifNull: ["$payment.amountDue", 0] },
                  payableAmount: { $ifNull: ["$payableAmount", 0] },
                  totalAmount: { $ifNull: ["$totalAmount", 0] },
                  amount: { $ifNull: ["$amount", 0] },
                  total: { $ifNull: ["$total", 0] },
                  pricingTotal: { $ifNull: ["$pricing.total", 0] },
                },
                in: {
                  $max: [
                    0,
                    "$$amountDue",
                    "$$payableAmount",
                    "$$totalAmount",
                    "$$amount",
                    "$$total",
                    "$$pricingTotal",
                  ],
                },
              },
            },
          },
        },
      },
    ]),
    FoodDeliveryCashDeposit.aggregate([
      { $match: { deliveryPartnerId: partnerId, status: "Completed" } },
      {
        $group: {
          _id: null,
          depositedCash: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
    // Pending / hub-accepted deposits reserve float until Completed or Failed
    FoodDeliveryCashDeposit.aggregate([
      {
        $match: {
          deliveryPartnerId: partnerId,
          depositType: { $ne: "online" },
          status: {
            $in: [
              "Pending",
              "Restaurant_Accepted",
              "Seller_Accepted",
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          reservedCash: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
    FoodDeliveryWithdrawal.aggregate([
      { $match: { deliveryPartnerId: partnerId, status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    getTransactionsByEntity("deliveryBoy", partnerId, { page: 1, limit: 50 }),
    FoodOrder.countDocuments({
      "dispatch.deliveryPartnerId": partnerId,
      orderStatus: "delivered",
    }),
    Transaction.aggregate([
      {
        $match: {
          entityId: partnerId,
          entityType: "deliveryBoy",
          type: "credit",
          category: "adjustment",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$amount", 0] } },
        },
      },
    ]),
  ]);

  const wallet = walletDoc || {
    balance: 0,
    totalEarnings: 0,
    totalBonus: 0,
    totalSettled: 0,
  };
  const recordedBonus = Number(wallet.totalBonus || 0);
  const aggregatedBonus = Number(totalBonusAgg?.[0]?.total) || 0;
  const effectiveBonus = Math.max(recordedBonus, aggregatedBonus);
  const missingBonusBalance = Math.max(0, effectiveBonus - recordedBonus);

  const grossCashCollected =
    Number(cashCollectedAgg?.[0]?.cashCollected) || 0;
  const totalDepositedCash =
    Number(totalDepositedCashAgg?.[0]?.depositedCash) || 0;
  // Outstanding COD float (Completed deposits only) — used for cash-limit headroom
  const cashInHand = Math.max(0, grossCashCollected - totalDepositedCash);
  const pendingDepositAmount =
    Math.round((Number(reservedDepositsAgg?.[0]?.reservedCash) || 0) * 100) / 100;
  // New deposits may only cover unreserved outstanding float
  const availableToDeposit = Math.max(
    0,
    Math.round((cashInHand - pendingDepositAmount) * 100) / 100,
  );

  const pendingWithdrawals = Number(pendingWithdrawalsAgg?.[0]?.total) || 0;
  const totalCashLimit = Number(cashLimitSettings.deliveryCashLimit) || 0;
  const deliveryWithdrawalLimit =
    Number(cashLimitSettings.deliveryWithdrawalLimit) || 100;
  const rawMax = cashLimitSettings.deliveryMaxWithdrawalLimit;
  const deliveryMaxWithdrawalLimit =
    rawMax != null && Number(rawMax) > 0 ? Number(rawMax) : null;

  const effectiveWalletBalance =
    Number(wallet.balance || 0) + missingBonusBalance;
  const pocketBalance = Math.max(
    0,
    effectiveWalletBalance - pendingWithdrawals,
  );

  const transactions = transactionsResult.transactions.map((t) => ({
    id: t._id,
    type:
      t.category === "settlement_payout"
        ? "withdrawal"
        : t.type === "credit"
          ? "payment"
          : "adjustment",
    amount: t.amount,
    status:
      t.status === "completed"
        ? "Completed"
        : t.status === "pending"
          ? "Pending"
          : "Failed",
    date: t.createdAt,
    description: t.description || "Wallet transaction",
    orderId: t.orderId,
    module: t.module,
  }));

  const addonEarnings = Number(addonEarningsAgg?.[0]?.total) || 0;
  const pureOrderEarnings = Math.max(0, (wallet.totalEarnings || 0) - addonEarnings);

  return {
    totalBalance: (wallet.totalEarnings || 0) + effectiveBonus,
    pocketBalance,
    cashInHand,
    pendingDepositAmount,
    availableToDeposit,
    totalWithdrawn: wallet.totalSettled || 0,
    pendingWithdrawals,
    totalEarned: (wallet.totalEarnings || 0),
    orderEarnings: pureOrderEarnings,
    addonEarnings: addonEarnings,
    totalBonus: effectiveBonus,
    totalCashLimit,
    availableCashLimit: Math.max(0, totalCashLimit - cashInHand),
    deliveryWithdrawalLimit,
    deliveryMaxWithdrawalLimit,
    totalDeliveries: Number(totalDeliveries) || 0,
    subscriptionBalance: Number(wallet.subscriptionBalance || 0),
    transactions,
  };
};

/** COD methods that increase rider cash-in-hand on delivery */
const COD_PAYMENT_METHODS = new Set(["cash", "cod", "cash_on_delivery"]);

/**
 * Amount the partner would collect in cash for this order (0 if prepaid / unknown).
 */
export function resolveOrderCodCollectAmount(order) {
  const method = String(order?.payment?.method || "")
    .trim()
    .toLowerCase();
  if (!COD_PAYMENT_METHODS.has(method)) return 0;

  const candidates = [
    order?.payment?.amountDue,
    order?.payableAmount,
    order?.totalAmount,
    order?.amount,
    order?.total,
    order?.pricing?.total,
  ]
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!candidates.length) return 0;
  return Math.round(Math.max(...candidates) * 100) / 100;
}

/**
 * Block accept when this COD order would push the rider past available cash limit.
 * Prepaid orders are always allowed.
 */
export async function assertDeliveryPartnerCodHeadroom(
  deliveryPartnerId,
  order,
) {
  const codAmount = resolveOrderCodCollectAmount(order);
  if (!(codAmount > 0)) return { codAmount: 0, skipped: true };

  const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
  const available = Number(wallet.availableCashLimit || 0);
  const totalLimit = Number(wallet.totalCashLimit || 0);

  if (totalLimit === 0) {
    throw new ValidationError(
      "Cash collection is blocked. Deposit outstanding cash or contact support before accepting COD orders.",
    );
  }

  if (codAmount > available + 0.009) {
    throw new ValidationError(
      `Cannot accept this COD order of ₹${codAmount.toFixed(2)}. ` +
        `Available cash limit is ₹${available.toFixed(2)} ` +
        `(cash in hand ₹${Number(wallet.cashInHand || 0).toFixed(2)} / limit ₹${totalLimit.toFixed(2)}). ` +
        "Please deposit cash first.",
    );
  }

  return { codAmount, available, skipped: false };
};

/**
 * Submits a new withdrawal request for a delivery partner.
 * Serializes concurrent creates per partner so pending totals cannot oversubscribe pocket balance.
 */
export const requestDeliveryWithdrawal = async (deliveryPartnerId, payload) => {
  const { bankDetails, paymentMethod = "bank_transfer" } = payload;
  const amount = Number(payload?.amount);
  if (!Number.isFinite(amount) || amount < 1) {
    throw new ValidationError("Invalid amount");
  }

  if (!mongoose.Types.ObjectId.isValid(deliveryPartnerId)) {
    throw new ValidationError("Invalid delivery partner ID");
  }

  const partnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  const partner = await FoodDeliveryPartner.findById(partnerId).lean();
  if (!partner) throw new ValidationError("Delivery partner not found");

  const session = await mongoose.startSession();
  let withdrawal;
  try {
    await session.withTransaction(async () => {
      await FoodDeliveryWallet.findOneAndUpdate(
        { deliveryPartnerId: partnerId },
        { $setOnInsert: { deliveryPartnerId: partnerId } },
        { upsert: true, session, new: true }
      );

      const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
      const minLimit = Number(wallet.deliveryWithdrawalLimit) || 1;
      const maxLimit =
        wallet.deliveryMaxWithdrawalLimit != null &&
        Number(wallet.deliveryMaxWithdrawalLimit) > 0
          ? Number(wallet.deliveryMaxWithdrawalLimit)
          : null;
      const pocketBalance = Number(wallet.pocketBalance) || 0;
      const effectiveMax =
        maxLimit != null ? Math.min(pocketBalance, maxLimit) : pocketBalance;

      if (amount < minLimit) {
        throw new ValidationError(`Minimum withdrawal amount is ₹${minLimit}`);
      }
      if (maxLimit != null && amount > maxLimit) {
        throw new ValidationError(`Maximum withdrawal amount is ₹${maxLimit}`);
      }
      if (amount > pocketBalance) {
        throw new ValidationError("Insufficient balance for this withdrawal");
      }
      if (amount > effectiveMax) {
        throw new ValidationError(
          `You can withdraw maximum ₹${effectiveMax} in one request`,
        );
      }

      const [created] = await FoodDeliveryWithdrawal.create(
        [
          {
            deliveryPartnerId: partnerId,
            amount,
            paymentMethod,
            bankDetails: bankDetails || {
              accountNumber: partner.bankAccountNumber,
              ifscCode: partner.bankIfscCode,
              bankName: partner.bankName,
              accountHolderName: partner.bankAccountHolderName,
            },
            upiId: partner.upiId,
            upiQrCode: partner.upiQrCode,
            status: "pending",
          },
        ],
        { session },
      );
      withdrawal = created;
    });
  } finally {
    session.endSession();
  }

  if (withdrawal) {
    void (async () => {
      try {
        const { notifyAdminsSafely } = await import(
          '../../../../core/notifications/firebase.service.js'
        );
        await notifyAdminsSafely({
          title: 'New delivery withdrawal request',
          body: `${partner.name || 'Delivery partner'} requested ₹${Number(amount).toFixed(2)}`,
          data: {
            type: 'delivery_withdraw_request',
            withdrawalId: String(withdrawal._id),
            deliveryPartnerId: String(partnerId),
          },
        });
      } catch (e) {
        console.error('Delivery withdrawal admin notification failed:', e?.message || e);
      }
    })();
  }

  return withdrawal;
};

/**
 * Creates a Razorpay order for cash deposit and persists a Pending intent
 * bound to this delivery partner (prevents payment hijack across partners).
 */
export const createDeliveryCashDepositOrder = async (
  deliveryPartnerId,
  amountInr,
) => {
  const amount = Number(amountInr);
  if (!Number.isFinite(amount) || amount < 1) {
    throw new ValidationError("Amount must be at least ₹1");
  }

  if (!deliveryPartnerId || !mongoose.Types.ObjectId.isValid(String(deliveryPartnerId))) {
    throw new ValidationError("Invalid delivery partner ID");
  }

  await ensureCashDepositIdempotencyIndexes();

  const partnerOid = new mongoose.Types.ObjectId(String(deliveryPartnerId));
  const wallet = await getDeliveryPartnerWalletEnhanced(deliveryPartnerId);
  if (amount > wallet.availableToDeposit) {
    throw new ValidationError(
      `Deposit amount cannot exceed available cash to deposit (₹${Number(wallet.availableToDeposit || 0).toFixed(2)}; ₹${Number(wallet.pendingDepositAmount || 0).toFixed(2)} already reserved in pending deposits)`
    );
  }

  const amountPaise = Math.round(amount * 100);
  const receipt = `cash_deposit_${String(deliveryPartnerId).slice(-8)}_${Date.now()}`;

  let orderId;
  let orderAmountPaise = amountPaise;
  let currency = "INR";
  let key = getRazorpayKeyId() || "rzp_test_dummy";

  if (!isRazorpayConfigured()) {
    orderId = `order_dev_${Date.now()}_${String(deliveryPartnerId).slice(-6)}`;
  } else {
    const order = await createRazorpayOrder(amountPaise, "INR", receipt);
    orderId = String(order.id);
    orderAmountPaise = Number(order.amount) || amountPaise;
    currency = order.currency || "INR";
    key = getRazorpayKeyId();
  }

  try {
    await FoodDeliveryCashDeposit.create({
      deliveryPartnerId: partnerOid,
      amount,
      paymentMethod: isRazorpayConfigured() ? "razorpay" : "cash",
      depositType: "online",
      status: "Pending",
      razorpayOrderId: orderId,
      razorpayPaymentId: null,
    });
  } catch (err) {
    const isDup =
      err?.code === 11000 || String(err?.message || "").includes("E11000");
    if (isDup) {
      throw new ValidationError(
        "A deposit order with this reference already exists — please retry",
      );
    }
    throw err;
  }

  return {
    razorpay: {
      key,
      orderId,
      amount: orderAmountPaise,
      currency,
    },
  };
};

/**
 * Verifies a cash deposit payment against the Pending intent created for this partner.
 * Idempotent under concurrency: unique razorpayPaymentId / razorpayOrderId + duplicate-key replay.
 */
export const verifyDeliveryCashDepositPayment = async (
  deliveryPartnerId,
  payload = {},
) => {
  const orderId = String(payload?.razorpayOrderId || "").trim();
  const paymentId = String(payload?.razorpayPaymentId || "").trim();
  const signature = String(payload?.razorpaySignature || "").trim();

  if (!orderId) throw new ValidationError("razorpayOrderId is required");
  if (!paymentId) throw new ValidationError("razorpayPaymentId is required");
  if (!signature && isRazorpayConfigured())
    throw new ValidationError("razorpaySignature is required");

  await ensureCashDepositIdempotencyIndexes();

  const partnerOid = new mongoose.Types.ObjectId(String(deliveryPartnerId));

  const loadWallet = () => getDeliveryPartnerWalletEnhanced(deliveryPartnerId);

  const assertOwnCompleted = (doc) => {
    if (!doc) return null;
    if (String(doc.deliveryPartnerId) !== String(deliveryPartnerId)) {
      throw new ValidationError(
        "This payment was already used for another deposit",
      );
    }
    return doc;
  };

  // Global replay by payment id (any partner)
  const completedByPayment = await FoodDeliveryCashDeposit.findOne({
    razorpayPaymentId: paymentId,
    status: "Completed",
  }).lean();
  if (completedByPayment) {
    return {
      deposit: assertOwnCompleted(completedByPayment),
      wallet: await loadWallet(),
    };
  }

  // Replay by order id for this partner
  const completedByOrder = await FoodDeliveryCashDeposit.findOne({
    deliveryPartnerId: partnerOid,
    razorpayOrderId: orderId,
    status: "Completed",
  }).lean();
  if (completedByOrder) {
    return {
      deposit: completedByOrder,
      wallet: await loadWallet(),
    };
  }

  // Must have a Pending intent created by this partner for this Razorpay order
  const intent = await FoodDeliveryCashDeposit.findOne({
    deliveryPartnerId: partnerOid,
    razorpayOrderId: orderId,
    depositType: "online",
    status: "Pending",
  }).lean();

  if (!intent) {
    // Another partner owns this order id (or no order was created)
    const foreignIntent = await FoodDeliveryCashDeposit.findOne({
      razorpayOrderId: orderId,
      depositType: "online",
    })
      .select("deliveryPartnerId status")
      .lean();
    if (
      foreignIntent &&
      String(foreignIntent.deliveryPartnerId) !== String(deliveryPartnerId)
    ) {
      throw new ValidationError(
        "This deposit order belongs to another delivery partner",
      );
    }
    throw new ValidationError(
      "No pending deposit order found — create a deposit order first",
    );
  }

  const isValid = isRazorpayConfigured()
    ? verifyPaymentSignature(orderId, paymentId, signature)
    : true;

  if (!isValid) {
    throw new ValidationError("Payment verification failed");
  }

  let resolvedAmount = Number(payload?.amount);
  if (isRazorpayConfigured()) {
    const fetchedPayment = await fetchRazorpayPayment(paymentId);
    const fetchedOrderId = String(fetchedPayment?.order_id || "").trim();
    const fetchedStatus = String(fetchedPayment?.status || "").toLowerCase();
    const fetchedAmount = Number(fetchedPayment?.amount || 0) / 100;

    if (fetchedOrderId !== orderId) {
      throw new ValidationError("Payment order mismatch");
    }
    if (fetchedStatus !== "captured") {
      throw new ValidationError("Payment not captured");
    }
    if (!Number.isFinite(fetchedAmount) || fetchedAmount < 1) {
      throw new ValidationError("Invalid payment amount");
    }
    resolvedAmount = fetchedAmount;
  } else if (!Number.isFinite(resolvedAmount) || resolvedAmount < 1) {
    throw new ValidationError("amount is required");
  }

  const intentAmount = Number(intent.amount || 0);
  if (Math.abs(resolvedAmount - intentAmount) > 0.5) {
    throw new ValidationError(
      `Payment amount ₹${resolvedAmount} does not match deposit order ₹${intentAmount}`,
    );
  }

  const wallet = await loadWallet();
  // This Pending intent is already reserved — allow up to availableToDeposit + intent
  const maxCompletable =
    Math.round(
      (Number(wallet.availableToDeposit || 0) + Number(intent.amount || 0)) * 100
    ) / 100;
  if (resolvedAmount > maxCompletable + 0.009) {
    throw new ValidationError(
      `Deposit amount exceeds remaining COD float (available ₹${maxCompletable.toFixed(2)})`
    );
  }

  const completionFields = {
    amount: resolvedAmount,
    paymentMethod: isRazorpayConfigured() ? "razorpay" : "cash",
    status: "Completed",
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    depositType: "online",
  };

  // Only promote THIS partner's Pending intent for this order
  const deposit = await FoodDeliveryCashDeposit.findOneAndUpdate(
    {
      _id: intent._id,
      deliveryPartnerId: partnerOid,
      razorpayOrderId: orderId,
      status: "Pending",
    },
    { $set: completionFields },
    { new: true },
  );

  if (!deposit) {
    // Concurrent verify completed it, or intent disappeared
    const raced =
      (await FoodDeliveryCashDeposit.findOne({
        razorpayPaymentId: paymentId,
        status: "Completed",
      }).lean()) ||
      (await FoodDeliveryCashDeposit.findOne({
        deliveryPartnerId: partnerOid,
        razorpayOrderId: orderId,
        status: "Completed",
      }).lean());

    if (raced) {
      return {
        deposit: assertOwnCompleted(raced),
        wallet: await loadWallet(),
      };
    }
    throw new ValidationError(
      "Deposit order is no longer pending — please refresh",
    );
  }

  return {
    deposit: deposit.toObject ? deposit.toObject() : deposit,
    wallet: await loadWallet(),
  };
};


