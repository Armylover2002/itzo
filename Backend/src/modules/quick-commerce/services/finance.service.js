import { QuickOrder } from "../models/order.model.js";
import { SellerOrder } from "../seller/models/sellerOrder.model.js";
import { SellerTransaction } from "../seller/models/sellerTransaction.model.js";
import { QuickAdminWallet } from "../models/adminWallet.model.js";
import { Transaction } from "../../../core/payments/models/transaction.model.js";
import { FoodDeliveryWallet } from "../../food/delivery/models/deliveryWallet.model.js";
import { FoodDeliveryWithdrawal } from "../../food/delivery/models/foodDeliveryWithdrawal.model.js";
import { FoodDeliveryCashDeposit } from "../../food/delivery/models/foodDeliveryCashDeposit.model.js";
import { FoodDeliveryPartner } from "../../food/delivery/models/deliveryPartner.model.js";
import { FoodOrder } from "../../food/orders/models/order.model.js";
import { getBalance, getTransactionsByEntity } from "../../../core/payments/transaction.service.js";
import { getDeliveryCashLimitSettings } from "../../food/admin/services/admin.service.js";
import { getDeliveryPartnerWalletEnhanced } from "../../food/delivery/services/deliveryFinance.service.js";

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
  const onlinePaidStatuses = ["paid", "authorized", "captured", "settled"];
  const onlineMethods = ["razorpay", "razorpay_qr", "wallet"];
  const codMethods = ["cash", "cod", "cash_on_delivery"];
  const onlineMethodExpr = {
    $in: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, onlineMethods],
  };
  const onlinePaidStatusExpr = {
    $in: [{ $toLower: { $ifNull: ["$payment.status", ""] } }, onlinePaidStatuses],
  };
  const codMethodExpr = {
    $in: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, codMethods],
  };
  const sellerReceivableExpr = {
    $max: [
      0,
      { $ifNull: ["$pricing.receivable", 0] },
      {
        $subtract: [
          { $ifNull: ["$pricing.subtotal", 0] },
          { $ifNull: ["$pricing.commission", 0] },
        ],
      },
    ],
  };
  const sellerEarningPerOrderExpr = {
    $max: [
      0,
      {
        $subtract: [
          { $ifNull: ["$pricing.subtotal", 0] },
          { $ifNull: ["$pricing.restaurantCommission", 0] },
        ],
      },
    ],
  };
  const deliveryEarningPerOrderExpr = {
    $max: [0, { $ifNull: ["$riderEarning", 0] }],
  };
  const payableAmountExpr = {
    $let: {
      vars: {
        amountDue: { $ifNull: ["$payment.amountDue", 0] },
        payableAmount: { $ifNull: ["$payableAmount", 0] },
        totalAmount: { $ifNull: ["$totalAmount", 0] },
        amount: { $ifNull: ["$amount", 0] },
        total: { $ifNull: ["$total", 0] },
        pricingTotal: { $ifNull: ["$pricing.total", 0] },
        platformFee: { $ifNull: ["$pricing.platformFee", 0] },
      },
      in: {
        $max: [
          0,
          "$$amountDue",
          "$$payableAmount",
          "$$totalAmount",
          "$$amount",
          "$$total",
          {
            $add: [
              "$$pricingTotal",
              {
                $cond: [{ $gt: ["$$platformFee", 0] }, "$$platformFee", 0],
              },
            ],
          },
        ],
      },
    },
  };
  const adminEarningPerOrderExpr = {
    $max: [
      0,
      {
        $subtract: [
          payableAmountExpr,
          {
            $add: [sellerEarningPerOrderExpr, deliveryEarningPerOrderExpr],
          },
        ],
      },
    ],
  };

  // Only consider delivery partners who actually have Quick Commerce deliveries assigned
  const quickRiderIds = await QuickOrder.distinct("dispatch.deliveryPartnerId", {
    ...ACTIVE_ORDER_FILTER,
    "dispatch.deliveryPartnerId": { $ne: null },
  });

  const riderWalletFilter = quickRiderIds.length > 0
    ? { deliveryPartnerId: { $in: quickRiderIds } }
    : { _id: { $exists: false } };

  const riderWithdrawalFilter = quickRiderIds.length > 0
    ? { deliveryPartnerId: { $in: quickRiderIds }, status: { $in: ["pending", "processing"] } }
    : { _id: { $exists: false } };

  const [
    quickAdminWallet,
    onlineAgg,
    codAgg,
    walletFloatAgg,
    sellerReceivableAgg,
    sellerSettledWithdrawalAgg,
    deliveryPendingAgg,
    adminProfitAgg,
  ] = await Promise.all([
    QuickAdminWallet.findOne({ key: "quick_platform" }).lean(),
    QuickOrder.aggregate([
      {
        $match: {
          ...ACTIVE_ORDER_FILTER,
          ...DELIVERED_ORDER_FILTER,
          $expr: {
            $and: [onlineMethodExpr, onlinePaidStatusExpr],
          },
        },
      },
      {
        $group: { _id: null, total: { $sum: payableAmountExpr } },
      },
    ]),
    QuickOrder.aggregate([
      {
        $match: {
          ...ACTIVE_ORDER_FILTER,
          ...DELIVERED_ORDER_FILTER,
          $expr: codMethodExpr,
        },
      },
      {
        $group: { _id: null, total: { $sum: payableAmountExpr } },
      },
    ]),
    FoodDeliveryWallet.aggregate([
      { $match: riderWalletFilter },
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
      { $match: riderWithdrawalFilter },
      {
        $group: { _id: null, total: { $sum: { $abs: { $ifNull: ["$amount", 0] } } } },
      },
    ]),
    QuickOrder.aggregate([
      { $match: { ...ACTIVE_ORDER_FILTER, ...DELIVERED_ORDER_FILTER } },
      {
        $group: { _id: null, total: { $sum: adminEarningPerOrderExpr } },
      },
    ]),
  ]);

  const totalOnline = num(onlineAgg?.[0]?.total);
  const totalCodCollected = num(codAgg?.[0]?.total);
  const walletFloat = num(walletFloatAgg?.[0]?.float);
  const sellerReceivable = num(sellerReceivableAgg?.[0]?.total);
  const sellerSettledWithdrawals = num(sellerSettledWithdrawalAgg?.[0]?.total);

  return {
    totalPlatformEarning: totalOnline + totalCodCollected,
    totalAdminEarning: num(adminProfitAgg?.[0]?.total),
    availableBalance: num(quickAdminWallet?.balance || 0),
    // COD float should represent COD cash collected by quick riders.
    systemFloatCOD: Math.max(walletFloat, totalCodCollected),
    // Owed to sellers = delivered net receivable (subtotal - commission) minus settled withdrawals.
    sellerPendingPayouts: Math.max(0, sellerReceivable - sellerSettledWithdrawals),
    deliveryPendingPayouts: num(deliveryPendingAgg?.[0]?.total),
  };
}

export async function getQuickCommerceFinanceLedger({ page = 1, limit = 25 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;

  // Query Quick Commerce seller transactions + platform transactions
  const [sellerTxns, sellerTotal, platformTxns, platformTotal] = await Promise.all([
    SellerTransaction.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    SellerTransaction.countDocuments({}),
    Transaction.find({
      $or: [
        { module: { $in: ["quick", "quick_commerce"] } },
        { entityType: "quick_admin" },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Transaction.countDocuments({
      $or: [
        { module: { $in: ["quick", "quick_commerce"] } },
        { entityType: "quick_admin" },
      ],
    }),
  ]);

  const mappedSellerTxns = (sellerTxns || []).map((st) => ({
    _id: st._id,
    transactionId: st.reference || st.orderId || st._id,
    reference: st.orderId || st.reference || st._id,
    type: st.type || "Order Payment",
    direction: st.type === "Withdrawal" ? "DEBIT" : "CREDIT",
    amount: Math.abs(num(st.amount)),
    status: String(st.status || "Settled").toUpperCase(),
    description: st.customer ? `Customer: ${st.customer}` : (st.type || "Quick Commerce Transaction"),
    paymentMode: st.paymentMethod || "quick_commerce",
    actorType: "SELLER",
    createdAt: st.createdAt,
  }));

  const mappedPlatformTxns = (platformTxns || []).map((txn) => ({
    _id: txn._id,
    transactionId: txn._id,
    reference: txn.paymentId || txn.orderId || txn._id,
    type: txn.category || txn.type,
    direction: txn.type === "debit" ? "DEBIT" : "CREDIT",
    amount: Math.abs(num(txn.amount)),
    status: String(txn.status || "completed").toUpperCase(),
    description: txn.description || "",
    paymentMode: txn.module || "quick_commerce",
    actorType: txn.entityType === "quick_admin" ? "PLATFORM" : (txn.entityType || "SYSTEM"),
    createdAt: txn.createdAt,
  }));

  const combined = [...mappedSellerTxns, ...mappedPlatformTxns].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  const total = sellerTotal + platformTotal;
  const items = combined.slice(0, safeLimit);

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

  const quickRiderIds = await QuickOrder.distinct("dispatch.deliveryPartnerId", {
    ...ACTIVE_ORDER_FILTER,
    "dispatch.deliveryPartnerId": { $ne: null },
  });

  if (quickRiderIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      totalPages: 1,
    };
  }

  const deliveryStatusFilter = normalizedStatus
    ? { status: normalizedStatus.toLowerCase(), deliveryPartnerId: { $in: quickRiderIds } }
    : { status: { $in: ["pending", "processing"] }, deliveryPartnerId: { $in: quickRiderIds } };

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
  limit = 25,
  status,
  search,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const skip = (safePage - 1) * safeLimit;
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
      .populate("sellerId", "name shopName phone phoneLast10 email bankInfo shopImage shopInfo")
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
          shopImage: seller.shopInfo?.shopImage || seller.shopImage || "",
        },
        bankDetails: {
          bankName: item.bankDetails?.bankName || seller.bankInfo?.bankName || "",
          accountHolderName: item.bankDetails?.accountHolderName || seller.bankInfo?.accountHolderName || "",
          accountNumber: item.bankDetails?.accountNumber || seller.bankInfo?.accountNumber || "",
          accountNumberLast4: item.bankDetails?.accountNumberLast4 || String(item.bankDetails?.accountNumber || seller.bankInfo?.accountNumber || "").slice(-4),
          ifscCode: item.bankDetails?.ifscCode || seller.bankInfo?.ifscCode || "",
          upiId: item.bankDetails?.upiId || seller.bankInfo?.upiId || "",
          qrCodeImage: item.bankDetails?.qrCodeImage || seller.bankInfo?.upiQrImage || "",
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

export async function getQuickCommerceDeliveryWithdrawals({
  page = 1,
  limit = 25,
  status,
  search,
} = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const quickRiderIds = await QuickOrder.distinct("dispatch.deliveryPartnerId", {
    ...ACTIVE_ORDER_FILTER,
    "dispatch.deliveryPartnerId": { $ne: null },
  });

  if (quickRiderIds.length === 0) {
    return {
      items: [],
      total: 0,
      page: safePage,
      limit: safeLimit,
      totalPages: 1,
    };
  }

  const filter = {
    ...deliveryStatusFilter(status),
    deliveryPartnerId: { $in: quickRiderIds },
  };

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

    sellerWithdrawal.status = isApprove ? "Settled" : "Rejected";
    sellerWithdrawal.adminNote = String(adminNote || "").trim();
    sellerWithdrawal.reason = isReject
      ? String(rejectionReason || adminNote || "Rejected by admin").trim()
      : "";
    sellerWithdrawal.processedAt = new Date();
    if (transactionId) sellerWithdrawal.orderId = String(transactionId).trim();
    await sellerWithdrawal.save();

    return {
      ownerType: "SELLER",
      withdrawal: sellerWithdrawal.toObject(),
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
