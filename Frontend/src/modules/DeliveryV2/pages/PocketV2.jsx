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
 * PocketV2 - delivery partner earnings & wallet hub (rendered inside DeliveryHomeV2).
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

  const goToPocketDetails = () => {
    const normalizedModule = normalizeModuleFilter(activeModuleFilter);
    navigate(
      normalizedModule !== "all"
        ? `/food/delivery/pocket/details?module=${encodeURIComponent(normalizedModule)}`
        : "/food/delivery/pocket/details"
    );
  };

  const cashLimitRatio = walletState.totalCashLimit > 0
    ? Math.min(Math.max(walletState.availableCashLimit / walletState.totalCashLimit, 0), 1)
    : 0;

  // Hex colours on purpose: deliveryTheme.css recolours Tailwind green/blue/orange utilities.
  const statementLinks = [
    {
      label: 'Pocket statement',
      hint: 'All credits & debits',
      icon: LayoutGrid,
      tone: 'bg-[#F5F3FF] text-[#7C3AED]',
      onClick: goToPocketDetails,
    },
    {
      label: 'Deduction list',
      hint: 'Penalties & adjustments',
      icon: FileText,
      tone: 'bg-[#FEF2F2] text-[#DC2626]',
      onClick: () => navigate('/food/delivery/pocket/deductions'),
    },
    {
      label: 'Limit settlement',
      hint: 'Cash deposits to company',
      icon: Receipt,
      tone: 'bg-[#FFF4ED] text-[#F35B1C]',
      onClick: () => navigate('/food/delivery/pocket/limit-settlement'),
    },
  ];

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center font-poppins">
       <div className="w-10 h-10 border-4 border-[#F35B1C] border-t-transparent rounded-full animate-spin mb-4" />
       <p className="text-xs font-semibold text-gray-500">Loading Pocket...</p>
    </div>
  );

  // No inner scroll container here: DeliveryHomeV2's content area scrolls this page.
  // A nested overflow box with overscroll containment swallowed touch/wheel scrolling.
  return (
    <div className="min-h-full bg-[#F4F5F7] font-poppins">

       {/* Header */}
       <div className="sticky top-0 z-[100] safe-top bg-white/95 backdrop-blur border-b border-gray-100 px-5 py-4">
          <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight">Pocket</h1>
          <p className="text-xs font-medium text-gray-500 mt-0.5">Your earnings, balance &amp; payouts</p>
       </div>

       <div className="px-4 pt-4 pb-6 space-y-5">

          {/* Bank details banner */}
          {!walletState.bankDetailsFilled && (
            <div className="flex items-center gap-3 rounded-[18px] border border-[#FCD9A8] bg-[#FFF8EC] p-3.5">
               <div className="w-10 h-10 rounded-xl bg-[#F59E0B] flex items-center justify-center text-white shrink-0">
                  <AlertTriangle className="w-5 h-5" />
               </div>
               <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900">Add bank details</h3>
                  <p className="text-xs text-gray-600">PAN &amp; bank account are required for payouts</p>
               </div>
               <button
                 onClick={() => navigate('/food/delivery/profile/details')}
                 className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white active:scale-95"
               >
                  Add now
               </button>
            </div>
          )}

          {/* Module filters */}
          {availableModules && availableModules.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
              {['all', ...availableModules.map(normalizeModuleFilter)].map((mod) => {
                const isSelected = activeModuleFilter === mod;
                return (
                  <button
                    key={mod}
                    onClick={() => setActiveModuleFilter(mod)}
                    className={`px-4 py-2 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-[#F35B1C] text-white shadow-md shadow-[#F35B1C]/25'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {mod === 'all' ? 'All' : mod.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          )}

          {/* Weekly earnings hero */}
          <button
            onClick={goToPocketDetails}
            className="relative w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#F35B1C] to-[#FF8A4C] p-5 text-left text-white shadow-lg shadow-[#F35B1C]/25 active:scale-[0.99] transition-all"
          >
             <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
             <div className="absolute -right-2 -bottom-10 h-28 w-28 rounded-full bg-white/10" />
             <div className="relative">
                <div className="flex items-center justify-between">
                   <span className="text-xs font-semibold text-white/85">This week · {getCurrentWeekRange()}</span>
                   <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold">
                      Details <ArrowRight className="w-3 h-3" />
                   </span>
                </div>
                <p className="mt-3 text-[34px] font-extrabold leading-none tracking-tight">
                   ₹{walletState.weeklyEarnings.toFixed(2)}
                </p>
                <p className="mt-2 text-xs font-medium text-white/85">
                   {walletState.weeklyOrders} {walletState.weeklyOrders === 1 ? 'order' : 'orders'} completed
                </p>
             </div>
          </button>

          {/* Balance & cash limit */}
          <div className="grid grid-cols-2 gap-3">
             <button
                onClick={() => navigate('/food/delivery/pocket/balance')}
                className="rounded-[18px] bg-white p-4 text-left border border-gray-100 shadow-sm active:bg-gray-50"
             >
                <div className="flex items-center justify-between">
                   <div className="w-9 h-9 rounded-xl bg-[#FFF4ED] text-[#F35B1C] flex items-center justify-center">
                      <Wallet className="w-[18px] h-[18px]" />
                   </div>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
                <p className="mt-3 text-[11px] font-semibold text-gray-500">Pocket balance</p>
                <p className="mt-0.5 text-lg font-extrabold text-gray-900 truncate">₹{walletState.totalBalance.toFixed(2)}</p>
                <p className="text-[10px] font-medium text-gray-400">Tap to withdraw</p>
             </button>

             <button
                onClick={() => navigate('/food/delivery/pocket/cash-limit')}
                className="rounded-[18px] bg-white p-4 text-left border border-gray-100 shadow-sm active:bg-gray-50"
             >
                <div className="flex items-center justify-between">
                   <div className="w-9 h-9 rounded-xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center">
                      <ShieldCheck className="w-[18px] h-[18px]" />
                   </div>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
                <p className="mt-3 text-[11px] font-semibold text-gray-500">Available cash limit</p>
                <p className="mt-0.5 text-lg font-extrabold text-gray-900 truncate">₹{walletState.availableCashLimit.toFixed(2)}</p>
                {walletState.totalCashLimit > 0 ? (
                  <div className="mt-1.5">
                     <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${cashLimitRatio * 100}%` }} />
                     </div>
                     <p className="mt-1 text-[10px] font-medium text-gray-400">of ₹{walletState.totalCashLimit.toFixed(0)}</p>
                  </div>
                ) : (
                  <p className="text-[10px] font-medium text-gray-400">Cash you can collect</p>
                )}
             </button>
          </div>

          {/* Earnings guarantee - API driven */}
          {hasActiveOffer && (
          <div className="rounded-[20px] bg-white border border-gray-100 shadow-sm overflow-hidden">
             <div className="flex items-center justify-between bg-[#111827] p-4">
                <div>
                  <div className="flex items-center gap-2">
                     <Sparkles className="w-4 h-4 text-[#FBBF24]" />
                     <h3 className="text-base font-extrabold text-white leading-none">Earnings Guarantee</h3>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                     <span className="text-[11px] font-medium text-gray-400">Valid till {formatOfferValidTill(activeOffer.validTill)}</span>
                     {activeOffer.isLive && (
                       <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#22C55E]">
                          <span className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-pulse" /> Live
                       </span>
                     )}
                  </div>
                </div>
                <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
                   <p className="text-base font-extrabold text-white leading-none">₹{activeOffer.targetAmount}</p>
                   <p className="mt-0.5 text-[10px] font-medium text-gray-400">{activeOffer.targetOrders} orders</p>
                </div>
             </div>

             <div className="flex items-center justify-around gap-6 px-6 py-6">
                {[
                  { label: 'Orders done', progress: ordersProgress, color: '#111827', value: activeOffer.currentOrders, sub: `of ${activeOffer.targetOrders}` },
                  { label: 'Earned so far', progress: earningsProgress, color: '#F35B1C', value: `₹${activeOffer.currentEarnings}`, sub: `of ₹${activeOffer.targetAmount}` },
                ].map((ring) => (
                  <div key={ring.label} className="flex flex-col items-center">
                     <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                           <circle cx="50" cy="50" r="44" fill="none" stroke="#F3F4F6" strokeWidth="9" />
                           <motion.circle
                              cx="50" cy="50" r="44" fill="none" stroke={ring.color} strokeWidth="9" strokeLinecap="round"
                              initial={{ pathLength: 0 }} animate={{ pathLength: ring.progress }} transition={{ duration: 1.2, ease: "easeOut" }}
                           />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                           <span className="text-base font-extrabold text-gray-900 leading-none truncate max-w-full">{ring.value}</span>
                           <span className="mt-0.5 text-[9px] font-semibold text-gray-400">{ring.sub}</span>
                        </div>
                     </div>
                     <p className="mt-3 text-[11px] font-semibold text-gray-500">{ring.label}</p>
                  </div>
                ))}
             </div>
          </div>
          )}

          {/* Payouts & rewards */}
          <section>
             <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">Payouts &amp; rewards</h2>
             <div className="rounded-[18px] bg-white border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
                <button
                   onClick={() => navigate('/food/delivery/pocket/payout')}
                   className="flex w-full items-center gap-3 p-4 text-left active:bg-gray-50"
                >
                   <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] text-[#2563EB] flex items-center justify-center shrink-0">
                      <IndianRupee className="w-5 h-5" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Last payout</p>
                      <p className="text-xs text-gray-500 truncate">{walletState.payoutPeriod}</p>
                   </div>
                   <span className="text-sm font-extrabold text-gray-900">₹{walletState.payoutAmount}</span>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>

                <button
                   onClick={() => navigate('/food/delivery/pocket/balance')}
                   className="flex w-full items-center gap-3 p-4 text-left active:bg-gray-50"
                >
                   <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">Referral bonus</p>
                      <p className="text-xs text-gray-500">Rewards earned from referrals</p>
                   </div>
                   <span className="text-sm font-extrabold text-[#16A34A]">+{formatCurrency(walletState.totalBonus)}</span>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
             </div>
          </section>

          {/* Statements */}
          <section>
             <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-gray-400">Statements</h2>
             <div className="rounded-[18px] bg-white border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
                {statementLinks.map(({ label, hint, icon: Icon, tone, onClick }) => (
                  <button
                     key={label}
                     onClick={onClick}
                     className="flex w-full items-center gap-3 p-4 text-left active:bg-gray-50"
                  >
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
                        <Icon className="w-5 h-5" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{hint}</p>
                     </div>
                     <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
             </div>
          </section>
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

    </div>
  );
};

export default PocketV2;
