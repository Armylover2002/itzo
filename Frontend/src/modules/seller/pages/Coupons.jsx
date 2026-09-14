import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AnimatePresence, motion } from "framer-motion"
import confetti from "canvas-confetti"
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  X,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  PartyPopper,
} from "lucide-react"
import { sellerApi } from "../services/sellerApi"
import { toast } from "sonner"
import {
  buildQuickCouponPayload,
  toLocalDateInputValue,
  validateQuickCouponForm,
} from "../../quickCommerce/shared/quickCouponForm"

const defaultFormData = {
  code: "",
  couponType: "generic",
  discountType: "percentage",
  discountValue: "",
  minOrderValue: "",
  maxDiscount: "",
  validFrom: "",
  validTill: "",
  usageLimit: "",
  perUserLimit: "1",
  firstOrderOnly: false,
  description: "",
}

const statusBadgeClass = (status) => {
  const value = String(status || "Pending").toLowerCase()
  if (value === "inactive") return "bg-slate-50 text-slate-700 border-slate-200"
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

const triggerCrackerExplosion = () => {
  // Center cracker explosion
  confetti({
    particleCount: 90,
    spread: 90,
    origin: { y: 0.55 },
    colors: ['#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'],
    zIndex: 99999,
  });

  // Left cracker cannon
  confetti({
    particleCount: 60,
    angle: 60,
    spread: 65,
    origin: { x: 0.05, y: 0.65 },
    colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'],
    zIndex: 99999,
  });

  // Right cracker cannon
  confetti({
    particleCount: 60,
    angle: 120,
    spread: 65,
    origin: { x: 0.95, y: 0.65 },
    colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6'],
    zIndex: 99999,
  });

  // Second delayed fireworks burst
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 100,
      origin: { y: 0.45 },
      colors: ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6'],
      zIndex: 99999,
    });
  }, 250);
};

export default function Coupons() {
  const navigate = useNavigate()
  const goBack = () => navigate(-1)
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)

  // Success Celebration Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successCouponCode, setSuccessCouponCode] = useState("")

  useEffect(() => {
    fetchCoupons()
  }, [])

  useEffect(() => {
    if (showSuccessModal) {
      triggerCrackerExplosion()
    }
  }, [showSuccessModal])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await sellerApi.getCoupons()
      const list = response?.data?.data || response?.data?.result || []
      setCoupons(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load coupons")
      setCoupons([])
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setShowModal(false)
    setEditingCoupon(null)
    setFormData(defaultFormData)
  }

  const openCreateModal = () => {
    setEditingCoupon(null)
    setFormData(defaultFormData)
    setShowModal(true)
  }

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon)
    setFormData({
      code: coupon?.code || "",
      couponType: coupon?.couponType || "generic",
      discountType: coupon?.discountType || "percentage",
      discountValue: coupon?.discountValue ?? "",
      minOrderValue: coupon?.minOrderValue ?? "",
      maxDiscount: coupon?.maxDiscount ?? "",
      validFrom: toLocalDateInputValue(coupon?.validFrom),
      validTill: toLocalDateInputValue(coupon?.validTill),
      usageLimit: coupon?.usageLimit ?? "",
      perUserLimit: coupon?.perUserLimit ?? "1",
      firstOrderOnly: Boolean(coupon?.firstOrderOnly),
      description: coupon?.description || "",
    })
    setShowModal(true)
  }

  const handleSaveCoupon = async () => {
    const errorMessage = validateQuickCouponForm(formData)
    if (errorMessage) {
      toast.error(errorMessage)
      return
    }

    const createdCode = formData.code.trim().toUpperCase()

    try {
      const payload = {
        ...buildQuickCouponPayload(formData),
        couponType: formData.couponType || "generic",
        validFrom: new Date(formData.validFrom).toISOString(),
        validTill: new Date(formData.validTill).toISOString(),
      }

      if (editingCoupon) {
        await sellerApi.updateCoupon(editingCoupon._id || editingCoupon.id, payload)
        toast.success("Coupon request updated and sent for admin approval")
        resetModal()
      } else {
        await sellerApi.createCoupon(payload)
        resetModal()
        // Trigger celebratory popup animation
        setSuccessCouponCode(createdCode)
        setShowSuccessModal(true)
      }

      fetchCoupons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save coupon")
    }
  }

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.code}"?`)) return

    try {
      const response = await sellerApi.deleteCoupon(coupon._id || coupon.id)
      const deactivated = response?.data?.data?.deactivated || response?.data?.result?.deactivated
      toast.success(deactivated ? "Coupon deactivated successfully" : "Coupon deleted successfully")
      fetchCoupons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete coupon")
    }
  }

  return (
    <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight">
            Manage Coupons
          </h1>
          <p className="text-xs font-normal text-slate-500 mt-0.5">
            Configure promo codes and discounts for Quick Commerce customers.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer">
          <Plus className="h-3.5 w-3.5" />
          <span>Create Coupon</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Campaign Review Queue</p>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Coupon codes submitted here will be sent to the admin for review. Once approved, they stay live for users — editing an approved coupon no longer resets it to pending.
            </p>
          </div>
        </div>
      </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">No coupons created yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Launch your first campaign to boost sales and attract local customers!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((coupon) => {
              const status = !coupon?.isActive ? "Inactive" : (coupon?.status || "Pending")
              const validFromFormatted = coupon?.validFrom ? new Date(coupon.validFrom).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "N/A"
              const validTillFormatted = coupon?.validTill ? new Date(coupon.validTill).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "N/A"

              return (
                <motion.div
                  key={coupon._id || coupon.id}
                  layout
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm relative overflow-hidden"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          {coupon.code}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(status)}`}>
                          {status === "Approved" ? <BadgeCheck className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                          {status}
                        </span>
                        {coupon.firstOrderOnly && (
                          <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                            First order only
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-semibold text-slate-700">
                          Discount: {coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : coupon.discountType === "free_delivery" ? "Free Delivery" : `₹${coupon.discountValue} FLAT OFF`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Min. Order: ₹{coupon.minOrderValue || 0} {coupon.maxDiscount ? `| Max Discount: ₹${coupon.maxDiscount}` : ""}
                        </p>
                        <p className="text-xs text-slate-500">
                          Validity: {validFromFormatted} - {validTillFormatted}
                        </p>
                        <p className="text-xs text-slate-500">
                          Used: {coupon.usedCount || 0}
                          {coupon.usageLimit ? ` / ${coupon.usageLimit} total` : " (unlimited)"}
                          {" · "}Max {coupon.perUserLimit || 1} per user
                        </p>
                        {coupon.description && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100 italic">
                            &quot;{coupon.description}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(coupon)}
                        className="rounded-lg bg-red-50 p-2 text-red-700 hover:bg-red-100 transition-colors border border-red-200"
                        title="Edit Coupon"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCoupon(coupon)}
                        className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors border border-rose-200"
                        title="Delete Coupon"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}


      {/* Form Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetModal}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg rounded-2xl bg-white p-4 sm:p-5 shadow-2xl border border-slate-200 space-y-3.5 my-auto"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm sm:text-base font-semibold text-[#1c1c1e]">
                      {editingCoupon ? "Edit Coupon Details" : "Create New Coupon"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Submitted coupons are sent to admin for review.
                    </p>
                  </div>
                  <button onClick={resetModal} className="p-1 text-slate-400 hover:text-slate-700 rounded-md">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Coupon Code</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="E.g. SUMMER50, WELCOME20"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-semibold text-slate-900 uppercase tracking-wider outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Discount Type</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, discountType: e.target.value }))}
                      className="w-full truncate rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Flat (₹)</option>
                      <option value="free_delivery">Free Delivery</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Strategy</label>
                    <select
                      value={formData.couponType}
                      onChange={(e) => setFormData((prev) => ({ ...prev, couponType: e.target.value }))}
                      className="w-full truncate rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    >
                      <option value="generic">Generic</option>
                      <option value="min_order_value">Min Order</option>
                      <option value="free_delivery">Free Delivery</option>
                    </select>
                  </div>

                  {formData.discountType !== "free_delivery" && (
                    <div>
                      <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Discount Value</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.discountValue}
                        onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
                        placeholder={formData.discountType === "percentage" ? "15 for 15%" : "100"}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Min Order (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minOrderValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, minOrderValue: e.target.value }))}
                      placeholder="E.g. 299"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Max Discount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maxDiscount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, maxDiscount: e.target.value }))}
                      placeholder="E.g. 150"
                      disabled={formData.discountType === "fixed" || formData.discountType === "free_delivery"}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Total Usage Limit</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.usageLimit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))}
                      placeholder="E.g. 50 (optional)"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Per User Limit</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={formData.perUserLimit}
                      onChange={(e) => setFormData((prev) => ({ ...prev, perUserLimit: e.target.value }))}
                      placeholder="E.g. 1"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Valid From</label>
                    <input
                      type="date"
                      value={formData.validFrom}
                      onChange={(e) => setFormData((prev) => ({ ...prev, validFrom: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Valid Till</label>
                    <input
                      type="date"
                      value={formData.validTill}
                      min={formData.validFrom || undefined}
                      onChange={(e) => setFormData((prev) => ({ ...prev, validTill: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="E.g. Get 15% off on your favorite products up to ₹150"
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 transition-all"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 -mt-2">Same start and end date is allowed.</p>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.firstOrderOnly)}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstOrderOnly: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                  />
                  <span className="text-sm font-medium text-slate-700">First order only</span>
                </label>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button onClick={resetModal} className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCoupon}
                    className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white shadow-xs transition-colors"
                  >
                    {editingCoupon ? "Save Changes" : "Submit Coupon"}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Celebratory Congratulations Success Animation Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSuccessModal(false)}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs"
            />
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 text-center space-y-4 relative overflow-hidden"
              >
                {/* Decorative Background Glow */}
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-100 rounded-full blur-2xl opacity-60" />
                <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-100 rounded-full blur-2xl opacity-60" />

                {/* Animated 3D Realistic Celebration Icon Badge */}
                <motion.div 
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
                  className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-amber-100 via-rose-100 to-emerald-100 flex items-center justify-center border-4 border-white shadow-[0_12px_30px_rgba(245,158,11,0.35)] relative"
                >
                  <span className="text-4xl select-none animate-bounce drop-shadow-md">🎉</span>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white shadow-xs">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </motion.div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
                    Congratulations! 🎉
                  </h3>
                  <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                    Your new promotional coupon code has been created successfully!
                  </p>
                </div>

                {/* Coupon Code Pill */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 inline-block w-full">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">Coupon Code</span>
                  <span className="text-lg font-extrabold text-slate-900 font-mono tracking-widest text-red-600">
                    {successCouponCode}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 justify-center text-[11px] text-emerald-700 bg-emerald-50/80 border border-emerald-200/60 p-2 rounded-lg">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>Submitted and pending admin approval.</span>
                </div>

                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-all cursor-pointer">
                  Great, Got It!
                </button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
