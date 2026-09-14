import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Loader2, IndianRupee, HelpCircle,
  ShieldCheck, AlertTriangle
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * CashLimitInfoV2 - 1:1 Match with Old AvailableCashLimit Component.
 * Features: Breakthrough of Total Limit, Cash in hand, Deductions, etc.
 * Background: #f6e9dc
 * Font: Poppins
 */
export const CashLimitInfoV2 = () => {
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState({
     totalCashLimit: 0,
     cashInHand: 0,
     deductions: 0,
     pocketWithdrawals: 0,
     availableCashLimit: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const walletRes = await deliveryAPI.getWallet();
        const wallet = walletRes?.data?.data?.wallet || {};
        
        const totalLimit = Number(wallet.totalCashLimit) || 0;
        const cashInHand = Number(wallet.cashInHand) || 0;
        const deductions = Number(wallet.deductions) || 0;
        const withdrawals = Number(wallet.totalWithdrawn) || 0;
        const available = Number(wallet.availableCashLimit) || 0;

        setWalletState({
           totalCashLimit: totalLimit,
           cashInHand: cashInHand,
           deductions: deductions,
           pocketWithdrawals: withdrawals,
           availableCashLimit: available
        });
      } catch (err) {
        toast.error('Failed to load cash limit details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);


  const DetailRow = ({ label, value, subLabel }) => (
     <div className="py-4 flex justify-between items-start border-b border-gray-100">
        <div className="flex-1 pr-4">
           <p className="text-sm font-semibold text-gray-800">{label}</p>
           {subLabel && <p className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5">{subLabel}</p>}
        </div>
        <p className="text-sm font-bold text-black">{value}</p>
     </div>
  );

  return (
    <div className="app-shell-page min-h-screen bg-[#f6e9dc] font-poppins">
       {/* Header */}
       <div className="app-shell-page__header safe-top bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg">
             <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 leading-none">Available cash limit</h1>
       </div>

       <div className="app-shell-page__body pb-32">
       {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
             <Loader2 className="w-8 h-8 animate-spin text-red-500" />
             <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Checking Limits...</p>
          </div>
       ) : (
          <div className="px-4 py-6">
             <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                      <ShieldCheck className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="text-[17px] font-black tracking-tight leading-none mb-1">Total cash limit</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{formatCurrency(walletState.totalCashLimit)}</p>
                   </div>
                </div>

                <div className="space-y-1">
                   <DetailRow 
                      label="Total cash limit" 
                      value={formatCurrency(walletState.totalCashLimit)} 
                      subLabel="Resets every Monday and increases with earnings"
                   />
                   <DetailRow label="Cash in hand" value={formatCurrency(walletState.cashInHand)} />
                   <DetailRow label="Deductions" value={formatCurrency(walletState.deductions)} />
                   <DetailRow label="Pocket withdrawals" value={formatCurrency(walletState.pocketWithdrawals)} />

                   <div className="py-5 flex justify-between items-center bg-emerald-50/50 -mx-5 px-5 mt-2 transition-all">
                      <div className="text-sm font-black text-emerald-900 uppercase tracking-tight">Available cash limit</div>
                      <div className="text-lg font-black text-emerald-600">{formatCurrency(walletState.availableCashLimit)}</div>
                   </div>
                </div>
             </div>

             <div className="bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100 mb-6">
                <HelpCircle className="w-8 h-8 text-gray-200 mx-auto mb-4" />
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">How it works?</h4>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed px-4">
                   Your available limit is the maximum cash you can carry in hand. As you receive cash orders, this limit decreases. Settling your dues or earning more will increase this limit.
                </p>
             </div>

             <div className="px-2">
                <button 
                  onClick={goBack}
                  className="w-full py-4 bg-black text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                >
                   Okay
                </button>
             </div>
          </div>
       )}
       </div>
    </div>
  );
};
