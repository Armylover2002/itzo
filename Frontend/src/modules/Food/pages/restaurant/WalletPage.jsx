import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import Lenis from "lenis"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import {
  Wallet,
  IndianRupee,
  Clock,
  CheckCircle,
  TrendingUp,
  X,
  AlertCircle,
  Loader2,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  SlidersHorizontal
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import { Input } from "@food/components/ui/input"
import { restaurantAPI } from "@food/api"
import { formatCurrency } from "@food/utils/currency"
import { toast } from "react-hot-toast"
import dayjs from "dayjs"
import { initRazorpayPayment } from "@food/utils/razorpay"

export default function WalletPage() {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState("")

  // Real database state
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [submittingRecharge, setSubmittingRecharge] = useState(false)

  const fetchWalletData = async () => {
    try {
      setLoading(true)
      const [walletRes, subRes] = await Promise.all([
        restaurantAPI.getSubscriptionWallet(),
        restaurantAPI.getMySubscription()
      ])

      if (walletRes.data?.success) {
        setWallet(walletRes.data.data)
      }
      if (subRes.data?.success) {
        setSubscription(subRes.data.data)
      }
    } catch (error) {
      toast.error("Failed to fetch subscription data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWalletData()
  }, [])

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount)
    if (!rechargeAmount || isNaN(amount) || amount < 100) {
      toast.error("Minimum recharge amount is ₹100")
      return
    }

    // Frontend validation for minimum balance
    if (isLowBalance && amount < requiredRecharge) {
      toast.error(`Minimum recharge required is ₹${requiredRecharge}`)
      return
    }

    try {
      setSubmittingRecharge(true)
      const response = await restaurantAPI.createSubscriptionTopupOrder(amount)

      if (response.data?.success) {
        const orderData = response.data.data

        await initRazorpayPayment({
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.order_id,
          name: "ITZO Subscriptions",
          description: "Wallet Top-up",
          prefill: {
            name: "Restaurant Partner",
          },
          handler: async (response) => {
            try {
              await restaurantAPI.verifyTopup({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
                amount: amount
              })
              toast.success("Payment successful! Wallet credited.")
              fetchWalletData()
              setShowRechargeModal(false)
            } catch (verifyErr) {
              toast.error("Payment done but verification failed. Contact support.")
            }
          },
          onError: (err) => {
            toast.error(err.description || "Payment failed")
          }
        })
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Recharge failed")
    } finally {
      setSubmittingRecharge(false)
    }
  }

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f6e9dc] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#ff8100] animate-spin" />
      </div>
    )
  }

  const activePass = wallet?.activePass
  const ledger = wallet?.ledger || []
  const subStatus = subscription?.status || 'inactive'
  const subPlan = subscription?.planId

  // Minimum balance enforcement
  const MIN_BALANCE = 1000
  const currentBalance = wallet?.subscriptionBalance || 0
  const isLowBalance = currentBalance < MIN_BALANCE
  const requiredRecharge = Math.max(0, MIN_BALANCE - currentBalance)

  // Dynamic quick amounts based on balance (no duplicates)
  const quickAmounts = isLowBalance
    ? [...new Set([requiredRecharge, 1000, 2000, 3000])].filter(Boolean).sort((a, b) => a - b).slice(0, 3)
    : [500, 1000, 2000]

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6 overflow-x-visible">
        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Subscription Center
          </h1>
          <Button
            variant="outline"
            className="border-[#ff8100] text-[#ff8100] hidden md:flex"
            onClick={() => navigate('/food/restaurant/business-plan')}
          >
            Manage Plans
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Subscription Credits Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 rounded-2xl p-6 shadow-lg border-l-8 border-blue-500"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-500/10 p-3 rounded-xl">
                <Wallet className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Subscription Wallet</span>
                <div className="flex items-center gap-1 mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${wallet?.subscriptionBalance >= 1000 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-[10px] text-slate-400 font-medium">
                    {wallet?.subscriptionBalance >= 1000 ? 'Healthy Balance' : 'Low Balance'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-slate-400 text-sm mb-1">Available Credits</p>
              <h2 className="text-4xl font-black text-white">{formatCurrency(wallet?.subscriptionBalance || 0)}</h2>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-xl shadow-lg shadow-blue-900/20"
                onClick={() => {
                  if (isLowBalance) setRechargeAmount(requiredRecharge.toString())
                  setShowRechargeModal(true)
                }}
              >
                Recharge Credits
              </Button>
            </div>

            <p className="text-[10px] text-slate-500 mt-4 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Credits are strictly non-withdrawable and used for platform fees.
            </p>
          </motion.div>

          {/* Active Subscription Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-l-8 border-red-500"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-red-500/10 p-3 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Plan Status</span>
            </div>

            <div className="space-y-4">
              {/* Daily Pass Row */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${activePass ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Daily Pass</p>
                    <p className="text-[10px] text-gray-500">Active until midnight IST</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase ${activePass ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                    {activePass ? 'Active' : 'Expired'}
                  </span>
                  {activePass && (
                    <p className="text-[9px] text-gray-400 mt-1 font-mono">
                      Exp: {dayjs(activePass.expiresAt).format('HH:mm')}
                    </p>
                  )}
                </div>
              </div>

              {/* Recurring Plan Row */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${subStatus === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'}`}>
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Recurring Plan</p>
                    <p className="text-[10px] text-gray-500">
                      {subPlan ? `Plan: ${subPlan.name || 'Business'}` : 'No active recurring plan'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase ${subStatus === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                    {subStatus === 'active' ? 'Active' : 'None'}
                  </span>
                  {subscription?.expiryDate && (
                    <p className="text-[9px] text-gray-400 mt-1 font-mono">
                      Exp: {dayjs(subscription.expiryDate).format('DD MMM')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Subscription Ledger Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-md mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Wallet Activity (Credits)</h2>
            <SlidersHorizontal className="w-5 h-5 text-gray-400" />
          </div>

          <div className="space-y-4">
            {ledger.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">No recent transactions found</p>
              </div>
            ) : (
              ledger.map((tx, index) => (
                <div
                  key={tx.id || index}
                  className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${tx.type === 'TOPUP' ? 'bg-green-50 text-green-600' :
                        tx.type === 'DAILY_DEDUCTION' ? 'bg-red-50 text-red-600' :
                          'bg-blue-50 text-blue-600'
                      }`}>
                      {tx.type === 'TOPUP' ? <TrendingUp className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{tx.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-500">{dayjs(tx.createdAt).format('DD MMM YYYY, HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${['TOPUP', 'REFERRAL_REWARD'].includes(tx.type) ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {['TOPUP', 'REFERRAL_REWARD'].includes(tx.type) ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[10px] text-gray-400">Bal: {formatCurrency(tx.afterBalance)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Upgrade Shortcut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between cursor-pointer"
          onClick={() => navigate('/food/restaurant/business-plan')}
        >
          <div>
            <h3 className="text-xl font-black mb-1">Upgrade Your Business Plan</h3>
            <p className="text-white/80 text-sm">Save more on daily passes with Monthly/Weekly plans</p>
          </div>
          <ArrowRight className="w-8 h-8 opacity-50" />
        </motion.div>
      </div>

      {/* Recharge Modal */}
      <AnimatePresence>
        {showRechargeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowRechargeModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-gray-900">Recharge Credits</h2>
                  <button onClick={() => setShowRechargeModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {/* Low Balance Warning Card */}
                {isLowBalance && (
                  <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-bold text-red-800">Low Balance</span>
                    </div>
                    <p className="text-xs text-red-600 mb-2">
                      Minimum ₹1000 required to stay active
                    </p>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-500">Current: {formatCurrency(currentBalance)}</span>
                      <span className="text-red-800 font-bold">Required: {formatCurrency(requiredRecharge)}</span>
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Recharge Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                    <Input
                      type="number"
                      value={rechargeAmount}
                      onChange={(e) => setRechargeAmount(e.target.value)}
                      className="pl-8 h-14 text-xl font-black border-2 border-gray-100 focus:border-blue-600 rounded-2xl"
                      placeholder={isLowBalance ? `Min ₹${requiredRecharge}` : "Min ₹100"}
                    />
                  </div>
                  {isLowBalance && rechargeAmount && parseFloat(rechargeAmount) < requiredRecharge && (
                    <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Minimum recharge required is ₹{requiredRecharge}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-8">
                  {quickAmounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setRechargeAmount(amt.toString())}
                      className="py-3 rounded-xl text-sm font-bold border-2 border-gray-100 hover:border-blue-600 hover:text-blue-600 transition-all"
                    >
                      ₹{amt}
                    </button>
                  ))}
                </div>

                <Button
                  disabled={submittingRecharge || (isLowBalance && parseFloat(rechargeAmount) < requiredRecharge)}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl disabled:opacity-50"
                  onClick={handleRecharge}
                >
                  {submittingRecharge ? <Loader2 className="animate-spin mr-2" /> : 'Proceed to Payment'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}
