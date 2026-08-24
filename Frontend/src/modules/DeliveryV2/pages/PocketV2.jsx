import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, IndianRupee, ArrowRight,
  ShieldCheck, AlertTriangle, HelpCircle,
  Receipt, FileText, LayoutGrid, X, ChevronRight,
  Sparkles, Loader2, Gift, Building2, UploadCloud, Copy, CheckCircle2, QrCode, Smartphone
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deliveryAPI, uploadAPI } from '@food/api';
import { toast } from 'sonner';
import { formatCurrency } from '@food/utils/currency';
import { initRazorpayPayment } from "@food/utils/razorpay";
import { getCompanyNameAsync } from "@common/utils/businessSettings";

// Simple client-side image compression
const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Canvas is empty'));
          const newFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(newFile);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const PocketV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [walletState, setWalletState] = useState({
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
  });

  const [activeOffer, setActiveOffer] = useState({
    targetAmount: 0,
    targetOrders: 0,
    currentOrders: 0,
    currentEarnings: 0,
    validTill: '',
    isLive: false
  });

  const [adminBankDetails, setAdminBankDetails] = useState(null);

  // Deposit State
  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [depositStep, setDepositStep] = useState("select_method"); // select_method, razorpay, manual
  const [depositing, setDepositing] = useState(false);
  
  // Manual Deposit State
  const [proofImageFile, setProofImageFile] = useState(null);
  const [proofImagePreview, setProofImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileRes, earningsRes, walletRes, cashLimitRes] = await Promise.all([
          deliveryAPI.getProfile(),
          deliveryAPI.getEarnings({ period: 'week' }),
          deliveryAPI.getWallet(),
          deliveryAPI.getCashLimit().catch(() => null)
        ]);

        const profile = profileRes?.data?.data?.profile || {};
        const summary = earningsRes?.data?.data?.summary || {};
        const wallet = walletRes?.data?.data?.wallet || {};
        const activeAddonsRes = await deliveryAPI.getActiveEarningAddons().catch(() => null);
        const activeOfferPayload = activeAddonsRes?.data?.data?.activeOffer || activeAddonsRes?.data?.activeOffer || null;
        const bankDetails = profile?.documents?.bankDetails;
        const isFilled = !!(bankDetails?.accountNumber);

        if (cashLimitRes?.data?.data?.adminBankDetails) {
          setAdminBankDetails(cashLimitRes.data.data.adminBankDetails);
        }

        setWalletState({
          totalBalance: Number(wallet.pocketBalance) || 0,
          cashInHand: Number(wallet.cashInHand) || 0,
          availableCashLimit: Number(wallet.availableCashLimit) || 0,
          totalCashLimit: Number(wallet.totalCashLimit) || 0,
          weeklyEarnings: Number(summary.totalEarnings) || 0,
          weeklyOrders: Number(summary.totalOrders) || 0,
          payoutAmount: Number(wallet.lastPayout?.amount || wallet.totalWithdrawn || 0),
          payoutPeriod: wallet.lastPayout ? new Date(wallet.lastPayout.date).toLocaleDateString() : 'No recent payout',
          totalBonus: Number(wallet.totalBonus) || 0,
          bankDetailsFilled: isFilled
        });

        setActiveOffer({
           targetAmount: Number(activeOfferPayload?.targetAmount) || 0,
           targetOrders: Number(activeOfferPayload?.targetOrders) || 0,
           currentOrders: Number(activeOfferPayload?.currentOrders) || 0,
           currentEarnings: Number(activeOfferPayload?.currentEarnings) || 0,
           validTill: activeOfferPayload?.validTill || '',
           isLive: Boolean(activeOfferPayload)
        });

      } catch (err) {
        toast.error('Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRazorpayDeposit = async () => {
    const amt = walletState.cashInHand;
    if (amt < 1) {
      toast.error("No cash in hand to deposit.");
      return;
    }
    try {
      setDepositing(true);
      const orderRes = await deliveryAPI.createDepositOrder(amt);
      const data = orderRes?.data?.data;
      const rp = data?.razorpay;
      
      if (!rp?.orderId) {
        toast.error("Payment initialization failed");
        setDepositing(false);
        return;
      }

      const profileRes = await deliveryAPI.getProfile();
      const profile = profileRes?.data?.data?.profile || {};
      const companyName = await getCompanyNameAsync();

      await initRazorpayPayment({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency || "INR",
        order_id: rp.orderId,
        name: companyName,
        description: `Cash limit deposit - ₹${amt}`,
        prefill: { 
           name: profile.name, 
           email: profile.email, 
           contact: profile.phone 
        },
        handler: async (res) => {
          try {
            const verifyRes = await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              amount: amt
            });
            if (verifyRes?.data?.success) {
              toast.success("Deposit successful");
              setShowDepositPopup(false);
              window.location.reload();
            }
          } catch (err) {
            toast.error("Verification failed");
          } finally {
            setDepositing(false);
          }
        },
        onError: () => setDepositing(false),
        onClose: () => setDepositing(false)
      });
    } catch (err) {
      setDepositing(false);
      toast.error(err?.response?.data?.message || "Deposit failed to start");
    }
  };

  const handleManualDeposit = async () => {
    if (!proofImageFile) {
      toast.error("Please upload the payment proof screenshot.");
      return;
    }

    try {
      setUploading(true);
      setDepositing(true);
      
      let finalFile = proofImageFile;
      if (proofImageFile.type.startsWith('image/')) {
        try {
          finalFile = await compressImage(proofImageFile);
        } catch (e) {
          console.warn("Compression failed, using original file", e);
        }
      }

      const uploadRes = await uploadAPI.uploadMedia(finalFile);
      const proofImageUrl = uploadRes?.data?.data?.url;
      
      if (!proofImageUrl) throw new Error("Image upload failed");

      let paymentMethod = 'upi';
      if (depositStep === 'manual_bank') paymentMethod = 'bank_transfer';

      const depositRes = await deliveryAPI.submitManualDeposit({
        paymentMethod,
        proofImageUrl
      });

      if (depositRes?.data?.success) {
        toast.success("Deposit submitted for approval.");
        setShowDepositPopup(false);
        setProofImageFile(null);
        setProofImagePreview(null);
      } else {
        throw new Error(depositRes?.data?.message || "Deposit submission failed");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Manual deposit failed");
    } finally {
      setUploading(false);
      setDepositing(false);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImageFile(file);
      setProofImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

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
       <div className="w-10 h-10 border-4 border-[#ff8100] border-t-transparent rounded-full animate-spin mb-4" />
       <p className="text-xs font-semibold text-gray-500">Loading Pocket...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-24 font-poppins selection:bg-orange-500/30">
       
       {/* 1. APP BAR */}
       <div className="sticky top-0 z-50 bg-white px-5 py-4 flex items-center gap-4 border-b border-gray-100 shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-500">
             <Wallet className="w-6 h-6" />
          </div>
          <div>
             <h1 className="text-[18px] font-black text-black uppercase tracking-tight leading-none mb-1">Pocket History</h1>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Earnings & Wallet Hub</p>
          </div>
       </div>

       <div className="px-5 mt-6 space-y-4">
          {/* 2. EARNINGS CARD */}
          <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center border border-gray-100">
             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                Earnings: {getCurrentWeekRange()}
             </p>
             <h2 className="text-4xl font-black text-black">
                ₹{walletState.weeklyEarnings}
             </h2>
          </div>

          {/* 3. BALANCES & DEPOSIT CARD */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
             {/* Pocket Balance Row */}
             <div className="flex items-center justify-between cursor-pointer" onClick={() => navigate('/food/delivery/pocket/balance')}>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-800 border border-gray-100">
                      <Wallet className="w-5 h-5" />
                   </div>
                   <div>
                      <h3 className="text-[15px] font-bold text-[#0A192F] leading-tight">Pocket balance</h3>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Withdrawal Hub</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[15px] font-black text-black">₹{walletState.totalBalance.toFixed(2)}</span>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
             </div>

             {/* Divider */}
             <div className="h-px w-full bg-gray-100" />

             {/* Available Cash Limit Row */}
             <div className="flex items-center justify-between cursor-pointer" onClick={() => navigate('/food/delivery/pocket/details')}>
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-800 border border-gray-100">
                      <ShieldCheck className="w-5 h-5" />
                   </div>
                   <div>
                      <h3 className="text-[15px] font-bold text-[#0A192F] leading-tight">Available cash limit</h3>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Spend Control</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[15px] font-black text-black">₹{walletState.availableCashLimit.toFixed(2)}</span>
                   <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
             </div>

             {/* Deposit Button */}
             <div className="pt-2">
                <button 
                   onClick={() => {
                     setDepositStep('select_method');
                     setShowDepositPopup(true);
                   }}
                   disabled={walletState.cashInHand < 1}
                   className="w-full py-3.5 bg-[#FF8100] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#e67300] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   Deposit Cash
                </button>
             </div>
          </div>

          {/* 4. ROW OF TWO CARDS */}
          <div className="flex gap-4">
             <div onClick={() => navigate('/food/delivery/pocket/payout')} className="flex-1 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer">
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-primary mb-6">
                   <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Payout</p>
                   <p className="text-xl font-black text-black leading-none mb-1">₹{walletState.payoutAmount}</p>
                   <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tight">Prev Week Info</p>
                </div>
             </div>

             <div onClick={() => navigate('/food/delivery/pocket/limit-settlement')} className="flex-1 bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col justify-between cursor-pointer">
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-400 mb-6">
                   <Receipt className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-[13px] font-bold text-black leading-tight">Limit Settlement</p>
                </div>
             </div>
          </div>

          {/* 5. REFERRAL BONUS CARD */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer" onClick={() => navigate('/food/delivery/pocket/balance')}>
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                   <Gift className="w-6 h-6" />
                </div>
                <div>
                   <h3 className="text-[15px] font-bold text-[#0A192F] leading-tight">Referral Bonus</h3>
                   <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Earned Rewards</p>
                </div>
             </div>
             <div className="text-right">
                <span className="text-lg font-black text-[#0B8A00]">+₹ {walletState.totalBonus.toFixed(2)}</span>
             </div>
          </div>
       </div>

       {/* DEPOSIT MODAL */}
       <AnimatePresence>
          {showDepositPopup && (
             <div className="fixed inset-0 z-[1000] flex items-end">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !depositing && setShowDepositPopup(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                <motion.div 
                   drag={depositing ? false : "y"}
                   dragConstraints={{ top: 0, bottom: 0 }}
                   dragElastic={0.1}
                   onDragEnd={(e, info) => {
                      if (info.offset.y > 100 && !depositing) setShowDepositPopup(false);
                   }}
                   initial={{ y: '100%' }} 
                   animate={{ y: 0 }} 
                   exit={{ y: '100%' }} 
                   transition={{ type: "spring", damping: 25, stiffness: 200 }} 
                   className="relative w-full bg-white rounded-t-[2.5rem] p-6 pb-12 shadow-2xl max-h-[90vh] overflow-y-auto"
                >
                   {!depositing && <div className="w-16 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />}
                   
                   {depositStep === 'select_method' && (
                     <>
                       <div className="text-center mb-6">
                          <h3 className="text-xl font-black text-black mb-1">Select Payment Method</h3>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Settle Hand Dues</p>
                       </div>
                       
                       <div className="bg-orange-50 rounded-2xl p-5 mb-6 border border-orange-100 flex flex-col items-center">
                          <span className="text-[10px] font-bold text-orange-600 uppercase mb-1">Amount payable to admin</span>
                          <span className="text-3xl font-black text-orange-600">₹{walletState.cashInHand}</span>
                       </div>
                       
                       <div className="space-y-3">
                          {/* Razorpay disabled temporarily for iOS Web App
                          <button 
                             onClick={handleRazorpayDeposit}
                             className="w-full p-4 border border-gray-200 rounded-2xl hover:border-black active:bg-gray-50 transition-all flex items-center justify-between"
                          >
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-orange-50 text-primary rounded-full flex items-center justify-center">
                                 <ShieldCheck className="w-5 h-5" />
                               </div>
                               <div className="text-left">
                                 <h4 className="text-sm font-bold text-black">Online Payment</h4>
                                 <p className="text-[10px] text-gray-500">Pay via Razorpay (Instant Approval)</p>
                               </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-gray-400" />
                          </button>
                          */}
                          
                          <button 
                             onClick={() => setDepositStep('select_manual_method')}
                             className="w-full p-4 border border-gray-200 rounded-2xl hover:border-black active:bg-gray-50 transition-all flex items-center justify-between"
                          >
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                                 <Building2 className="w-5 h-5" />
                               </div>
                               <div className="text-left">
                                 <h4 className="text-sm font-bold text-black">Admin Details</h4>
                                 <p className="text-[10px] text-gray-500">Manual Bank/UPI Transfer & Upload Proof</p>
                               </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-gray-400" />
                          </button>
                       </div>
                     </>
                   )}

                   {depositStep === 'select_manual_method' && (
                     <>
                       <div className="flex items-center gap-3 mb-6">
                          <button onClick={() => setDepositStep('select_method')} className="p-2 bg-gray-100 rounded-full text-gray-600">
                             <ArrowRight className="w-4 h-4 rotate-180" />
                          </button>
                          <div>
                            <h3 className="text-lg font-black text-black leading-none">Manual Transfer</h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Select Payment Mode</p>
                          </div>
                       </div>
                       
                       <div className="bg-orange-50 rounded-xl p-4 mb-5 border border-orange-100 flex justify-between items-center">
                          <span className="text-xs font-bold text-orange-600 uppercase">Amount payable</span>
                          <span className="text-xl font-black text-orange-600">₹{walletState.cashInHand}</span>
                       </div>

                       <div className="space-y-3">
                          <button 
                             onClick={() => setDepositStep('manual_bank')}
                             className="w-full p-4 border border-gray-200 rounded-2xl hover:border-black active:bg-gray-50 transition-all flex items-center justify-between"
                          >
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                                 <Building2 className="w-5 h-5" />
                               </div>
                               <div className="text-left">
                                 <h4 className="text-sm font-bold text-black">Bank Details</h4>
                                 <p className="text-[10px] text-gray-500">Account Transfer & Upload Proof</p>
                               </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-gray-400" />
                          </button>
                          
                          <button 
                             onClick={() => setDepositStep('manual_qr')}
                             className="w-full p-4 border border-gray-200 rounded-2xl hover:border-black active:bg-gray-50 transition-all flex items-center justify-between"
                          >
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-orange-50 text-primary rounded-full flex items-center justify-center">
                                 <QrCode className="w-5 h-5" />
                               </div>
                               <div className="text-left">
                                 <h4 className="text-sm font-bold text-black">QR Code</h4>
                                 <p className="text-[10px] text-gray-500">Scan & Upload Proof</p>
                               </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-gray-400" />
                          </button>

                          <button 
                             onClick={() => setDepositStep('manual_upi')}
                             className="w-full p-4 border border-gray-200 rounded-2xl hover:border-black active:bg-gray-50 transition-all flex items-center justify-between"
                          >
                             <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-orange-50 text-primary rounded-full flex items-center justify-center">
                                 <Smartphone className="w-5 h-5" />
                               </div>
                               <div className="text-left">
                                 <h4 className="text-sm font-bold text-black">UPI ID</h4>
                                 <p className="text-[10px] text-gray-500">UPI App & Upload Proof</p>
                               </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-gray-400" />
                          </button>
                       </div>
                     </>
                   )}

                   {(depositStep === 'manual_bank' || depositStep === 'manual_qr' || depositStep === 'manual_upi') && (
                     <>
                       <div className="flex items-center gap-3 mb-6">
                          <button onClick={() => {
                            setDepositStep('select_manual_method');
                            setProofImageFile(null);
                            setProofImagePreview(null);
                          }} className="p-2 bg-gray-100 rounded-full text-gray-600">
                             <ArrowRight className="w-4 h-4 rotate-180" />
                          </button>
                          <div>
                            <h3 className="text-lg font-black text-black leading-none">
                              {depositStep === 'manual_bank' ? 'Bank Transfer' : depositStep === 'manual_qr' ? 'QR Code Transfer' : 'UPI Transfer'}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Admin Payment Details</p>
                          </div>
                       </div>
                       
                       <div className="bg-orange-50 rounded-xl p-4 mb-5 border border-orange-100 flex flex-col gap-1">
                          <span className="text-xs font-bold text-orange-600 uppercase">Amount payable</span>
                          <input 
                            type="text" 
                            readOnly 
                            value={`₹${walletState.cashInHand}`} 
                            className="bg-transparent text-xl font-black text-orange-600 border-none outline-none p-0 cursor-default" 
                          />
                          <span className="text-[9px] text-orange-400/80">Amount is locked and cannot be changed</span>
                       </div>

                       {adminBankDetails ? (
                         <div className="space-y-4 mb-6">
                           {depositStep === 'manual_qr' && adminBankDetails.upiQrCode && (
                              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-gray-200 mb-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Scan UPI QR to Pay</p>
                                <img src={adminBankDetails.upiQrCode} alt="Admin QR" className="w-32 h-32 object-contain mix-blend-multiply rounded" />
                              </div>
                           )}

                           {depositStep === 'manual_upi' && adminBankDetails.upiId && (
                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                                <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
                                  <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">UPI ID</p>
                                    <p className="text-sm font-semibold text-black">{adminBankDetails.upiId}</p>
                                  </div>
                                  <button onClick={() => handleCopy(adminBankDetails.upiId)} className="text-primary p-1.5 bg-orange-50 rounded-md active:bg-orange-100"><Copy className="w-3.5 h-3.5" /></button>
                                </div>
                             </div>
                           )}

                           {depositStep === 'manual_bank' && (
                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                               {adminBankDetails.accountNumber && (
                                 <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
                                   <div>
                                     <p className="text-[9px] font-bold text-gray-400 uppercase">Account Number</p>
                                     <p className="text-sm font-semibold text-black">{adminBankDetails.accountNumber}</p>
                                   </div>
                                   <button onClick={() => handleCopy(adminBankDetails.accountNumber)} className="text-primary p-1.5 bg-orange-50 rounded-md active:bg-orange-100"><Copy className="w-3.5 h-3.5" /></button>
                                 </div>
                               )}

                               {adminBankDetails.ifscCode && (
                                 <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
                                   <div>
                                     <p className="text-[9px] font-bold text-gray-400 uppercase">IFSC Code</p>
                                     <p className="text-sm font-semibold text-black">{adminBankDetails.ifscCode}</p>
                                   </div>
                                   <button onClick={() => handleCopy(adminBankDetails.ifscCode)} className="text-primary p-1.5 bg-orange-50 rounded-md active:bg-orange-100"><Copy className="w-3.5 h-3.5" /></button>
                                 </div>
                               )}
                               
                               {adminBankDetails.bankName && (
                                 <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-100">
                                   <div>
                                     <p className="text-[9px] font-bold text-gray-400 uppercase">Bank Name & Holder</p>
                                     <p className="text-sm font-semibold text-black">{adminBankDetails.bankName} - {adminBankDetails.accountHolderName}</p>
                                   </div>
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       ) : (
                         <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6 text-center">
                           <p className="text-xs text-gray-500">No admin bank details available.</p>
                         </div>
                       )}

                       <div className="mb-6">
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 text-center">Upload Payment Screenshot</p>
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-orange-300 rounded-xl bg-orange-50/50 hover:bg-orange-50 transition-colors cursor-pointer overflow-hidden relative">
                             {proofImagePreview ? (
                               <>
                                 <img src={proofImagePreview} alt="Proof preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                 <div className="relative z-10 flex flex-col items-center bg-black/60 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
                                   <CheckCircle2 className="w-5 h-5 mb-1 text-green-400" />
                                   <span className="text-[10px] font-bold">Image Selected</span>
                                 </div>
                               </>
                             ) : (
                               <>
                                 <UploadCloud className="w-6 h-6 text-orange-400 mb-2" />
                                 <span className="text-xs font-semibold text-orange-600">Tap to select image</span>
                                 <span className="text-[10px] text-orange-400/80 mt-1">JPEG, PNG only</span>
                               </>
                             )}
                             <input type="file" accept="image/*" className="hidden" onChange={onFileChange} disabled={depositing} />
                          </label>
                       </div>

                       <button 
                         onClick={handleManualDeposit}
                         disabled={depositing || !proofImageFile}
                         className="w-full py-4 bg-[#ff8100] text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-gray-300 disabled:shadow-none"
                       >
                         {depositing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                         {depositing ? (uploading ? 'Compressing & Uploading...' : 'Submitting...') : 'Submit Proof'}
                       </button>
                     </>
                   )}
                </motion.div>
             </div>
          )}
       </AnimatePresence>

    </div>
  );
};

export default PocketV2;
