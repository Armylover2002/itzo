import React, { useState, useMemo } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Input from "@shared/components/ui/Input";
import Button from "@shared/components/ui/Button";
import Modal from "@shared/components/ui/Modal";
import {
  HiOutlineCreditCard,
  HiOutlineArrowDownTray,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlineDocumentText,
  HiOutlineBanknotes,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowUpRight,
  HiOutlineArrowDownLeft,
  HiOutlineCalendarDays,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/exportUtils";
import { useSellerEarnings } from "../context/SellerEarningsContext";
import Pagination from "@shared/components/ui/Pagination";

const Transactions = () => {
  const { earningsData: data, earningsLoading: loading } = useSellerEarnings();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const stats = [
    {
      label: "Settled Balance",
      value: `₹${(data?.balances?.settledBalance || 0).toLocaleString()}`,
      icon: HiOutlineBanknotes,
      color: "text-emerald-950",
      bg: "bg-[#F0FDF4]",
      border: "border-emerald-200/80",
      iconBg: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Pending Payouts",
      value: `₹${(data?.balances?.pendingPayouts || 0).toLocaleString()}`,
      icon: HiOutlineClock,
      color: "text-amber-950",
      bg: "bg-[#FFFBEB]",
      border: "border-amber-200/80",
      iconBg: "bg-amber-100 text-amber-700",
    },
    {
      label: "Total Revenue",
      value: `₹${(data?.balances?.totalRevenue || 0).toLocaleString()}`,
      icon: HiOutlineCreditCard,
      color: "text-sky-950",
      bg: "bg-[#F0F9FF]",
      border: "border-sky-200/80",
      iconBg: "bg-sky-100 text-sky-700",
    },
    {
      label: "Ledger Entries",
      value: `${(data?.ledger?.length || 0).toLocaleString()} txns`,
      icon: HiOutlineDocumentText,
      color: "text-purple-950",
      bg: "bg-[#F5F3FF]",
      border: "border-purple-200/80",
      iconBg: "bg-purple-100 text-purple-700",
    },
  ];

  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const result = ledger.filter((txn) => {
      if (!term && activeTab === "All") return true;
      const id = (txn.id ?? txn.ref ?? "").toString().toLowerCase();
      const customer = (txn.customer ?? "").toString().toLowerCase();
      const ref = (txn.ref ?? "").toString().toLowerCase();
      const status = (txn.status ?? "").toString().toLowerCase();
      const type = (txn.type ?? "").toString().toLowerCase();
      const amount = Math.abs(Number(txn.amount ?? 0)).toString();
      const matchesSearch =
        !term ||
        id.includes(term) ||
        customer.includes(term) ||
        ref.includes(term) ||
        status.includes(term) ||
        type.includes(term) ||
        amount.includes(term);
      const txnType = (txn.type ?? "").toString();
      const matchesType = activeTab === "All" || txnType === activeTab;
      return matchesSearch && matchesType;
    });
    const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
    if (page > totalPages) {
      setPage(1);
    }
    return result;
  }, [searchTerm, activeTab, ledger, page, pageSize]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, page, pageSize]);

  const handleDownloadReceipt = (txn) => {
    try {
      const record = {
        id: txn.id ?? txn.ref ?? "",
        type: txn.type ?? "",
        amount: `₹${Math.abs(Number(txn.amount ?? 0)).toLocaleString()}`,
        status: txn.status ?? "",
        date:
          txn.date ??
          (txn.createdAt
            ? new Date(txn.createdAt).toLocaleDateString()
            : ""),
        time:
          txn.time ??
          (txn.createdAt
            ? new Date(txn.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""),
        customer: txn.customer ?? "",
        ref: txn.ref ?? "",
      };
      exportToCSV([record], `Transaction_${record.id || "receipt"}`, {
        id: "Transaction ID",
        type: "Type",
        amount: "Amount",
        status: "Status",
        date: "Date",
        time: "Time",
        customer: "Customer/Recipient",
        ref: "Reference",
      });
      toast.success("Receipt downloaded");
    } catch (error) {
      console.error("Receipt download error:", error);
      toast.error("Failed to download receipt");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen font-semibold text-xs text-slate-500">Loading transactions...</div>;
  }

  return (
    <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
      {/* Header Bar */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-2">
              Transaction Ledger
              <span className="text-[10px] px-2 py-0.5 font-medium uppercase tracking-wider rounded-md bg-red-100 text-red-700 border border-red-200">
                Audit Trail
              </span>
            </h1>
            <p className="text-xs font-normal text-slate-500 mt-0.5">
              Keep track of all financial movements, payouts, and settlements.
            </p>
          </div>
          <button
            onClick={() => {
              setIsDownloading(true);
              try {
                const exportData = filteredTransactions.map((txn) => ({
                  id: txn.id ?? txn.ref ?? "",
                  type: txn.type ?? "",
                  amount: `₹${Number(txn.amount ?? 0).toLocaleString()}`,
                  status: txn.status ?? "",
                  date: txn.date ?? (txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : ""),
                  time: txn.time ?? (txn.createdAt ? new Date(txn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""),
                  customer: txn.customer ?? "",
                  ref: txn.ref ?? "",
                }));

                exportToCSV(exportData, "Seller_Transactions", {
                  id: "Transaction ID",
                  type: "Type",
                  amount: "Amount",
                  status: "Status",
                  date: "Date",
                  time: "Time",
                  customer: "Customer",
                  ref: "Reference"
                });
                toast.success("Statement downloaded successfully!");
              } catch (error) {
                console.error("Download Error:", error);
                toast.error("Failed to download statement");
              } finally {
                setIsDownloading(false);
              }
            }}
            disabled={isDownloading || filteredTransactions.length === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50">
            <HiOutlineDocumentText className="h-3.5 w-3.5 text-white" />
            <span>{isDownloading ? "Downloading..." : "Export Statement"}</span>
          </button>
        </div>
      </BlurFade>

      {/* 2-by-2 Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        {stats.map((stat, i) => (
          <BlurFade key={i} delay={0.1 + i * 0.05}>
            <div
              className={cn(
                "p-3 sm:p-3.5 rounded-xl border shadow-2xs flex items-center justify-between gap-2.5 transition-all",
                stat.bg,
                stat.border
              )}>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-slate-600 truncate uppercase tracking-wider">
                  {stat.label}
                </p>
                <h4 className={cn("text-base sm:text-lg font-semibold tracking-tight mt-0.5 truncate", stat.color)}>
                  {stat.value}
                </h4>
              </div>
              <div className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs", stat.iconBg)}>
                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </BlurFade>
        ))}
      </div>

      <BlurFade delay={0.3}>
        <div className="border border-slate-200/80 shadow-xs overflow-hidden rounded-xl bg-white space-y-3 p-3.5 sm:p-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60 shrink-0 min-w-max">
                {["All", "Order Payment", "Withdrawal", "Refund"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                      activeTab === tab
                        ? "bg-white text-[#1c1c1e] shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900",
                    )}>
                    {tab === "Order Payment" ? "Payments" : tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                placeholder="Search transaction..."
                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px] text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">
                    Transaction Details
                  </th>
                  <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">
                    Reference / Customer
                  </th>
                  <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">
                    Amount
                  </th>
                  <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">
                    Status
                  </th>
                  <th className="px-3.5 py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px] text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-xs font-normal">
                        {ledger.length === 0 ? "No transactions recorded yet." : "No matches found for active search filter."}
                      </td>
                    </tr>
                  ) : paginatedTransactions.map((txn, idx) => (
                    <motion.tr
                      key={txn.id || txn.ref || txn.reference || `txn-${idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => {
                        setSelectedTxn(txn);
                        setIsDetailModalOpen(true);
                      }}
                      className="group hover:bg-slate-50/70 transition-colors cursor-pointer">
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "h-7 w-7 rounded-md flex items-center justify-center font-semibold text-xs transition-transform group-hover:scale-105 shrink-0",
                              Number(txn.amount ?? 0) > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700",
                            )}>
                            {Number(txn.amount ?? 0) > 0 ? (
                              <HiOutlineArrowDownLeft className="h-3.5 w-3.5" />
                            ) : (
                              <HiOutlineArrowUpRight className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[#1c1c1e] group-hover:text-red-600 transition-colors truncate">
                              {txn.id ?? txn.ref ?? "—"}
                            </p>
                            <p className="text-[10px] font-normal text-slate-500 uppercase tracking-wider">
                              {txn.type ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {txn.customer ?? "—"}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] px-1 py-0 bg-slate-100 text-slate-600 font-mono rounded border border-slate-200">
                            {txn.ref ?? "—"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            • {txn.date ?? (txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : "—")}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <p
                          className={cn(
                            "text-xs font-semibold tracking-tight tabular-nums",
                            Number(txn.amount ?? 0) > 0
                              ? "text-emerald-700"
                              : "text-rose-700",
                          )}>
                          {Number(txn.amount ?? 0) > 0 ? "+" : ""}₹
                          {Math.abs(Number(txn.amount ?? 0)).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500 font-normal">
                          Settlement: {(txn.status ?? "") === "Settled" ? "Complete" : "T+2"}
                        </p>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            txn.status === "Settled"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}>
                          {txn.status === "Settled" ? (
                            <HiOutlineCheckCircle className="mr-1 h-3 w-3" />
                          ) : (
                            <HiOutlineClock className="mr-1 h-3 w-3" />
                          )}
                          {txn.status || "Pending"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadReceipt(txn);
                          }}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors ml-auto">
                          <HiOutlineArrowDownTray className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredTransactions.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(filteredTransactions.length / pageSize))}
                total={filteredTransactions.length}
                pageSize={pageSize}
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                loading={loading}
              />
            </div>
          )}
        </div>
      </BlurFade>

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Transaction Receipt">
        {selectedTxn && (
          <div className="space-y-6">
            <div className="text-center p-6 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">
                Total Amount
              </p>
              <h2
                className={cn(
                  "text-4xl font-black tracking-tight",
                  Number(selectedTxn.amount ?? 0) > 0 ? "text-emerald-600" : "text-rose-600",
                )}>
                {Number(selectedTxn.amount ?? 0) > 0 ? "+" : ""}₹
                {Math.abs(Number(selectedTxn.amount ?? 0)).toLocaleString()}
              </h2>
              <Badge className="mt-4 uppercase font-black text-[10px] sm:text-xs px-3 py-1">
                {selectedTxn.status ?? "—"}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Transaction ID</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.id ?? selectedTxn.ref ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Type</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.type ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">
                  Customer/Recipient
                </span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.customer ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Reference</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.ref ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Date & Time</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.date && selectedTxn.time
                    ? `${selectedTxn.date} at ${selectedTxn.time}`
                    : selectedTxn.createdAt
                      ? `${new Date(selectedTxn.createdAt).toLocaleDateString()} at ${new Date(selectedTxn.createdAt).toLocaleTimeString()}`
                      : "—"}
                </span>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex gap-3">
              <HiOutlineClock className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                This transaction is scheduled for settlement in your bank
                account via T+2 rolling cycle. Settlements usually occur before
                6:00 PM.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="rounded-lg py-4 font-black bg-white">
                PRINT RECEIPT
              </Button>
              <Button
                onClick={() => setIsDetailModalOpen(false)}
                className="rounded-lg py-4 font-black shadow-xl shadow-red-500/20">
                CLOSE
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
