import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ArrowLeft, ChevronDown, Loader2, Gift, X, 
  CheckCircle2, Clock, Search, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../hooks/useDeliveryBackNavigation';
import { useDeliveryStore } from '@/modules/DeliveryV2/store/useDeliveryStore';
import { addDeliveryNotification } from '@food/utils/deliveryNotifications';

/**
 * HistoryV2 - EXACT 1:1 Match with User Screenshot.
 * Theme: Clean White
 * Accent: Emerald Green (#10B981)
 * Font: Poppins
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

  return (
    <div className="app-shell-page min-h-screen bg-white font-poppins">
       {/* 1. Header (Premium V2 Styled) */}
       <div className="app-shell-page__header safe-top bg-[#121212] border-b border-white/10 px-6 py-3 flex items-center justify-between backdrop-blur-2xl">
          <div className="flex items-center gap-4">
            <button onClick={goBack} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10 active:scale-90 transition-all">
               <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
               <h1 className="text-xl font-black text-white uppercase tracking-tighter">Trip History</h1>
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Your delivery milestones</p>
            </div>
          </div>
          <button onClick={() => setShowBonusModal(true)} className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-[#10B981] border border-green-500/20 relative active:scale-90 transition-all">
             <Gift className="w-5 h-5" />
             {bonusCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#10B981] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                   {bonusCount}
                </span>
             )}
          </button>
       </div>

       {/* Tabs + filters stay pinned with the header in native WebView */}
       <div className="app-shell-page__header bg-white border-b border-gray-100">
       {/* 2. Selection Tabs (Matched to Image) */}
       <div className="px-4 flex items-center gap-8 border-b border-gray-100">
          {['daily', 'weekly', 'monthly'].map((tab) => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab)}
               className={`py-4 text-base font-medium capitalize relative ${activeTab === tab ? 'text-[#10B981]' : 'text-gray-400'}`}
             >
                {tab}
                {activeTab === tab && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10B981]" />}
             </button>
          ))}
       </div>

       {/* 3. Filter Controls (Matched to Image) */}
       <div className="px-4 py-4 flex flex-col gap-3">
          {availableModules && availableModules.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
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
          <div className="flex gap-3 w-full">
            <button 
               onClick={() => { setShowDatePicker(!showDatePicker); setShowTripTypePicker(false); }}
               className="flex-1 px-4 py-3 bg-[#f8f9fa] border border-gray-100 rounded-xl flex items-center justify-between text-gray-800"
            >
               <span className="text-sm font-medium">{formatDateDisplay(selectedDate)}</span>
               <ChevronDown className={`w-4 h-4 text-gray-400 transform transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
            </button>
            <button 
               onClick={() => { setShowTripTypePicker(!showTripTypePicker); setShowDatePicker(false); }}
               className="w-[140px] px-4 py-3 bg-[#f8f9fa] border border-gray-100 rounded-xl flex items-center justify-between text-gray-800"
            >
               <span className="text-sm font-medium">{selectedTripType}</span>
               <ChevronDown className={`w-4 h-4 text-gray-400 transform transition-transform ${showTripTypePicker ? 'rotate-180' : ''}`} />
            </button>
          </div>
       </div>
       </div>

       <div className="app-shell-page__body pb-32">
       {/* Dropdowns */}
       <AnimatePresence>
          {showDatePicker && (
             <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="fixed left-4 right-4 top-[230px] z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[300px] overflow-y-auto p-2">
                {recentDates.map((date, idx) => (
                   <button 
                      key={idx} 
                      onClick={() => { setSelectedDate(date); setShowDatePicker(false); }}
                      className={`w-full text-left p-4 rounded-xl text-sm font-medium ${date.toDateString() === selectedDate.toDateString() ? 'bg-green-50 text-[#10B981] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                   >
                      {formatDateDisplay(date)}
                   </button>
                ))}
             </motion.div>
          )}
          {showTripTypePicker && (
             <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="fixed right-4 top-[230px] w-48 z-[200] bg-white rounded-2xl shadow-2xl border border-gray-100 p-2">
                {tripTypes.map((type, idx) => (
                   <button 
                      key={idx} 
                      onClick={() => { setSelectedTripType(type); setShowTripTypePicker(false); }}
                      className={`w-full text-left p-4 rounded-xl text-sm font-medium ${type === selectedTripType ? 'bg-green-50 text-[#10B981] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                   >
                      {type}
                   </button>
                ))}
             </motion.div>
          )}
       </AnimatePresence>

       {/* 4. Page Content */}
       <div className="px-4 py-2 space-y-5">
          {/* Performance Summary Banner (Matched to Image) */}
          <div className="bg-[#E9F9F4] rounded-2xl p-6 border border-[#D1F2E8] flex justify-between items-center">
             <div>
                <p className="text-[11px] font-bold text-[#10B981] mb-1">COD Collected</p>
                <h3 className="text-xl font-bold text-gray-950">₹{metrics.cod.toFixed(2)}</h3>
             </div>
             <div className="text-right">
                <p className="text-[11px] font-bold text-[#10B981] mb-1">Earnings</p>
                <h3 className="text-xl font-bold text-gray-950">₹{metrics.earnings.toFixed(2)}</h3>
             </div>
          </div>

          {/* Trip List */}
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#10B981]" />
                <p className="text-gray-400 text-xs font-medium">Fetching trips...</p>
             </div>
          ) : visibleTrips.length > 0 ? (
             <div className="space-y-4">
                {visibleTrips.map((trip, idx) => {
                   const isCompleted = (trip.status || '').toLowerCase() === 'completed';
                   const isCancelled = (trip.status || '').toLowerCase() === 'cancelled';
                   const isPending = !isCompleted && !isCancelled;
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

                   return (
                      <div key={tripKey} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm active:scale-[0.99] transition-all">
                         <div className="flex justify-between items-start mb-2">
                             <div className="flex items-start gap-2">
                                <div>
                                  <h4 className="text-base font-bold text-gray-950">{trip.orderId || 'ORDER-ID'}</h4>
                                  <p className="text-sm font-medium text-gray-500 mt-0.5">
                                    {isReturnPickup
                                      ? 'Return Pickup'
                                      : (trip.restaurant || trip.restaurantName || trip.pickupPoints?.[0]?.name || trip.items?.[0]?.sourceName || 'Store')}
                                  </p>
                                  <p className="text-xs text-gray-400 font-medium mt-0.5 line-clamp-1">{extractItems(trip)}</p>
                                </div>
                             </div>
                             <span className={`text-sm font-bold ${isCompleted ? 'text-[#10B981]' : isCancelled ? 'text-red-500' : 'text-red-500'}`}>
                                {trip.status || 'Status'}
                             </span>
                         </div>
                         
                         <div className="flex gap-2 mb-4 mt-3">
                             {isReturnPickup ? (
                               <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-700">
                                 Return Pickup
                               </span>
                             ) : (
                               <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600">
                                 Delivery
                               </span>
                             )}
                             <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${isCOD ? 'bg-red-50 text-red-600' : 'bg-green-50 text-[#10B981]'}`}>
                                {isCOD ? 'COD' : 'Online'}
                             </span>
                         </div>

                         <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-50">
                             <div>
                                <p className="text-[11px] font-medium text-gray-400 mb-1">Time</p>
                                <p className="text-sm font-bold text-gray-950">{trip.time || '--:--'}</p>
                             </div>
                             <div className="text-center">
                                <p className="text-[11px] font-medium text-gray-400 mb-1">
                                  {isReturnPickup ? 'Refund' : (isCOD ? 'COD' : 'Paid')}
                                </p>
                                <p className="text-sm font-bold text-gray-950">₹{Number(paidLabel || 0).toFixed(2)}</p>
                             </div>
                             <div className="text-right">
                                <p className="text-[11px] font-medium text-gray-400 mb-1">Earning</p>
                                <p className="text-sm font-bold text-gray-950">₹{payout.toFixed(2)}</p>
                             </div>
                         </div>

                         {isReturnPickup && (trip.pickupPricingBreakdown || Number(trip.distanceKm || trip.pickupDistanceKm) > 0 || payout > 0) && (
                           <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Distance</p>
                               <p className="font-bold text-gray-800">
                                 {Number(trip.pickupDistanceKm ?? trip.distanceKm ?? trip.pickupPricingBreakdown?.distanceKm ?? 0).toFixed(2)} km
                               </p>
                             </div>
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Base Fee</p>
                               <p className="font-bold text-gray-800">
                                 ₹{returnBaseFee.toFixed(2)}
                               </p>
                             </div>
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Extra KM</p>
                               <p className="font-bold text-gray-800">
                                 {Number(trip.extraKm ?? trip.pickupPricingBreakdown?.extraKm ?? 0).toFixed(2)} km
                               </p>
                             </div>
                             <div>
                               <p className="text-[10px] font-medium text-gray-400">Per KM</p>
                               <p className="font-bold text-gray-800">
                                 ₹{returnPerKm.toFixed(2)}
                               </p>
                             </div>
                           </div>
                         )}
                      </div>
                   );
                })}
             </div>
          ) : (
             <div className="py-20 text-center flex flex-col items-center">
                <Clock className="w-12 h-12 text-gray-100 mb-4" />
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No Trips Recorded</p>
             </div>
          )}
       </div>
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
                         <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-[#10B981] border border-green-100">
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
                         <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#10B981]" /></div>
                      ) : bonusTransactions.length > 0 ? bonusTransactions.map((tx, i) => (
                         <div key={i} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex justify-between items-center">
                            <div>
                               <p className="text-lg font-bold text-gray-950 mb-0.5">₹{Number(tx.amount || 0).toFixed(2)}</p>
                               <p className="text-sm font-medium text-gray-600 line-clamp-1">{tx.description || 'Bonus Payout'}</p>
                               <p className="text-[10px] text-gray-400 font-medium mt-1">{new Date(tx.createdAt || tx.date).toLocaleDateString()}</p>
                            </div>
                            <span className="bg-green-100 text-[#10B981] text-[10px] font-bold px-3 py-1 rounded-full uppercase">DELIVERED</span>
                         </div>
                      )) : (
                         <div className="py-20 text-center flex flex-col items-center">
                             <Search className="w-12 h-12 text-gray-100 mb-4" />
                             <p className="text-sm font-bold text-gray-400">Nothing to show</p>
                         </div>
                      )}
                   </div>
                   
                   <button onClick={() => setShowBonusModal(false)} className="w-full py-5 bg-black text-white rounded-2xl font-bold text-base mt-8 shrink-0 active:scale-95 transition-all">Okay, Got it</button>
                </motion.div>
             </div>
          )}
       </AnimatePresence>
    </div>
  );
};

export default HistoryV2;
