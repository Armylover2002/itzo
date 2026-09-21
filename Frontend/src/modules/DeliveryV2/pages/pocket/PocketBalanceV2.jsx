import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, AlertTriangle, Loader2, IndianRupee,
  HelpCircle, ChevronRight
} from 'lucide-react';
import { deliveryAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import useDeliveryBackNavigation from '../../hooks/useDeliveryBackNavigation';

/**
 * PocketBalanceV2 - 1:1 Match with Old PocketBalance Page.
 * Features: Big Withdraw amount display, Withdraw button, and Detail rows.
 * Background: #f6e9dc
 * Font: Poppins
 */
export const PocketBalanceV2 = () => {
  const navigate = useNavigate();
  const goBack = useDeliveryBackNavigation();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState({
     pocketBalance: 0,
     weeklyEarnings: 0,
     totalBonus: 0,
     totalWithdrawn: 0,
     cashCollected: 0,
     deductions: 0,
     withdrawalLimit: 100,
     maxWithdrawalLimit: null,
     withdrawableAmount: 0,
     canWithdraw: false,
     disabledReason: ''
  });
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileRes, earningsRes, walletRes] = await Promise.all([
          deliveryAPI.getProfile(),
          deliveryAPI.getEarnings({ period: 'week' }),
          deliveryAPI.getWallet()
        ]);
        
        const summary = earningsRes?.data?.data?.summary || {};
        const wallet = walletRes?.data?.data?.wallet || {};
        
        const pocketBalance = Number(wallet.pocketBalance) || 0;
        const withdrawalLimit = Number(wallet.deliveryWithdrawalLimit) || 100;
        const rawMax = wallet.deliveryMaxWithdrawalLimit;
        const maxWithdrawalLimit =
          rawMax != null && Number(rawMax) > 0 ? Number(rawMax) : null;
        const maxAllowed =
          maxWithdrawalLimit != null
            ? Math.min(pocketBalance, maxWithdrawalLimit)
            : pocketBalance;
        const canWithdraw = pocketBalance > 0 && maxAllowed >= withdrawalLimit;
        let disabledReason = '';
        if (pocketBalance <= 0) {
          disabledReason = 'Withdrawable amount is ₹0';
        } else if (maxAllowed < withdrawalLimit) {
          disabledReason = `Minimum withdrawal requirement is ₹${withdrawalLimit}`;
        }

        setWalletState({
           pocketBalance,
           totalEarning: Number(wallet.totalEarned) || 0,
           orderEarning: Number(wallet.orderEarnings) || 0,
           addonEarning: Number(wallet.addonEarnings) || 0,
           weeklyEarnings: Number(summary.totalEarnings) || 0,
           totalBonus: Number(wallet.totalBonus) || 0,
           totalWithdrawn: Number(wallet.totalWithdrawn) || 0,
           cashCollected: Number(wallet.cashInHand) || 0,
           deductions: 0,
           withdrawalLimit,
           maxWithdrawalLimit,
           withdrawableAmount: maxAllowed,
           canWithdraw,
           disabledReason
        });

        if (canWithdraw) {
          setWithdrawalAmount(String(Number(maxAllowed.toFixed(2))));
        } else {
          setWithdrawalAmount('');
        }
      } catch (err) {
        toast.error('Failed to load pocket details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAmountChange = (raw) => {
    if (raw === '' || raw === '.') {
      setWithdrawalAmount(raw);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const maxAllowed = walletState.withdrawableAmount;
    if (n > maxAllowed) {
      setWithdrawalAmount(String(Number(maxAllowed.toFixed(2))));
      return;
    }
    setWithdrawalAmount(raw);
  };

  const handleWithdraw = async () => {
     const profileRes = await deliveryAPI.getProfile();
     const profile = profileRes?.data?.data?.profile || {};
     const bank = profile?.documents?.bankDetails;
     
     if (!bank?.accountNumber) {
        toast.error("Please add bank details first");
        navigate("/food/delivery/profile/details");
        return;
     }

     const amount = Number(withdrawalAmount);
     if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('Please enter a valid amount');
        return;
     }
     if (amount < walletState.withdrawalLimit) {
        toast.error(`Minimum withdrawal amount is ₹${walletState.withdrawalLimit}`);
        return;
     }
     if (
       walletState.maxWithdrawalLimit != null &&
       amount > walletState.maxWithdrawalLimit
     ) {
        toast.error(`Maximum withdrawal amount is ₹${walletState.maxWithdrawalLimit}`);
        return;
     }
     if (amount > walletState.pocketBalance) {
        toast.error('Amount cannot exceed pocket balance');
        return;
     }
     if (amount > walletState.withdrawableAmount) {
        toast.error(`You can withdraw maximum ₹${walletState.withdrawableAmount} in one request`);
        return;
     }

     setWithdrawSubmitting(true);
     try {
        const res = await deliveryAPI.createWithdrawalRequest({
           amount,
           paymentMethod: 'bank_transfer'
        });
        if (res?.data?.success) {
           toast.success("Withdrawal request submitted");
           goBack();
        }
     } catch (err) {
        toast.error(err?.response?.data?.message || "Withdrawal failed");
     } finally {
        setWithdrawSubmitting(false);
     }
  };

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
          <h1 className="text-lg font-bold text-gray-900 leading-none">Pocket balance</h1>
       </div>

       <div className="app-shell-page__body pb-32">
       {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
             <Loader2 className="w-8 h-8 animate-spin text-red-500" />
             <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Loading Balance...</p>
          </div>
       ) : (
          <>
             {/* Warning Banner */}
             {!walletState.canWithdraw && (
               <div className="bg-yellow-400 p-4 flex items-start gap-3 border-b border-yellow-500/10">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                     <p className="text-xs font-bold">Withdraw currently disabled</p>
                     <p className="text-[10px] font-medium opacity-80 leading-tight mt-1">
                        {walletState.disabledReason || `Minimum withdrawal requirement is ₹${walletState.withdrawalLimit}`}
                     </p>
                  </div>
               </div>
             )}

             {/* Top Withdraw Section */}
             <div className="bg-white p-8 mb-4 text-center border-b border-gray-100 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Pocket Balance</p>
                <h2 className="text-4xl font-black text-black mb-2 tracking-tighter">{formatCurrency(walletState.pocketBalance)}</h2>
                <p className="text-[11px] font-medium text-gray-500 mb-5">
                  Min ₹{walletState.withdrawalLimit}
                  {walletState.maxWithdrawalLimit != null
                    ? ` · Max ₹${walletState.maxWithdrawalLimit}`
                    : ' · Max Unlimited'}
                  {' '}· Per request up to {formatCurrency(walletState.withdrawableAmount)}
                </p>

                <div className="text-left mb-5">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Enter withdrawal amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-gray-900">₹</span>
                    <input
                      type="number"
                      min={walletState.withdrawalLimit}
                      max={walletState.withdrawableAmount}
                      step="0.01"
                      value={withdrawalAmount}
                      onChange={(e) => handleAmountChange(e.target.value)}
                      disabled={!walletState.canWithdraw}
                      placeholder={`${walletState.withdrawalLimit} - ${walletState.withdrawableAmount}`}
                      className="w-full pl-9 pr-4 py-4 rounded-xl border border-gray-200 bg-gray-50 text-2xl font-black text-gray-950 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                    />
                  </div>
                  {withdrawalAmount !== '' && Number(withdrawalAmount) > 0 && Number(withdrawalAmount) < walletState.withdrawalLimit && (
                    <p className="text-xs text-red-600 font-medium mt-2">
                      Minimum withdrawal amount is ₹{walletState.withdrawalLimit}
                    </p>
                  )}
                  {withdrawalAmount !== '' && Number(withdrawalAmount) > walletState.withdrawableAmount && (
                    <p className="text-xs text-red-600 font-medium mt-2">
                      Maximum you can withdraw now is {formatCurrency(walletState.withdrawableAmount)}
                    </p>
                  )}
                </div>
                
                <button 
                  onClick={handleWithdraw}
                  disabled={
                    !walletState.canWithdraw ||
                    withdrawSubmitting ||
                    !withdrawalAmount ||
                    Number(withdrawalAmount) < walletState.withdrawalLimit ||
                    Number(withdrawalAmount) > walletState.withdrawableAmount
                  }
                  className={`w-full py-4 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98] ${
                     walletState.canWithdraw 
                     ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                     : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  } flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                   {withdrawSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                   {withdrawSubmitting ? 'Processing...' : 'Withdraw'}
                </button>
             </div>

             {/* Details Section */}
             <div className="bg-gray-100/50 py-2 px-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Pocket Details</p>
             </div>

             <div className="bg-white px-4">
                <DetailRow label="Total Earnings" value={formatCurrency(walletState.totalEarning)} />
                <DetailRow label="Order Earnings" value={formatCurrency(walletState.orderEarning)} />
                <DetailRow label="Addon Earnings" value={formatCurrency(walletState.addonEarning)} />
                <DetailRow label="Bonus" value={formatCurrency(walletState.totalBonus)} />
                <DetailRow label="Amount withdrawn" value={formatCurrency(walletState.totalWithdrawn)} />
                <DetailRow label="Cash collected" value={formatCurrency(walletState.cashCollected)} />

                <DetailRow 
                  label="Pocket balance" 
                  value={formatCurrency(walletState.pocketBalance)} 
                  subLabel={`(Earn: ${formatCurrency(walletState.totalEarning)} + Bonus: ${formatCurrency(walletState.totalBonus)})`}
                />
                <DetailRow label="Withdrawable amount" value={formatCurrency(walletState.withdrawableAmount)} />
             </div>
          </>
       )}
       </div>
    </div>
  );
};
