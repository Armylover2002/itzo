import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Search, ChevronDown, X } from "lucide-react"
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
  if (offer.discountType === "free-item") {
    const qty = Number(offer.freeItemQuantity) || 1
    const gate = offer.triggerItemName ? ` on ${offer.triggerItemName}` : ""
    return `Free ${offer.freeItemName || "item"}${qty > 1 ? ` x${qty}` : ""}${gate}`
  }
  if (offer.discountType === "flat-price") {
    return `₹${Number(offer.discountValue || offer.originalPrice || 0)} OFF`
  }
  const pct = Number(offer.discountPercentage ?? offer.discountValue ?? 0)
  const maxCap = Number(offer.maxDiscount)
  return `${pct}% OFF${Number.isFinite(maxCap) && maxCap > 0 ? ` (max ₹${maxCap})` : ""}`
}


function RestaurantMultiSelect({ restaurants, selectedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef(null)

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? restaurants.filter((r) => (r.name || "").toLowerCase().includes(q)) : restaurants
  }, [restaurants, query])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const nameById = useMemo(() => new Map(restaurants.map((r) => [String(r._id), r.name])), [restaurants])

  const toggle = (id) => {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])
  }
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedSet.has(String(r._id)))
  const toggleAllFiltered = () => {
    const ids = filtered.map((r) => String(r._id))
    onChange(
      allFilteredSelected
        ? selectedIds.filter((x) => !ids.includes(x))
        : [...new Set([...selectedIds, ...ids])],
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={selectedIds.length ? "text-slate-900" : "text-slate-400"}>
          {selectedIds.length ? `${selectedIds.length} restaurant(s) selected` : "Choose restaurants"}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search restaurant..."
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <label className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 border-b border-slate-100 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="h-4 w-4" />
            Select all{query.trim() ? " (filtered)" : ""}
          </label>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">No restaurants found</p>
            ) : (
              filtered.map((r) => {
                const id = String(r._id)
                return (
                  <label key={id} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selectedSet.has(id)} onChange={() => toggle(id)} className="h-4 w-4" />
                    {r.name}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
              {nameById.get(id) || "Restaurant"}
              <button type="button" onClick={() => toggle(id)} aria-label="Remove">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** Single-select dropdown with search, listing all of a restaurant's items. */
function ItemSelect({ items, value, onChange, placeholder, disabled, hasError, clearLabel }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef(null)

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? items.filter((i) => `${i.name} ${i.categoryName || ""}`.toLowerCase().includes(q)) : items
  }, [items, query])

  const selected = items.find((i) => i.id === value)
  const pick = (id) => {
    onChange(id)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg border ${hasError ? "border-red-500" : "border-slate-300"} bg-white text-left disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500`}
      >
        <span className={selected ? "text-slate-900 truncate" : "text-slate-400 truncate"}>
          {selected ? `${selected.name} (₹${selected.price})` : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${items.length} items...`}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {clearLabel && (
              <button type="button" onClick={() => pick("")} className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
                {clearLabel}
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-500">No items found</p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => pick(i.id)}
                  className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-sm hover:bg-slate-50 ${i.id === value ? "bg-blue-50 text-blue-700" : "text-slate-800"}`}
                >
                  <span className="truncate">
                    {i.name}
                    {i.categoryName ? <span className="text-xs text-slate-400"> · {i.categoryName}</span> : null}
                    {i.isAvailable === false ? <span className="text-xs text-red-500"> · unavailable</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">₹{i.price}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
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
  const [restaurantFoodItems, setRestaurantFoodItems] = useState([])
  const [formData, setFormData] = useState({
    couponCode: "",
    discountType: "percentage",
    discountValue: "",
    customerScope: "all",
    restaurantScope: "all",
    restaurantIds: [],
    freeItemId: "",
    freeItemQuantity: "1",
    triggerItemId: "",
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

  const isFreeItem = formData.discountType === "free-item"
  const freeItemRestaurantId = isFreeItem && formData.restaurantIds.length === 1 ? formData.restaurantIds[0] : ""

  useEffect(() => {
    if (!freeItemRestaurantId) {
      setRestaurantFoodItems([])
      return undefined
    }
    let cancelled = false
    adminAPI
      .getRestaurantFoodItemsForCoupon(freeItemRestaurantId)
      .then((res) => {
        if (!cancelled) setRestaurantFoodItems(res?.data?.data?.items || [])
      })
      .catch((err) => {
        debugError("Error fetching restaurant items:", err)
        if (!cancelled) setRestaurantFoodItems([])
      })
    return () => {
      cancelled = true
    }
  }, [freeItemRestaurantId])

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
    const free = f.discountType === "free-item"
    const value = Number(f.discountValue)
    if (!String(f.couponCode || "").trim()) e.couponCode = "Coupon code is required"
    if (!free && (!Number.isFinite(value) || value <= 0)) e.discountValue = "Discount must be greater than 0"
    if (free) {
      if (f.restaurantScope !== "selected" || f.restaurantIds.length !== 1) e.restaurantIds = "Select exactly one restaurant"
      if (!f.freeItemId) e.freeItemId = "Select the free item"
      if (!f.triggerItemId && !(Number(f.minOrderValue) > 0)) e.minOrderValue = 'Set "Buy this item" or a min order value'
    }
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
      if (value === "free-item") {
        setFormData((prev) => {
          const next = {
            ...prev,
            discountType: value,
            discountValue: "",
            maxDiscount: "",
            restaurantScope: "selected",
            restaurantIds: prev.restaurantIds.slice(0, 1),
            freeItemId: "",
            triggerItemId: "",
          }
          validateForm(next)
          return next
        })
        if (submitError) setSubmitError("")
        if (submitSuccess) setSubmitSuccess("")
        return
      }
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
    if (field === "restaurantIds" && formData.discountType === "free-item") {
      // Free items belong to one restaurant: keep only the latest pick and reset item choices.
      next.restaurantIds = value.length > 1 ? [value[value.length - 1]] : value
      next.freeItemId = ""
      next.triggerItemId = ""
    }
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
      restaurantIds: [],
      freeItemId: "",
      freeItemQuantity: "1",
      triggerItemId: "",
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
      freeItemId: offer.freeItemId || "",
      freeItemQuantity: String(offer.freeItemQuantity || 1),
      triggerItemId: offer.triggerItemId || "",
      customerScope: offer.customerScope || "all",
      restaurantScope: offer.restaurantScope || "all",
      restaurantIds: offer.restaurantScope === "selected"
        ? (Array.isArray(offer.restaurantDbIds) && offer.restaurantDbIds.length
          ? offer.restaurantDbIds.map(String)
          : [String(offer.restaurantDbId || offer.restaurantId || "")].filter(Boolean))
        : [],
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
    if (formData.discountType !== "free-item" && (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0)) {
      setSubmitError("Discount value must be greater than 0")
      return
    }

    if (formData.restaurantScope === "selected" && formData.restaurantIds.length === 0) {
      setSubmitError("Please select at least one restaurant")
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        couponCode: formData.couponCode.trim(),
        discountType: formData.discountType,
        discountValue: formData.discountType === "free-item" ? 0 : parsedDiscountValue,
        ...(formData.discountType === "free-item"
          ? {
            freeItemId: formData.freeItemId,
            freeItemQuantity: Math.max(1, Number(formData.freeItemQuantity) || 1),
            triggerItemId: formData.triggerItemId || undefined,
          }
          : {}),
        customerScope: formData.customerScope,
        restaurantScope: formData.restaurantScope,
        restaurantIds: formData.restaurantScope === "selected" ? formData.restaurantIds : undefined,
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
                    <option value="free-item">Free Item</option>
                  </select>
                </div>

                {!isFreeItem && (
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
                )}

                {isFreeItem && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Free Item</label>
                      <ItemSelect
                        items={restaurantFoodItems}
                        value={formData.freeItemId}
                        onChange={(id) => handleFormChange("freeItemId", id)}
                        disabled={!freeItemRestaurantId}
                        hasError={Boolean(errors.freeItemId)}
                        placeholder={freeItemRestaurantId ? "Choose free item" : "Select a restaurant first"}
                      />
                      {errors.freeItemId && <p className="mt-1 text-xs text-red-600">{errors.freeItemId}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Free Quantity</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.freeItemQuantity}
                        onChange={(e) => handleFormChange("freeItemQuantity", e.target.value)}
                        className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Buy This Item (optional)</label>
                      <ItemSelect
                        items={restaurantFoodItems}
                        value={formData.triggerItemId}
                        onChange={(id) => handleFormChange("triggerItemId", id)}
                        disabled={!freeItemRestaurantId}
                        placeholder="Any item (use Min Order Value)"
                        clearLabel="Any item (use Min Order Value)"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        Free item is given when the user buys this item, or orders above the Min Order Value.
                      </p>
                    </div>
                  </>
                )}

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
                    disabled={isFreeItem}
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
                    disabled={formData.discountType !== "percentage"}
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
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {isFreeItem ? "Select Restaurant (one)" : `Select Restaurants (${formData.restaurantIds.length} selected)`}
                    </label>
                    <RestaurantMultiSelect
                      restaurants={restaurants}
                      selectedIds={formData.restaurantIds}
                      onChange={(ids) => handleFormChange("restaurantIds", ids)}
                    />
                    {errors.restaurantIds && <p className="mt-1 text-xs text-red-600">{errors.restaurantIds}</p>}
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

