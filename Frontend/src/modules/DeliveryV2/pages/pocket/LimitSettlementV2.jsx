import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * LimitSettlementV2 - 1:1 Match with Old LimitSettlement UI.
 * Background: #f6e9dc (for consistency with Pocket)
 * Font: Poppins
 */
export const LimitSettlementV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch deposit (cash limit settlement) transactions
        const response = await deliveryAPI.getWalletTransactions({ 
          type: 'deposit', 
          limit: 100 
        });
        
        if (response?.data?.success) {
          const fetched = response.data.data.transactions || [];
          setTransactions(fetched.map(t => ({
            id: t._id || t.id,
            amount: t.amount || 0,
            status: t.status || 'Pending',
            description: t.description || 'Available limit settlement',
            rejectionReason: t.rejectionReason || '',
            date: (() => {
              const rawDate = t.date || t.createdAt;
              if (!rawDate) return '—';
              const parsed = new Date(rawDate);
              if (isNaN(parsed.getTime())) return String(rawDate);
              try {
                return parsed.toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              } catch (e) {
                return parsed.toLocaleString();
              }
            })()
          })));
        }
      } catch (err) {
        toast.error('Failed to load settlement history');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getStatusInfo = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'approved':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'pending':
        return {
          icon: Clock,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200'
        };
      case 'denied':
      case 'rejected':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  return (
    <div className="app-shell-page min-h-screen bg-[#f6e9dc] font-poppins">
       {/* Header (Old UI Style) */}
       <div className="app-shell-page__header safe-top bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
          <button
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">
             Available limit settlement
          </h1>
       </div>

       {/* Main Content */}
       <div className="app-shell-page__body pb-32 px-4 py-6">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF0000] mb-4" />
                <p className="text-gray-600 text-sm font-medium">Loading transactions...</p>
             </div>
          ) : transactions.length > 0 ? (
             <div className="space-y-4">
                {transactions.map((tx, index) => {
                   const statusInfo = getStatusInfo(tx.status);
                   const StatusIcon = statusInfo.icon;

                   return (
                      <div
                        key={tx.id || index}
                        className={`bg-white rounded-xl p-4 shadow-sm border ${statusInfo.borderColor} transition-all active:scale-[0.98]`}
                      >
                         <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                               <div className="flex items-center gap-2 mb-2">
                                  <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                                     {tx.status}
                                  </span>
                               </div>
                               <p className="text-gray-900 text-xl font-bold mb-1 font-poppins">
                                  ₹{Number(tx.amount || 0).toFixed(2)}
                               </p>
                               <p className="text-gray-600 text-sm mb-1 font-medium">
                                  {tx.description}
                               </p>
                               <p className="text-gray-400 text-[11px] font-semibold">Date: {tx.date}</p>
                               {tx.status?.toLowerCase() === 'rejected' && tx.rejectionReason && (
                                  <div className="mt-2.5 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium">
                                     <span className="font-bold">Rejection Reason: </span>{tx.rejectionReason}
                                  </div>
                               )}
                            </div>
                         </div>
                      </div>
                   );
                })}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 border border-gray-100">
                   <Clock className="w-8 h-8 text-gray-200" />
                </div>
                <p className="text-gray-900 text-lg font-bold mb-2">No settlement transactions</p>
                <p className="text-gray-400 text-xs font-semibold leading-relaxed">
                   Whenever you settle the available limit, the payment transactions will appear here.
                </p>
             </div>
          )}
       </div>
    </div>
  );
};
