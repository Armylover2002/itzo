import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ArrowLeft, ChevronDown, Loader2, Gift, X, 
  CheckCircle2, Clock, Search, History, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../hooks/useDeliveryBackNavigation';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { addDeliveryNotification } from '@food/utils/deliveryNotifications';

/**
 * HistoryV2 - delivery partner trip history (rendered inside DeliveryHomeV2).
 */
export const HistoryV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const [activeTab, setActiveTab] = useState("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTripType, setSelectedTripType] = useState("ALL TRIPS");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTripTypePicker, setShowTripTypePicker] = useState(false);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [bonusCount, setBonusCount] = useState(0);
  const [bonusLoading, setBonusLoading] = useState(false);
  const bonusBootstrapRef = useRef(false);
  const knownBonusIdsRef = useRef(new Set());
  const getAvailableModules = useDeliveryStore(state => state.getAvailableModules);
  const availableModules = getAvailableModules();
  const [activeModuleFilter, setActiveModuleFilter] = useState('all');

  const normalizeModuleFilter = (moduleValue) => {
    const raw = String(moduleValue || "").trim().toLowerCase();
    if (!raw || raw === "all") return "all";
    if (raw === "quick_commerce" || raw === "quick-commerce" || raw === "qc") return "quick";
    return raw;
  };

  const tripTypes = ["ALL TRIPS", "Completed", "Cancelled", "Pending"];

  // Fetch Logic
  useEffect(() => {
    let cancelled = false;
    const fetchTrips = async () => {
      setLoading(true);
      setTrips([]); // avoid showing previous module's trips (e.g. Quick returns under Food)
      try {
        const year = selectedDate.getFullYear();
        const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const day = String(selectedDate.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;
        const moduleFilter = normalizeModuleFilter(activeModuleFilter);

        const params = {
          period: activeTab,
          date: dateStr,
          status: selectedTripType !== "ALL TRIPS" ? selectedTripType : undefined,
          module: moduleFilter !== 'all' ? moduleFilter : undefined,
          limit: 1000,
          _ts: Date.now(), // bust stale 304 cache when switching filters
        };
        
        const response = await deliveryAPI.getTripHistory(params);
        if (cancelled) return;
        if (response.data?.success) {
          setTrips(response.data.data.trips || []);
        }
      } catch (error) {
        if (!cancelled) toast.error("Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTrips();
    return () => { cancelled = true; };
  }, [selectedDate, activeTab, selectedTripType, activeModuleFilter]);

  const bonusTxKey = useCallback((tx = {}) => (
    String(tx?._id || tx?.id || tx?.transactionId || `${tx?.createdAt || tx?.date || ''}:${tx?.amount || ''}`)
  ), []);

  const fetchBonusTransactions = useCallback(async ({ showLoader = false, syncModal = false } = {}) => {
    if (showLoader) setBonusLoading(true);
    try {
      const res = await deliveryAPI.getWalletTransactions({ type: 'bonus', limit: 50 });
      const txs = res?.data?.success ? (res?.data?.data?.transactions || []) : [];
      setBonusCount(txs.length);
      if (syncModal) {
        setBonusTransactions(txs);
      }

      const incomingNew = [];
      const nextKnown = new Set(knownBonusIdsRef.current);
      txs.forEach((tx) => {
        const key = bonusTxKey(tx);
        if (!key) return;
        if (!nextKnown.has(key)) incomingNew.push(tx);
        nextKnown.add(key);
      });

      if (!bonusBootstrapRef.current) {
        bonusBootstrapRef.current = true;
        knownBonusIdsRef.current = nextKnown;
        return;
      }

      if (incomingNew.length > 0) {
        const sortedNew = incomingNew
          .slice()
          .sort((a, b) => new Date(a?.createdAt || a?.date || 0).getTime() - new Date(b?.createdAt || b?.date || 0).getTime());
        sortedNew.forEach((tx) => {
          const amount = Number(tx?.amount || 0).toFixed(2);
          const note = String(tx?.description || "Bonus credited").trim();
          addDeliveryNotification({
            id: `bonus-${bonusTxKey(tx)}`,
            title: "Bonus Credited",
            message: `Rs ${amount} added. ${note}`,
            createdAt: tx?.createdAt || tx?.date || new Date().toISOString(),
          });
        });
      }

      knownBonusIdsRef.current = nextKnown;
    } catch (e) {
      if (showLoader) toast.error("Failed to load bonuses");
    } finally {
      if (showLoader) setBonusLoading(false);
    }
  }, [bonusTxKey]);

  // Keep bonus count and notifications fresh without opening the drawer.
  useEffect(() => {
    fetchBonusTransactions();
    const intervalId = window.setInterval(() => {
      fetchBonusTransactions();
    }, 20000);

    const handleFocus = () => fetchBonusTransactions();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchBonusTransactions();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchBonusTransactions]);

  useEffect(() => {
    if (!showBonusModal) return;
    fetchBonusTransactions({ showLoader: true, syncModal: true });
  }, [showBonusModal, fetchBonusTransactions]);

  const formatDateDisplay = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const day = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    
    if (date.toDateString() === today.toDateString()) return `Today: ${day}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday: ${day}`;
    return day;
  };

  const recentDates = useMemo(() => {
    return [...Array(30)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d;
    });
  }, []);

  const isReturnPickupTrip = useCallback((trip) => {
    if (!trip) return false;
    if (trip.isReturnPickup) return true;
    const tripType = String(trip.tripType || '').trim().toLowerCase();
    const documentType = String(trip.documentType || '').trim().toLowerCase();
    if (tripType === 'return_pickup' || documentType === 'seller_return') return true;
    const restaurant = String(trip.restaurantName || trip.restaurant || '').trim().toLowerCase();
    return restaurant === 'return pickup';
  }, []);

  const getTripStableKey = useCallback((trip, idx = 0) => {
    if (trip?.tripKey) return String(trip.tripKey);
    if (isReturnPickupTrip(trip)) {
      return `return:${String(trip.returnId || trip._id || trip.id || trip.orderId || idx)}`;
    }
    return `delivery:${String(trip?._id || trip?.id || trip?.orderId || idx)}:${String(trip?.tripType || 'delivery')}`;
  }, [isReturnPickupTrip]);

  const visibleTrips = useMemo(() => {
    const mod = normalizeModuleFilter(activeModuleFilter);
    const seen = new Set();
    const rows = [];

    for (const trip of trips || []) {
      const isReturnPickup = isReturnPickupTrip(trip);
      const tripModule = normalizeModuleFilter(
        trip?.module || trip?.orderType || trip?.serviceType || '',
      );

      // Return pickups are Quick-only (also allowed under All).
      if (isReturnPickup) {
        if (mod !== 'all' && mod !== 'quick') continue;
      } else if (mod === 'food') {
        if (tripModule !== 'food') continue;
      } else if (mod === 'quick') {
        if (tripModule !== 'quick' && tripModule !== 'mixed') continue;
      }

      const key = getTripStableKey(trip, rows.length);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(trip);
    }

    return rows;
  }, [trips, activeModuleFilter, isReturnPickupTrip, getTripStableKey]);

  const metrics = useMemo(() => {
     return visibleTrips.reduce((acc, trip) => {
        if (trip.status === 'Completed') {
           acc.earnings += Number(trip.deliveryEarning || trip.amount || trip.earningAmount || 0);
           const isCOD = (trip.paymentMethod || '').toLowerCase() === 'cash' || (trip.paymentMethod || '').toLowerCase() === 'cod';
           if (isCOD) acc.cod += Number(trip.codCollectedAmount || trip.orderTotal || 0);
        }
        return acc;
     }, { earnings: 0, cod: 0 });
  }, [visibleTrips]);

  const extractItems = (trip) => {
    const items = trip.items || trip.orderItems || [];
    if (items.length === 0) return 'Standard Delivery';
    const first = items[0];
    const qty = first.quantity || first.qty || 1;
    const name = first.name || first.itemName || 'Item';
    return `${qty}x ${name}${items.length > 1 ? ` +${items.length - 1} more` : ''}`;
  }

  const moduleOptions = ['all', ...(availableModules || []).map(normalizeModuleFilter)];
  const completedCount = visibleTrips.filter((trip) => (trip.status || '').toLowerCase() === 'completed').length;

  // No inner scroll container here: DeliveryHomeV2's content area scrolls this page.
  // A nested overflow box with overscroll containment swallowed touch/wheel scrolling.
  return (
    <div className="min-h-full bg-[#F4F5F7] font-poppins">
       {/* Header + tabs + filters stay pinned together */}
       <div className="sticky top-0 z-[100] safe-top bg-white border-b border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
             <div className="flex items-center gap-3 min-w-0">
                <button onClick={goBack} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 active:scale-90 transition-all shrink-0" aria-label="Back">
                   <ArrowLeft className="w-[18px] h-[18px]" />
                </button>
                <div className="min-w-0">
                   <h1 className="text-[22px] font-extrabold text-gray-900 leading-tight">Trip History</h1>
                   <p className="text-xs font-medium text-gray-500">Your deliveries &amp; earnings</p>
                </div>
             </div>
             <button
                onClick={() => setShowBonusModal(true)}
                className="relative w-10 h-10 rounded-xl bg-[#FFF4ED] flex items-center justify-center text-[#F35B1C] active:scale-90 transition-all shrink-0"
                aria-label="Bonuses"
             >
                <Gift className="w-5 h-5" />
                {bonusCount > 0 && (
                   <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-[#F35B1C] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {bonusCount}
                   </span>
                )}
             </button>
          </div>

          {/* Period segmented control */}
          <div className="px-4">
             <div className="grid grid-cols-3 rounded-xl bg-gray-100 p-1">
                {['daily', 'weekly', 'monthly'].map((tab) => (
                   <button
                     key={tab}
                     onClick={() => setActiveTab(tab)}
                     className={`relative py-2 text-sm font-bold capitalize rounded-lg transition-colors ${activeTab === tab ? 'text-[#F35B1C]' : 'text-gray-500'}`}
                   >
                      {activeTab === tab && <motion.div layoutId="history-period" className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
                      <span className="relative">{tab}</span>
                   </button>
                ))}
             </div>
          </div>

          {/* Filters */}
          <div className="px-4 py-3 flex flex-col gap-3">
             {availableModules && availableModules.length > 0 && (
               <div className="flex gap-2 overflow-x-auto no-scrollbar">
                 {moduleOptions.map((mod) => (
                   <button
                     key={mod}
                     onClick={() => setActiveModuleFilter(mod)}
                     className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize whitespace-nowrap transition-all ${
                       activeModuleFilter === mod
                         ? 'bg-[#F35B1C] text-white shadow-md shadow-[#F35B1C]/25'
                         : 'bg-white text-gray-600 border border-gray-200'
                     }`}
                   >
                     {mod === 'all' ? 'All' : mod.replace('_', ' ')}
                   </button>
                 ))}
               </div>
             )}

             <div className="relative flex gap-3 w-full">
               <button
                  onClick={() => { setShowDatePicker(!showDatePicker); setShowTripTypePicker(false); }}
                  className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2 text-gray-800"
               >
                  <span className="flex items-center gap-2 text-sm font-semibold truncate">
                     <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                     {formatDateDisplay(selectedDate)}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
               </button>
               <button
                  onClick={() => { setShowTripTypePicker(!showTripTypePicker); setShowDatePicker(false); }}
                  className="w-[140px] px-4 py-2.5 bg-white border border-gray-200 rounded-xl flex items-center justify-between gap-2 text-gray-800"
               >
                  <span className="text-sm font-semibold capitalize truncate">{selectedTripType === 'ALL TRIPS' ? 'All trips' : selectedTripType}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showTripTypePicker ? 'rotate-180' : ''}`} />
               </button>

               {/* Dropdowns open right under their buttons */}
               <AnimatePresence>
                  {showDatePicker && (
                     <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute left-0 right-[152px] top-full mt-2 z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[300px] overflow-y-auto p-1.5">
                        {recentDates.map((date, idx) => (
                           <button
                              key={idx}
                              onClick={() => { setSelectedDate(date); setShowDatePicker(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm ${date.toDateString() === selectedDate.toDateString() ? 'bg-[#FFF4ED] text-[#F35B1C] font-bold' : 'text-gray-700 font-medium hover:bg-gray-50'}`}
                           >
                              {formatDateDisplay(date)}
                           </button>
                        ))}
                     </motion.div>
                  )}
                  {showTripTypePicker && (
                     <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute right-0 top-full mt-2 w-48 z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 p-1.5">
                        {tripTypes.map((type, idx) => (
                           <button
                              key={idx}
                              onClick={() => { setSelectedTripType(type); setShowTripTypePicker(false); }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm capitalize ${type === selectedTripType ? 'bg-[#FFF4ED] text-[#F35B1C] font-bold' : 'text-gray-700 font-medium hover:bg-gray-50'}`}
                           >
                              {type === 'ALL TRIPS' ? 'All trips' : type}
                           </button>
                        ))}
                     </motion.div>
                  )}
               </AnimatePresence>
             </div>
          </div>
       </div>

       <div className="px-4 pt-4 pb-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-gradient-to-br from-[#F35B1C] to-[#FF8A4C] p-4 text-white shadow-lg shadow-[#F35B1C]/20">
             <div>
                <p className="text-[11px] font-semibold text-white/80">Earnings</p>
                <p className="mt-1 text-lg font-extrabold leading-none truncate">₹{metrics.earnings.toFixed(2)}</p>
             </div>
             <div className="border-l border-white/25 pl-3">
                <p className="text-[11px] font-semibold text-white/80">COD collected</p>
                <p className="mt-1 text-lg font-extrabold leading-none truncate">₹{metrics.cod.toFixed(2)}</p>
             </div>
             <div className="border-l border-white/25 pl-3">
                <p className="text-[11px] font-semibold text-white/80">Completed</p>
                <p className="mt-1 text-lg font-extrabold leading-none">{completedCount}</p>
             </div>
          </div>

          {/* Trip list */}
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#F35B1C]" />
                <p className="text-gray-400 text-xs font-medium">Fetching trips...</p>
             </div>
          ) : visibleTrips.length > 0 ? (
             <div className="space-y-3">
                {visibleTrips.map((trip, idx) => {
                   const isCompleted = (trip.status || '').toLowerCase() === 'completed';
                   const isCancelled = (trip.status || '').toLowerCase() === 'cancelled';
                   const payout = Number(trip.deliveryEarning || trip.amount || trip.earningAmount || 0);
                   const isCOD = (trip.paymentMethod || '').toLowerCase() === 'cash' || (trip.paymentMethod || '').toLowerCase() === 'cod';
                   const collection = isCOD ? Number(trip.codCollectedAmount || trip.orderTotal || 0) : 0;

                   const isReturnPickup = isReturnPickupTrip(trip);
                   const returnBaseFee = Number(
                     trip.baseFee ??
                     trip.pickupPricingBreakdown?.basePayout ??
                     trip.pickupPricingBreakdown?.baseFee ??
                     (Number(trip.perKmRate ?? trip.pickupPricingBreakdown?.perKmRate ?? 0) <= 0
                       ? payout
                       : 0) ??
                     0,
                   );
                   const returnPerKm = Number(
                     trip.perKmRate ?? trip.pickupPricingBreakdown?.perKmRate ?? 0,
                   );
                   const tripKey = getTripStableKey(trip, idx);
                   const paidLabel = isReturnPickup
                     ? Number(trip.orderTotal || trip.totalAmount || 0)
                     : (isCOD ? collection : Number(trip.orderTotal || trip.totalAmount || 0));
                   const statusTone = isCompleted
                     ? 'bg-[#ECFDF5] text-[#16A34A]'
                     : isCancelled
                       ? 'bg-[#FEF2F2] text-[#DC2626]'
                       : 'bg-[#FEF3C7] text-[#B45309]';

                   return (
                      <div key={tripKey} className="bg-white rounded-[18px] p-4 border border-gray-100 shadow-sm">
                         <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                               <h4 className="text-[15px] font-bold text-gray-900 truncate">{trip.orderId || 'ORDER-ID'}</h4>
                               <p className="text-sm font-medium text-gray-600 mt-0.5 truncate">
                                 {isReturnPickup
                                   ? 'Return Pickup'
                                   : (trip.restaurant || trip.restaurantName || trip.pickupPoints?.[0]?.name || trip.items?.[0]?.sourceName || 'Store')}
                               </p>
                               <p className="text-xs text-gray-400 font-medium mt-0.5 line-clamp-1">{extractItems(trip)}</p>
                            </div>
                            <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${statusTone}`}>
                               {trip.status || 'Status'}
                            </span>
                         </div>

                         <div className="flex gap-2 mt-3">
                            {isReturnPickup ? (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-[#FEF3C7] text-[#B45309]">Return pickup</span>
                            ) : (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">Delivery</span>
                            )}
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${isCOD ? 'bg-[#FFF4ED] text-[#F35B1C]' : 'bg-[#EEF4FF] text-[#2563EB]'}`}>
                               {isCOD ? 'COD' : 'Online'}
                            </span>
                         </div>

                         <div className="grid grid-cols-3 gap-3 mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
                            <div>
                               <p className="text-[10px] font-medium text-gray-400">Time</p>
                               <p className="text-sm font-bold text-gray-900">{trip.time || '--:--'}</p>
                            </div>
                            <div className="text-center">
                               <p className="text-[10px] font-medium text-gray-400">
                                 {isReturnPickup ? 'Refund' : (isCOD ? 'COD' : 'Paid')}
                               </p>
                               <p className="text-sm font-bold text-gray-900">₹{Number(paidLabel || 0).toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-medium text-gray-400">Earning</p>
                               <p className="text-sm font-extrabold text-[#16A34A]">₹{payout.toFixed(2)}</p>
                            </div>
                         </div>

                         {isReturnPickup && (trip.pickupPricingBreakdown || Number(trip.distanceKm || trip.pickupDistanceKm) > 0 || payout > 0) && (
                           <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Distance</p>
                               <p className="font-bold text-gray-800">
                                 {Number(trip.pickupDistanceKm ?? trip.distanceKm ?? trip.pickupPricingBreakdown?.distanceKm ?? 0).toFixed(2)} km
                               </p>
                             </div>
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Base Fee</p>
                               <p className="font-bold text-gray-800">₹{returnBaseFee.toFixed(2)}</p>
                             </div>
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Extra KM</p>
                               <p className="font-bold text-gray-800">
                                 {Number(trip.extraKm ?? trip.pickupPricingBreakdown?.extraKm ?? 0).toFixed(2)} km
                               </p>
                             </div>
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Per KM</p>
                               <p className="font-bold text-gray-800">₹{returnPerKm.toFixed(2)}</p>
                             </div>
                           </div>
                         )}
                      </div>
                   );
                })}
             </div>
          ) : (
             <div className="py-16 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-white border border-gray-100 flex items-center justify-center mb-4">
                   <Clock className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-700">No trips found</p>
                <p className="mt-1 text-xs text-gray-400">Try another date or filter</p>
             </div>
          )}
       </div>

       {/* Bonus Drawer (The Gift Modal) */}
       <AnimatePresence>
          {showBonusModal && (
             <div className="fixed inset-0 z-[1000] flex items-end">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBonusModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <motion.div 
                   drag="y"
                   dragConstraints={{ top: 0, bottom: 0 }}
                   dragElastic={0.1}
                   onDragEnd={(e, info) => {
                      if (info.offset.y > 100) setShowBonusModal(false);
                   }}
                   initial={{ y: '100%' }} 
                   animate={{ y: 0 }} 
                   exit={{ y: '100%' }} 
                   transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                   className="relative w-full bg-white rounded-t-[2.5rem] p-8 max-h-[85vh] flex flex-col shadow-2xl"
                >
                   <div className="w-12 h-1 bg-gray-100 rounded-full mx-auto mb-8 shrink-0" />
                   <div className="flex items-center justify-between mb-8 shrink-0">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-[#FFF4ED] rounded-xl flex items-center justify-center text-[#F35B1C]">
                            <Gift className="w-6 h-6" />
                         </div>
                         <div>
                            <h3 className="text-lg font-bold text-gray-950">Incentive Records</h3>
                            <p className="text-xs text-gray-400 font-medium">Extra bonuses credited by team</p>
                         </div>
                      </div>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto pr-1 space-y-4">
                      {bonusLoading ? (
                         <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#F35B1C]" /></div>
                      ) : bonusTransactions.length > 0 ? bonusTransactions.map((tx, i) => (
                         <div key={i} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex justify-between items-center">
                            <div>
                               <p className="text-lg font-bold text-gray-950 mb-0.5">₹{Number(tx.amount || 0).toFixed(2)}</p>
                               <p className="text-sm font-medium text-gray-600 line-clamp-1">{tx.description || 'Bonus Payout'}</p>
                               <p className="text-[10px] text-gray-400 font-medium mt-1">{new Date(tx.createdAt || tx.date).toLocaleDateString()}</p>
                            </div>
                            <span className="bg-[#ECFDF5] text-[#16A34A] text-[10px] font-bold px-3 py-1 rounded-full uppercase">Credited</span>
                         </div>
                      )) : (
                         <div className="py-20 text-center flex flex-col items-center">
                             <Search className="w-12 h-12 text-gray-100 mb-4" />
                             <p className="text-sm font-bold text-gray-400">Nothing to show</p>
                         </div>
                      )}
                   </div>
                   
                   <button onClick={() => setShowBonusModal(false)} className="w-full py-4 bg-[#F35B1C] text-white rounded-2xl font-bold text-base mt-6 shrink-0 active:scale-95 transition-all">Okay, Got it</button>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
    </div>
  );
};

export default HistoryV2;
