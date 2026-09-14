import React from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import {
  TrendingUp,
  BarChart3,
  IndianRupee,
  Download,
  Banknote,
  ArrowDownToLine,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";
import ShimmerButton from "@/components/ui/shimmer-button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { exportToCSV } from "@/lib/exportUtils";
import { useSellerEarnings } from "../context/SellerEarningsContext";

const Earnings = () => {
  const navigate = useNavigate();
  const { earningsData: data, earningsLoading: loading, refreshEarnings } = useSellerEarnings();
  const [withdrawAmount, setWithdrawAmount] = React.useState("");
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = React.useState(false);
  const [isWithdrawing, setIsWithdrawing] = React.useState(false);

  React.useEffect(() => {
    if (data?.balances != null && withdrawAmount === "") {
      const settled = Number(data.balances?.settledBalance ?? 0);
      setWithdrawAmount(settled > 0 ? String(settled) : "");
    }
  }, [data?.balances]);

  const handleWithdraw = () => {
    const totalBalance = Number(data?.balances?.settledBalance ?? 0);
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0 || amount > totalBalance) {
      alert(
        "Please enter a valid amount between ₹0.01 and ₹" +
        totalBalance.toLocaleString(),
      );
      return;
    }

    setIsWithdrawing(true);
    setTimeout(() => {
      setIsWithdrawing(false);
      setIsWithdrawModalOpen(false);
      alert(
        `Withdrawal request of ₹${amount.toLocaleString()} submitted successfully!`,
      );
    }, 1500);
  };

  const exportReport = () => {
    alert("Exporting monthly earnings report as PDF (Simulation)");
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen font-black text-slate-600">LOADING EARNINGS...</div>;
  }
  return (
    <div className="space-y-4 px-3.5 md:px-4 max-w-7xl md:max-w-none mx-auto w-full pb-20">
      {/* Header Bar */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight">
              Earnings Overview
            </h1>
            <p className="text-xs font-normal text-slate-500 mt-0.5">
              Track your sales, commissions, and payout history.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                try {
                  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
                  if (ledger.length === 0) {
                    toast.info("No transactions to export.");
                    return;
                  }
                  const exportData = ledger.map((txn) => ({
                    id: String(txn?.id ?? txn?.ref ?? ""),
                    type: String(txn?.type ?? ""),
                    amount: `₹${Number(txn?.amount ?? 0).toLocaleString("en-IN")}`,
                    status: String(txn?.status ?? ""),
                    date: String(
                      txn?.date ||
                        (txn?.createdAt ? new Date(txn.createdAt).toLocaleDateString("en-IN") : ""),
                    ),
                    customer: String(txn?.customer ?? ""),
                    ref: String(txn?.ref ?? txn?.orderId ?? ""),
                  }));
                  exportToCSV(exportData, "Seller_Earnings_Report", {
                    id: "Transaction ID",
                    type: "Type",
                    amount: "Amount",
                    status: "Status",
                    date: "Date",
                    customer: "Customer",
                    ref: "Reference",
                  });
                  toast.success("Earnings report downloaded successfully!");
                } catch (error) {
                  console.error(error);
                  toast.error("Failed to download earnings report");
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-xs transition-all cursor-pointer">
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span>Download Report</span>
            </button>
            <button
              onClick={() => navigate("/seller/withdrawals")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-all cursor-pointer">
              <Banknote className="h-3.5 w-3.5 text-white" />
              <span>Withdraw Funds</span>
            </button>
          </div>
        </div>
      </BlurFade>

      {/* Top 2 Cards: Hero Net Earnings + Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <BlurFade delay={0.2}>
          <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-br from-[#F0FDF4] via-[#E8F8EE] to-[#F0FDF4] p-3.5 sm:p-4 shadow-xs h-full flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-emerald-800">Total Net Earnings</p>
                <h3 className={cn(
                  "text-2xl sm:text-3xl font-semibold mt-1 tracking-tight text-emerald-950",
                  Number(data?.balances?.totalNetEarnings ?? 0) < 0 && "text-rose-600",
                )}>
                  ₹{Number(data?.balances?.totalNetEarnings ?? 0).toLocaleString()}
                </h3>
                <p className="text-[11px] text-emerald-700/80 mt-1">After commission & seller coupons</p>
              </div>
              <div className="p-2 bg-emerald-200/60 rounded-lg shrink-0 text-emerald-800">
                <IndianRupee className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-800 bg-white/90 border border-emerald-300/80 px-2.5 py-1 rounded-full w-fit shadow-2xs font-medium">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>Real-time earnings data</span>
            </div>
          </div>
        </BlurFade>

        <BlurFade delay={0.3}>
          <Card className="h-full border-none shadow-md bg-white p-6 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
              <div className="w-full">
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">
                  Earnings Breakdown
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Gross Sales</span>
                    <span className="text-slate-900 font-bold">₹{Number(data?.balances?.grossSales ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Admin Commission</span>
                    <span className="text-rose-500 font-bold">- ₹{Number(data?.balances?.totalCommission ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Seller Coupon Discount</span>
                    <span className="text-rose-500 font-bold">- ₹{Number(data?.balances?.totalCouponDiscount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Packing Fees</span>
                    <span className="text-emerald-600 font-bold">+ ₹{Number(data?.balances?.totalPackingFee ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-slate-900 font-black">Net Payout</span>
                    <span className={cn(
                      "font-black",
                      Number(data?.balances?.totalNetEarnings ?? 0) < 0 ? "text-rose-600" : "text-emerald-600",
                    )}>
                      ₹{Number(data?.balances?.totalNetEarnings ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed pt-1">
                    Admin coupons do not reduce seller payout. Net = Gross − Commission − Seller coupons + Packing.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </BlurFade>
      </div>

      {/* 3 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
        <BlurFade delay={0.35}>
          <div className="rounded-xl border border-emerald-200/60 bg-[#F0FDF4] p-3 sm:p-3.5 shadow-xs flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-medium text-emerald-800 tracking-tight truncate">
                Available to Withdraw
              </p>
              <h2 className="text-lg sm:text-xl font-semibold text-emerald-700 tracking-tight mt-0.5">
                ₹{Number(data?.balances?.settledBalance ?? 0).toLocaleString()}
              </h2>
            </div>
            <div className="p-2 bg-emerald-100/80 rounded-lg text-emerald-700 shrink-0 flex items-center justify-center">
              <ArrowDownToLine className="h-4 w-4" />
            </div>
          </div>
        </BlurFade>

        <BlurFade delay={0.4}>
          <div className="rounded-xl border border-sky-200/60 bg-[#F0F9FF] p-3 sm:p-3.5 shadow-xs flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-medium text-sky-800 tracking-tight truncate">
                Total Withdrawn
              </p>
              <h2 className="text-lg sm:text-xl font-semibold text-sky-700 tracking-tight mt-0.5">
                ₹{Number(data?.balances?.totalWithdrawn ?? 0).toLocaleString()}
              </h2>
            </div>
            <div className="p-2 bg-sky-100/80 rounded-lg text-sky-700 shrink-0 flex items-center justify-center">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
        </BlurFade>

        <BlurFade delay={0.45}>
          <div className="rounded-xl border border-amber-200/60 bg-[#FFFBEB] p-3 sm:p-3.5 shadow-xs flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="text-xs font-medium text-amber-800 tracking-tight truncate">
                Pending Payouts
              </p>
              <h2 className="text-lg sm:text-xl font-semibold text-amber-700 tracking-tight mt-0.5">
                ₹{Number(data?.balances?.pendingPayouts ?? 0).toLocaleString()}
              </h2>
            </div>
            <div className="p-2 bg-amber-100/80 rounded-lg text-amber-700 shrink-0 flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
        </BlurFade>
      </div>

      {/* Revenue Chart */}
      <BlurFade delay={0.4}>
        <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
            <h3 className="text-xs sm:text-sm font-semibold text-[#1c1c1e] flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-red-500" />
              Monthly Revenue Performance
            </h3>
          </div>
          <div className="h-[220px] sm:h-[250px] w-full flex items-center justify-center">
            {(Array.isArray(data?.monthlyChart) ? data.monthlyChart : []).length === 0 ? (
              <p className="text-slate-500 text-xs font-medium">No monthly revenue data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyChart}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="url(#colorRevenue)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={1} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </BlurFade>

      {/* Withdrawal Modal */}
      <AnimatePresence>
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md relative z-10 bg-white rounded-lg shadow-2xl overflow-hidden p-8 text-center">
              <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Banknote className="h-8 w-8 text-emerald-600" />
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Withdraw Funds
              </h2>
              <p className="text-sm text-slate-600 font-medium mb-8">
                Available Balance:{" "}
                <span className="text-emerald-600 font-bold">
                  ₹{Number(data?.balances?.settledBalance ?? 0).toLocaleString()}
                </span>
              </p>

              <div className="space-y-4 text-left">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold">
                      ₹
                    </span>
                    <input
                      type="number"
                      className="w-full pl-8 pr-4 py-3 rounded-lg border-slate-200 bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                    Select Bank Account
                  </label>
                  <div className="p-4 border border-slate-200 rounded-lg flex items-center gap-4 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/10 transition-all group">
                    <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-black text-slate-900">
                        HDFC Bank **** 4589
                      </p>
                      <p className="text-xs text-slate-600 font-bold">
                        Primary Account
                      </p>
                    </div>
                    <div className="h-5 w-5 rounded-full border-2 border-slate-200 group-hover:border-emerald-500 group-hover:bg-emerald-500 transition-all"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="py-3 rounded-lg font-black text-slate-600 hover:bg-slate-50 transition-colors">
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    setIsWithdrawModalOpen(false);
                    alert("Withdrawal request submitted!");
                  }}
                  className="py-3 rounded-lg bg-emerald-600 text-white font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 hover:shadow-emerald-300 transition-all">
                  CONFIRM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Earnings;
