import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { AnimatePresence, motion } from "framer-motion"
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
  Gift,
  Ban,
  CalendarX2,
} from "lucide-react"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

const isCouponExpired = (coupon) => {
  const endRaw = coupon?.endDate || coupon?.expiryDate
  if (!endRaw) return false
  const expiry = new Date(endRaw)
  if (Number.isNaN(expiry.getTime())) return false
  const endOfDay = new Date(expiry)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay.getTime() < Date.now()
}

const defaultFormData = {
  couponCode: "",
  discountType: "percentage",
  discountValue: "",
  customerScope: "all",
  minOrderValue: "",
  maxDiscount: "",
  startDate: "",
  endDate: "",
  usageLimit: "",
  perUserLimit: "",
  description: "",
}

const statusBadgeClass = (status) => {
  const value = String(status || "Pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

export default function CreateCouponsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const todayYMD = (() => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${m}-${day}`
  })()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const preservePastStartOnEdit = Boolean(
    editingCoupon?.startDate &&
    formData.startDate &&
    formData.startDate === new Date(editingCoupon.startDate).toISOString().split("T")[0] &&
    formData.startDate < todayYMD,
  )

  useEffect(() => {
    fetchCoupons()
  }, [])

  const fetchCoupons = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getCoupons()
      const list = response?.data?.data || []
      setCoupons(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load coupons")
      setCoupons([])
    } finally {
      setLoading(false)
    }
  }

  const couponStats = useMemo(() => {
    const list = Array.isArray(coupons) ? coupons : []
    return list.reduce(
      (acc, coupon) => {
        acc.total += 1
        const status = String(coupon?.status || "Pending").toLowerCase()
        if (isCouponExpired(coupon)) acc.expired += 1
        if (status === "approved") acc.approved += 1
        else if (status === "rejected") acc.rejected += 1
        else acc.pending += 1
        return acc
      },
      { total: 0, pending: 0, approved: 0, rejected: 0, expired: 0 },
    )
  }, [coupons])

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
    const endRaw = coupon?.endDate || coupon?.expiryDate
    setFormData({
      couponCode: coupon?.couponCode || "",
      discountType: coupon?.discountType === "fixed" ? "flat-price" : (coupon?.discountType || "percentage"),
      discountValue: coupon?.discountValue || "",
      customerScope: coupon?.customerScope || "all",
      minOrderValue: coupon?.minOrderValue ?? coupon?.minOrderAmount ?? "",
      maxDiscount: coupon?.maxDiscount ?? "",
      startDate: coupon?.startDate ? new Date(coupon.startDate).toISOString().split("T")[0] : "",
      endDate: endRaw ? new Date(endRaw).toISOString().split("T")[0] : "",
      usageLimit: coupon?.usageLimit || "",
      perUserLimit: coupon?.perUserLimit || "",
      description: coupon?.description || "",
    })
    setShowModal(true)
  }

  const handleSaveCoupon = async () => {
    if (!formData.couponCode.trim()) {
      toast.error("Coupon code is required")
      return
    }
    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      toast.error("Discount value must be greater than 0")
      return
    }
    if (formData.discountType === "percentage" && (!formData.maxDiscount || Number(formData.maxDiscount) <= 0)) {
      toast.error("Max discount is required for percentage coupons")
      return
    }
    if (!formData.endDate) {
      toast.error("End date is required")
      return
    }
    if (formData.startDate && formData.startDate < todayYMD && !preservePastStartOnEdit) {
      toast.error("Start date cannot be in the past")
      return
    }
    if (formData.endDate < todayYMD) {
      toast.error("End date cannot be in the past")
      return
    }

    try {
      const payload = {
        couponCode: formData.couponCode.trim().toUpperCase(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        customerScope: formData.customerScope,
        minOrderValue: Number(formData.minOrderValue) || 0,
        maxDiscount: formData.discountType === "percentage" ? Number(formData.maxDiscount) : null,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: new Date(formData.endDate).toISOString(),
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        perUserLimit: formData.perUserLimit ? Number(formData.perUserLimit) : null,
        description: formData.description.trim(),
      }

      if (editingCoupon) {
        await restaurantAPI.updateCoupon(editingCoupon._id || editingCoupon.id, payload)
        toast.success("Coupon request updated and sent for admin approval")
      } else {
        await restaurantAPI.createCoupon(payload)
        toast.success("Coupon request submitted and pending admin approval")
      }

      resetModal()
      fetchCoupons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save coupon")
    }
  }

  const handleDeleteCoupon = async (coupon) => {
    if (!window.confirm(`Are you sure you want to delete coupon "${coupon.couponCode}"?`)) return

    try {
      await restaurantAPI.deleteCoupon(coupon._id || coupon.id)
      toast.success("Coupon deleted successfully")
      fetchCoupons()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete coupon")
    }
  }

  const couponModalHeader = (
    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900 lg:text-xl">
          {editingCoupon ? "Edit Coupon" : "Create Coupon"}
        </h2>
        <p className="text-xs text-slate-500 lg:text-sm">
          Configure your promo campaign. Resubmitting will reset status to pending.
        </p>
      </div>
      <button onClick={resetModal} className="p-1 hover:bg-slate-100 rounded-full">
        <X className="h-5 w-5 text-slate-600" />
      </button>
    </div>
  )

  const couponFormFields = (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Coupon Code</label>
        <input
          type="text"
          value={formData.couponCode}
          onChange={(e) => setFormData((prev) => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
          placeholder="E.g. GET50, FESTIVE100"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10 font-bold tracking-wider"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Discount Type</label>
          <select
            value={formData.discountType}
            onChange={(e) => setFormData((prev) => ({ ...prev, discountType: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          >
            <option value="percentage">Percentage (%)</option>
            <option value="flat-price">Fixed Flat (₹)</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Discount Value</label>
          <input
            type="number"
            value={formData.discountValue}
            onChange={(e) => setFormData((prev) => ({ ...prev, discountValue: e.target.value }))}
            placeholder={formData.discountType === "percentage" ? "10 for 10%" : "50 for ₹50"}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Customer Eligibility</label>
        <select
          value={formData.customerScope}
          onChange={(e) => setFormData((prev) => ({ ...prev, customerScope: e.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
        >
          <option value="all">All Users</option>
          <option value="first-time">First-time Users Only</option>
        </select>
      </div>

      {formData.discountType === "percentage" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Max Discount (₹)</label>
          <input
            type="number"
            value={formData.maxDiscount}
            onChange={(e) => setFormData((prev) => ({ ...prev, maxDiscount: e.target.value }))}
            placeholder="E.g. 100"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Min. Order Value (₹)</label>
          <input
            type="number"
            value={formData.minOrderValue}
            onChange={(e) => setFormData((prev) => ({ ...prev, minOrderValue: e.target.value }))}
            placeholder="E.g. 199"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Total Usage Limit</label>
          <input
            type="number"
            value={formData.usageLimit}
            onChange={(e) => setFormData((prev) => ({ ...prev, usageLimit: e.target.value }))}
            placeholder="Optional"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Per User Limit</label>
          <input
            type="number"
            value={formData.perUserLimit}
            onChange={(e) => setFormData((prev) => ({ ...prev, perUserLimit: e.target.value }))}
            placeholder="Optional"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Start Date (Optional)</label>
          <input
            type="date"
            value={formData.startDate}
            min={preservePastStartOnEdit ? undefined : todayYMD}
            onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
        <input
          type="date"
          value={formData.endDate}
          min={formData.startDate && formData.startDate >= todayYMD ? formData.startDate : todayYMD}
          onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Enter details like 'Get flat 10% off up to ₹100'"
          rows={3}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/10"
        />
      </div>
    </div>
  )

  const couponFormActions = (
    <div className="mt-6 flex gap-3">
      <button onClick={resetModal} className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        Cancel
      </button>
      <button
        onClick={handleSaveCoupon}
        className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 py-3 font-semibold text-white shadow-lg shadow-red-600/10 transition-colors"
      >
        {editingCoupon ? "Save Changes" : "Submit Coupon"}
      </button>
    </div>
  )

  return (
    <div className="min-h-full bg-slate-50 pb-24 lg:pb-8">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3 lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-5">
          <button onClick={goBack} className="rounded-full p-1 hover:bg-slate-100 lg:hidden">
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex-1 lg:flex lg:items-center lg:justify-between lg:gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Create Coupons</h1>
              <p className="text-xs text-slate-500 lg:text-sm lg:mt-1">Submit coupon campaigns for admin review & approval.</p>
            </div>
            <button
              onClick={openCreateModal}
              className="hidden lg:flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              Create Coupon
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-6 lg:space-y-6">
        {/* Offer summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: "Total Offers",
              value: couponStats.total,
              icon: Gift,
              className: "border-slate-200 bg-white text-slate-900",
              iconClassName: "bg-slate-100 text-slate-700",
            },
            {
              label: "Pending",
              value: couponStats.pending,
              icon: Clock3,
              className: "border-amber-200 bg-amber-50 text-amber-900",
              iconClassName: "bg-amber-100 text-amber-700",
            },
            {
              label: "Approved",
              value: couponStats.approved,
              icon: BadgeCheck,
              className: "border-emerald-200 bg-emerald-50 text-emerald-900",
              iconClassName: "bg-emerald-100 text-emerald-700",
            },
            {
              label: "Rejected",
              value: couponStats.rejected,
              icon: Ban,
              className: "border-rose-200 bg-rose-50 text-rose-900",
              iconClassName: "bg-rose-100 text-rose-700",
            },
            {
              label: "Expired",
              value: couponStats.expired,
              icon: CalendarX2,
              className: "border-slate-300 bg-slate-100 text-slate-800 col-span-2 sm:col-span-1",
              iconClassName: "bg-slate-200 text-slate-700",
            },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className={`rounded-2xl border p-3 shadow-sm lg:p-4 ${stat.className}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums lg:text-3xl">
                      {loading ? "—" : stat.value}
                    </p>
                  </div>
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${stat.iconClassName}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-900 font-sans">Campaign Approval System</p>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed font-sans">
                Every coupon requested remains pending until approved by the admin. Once approved, the coupon becomes active and users can apply it to orders from your outlet. Editing a coupon resets its status to pending.
              </p>
            </div>
          </div>
        </div>

        {/* Create Button - mobile only */}
        <button
          onClick={openCreateModal}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 font-semibold text-white shadow-lg shadow-red-600/10 transition-colors lg:hidden"
        >
          <Plus className="h-5 w-5" />
          Create Coupon
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12 lg:py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm lg:py-16">
            <p className="text-lg font-semibold text-slate-900">No coupons yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Create a custom campaign code and increase your orders.
            </p>
          </div>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {coupons.map((coupon) => {
              const status = coupon?.status || "Pending"
              const expired = isCouponExpired(coupon)
              const expiryFormatted = (coupon?.endDate || coupon?.expiryDate)
                ? new Date(coupon.endDate || coupon.expiryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'N/A'
              const customerLabel = coupon?.customerScope === 'first-time' ? 'First-time users' : 'All users'

              return (
                <motion.div
                  key={coupon._id || coupon.id}
                  layout
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm relative overflow-hidden lg:p-5"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                          {coupon.couponCode}
                        </span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeClass(status)}`}>
                          {status === "Approved" ? <BadgeCheck className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                          {status}
                        </span>
                        {expired && (
                          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                            <CalendarX2 className="mr-1 h-3.5 w-3.5" />
                            Expired
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-semibold text-slate-700">
                          Value: {coupon.discountType === "percentage" ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} FLAT OFF`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Customers: {customerLabel}
                        </p>
                        <p className="text-xs text-slate-500">
                          Min. Order Value: ₹{coupon.minOrderValue ?? coupon.minOrderAmount ?? 0}
                        </p>
                        {coupon.perUserLimit ? (
                          <p className="text-xs text-slate-500">
                            Per user limit: {coupon.perUserLimit}
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          Expires: {expiryFormatted}
                        </p>
                        {coupon.usageLimit && (
                          <p className="text-xs text-slate-500">
                            Limit: {coupon.usedCount || 0} / {coupon.usageLimit} uses
                          </p>
                        )}
                        {coupon.description && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100 italic">
                            "{coupon.description}"
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
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetModal}
              className="fixed inset-0 z-50 bg-black/50"
            />
            {/* Mobile bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[95vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl pb-10 lg:hidden"
            >
              {couponModalHeader}
              {couponFormFields}
              {couponFormActions}
            </motion.div>
            {/* Desktop centered dialog */}
            <div className="fixed inset-0 z-50 hidden lg:flex items-center justify-center p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {couponModalHeader}
                {couponFormFields}
                {couponFormActions}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
