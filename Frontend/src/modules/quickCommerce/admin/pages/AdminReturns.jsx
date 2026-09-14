import React, { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Pagination from "@shared/components/ui/Pagination";
import { PAGINATION_CONFIG } from "@/shared/constants/pagination";
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Download,
  Search,
  Package,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadCsv } from "../utils/csvExportUtils";
import { mapReturnStatusLabel, resolveReturnLifecycleLabel, formatRefundStatusLabel } from "@/shared/utils/returnStatus";
import ReturnPickupImageGallery from "@shared/components/returns/ReturnPickupImageGallery";
import ReturnPayoutDetails from "@shared/components/returns/ReturnPayoutDetails";
import ReturnItemsDetailList from "@shared/components/returns/ReturnItemsDetailList";

const STATUS_TABS = [
  { id: "", label: "All" },
  { id: "return_requested", label: "Pending" },
  { id: "return_approved", label: "Approved" },
  { id: "return_pickup_assigned", label: "Pickup" },
  { id: "returned", label: "Quality" },
  { id: "refund_completed", label: "Completed" },
  { id: "return_rejected", label: "Rejected" },
];

const AdminReturns = () => {
  const [returns, setReturns] = useState([]);
  const [financeReport, setFinanceReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [confirmPayoutLoading, setConfirmPayoutLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [refundMethodFilter, setRefundMethodFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  const anyModalActionLoading = qualityLoading || refundLoading || confirmPayoutLoading;

  const fetchData = useCallback(async (requestedPage = page, { silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [listRes, reportRes] = await Promise.all([
        adminApi.getReturns({
          page: requestedPage,
          limit: pageSize,
          status: statusFilter || undefined,
          search: searchTerm.trim() || undefined,
          sellerId: sellerId.trim() || undefined,
        }),
        adminApi.getReturnFinanceReport(),
      ]);

      const payload = listRes?.data?.result || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      setReturns(items);
      setTotal(payload?.pagination?.total ?? items.length);
      setPage(payload?.pagination?.page ?? requestedPage);
      setFinanceReport(reportRes?.data?.result || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load returns");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, sellerId, statusFilter]);

  useEffect(() => {
    void fetchData(1);
  }, [statusFilter, sellerId]);

  const filteredReturns = useMemo(() => {
    if (refundMethodFilter === "all") return returns;
    return returns.filter(
      (row) => String(row.refundMethod || "").toLowerCase() === refundMethodFilter,
    );
  }, [returns, refundMethodFilter]);

  const handleExport = () => {
    if (!filteredReturns.length) {
      toast.error("No returns to export");
      return;
    }
    const rows = [
      ["Order ID", "Return ID", "Status", "Refund Method", "Refund Status", "Amount", "Customer", "Seller ID", "Requested At"],
      ...filteredReturns.map((row) => [
        row.orderId,
        row.returnId || row.id,
        row.returnStatus,
        row.refundMethod,
        row.refundStatus,
        row.returnRefundAmount,
        row.customer?.name || "",
        row.sellerId,
        row.returnRequestedAt,
      ]),
    ];
    const downloaded = downloadCsv(rows, `returns-${new Date().toISOString().split("T")[0]}.csv`);
    if (downloaded) toast.success("Returns exported");
  };

  const openReturnModal = async (row) => {
    const returnId = row.returnId || row.id;
    setSelectedReturn(row);
    setModalLoading(true);
    try {
      const res = await adminApi.getReturnById(returnId);
      setSelectedReturn(res?.data?.result || row);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load return details");
    } finally {
      setModalLoading(false);
    }
  };

  const runAction = async (action, returnId, body = {}) => {
    const setLoadingForAction =
      action === "quality"
        ? setQualityLoading
        : action === "refund"
          ? setRefundLoading
          : action === "payout"
            ? setConfirmPayoutLoading
            : setActionLoading;

    setLoadingForAction(true);
    try {
      let result;
      if (action === "refund") {
        result = await adminApi.processReturnRefund(returnId, body);
      } else if (action === "quality") {
        result = await adminApi.passReturnQualityCheck(returnId, body);
      } else if (action === "payout") {
        result = await adminApi.confirmReturnPayout(returnId, body);
      }

      const message =
        result?.data?.result?.message ||
        (action === "quality" && result?.data?.result?.refundQueued
          ? "Quality passed — refund is now pending"
          : "Action completed");
      toast.success(message);

      await fetchData(page, { silent: true });
      const detailRes = await adminApi.getReturnById(returnId);
      setSelectedReturn(detailRes?.data?.result || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Action failed");
    } finally {
      setLoadingForAction(false);
    }
  };

  const negativeCount = financeReport?.negativeBalanceSellers?.length || 0;
  const pendingRecoveries = financeReport?.pendingRecoveries?.length || 0;
  const pendingPayouts = financeReport?.pendingPayouts?.length || 0;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-red-500" />
            Returns Dashboard
          </h1>
          <p className="text-slate-600 text-sm mt-1">Manage return pickups, quality checks, and refunds.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchData(page)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Negative seller balance</p>
              <p className="text-2xl font-black text-slate-900">{negativeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pending recoveries</p>
              <p className="text-2xl font-black text-slate-900">{pendingRecoveries}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Package className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Pending payouts</p>
              <p className="text-2xl font-black text-slate-900">{pendingPayouts}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchData(1)}
                placeholder="Search order, customer..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <input
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              placeholder="Seller ID"
              className="lg:w-48 px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={refundMethodFilter}
              onChange={(e) => setRefundMethodFilter(e.target.value)}
              className="lg:w-40 px-4 py-2.5 rounded-xl border border-slate-200 text-sm"
            >
              <option value="all">All refund methods</option>
              <option value="wallet">Wallet</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank</option>
            </select>
            <button
              type="button"
              onClick={() => fetchData(1)}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
            >
              Apply
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id || "all"}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold border",
                  statusFilter === tab.id
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-white text-slate-600 border-slate-200",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="min-h-[280px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm font-medium">No returns found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Refund</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((row) => (
                  <tr key={row.returnId || row.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-bold text-slate-900">#{row.orderId}</td>
                    <td className="px-4 py-3">{row.customer?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px] font-black uppercase">
                        {resolveReturnLifecycleLabel(row)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {row.refundMethod || "—"}
                      {row.refundStatus && row.refundStatus !== "none"
                        ? ` / ${formatRefundStatusLabel(row.refundStatus)}`
                        : ""}
                    </td>
                    <td className="px-4 py-3 font-bold">₹{Number(row.returnRefundAmount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openReturnModal(row)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-slate-100">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={(next) => fetchData(next)}
            loading={loading}
          />
        </div>
      </Card>

      {selectedReturn && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-3xl xl:max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-lg">Return #{selectedReturn.orderId}</h3>
                <p className="text-xs text-slate-500">
                  {resolveReturnLifecycleLabel(selectedReturn)} · {mapReturnStatusLabel(selectedReturn.returnStatus)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedReturn(null)} className="text-slate-400 hover:text-slate-600 p-2">
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-sm text-slate-700">
              {modalLoading ? (
                <div className="py-16 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-1">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Customer</p>
                      <p className="font-black text-slate-900">{selectedReturn.customer?.name || "—"}</p>
                      <p className="text-xs text-slate-600">{selectedReturn.customer?.phone || "—"}</p>
                      {selectedReturn.customer?.email ? (
                        <p className="text-xs text-slate-500">{selectedReturn.customer.email}</p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-1 text-xs">
                      <p className="font-bold text-slate-800">Refund status</p>
                      <p>
                        Method:{" "}
                        <span className="font-bold capitalize">{selectedReturn.refundMethod || "—"}</span>
                      </p>
                      <p>
                        Status:{" "}
                        <span className="font-bold">
                          {selectedReturn.refundStatusLabel ||
                            formatRefundStatusLabel(selectedReturn.refundStatus)}
                        </span>
                      </p>
                      <p>
                        Lifecycle:{" "}
                        <span className="font-bold">{resolveReturnLifecycleLabel(selectedReturn)}</span>
                      </p>
                    </div>
                  </div>

                  <p>Reason: {selectedReturn.returnReason || "—"}</p>

                  <ReturnPayoutDetails
                    payoutDetails={selectedReturn.payoutDetails}
                    refundMethod={selectedReturn.refundMethod}
                  />

                  {selectedReturn.pickupFeeZeroWarning ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p>
                        Return pickup rider fee is ₹0. Configure the pickup fee in Quick Commerce
                        billing (this is the rider charge, not the Header Category return policy).
                      </p>
                    </div>
                  ) : null}

                  {(selectedReturn.pricing || selectedReturn.refundPricing) && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-1 text-xs">
                      <p className="font-bold text-slate-800">Refund breakdown</p>
                      <p>
                        Customer paid: ₹
                        {Number(
                          selectedReturn.pricing?.orderPaidTotal ??
                            selectedReturn.refundPricing?.orderPaidTotal ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Item refund: ₹
                        {Number(
                          selectedReturn.pricing?.subtotal ??
                            selectedReturn.refundPricing?.subtotal ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        GST refund: ₹
                        {Number(
                          selectedReturn.pricing?.taxShare ??
                            selectedReturn.refundPricing?.taxShare ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Coupon share: -₹
                        {Number(
                          selectedReturn.pricing?.couponShare ??
                            selectedReturn.refundPricing?.couponShare ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Delivery fee retained: ₹
                        {Number(
                          selectedReturn.pricing?.deliveryFeeRetained ??
                            selectedReturn.refundPricing?.deliveryFeeRetained ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Platform fee retained: ₹
                        {Number(
                          selectedReturn.pricing?.platformFeeRetained ??
                            selectedReturn.refundPricing?.platformFeeRetained ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Return delivery charge: ₹
                        {Number(
                          selectedReturn.calculatedPickupCharge ??
                            selectedReturn.returnPickupCharge ??
                            selectedReturn.pricing?.pickupFee ??
                            selectedReturn.returnDeliveryCommission ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Paid by:{" "}
                        {selectedReturn.pickupPaidBy === "seller" ||
                        Number(selectedReturn.finance?.pickupFeeDebited || 0) > 0
                          ? "Seller (historical)"
                          : "Admin"}
                      </p>
                      <p className="font-bold text-slate-900 pt-1">
                        Final refund: ₹
                        {Number(
                          selectedReturn.pricing?.finalRefundAmount ??
                            selectedReturn.returnRefundAmount ??
                            0,
                        ).toFixed(2)}
                      </p>
                      <p>
                        Remaining refundable: ₹
                        {Number(
                          selectedReturn.pricing?.remainingRefundableAmount ??
                            selectedReturn.refundPricing?.remainingRefundableAmount ??
                            0,
                        ).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-1 text-xs">
                    {selectedReturn.refundTransactionId ? (
                      <p>
                        Transaction ID:{" "}
                        <span className="font-mono text-[11px]">{selectedReturn.refundTransactionId}</span>
                      </p>
                    ) : null}
                    {selectedReturn.refundReference ? (
                      <p>
                        Reference:{" "}
                        <span className="font-mono text-[11px]">{selectedReturn.refundReference}</span>
                      </p>
                    ) : null}
                    {selectedReturn.finance ? (
                      <>
                        <p className="font-bold text-slate-800 pt-1">Seller finance</p>
                        <p>Ledger applied: {selectedReturn.finance.sellerLedgerApplied ? "Yes" : "No"}</p>
                        <p>Refund deduction: ₹{Number((selectedReturn.finance.preSettlementDeducted || 0) + (selectedReturn.finance.postSettlementDebited || 0)).toFixed(2)}</p>
                        <p>
                          Pickup fee debited from seller: ₹
                          {Number(selectedReturn.finance.pickupFeeDebited || 0).toFixed(2)}
                        </p>
                        <p>
                          Return delivery charge paid by admin: ₹
                          {Number(
                            selectedReturn.adminPickupFeeCharged ??
                              selectedReturn.finance.adminPickupFeeCharged ??
                              0,
                          ).toFixed(2)}
                        </p>
                        {selectedReturn.finance.settlementMode ? (
                          <p className="capitalize">Settlement: {selectedReturn.finance.settlementMode.replace(/_/g, " ")}</p>
                        ) : null}
                      </>
                    ) : null}
                  </div>

                  <ReturnPickupImageGallery entries={selectedReturn.pickupImageEntries} />

                  <ReturnItemsDetailList items={selectedReturn.returnItems} />

                </>
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <div className="flex flex-wrap gap-2">
                {selectedReturn.returnStatus === "returned" && (
                  <button
                    type="button"
                    disabled={anyModalActionLoading}
                    onClick={() =>
                      runAction("quality", selectedReturn.returnId || selectedReturn.id)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-60"
                  >
                    {qualityLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Quality Pass & Refund
                  </button>
                )}
                {selectedReturn.refundStatus === "pending" && (
                  <button
                    type="button"
                    disabled={anyModalActionLoading}
                    onClick={() =>
                      runAction("payout", selectedReturn.returnId || selectedReturn.id)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-60"
                  >
                    {confirmPayoutLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Confirm Payout
                  </button>
                )}
                {selectedReturn.returnStatus === "returned" &&
                  String(selectedReturn.refundMethod || "").toLowerCase() !== "wallet" &&
                  selectedReturn.refundStatus !== "completed" &&
                  selectedReturn.refundStatus !== "pending" && (
                  <button
                    type="button"
                    disabled={anyModalActionLoading}
                    onClick={() =>
                      runAction("refund", selectedReturn.returnId || selectedReturn.id)
                    }
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-60"
                  >
                    {refundLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    Process Refund
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;
