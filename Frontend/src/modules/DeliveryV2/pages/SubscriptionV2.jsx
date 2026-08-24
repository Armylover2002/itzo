import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, CheckCircle, Crown, Clock, Calendar, AlertCircle, Loader2, ShieldCheck, Zap, Star, Trophy, Wallet, IndianRupee, Plus, History, Info, ChevronRight } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { subscriptionAPI, deliveryAPI } from "@food/api"
import { initRazorpayPayment, initRazorpaySubscription } from "@food/utils/razorpay"
import { toast } from "react-hot-toast"
import dayjs from "dayjs"

export default function SubscriptionV2() {
  const navigate = useNavigate()
  const isMountedRef = useRef(true)
  const [plans, setPlans] = useState([])
  const [activeSub, setActiveSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(null)
  const purchasingRef = useRef(false)
  
  const [walletBalance, setWalletBalance] = useState(0)
  const [ledger, setLedger] = useState([])
  const [showTopupModal, setShowTopupModal] = useState(false)
  const [topupAmount, setTopupAmount] = useState("")
  const [topupLoading, setTopupLoading] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancellingSub, setCancellingSub] = useState(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Sort plans: DAY -> WEEK -> MONTH
  const sortedPlans = useMemo(() => {
    const order = { 'DAY': 1, 'WEEK': 2, 'MONTH': 3, 'YEAR': 4 };
    return [...plans].sort((a, b) => order[a.durationUnit] - order[b.durationUnit]);
  }, [plans]);

  const fetchData = async () => {
    try {
      setLoading(true)
      const [plansRes, subRes, walletRes, ledgerRes] = await Promise.all([
        subscriptionAPI.getPlans("DELIVERY_PARTNER"),
        subscriptionAPI.getMySubscription("DELIVERY_PARTNER"),
        deliveryAPI.getWallet(),
        subscriptionAPI.getWalletLedger("DELIVERY_PARTNER", { limit: 10 })
      ])
      setPlans(plansRes.data?.data || [])
      setActiveSub(subRes.data?.data || null)
      setWalletBalance(walletRes.data?.data?.wallet?.subscriptionBalance || 0)
      setLedger(ledgerRes.data?.data?.history || [])
    } catch (error) {
      toast.error("Failed to load subscription details")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const pollActiveSubscription = async ({ timeoutMs = 90_000, intervalMs = 2000 } = {}) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      if (!isMountedRef.current) return null
      try {
        const subRes = await subscriptionAPI.getMySubscription("DELIVERY_PARTNER")
        const sub = subRes.data?.data || null
        if (sub) {
          if (isMountedRef.current) setActiveSub(sub)
          return sub
        }
      } catch (_e) {
      }
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return null
  }

  const handlePurchase = async (plan) => {
    if (purchasingRef.current) return
    purchasingRef.current = true
    try {
      setPurchasing(plan._id)
      const res = await subscriptionAPI.purchase("DELIVERY_PARTNER", { planId: plan._id })
      const data = res.data?.data
      const isOneTime = !!data.orderId

      const options = {
        key: data.key,
        name: "Itzo Delivery Partner",
        description: `Plan: ${plan.name}`,
        handler: async (response) => {
          if (isOneTime) {
            try {
              await subscriptionAPI.verify("DELIVERY_PARTNER", {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
            } catch (_err) {
            }
          } else {
            try {
              await subscriptionAPI.verify("DELIVERY_PARTNER", {
                razorpaySubscriptionId: response.razorpay_subscription_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              })
            } catch (_err) {
            }
          }

          toast.success(isOneTime ? "Payment received. Activating..." : "Payment received. Activating subscription...")
          const activated = await pollActiveSubscription()
          if (activated) {
            toast.success("Subscription Active")
          } else {
            toast.success("Activation pending. Webhook will sync shortly.")
          }
          await fetchData()
          setPurchasing(null)
          purchasingRef.current = false
        }
        ,
        onError: () => {
          toast.error("Payment failed or cancelled")
          setPurchasing(null)
          purchasingRef.current = false
        },
        onClose: () => {
          toast.error("Payment cancelled")
          setPurchasing(null)
          purchasingRef.current = false
        }
      }

      if (data.orderId) {
        await initRazorpayPayment({ ...options, order_id: data.orderId, amount: data.amount })
      } else {
        await initRazorpaySubscription({ ...options, subscription_id: data.subscriptionId })
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Purchase failed")
      setPurchasing(null)
      purchasingRef.current = false
    }
  }

  const MIN_BALANCE = 1000;
  const isLowBalance = walletBalance < MIN_BALANCE;
  const requiredRecharge = Math.max(0, MIN_BALANCE - walletBalance);

  // Dynamic quick amounts based on balance
  const quickAmounts = isLowBalance
    ? [...new Set([requiredRecharge, 1000, 2000, 3000])].filter(Boolean).sort((a, b) => a - b).slice(0, 3)
    : [500, 1000, 2000]

  const handleTopup = async () => {
    const amt = parseFloat(topupAmount)
    if (!amt || isNaN(amt) || amt < 1) {
      toast.error("Enter a valid amount")
      return
    }

    if (isLowBalance && amt < requiredRecharge) {
      toast.error(`Minimum recharge required is ₹${requiredRecharge}`)
      return
    }

    try {
      setTopupLoading(true)
      const res = await subscriptionAPI.createWalletTopupOrder("DELIVERY_PARTNER", amt)
      const data = res.data?.data
      
      await initRazorpayPayment({
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: "Subscription Wallet Topup",
        description: `Topup Amount: ₹${amt}`,
        handler: async (response) => {
          try {
            await subscriptionAPI.verifyWalletTopup("DELIVERY_PARTNER", {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: amt
            })
            toast.success("Wallet recharged successfully")
            setShowTopupModal(false)
            setTopupAmount("")
            fetchData()
          } catch (err) {
            toast.error("Payment verification failed")
          }
        },
        onError: () => setTopupLoading(false),
        onClose: () => setTopupLoading(false)
      })
    } catch (err) {
      toast.error(err.response?.data?.message || "Recharge failed")
      setTopupLoading(false)
    }
  }

  const handleCancelAutoRenew = async () => {
    try {
      setCancellingSub(true)
      const res = await subscriptionAPI.cancelAutoRenew("DELIVERY_PARTNER")
      if (res.data?.data) {
        setActiveSub(res.data.data)
        toast.success("Auto-renewal cancelled successfully")
      } else {
        toast.success("Auto-renewal cancelled")
        await fetchData()
      }
      setShowCancelModal(false)
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to cancel auto-renewal")
    } finally {
      setCancellingSub(false)
    }
  }

  const getPlanIcon = (unit) => {
    switch (unit) {
      case 'DAY': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'WEEK': return <Star className="w-5 h-5 text-primary" />;
      case 'MONTH': return <Trophy className="w-5 h-5 text-orange-500" />;
      default: return <Crown className="w-5 h-5 text-primary" />;
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Premium Header */}
      <div className="bg-white px-4 py-5 sticky top-0 z-50 flex items-center gap-4 shadow-sm border-b border-slate-100">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-2xl transition-all active:scale-95">
          <ArrowLeft className="w-6 h-6 text-slate-900" />
        </button>
        <h1 className="text-xl font-black text-slate-900 tracking-tight">Partner Program</h1>
      </div>

      <div className="p-4 space-y-8 max-w-md mx-auto">
        {/* Active Status Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Plan</h3>
            {activeSub && (
              <span className="bg-green-500/10 text-green-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-green-500/20">
                Healthy
              </span>
            )}
          </div>
          
          <AnimatePresence>
            {activeSub ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-rose-600 rounded-[32px] blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[32px] p-6 text-white shadow-2xl overflow-hidden border border-white/10">
                  <div className="absolute -top-10 -right-10 opacity-10 rotate-12">
                    <ShieldCheck className="w-48 h-48" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10">
                        {getPlanIcon(activeSub.planId?.durationUnit)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black tracking-tight">{activeSub.planId?.name}</h2>
                        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">{activeSub.status === 'active' ? 'Active Now' : 'Grace Period'}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                        <p className="text-white/40 text-[9px] font-black uppercase tracking-tighter mb-1">Expires On</p>
                        <p className="text-sm font-bold">{dayjs(activeSub.expiryDate).format("DD MMM, YYYY")}</p>
                      </div>
                      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
                        <p className="text-white/40 text-[9px] font-black uppercase tracking-tighter mb-1">Pass ID</p>
                        <p className="text-sm font-bold truncate">#{activeSub._id.toString().slice(-6).toUpperCase()}</p>
                      </div>
                    </div>

                    {activeSub.razorpaySubscriptionId && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        {activeSub.cancelAtCycleEnd ? (
                          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold bg-white/5 p-3 rounded-2xl border border-white/10">
                            <Info className="w-4 h-4 shrink-0 text-amber-400" />
                            <span>Auto renewal cancelled. Plan active till {dayjs(activeSub.expiryDate).format("DD MMM, YYYY")}</span>
                          </div>
                        ) : (
                          activeSub.status === 'active' && activeSub.autoRenew && (
                            <button
                              onClick={() => setShowCancelModal(true)}
                              className="w-full py-2.5 px-4 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-200 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                              Cancel Auto Renewal
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-[32px] p-8 text-center border border-slate-100 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#FE5502]">
                    <Crown className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">No Active Plan</h2>
                  <p className="text-slate-500 text-xs mt-2 leading-relaxed px-4">Subscribe to a plan or go Online to activate a Daily Pass.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Subscription Wallet Card */}
        <div className="relative group">
          <div className="absolute inset-0 bg-orange-500 rounded-[32px] blur-xl opacity-5 group-hover:opacity-10 transition-opacity" />
          <div className="relative bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100 shadow-inner">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Credits</h3>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${walletBalance >= 1000 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className={`text-[10px] font-black uppercase tracking-widest ${walletBalance >= 1000 ? 'text-green-600' : 'text-red-500'}`}>
                      {walletBalance >= 1000 ? 'Healthy Balance' : 'Low Balance'}
                    </p>
                  </div>
                </div>
              </div>
              {/* Razorpay disabled temporarily for iOS Web App
              <Button 
                onClick={() => setShowTopupModal(true)}
                className="bg-[#FE5502] hover:bg-[#E64D02] text-white rounded-2xl px-5 py-2.5 h-auto flex items-center gap-2 text-xs font-black shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                Recharge
              </Button>
              */}
            </div>

            <div className="bg-slate-50 rounded-[28px] p-6 flex flex-col gap-4 border border-slate-100/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1">Available Credits</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">₹{walletBalance.toFixed(0)}</span>
                    <span className="text-slate-400 text-xs font-bold">.{(walletBalance % 1).toFixed(2).slice(2)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1">Threshold</p>
                  <p className="text-sm font-black text-slate-900">₹1000</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-slate-400">Eligibility Progress</span>
                  <span className={walletBalance >= 1000 ? 'text-green-600' : 'text-orange-600'}>
                    {Math.min(Math.round((walletBalance / 1000) * 100), 100)}%
                  </span>
                </div>
                <div className="w-full h-3 bg-white rounded-full p-0.5 border border-slate-100 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((walletBalance / 1000) * 100, 100)}%` }}
                    className={`h-full rounded-full ${walletBalance >= 1000 ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-orange-400 to-orange-600'}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Membership Plans</h3>
          </div>

          {loading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-[28px] animate-pulse border border-slate-100" />)}
            </div>
          ) : (
            <div className="grid gap-4">
              {sortedPlans.map((plan) => {
                const hasLockedSubscription = !!(activeSub && ["active", "grace"].includes(activeSub.status));
                const isCurrentPlan = !!(activeSub && ["active", "grace"].includes(activeSub.status) && activeSub.planId?._id === plan._id);
                const isLocked = hasLockedSubscription && !isCurrentPlan;
                return (
                  <div 
                    key={plan._id}
                    className={`relative bg-white rounded-[28px] p-5 border-2 transition-all duration-300 ${isCurrentPlan ? 'border-[#FE5502] shadow-xl shadow-orange-500/5' : 'border-slate-50 hover:border-slate-200 shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isCurrentPlan ? 'bg-[#FE5502] text-white shadow-lg shadow-orange-500/20' : 'bg-slate-50 text-slate-400'}`}>
                          {getPlanIcon(plan.durationUnit)}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 tracking-tight">{plan.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[#FE5502] font-black text-xl">₹{plan.price}</span>
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">/ {plan.durationValue} {plan.durationUnit.toLowerCase()}</span>
                          </div>
                        </div>
                      </div>

                      {plan.durationUnit === 'DAY' ? (
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 max-w-[140px] relative overflow-hidden group/tip">
                          <div className="flex items-start gap-2 relative z-10">
                            <Info className="w-3.5 h-3.5 text-slate-400 group-hover/tip:text-[#FE5502] transition-colors shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-slate-900 uppercase leading-none mb-1">Auto Start</p>
                              <p className="text-[9px] text-slate-400 font-bold leading-tight">Activates when you go Online.</p>
                            </div>
                          </div>
                          <div className="absolute top-0 right-0 p-1 opacity-[0.05] group-hover/tip:opacity-10 transition-opacity">
                            <Zap className="w-8 h-8 text-[#FE5502]" />
                          </div>
                        </div>
                      ) : (
                        /* Razorpay disabled temporarily for iOS Web App */
                        null
                        /*
                        <Button 
                          onClick={() => handlePurchase(plan)}
                          disabled={!!purchasing || hasLockedSubscription}
                          className={`rounded-2xl px-6 font-black h-12 transition-all shadow-lg ${(isCurrentPlan || isLocked) ? 'bg-slate-100 text-slate-400 shadow-none' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20'}`}
                        >
                          {purchasing === plan._id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : isCurrentPlan ? (
                            'Current'
                          ) : isLocked ? (
                            'Unavailable'
                          ) : (
                            'Subscribe'
                          )}
                        </Button>
                        */
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Activity History</h3>
            <History className="w-4 h-4 text-slate-300" />
          </div>

          <div className="bg-white rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
            {ledger.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                   <History className="w-8 h-8" />
                </div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No recent activity</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {ledger.map((entry) => (
                  <div key={entry._id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${entry.type === 'TOPUP' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                        {entry.type === 'TOPUP' ? <Plus className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 capitalize leading-tight">
                          {entry.type.replace(/_/g, ' ').toLowerCase()}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                          {dayjs(entry.createdAt).format("DD MMM, HH:mm")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black ${entry.type === 'TOPUP' ? 'text-green-600' : 'text-slate-900'}`}>
                        {entry.type === 'TOPUP' ? '+' : '-'}₹{entry.amount}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold">Bal: ₹{entry.afterBalance.toFixed(0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ledger.length > 0 && (
              <div className="p-4 bg-slate-50 text-center">
                <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">View All History</button>
              </div>
            )}
          </div>
        </div>

        {/* Security Footer */}
        <div className="text-center space-y-2 opacity-50 pb-8">
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-900" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Secure Payments via Razorpay</p>
          </div>
          <p className="text-[9px] font-bold text-slate-400 px-8 leading-relaxed">Financial data is encrypted. Subscription credits are valid for operational fees only and are non-refundable.</p>
        </div>
      </div>

      {/* Compact Premium Topup Modal */}
      <AnimatePresence>
        {showTopupModal && (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !topupLoading && setShowTopupModal(false)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
            >
              {/* Subtle top indicator */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 to-orange-400 opacity-20" />
              
              <div className="px-6 pt-8 pb-10">
                {/* Pull Handle */}
                <div className="w-10 h-1 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
                
                {/* Compact Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-[#FE5502] shrink-0 border border-orange-100">
                    <IndianRupee className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Recharge Credits</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Add funds to receive more orders</p>
                  </div>
                </div>

                {/* Compact Input Section */}
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                        <span className="text-xl font-black text-slate-300 group-focus-within:text-[#FE5502] transition-colors">₹</span>
                      </div>
                      <input 
                        type="number" 
                        value={topupAmount} 
                        onChange={(e) => setTopupAmount(e.target.value)}
                        placeholder={isLowBalance ? String(requiredRecharge) : "500"}
                        disabled={topupLoading}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-10 pr-6 text-2xl font-black text-slate-900 focus:bg-white focus:border-[#FE5502] focus:ring-4 focus:ring-orange-500/5 outline-none transition-all placeholder:text-slate-200"
                      />
                    </div>

                    {/* Slim Feedback Banner */}
                    <AnimatePresence mode="wait">
                      {isLowBalance && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.98 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.98 }}
                          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${topupAmount && parseFloat(topupAmount) < requiredRecharge ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}
                        >
                          {topupAmount && parseFloat(topupAmount) < requiredRecharge ? (
                            <AlertCircle className="w-4 h-4 shrink-0" />
                          ) : (
                            <Info className="w-4 h-4 shrink-0" />
                          )}
                          <p className="text-[11px] font-bold leading-tight">
                            {topupAmount && parseFloat(topupAmount) < requiredRecharge 
                              ? `Min recharge ₹${requiredRecharge} required for online status.`
                              : `Add ₹${requiredRecharge} to reach the ₹1000 eligibility threshold.`}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Compact Presets */}
                  <div className="flex gap-2">
                    {quickAmounts.map(amt => (
                      <button 
                        key={amt}
                        onClick={() => setTopupAmount(String(amt))}
                        className={`flex-1 py-3 rounded-xl text-[11px] font-black transition-all border ${topupAmount === String(amt) ? 'bg-[#FE5502] border-[#FE5502] text-white shadow-lg shadow-orange-500/20' : 'bg-white border-slate-100 text-slate-500 hover:border-orange-200 hover:text-orange-600'}`}
                      >
                        +₹{amt}
                      </button>
                    ))}
                  </div>

                  {/* Action Section */}
                  <div className="space-y-4 pt-2">
                    {/* Razorpay disabled temporarily for iOS Web App
                    <Button 
                      onClick={handleTopup}
                      disabled={topupLoading || !topupAmount || (isLowBalance && parseFloat(topupAmount) < requiredRecharge)}
                      className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-sm font-black shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {topupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      {topupLoading ? 'Processing...' : 'Proceed to Payment'}
                    </Button>
                    */}
                    
                    <button 
                      onClick={() => setShowTopupModal(false)}
                      disabled={topupLoading}
                      className="w-full py-1 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                    >
                      Cancel Recharge
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !cancellingSub && setShowCancelModal(false)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden border border-slate-100"
            >
              {/* Subtle top indicator */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 to-red-400 opacity-20" />
              
              <div className="px-6 pt-8 pb-10">
                {/* Pull Handle */}
                <div className="w-10 h-1 bg-slate-100 rounded-full mx-auto mb-6 sm:hidden" />
                
                {/* Compact Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shrink-0 border border-red-100">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1.5">Cancel Auto-Renewal?</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Stop future auto-debits</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-slate-600 text-xs leading-relaxed font-bold">
                      Your current plan remains <span className="text-green-600 font-black">active</span> until its expiry date. You will not lose paid access, but no further payments will be automatically debited.
                    </p>
                  </div>

                  {/* Action Section */}
                  <div className="space-y-4 pt-2">
                    <Button 
                      onClick={handleCancelAutoRenew}
                      disabled={cancellingSub}
                      className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center gap-2.5 disabled:opacity-40"
                    >
                      {cancellingSub ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      {cancellingSub ? 'Cancelling...' : 'Confirm Cancellation'}
                    </Button>
                    
                    <button 
                      onClick={() => setShowCancelModal(false)}
                      disabled={cancellingSub}
                      className="w-full py-1 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                    >
                      Keep Auto-Renewal
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
