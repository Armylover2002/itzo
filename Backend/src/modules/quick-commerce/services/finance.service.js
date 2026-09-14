import { QuickOrder } from "../models/order.model.js";
import { SellerOrder } from "../seller/models/sellerOrder.model.js";
import { SellerTransaction } from "../seller/models/sellerTransaction.model.js";
import { SellerReturn } from "../seller/models/sellerReturn.model.js";
import mongoose from "mongoose";
import { FoodDeliveryWallet } from "../../food/delivery/models/deliveryWallet.model.js";
import { FoodDeliveryWithdrawal } from "../../food/delivery/models/foodDeliveryWithdrawal.model.js";
import { FoodDeliveryCashDeposit } from "../../food/delivery/models/foodDeliveryCashDeposit.model.js";
import { FoodDeliveryPartner } from "../../food/delivery/models/deliveryPartner.model.js";
import { FoodOrder } from "../../food/orders/models/order.model.js";
import { FoodTransaction } from "../../food/orders/models/foodTransaction.model.js";
import { getDeliveryCashLimitSettings } from "../../food/admin/services/admin.service.js";
import { getDeliveryPartnerWalletEnhanced } from "../../food/delivery/services/deliveryFinance.service.js";
import { recoverNegativeBalanceOnSettlement } from "./sellerLedger.service.js";
import { PAGINATION_DEFAULTS, buildPaginationOptions } from "../../../utils/helpers.js";
import { resolveSellerReceivable } from "../utils/sellerReceivable.helpers.js";

const ACTIVE_ORDER_FILTER = {
  orderType: { $in: ["quick", "mixed"] },
  orderStatus: {
    $nin: ["cancelled", "cancelled_by_user", "cancelled_by_restaurant", "cancelled_by_admin"],
  },
};
const DELIVERED_ORDER_FILTER = {
  $or: [
    { orderStatus: "delivered" },
    { workflowStatus: "DELIVERED" },
    { "deliveryState.currentPhase": { $in: ["delivered", "completed"] } },
  ],
};

const num = (value) => Number(value || 0);
const titleStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "approved" || normalized === "processed") return "Settled";
  if (normalized === "rejected" || normalized === "failed") return "Rejected";
  if (normalized === "processing") return "Processing";
  return "Pending";
};

const sellerStatusFilter = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return {};
  if (normalized === "pending") return { status: { $in: ["Pending", "Processing"] } };
  if (normalized === "settled" || normalized === "approved") return { status: "Settled" };
  if (normalized === "rejected" || normalized === "failed") return { status: "Rejected" };
  return { status: normalized.charAt(0).toUpperCase() + normalized.slice(1) };
};

const deliveryStatusFilter = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized || normalized === "all") return {};
  if (normalized === "settled") return { status: "approved" };
  if (normalized === "processing") return { status: "pending" };
  return { status: normalized };
};

export async function getQuickCommerceFinanceSummary() {
  // Best-effort backfill for completed returns missing stock/receivable side-effects,
  // plus heal older clawbacks that wiped packing / zeroed commission.
  try {
    const {
      ensureReturnRefundSideEffects,
      applyReturnSellerFinance,
      healSellerOrderFinanceAfterReturn,
    } = await import('./quickReturnFinance.service.js');
    const pending = await SellerReturn.find({
      refundStatus: 'completed',
      $or: [
        { 'finance.sellerLedgerApplied': { $ne: true } },
        { 'finance.stockRestoredAt': null },
        { 'finance.stockRestoredAt': { $exists: false } },
        { 'finance.sellerReceivableAdjusted': { $ne: true } },
      ],
    })
      .limit(40)
      .exec();
    for (const ret of pending) {
      if (!ret.finance?.sellerLedgerApplied) {
        await applyReturnSellerFinance(ret, {
          actorRole: 'SYSTEM',
          reason: 'Admin finance backfill return finance',
        });
      } else {
        await ensureReturnRefundSideEffects(ret);
      }
    }

    const healCandidates = await SellerReturn.find({
      refundStatus: 'completed',
      'finance.sellerReceivableAdjusted': true,
    })
      .sort({ updatedAt: -1 })
      .limit(40)
      .lean();
    for (const ret of healCandidates) {
      await healSellerOrderFinanceAfterReturn(ret);
    }
  } catch {
    // non-fatal
  }

  const deliveredQuickMatch = { ...ACTIVE_ORDER_FILTER, ...DELIVERED_ORDER_FILTER };
  const codMethods = ["cash", "cod", "cash_on_delivery"];
  const codMethodExpr = {
    $in: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, codMethods],
  };
  const gstExpr = {
    $ifNull: ["$pricing.tax", { $ifNull: ["$pricing.gst", 0] }],
  };
  const adminCouponDiscountExpr = {
    $let: {
      vars: {
        raw: {
          $cond: [
            { $eq: ["$pricing.appliedCoupon.source", "admin"] },
            {
              $ifNull: [
                "$pricing.appliedCoupon.discount",
                { $ifNull: ["$pricing.discount", 0] },
              ],
            },
            0,
          ],
        },
        sub: { $max: [0, { $ifNull: ["$pricing.subtotal", 0] }] },
      },
      in: {
        // Cap corrupted discounts that were stored as full item subtotal.
        $cond: [
          { $and: [{ $gt: ["$$sub", 0] }, { $gte: ["$$raw", "$$sub"] }] },
          { $multiply: ["$$sub", 0.1] },
          { $max: [0, "$$raw"] },
        ],
      },
    },
  };

  // Admin keeps platform fee + GST + delivery margin (customer delivery − rider payout),
  // minus admin coupon. Seller commission is aggregated from SellerOrder separately.
  // Signed: admin coupon / negative delivery margin can push the net negative.
  const deliveryMarginExpr = {
    $subtract: [
      { $ifNull: ["$pricing.deliveryFee", 0] },
      { $ifNull: ["$riderEarning", { $ifNull: ["$pricing.riderEarning", 0] }] },
    ],
  };
  const adminEarningExpr = {
    $subtract: [
      {
        $add: [
          { $ifNull: ["$pricing.platformFee", 0] },
          gstExpr,
          deliveryMarginExpr,
        ],
      },
      adminCouponDiscountExpr,
    ],
  };
  const packingFeeExpr = {
    $max: [0, { $ifNull: ["$pricing.packagingFee", 0] }],
  };
  // For admin reporting, packing fees are seller-owned and must not be treated as platform/admin earnings.
  const orderTotalExpr = {
    $max: [
      0,
      {
        $subtract: [
          { $ifNull: ["$pricing.total", 0] },
          { $ifNull: ["$pricing.packagingFee", 0] },
        ],
      },
    ],
  };
  const sellerReceivableExpr = {
    $max: [
      { $ifNull: ["$pricing.receivable", 0] },
      { $max: [0, { $ifNull: ["$pricing.packingFee", 0] }] },
    ],
  };
  const sellerCommissionExpr = {
    $max: [
      0,
      {
        $cond: [
          { $gt: [{ $ifNull: ["$pricing.commissionAtSale", 0] }, 0] },
          "$pricing.commissionAtSale",
          { $ifNull: ["$pricing.commission", 0] },
        ],
      },
    ],
  };
  const sellerCouponDiscountExpr = {
    $max: [0, { $ifNull: ["$pricing.couponDiscount", 0] }],
  };

  const [
    orderVolumeAgg,
    adminEarningAgg,
    sellerCommissionAgg,
    codVolumeAgg,
    packingFeeAgg,
    walletFloatAgg,
    sellerReceivableAgg,
    sellerCouponDiscountAgg,
    adminCouponDiscountAgg,
    sellerSettledWithdrawalAgg,
    deliveryPendingAgg,
    completedReturnAgg,
  ] = await Promise.all([
    QuickOrder.aggregate([
      { $match: deliveredQuickMatch },
      { $group: { _id: null, total: { $sum: orderTotalExpr } } },
    ]),
    QuickOrder.aggregate([
      { $match: deliveredQuickMatch },
      { $group: { _id: null, total: { $sum: adminEarningExpr } } },
    ]),
    SellerOrder.aggregate([
      {
        $match: {
          orderType: { $in: ["quick", "mixed"] },
          status: "delivered",
        },
      },
      {
        $group: { _id: null, total: { $sum: sellerCommissionExpr } },
      },
    ]),
    QuickOrder.aggregate([
      {
        $match: {
          ...deliveredQuickMatch,
          $expr: codMethodExpr,
        },
      },
      { $group: { _id: null, total: { $sum: orderTotalExpr } } },
    ]),
    QuickOrder.aggregate([
      { $match: deliveredQuickMatch },
      { $group: { _id: null, total: { $sum: packingFeeExpr } } },
    ]),
    FoodDeliveryWallet.aggregate([
      { $group: { _id: null, float: { $sum: { $ifNull: ["$cashInHand", 0] } } } },
    ]),
    SellerOrder.aggregate([
      {
        $match: {
          orderType: { $in: ["quick", "mixed"] },
          status: "delivered",
        },
      },
      {
        $group: { _id: null, total: { $sum: sellerReceivableExpr } },
      },
    ]),
    SellerOrder.aggregate([
      {
        $match: {
          orderType: { $in: ["quick", "mixed"] },
          status: "delivered",
        },
      },
      {
        $group: { _id: null, total: { $sum: sellerCouponDiscountExpr } },
      },
    ]),
    QuickOrder.aggregate([
      { $match: deliveredQuickMatch },
      { $group: { _id: null, total: { $sum: adminCouponDiscountExpr } } },
    ]),
    SellerTransaction.aggregate([
      {
        $match: {
          type: "Withdrawal",
          status: "Settled",
        },
      },
      {
        $group: { _id: null, total: { $sum: { $abs: { $ifNull: ["$amount", 0] } } } },
      },
    ]),
    FoodDeliveryWithdrawal.aggregate([
      { $match: { status: { $in: ["pending", "processing"] } } },
      {
        $group: { _id: null, total: { $sum: { $abs: { $ifNull: ["$amount", 0] } } } },
      },
    ]),
    SellerReturn.aggregate([
      {
        $match: {
          refundStatus: "completed",
          returnStatus: { $in: ["refund_completed", "returned"] },
        },
      },
      {
        $group: {
          _id: null,
          refundedTax: { $sum: { $ifNull: ["$pricing.taxShare", 0] } },
          refundedAmount: { $sum: { $ifNull: ["$returnRefundAmount", 0] } },
          sellerClawed: { $sum: { $ifNull: ["$finance.sellerReceivableClawed", 0] } },
          pickupFeesSeller: { $sum: { $ifNull: ["$finance.pickupFeeDebited", 0] } },
          pickupFeesAdmin: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ["$finance.pickupFeeDebited", 0] }, 0] },
                0,
                {
                  $max: [
                    { $ifNull: ["$finance.adminPickupFeeCharged", 0] },
                    { $ifNull: ["$calculatedPickupCharge", 0] },
                    { $ifNull: ["$riderEarning", 0] },
                    { $ifNull: ["$returnDeliveryCommission", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
    ]),
  ]);

  const refundedTax = num(completedReturnAgg?.[0]?.refundedTax);
  const refundedToCustomers = num(completedReturnAgg?.[0]?.refundedAmount);
  const totalReturnPickupFees = num(completedReturnAgg?.[0]?.pickupFeesSeller);
  const totalReturnPickupPaidByAdmin = num(completedReturnAgg?.[0]?.pickupFeesAdmin);

  const totalAdminEarning =
    num(adminEarningAgg?.[0]?.total) +
    num(sellerCommissionAgg?.[0]?.total) -
    refundedTax -
    totalReturnPickupPaidByAdmin;
  const totalSellerCommission = num(sellerCommissionAgg?.[0]?.total);
  const totalCodCollected = num(codVolumeAgg?.[0]?.total);
  const walletFloat = num(walletFloatAgg?.[0]?.float);
  const totalPackingFee = num(packingFeeAgg?.[0]?.total);
  const sellerReceivableGross = num(sellerReceivableAgg?.[0]?.total);
  const sellerReceivable = Math.max(0, sellerReceivableGross - totalReturnPickupFees);
  const totalSellerCouponDiscount = num(sellerCouponDiscountAgg?.[0]?.total);
  const totalAdminCouponDiscount = num(adminCouponDiscountAgg?.[0]?.total);
  const sellerSettledWithdrawals = num(sellerSettledWithdrawalAgg?.[0]?.total);

  return {
    // Total customer collections on delivered quick-commerce orders (net of completed return refunds).
    totalPlatformEarning: Math.max(0, num(orderVolumeAgg?.[0]?.total) - refundedToCustomers),
    totalPackingFee,
    totalAdminEarning,
    totalSellerCommission,
    totalAdminCouponDiscount,
    totalSellerCouponDiscount,
    totalReturnRefunds: refundedToCustomers,
    totalReturnTaxRefunded: refundedTax,
    totalReturnPickupFees,
    totalReturnPickupPaidByAdmin,
    // QC admin wallet = platform fee + GST + commission + delivery margin − admin coupons − refunded GST − admin-paid return pickup.
    // Historical seller-debited pickup fees stay on seller ledger; new returns charge admin only.
    // Seller withdrawals are tracked separately under sellerPendingPayouts (do not mix pots).
    availableBalance: Math.max(0, totalAdminEarning),
    systemFloatCOD: Math.max(walletFloat, totalCodCollected),
    sellerPendingPayouts: Math.max(0, sellerReceivable - sellerSettledWithdrawals),
    sellerReceivable,
    sellerReceivableGross,
    deliveryPendingPayouts: num(deliveryPendingAgg?.[0]?.total),
  };
}

const mapQuickOrderFinanceEntry = (txn, orderMap) => {
  const order = orderMap.get(String(txn.orderId || ""));
  const orderRef = order?.orderId || String(txn.orderId || "");
  const amount = num(txn.amounts?.totalCustomerPaid || txn.pricing?.total || 0);
  const isRefund = String(txn.status || "").toLowerCase() === "refunded";

  return {
    _id: txn._id,
    transactionId: txn._id,
    reference: orderRef,
    type: isRefund ? "ORDER_REFUND" : "ORDER_PAYMENT",
    direction: isRefund ? "DEBIT" : "CREDIT",
    amount,
    status: String(txn.status || "captured").toUpperCase(),
    description: isRefund
      ? `Quick order refund #${orderRef}`
      : `Quick order payment #${orderRef}`,
    paymentMode: txn.paymentMethod || txn.payment?.method || "quick-commerce",
    actorType: "CUSTOMER",
    createdAt: txn.createdAt,
  };
};

const mapQuickSellerFinanceEntry = (txn) => {
  const type = String(txn.type || "SELLER_TRANSACTION").trim();
  const normalizedType = type.toUpperCase().replace(/\s+/g, "_");

  return {
    _id: txn._id,
    transactionId: txn._id,
    reference: txn.orderId || txn.reference || String(txn._id || ""),
    type: normalizedType,
    direction: "DEBIT",
    amount: Math.abs(num(txn.amount)),
    status: String(txn.status || "COMPLETED").toUpperCase(),
    description:
      type === "Withdrawal"
        ? `Seller withdrawal${txn.reference ? ` (${txn.reference})` : ""}`
        : `Seller payout for order #${txn.orderId || txn.reference || "N/A"}`,
    paymentMode: "quick-commerce",
    actorType: "SELLER",
    createdAt: txn.createdAt,
  };
};

export async function getQuickCommerceFinanceLedger({ page = 1, limit = PAGINATION_DEFAULTS.defaultLimit } = {}) {
  const { page: safePage, limit: safeLimit } = buildPaginationOptions(
    { page, limit },
    { defaultLimit: PAGINATION_DEFAULTS.defaultLimit, maxLimit: 200 }
  );
  const fetchLimit = Math.min(1000, safePage * safeLimit * 3);

  // QC wallet page should show only pure quick-commerce parent orders,
  // not food orders (and not mixed food+quick orders).
  // Quick parent orders do not have a restaurantId on the parent transaction.
  // Some projects store quick-commerce parent transactions as `mixed` as well (historical reasons),
  // while still having `restaurantId: null`. Include both to avoid empty ledgers.
  const quickOrderFilter = { orderType: { $in: ["quick", "mixed"] }, restaurantId: null };

  const [orderTxns, sellerTxns, orderCount, sellerCount] = await Promise.all([
    FoodTransaction.find(quickOrderFilter)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .lean(),
    SellerTransaction.find({})
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .lean(),
    FoodTransaction.countDocuments(quickOrderFilter),
    SellerTransaction.countDocuments({}),
  ]);

  const orderIds = [
    ...new Set(
      (orderTxns || [])
        .map((txn) => String(txn.orderId || "").trim())
        .filter(Boolean),
    ),
  ];

  const orderDocs = orderIds.length
    ? await QuickOrder.find({ _id: { $in: orderIds } })
        .select("_id orderId orderType")
        .lean()
    : [];

  const orderMap = new Map(
    (orderDocs || []).map((order) => [String(order._id), order]),
  );

  const quickOrderItems = (orderTxns || [])
    .filter((txn) => orderMap.has(String(txn.orderId || "")))
    .map((txn) => mapQuickOrderFinanceEntry(txn, orderMap));

  const merged = [
    ...quickOrderItems,
    ...(sellerTxns || []).map((txn) => mapQuickSellerFinanceEntry(txn)),
  ].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );

  const total = Number(orderCount || 0) + Number(sellerCount || 0);
  const skip = (safePage - 1) * safeLimit;
  const items = merged.slice(skip, skip + safeLimit);

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceFinancePayouts({
  seller,
  status,
  page = 1,
  limit = 100,
} = {}) {
  const normalizedStatus = String(status || "").toUpperCase();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 100));
  const skip = (safePage - 1) * safeLimit;

  if (seller) {
    const statusFilter = normalizedStatus
      ? normalizedStatus === "PENDING"
        ? { status: { $in: ["Pending", "Processing"] } }
        : { status: normalizedStatus }
      : { status: { $in: ["Pending", "Processing"] } };

    const [items, total] = await Promise.all([
      SellerTransaction.find({ type: "Withdrawal", ...statusFilter })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      SellerTransaction.countDocuments({ type: "Withdrawal", ...statusFilter }),
    ]);

    return {
      items: (items || []).map((t) => ({
        _id: t._id,
        id: t._id,
        ownerType: "SELLER",
        sellerId: t.sellerId,
        amount: Math.abs(num(t.amount)),
        status: t.status,
        reference: t.reference || "",
        orderId: t.orderId || "",
        createdAt: t.createdAt,
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  const deliveryStatusFilter = normalizedStatus
    ? { status: normalizedStatus.toLowerCase() }
    : { status: { $in: ["pending", "processing"] } };

  const [items, total] = await Promise.all([
    FoodDeliveryWithdrawal.find(deliveryStatusFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    FoodDeliveryWithdrawal.countDocuments(deliveryStatusFilter),
  ]);

  return {
    items: (items || []).map((t) => ({
      _id: t._id,
      id: t._id,
      ownerType: "DELIVERY_PARTNER",
      deliveryPartnerId: t.deliveryPartnerId,
      amount: Math.abs(num(t.amount)),
      status: t.status,
      reference: t.reference || "",
      createdAt: t.createdAt,
    })),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceSellerWithdrawals({
  page = 1,
  limit = PAGINATION_DEFAULTS.defaultLimit,
  status,
  search,
} = {}) {
  const { page: safePage, limit: safeLimit, skip } = buildPaginationOptions(
    { page, limit },
    { defaultLimit: PAGINATION_DEFAULTS.defaultLimit, maxLimit: 100 }
  );
  const filter = {
    type: "Withdrawal",
    ...sellerStatusFilter(status),
  };

  const term = String(search || "").trim();
  if (term) {
    filter.$or = [
      { reference: { $regex: term, $options: "i" } },
      { orderId: { $regex: term, $options: "i" } },
      { customer: { $regex: term, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    SellerTransaction.find(filter)
      .populate("sellerId", "name shopName phone phoneLast10 email bankInfo")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    SellerTransaction.countDocuments(filter),
  ]);

  return {
    items: (items || []).map((item) => {
      const seller = item.sellerId || {};
      return {
        ...item,
        _id: item._id,
        id: item._id,
        ownerType: "SELLER",
        amount: Math.abs(num(item.amount)),
        status: item.status || "Pending",
        paymentMethod: item.paymentMethod || "bank_transfer",
        user: {
          _id: seller._id,
          name: seller.name || "Seller",
          shopName: seller.shopName || seller.name || "Seller",
          phone: seller.phoneLast10 || seller.phone || "",
          email: seller.email || "",
        },
        bankDetails: item.bankDetails || {
          bankName: seller.bankInfo?.bankName || "",
          accountHolderName: seller.bankInfo?.accountHolderName || "",
          accountNumber: seller.bankInfo?.accountNumber || "",
          accountNumberLast4: String(seller.bankInfo?.accountNumber || "").slice(-4),
          ifscCode: seller.bankInfo?.ifscCode || "",
          upiId: seller.bankInfo?.upiId || "",
          upiQrImage: seller.bankInfo?.upiQrImage || "",
        },
        // Prefer snapshotted payout details; fall back to live seller bankInfo for older rows.
        payoutDetails: {
          paymentMethod: item.paymentMethod || "bank_transfer",
          bankName: item.bankDetails?.bankName || seller.bankInfo?.bankName || "",
          accountHolderName:
            item.bankDetails?.accountHolderName || seller.bankInfo?.accountHolderName || "",
          accountNumber:
            item.bankDetails?.accountNumber || seller.bankInfo?.accountNumber || "",
          accountNumberLast4:
            item.bankDetails?.accountNumberLast4 ||
            String(seller.bankInfo?.accountNumber || "").slice(-4),
          ifscCode: item.bankDetails?.ifscCode || seller.bankInfo?.ifscCode || "",
          upiId: item.bankDetails?.upiId || seller.bankInfo?.upiId || "",
          upiQrImage: item.bankDetails?.upiQrImage || seller.bankInfo?.upiQrImage || "",
        },
        sellerId: seller._id || item.sellerId,
      };
    }),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceSellerTransactions({
  page = 1,
  limit = PAGINATION_DEFAULTS.defaultLimit,
  status,
  type,
  search,
  sellerId,
} = {}) {
  const { page: safePage, limit: safeLimit, skip } = buildPaginationOptions(
    { page, limit },
    { defaultLimit: PAGINATION_DEFAULTS.defaultLimit, maxLimit: 200 }
  );

  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedType = String(type || "").trim().toLowerCase();
  const term = String(search || "").trim().toLowerCase();

  const txnFilter = {};
  if (sellerId && mongoose.Types.ObjectId.isValid(String(sellerId))) {
    txnFilter.sellerId = new mongoose.Types.ObjectId(String(sellerId));
  }
  if (normalizedType === "sale") {
    txnFilter.type = "Order Payment";
  } else if (normalizedType === "payout") {
    txnFilter.type = "Withdrawal";
  } else if (normalizedType === "adjustment") {
    txnFilter.type = "Adjustment";
  }

  const sellerOrderFilter = {
    orderType: { $in: ["quick", "mixed"] },
    status: "delivered",
  };
  if (txnFilter.sellerId) {
    sellerOrderFilter.sellerId = txnFilter.sellerId;
  }

  const [transactions, deliveredOrders] = await Promise.all([
    SellerTransaction.find(txnFilter)
      .populate("sellerId", "name shopName phone phoneLast10 email bankInfo")
      .sort({ createdAt: -1 })
      .lean(),
    normalizedType === "payout"
      ? Promise.resolve([])
      : SellerOrder.find(sellerOrderFilter)
          .populate("sellerId", "name shopName phone phoneLast10 email bankInfo")
          .select(
            "orderId sellerId customer pricing items status deliveredAt updatedAt createdAt",
          )
          .sort({ deliveredAt: -1, updatedAt: -1, createdAt: -1 })
          .lean(),
  ]);

  const existingSaleKeys = new Set(
    (transactions || [])
      .filter((item) => item.type === "Order Payment")
      .map(
        (item) =>
          `${String(item.sellerId?._id || item.sellerId || "")}::${String(item.orderId || "")}`,
      ),
  );

  const syntheticSales = (deliveredOrders || [])
    .filter((order) => {
      const key = `${String(order.sellerId?._id || order.sellerId || "")}::${String(order.orderId || "")}`;
      return !existingSaleKeys.has(key);
    })
    .map((order) => {
      const receivable = resolveSellerReceivable(order?.pricing);

      return {
        _id: order._id,
        sellerId: order.sellerId,
        type: "Order Payment",
        amount: receivable,
        status: "Settled",
        reference: String(order.orderId || ""),
        orderId: String(order.orderId || ""),
        customer: order?.customer?.name || "Customer",
        paymentMethod: "",
        createdAt: order.deliveredAt || order.updatedAt || order.createdAt,
        linkedOrder: order,
      };
    });

  let merged = [...(transactions || []), ...syntheticSales];

  if (normalizedStatus && normalizedStatus !== "all") {
    const statusMap = {
      pending: "Pending",
      processing: "Processing",
      settled: "Settled",
      rejected: "Rejected",
    };
    const wanted = statusMap[normalizedStatus];
    if (wanted) {
      merged = merged.filter(
        (item) => String(item.status || "").toLowerCase() === wanted.toLowerCase(),
      );
    }
  }

  if (term) {
    merged = merged.filter((item) => {
      const seller = item.sellerId || {};
      const haystack = [
        item.reference,
        item.orderId,
        item.customer,
        seller.shopName,
        seller.name,
        seller.phone,
        seller.email,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }

  merged.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );

  const total = merged.length;
  const pageItems = merged.slice(skip, skip + safeLimit);

  const orderMap = new Map();
  (deliveredOrders || []).forEach((order) => {
    const sellerKey = String(order.sellerId?._id || order.sellerId || "");
    orderMap.set(`${sellerKey}::${String(order.orderId || "")}`, order);
    if (!orderMap.has(String(order.orderId || ""))) {
      orderMap.set(String(order.orderId || ""), order);
    }
  });

  return {
    items: pageItems.map((item) => {
      const seller = item.sellerId || {};
      const sellerKey = String(seller._id || item.sellerId || "");
      const linkedOrder =
        item.linkedOrder ||
        orderMap.get(`${sellerKey}::${String(item.orderId || "")}`) ||
        orderMap.get(String(item.orderId || "")) ||
        null;
      const subtotal = num(linkedOrder?.pricing?.subtotal);

      return {
        ...item,
        _id: item._id,
        reference: item.reference || String(item._id || ""),
        user: {
          _id: seller._id,
          name: seller.name || "Seller",
          shopName: seller.shopName || seller.name || "Seller",
          phone: seller.phoneLast10 || seller.phone || "",
          email: seller.email || "",
          bankDetails: seller.bankInfo || {},
        },
        order: linkedOrder
          ? {
              orderId: linkedOrder.orderId,
              pricing: {
                subtotal,
                commission: 0,
                platformFee: 0,
                platformFeeRate: 0,
                tax: 0,
                receivable: num(linkedOrder.pricing?.receivable),
                total: num(linkedOrder.pricing?.total),
              },
              items: (linkedOrder.items || []).map((line) => ({
                product: { name: line.name || "Item" },
                quantity: line.quantity || 1,
                price: line.price || 0,
              })),
              customer: linkedOrder.customer || null,
              status: linkedOrder.status || "",
            }
          : item.orderId
            ? { orderId: item.orderId }
            : null,
        paymentMethod:
          item.type === "Withdrawal"
            ? item.paymentMethod || "bank_transfer"
            : item.paymentMethod || "Wallet",
      };
    }),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceDeliveryWithdrawals({
  page = 1,
  limit = PAGINATION_DEFAULTS.defaultLimit,
  status,
  search,
} = {}) {
  const { page: safePage, limit: safeLimit, skip } = buildPaginationOptions(
    { page, limit },
    { defaultLimit: PAGINATION_DEFAULTS.defaultLimit, maxLimit: 100 }
  );
  const filter = deliveryStatusFilter(status);

  const term = String(search || "").trim();
  if (term && !Number.isNaN(Number(term))) {
    filter.amount = Number(term);
  }

  const [items, total] = await Promise.all([
    FoodDeliveryWithdrawal.find(filter)
      .populate("deliveryPartnerId", "name phone email profilePartnerId bankName bankAccountHolderName bankAccountNumber bankIfscCode upiId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    FoodDeliveryWithdrawal.countDocuments(filter),
  ]);

  return {
    items: (items || []).map((item) => {
      const partner = item.deliveryPartnerId || {};
      return {
        ...item,
        _id: item._id,
        id: item._id,
        ownerType: "DELIVERY_PARTNER",
        amount: Math.abs(num(item.amount)),
        status: titleStatus(item.status),
        reference: item.transactionId || item.reference || "",
        paymentMethod: item.paymentMethod || "bank_transfer",
        user: {
          _id: partner._id,
          name: partner.name || "Delivery Partner",
          shopName: partner.name || "Delivery Partner",
          phone: partner.phone || "",
          email: partner.email || "",
        },
        bankDetails: {
          bankName: item.bankDetails?.bankName || partner.bankName || "",
          accountHolderName:
            item.bankDetails?.accountHolderName || partner.bankAccountHolderName || "",
          accountNumberLast4: String(
            item.bankDetails?.accountNumber || partner.bankAccountNumber || "",
          ).slice(-4),
          ifscCode: item.bankDetails?.ifscCode || partner.bankIfscCode || "",
          upiId: item.upiId || partner.upiId || "",
        },
        deliveryPartnerId: partner._id || item.deliveryPartnerId,
      };
    }),
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceDeliveryCashBalances({
  page = 1,
  limit = PAGINATION_DEFAULTS.defaultLimit,
  search = "",
} = {}) {
  const { page: safePage, limit: safeLimit, skip } = buildPaginationOptions(
    { page, limit },
    { defaultLimit: PAGINATION_DEFAULTS.defaultLimit, maxLimit: 100 }
  );
  const searchTerm = String(search || "").trim();
  const partnerFilter = { status: "approved" };
  if (searchTerm) {
    partnerFilter.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { phone: { $regex: searchTerm, $options: "i" } },
    ];
  }

  const [{ deliveryCashLimit }, partners, total] = await Promise.all([
    getDeliveryCashLimitSettings(),
    FoodDeliveryPartner.find(partnerFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    FoodDeliveryPartner.countDocuments(partnerFilter),
  ]);

  const limitAmount = Math.max(1, Number(deliveryCashLimit || 0) || 5000);
  const partnerIds = (partners || []).map((partner) => partner._id);

  // Batch the previously per-partner queries (delivered count, pending count,
  // last settlement) into 3 aggregations across all partners on the page,
  // reducing ~4*N round-trips to N wallet calls + 3 aggregations. Output is
  // identical to the per-partner computation.
  const [wallets, deliveredAgg, pendingAgg, lastSettlementAgg] = await Promise.all([
    Promise.all(
      (partners || []).map((partner) => getDeliveryPartnerWalletEnhanced(partner._id)),
    ),
    FoodOrder.aggregate([
      { $match: { "dispatch.deliveryPartnerId": { $in: partnerIds }, orderStatus: "delivered" } },
      { $group: { _id: "$dispatch.deliveryPartnerId", count: { $sum: 1 } } },
    ]),
    FoodOrder.aggregate([
      {
        $match: {
          "dispatch.deliveryPartnerId": { $in: partnerIds },
          orderStatus: {
            $nin: [
              "delivered",
              "cancelled",
              "cancelled_by_user",
              "cancelled_by_restaurant",
              "cancelled_by_admin",
            ],
          },
        },
      },
      { $group: { _id: "$dispatch.deliveryPartnerId", count: { $sum: 1 } } },
    ]),
    FoodDeliveryCashDeposit.aggregate([
      { $match: { deliveryPartnerId: { $in: partnerIds }, status: "Completed" } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$deliveryPartnerId", createdAt: { $first: "$createdAt" } } },
    ]),
  ]);

  const walletByPartner = new Map(
    (partners || []).map((partner, index) => [String(partner._id), wallets[index]]),
  );
  const deliveredByPartner = new Map(
    deliveredAgg.map((row) => [String(row._id), row.count]),
  );
  const pendingByPartner = new Map(
    pendingAgg.map((row) => [String(row._id), row.count]),
  );
  const lastSettlementByPartner = new Map(
    lastSettlementAgg.map((row) => [String(row._id), row.createdAt]),
  );

  const items = (partners || []).map((partner) => {
    const partnerKey = String(partner._id);
    const wallet = walletByPartner.get(partnerKey);
    const currentCash = Math.max(0, Number(wallet?.cashInHand || 0));
    const ratio = currentCash / limitAmount;
    const status = ratio >= 1 ? "critical" : ratio >= 0.75 ? "warning" : "safe";

    return {
      id: partnerKey,
      name: partner.name || "Delivery Partner",
      avatar: partner.profilePhoto || "",
      currentCash,
      limit: limitAmount,
      status,
      lastSettlement: lastSettlementByPartner.get(partnerKey) || "Never",
      totalOrders: Number(deliveredByPartner.get(partnerKey) || 0),
      pendingOrders: Number(pendingByPartner.get(partnerKey) || 0),
    };
  });

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceCashSettlementHistory({
  page = 1,
  limit = PAGINATION_DEFAULTS.defaultLimit,
  search = "",
} = {}) {
  const { page: safePage, limit: safeLimit, skip } = buildPaginationOptions(
    { page, limit },
    { defaultLimit: PAGINATION_DEFAULTS.defaultLimit, maxLimit: 100 }
  );
  const searchTerm = String(search || "").trim();
  const filter = { status: "Completed" };

  const [rows, total] = await Promise.all([
    FoodDeliveryCashDeposit.find(filter)
      .populate("deliveryPartnerId", "name phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    FoodDeliveryCashDeposit.countDocuments(filter),
  ]);

  const items = (rows || [])
    .filter((row) => {
      if (!searchTerm) return true;
      const riderName = String(row.deliveryPartnerId?.name || "").toLowerCase();
      const rowId = String(row._id || "").toLowerCase();
      const phone = String(row.deliveryPartnerId?.phone || "").toLowerCase();
      const term = searchTerm.toLowerCase();
      return riderName.includes(term) || rowId.includes(term) || phone.includes(term);
    })
    .map((row) => ({
      id: String(row._id),
      rider: row.deliveryPartnerId?.name || "Delivery Partner",
      amount: Math.max(0, Number(row.amount || 0)),
      method: row.paymentMethod || "cash",
      date: row.createdAt,
    }));

  return {
    items,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}

export async function getQuickCommerceRiderCashDetails(riderId, { limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const wallet = await getDeliveryPartnerWalletEnhanced(riderId);
  const ledger = Array.isArray(wallet?.transactions) ? wallet.transactions : [];
  return ledger.slice(0, safeLimit).map((item) => ({
    id: item.id,
    reference: item.orderId || item.id,
    amount: Math.abs(num(item.amount)),
    createdAt: item.createdAt || item.date,
    type: item.type,
    status: item.status,
  }));
}

export async function settleQuickCommerceRiderCash({
  riderId,
  amount,
  method = "cash",
  adminId = null,
} = {}) {
  const normalizedRiderId = String(riderId || "").trim();
  const settleAmount = Math.max(0, Number(amount || 0));
  if (!normalizedRiderId) throw new Error("riderId is required");
  if (!settleAmount) throw new Error("Valid amount is required");

  const wallet = await getDeliveryPartnerWalletEnhanced(normalizedRiderId);
  if (settleAmount > Number(wallet?.cashInHand || 0)) {
    throw new Error("Settlement amount exceeds rider cash in hand");
  }

  const created = await FoodDeliveryCashDeposit.create({
    deliveryPartnerId: normalizedRiderId,
    amount: settleAmount,
    paymentMethod: ["cash", "upi", "bank_transfer", "razorpay"].includes(String(method))
      ? String(method)
      : "cash",
    status: "Completed",
    adminId: adminId || undefined,
    adminNote: "Quick-commerce cash settlement",
    razorpayOrderId: `qc_settle_${Date.now()}`,
  });

  return {
    id: created._id,
    riderId: normalizedRiderId,
    amount: settleAmount,
    method: created.paymentMethod,
    status: created.status,
    createdAt: created.createdAt,
  };
}

export async function updateQuickCommerceWithdrawalStatus(
  withdrawalId,
  { status, adminNote = "", rejectionReason = "", transactionId = "" } = {},
) {
  const normalized = String(status || "").trim().toLowerCase();
  const isApprove = ["settled", "approved", "processed"].includes(normalized);
  const isReject = ["rejected", "failed", "denied"].includes(normalized);

  if (!isApprove && !isReject) {
    throw new Error("Status must be Settled or Rejected");
  }

  const sellerWithdrawal = await SellerTransaction.findOne({
    _id: withdrawalId,
    type: "Withdrawal",
  });

  if (sellerWithdrawal) {
    if (!["Pending", "Processing"].includes(String(sellerWithdrawal.status || ""))) {
      throw new Error(`Withdrawal is already ${sellerWithdrawal.status}`);
    }

    let recovery = { recovered: 0, netPayout: Math.abs(num(sellerWithdrawal.amount)) };
    if (isApprove) {
      recovery = await recoverNegativeBalanceOnSettlement({
        sellerId: sellerWithdrawal.sellerId,
        withdrawalId: sellerWithdrawal._id,
        withdrawalAmount: Math.abs(num(sellerWithdrawal.amount)),
        actorId: null,
        actorRole: "ADMIN",
      });
    }

    sellerWithdrawal.status = isApprove ? "Settled" : "Rejected";
    sellerWithdrawal.adminNote = String(adminNote || "").trim();
    sellerWithdrawal.reason = isReject
      ? String(rejectionReason || adminNote || "Rejected by admin").trim()
      : recovery.recovered > 0
        ? `Settled with ${recovery.recovered} negative balance recovery`
        : "";
    sellerWithdrawal.processedAt = new Date();
    if (transactionId) sellerWithdrawal.orderId = String(transactionId).trim();
    await sellerWithdrawal.save();

    try {
      const { upsertSellerNotification } = await import(
        '../seller/services/sellerNotify.service.js'
      );
      const amt = Math.abs(num(sellerWithdrawal.amount));
      await upsertSellerNotification(sellerWithdrawal.sellerId, {
        key: `withdrawal:${String(sellerWithdrawal._id)}:${sellerWithdrawal.status}`,
        type: 'payment',
        title: isApprove ? 'Withdrawal settled' : 'Withdrawal rejected',
        message: isApprove
          ? `Your withdrawal of ₹${amt} has been settled.`
          : `Your withdrawal of ₹${amt} was rejected.${sellerWithdrawal.reason ? ` Reason: ${sellerWithdrawal.reason}` : ''}`,
        link: '/seller/wallet',
        metadata: {
          withdrawalId: String(sellerWithdrawal._id),
          status: sellerWithdrawal.status,
          amount: amt,
        },
      });
    } catch (err) {
      console.warn('Seller withdrawal notify failed:', err?.message || err);
    }

    return {
      ownerType: "SELLER",
      withdrawal: sellerWithdrawal.toObject(),
      negativeBalanceRecovery: recovery,
    };
  }

  const deliveryWithdrawal = await FoodDeliveryWithdrawal.findById(withdrawalId);
  if (deliveryWithdrawal) {
    if (deliveryWithdrawal.status !== "pending") {
      throw new Error(`Withdrawal is already ${deliveryWithdrawal.status}`);
    }

    deliveryWithdrawal.status = isApprove ? "approved" : "rejected";
    deliveryWithdrawal.adminNote = String(adminNote || "").trim();
    deliveryWithdrawal.rejectionReason = isReject
      ? String(rejectionReason || adminNote || "Rejected by admin").trim()
      : "";
    deliveryWithdrawal.transactionId = String(transactionId || "").trim();
    deliveryWithdrawal.processedAt = new Date();
    await deliveryWithdrawal.save();

    return {
      ownerType: "DELIVERY_PARTNER",
      withdrawal: deliveryWithdrawal.toObject(),
    };
  }

  throw new Error("Withdrawal request not found");
}

