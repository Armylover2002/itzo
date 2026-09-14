import React, { useState, useMemo, useEffect } from "react";
import { 
  ArrowLeft,
  Loader2,
  Package,
  IndianRupee,
  Gift,
  Search,
  ChevronRight,
  TrendingUp,
  Receipt
} from "lucide-react";
import { formatCurrency } from "@food/utils/currency";
import WeekSelector from "@delivery/components/WeekSelector";
import { deliveryAPI } from "@food/api";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation";

export const PocketDetailsV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const location = useLocation();

  const moduleFilter = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = String(params.get("module") || "").trim().toLowerCase();
    if (!raw || raw === "all") return undefined;
    if (raw === "quick_commerce" || raw === "quick-commerce" || raw === "qc") return "quick";
    return raw;
  }, [location.search]);

  // Current week range (Sunday–Saturday)
  const getInitialWeekRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const [weekRange, setWeekRange] = useState(getInitialWeekRange);
  const [orders, setOrders] = useState([]);
  const [paymentTransactions, setPaymentTransactions] = useState([]);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [addonTransactions, setAddonTransactions] = useState([]);
  const [summaryData, setSummaryData] = useState({ totalEarning: 0, totalBonus: 0, totalAddon: 0, grandTotal: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await deliveryAPI.getPocketDetails({
          date: weekRange.start.toISOString(),
          ...(moduleFilter ? { module: moduleFilter } : {}),
          limit: 2000
        });

        const payload = response?.data?.data || {};
        const trips = payload?.trips || payload?.orders || [];
        const payments = payload?.transactions?.payment || [];
        const bonuses = payload?.transactions?.bonus || [];
        const summary = payload?.summary || {};

        setOrders(Array.isArray(trips) ? trips : []);
        setPaymentTransactions(Array.isArray(payments) ? payments : []);
        setBonusTransactions(Array.isArray(bonuses) ? bonuses : []);
        setAddonTransactions(Array.isArray(payload?.transactions?.addon) ? payload.transactions.addon : []);
        setSummaryData({
          totalEarning: Number(summary.totalEarning) || 0,
          totalBonus: Number(summary.totalBonus) || 0,
          totalAddon: Number(summary.totalAddon) || 0,
          grandTotal: Number(summary.grandTotal) || 0,
        });
      } catch (error) {
        setOrders([]);
        setPaymentTransactions([]);
        setBonusTransactions([]);
        setAddonTransactions([]);
        setSummaryData({ totalEarning: 0, totalBonus: 0, totalAddon: 0, grandTotal: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [weekRange, moduleFilter]);

  const summary = useMemo(() => {
    let totalEarning = 0;
    let totalBonus = 0;
    let totalAddon = 0;
    paymentTransactions.forEach((p) => { totalEarning += Number(p.amount) || 0; });
    bonusTransactions.forEach((b) => { totalBonus += Number(b.amount) || 0; });
    addonTransactions.forEach((a) => { totalAddon += Number(a.amount) || 0; });
    const orderEarning = summaryData.totalEarning || totalEarning;
    const weeklyBonus = summaryData.totalBonus || totalBonus;
    const addonEarning = summaryData.totalAddon || totalAddon;
    return {
      totalEarning: orderEarning,
      totalBonus: weeklyBonus,
      totalAddon: addonEarning,
      grandTotal: summaryData.grandTotal || (orderEarning + weeklyBonus + addonEarning),
    };
  }, [paymentTransactions, bonusTransactions, addonTransactions, summaryData]);

  const getOrderEarning = (orderId) => {
    const p = paymentTransactions.find(p => (p.orderId || p.metadata?.orderId) === orderId);
    if (p) return p.amount || 0;
    const order = orders.find(o => (o.orderId || o._id || o.id) === orderId);
    return order?.deliveryEarning || order?.earningAmount || order?.amount || 0;
  };

  const getOrderBonus = (orderId) => {
    const b = bonusTransactions.find(b => (b.orderId || b.metadata?.orderId) === orderId);
    return b ? b.amount : 0;
  };

  return (
    <div className="app-shell-page min-h-screen bg-gray-50 font-poppins">
      {/* ─── HEADER ─── */}
      <div className="app-shell-page__header safe-top bg-white border-b border-gray-100 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-900 border border-gray-100 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-950 uppercase tracking-tighter">Pocket Details</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Trips & Earnings History</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
          <Receipt className="w-5 h-5" />
        </div>
      </div>

      <div className="app-shell-page__body pb-12 px-5 py-6 space-y-6">
        {/* ─── WEEK SELECTOR (Matching V2 Aesthetics) ─── */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
           <WeekSelector 
             onChange={setWeekRange}
             weekStartsOn={0}
           />
        </div>

        {/* ─── SUMMARY CARD ─── */}
        <div className="bg-black rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors" />
           <div className="relative z-10">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Total Payout</p>
                    <h2 className="text-4xl font-black text-white tracking-tighter">{formatCurrency(summary.grandTotal)}</h2>
                 </div>
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/5 backdrop-blur-md">
                    <TrendingUp className="w-6 h-6 text-[#FF0000]" />
                 </div>
              </div>
                 <div className="grid grid-cols-3 gap-4">
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order Earning</p>
                    <p className="text-lg font-black text-white">{formatCurrency(summary.totalEarning)}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Addon Earning</p>
                    <p className="text-lg font-black text-blue-400">+{formatCurrency(summary.totalAddon)}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Weekly Bonus</p>
                    <p className="text-lg font-black text-green-500">+{formatCurrency(summary.totalBonus)}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* ─── ORDERS LIST ─── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest">Trips History</h3>
             <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-[10px] font-bold">{orders.length} Orders</span>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center">
              <Loader2 className="w-10 h-10 animate-spin text-[#FF0000]" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">Syncing History...</p>
            </div>
          ) : orders.length > 0 ? (
            <div className="grid gap-3">
              {orders.map((order, idx) => {
                const oid = order.orderId || order._id || order.id;
                const earning = getOrderEarning(oid);
                const bonus = getOrderBonus(oid);
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={oid}
                    className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-900 border border-gray-100">
                          <Package className="w-6 h-6" />
                       </div>
                       <div>
                          <div className="flex items-center gap-2 mb-0.5">
                             <h4 className="text-sm font-black text-gray-950 uppercase tracking-tight">#{oid.toString().slice(-6)}</h4>
                             <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">• {new Date(order.deliveredAt || order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                          </div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight truncate max-w-[140px]">
                            {order.restaurantName || order.restaurantId?.name || "Premium Restaurant"}
                          </p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-base font-black text-gray-950 leading-none mb-1">{formatCurrency(earning + bonus)}</p>
                       <div className="flex items-center justify-end gap-1.5">
                          {bonus > 0 && <span className="text-[9px] font-bold text-green-500 uppercase">+{formatCurrency(bonus)} BP</span>}
                          <div className={`px-2 py-0.5 rounded-md ${order.paymentMethod?.toLowerCase() === 'cod' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'} text-[8px] font-black uppercase`}>
                             {order.paymentMethod || 'Online'}
                          </div>
                       </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-100">
               <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-4 text-gray-200">
                  <Package className="w-8 h-8" />
               </div>
               <h3 className="text-lg font-black text-gray-950 uppercase tracking-tight">No Trips Found</h3>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Check another week Range</p>
            </div>
          )}
        </div>

        {/* ─── ADDON HISTORY ─── */}
        {addonTransactions && addonTransactions.length > 0 && (
           <div className="space-y-4 pt-4">
             <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-black text-gray-950 uppercase tracking-widest">Addon Earning History</h3>
                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold">{addonTransactions.length} Addons</span>
             </div>
             <div className="grid gap-3">
               {addonTransactions.map((addon, idx) => (
                 <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   transition={{ delay: idx * 0.05 }}
                   key={addon._id || idx}
                   className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-all"
                 >
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-100">
                         <Receipt className="w-6 h-6" />
                      </div>
                      <div>
                         <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-sm font-black text-gray-950 uppercase tracking-tight">Addon Earning</h4>
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">• {new Date(addon.date || addon.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                         </div>
                         <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight truncate max-w-[140px]">
                           {addon.description || "Bonus Credit"}
                         </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-base font-black text-blue-600 leading-none mb-1">+{formatCurrency(addon.amount)}</p>
                   </div>
                 </motion.div>
               ))}
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default PocketDetailsV2;
