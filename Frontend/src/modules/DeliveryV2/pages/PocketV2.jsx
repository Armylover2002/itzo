import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, IndianRupee, ArrowRight,
  ShieldCheck, AlertTriangle, HelpCircle,
  Receipt, FileText, LayoutGrid, X, ChevronRight,
  Sparkles, Loader2, Gift
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import DepositPopup from '../components/DepositPopup';

/**
 * PocketV2 - 1:1 Match with Old PocketPage UI.
 * Background: #f6e9dc
 * Font: Poppins
 */
export const PocketV2 = () => {
  const navigate = useNavigate();
  const getAvailableModules = useDeliveryStore(state => state.getAvailableModules);
  const availableModules = getAvailableModules();
  const [activeModuleFilter, setActiveModuleFilter] = useState('all');
  const [walletState, setWalletState] = useState(() => {
    try {
      const cached = sessionStorage.getItem('deliveryWalletState');
      if (cached) return JSON.parse(cached);
    } catch(e) {}
    return {
      totalBalance: 0,
      cashInHand: 0,
      availableCashLimit: 0,
      totalCashLimit: 0,
      weeklyEarnings: 0,
      weeklyOrders: 0,
      payoutAmount: 0,
      payoutPeriod: 'Current Week',
      totalBonus: 0,
      bankDetailsFilled: false
    };
  });

  const [loading, setLoading] = useState(() => {
    return !sessionStorage.getItem('deliveryWalletState');
  });

  const [activeOffer, setActiveOffer] = useState({
    targetAmount: 0,
    targetOrders: 0,
    currentOrders: 0,
    currentEarnings: 0,
    validTill: '',
    isLive: false
  });

  const [showDepositPopup, setShowDepositPopup] = useState(false);

  const normalizeModuleFilter = useCallback((moduleValue) => {
    const raw = String(moduleValue || "").trim().toLowerCase();
    if (!raw || raw === "all") return "all";
    if (raw === "quick_commerce" || raw === "quick-commerce" || raw === "qc") return "quick";
    return raw;
  }, []);

  useEffect(() => {
    sessionStorage.setItem('deliveryWalletState', JSON.stringify(walletState));
  }, [walletState]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [profileRes, walletRes, activeAddonsRes] = await Promise.all([
          deliveryAPI.getProfile(),
          deliveryAPI.getWallet(),
          deliveryAPI.getActiveEarningAddons().catch(() => null)
        ]);

        const profile = profileRes?.data?.data?.profile || {};
        const wallet = walletRes?.data?.data?.wallet || {};
        const activeOfferPayload =
          activeAddonsRes?.data?.data?.activeOffer ||
          activeAddonsRes?.data?.activeOffer ||
          null;
        
        const bankDetails = profile?.documents?.bankDetails;
        const isFilled = !!(bankDetails?.accountNumber);

        setWalletState(prev => ({
          ...prev,
          totalBalance: Number(wallet.pocketBalance) || 0,
          cashInHand: Number(wallet.cashInHand) || 0,
          availableCashLimit: Number(wallet.availableCashLimit) || 0,
          totalCashLimit: Number(wallet.totalCashLimit) || 0,
          payoutAmount: Number(wallet.lastPayout?.amount || wallet.totalWithdrawn || 0),
          payoutPeriod: wallet.lastPayout ? new Date(wallet.lastPayout.date).toLocaleDateString() : 'No recent payout',
          totalBonus: Number(wallet.totalBonus) || 0,
          bankDetailsFilled: isFilled
        }));

        setActiveOffer({
           targetAmount: Number(activeOfferPayload?.targetAmount) || 0,
           targetOrders: Number(activeOfferPayload?.targetOrders) || 0,
           currentOrders: Number(activeOfferPayload?.currentOrders) || 0,
           currentEarnings: Number(activeOfferPayload?.currentEarnings) || 0,
           validTill: activeOfferPayload?.validTill || '',
           isLive: Boolean(activeOfferPayload)
        });

      } catch (err) {
        // Silently fail if refreshing
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const earningsRes = await deliveryAPI.getEarnings({ 
          period: 'week', 
          ...(normalizeModuleFilter(activeModuleFilter) !== 'all' && {
            module: normalizeModuleFilter(activeModuleFilter),
          })
        });
        const summary = earningsRes?.data?.data?.summary || {};
        setWalletState(prev => ({
          ...prev,
          weeklyEarnings: Number(summary.totalEarnings) || 0,
          weeklyOrders: Number(summary.totalOrders) || 0,
        }));
      } catch (err) {
        // Ignore background failure
      }
    };
    fetchEarnings();
  }, [activeModuleFilter, normalizeModuleFilter]);

  const handleDepositSuccess = useCallback(() => {
    setShowDepositPopup(false);
    // Re-fetch wallet data after successful deposit
    deliveryAPI.getWallet()
      .then(res => {
        const wallet = res?.data?.data?.wallet || {};
        setWalletState(prev => ({
          ...prev,
          cashInHand: Number(wallet.cashInHand) || 0,
          availableCashLimit: Number(wallet.availableCashLimit) || 0,
          totalCashLimit: Number(wallet.totalCashLimit) || 0,
          totalBalance: Number(wallet.pocketBalance) || 0,
        }));
      })
      .catch(() => {});
  }, []);

  const ordersProgress = activeOffer.targetOrders > 0 ? Math.min(activeOffer.currentOrders / activeOffer.targetOrders, 1) : 0;
  const earningsProgress = activeOffer.targetAmount > 0 ? Math.min(activeOffer.currentEarnings / activeOffer.targetAmount, 1) : 0;
  const hasActiveOffer = activeOffer.isLive && (activeOffer.targetAmount > 0 || activeOffer.targetOrders > 0);

  const formatOfferValidTill = (validTill) => {
    if (!validTill) return '';
    const parsed = new Date(validTill);
    if (Number.isNaN(parsed.getTime())) return String(validTill);
    return parsed.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const formatDate = (d) => `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`;
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-[#f6e9dc] flex flex-col items-center justify-center font-poppins">
       <div className="w-10 h-10 border-4 border-[#FF0000] border-t-transparent rounded-full animate-spin mb-4" />
       <p className="text-xs font-semibold text-gray-500">Loading Pocket...</p>
    </div>
  );

  return (
    <div className="app-shell-page min-h-screen bg-[#f6e9dc] font-poppins">
       
       {/* 0. Header */}
       <div className="app-shell-page__header safe-top bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#FF0000] border border-red-100">
                <Wallet className="w-5 h-5" />
             </div>
             <div>
                <h1 className="text-xl font-black text-gray-950 uppercase tracking-tighter">Pocket History</h1>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Earnings & Wallet Hub</p>
             </div>
          </div>
       </div>
       <div className="app-shell-page__body pb-32">
       {/* 1. BANK DETAILS BANNER */}
       {!walletState.bankDetailsFilled && (
         <div className="bg-yellow-400 px-4 py-3 flex items-center gap-3 border-b border-yellow-500/20">
            <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-white shrink-0 shadow-lg">
               <FileText className="w-7 h-7" />
            </div>
            <div className="flex-1">
               <h3 className="text-sm font-bold text-black mb-0.5">Submit bank details</h3>
               <p className="text-xs text-black/80 font-medium">PAN & bank details required for payouts</p>
            </div>
            <button 
              onClick={() => navigate('/food/delivery/profile/details')}
              className="bg-yellow-300 text-black px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm"
            >
               Submit
            </button>
         </div>
       )}

       <div className="px-4 py-6 bg-gray-100">
          
          {/* 1.5 MODULE FILTERS */}
          {availableModules && availableModules.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
              <button
                onClick={() => setActiveModuleFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                  activeModuleFilter === 'all' 
                    ? 'bg-black text-white shadow-md' 
                    : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                All
              </button>
              {availableModules.map(mod => (
                <button
                  key={mod}
                  onClick={() => setActiveModuleFilter(normalizeModuleFilter(mod))}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                    activeModuleFilter === normalizeModuleFilter(mod)
                      ? 'bg-black text-white shadow-md' 
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {normalizeModuleFilter(mod).replace('_', ' ')}
                </button>
              ))}
            </div>
          )}

          {/* 2. WEEKLY EARNINGS CARD */}
          <div 
            onClick={() => {
              const normalizedModule = normalizeModuleFilter(activeModuleFilter);
              navigate(
                normalizedModule !== "all"
                  ? `/food/delivery/pocket/details?module=${encodeURIComponent(normalizedModule)}`
                  : "/food/delivery/pocket/details"
              );
            }}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center mb-5 transition-all active:scale-[0.98]"
          >
             <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest mb-2">Earnings: {getCurrentWeekRange()}</p>
             <h2 className="text-4xl font-black text-black tracking-tighter">
                ₹{walletState.weeklyEarnings.toFixed(2)}
             </h2>
          </div>

          {/* 3. EARNINGS GUARANTEE - API DRIVEN (NO STATIC VALUES) */}
          {hasActiveOffer && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 mb-6">
             <div className="bg-black p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-white leading-none mb-1">Earnings Guarantee</h3>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Valid till {formatOfferValidTill(activeOffer.validTill)}</span>
                     {activeOffer.isLive && (
                       <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-bold text-green-500 uppercase">Live</span>
                       </div>
                     )}
                  </div>
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl text-center border border-white/5">
                   <p className="text-lg font-black text-white leading-none mb-0.5">₹{activeOffer.targetAmount}</p>
                   <p className="text-[9px] font-bold text-gray-400 uppercase">{activeOffer.targetOrders} orders</p>
                </div>
             </div>

             <div className="p-8 pb-10 flex items-center justify-around gap-8">
                {/* Orders Circle */}
                <div className="flex flex-col items-center">
                   <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                         <motion.circle 
                            cx="50" cy="50" r="45" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round"
                            initial={{ pathLength: 0 }} animate={{ pathLength: ordersProgress }} transition={{ duration: 1.5, ease: "easeOut" }}
                         />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                         <span className="text-xl font-black text-black leading-none">{activeOffer.currentOrders}</span>
                         <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">of {activeOffer.targetOrders}</span>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4">Orders Done</p>
                </div>

                {/* Earnings Circle */}
                <div className="flex flex-col items-center">
                   <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                         <motion.circle 
                            cx="50" cy="50" r="45" fill="none" stroke="#FF0000" strokeWidth="8" strokeLinecap="round"
                            initial={{ pathLength: 0 }} animate={{ pathLength: earningsProgress }} transition={{ duration: 1.5, ease: "easeOut" }}
                         />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                         <span className="text-base font-black text-black leading-none truncate">₹{activeOffer.currentEarnings}</span>
                      </div>
                   </div>
                   <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4">Earned Yet</p>
                </div>
             </div>
          </div>
          )}

          {/* 4. POCKET ACTION BUTTONS */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
             <button 
                onClick={() => navigate('/food/delivery/pocket/balance')}
                className="w-full p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50"
             >
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-black border border-gray-100">
                      <Wallet className="w-6 h-6" />
                   </div>
                   <div>
                      <span className="text-sm font-bold text-gray-800 block">Pocket balance</span>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Withdrawal Hub</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-base font-black text-black">₹{walletState.totalBalance.toFixed(2)}</span>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
             </button>

             <button 
                onClick={() => navigate('/food/delivery/pocket/cash-limit')}
                className="w-full p-5 border-b border-gray-50 flex items-center justify-between active:bg-gray-50"
             >
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-black border border-gray-100">
                      <ShieldCheck className="w-6 h-6" />
                   </div>
                   <div>
                      <span className="text-sm font-bold text-gray-800 block">Available cash limit</span>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Spend Control</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-base font-black text-black">₹{walletState.availableCashLimit.toFixed(2)}</span>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
             </button>

             <div className="p-5">
                <button 
                   onClick={() => setShowDepositPopup(true)}
                   className="w-full py-4 bg-[#FF0000] hover:bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                   Deposit Cash
                </button>
             </div>
          </div>

          {/* 5. MORE SERVICES - Vertical List */}
          <div className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div onClick={() => navigate('/food/delivery/pocket/payout')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50">
                   <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100">
                      <IndianRupee className="w-5 h-5" />
                   </div>
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Last Payout</p>
                   <p className="text-xl font-black text-black leading-none mb-1">₹{walletState.payoutAmount}</p>
                   <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">Prev Week Info</p>
                </div>

                <div onClick={() => navigate('/food/delivery/pocket/limit-settlement')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between">
                   <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-[#FF0000] mb-4 border border-red-100">
                      <Receipt className="w-5 h-5" />
                   </div>
                   <p className="text-sm font-bold text-gray-800 leading-tight">Limit Settlement</p>
                </div>
             </div>

             {/* Referral Bonus Row */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:bg-gray-50 transition-all" onClick={() => navigate('/food/delivery/pocket/balance')}>
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-600 border border-green-100">
                      <Gift className="w-6 h-6" />
                   </div>
                   <div>
                      <span className="text-sm font-bold text-gray-800 block">Referral Bonus</span>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Earned Rewards</p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black text-green-600">+{formatCurrency(walletState.totalBonus)}</p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div onClick={() => navigate('/food/delivery/pocket/deductions')} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between">
                   <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-4 border border-red-100">
                      <FileText className="w-5 h-5" />
                   </div>
                   <p className="text-sm font-bold text-gray-800 leading-tight">Deduction List</p>
                </div>

                <div
                  onClick={() => {
                    const normalizedModule = normalizeModuleFilter(activeModuleFilter);
                    navigate(
                      normalizedModule !== "all"
                        ? `/food/delivery/pocket/details?module=${encodeURIComponent(normalizedModule)}`
                        : "/food/delivery/pocket/details"
                    );
                  }}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:bg-gray-50 flex flex-col justify-between"
                >
                   <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 mb-4 border border-purple-100">
                      <LayoutGrid className="w-5 h-5" />
                   </div>
                   <p className="text-sm font-bold text-gray-800 leading-tight">Pocket statement</p>
                </div>
             </div>
          </div>
       </div>
       </div>

       {/* DEPOSIT POPUP - Multi-mode: Online / Admin Details / Zone Hub */}
       <AnimatePresence>
          {showDepositPopup && (
             <div className="fixed inset-0 z-[1000] bg-white flex flex-col">
                <motion.div
                   initial={{ y: '100%' }}
                   animate={{ y: 0 }}
                   exit={{ y: '100%' }}
                   transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                   className="relative w-full h-full bg-white flex flex-col overflow-hidden"
                >
                   {/* Popup header */}
                   <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 bg-white">
                      <div>
                         <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Deposit Cash Limit</h3>
                         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Choose settlement method</p>
                      </div>
                      <button
                         onClick={() => setShowDepositPopup(false)}
                         className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                         <X className="w-4 h-4" />
                      </button>
                   </div>
                   {/* Deposit Popup Component */}
                   <div className="flex-1 overflow-y-auto bg-white">
                      <DepositPopup
                         cashInHand={walletState.cashInHand}
                         onSuccess={handleDepositSuccess}
                      />
                   </div>
                </motion.div>
             </div>
          )}
       </AnimatePresence>

       {/* Icon Helper for Navigation Drawer */}
       <div className="hidden">
          <ChevronRight />
       </div>
    </div>
  );
};

export default PocketV2;
