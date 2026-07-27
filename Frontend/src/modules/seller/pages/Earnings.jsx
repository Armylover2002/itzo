import React from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import {
  TrendingUp,
  BarChart3,
  DollarSign,
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
    <div className="space-y-8 pb-16">
      <BlurFade delay={0.1}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800 hidden md:block">
            Earnings Overview
          </h2>
          <div className="flex space-x-3">
            <Button
              onClick={() => {
                const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
                if (ledger.length === 0) {
                  toast.info("No transactions to export.");
                  return;
                }
                const exportData = ledger.map((txn) => ({
                  id: txn.id ?? txn.ref ?? "",
                  type: txn.type ?? "",
                  amount: `₹${Number(txn.amount ?? 0).toLocaleString()}`,
                  status: txn.status ?? "",
                  date: txn.date ?? (txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : ""),
                  customer: txn.customer ?? "",
                  ref: txn.ref ?? "",
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
              }}
              variant="outline"
              className="border-gray-200">
              <Download className="mr-2 h-5 w-5" />
              Download Report
            </Button>
            <ShimmerButton
              onClick={() => navigate("/seller/withdrawals")}
              className="px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg bg-primary-orange hover:bg-primary-hover active:bg-primary-dark transition-colors"
              background="#FE5502">
              <span className="text-white">Withdraw Funds</span>
            </ShimmerButton>
          </div>
        </div>
      </BlurFade>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BlurFade delay={0.2}>
          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 text-white border-none shadow-lg h-full">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-orange-100 font-medium">Total Net Earnings</p>
                <h3 className="text-4xl font-bold mt-2">₹{Number(data?.balances?.totalNetEarnings ?? 0).toLocaleString()}</h3>
                <p className="text-xs text-orange-200 mt-2">After all deductions</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
            </div>
            <div className="mt-8 flex items-center text-orange-100 bg-white/10 w-fit px-3 py-1 rounded-full text-sm">
              <TrendingUp className="mr-2" />
              <span>Real-time earnings data</span>
            </div>
          </Card>
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
                    <span className="text-slate-500 font-medium">Gross Sales (Incl. Delivery)</span>
                    <span className="text-slate-900 font-bold">₹{Number(data?.balances?.grossSales ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">ECS Commission</span>
                    <span className="text-rose-500 font-bold">- ₹{Number(data?.balances?.totalCommission ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Delivery Charges</span>
                    <span className="text-rose-500 font-bold">- ₹{Number(data?.balances?.deliveryFees ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-slate-900 font-black">Net Payout</span>
                    <span className="text-primary-orange font-black">₹{Number(data?.balances?.totalNetEarnings ?? 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </BlurFade>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <BlurFade delay={0.35}>
          <Card className="border-none shadow-md bg-white p-6 group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">
                  Available to Withdraw
                </p>
                <h2 className="text-2xl font-black text-primary-orange tracking-tight">
                  ₹{Number(data?.balances?.settledBalance ?? 0).toLocaleString()}
                </h2>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <ArrowDownToLine className="h-5 w-5 text-primary-orange" />
              </div>
            </div>
          </Card>
        </BlurFade>

        <BlurFade delay={0.4}>
          <Card className="border-none shadow-md bg-white p-6 group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">
                  Total Withdrawn
                </p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  ₹{Number(data?.balances?.totalWithdrawn ?? 0).toLocaleString()}
                </h2>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <Banknote className="h-5 w-5 text-primary-orange" />
              </div>
            </div>
          </Card>
        </BlurFade>

        <BlurFade delay={0.45}>
          <Card className="border-none shadow-md bg-white p-6 group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">
                  Pending Payouts
                </p>
                <h2 className="text-2xl font-black text-amber-600 tracking-tight">
                  ₹{Number(data?.balances?.pendingPayouts ?? 0).toLocaleString()}
                </h2>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <BarChart3 className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </Card>
        </BlurFade>
      </div>

      <BlurFade delay={0.4}>
        <Card className="p-6 border-none shadow-md bg-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary-orange" />
              Monthly Revenue Performance
            </h3>
          </div>
          <div className="h-[300px] w-full min-h-[200px] flex items-center justify-center">
            {(Array.isArray(data?.monthlyChart) ? data.monthlyChart : []).length === 0 ? (
              <p className="text-slate-600 text-sm font-medium">No monthly revenue data yet.</p>
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
        </Card>
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
              <div className="h-16 w-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Banknote className="h-8 w-8 text-primary-orange" />
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-2">
                Withdraw Funds
              </h2>
              <p className="text-sm text-slate-600 font-medium mb-8">
                Available Balance:{" "}
                <span className="text-primary-orange font-bold">
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
                      className="w-full pl-8 pr-4 py-3 rounded-lg border-slate-200 bg-slate-50 font-bold text-slate-900 focus:ring-2 focus:ring-orange-500/20 focus:border-[#FE5502] transition-all outline-none"
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
                  <div className="p-4 border border-slate-200 rounded-lg flex items-center gap-4 cursor-pointer hover:border-[#FE5502] hover:bg-orange-50/10 transition-all group">
                    <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 group-hover:bg-orange-100 group-hover:text-primary-orange transition-colors">
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
                    <div className="h-5 w-5 rounded-full border-2 border-slate-200 group-hover:border-[#FE5502] group-hover:bg-[#FE5502] transition-all"></div>
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
                  className="py-3 rounded-lg bg-[#FE5502] hover:bg-[#c83c00] text-white font-black shadow-lg shadow-orange-500/20 transition-all">
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
