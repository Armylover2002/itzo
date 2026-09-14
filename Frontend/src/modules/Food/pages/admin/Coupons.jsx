import { useState, useEffect, useMemo, useCallback } from "react"
import { Search } from "lucide-react"
import { adminAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const formatLimit = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? String(num) : "∞"
}

const formatUsage = (used, limit) => `${Number(used || 0)} / ${formatLimit(limit)}`

const formatCurrency = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? `₹${num}` : "—"
}

const formatDateCell = (value) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const dd = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleString("en-US", { month: "short" })
  return `${dd} ${month} ${d.getFullYear()}`
}

const formatDiscount = (offer) => {
  if (offer.discountType === "flat-price") {
    return `₹${Number(offer.discountValue || offer.originalPrice || 0)} OFF`
  }
  const pct = Number(offer.discountPercentage ?? offer.discountValue ?? 0)
  const maxCap = Number(offer.maxDiscount)
  return `${pct}% OFF${Number.isFinite(maxCap) && maxCap > 0 ? ` (max ₹${maxCap})` : ""}`
}


export default function Coupons() {
  const [searchQuery, setSearchQuery] = useState("")
  const [offers, setOffers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [updatingCartVisibility, setUpdatingCartVisibility] = useState({})
  const [deletingOffer, setDeletingOffer] = useState({})
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [editingOfferId, setEditingOfferId] = useState(null)
  const [errors, setErrors] = useState({})
  const [formData, setFormData] = useState({
    couponCode: "",
    discountType: "percentage",
    discountValue: "",
    customerScope: "all",
    restaurantScope: "all",
    restaurantId: "",
    endDate: "",
    startDate: "",
    minOrderValue: "",
    maxDiscount: "",
    usageLimit: "",
    perUserLimit: "",
    isFirstOrderOnly: false,
  })

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getAllOffers({})

      if (response?.data?.success) {
        setOffers(response.data.data.offers || [])
      } else {
        setError("Failed to fetch offers")
      }
    } catch (err) {
      debugError("Error fetching offers:", err)
      setError(err?.response?.data?.message || "Failed to fetch offers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await adminAPI.getRestaurants({ page: 1, limit: 200 })
        if (response?.data?.success) {
          const list = response?.data?.data?.restaurants || []
          // Backend returns `restaurantName`; normalize to `name` for this dropdown without affecting other pages.
          const normalized = Array.isArray(list)
            ? list.map((r) => ({
              ...r,
              name: r?.name || r?.restaurantName || "",
            }))
            : []
          setRestaurants(normalized)
        }
      } catch (err) {
        debugError("Error fetching restaurants:", err)
      }
    }

    fetchRestaurants()
  }, [])

  const todayYMD = () => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${m}-${day}`
  }

  const validateForm = (draft) => {
    const e = {}
    const f = draft || formData
    const pct = f.discountType === "percentage"
    const value = Number(f.discountValue)
    if (!String(f.couponCode || "").trim()) e.couponCode = "Coupon code is required"
    if (!Number.isFinite(value) || value <= 0) e.discountValue = "Discount must be greater than 0"
    if (pct && (f.maxDiscount === "" || f.maxDiscount === null || f.maxDiscount === undefined)) {
      e.maxDiscount = "Max discount is required for percentage coupons"
    }
    if (f.minOrderValue !== "" && Number(f.minOrderValue) < 0) e.minOrderValue = "Min order cannot be negative"
    if (f.usageLimit !== "" && Number(f.usageLimit) < 1) e.usageLimit = "Usage limit must be at least 1"
    if (f.perUserLimit !== "" && Number(f.perUserLimit) < 1) e.perUserLimit = "Per user limit must be at least 1"
    const start = f.startDate ? new Date(`${f.startDate}T00:00:00`) : null
    const end = f.endDate ? new Date(`${f.endDate}T00:00:00`) : null
    const now = new Date()
    if (end && end < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      e.endDate = "End date cannot be in the past"
    }
    if (start && end && start > end) {
      e.startDate = "Start date must be before end date"
      e.endDate = "End date must be after start date"
    }
    setErrors(e)
    return { valid: Object.keys(e).length === 0, e }
  }

  const handleFormChange = (field, rawValue) => {
    let value = rawValue
    if (field === "couponCode") {
      value = String(value || "").toUpperCase()
    }
    if (field === "discountType") {
      // When switching to flat-price, clear and disable maxDiscount
      if (value === "flat-price") {
        setFormData((prev) => {
          const next = { ...prev, discountType: value, maxDiscount: "" }
          validateForm(next)
          return next
        })
        if (submitError) setSubmitError("")
        if (submitSuccess) setSubmitSuccess("")
        return
      }
    }
    const next = { ...formData, [field]: value }
    // Date constraints
    if (field === "startDate" && next.endDate) {
      // Ensure startDate <= endDate
      const s = next.startDate ? new Date(`${next.startDate}T00:00:00`) : null
      const e = new Date(`${next.endDate}T00:00:00`)
      if (s && s > e) {
        // keep but will show error
      }
    }
    if (field === "endDate" && next.startDate) {
      const s = new Date(`${next.startDate}T00:00:00`)
      const e = next.endDate ? new Date(`${next.endDate}T00:00:00`) : null
      if (e && e < s) {
        // keep but will show error
      }
    }
    setFormData(next)
    validateForm(next)
    if (submitError) {
      setSubmitError("")
    }
    if (submitSuccess) {
      setSubmitSuccess("")
    }
  }

  const resetForm = () => {
    setEditingOfferId(null)
    setFormData({
      couponCode: "",
      discountType: "percentage",
      discountValue: "",
      customerScope: "all",
      restaurantScope: "all",
      restaurantId: "",
      endDate: "",
      startDate: "",
      minOrderValue: "",
      maxDiscount: "",
      usageLimit: "",
      perUserLimit: "",
      isFirstOrderOnly: false,
    })
    setErrors({})
  }

  const toYMD = (value) => {
    if (!value) return ""
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${m}-${day}`
  }

  const handleStartEditOffer = (offer) => {
    setEditingOfferId(offer.offerId)
    setFormData({
      couponCode: offer.couponCode || "",
      discountType: offer.discountType || "percentage",
      discountValue: offer.discountValue != null ? String(offer.discountValue) : "",
      customerScope: offer.customerScope || "all",
      restaurantScope: offer.restaurantScope || "all",
      restaurantId: offer.restaurantScope === "selected" ? String(offer.restaurantDbId || offer.restaurantId || "") : "",
      endDate: toYMD(offer.endDate),
      startDate: toYMD(offer.startDate),
      minOrderValue: offer.minOrderValue != null && offer.minOrderValue !== 0 ? String(offer.minOrderValue) : "",
      maxDiscount: offer.maxDiscount != null ? String(offer.maxDiscount) : "",
      usageLimit: offer.usageLimit != null ? String(offer.usageLimit) : "",
      perUserLimit: offer.perUserLimit != null ? String(offer.perUserLimit) : "",
      isFirstOrderOnly: Boolean(offer.isFirstOrderOnly),
    })
    setErrors({})
    setSubmitError("")
    setSubmitSuccess("")
    setIsAddOpen(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleCreateCoupon = async (e) => {
    e.preventDefault()
    setSubmitError("")
    setSubmitSuccess("")
    const { valid } = validateForm()
    if (!valid) {
      setSubmitError("Please fix the highlighted errors")
      return
    }

    if (!formData.couponCode.trim()) {
      setSubmitError("Coupon code is required")
      return
    }

    const parsedDiscountValue = Number(formData.discountValue)
    if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      setSubmitError("Discount value must be greater than 0")
      return
    }

    if (formData.restaurantScope === "selected" && !formData.restaurantId) {
      setSubmitError("Please select a restaurant")
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        couponCode: formData.couponCode.trim(),
        discountType: formData.discountType,
        discountValue: parsedDiscountValue,
        customerScope: formData.customerScope,
        restaurantScope: formData.restaurantScope,
        restaurantId: formData.restaurantScope === "selected" ? formData.restaurantId : undefined,
        endDate: formData.endDate || undefined,
        startDate: formData.startDate || undefined,
        minOrderValue: formData.minOrderValue !== "" ? Number(formData.minOrderValue) : undefined,
        maxDiscount: formData.discountType === "percentage" && formData.maxDiscount !== "" ? Number(formData.maxDiscount) : undefined,
        usageLimit: formData.usageLimit !== "" ? Number(formData.usageLimit) : undefined,
        perUserLimit: formData.perUserLimit !== "" ? Number(formData.perUserLimit) : undefined,
        isFirstOrderOnly: Boolean(formData.isFirstOrderOnly),
      }
      if (editingOfferId) {
        await adminAPI.updateAdminOffer(editingOfferId, payload)
        setSubmitSuccess("Coupon updated successfully")
      } else {
        await adminAPI.createAdminOffer(payload)
        setSubmitSuccess("Coupon created successfully")
      }
      resetForm()
      await fetchOffers()
    } catch (err) {
      debugError("Error saving coupon:", err)
      setSubmitError(err?.response?.data?.message || (editingOfferId ? "Failed to update coupon" : "Failed to create coupon"))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleOfferStatus = async (offer) => {
    const offerId = offer.offerId
    if (!offerId || updatingStatus[offerId]) return
    // 'scheduled' is derived from a stored 'active' status
    const isPaused = offer.status === "paused"
    const nextStatus = isPaused ? "active" : "paused"
    try {
      setUpdatingStatus((prev) => ({ ...prev, [offerId]: true }))
      await adminAPI.updateAdminOfferStatus(offerId, nextStatus)
      await fetchOffers()
    } catch (err) {
      debugError("Error updating offer status:", err)
      setError(err?.response?.data?.message || "Failed to update offer status")
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [offerId]: false }))
    }
  }

  const handleToggleShowInCart = async (offerId, itemId, currentValue) => {
    const key = `${offerId}-${itemId}`
    try {
      setUpdatingCartVisibility((prev) => ({ ...prev, [key]: true }))
      const nextValue = !currentValue
      await adminAPI.updateAdminOfferCartVisibility(offerId, itemId, nextValue)
      setOffers((prev) =>
        prev.map((offer) =>
          offer.offerId === offerId && offer.dishId === itemId
            ? { ...offer, showInCart: nextValue }
            : offer,
        ),
      )
    } catch (err) {
      debugError("Error updating cart visibility:", err)
    } finally {
      setUpdatingCartVisibility((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleDeleteOffer = async (offerId) => {
    if (!offerId) return
    if (deletingOffer[offerId]) return
    try {
      setDeletingOffer((prev) => ({ ...prev, [offerId]: true }))
      await adminAPI.deleteAdminOffer(offerId)
      setOffers((prev) => prev.filter((o) => o.offerId !== offerId))
    } catch (err) {
      debugError("Error deleting offer:", err)
    } finally {
      setDeletingOffer((prev) => ({ ...prev, [offerId]: false }))
    }
  }

  // Filter offers based on search query
  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) {
      return offers
    }
    
    const query = searchQuery.toLowerCase().trim()
    return offers.filter(offer =>
      offer.restaurantName?.toLowerCase().includes(query) ||
      offer.dishName?.toLowerCase().includes(query) ||
      offer.couponCode?.toLowerCase().includes(query)
    )
  }, [offers, searchQuery])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Restaurant Offers & Coupons</h1>
            <button
              type="button"
              onClick={() => {
                if (isAddOpen) {
                  resetForm()
                }
                setIsAddOpen((prev) => !prev)
                setSubmitError("")
                setSubmitSuccess("")
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {isAddOpen ? "Close" : "Add Coupon"}
            </button>
          </div>

          {isAddOpen && (
            <form
              onSubmit={handleCreateCoupon}
              className="border border-slate-200 rounded-xl p-4 mb-5 bg-slate-50"
            >
              <h3 className="text-base font-semibold text-slate-900 mb-3">
                {editingOfferId ? `Edit Coupon${formData.couponCode ? ` — ${formData.couponCode}` : ""}` : "Create Coupon"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Code</label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => handleFormChange("couponCode", e.target.value)}
                    placeholder="e.g. NEWUSER50"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => handleFormChange("discountType", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="flat-price">Flat Amount</option>
                  </select>
                </div>

                <div title={formData.discountType === "flat-price" ? "Max discount is not applicable for flat coupons" : ""}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {formData.discountType === "percentage" ? "Discount (%)" : "Discount Amount"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) => handleFormChange("discountValue", e.target.value)}
                    placeholder={formData.discountType === "percentage" ? "e.g. 20" : "e.g. 100"}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.discountValue ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {errors.discountValue && <p className="mt-1 text-xs text-red-600">{errors.discountValue}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Scope</label>
                  <select
                    value={formData.customerScope}
                    onChange={(e) => handleFormChange("customerScope", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Users</option>
                    <option value="first-time">First-time Users</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Restaurant Scope</label>
                  <select
                    value={formData.restaurantScope}
                    onChange={(e) => handleFormChange("restaurantScope", e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Restaurants</option>
                    <option value="selected">Selected Restaurant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date (Optional)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleFormChange("endDate", e.target.value)}
                  min={formData.startDate || todayYMD()}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.endDate ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
                </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date (Optional)</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleFormChange("startDate", e.target.value)}
                  min={todayYMD()}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.startDate ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Min Order Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.minOrderValue}
                  onChange={(e) => handleFormChange("minOrderValue", e.target.value)}
                  placeholder="e.g. 199"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.minOrderValue ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.minOrderValue && <p className="mt-1 text-xs text-red-600">{errors.minOrderValue}</p>}
              </div>

                <div title={formData.discountType === "flat-price" ? "Max discount is not applicable for flat coupons" : ""}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Discount (₹, optional)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                    value={formData.maxDiscount}
                    onChange={(e) => handleFormChange("maxDiscount", e.target.value)}
                  placeholder="e.g. 100"
                    disabled={formData.discountType === "flat-price"}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.maxDiscount ? "border-red-500" : "border-slate-300"} bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                  {formData.discountType === "percentage" && errors.maxDiscount && <p className="mt-1 text-xs text-red-600">{errors.maxDiscount}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Usage Limit (global)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.usageLimit}
                  onChange={(e) => handleFormChange("usageLimit", e.target.value)}
                  placeholder="e.g. 1000"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.usageLimit ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.usageLimit && <p className="mt-1 text-xs text-red-600">{errors.usageLimit}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Per User Limit</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.perUserLimit}
                  onChange={(e) => handleFormChange("perUserLimit", e.target.value)}
                  placeholder="e.g. 1"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.perUserLimit ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.perUserLimit && <p className="mt-1 text-xs text-red-600">{errors.perUserLimit}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isFirstOrderOnly"
                  type="checkbox"
                  checked={formData.isFirstOrderOnly}
                  onChange={(e) => handleFormChange("isFirstOrderOnly", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isFirstOrderOnly" className="text-sm text-slate-700">First order only</label>
              </div>

                {formData.restaurantScope === "selected" && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Restaurant</label>
                    <select
                      value={formData.restaurantId}
                      onChange={(e) => handleFormChange("restaurantId", e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Choose a restaurant</option>
                      {restaurants.map((restaurant) => (
                        <option key={restaurant._id} value={restaurant._id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {(submitError || submitSuccess) && (
                <div className={`mt-3 text-sm font-medium ${submitError ? "text-red-600" : "text-green-600"}`}>
                  {submitError || submitSuccess}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || Object.keys(errors).length > 0}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting
                    ? (editingOfferId ? "Saving..." : "Creating...")
                    : (editingOfferId ? "Save Changes" : "Create Coupon")}
                </button>
                {editingOfferId && (
                  <button
                    type="button"
                    onClick={() => {
                      resetForm()
                      setIsAddOpen(false)
                      setSubmitError("")
                      setSubmitSuccess("")
                    }}
                    className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by restaurant name, dish name, or coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Offers List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Offers List
            </h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredOffers.length} {filteredOffers.length === 1 ? 'offer' : 'offers'}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-500 mt-4">Loading offers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-red-600 mb-1">Error</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-slate-700 mb-1">No Offers Found</p>
              <p className="text-sm text-slate-500">
                {searchQuery ? "No offers match your search criteria" : "No offers have been created yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">SI</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Restaurant</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Coupon Code</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Min Order</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Max Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Per User Limit</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Global Usage</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">End Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Cart</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredOffers.map((offer) => (
                    <tr key={`${offer.offerId}-${offer.dishId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{offer.sl}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">
                          {offer.restaurantScope === "all" || offer.restaurantName === "All Restaurants" ? "All Restaurants" : offer.restaurantName}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">
                          {offer.couponCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-xs font-medium ${
                            offer.customerGroup === "new"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            {offer.customerGroup === "new" ? "First-time" : "All Users"}
                          </span>
                          {offer.isFirstOrderOnly ? (
                            <span className="text-[10px] font-semibold text-amber-700">First order only</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700 whitespace-nowrap">{formatDiscount(offer)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{formatCurrency(offer.minOrderValue)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">
                          {offer.discountType === "percentage" ? formatCurrency(offer.maxDiscount) : "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{formatLimit(offer.perUserLimit)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-800">{formatUsage(offer.usedCount, offer.usageLimit)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{formatDateCell(offer.startDate)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{offer.endDate ? formatDateCell(offer.endDate) : "No expiry"}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(() => {
                          const status = offer.status || 'inactive'
                          const cls =
                            status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : status === 'scheduled'
                              ? 'bg-blue-100 text-blue-700'
                              : status === 'paused'
                              ? 'bg-red-100 text-red-700'
                              : status === 'expired' || status === 'inactive'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          return (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${cls}`}>
                              {status}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleShowInCart(offer.offerId, offer.dishId, offer.showInCart !== false)}
                          disabled={!!updatingCartVisibility[`${offer.offerId}-${offer.dishId}`]}
                          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                            offer.showInCart !== false ? "bg-green-600" : "bg-slate-300"
                          } disabled:opacity-60`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              offer.showInCart !== false ? "translate-x-7" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartEditOffer(offer)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                          >
                            Edit
                          </button>
                          {offer.status !== "inactive" && (
                            <button
                              type="button"
                              onClick={() => handleToggleOfferStatus(offer)}
                              disabled={!!updatingStatus[offer.offerId]}
                              className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold disabled:opacity-60 ${
                                offer.status === "paused"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-amber-500 hover:bg-amber-600"
                              }`}
                            >
                              {updatingStatus[offer.offerId]
                                ? "..."
                                : offer.status === "paused"
                                ? "Resume"
                                : "Pause"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteOffer(offer.offerId)}
                            disabled={!!deletingOffer[offer.offerId]}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                          >
                            {deletingOffer[offer.offerId] ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

