import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft,
  CheckCircle,
  Clock,
  IndianRupee,
  Loader2
} from 'lucide-react';
import WeekSelector from '@delivery/components/WeekSelector';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * PocketStatementV2 - 1:1 Match with Old PocketStatement UI.
 * Background: White/Sand
 * Font: Poppins
 */
export const PocketStatementV2 = () => {
  const goBack = useDeliveryBackNavigation();

  // Current week range (Sunday - Saturday)
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
  const [bonusTransactions, setBonusTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load trips (orders) and bonus for selected day
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const params = {
          period: 'weekly',
          date: weekRange.start.toISOString().split('T')[0],
          status: 'Completed',
          limit: 1000
        };
        
        // Parallel fetch for speed
        const [tripRes, walletRes] = await Promise.all([
          deliveryAPI.getTripHistory(params),
          deliveryAPI.getWalletTransactions({ type: 'bonus', limit: 1000 })
        ]);
        
        setOrders(tripRes?.data?.data?.trips || []);
        setBonusTransactions(walletRes?.data?.data?.transactions || []);
      } catch (error) {
        toast.error('Error loading pocket statement');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [weekRange]);

  // Compute summary for selected week
  const summary = useMemo(() => {
    let totalEarning = 0;
    let totalBonus = 0;

    orders.forEach((trip) => {
      const earning =
        trip.deliveryEarning ||
        trip.deliveryPayout ||
        trip.payout ||
        trip.estimatedEarnings?.totalEarning ||
        0;
      totalEarning += earning;
    });

    bonusTransactions.forEach((b) => {
      const baseDate = b.date || b.createdAt;
      if (!baseDate) return;
      const d = new Date(baseDate);
      if (d >= weekRange.start && d <= weekRange.end) {
        totalBonus += b.amount || 0;
      }
    });

    return {
      totalEarning,
      totalBonus,
      grandTotal: totalEarning + totalBonus
    };
  }, [orders, bonusTransactions, weekRange]);

  const getOrderAmounts = (trip) => {
    const earning =
      trip.deliveryEarning ||
      trip.deliveryPayout ||
      trip.payout ||
      trip.estimatedEarnings?.totalEarning ||
      0;

    const orderId = trip.orderId || trip.id || trip._id;
    const bonusForOrder = bonusTransactions
      .filter((b) => b.orderId === orderId)
      .reduce((sum, b) => sum + (b.amount || 0), 0);

    return {
      earning,
      bonus: bonusForOrder,
      total: earning + bonusForOrder
    };
  };

  return (
    <div className="app-shell-page min-h-screen bg-[#f6e9dc] font-poppins">
       {/* Header (Old Style) */}
       <div className="app-shell-page__header safe-top bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
          <button 
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 leading-none">Pocket statement</h1>
       </div>

       {/* Main Content */}
       <div className="app-shell-page__body pb-32 px-4 py-6">
          <WeekSelector onChange={setWeekRange} />

          {/* Summary (Original Grid Style) */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 mt-4 mb-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-gray-800 uppercase tracking-tight">
                   Pocket summary
                </span>
             </div>
             <div className="grid grid-cols-3 gap-4 text-center">
                <div className="text-left">
                   <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Orders</p>
                   <p className="text-base font-bold text-black leading-none">
                      ₹{summary.totalEarning.toFixed(0)}
                   </p>
                </div>
                <div>
                   <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Bonus</p>
                   <p className="text-base font-bold text-black leading-none">
                      ₹{summary.totalBonus.toFixed(0)}
                   </p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Total</p>
                   <p className="text-base font-bold text-[#FF0000] leading-none">
                      ₹{summary.grandTotal.toFixed(0)}
                   </p>
                </div>
             </div>
          </div>

          {/* Orders List */}
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Loading Statement...</p>
             </div>
          ) : orders.length === 0 ? (
             <div className="bg-white rounded-xl p-10 text-center shadow-sm border border-gray-100">
                <Clock className="w-10 h-10 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-900 text-lg font-bold mb-1">No transactions</p>
                <p className="text-gray-400 text-sm font-medium">Koi transaction nahi mili is hafta k liye.</p>
             </div>
          ) : (
             <div className="space-y-4">
                {orders.map((trip, index) => {
                   const amounts = getOrderAmounts(trip);
                   const createdAt = trip.deliveredAt || trip.completedAt || trip.createdAt || trip.orderTime;
                   const dateText = createdAt
                      ? new Date(createdAt).toLocaleString('en-IN', {
                           day: '2-digit',
                           month: 'short',
                           hour: '2-digit',
                           minute: '2-digit'
                        })
                      : 'N/A';

                   const orderId = trip.orderId || trip.id || trip._id;

                   return (
                      <div
                        key={orderId || index}
                        className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
                      >
                         <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                               <div className={`w-2 h-2 rounded mt-1.5 ${
                                  index % 3 === 0 ? 'bg-green-500' : 
                                  index % 3 === 1 ? 'bg-red-500' : 'bg-blue-500'
                               }`}></div>
                               <div>
                                  <p className="text-gray-900 text-sm font-bold mb-0.5">
                                     Order #{orderId?.slice(-6) || '...'}
                                  </p>
                                  <p className="text-gray-400 text-[11px] font-bold mb-1 uppercase tracking-tight">{dateText}</p>
                                  {trip.restaurantName && (
                                     <p className="text-gray-500 text-xs font-medium italic">
                                        {trip.restaurantName}
                                     </p>
                                  )}
                               </div>
                            </div>
                            <div className="text-right">
                               <div className="mb-2">
                                  <p className="text-[10px] text-gray-400 font-bold uppercase">Earning</p>
                                  <p className="text-sm font-bold text-black">
                                     ₹{amounts.earning}
                                  </p>
                               </div>
                               {amounts.bonus > 0 && (
                                  <div className="mb-2">
                                     <p className="text-[10px] text-emerald-500 font-bold uppercase">Bonus</p>
                                     <p className="text-sm font-bold text-emerald-600">
                                        + ₹{amounts.bonus}
                                     </p>
                                  </div>
                               )}
                               <div className="pt-2 border-t border-gray-50">
                                  <p className="text-[10px] text-gray-800 font-bold uppercase">Total</p>
                                  <p className="text-base font-bold text-[#FF0000]">
                                     ₹{amounts.total}
                                  </p>
                               </div>
                            </div>
                         </div>
                      </div>
                   );
                })}
             </div>
          )}
       </div>
    </div>
  );
};
