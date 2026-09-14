import { useState, useEffect, useRef, useMemo, Fragment } from "react"
import { createPortal } from "react-dom"
import { Link, useNavigate } from "react-router-dom"
import { Plus, Minus, ArrowLeft, ChevronRight, Clock, MapPin, Phone, FileText, Utensils, Tag, Percent, Share2, ChevronUp, ChevronDown, X, Check, Settings, CreditCard, Wallet, Building2, Sparkles, Banknote, Zap, CheckCircle2, MessageCircle, Send, Mail, Copy } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { useOrders } from "@food/context/OrdersContext"
import RestaurantItemDetailSheet from "@food/components/user/restaurant-details/sheets/RestaurantItemDetailSheet"
import {
  buildCartLineId,
  getDefaultFoodVariant,
  getFoodDisplayPrice,
  getFoodVariants,
  hasFoodVariants,
} from "@food/utils/foodVariants"
import QuickSharedCart from "@food/pages/user/cart/QuickSharedCart"
import MixedSharedCart from "@food/pages/user/cart/MixedSharedCart"
import { useLocation as useUserLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { useLocationSelector } from "@food/components/user/UserLayout"
import { orderAPI, restaurantAPI, adminAPI, userAPI, API_ENDPOINTS } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { initRazorpayPayment, isFlutterWebView, handleFlutterRazorpayPayment } from "@food/utils/razorpay"
import { sanitizeOrderImage, sanitizeOrderNotes } from "@food/utils/orderPayload"
import {
  areQuickGatesOpen,
  clearQuickDeliveryToast,
  formatQuickCharge,
  formatQuickEtaWindow,
  mapQuickDeliveryReason,
  showQuickDeliveryUnavailableToast,
} from "@food/utils/quickDelivery"
import {
  applyCartPricingResult,
  createCartPricingRequestController,
} from "@food/utils/cartPricingRequest"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@common/utils/businessSettings"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { getRoadDistanceKm } from "@/shared/services/roadDistance"
import {
  parseGeoPoint,
  normalizeRestaurantLocation,
} from "@food/utils/geo"
import zoopSound from "@food/assets/audio/zomato_sms.mp3"
import deliveryBoyGif from "@/assets/Delivery Boy.gif"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }



// Removed hardcoded suggested items - now fetching approved addons from backend
// Coupons will be fetched from backend based on items in cart

/**
 * Format full address string from address object
 * @param {Object} address - Address object with street, additionalDetails, city, state, zipCode, or formattedAddress
 * @returns {String} Formatted address string
 */
const formatFullAddress = (address) => {
  if (!address) return ""

  const looksLikeLatLng = (s) => {
    if (!s) return false
    const v = String(s).trim()
    // Matches "12.34, 56.78" (lat,lng) with optional decimals/spaces
    return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(v)
  }

  // Priority 1: Use formattedAddress if available (for live location addresses)
  if (address.formattedAddress && address.formattedAddress !== "Select location") {
    // If formattedAddress is still raw coordinates, don't show it as-is.
    // Fall back to composing from city/state/area instead.
    if (!looksLikeLatLng(address.formattedAddress)) {
      return address.formattedAddress
    }
  }

  // Priority 2: Build address from parts
  const addressParts = []
  if (address.street) addressParts.push(address.street)
  if (address.additionalDetails) addressParts.push(address.additionalDetails)
  if (address.city) addressParts.push(address.city)
  if (address.state) addressParts.push(address.state)
  if (address.zipCode) addressParts.push(address.zipCode)

  if (addressParts.length > 0) {
    return addressParts.join(', ')
  }

  // Priority 3: Use address field if available
  if (address.address && address.address !== "Select location") {
    return address.address
  }

  return ""
}

const RUPEE_SYMBOL = "\u20B9"
const CART_RECIPIENT_DETAILS_STORAGE_KEY = "food-cart-recipient-details-v1"
const CART_ORDER_NOTE_STORAGE_KEY = "food-cart-order-note-v1"
const RECIPIENT_NAME_RE = /^[A-Za-z][A-Za-z\s.'-]{1,49}$/

const resolveFallbackDeliveryFee = ({
  feeSettings = {},
  distanceKm = null,
}) => {
  const ranges = Array.isArray(feeSettings.deliveryFeeRanges)
    ? [...feeSettings.deliveryFeeRanges]
    : []
  const rangeFees = ranges
    .map((range) => Number(range?.fee))
    .filter((fee) => Number.isFinite(fee) && fee >= 0)

  const flat = Number(feeSettings.deliveryFee ?? feeSettings.baseDeliveryFee)
  const hasPositiveFlat = Number.isFinite(flat) && flat > 0

  if (Number.isFinite(distanceKm) && ranges.length > 0) {
    const sortedRanges = ranges.sort((a, b) => Number(a.min) - Number(b.min))
    for (let i = 0; i < sortedRanges.length; i += 1) {
      const range = sortedRanges[i]
      const min = Number(range.min)
      const max = Number(range.max)
      const fee = Number(range.fee)
      const isLastRange = i === sortedRanges.length - 1
      const inRange = isLastRange
        ? distanceKm >= min && distanceKm <= max
        : distanceKm >= min && distanceKm < max

      if (inRange && Number.isFinite(fee)) return fee
    }
  }

  if (rangeFees.length > 0) {
    return hasPositiveFlat ? flat : Math.min(...rangeFees)
  }

  return Number.isFinite(flat) && flat >= 0 ? flat : 0
}

const normalizeRestaurantForPricing = (restaurant) => {
  if (!restaurant || typeof restaurant !== "object") return restaurant
  if (!restaurant.location) return restaurant
  return {
    ...restaurant,
    location: normalizeRestaurantLocation(restaurant.location),
  }
}

const mapOrderItem = (item, fallbackRestaurantId = "") => ({
  itemId: item.itemId || item.id,
  name: item.name,
  type: item.type || (item.orderType === "quick" ? "quick" : "food"),
  sourceId:
    item.sourceId ||
    item.restaurantId ||
    (item.type === "quick" || item.orderType === "quick"
      ? item.quickStoreId || item.storeId || item.sellerId || ""
      : fallbackRestaurantId),
  sourceName:
    item.sourceName ||
    (item.orderType === "quick"
      ? item.quickStoreName || item.storeName || "Quick Commerce"
      : item.restaurant || item.restaurantName || "Restaurant"),
  price: item.price,
  variantId: item.variantId || undefined,
  variantName: item.variantName || undefined,
  variantPrice: item.variantPrice || item.price,
  quantity: item.quantity || 1,
  image: sanitizeOrderImage(item.image || item.imageUrl || ""),
  isVeg: item.isVeg !== false,
  notes: sanitizeOrderNotes(item.notes || ""),
  preparationTime: item.preparationTime,
})

const normalizeOrderAddress = (address, { recipientName = "", recipientPhone = "" } = {}) => {
  if (!address || typeof address !== "object") return null

  const resolvedStreet =
    String(address.street || "").trim() ||
    String(address.address || "").trim() ||
    String(address.formattedAddress || "").trim()

  const resolvedCity =
    String(address.city || "").trim() ||
    String(address.area || "").trim()

  const resolvedState =
    String(address.state || "").trim() ||
    resolvedCity

  return {
    ...address,
    label: address.label || "Home",
    street: resolvedStreet,
    city: resolvedCity,
    state: resolvedState,
    zipCode: address.zipCode || address.postalCode || "",
    phone: recipientPhone || address.phone || "",
    name: recipientName || address.name || "",
    fullName: recipientName || address.fullName || address.name || "",
  }
}

export default function Cart() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const orderSuccessAudioRef = useRef(null)
  const hasRestoredRecipientRef = useRef(false)
  const hasRestoredNoteRef = useRef(false)
  /** Single sequencer for every Cart calculateOrder (effect + coupon + place-order). */
  const pricingRequestControllerRef = useRef(null)
  if (!pricingRequestControllerRef.current) {
    pricingRequestControllerRef.current = createCartPricingRequestController()
  }
  /** Soft-fallback already applied Basic pricing — skip the follow-up effect. */
  const suppressPricingRecalcRef = useRef(false)

  // Defensive check: Ensure CartProvider is available
  const cartContext = useCart() || {};
  const { cart = [], updateQuantity, addToCart, getCartCount = () => 0, clearCart, cleanCartForRestaurant } = cartContext;
  const hasQuickItems = cart.some((item) => (item?.orderType || "food") === "quick")
  const hasFoodItems = cart.some((item) => (item?.orderType || "food") === "food")
  const isQuickCart = cart.length > 0 && cart.every((item) => (item?.orderType || "food") === "quick")

  const { getDefaultAddress, getDefaultPaymentMethod, setDefaultAddress, addresses, paymentMethods, userProfile, vegMode, activeAddress, activeAddressId, setActiveAddressId } = useProfile()
  const { createOrder } = useOrders()
  const { openLocationSelector } = useLocationSelector()
  const { location: currentLocation, loading: currentLocationLoading } = useUserLocation() // Get live location address

  const [showItemDetail, setShowItemDetail] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [selectedItemImageIndex, setSelectedItemImageIndex] = useState(0)
  const [selectedVariantId, setSelectedVariantId] = useState(null)

  // Network status
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getDishQuantity = (dish, preferredVariantId = "") => {
    const variants = getFoodVariants(dish);
    const variant = variants.find((v) => String(v.id) === String(preferredVariantId)) || variants[0];
    const lineItemId = buildCartLineId(dish?.itemId || dish?._id || dish?.id || "", variant?.id || variant?._id || "");
    const cartItem = cart.find((entry) => entry.id === lineItemId);
    return cartItem?.quantity || 0;
  };

  const getVariantForDish = (dish, preferredVariantId = "") => {
    const variants = getFoodVariants(dish);
    if (variants.length === 0) return null;
    return (
      variants.find((variant) => String(variant.id) === String(preferredVariantId || "")) ||
      variants[0]
    );
  };

  const updateItemQuantityDetail = (dish, newQuantity, event = null, preferredVariant = null) => {
    const resolvedVariant = preferredVariant || getDefaultFoodVariant(dish);
    const lineItemId = buildCartLineId(dish?.itemId || dish?._id || dish?.id || "", resolvedVariant?.id || resolvedVariant?._id || "");

    if (newQuantity <= 0) {
      updateQuantity(lineItemId, 0);
      return;
    }

    const existingCartItem = cart.find((entry) => entry.id === lineItemId);
    if (existingCartItem) {
      updateQuantity(lineItemId, newQuantity);
      return;
    }

    addToCart({
      ...dish,
      id: lineItemId,
      lineItemId,
      itemId: String(dish.itemId || dish._id || dish.id || ""),
      variantId: resolvedVariant?.id || "",
      variantName: resolvedVariant?.name || "",
      variantPrice: resolvedVariant?.price ?? dish.price,
      price: resolvedVariant?.price ?? dish.price,
      otherPrice: resolvedVariant?.otherPrice ?? dish.otherPrice ?? 0,
      quantity: newQuantity
    });
  };

  const [showCoupons, setShowCoupons] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponCode, setCouponCode] = useState("")
  const [manualCouponCode, setManualCouponCode] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash")
  const [showPaymentSheet, setShowPaymentSheet] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [isLoadingWallet, setIsLoadingWallet] = useState(false)
  const [note, setNote] = useState(() => {
    try {
      if (typeof window === "undefined") return ""
      const raw = window.localStorage.getItem(CART_ORDER_NOTE_STORAGE_KEY)
      if (!raw) return ""
      const stored = JSON.parse(raw)
      return String(stored?.note || "")
    } catch {
      return ""
    }
  })
  const [showNoteInput, setShowNoteInput] = useState(() => {
    try {
      if (typeof window === "undefined") return false
      const raw = window.localStorage.getItem(CART_ORDER_NOTE_STORAGE_KEY)
      if (!raw) return false
      const stored = JSON.parse(raw)
      const storedNote = String(stored?.note || "")
      return Boolean(stored?.showNoteInput) || storedNote.trim().length > 0
    } catch {
      return false
    }
  })
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [restaurantNote, setRestaurantNote] = useState(() => {
    try {
      if (typeof window === "undefined") return ""
      const raw = window.localStorage.getItem(CART_ORDER_NOTE_STORAGE_KEY)
      if (!raw) return ""
      const stored = JSON.parse(raw)
      return String(stored?.restaurantNote || "")
    } catch {
      return ""
    }
  })
  const [showRestaurantNoteInput, setShowRestaurantNoteInput] = useState(() => {
    try {
      if (typeof window === "undefined") return false
      const raw = window.localStorage.getItem(CART_ORDER_NOTE_STORAGE_KEY)
      if (!raw) return false
      const stored = JSON.parse(raw)
      const storedNote = String(stored?.restaurantNote || "")
      return Boolean(stored?.showRestaurantNoteInput) || storedNote.trim().length > 0
    } catch {
      return false
    }
  })
  const [isEditingRecipient, setIsEditingRecipient] = useState(false)
  const [recipientDetails, setRecipientDetails] = useState({
    name: "",
    phone: "",
  })

  const [sendCutlery, setSendCutlery] = useState(true)
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showBillDetails, setShowBillDetails] = useState(true)
  const [showPlacingOrder, setShowPlacingOrder] = useState(false)
  /** Food Instant delivery mode: "standard" (Basic) | "quick". Never confuse with QC. */
  const [deliveryType, setDeliveryType] = useState("standard")
  const [quickFallbackNotice, setQuickFallbackNotice] = useState(null)
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [orderProgress, setOrderProgress] = useState(0)
  const [showOrderSuccess, setShowOrderSuccess] = useState(false)
  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [placedOrderData, setPlacedOrderData] = useState(null)


  useEffect(() => {
    const audio = new Audio(zoopSound)
    audio.preload = "auto"
    audio.volume = 0.8
    orderSuccessAudioRef.current = audio

    return () => {
      if (orderSuccessAudioRef.current) {
        orderSuccessAudioRef.current.pause()
        orderSuccessAudioRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!showOrderSuccess || !orderSuccessAudioRef.current) return

    orderSuccessAudioRef.current.currentTime = 0
    orderSuccessAudioRef.current.play().catch((error) => {
      debugWarn("Order success sound blocked by browser:", error?.message || error)
    })
  }, [showOrderSuccess])

  // Restaurant and pricing state
  const [restaurantData, setRestaurantData] = useState(null)
  const [loadingRestaurant, setLoadingRestaurant] = useState(false)
  const [pricing, setPricing] = useState(null)
  const [loadingPricing, setLoadingPricing] = useState(false)
  const [roadDistanceKm, setRoadDistanceKm] = useState(null)
  const [menuData, setMenuData] = useState(null)

  useEffect(() => {
    let isMounted = true
    const fetchMenuData = async () => {
      if (restaurantData && restaurantAPI?.getMenuByRestaurantId) {
        try {
          const restaurantIdToUse = restaurantData.restaurantId || restaurantData._id
          if (!restaurantIdToUse) return
          const res = await restaurantAPI.getMenuByRestaurantId(restaurantIdToUse)
          if (isMounted && res) {
            const parsedMenu = res.data?.data?.menu || res.data?.menu || res.data || res;
            setMenuData(parsedMenu);
          }
        } catch (error) {
          debugWarn("Failed to fetch menu data for cart items:", error)
        }
      }
    }
    fetchMenuData()
    return () => { isMounted = false }
  }, [restaurantData])

  // Addons state
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)

  // Coupons state - fetched from backend
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [userOrderCount, setUserOrderCount] = useState(0)

  // Fee settings from public API (UI fallback only; createOrder recalculates server-side)
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 0,
    baseDeliveryFee: 0,
    deliveryFeeRanges: [],
    platformFee: 0,
    packagingFee: 0,
    gstRate: 0,
  })


  const availableTimeSlots = useMemo(() => {
    if (!isScheduled || !scheduledDate || !restaurantData) return []

    try {
      const targetDate = new Date(scheduledDate)
      const status = getRestaurantAvailabilityStatus(restaurantData, targetDate)

      let openingHour = 9
      let closingHour = 22

      if (status.openingTime) {
        const [h] = status.openingTime.split(':')
        openingHour = parseInt(h, 10)
      }

      if (status.closingTime) {
        const [h] = status.closingTime.split(':')
        closingHour = parseInt(h, 10)
      }

      if (closingHour < openingHour) {
        closingHour += 24 // Handle overnight slots
      }

      const slots = []
      const now = new Date()
      // Fix timezone date comparison by comparing date strings YYYY-MM-DD
      const nowStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0]
      const targetStr = scheduledDate
      const isToday = targetStr === nowStr
      const currentHour = now.getHours()

      for (let h = openingHour; h <= closingHour; h++) {
        const actualHour = h % 24
        // Skip past hours if today. Add 1 hour buffer so they can't order right at the boundary
        if (isToday && h <= currentHour) continue

        const period = actualHour >= 12 ? 'PM' : 'AM'
        const display12 = actualHour % 12 || 12
        const timeString = `${String(actualHour).padStart(2, '0')}:00`
        const displayString = `${display12}:00 ${period}`

        slots.push({ value: timeString, label: displayString })
      }

      return slots
    } catch {
      return []
    }
  }, [isScheduled, scheduledDate, restaurantData])

  // Reset scheduledTime if it's no longer valid in the new slots
  useEffect(() => {
    if (isScheduled && availableTimeSlots.length > 0) {
      const isValid = availableTimeSlots.some(slot => slot.value === scheduledTime)
      if (!isValid) {
        setScheduledTime(availableTimeSlots[0].value)
      }
    } else if (!isScheduled) {
      setScheduledDate("")
      setScheduledTime("")
    }
  }, [isScheduled, availableTimeSlots, scheduledTime])

  const cartCount = getCartCount()
  const getAddressId = (address) => address?.id || address?._id || null
  const normalizeAddressLabel = (label) => {
    if (!label) return ""
    const value = String(label).trim().toLowerCase()
    if (value === "work" || value === "office") return "office"
    if (value === "home") return "home"
    if (value === "other") return "other"
    return value
  }
  const getDisplayAddressLabel = (label) => {
    const normalized = normalizeAddressLabel(label)
    if (normalized === "office") return "Work"
    if (normalized === "home") return "Home"
    if (normalized === "other") return "Other"
    return label || "Saved address"
  }
  const sanitizeRecipientPhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "")
    if (digits.length <= 10) return digits
    return digits.slice(-10)
  }
  const sanitizeRecipientName = (value) =>
    String(value || "")
      .replace(/[^A-Za-z\s.'-]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 50)
  const defaultAddress = activeAddress

  const resolvedDeliveryAddressId = useMemo(() => {
    if (activeAddress?.type === "current") return undefined
    return getAddressId(defaultAddress) || undefined
  }, [activeAddress, defaultAddress])

  const hasSavedAddress = Boolean(defaultAddress && formatFullAddress(defaultAddress))
  const recipientName = String(recipientDetails.name || "").trim() || userProfile?.name || "Your Name"
  const recipientPhone = sanitizeRecipientPhone(recipientDetails.phone || "") || userProfile?.phone || ""
  const selectedAddressCoordinates = defaultAddress?.location?.coordinates
  const zoneLocation = selectedAddressCoordinates?.length === 2
    ? {
      latitude: selectedAddressCoordinates[1],
      longitude: selectedAddressCoordinates[0]
    }
    : currentLocation
  const { zoneId } = useZone(zoneLocation) // Prefer selected/saved address zone
  const defaultPayment = getDefaultPaymentMethod()

  // Removed legacy deliveryAddressMode effect

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const raw = window.localStorage.getItem(CART_RECIPIENT_DETAILS_STORAGE_KEY)
      if (!raw) {
        hasRestoredRecipientRef.current = true
        return
      }

      const stored = JSON.parse(raw)
      setRecipientDetails({
        name: stored?.name || "",
        phone: sanitizeRecipientPhone(stored?.phone || ""),
      })
      setIsEditingRecipient(Boolean(stored?.isEditingRecipient))
    } catch {
      setRecipientDetails({ name: "", phone: "" })
      setIsEditingRecipient(false)
    } finally {
      hasRestoredRecipientRef.current = true
    }
  }, [])

  const hasInitializedFromProfileRef = useRef(false)
  useEffect(() => {
    if (hasInitializedFromProfileRef.current) return
    if (userProfile?.name || userProfile?.phone) {
      setRecipientDetails((prev) => ({
        name: prev.name || userProfile.name || "",
        phone: prev.phone || userProfile.phone || "",
      }))
      hasInitializedFromProfileRef.current = true
    }
  }, [userProfile?.name, userProfile?.phone])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasRestoredRecipientRef.current) return

    try {
      window.localStorage.setItem(
        CART_RECIPIENT_DETAILS_STORAGE_KEY,
        JSON.stringify({
          name: recipientDetails.name || "",
          phone: sanitizeRecipientPhone(recipientDetails.phone || ""),
          isEditingRecipient,
        })
      )
    } catch {
      // Ignore storage errors and keep cart flow working.
    }
  }, [recipientDetails, isEditingRecipient])

  useEffect(() => {
    hasRestoredNoteRef.current = true
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!hasRestoredNoteRef.current) return

    try {
      window.localStorage.setItem(
        CART_ORDER_NOTE_STORAGE_KEY,
        JSON.stringify({
          note,
          showNoteInput,
          restaurantNote,
          showRestaurantNoteInput,
        })
      )
    } catch {
      // Ignore storage errors and keep note flow working.
    }
  }, [note, showNoteInput, restaurantNote, showRestaurantNoteInput])

  // Cleaned up old selectedAddressId effects

  // Get restaurant ID from cart or restaurant data
  // Priority: restaurantData > cart[0].restaurantId
  // DO NOT use cart[0].restaurant as slug fallback - it creates wrong slugs
  const restaurantId = cart.length > 0
    ? (restaurantData?._id || restaurantData?.restaurantId || cart[0]?.restaurantId || null)
    : null

  // Stable restaurant ID for addons fetch (memoized to prevent dependency array issues)
  // Prefer restaurantData IDs (more reliable) over slug from cart
  const restaurantIdForAddons = useMemo(() => {
    // Only use restaurantData if it's loaded, otherwise wait
    if (restaurantData) {
      return restaurantData._id || restaurantData.restaurantId || null
    }
    // If restaurantData is not loaded yet, return null to wait
    return null
  }, [restaurantData])



  // Lock body scroll and scroll to top when any full-screen modal opens
  useEffect(() => {
    if (showPlacingOrder || showOrderSuccess) {
      // Lock body scroll
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.top = `-${window.scrollY}px`

      // Scroll window to top
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else {
      // Restore body scroll
      const scrollY = document.body.style.top
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1)
      }
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.width = ''
      document.body.style.top = ''
    }
  }, [showPlacingOrder, showOrderSuccess])

  // Fetch restaurant data when cart has items
  useEffect(() => {
    const fetchRestaurantData = async () => {
      if (isQuickCart) {
        setRestaurantData(null)
        setLoadingRestaurant(false)
        return
      }

      if (cart.length === 0) {
        setRestaurantData(null)
        return
      }

      // If we already have restaurantData, don't fetch again
      if (restaurantData) {
        return
      }

      setLoadingRestaurant(true)

      // Strategy 1: Try using restaurantId from cart if available
      if (cart[0]?.restaurantId) {
        try {
          const cartRestaurantId = cart[0].restaurantId;
          const cartRestaurantName = cart[0].restaurant;

          debugLog("?? Fetching restaurant data by restaurantId from cart:", cartRestaurantId)
          const response = await restaurantAPI.getRestaurantById(cartRestaurantId)
          const data = response?.data?.data?.restaurant || response?.data?.restaurant

          if (data) {
            // CRITICAL: Validate that fetched restaurant matches cart items
            const fetchedRestaurantId = data.restaurantId || data._id?.toString();
            const fetchedRestaurantName = data.name;

            // Check if restaurantId matches
            const restaurantIdMatches =
              fetchedRestaurantId === cartRestaurantId ||
              data._id?.toString() === cartRestaurantId ||
              data.restaurantId === cartRestaurantId;

            // Check if restaurant name matches (if available in cart)
            const restaurantNameMatches =
              !cartRestaurantName ||
              fetchedRestaurantName?.toLowerCase().trim() === cartRestaurantName.toLowerCase().trim();

            if (!restaurantIdMatches) {
              debugError('? CRITICAL: Fetched restaurant ID does not match cart restaurantId!', {
                cartRestaurantId: cartRestaurantId,
                fetchedRestaurantId: fetchedRestaurantId,
                fetched_id: data._id?.toString(),
                fetched_restaurantId: data.restaurantId,
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Don't set restaurantData if IDs don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }

            if (!restaurantNameMatches) {
              debugWarn('?? WARNING: Restaurant name mismatch:', {
                cartRestaurantName: cartRestaurantName,
                fetchedRestaurantName: fetchedRestaurantName
              });
              // Still proceed but log warning
            }

            debugLog("? Restaurant data loaded from cart restaurantId:", {
              _id: data._id,
              restaurantId: data.restaurantId,
              name: data.name,
              cartRestaurantId: cartRestaurantId,
              cartRestaurantName: cartRestaurantName
            })
            setRestaurantData(data)
            setLoadingRestaurant(false)
            return
          }
        } catch (error) {
          debugWarn("?? Failed to fetch by cart restaurantId, trying fallback...", error)
        }
      }

      // Strategy 2: If no restaurantId in cart, search by restaurant name
      if (cart[0]?.restaurant && !restaurantData) {
        try {
          debugLog("?? Searching restaurant by name:", cart[0].restaurant)
          const searchResponse = await restaurantAPI.getRestaurants({ limit: 100 })
          const restaurants = searchResponse?.data?.data?.restaurants || searchResponse?.data?.data || []
          debugLog("?? Fetched", restaurants.length, "restaurants for name search")

          // Try exact match first
          let matchingRestaurant = restaurants.find(r =>
            r.name?.toLowerCase().trim() === cart[0].restaurant?.toLowerCase().trim()
          )

          // If no exact match, try partial match
          if (!matchingRestaurant) {
            debugLog("?? No exact match, trying partial match...")
            matchingRestaurant = restaurants.find(r =>
              r.name?.toLowerCase().includes(cart[0].restaurant?.toLowerCase().trim()) ||
              cart[0].restaurant?.toLowerCase().trim().includes(r.name?.toLowerCase())
            )
          }

          if (matchingRestaurant) {
            // CRITICAL: Validate that the found restaurant matches cart items
            const cartRestaurantName = cart[0]?.restaurant?.toLowerCase().trim();
            const foundRestaurantName = matchingRestaurant.name?.toLowerCase().trim();

            if (cartRestaurantName && foundRestaurantName && cartRestaurantName !== foundRestaurantName) {
              debugError("? CRITICAL: Restaurant name mismatch!", {
                cartRestaurantName: cart[0]?.restaurant,
                foundRestaurantName: matchingRestaurant.name,
                cartRestaurantId: cart[0]?.restaurantId,
                foundRestaurantId: matchingRestaurant.restaurantId || matchingRestaurant._id
              });
              // Don't set restaurantData if names don't match - this prevents wrong restaurant assignment
              setLoadingRestaurant(false);
              return;
            }

            debugLog("? Found restaurant by name:", {
              name: matchingRestaurant.name,
              _id: matchingRestaurant._id,
              restaurantId: matchingRestaurant.restaurantId,
              slug: matchingRestaurant.slug,
              cartRestaurantName: cart[0]?.restaurant
            })
            setRestaurantData(matchingRestaurant)
            setLoadingRestaurant(false)
            return
          } else {
            debugWarn("?? Restaurant not found even by name search. Searched in", restaurants.length, "restaurants")
            if (restaurants.length > 0) {
              debugLog("?? Available restaurant names:", restaurants.map(r => r.name).slice(0, 10))
            }
          }
        } catch (searchError) {
          debugWarn("?? Error searching restaurants by name:", searchError)
        }
      }

      // If all strategies fail, set to null
      setRestaurantData(null)
      setLoadingRestaurant(false)
    }

    fetchRestaurantData()
  }, [cart.length, cart[0]?.restaurantId, cart[0]?.restaurant, isQuickCart])

  // Fetch approved addons for the restaurant
  useEffect(() => {
    const fetchAddonsWithId = async (idToUse) => {

      debugLog("?? Addons fetch - Using ID:", {
        restaurantData: restaurantData ? {
          _id: restaurantData._id,
          restaurantId: restaurantData.restaurantId,
          name: restaurantData.name
        } : 'Not loaded',
        cartRestaurantId: restaurantId,
        idToUse: idToUse
      })

      // Convert to string for validation
      const idString = String(idToUse)
      debugLog("?? Restaurant ID string:", idString, "Type:", typeof idString, "Length:", idString.length)

      // Validate ID format (should be ObjectId or restaurantId format)
      const isValidIdFormat = /^[a-zA-Z0-9\-_]+$/.test(idString) && idString.length >= 3

      if (!isValidIdFormat) {
        debugWarn("?? Restaurant ID format invalid:", idString)
        setAddons([])
        return
      }

      try {
        setLoadingAddons(true)
        debugLog("?? Fetching addons for restaurant ID:", idString)
        const response = await restaurantAPI.getAddonsByRestaurantId(idString)
        debugLog("? Addons API response received:", response?.data)
        debugLog("?? Response structure:", {
          success: response?.data?.success,
          data: response?.data?.data,
          addons: response?.data?.data?.addons,
          directAddons: response?.data?.addons
        })

        const data = response?.data?.data?.addons || response?.data?.addons || []
        debugLog("?? Fetched addons count:", data.length)
        debugLog("?? Fetched addons data:", JSON.stringify(data, null, 2))

        if (data.length === 0) {
          debugWarn("?? No addons returned from API. Response:", response?.data)
        } else {
          debugLog("? Successfully fetched", data.length, "addons:", data.map(a => a.name))
        }

        setAddons(data)
      } catch (error) {
        // Log error for debugging
        debugError("? Addons fetch error:", {
          code: error.code,
          status: error.response?.status,
          message: error.message,
          url: error.config?.url,
          data: error.response?.data
        })
        // Silently handle network errors and 404 errors
        // Network errors (ERR_NETWORK) happen when backend is not running - this is OK for development
        // 404 errors mean restaurant might not have addons or restaurant not found - also OK
        if (error.code !== 'ERR_NETWORK' && error.response?.status !== 404) {
          debugError("Error fetching addons:", error)
        }
        // Continue with cart even if addons fetch fails
        setAddons([])
      } finally {
        setLoadingAddons(false)
      }
    }

    const fetchAddons = async () => {
      if (isQuickCart) {
        setAddons([])
        setLoadingAddons(false)
        return
      }

      if (cart.length === 0) {
        setAddons([])
        return
      }

      // Wait for restaurantData to be loaded (including fallback search)
      if (loadingRestaurant) {
        debugLog("? Waiting for restaurantData to load (including fallback search)...")
        return
      }

      // Must have restaurantData to fetch addons
      if (!restaurantData) {
        debugWarn("?? No restaurantData available for addons fetch")
        setAddons([])
        return
      }

      // Use restaurantData ID (most reliable)
      const idToUse = restaurantData._id || restaurantData.restaurantId
      if (!idToUse) {
        debugWarn("?? No valid restaurant ID in restaurantData")
        setAddons([])
        return
      }

      debugLog("? Using restaurantData ID for addons:", idToUse)
      fetchAddonsWithId(idToUse)
    }

    fetchAddons()
  }, [restaurantData, cart.length, loadingRestaurant, isQuickCart])

  // Fetch applicable coupons for cart (server-validated list)
  useEffect(() => {
    let cancelled = false
    const debounceMs = 400

    const fetchCouponsForCart = async () => {
      if (isQuickCart) {
        if (!cancelled) {
          setAvailableCoupons([])
          setLoadingCoupons(false)
        }
        return
      }

      if (cart.length === 0 || !restaurantId) {
        if (!cancelled) setAvailableCoupons([])
        return
      }

      const cartSubtotal = cart.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0,
      )

      debugLog(`[CART-COUPONS] Fetching applicable coupons for restaurant ${restaurantId}, subtotal ${cartSubtotal}`)
      if (!cancelled) setLoadingCoupons(true)

      try {
        const response = await restaurantAPI.getCouponsByItemIdPublic(
          restaurantId,
          null,
          cartSubtotal,
        )

        if (cancelled) return

        if (response?.data?.success && response?.data?.data?.coupons) {
          const coupons = response.data.data.coupons.map((coupon) => {
            const isPct = coupon.discountType === "percentage"
            const discountValue = Number(coupon.discountValue) || 0
            const estimatedDiscount = Number(coupon.estimatedDiscount) || 0
            const displayDiscount = Number(coupon.displayDiscount) || (isPct ? estimatedDiscount : discountValue)
            const meetsMinOrder = coupon.meetsMinOrder !== false
            const amountToUnlock = Number(coupon.amountToUnlock || 0)
            return {
              code: coupon.couponCode,
              discount: estimatedDiscount,
              discountType: coupon.discountType,
              discountValue,
              displayDiscount,
              discountPercentage: coupon.discountPercentage,
              discountDisplay: isPct
                ? `${coupon.discountPercentage}% OFF`
                : `${RUPEE_SYMBOL}${displayDiscount} OFF`,
              minOrder: coupon.minOrderValue || 0,
              description: isPct
                ? `${coupon.discountPercentage}% OFF on item total with '${coupon.couponCode}'`
                : `Save ${RUPEE_SYMBOL}${displayDiscount} on item total with '${coupon.couponCode}'`,
              customerGroup: coupon.customerGroup || coupon.customerScope || "all",
              customerScope: coupon.customerScope || coupon.customerGroup || "all",
              isFirstOrderOnly: Boolean(coupon.isFirstOrderOnly),
              isGlobalCoupon: Boolean(coupon.isGlobalCoupon),
              restaurantScope: coupon.restaurantScope || (coupon.isGlobalCoupon ? "all" : "selected"),
              couponSource: coupon.couponSource || "admin",
              meetsMinOrder,
              amountToUnlock,
            }
          })
          debugLog(`[CART-COUPONS] Applicable coupons: ${coupons.length}`, coupons)
          setAvailableCoupons(coupons)
        } else {
          setAvailableCoupons([])
        }
      } catch (error) {
        debugError("[CART-COUPONS] Error fetching coupons:", error)
        if (!cancelled) setAvailableCoupons([])
      } finally {
        if (!cancelled) setLoadingCoupons(false)
      }
    }

    const timerId = setTimeout(fetchCouponsForCart, debounceMs)
    return () => {
      cancelled = true
      clearTimeout(timerId)
    }
  }, [cart, restaurantId, isQuickCart])

  // Shared sequenced calculateOrder — main effect, coupons, place-order all share one pipeline.
  const buildFoodCalculatePayload = ({
    couponCodeOverride,
    deliveryModeOverride,
    includeOrderType = true,
  } = {}) => {
    const requestedQuick =
      deliveryModeOverride != null
        ? deliveryModeOverride === "quick"
        : deliveryType === "quick" && !isScheduled
    const resolvedRestaurantId =
      restaurantData?.restaurantId ||
      restaurantData?._id ||
      restaurantId ||
      ""
    const payload = {
      items: cart.map((item) => mapOrderItem(item, resolvedRestaurantId)),
      restaurantId: resolvedRestaurantId || undefined,
      address: defaultAddress,
      deliveryAddressId: resolvedDeliveryAddressId,
      couponCode:
        couponCodeOverride !== undefined
          ? couponCodeOverride
          : appliedCoupon?.code || couponCode || undefined,
      deliveryMode: requestedQuick ? "quick" : "basic",
      scheduledAt:
        isScheduled && scheduledDate && scheduledTime
          ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
          : undefined,
    }
    if (includeOrderType) {
      payload.orderType = "food"
    }
    return payload
  }

  const runSequencedFoodCalculate = async (
    payloadOptions = {},
    { apply = true, force = false } = {},
  ) => {
    const payload = buildFoodCalculatePayload(payloadOptions)
    const result = await pricingRequestControllerRef.current.calculate(payload, {
      force,
    })
    if (result.stale) {
      return { ...result, applied: false }
    }
    if (!apply) {
      return { ...result, applied: false }
    }
    const applied = applyCartPricingResult({
      result,
      setPricing,
      setDeliveryType,
      setQuickFallbackNotice,
      onSoftFallback: () => {
        suppressPricingRecalcRef.current = true
      },
    })
    return { ...result, ...applied }
  }

  // Stable key so object-identity churn (cart/address refs) does not retrigger calculate.
  const foodPricingRequestKey = useMemo(() => {
    if (
      cart.length === 0 ||
      !hasSavedAddress ||
      (hasQuickItems && hasFoodItems) ||
      isQuickCart
    ) {
      return null
    }
    const cartKey = cart
      .map((item) => {
        const id = item.itemId || item.id || item._id || ""
        const variant = item.variantId || ""
        return `${id}:${variant}:${Number(item.quantity) || 1}:${item.orderType || "food"}`
      })
      .join("|")
    const coords = defaultAddress?.location?.coordinates
    const addressKey =
      resolvedDeliveryAddressId ||
      (Array.isArray(coords)
        ? coords.map(Number).join(",")
        : formatFullAddress(defaultAddress) || "")
    const couponKey = String(
      appliedCoupon?.code || couponCode || "",
    ).toUpperCase()
    const deliveryMode =
      deliveryType === "quick" && !isScheduled ? "quick" : "basic"
    const scheduleKey =
      isScheduled && scheduledDate && scheduledTime
        ? `${scheduledDate}T${scheduledTime}`
        : ""
    return [
      cartKey,
      addressKey,
      couponKey,
      String(restaurantId || ""),
      deliveryMode,
      scheduleKey,
    ].join("::")
  }, [
    cart,
    hasSavedAddress,
    hasQuickItems,
    hasFoodItems,
    isQuickCart,
    defaultAddress,
    resolvedDeliveryAddressId,
    appliedCoupon?.code,
    couponCode,
    restaurantId,
    deliveryType,
    isScheduled,
    scheduledDate,
    scheduledTime,
  ])

  // Calculate pricing once per meaningful cart/address/coupon/mode change.
  // Debounce coalesces StrictMode remount + cascading restaurantId/address settles.
  useEffect(() => {
    if (!foodPricingRequestKey) {
      setPricing(null)
      setLoadingPricing(false)
      return undefined
    }

    let cancelled = false
    const debounceMs = 200
    const timer = setTimeout(async () => {
      // Wait for restaurant resolve so restaurantId does not flip mid-request.
      if (loadingRestaurant) {
        return
      }

      if (suppressPricingRecalcRef.current) {
        suppressPricingRecalcRef.current = false
        return
      }

      try {
        if (!cancelled) setLoadingPricing(true)
        const result = await runSequencedFoodCalculate()
        if (cancelled || result.stale) return

        if (!result.pricing) {
          setPricing(null)
          return
        }

        // Sync coupon object from backend without changing the request key (same code).
        if (result.pricing.appliedCoupon && !appliedCoupon) {
          const coupon = availableCoupons.find(
            (c) => c.code === result.pricing.appliedCoupon.code,
          )
          if (coupon) {
            setAppliedCoupon(coupon)
          }
        }
      } catch (error) {
        if (cancelled) return
        // Network errors or 404 errors - silently handle, fallback to frontend calculation
        if (error.code !== "ERR_NETWORK" && error.response?.status !== 404) {
          debugError("Error calculating pricing:", error)
        }
        // Only clear if this is still the latest request failure path (non-stale throws)
        if (!cancelled) setPricing(null)
      } finally {
        if (!cancelled) setLoadingPricing(false)
      }
    }, debounceMs)

    return () => {
      cancelled = true
      clearTimeout(timer)
      pricingRequestControllerRef.current?.abort?.()
    }
  }, [cart, defaultAddress, appliedCoupon, couponCode, restaurantId, deliveryType, isScheduled, scheduledDate, scheduledTime, foodPricingRequestKey, loadingRestaurant])

// Fetch wallet balance
useEffect(() => {
  const fetchWalletBalance = async () => {
    try {
      setIsLoadingWallet(true)
      const response = await userAPI.getWallet()
      if (response?.data?.success && response?.data?.data?.wallet) {
        setWalletBalance(response.data.data.wallet.balance || 0)
      }
    } catch (error) {
      debugError("Error fetching wallet balance:", error)
      setWalletBalance(0)
    } finally {
      setIsLoadingWallet(false)
    }
  }
  fetchWalletBalance()
}, [])

// Fetch user order count (used for first-time coupon eligibility)
useEffect(() => {
  const fetchOrderCount = async () => {
    try {
      const response = await orderAPI.getOrders({ page: 1, limit: 1 })
      if (response?.data?.success) {
        const totalOrders = response?.data?.data?.pagination?.total || 0
        setUserOrderCount(totalOrders)
      }
    } catch (error) {
      debugError("Error fetching user order count:", error)
      setUserOrderCount(0)
    }
  }

  fetchOrderCount()
}, [])

// One-shot fee settings fallback — live totals come from calculateOrder (no 30s poll)
useEffect(() => {
  let cancelled = false
  const fetchFeeSettings = async () => {
    try {
      const response = await adminAPI.getPublicFeeSettings()
      const settings = response?.data?.data?.feeSettings
      if (!cancelled && response?.data?.success && settings) {
        setFeeSettings({
          deliveryFee: Number(settings.deliveryFee ?? settings.baseDeliveryFee ?? 0),
          baseDeliveryFee: Number(
            settings.baseDeliveryFee ?? settings.deliveryFee ?? 0,
          ),
          deliveryFeeRanges: Array.isArray(settings.deliveryFeeRanges)
            ? settings.deliveryFeeRanges
            : [],
          platformFee: Number(settings.platformFee ?? 0),
          packagingFee: Number(settings.packagingFee ?? 0),
          gstRate: Number(settings.gstRate ?? 0),
        })
      }
    } catch (error) {
      debugError('Error fetching fee settings:', error)
    }
  }

  fetchFeeSettings()
  return () => {
    cancelled = true
  }
}, [])

// Road distance (same as home & restaurant details pages)
useEffect(() => {
  let cancelled = false

  const fetchRoadDistance = async () => {
    const restaurantPoint = parseGeoPoint(
      normalizeRestaurantForPricing(restaurantData),
    )
    const userPoint = parseGeoPoint(defaultAddress)
    if (!restaurantPoint || !userPoint) {
      if (!cancelled) setRoadDistanceKm(null)
      return
    }

    const distanceKm = await getRoadDistanceKm(
      restaurantPoint.lat,
      restaurantPoint.lng,
      userPoint.lat,
      userPoint.lng,
    )
    if (!cancelled && Number.isFinite(distanceKm)) {
      setRoadDistanceKm(distanceKm)
    }
  }

  if (restaurantData && defaultAddress && hasSavedAddress && !isQuickCart && !(hasQuickItems && hasFoodItems)) {
    fetchRoadDistance()
  } else if (!cancelled) {
    setRoadDistanceKm(null)
  }

  return () => {
    cancelled = true
  }
}, [restaurantData, defaultAddress, hasSavedAddress, isQuickCart, hasQuickItems, hasFoodItems])

// Prefer backend calculateOrder pricing; feeSettings is display fallback only
const subtotal = pricing?.subtotal || cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
const resolvedDistanceKm =
  pricing?.deliveryFeeBreakdown?.distanceKm ??
  pricing?.deliveryDistanceKm ??
  roadDistanceKm
const fallbackDeliveryFee = (() => {
  if (appliedCoupon?.freeDelivery) {
    return 0
  }

  return resolveFallbackDeliveryFee({
    feeSettings,
    distanceKm: resolvedDistanceKm,
  })
})()
const baseComputedDeliveryFee =
  pricing?.deliveryFee !== undefined && pricing?.deliveryFee !== null
    ? Number(pricing.deliveryFee || 0)
    : fallbackDeliveryFee
const deliveryFee = baseComputedDeliveryFee
const quickDeliveryFee = Number(pricing?.quickDeliveryFee || 0) || 0
const quickEtaLabel = formatQuickEtaWindow(pricing?.etaPromise || pricing?.quickDelivery?.etaPromise)
const gates = pricing?.quickDelivery?.gates
const quickGatesOpen = pricing?.quickDelivery?.eligible === true
// Hide option entirely when Instant + Schedule off and we know all three gates are closed.
const showQuickOption =
  !isScheduled &&
  (pricing?.quickDelivery == null ||
    quickGatesOpen ||
    deliveryType === "quick" ||
    gates?.globalEnabled ||
    gates?.restaurantEnabled ||
    gates?.zoneEnabled)
const hasDistanceDeliveryBreakdown = Number.isFinite(Number(resolvedDistanceKm))
const deliveryFeeBreakdownText = hasDistanceDeliveryBreakdown
  ? `${Number(resolvedDistanceKm).toFixed(1)} km delivery`
  : null
const platformFee = pricing?.platformFee ?? Number(feeSettings.platformFee || 0)
const packagingFee = pricing?.packagingFee ?? Number(feeSettings.packagingFee || 0)
const gstCharges = pricing?.tax ?? Math.round(subtotal * (Number(feeSettings.gstRate || 0) / 100))
// Never invent coupon caps — wait for server pricing for actual discount.
const discount = pricing?.discount ?? 0
const totalBeforeDiscount =
  subtotal + deliveryFee + platformFee + packagingFee + gstCharges + quickDeliveryFee
const total = pricing?.total ?? (totalBeforeDiscount - discount)

// Calculate other platform total for comparison
const otherPlatformSubtotal = cart.reduce((sum, item) => {
  const itemOtherPrice = item.otherPrice || item.price || 0;
  return sum + (itemOtherPrice * (item.quantity || 1));
}, 0);

const otherPlatformSavings = Math.max(0, otherPlatformSubtotal - subtotal);

const savings = pricing?.savings ?? Math.max(0, totalBeforeDiscount - total)
const isUserCodAllowed = userProfile?.isCodAllowed !== false
const codOrderLimit = Number(pricing?.codOrderLimit || 0)
const hasCodOrderLimit = Number.isFinite(codOrderLimit) && codOrderLimit > 0
const isCodBlockedByOrderValue = hasCodOrderLimit && Number(total || 0) > codOrderLimit
const codBlockedMessage = isCodBlockedByOrderValue
  ? `Cash on Delivery available up to ${RUPEE_SYMBOL}${Math.round(codOrderLimit)} only`
  : ""
const paymentOptions = [
  {
    id: 'razorpay',
    name: 'Online Payment',
    description: 'UPI, Cards, Netbanking',
    icon: <Zap className="w-5 h-5" />,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    selectedColor: 'bg-emerald-500 text-white',
    badge: 'SECURE'
  },
  {
    id: 'wallet',
    name: 'Quick Wallet',
    description: 'Pay from your wallet',
    icon: <Wallet className="w-5 h-5" />,
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    selectedColor: 'bg-blue-500 text-white',
    subInfo: `Bal: ${RUPEE_SYMBOL}${walletBalance.toFixed(0)}`,
    disabled: walletBalance < total,
    disabledText: 'Low Balance'
  },
  ...(isUserCodAllowed && !isCodBlockedByOrderValue
    ? [{
      id: 'cash',
      name: 'Cash on Delivery',
      description: 'Pay when order arrives',
      icon: <Banknote className="w-5 h-5" />,
      color: 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400',
      selectedColor: 'bg-red-500 text-white'
    }]
    : [])
]
const selectedPaymentLabel =
  selectedPaymentMethod === "wallet"
    ? "Wallet"
    : selectedPaymentMethod === "razorpay"
      ? "Online Payment"
      : "Cash on Delivery"

useEffect(() => {
  const hasSelectedPayment = paymentOptions.some((option) => option.id === selectedPaymentMethod)
  if (!hasSelectedPayment && paymentOptions.length > 0) {
    setSelectedPaymentMethod(paymentOptions[0].id)
  }
}, [paymentOptions, selectedPaymentMethod])

// Restaurant name from data or cart
const restaurantName = restaurantData?.name || cart[0]?.restaurant || "Restaurant"

const handleShare = async () => {
  const restaurantNameStr = restaurantName || companyName || "this restaurant"
  const shareUrl = window.location.href
  const shareText = `Check out what I'm ordering from ${restaurantNameStr}! ${shareUrl}`

  const payload = {
    title: `My Cart at ${restaurantNameStr}`,
    text: shareText,
    url: shareUrl,
  }

  if (isMobileDevice()) {
    openShareModal(payload)
    return
  }

  const shared = await tryNativeShare(payload)
  if (shared) {
    toast.success("Link shared successfully")
    return
  }

  openShareModal(payload)
}

const openShareModal = (payload) => {
  setSharePayload(payload)
  setShowShareModal(true)
}

const tryNativeShare = async (payload) => {
  if (typeof navigator === "undefined" || !navigator.share) return false
  try {
    await navigator.share(payload)
    return true
  } catch (error) {
    if (error?.name === "AbortError") return true
    return false
  }
}

const isMobileDevice = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false
  const mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Opera Mini|IEMobile/i.test(navigator.userAgent)
  const smallViewport = window.matchMedia?.("(max-width: 768px)")?.matches
  return Boolean(mobileUA || smallViewport)
}

const openShareTarget = (target) => {
  if (!sharePayload?.url) return

  const text = sharePayload.text || ""
  const url = sharePayload.url
  const encodedText = encodeURIComponent(text)
  const encodedUrl = encodeURIComponent(url)

  let shareLink = ""

  if (target === "whatsapp") {
    shareLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
  } else if (target === "telegram") {
    shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
  } else if (target === "email") {
    shareLink = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
  }

  if (shareLink) {
    window.open(shareLink, "_blank", "noopener,noreferrer")
    setShowShareModal(false)
  }
}

const copyShareLink = async () => {
  if (!sharePayload?.url) return
  await copyToClipboard(sharePayload.url)
  setShowShareModal(false)
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Link copied to clipboard!")
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.opacity = "0"
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand("copy")
      toast.success("Link copied to clipboard!")
    } catch (err) {
      toast.error("Failed to copy link")
    }
    document.body.removeChild(textArea)
  }
}

const handleSystemShareFromModal = async () => {
  if (!sharePayload) return
  const shared = await tryNativeShare(sharePayload)
  if (shared) {
    setShowShareModal(false)
    toast.success("Shared successfully")
  }
}

const handleBack = () => {
  // Priority: slug > restaurantId (both work for the restaurant details route)
  const idOrSlug = restaurantData?.slug || restaurantId
  if (idOrSlug) {
    navigate(`/food/user/restaurants/${idOrSlug}`)
  } else {
    goBack()
  }
}

// Handler to select address by label (Home, Office, Other)
const handleSelectAddressByLabel = async (label) => {
  try {
    // Find address with matching label
    const targetLabel = normalizeAddressLabel(label)
    const address = addresses.find(addr => normalizeAddressLabel(addr.label) === targetLabel)

    if (!address) {
      toast.error(`No ${label} address found. Please add an address first.`)
      return
    }

    await handleSelectSavedAddress(address)
  } catch (error) {
    debugError(`Error selecting ${label} address:`, error)
    toast.error(`Failed to select ${label} address. Please try again.`)
  }
}

const handleSelectSavedAddress = async (address) => {
  try {
    const addressId = getAddressId(address)
    if (addressId) {
      setActiveAddressId(addressId)
      await setDefaultAddress(addressId)
    }

    // Get coordinates from address location
    const coordinates = address.location?.coordinates || []
    const longitude = coordinates[0]
    const latitude = coordinates[1]

    if (!latitude || !longitude) {
      toast.error(`Invalid coordinates for ${address.label || "saved"} address`)
      return
    }

    // Legacy userAPI.updateLocation is currently a client-only no-op.
    // Keep checkout flow deterministic by using saved address + local cache as source of truth.
    try {
      await userAPI.updateLocation({
        latitude,
        longitude,
        address: `${address.street}, ${address.city}`,
        city: address.city,
        state: address.state,
        area: address.additionalDetails || "",
        formattedAddress: address.additionalDetails
          ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
          : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
      })
    } catch {
      // best effort only; do not block address selection
    }

    // Update the location in localStorage
    const locationData = {
      city: address.city,
      state: address.state,
      address: `${address.street}, ${address.city}`,
      area: address.additionalDetails || "",
      zipCode: address.zipCode,
      latitude,
      longitude,
      formattedAddress: address.additionalDetails
        ? `${address.additionalDetails}, ${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
        : `${address.street}, ${address.city}, ${address.state}${address.zipCode ? ` ${address.zipCode}` : ''}`
    }
    localStorage.setItem("userLocation", JSON.stringify(locationData))
    // User selected a saved address from Cart

    toast.success(`${address.label || "Saved"} address selected!`)
  } catch (error) {
    debugError("Error selecting saved address:", error)
    toast.error("Failed to select address. Please try again.")
  }
}

const isFirstTimeOnlyCoupon = (coupon) =>
  coupon?.customerGroup === "first-time" ||
  coupon?.customerGroup === "new" ||
  coupon?.customerScope === "first-time" ||
  coupon?.isFirstOrderOnly === true

const handleApplyCoupon = async (coupon) => {
  if (coupon?.meetsMinOrder === false) {
    toast.error(`Add items worth ${RUPEE_SYMBOL}${Number(coupon.amountToUnlock || 0)} to apply this coupon`)
    return
  }

  if (subtotal < (Number(coupon.minOrder) || 0)) {
    toast.error(`Min order ${RUPEE_SYMBOL}${Number(coupon.minOrder || 0)}`)
    return
  }

  // Validate with backend first; only set applied if backend accepts
  if (cart.length > 0 && hasSavedAddress) {
    try {
      const result = await runSequencedFoodCalculate(
        { couponCodeOverride: coupon.code },
        { apply: false },
      )
      if (result.stale) return

      if (!result.pricing?.appliedCoupon) {
        toast.error(
          isFirstTimeOnlyCoupon(coupon)
            ? "This coupon is only for first-time users"
            : "Coupon not applicable",
        )
        // Restore sequenced pricing without the rejected coupon code
        await runSequencedFoodCalculate({ couponCodeOverride: appliedCoupon?.code || couponCode || null })
        return
      }

      applyCartPricingResult({
        result,
        setPricing,
        setDeliveryType,
        setQuickFallbackNotice,
        onSoftFallback: () => {
          suppressPricingRecalcRef.current = true
        },
      })
      // Pricing already applied — suppress the effect that would re-fire on coupon state.
      suppressPricingRecalcRef.current = true
      setAppliedCoupon(coupon)
      setCouponCode(coupon.code)
      setManualCouponCode(coupon.code)
      setShowCoupons(false)
    } catch (error) {
      debugError("Error recalculating pricing:", error)
      toast.error("Failed to apply coupon")
    }
  }
}

const handleApplyCouponCode = async () => {
  const inputCode = manualCouponCode.trim().toUpperCase()
  if (!inputCode) {
    toast.error("Enter coupon code")
    return
  }

  if (cart.length === 0 || !hasSavedAddress) {
    toast.error("Add items and delivery address first")
    return
  }

  const matchedCoupon = availableCoupons.find(
    (coupon) => String(coupon.code || "").toUpperCase() === inputCode,
  )

  try {
    const result = await runSequencedFoodCalculate(
      { couponCodeOverride: inputCode },
      { apply: false },
    )
    if (result.stale) return

    if (!result.pricing) {
      toast.error("Unable to validate coupon")
      await runSequencedFoodCalculate({
        couponCodeOverride: appliedCoupon?.code || couponCode || null,
      })
      return
    }

    if (!result.pricing.appliedCoupon) {
      toast.error(
        isFirstTimeOnlyCoupon(matchedCoupon)
          ? "This coupon is only for first-time users"
          : "Invalid or unavailable coupon code",
      )
      setCouponCode("")
      await runSequencedFoodCalculate({
        couponCodeOverride: appliedCoupon?.code || null,
      })
      return
    }

    applyCartPricingResult({
      result,
      setPricing,
      setDeliveryType,
      setQuickFallbackNotice,
      onSoftFallback: () => {
        suppressPricingRecalcRef.current = true
      },
    })
    suppressPricingRecalcRef.current = true
    setCouponCode(inputCode)
    setAppliedCoupon(
      matchedCoupon || {
        code: inputCode,
        discount: result.pricing.appliedCoupon.discount || 0,
        minOrder: 0,
        customerGroup: "all",
      },
    )
    setShowCoupons(false)
    toast.success("Coupon applied")
  } catch (error) {
    debugError("Error applying coupon code:", error)
    toast.error("Failed to apply coupon")
  }
}


const handleRemoveCoupon = async () => {
  // Handler recalculates — suppress the effect that would fire on coupon clear.
  suppressPricingRecalcRef.current = true
  setAppliedCoupon(null)
  setCouponCode("")
  setManualCouponCode("")

  // Recalculate pricing without coupon (same sequencer as main effect)
  if (cart.length > 0 && hasSavedAddress) {
    try {
      await runSequencedFoodCalculate({ couponCodeOverride: null })
    } catch (error) {
      debugError("Error recalculating pricing:", error)
    }
  }
}


const handlePlaceOrder = async () => {
  // Check authentication first
  const isAuthenticated = !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken');
  if (!isAuthenticated) {
    toast.error("Please login to place an order");
    navigate('/user/auth/login?redirect=/cart');
    return;
  }

  if (!hasSavedAddress) {
    toast.error("Please choose a delivery location to continue")
    openLocationSelector()
    return
  }

  if (isScheduled) {
    if (!scheduledDate || !scheduledTime) {
      toast.error("Please select both date and time to schedule your order")
      return
    }
    const scheduleString = `${scheduledDate}T${scheduledTime}:00`
    const scheduleDateObj = new Date(scheduleString)
    if (scheduleDateObj < new Date()) {
      toast.error("Scheduled time must be in the future")
      return
    }
  }

  if (cart.length === 0) {
    alert("Your cart is empty")
    return
  }

  const finalRecipientName = String(recipientName || "").trim()
  const finalRecipientPhone = sanitizeRecipientPhone(recipientPhone || "")
  if (!RECIPIENT_NAME_RE.test(finalRecipientName)) {
    toast.error("Recipient name should contain only letters and spaces")
    return
  }
  if (finalRecipientPhone.length !== 10) {
    toast.error("Recipient phone number must be exactly 10 digits")
    return
  }

  setIsPlacingOrder(true)

  // Use API_BASE_URL from config (supports both dev and production)

  try {
    debugLog("?? Starting order placement process...")
    debugLog("?? Cart items:", cart.map(item => ({ id: item.id, name: item.name, quantity: item.quantity, price: item.price })))
    debugLog("?? Applied coupon:", appliedCoupon?.code || "None")
    debugLog("?? Delivery address:", defaultAddress?.label || defaultAddress?.city)

    // Always recalculate with backend before placing order so payment matches cart.
    let resolvedPricing = pricing
    let placeOrderDeliveryType = deliveryType
    try {
      const result = await runSequencedFoodCalculate({}, { force: true })
      if (!result.stale && result.pricing) {
        resolvedPricing = result.pricing
        if (result.softFallback) {
          placeOrderDeliveryType = "standard"
        }
      }
    } catch (pricingError) {
      debugWarn("Could not refresh pricing before order placement:", pricingError)
      toast.error(
        pricingError?.response?.data?.message ||
        "Could not refresh pricing. Please try again.",
      )
      setIsPlacingOrder(false)
      return
    }

    if (!resolvedPricing || !Number.isFinite(Number(resolvedPricing.total))) {
      toast.error("Pricing unavailable. Please try again.")
      setIsPlacingOrder(false)
      return
    }

    // Server pricing only — never fall back to client-calculated totals.
    const orderPricing = {
      ...resolvedPricing,
      couponCode:
        resolvedPricing.couponCode ||
        appliedCoupon?.code ||
        couponCode ||
        null,
    }

    // Include all cart items (main items + addons)
    // Note: Addons are added as separate cart items when user clicks the + button
    const orderRestaurantId =
      restaurantData?.restaurantId || restaurantData?._id || restaurantId || ""
    const orderItems = cart.map((item) => mapOrderItem(item, orderRestaurantId))

    debugLog("?? Order items to send:", orderItems)
    debugLog("?? Order pricing:", orderPricing)

    // Check API base URL before making request (for debugging)
    const fullUrl = `${API_BASE_URL}${API_ENDPOINTS.ORDER.CREATE}`;
    debugLog("?? Making request to:", fullUrl)
    debugLog("?? Authentication token present:", !!localStorage.getItem('accessToken') || !!localStorage.getItem('user_accessToken'))

    // CRITICAL: Validate restaurant ID before placing order
    // Ensure we're using the correct restaurant from restaurantData (most reliable)
    const finalRestaurantId = restaurantData?.restaurantId || restaurantData?._id || null;
    const finalRestaurantName = restaurantData?.name || null;

    if (!finalRestaurantId) {
      debugError('? CRITICAL: Cannot place order - Restaurant ID is missing!');
      debugError('?? Debug info:', {
        restaurantData: restaurantData ? {
          _id: restaurantData._id,
          restaurantId: restaurantData.restaurantId,
          name: restaurantData.name
        } : 'Not loaded',
        cartRestaurantId: restaurantId,
        cartRestaurantName: cart[0]?.restaurant,
        cartItems: cart.map(item => ({
          id: item.id,
          name: item.name,
          restaurant: item.restaurant,
          restaurantId: item.restaurantId
        }))
      });
      alert('Error: Restaurant information is missing. Please refresh the page and try again.');
      setIsPlacingOrder(false);
      return;
    }

    // CRITICAL: Validate that ALL cart items belong to the SAME restaurant
    const cartRestaurantIds = cart
      .map(item => item.restaurantId)
      .filter(Boolean)
      .map(id => String(id).trim()); // Normalize to string and trim

    const cartRestaurantNames = cart
      .map(item => item.restaurant)
      .filter(Boolean)
      .map(name => name.trim().toLowerCase()); // Normalize names

    // Get unique values (after normalization)
    const uniqueRestaurantIds = [...new Set(cartRestaurantIds)];
    const uniqueRestaurantNames = [...new Set(cartRestaurantNames)];

    // Check if cart has items from multiple restaurants
    // Note: If restaurant names match, allow even if IDs differ (same restaurant, different ID format)
    if (uniqueRestaurantNames.length > 1) {
      // Different restaurant names = definitely different restaurants
      debugError('? CRITICAL ERROR: Cart contains items from multiple restaurants!', {
        restaurantIds: uniqueRestaurantIds,
        restaurantNames: uniqueRestaurantNames,
        cartItems: cart.map(item => ({
          id: item.id,
          name: item.name,
          restaurant: item.restaurant,
          restaurantId: item.restaurantId
        }))
      });

      // Automatically clean cart to keep items from the restaurant matching restaurantData
      if (finalRestaurantId && finalRestaurantName) {
        debugLog('?? Auto-cleaning cart to keep items from:', finalRestaurantName);
        cleanCartForRestaurant(finalRestaurantId, finalRestaurantName);
        toast.error('Cart contained items from different restaurants. Items from other restaurants have been removed.');
      } else {
        // If restaurantData is not available, keep items from first restaurant in cart
        const firstRestaurantId = cart[0]?.restaurantId;
        const firstRestaurantName = cart[0]?.restaurant;
        if (firstRestaurantId && firstRestaurantName) {
          debugLog('?? Auto-cleaning cart to keep items from first restaurant:', firstRestaurantName);
          cleanCartForRestaurant(firstRestaurantId, firstRestaurantName);
          toast.error('Cart contained items from different restaurants. Items from other restaurants have been removed.');
        } else {
          toast.error('Cart contains items from different restaurants. Please clear cart and try again.');
        }
      }

      setIsPlacingOrder(false);
      return;
    }

    // If restaurant names match but IDs differ, that's OK (same restaurant, different ID format)
    // But log a warning in development
    if (uniqueRestaurantIds.length > 1 && uniqueRestaurantNames.length === 1) {
      if (process.env.NODE_ENV === 'development') {
        debugWarn('?? Cart items have different restaurant IDs but same name. This is OK if IDs are in different formats.', {
          restaurantIds: uniqueRestaurantIds,
          restaurantName: uniqueRestaurantNames[0]
        });
      }
    }

    // Validate that cart items' restaurantId matches the restaurantData
    if (cartRestaurantIds.length > 0) {
      const cartRestaurantId = cartRestaurantIds[0];

      // Check if cart restaurantId matches restaurantData
      const restaurantIdMatches =
        cartRestaurantId === finalRestaurantId ||
        cartRestaurantId === restaurantData?._id?.toString() ||
        cartRestaurantId === restaurantData?.restaurantId;

      if (!restaurantIdMatches) {
        debugError('? CRITICAL ERROR: Cart restaurantId does not match restaurantData!', {
          cartRestaurantId: cartRestaurantId,
          finalRestaurantId: finalRestaurantId,
          restaurantDataId: restaurantData?._id?.toString(),
          restaurantDataRestaurantId: restaurantData?.restaurantId,
          restaurantDataName: restaurantData?.name,
          cartRestaurantName: cartRestaurantNames[0]
        });
        alert(`Error: Cart items belong to "${cartRestaurantNames[0] || 'Unknown Restaurant'}" but restaurant data doesn't match. Please refresh the page and try again.`);
        setIsPlacingOrder(false);
        return;
      }
    }

    // Validate restaurant name matches
    if (cartRestaurantNames.length > 0 && finalRestaurantName) {
      const cartRestaurantName = cartRestaurantNames[0];
      if (cartRestaurantName.toLowerCase().trim() !== finalRestaurantName.toLowerCase().trim()) {
        debugError('? CRITICAL ERROR: Restaurant name mismatch!', {
          cartRestaurantName: cartRestaurantName,
          finalRestaurantName: finalRestaurantName
        });
        alert(`Error: Cart items belong to "${cartRestaurantName}" but restaurant data shows "${finalRestaurantName}". Please refresh the page and try again.`);
        setIsPlacingOrder(false);
        return;
      }
    }

    // Log order details for debugging
    debugLog('? Order validation passed - Placing order with restaurant:', {
      restaurantId: finalRestaurantId,
      restaurantName: finalRestaurantName,
      restaurantDataId: restaurantData?._id,
      restaurantDataRestaurantId: restaurantData?.restaurantId,
      cartRestaurantId: cartRestaurantIds[0],
      cartRestaurantName: cartRestaurantNames[0],
      cartItemCount: cart.length
    });

    // FINAL VALIDATION: Double-check restaurantId before sending to backend
    const cartRestaurantId = cart[0]?.restaurantId;
    if (cartRestaurantId && cartRestaurantId !== finalRestaurantId &&
      cartRestaurantId !== restaurantData?._id?.toString() &&
      cartRestaurantId !== restaurantData?.restaurantId) {
      debugError('? CRITICAL: Final validation failed - restaurantId mismatch!', {
        cartRestaurantId: cartRestaurantId,
        finalRestaurantId: finalRestaurantId,
        restaurantDataId: restaurantData?._id?.toString(),
        restaurantDataRestaurantId: restaurantData?.restaurantId,
        cartRestaurantName: cart[0]?.restaurant,
        finalRestaurantName: finalRestaurantName
      });
      alert('Error: Restaurant information mismatch detected. Please refresh the page and try again.');
      setIsPlacingOrder(false);
      return;
    }

    const normalizedAddress = normalizeOrderAddress(defaultAddress, {
      recipientName,
      recipientPhone: recipientPhone || defaultAddress?.phone || "",
    })

    const orderPayload = {
      items: orderItems,
      address: normalizedAddress,
      deliveryAddressId: resolvedDeliveryAddressId,
      customerName: recipientName,
      customerPhone: normalizedAddress?.phone || "",
      restaurantId: finalRestaurantId,
      restaurantName: finalRestaurantName || undefined,
      pricing: orderPricing,
      couponCode: orderPricing.couponCode || appliedCoupon?.code || couponCode || undefined,
      note: note || "",
      restaurantNote: restaurantNote || "",
      sendCutlery: sendCutlery !== false,
      paymentMethod: selectedPaymentMethod,
      // `useZone()` can return `null`. Zod expects string/undefined, not null.
      zoneId: zoneId || undefined,
      scheduledAt: isScheduled
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : undefined,
      deliveryMode:
        !isScheduled && placeOrderDeliveryType === "quick" ? "quick" : "basic",
    };
    // Log final order details (including paymentMethod for COD debugging)
    debugLog('?? FINAL: Sending order to backend with:', {
      restaurantId: finalRestaurantId,
      restaurantName: finalRestaurantName,
      itemCount: orderItems.length,
      totalAmount: orderPricing.total,
      paymentMethod: orderPayload.paymentMethod
    });

    if (!isUserCodAllowed && selectedPaymentMethod === "cash") {
      toast.error("Cash on delivery is not available for your account")
      setIsPlacingOrder(false)
      return
    }

    if (selectedPaymentMethod === "cash" && isCodBlockedByOrderValue) {
      toast.error(codBlockedMessage || "Cash on delivery is not available for this order amount")
      setIsPlacingOrder(false)
      return
    }

    if (selectedPaymentMethod === "wallet" && walletBalance < total) {
      toast.error(`Insufficient wallet balance. Required: ${RUPEE_SYMBOL}${total.toFixed(0)}, Available: ${RUPEE_SYMBOL}${walletBalance.toFixed(0)}`)
      setIsPlacingOrder(false)
      return
    }

    // Create order in backend
    const orderResponse = await orderAPI.createOrder(orderPayload)

    debugLog("? Order created successfully:", orderResponse.data)

    const { order, razorpay, quickDeliveryFallback } = orderResponse.data.data || {}

    if (quickDeliveryFallback || (orderPayload.deliveryMode === "quick" && order?.deliveryMode !== "quick")) {
      setDeliveryType("standard")
      const fallbackReason =
        quickDeliveryFallback?.reason ||
        order?.pricing?.quickDelivery?.reason ||
        ""
      showQuickDeliveryUnavailableToast(
        fallbackReason ||
        "Quick Delivery unavailable — order placed as Basic",
      )
      setQuickFallbackNotice(
        mapQuickDeliveryReason(fallbackReason) ||
        "Quick Delivery unavailable — order placed as Basic",
      )
    } else if (order?.deliveryMode === "quick") {
      clearQuickDeliveryToast()
      setQuickFallbackNotice(null)
    }

    // Cash flow: order placed without online payment
    if (selectedPaymentMethod === "cash") {
      toast.success(
        order?.deliveryMode === "quick"
          ? "Quick Delivery order placed (Cash on Delivery)"
          : "Order placed with Cash on Delivery"
      )
      setPlacedOrderId(order?._id || order?.orderId || order?.id || null)
      setPlacedOrderData(order || null)
      setShowOrderSuccess(true)
      window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
      clearCart()
      setNote("")
      setShowNoteInput(false)
      try {
        window.localStorage.removeItem(CART_ORDER_NOTE_STORAGE_KEY)
      } catch {
        // ignore
      }
      setIsPlacingOrder(false)
      return
    }

    // Wallet flow: order placed with wallet payment (already processed in backend)
    if (selectedPaymentMethod === "wallet") {
      toast.success("Order placed with Wallet payment")
      setPlacedOrderId(order?._id || order?.orderId || order?.id || null)
      setPlacedOrderData(order || null)
      setShowOrderSuccess(true)
      window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
      clearCart()
      setNote("")
      setShowNoteInput(false)
      try {
        window.localStorage.removeItem(CART_ORDER_NOTE_STORAGE_KEY)
      } catch {
        // ignore
      }
      setIsPlacingOrder(false)
      // Refresh wallet balance
      try {
        const walletResponse = await userAPI.getWallet()
        if (walletResponse?.data?.success && walletResponse?.data?.data?.wallet) {
          setWalletBalance(walletResponse.data.data.wallet.balance || 0)
        }
      } catch (error) {
        debugError("Error refreshing wallet balance:", error)
      }
      return
    }

    if (!razorpay || !razorpay.orderId || !razorpay.key) {
      debugError("? Razorpay initialization failed:", { razorpay, order })
      throw new Error(razorpay ? "Razorpay payment gateway is not configured. Please contact support." : "Failed to initialize payment")
    }

    debugLog("?? Razorpay order created:", {
      orderId: razorpay.orderId,
      amount: razorpay.amount,
      currency: razorpay.currency,
      keyPresent: !!razorpay.key
    })

    // Get user info for Razorpay prefill
    const userInfo = userProfile || {}
    const userPhone = recipientPhone || userInfo.phone || defaultAddress?.phone || ""
    const userEmail = userInfo.email || ""
    const userName = recipientName || userInfo.name || ""

    // Format phone number (remove non-digits, take last 10 digits)
    const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)

    debugLog("?? User info for payment:", {
      name: userName,
      email: userEmail,
      phone: formattedPhone
    })

    // Get company name for Razorpay
    const companyName = await getCompanyNameAsync()

    // ─── Payment: Flutter WebView → native Razorpay, Web → JS checkout ───
    if (isFlutterWebView()) {
      // Native Flutter Razorpay SDK via JS bridge
      setIsPlacingOrder(true)
      try {
        const flutterResult = await handleFlutterRazorpayPayment({
          key: razorpay.key,
          order_id: razorpay.orderId,
          amount: razorpay.amount, // already in paise
          currency: razorpay.currency || 'INR',
          name: companyName,
          description: `Order ${order._id || order.orderId} - ${RUPEE_SYMBOL}${(razorpay.amount / 100).toFixed(2)}`,
          prefill: { name: userName, email: userEmail, contact: formattedPhone },
          notes: {
            orderId: order._id || order.orderId,
            userId: userInfo.id || '',
            restaurantId: restaurantId || 'unknown',
          },
        })

        // Verify payment with backend (same as web flow)
        const verifyOrderId = order?._id || order?.id || order?.orderMongoId
        if (!verifyOrderId) throw new Error('Unable to verify payment: missing order id')
        const verifyResponse = await orderAPI.verifyPayment({
          orderId: verifyOrderId,
          razorpayOrderId: flutterResult.razorpay_order_id,
          razorpayPaymentId: flutterResult.razorpay_payment_id,
          razorpaySignature: flutterResult.razorpay_signature,
        })

        if (verifyResponse.data.success) {
          setPlacedOrderId(order._id || order.orderId)
          setPlacedOrderData(order || null)
          setShowOrderSuccess(true)
          window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
          clearCart()
        } else {
          throw new Error(verifyResponse.data.message || 'Payment verification failed')
        }
      } catch (payErr) {
        const msg = payErr?.message || 'Payment failed or cancelled'
        if (!/cancel/i.test(msg)) {
          // Cancel order in backend if payment failed (not just cancelled)
          try {
            const cancelId = order?._id || order?.id || order?.orderMongoId
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, { reason: 'Payment Failed', note: msg })
            }
          } catch { /* ignore cancel error */ }
          alert(msg)
        }
      } finally {
        setIsPlacingOrder(false)
      }
    } else {
      // Standard web Razorpay checkout modal (unchanged)
      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount, // Already in paise from backend
        currency: razorpay.currency || 'INR',
        order_id: razorpay.orderId,
        name: companyName,
        description: `Order ${order._id || order.orderId} - ${RUPEE_SYMBOL}${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone
        },
        notes: {
          orderId: order._id || order.orderId,
          userId: userInfo.id || "",
          restaurantId: restaurantId || "unknown"
        },
        handler: async (response) => {
          try {
            debugLog("? Payment successful, verifying...", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id
            })

            // Verify payment with backend
            const verifyOrderId = order?._id || order?.id || order?.orderMongoId
            if (!verifyOrderId) {
              throw new Error("Unable to verify payment: missing order id from create-order response")
            }
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: verifyOrderId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            })

            debugLog("? Payment verification response:", verifyResponse.data)

            if (verifyResponse.data.success) {
              debugLog("?? Order placed successfully:", {
                orderId: order._id || order.orderId,
                paymentId: verifyResponse.data.data?.payment?.paymentId
              })
              setPlacedOrderId(order._id || order.orderId)
              setPlacedOrderData(order || null)
              setShowOrderSuccess(true)
              window.dispatchEvent(new CustomEvent('order-placed', { detail: { order } }))
              clearCart()
              setIsPlacingOrder(false)
            } else {
              throw new Error(verifyResponse.data.message || "Payment verification failed")
            }
          } catch (error) {
            debugError("? Payment verification error:", error)
            const errorMessage =
              error?.response?.data?.message ||
              error?.response?.data?.error?.message ||
              error?.response?.data?.errors?.[0]?.message ||
              error?.message ||
              "Payment verification failed. Please contact support."
            alert(errorMessage)
            setIsPlacingOrder(false)
          }
        },
        onError: async (error) => {
          debugError("? Razorpay payment error:", error)
          // Clean up the pending order in backend if payment failed
          try {
            const cancelId = order?._id || order?.id || order?.orderMongoId
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, {
                reason: "Payment Failed",
                note: error?.description || error?.message || "Online payment failed"
              })
            }
          } catch (cancelErr) {
            debugError("? Failed to auto-cancel order after payment error:", cancelErr)
          }

          // Don't show alert for user cancellation
          if (error?.code !== 'PAYMENT_CANCELLED' && error?.message !== 'PAYMENT_CANCELLED') {
            const errorMessage = error?.description || error?.message || "Payment failed. Please try again."
            alert(errorMessage)
          }
          setIsPlacingOrder(false)
        },
        onClose: async () => {
          debugLog("?? Payment modal closed by user")
          // Clean up the pending order in backend if user closed the modal without paying
          try {
            const cancelId = order?._id || order?.id || order?.orderMongoId
            if (cancelId) {
              await orderAPI.cancelOrder(cancelId, {
                reason: "Payment Cancelled",
                note: "User closed payment modal"
              })
            }
          } catch (cancelErr) {
            debugError("? Failed to auto-cancel order after modal close:", cancelErr)
          }
          setIsPlacingOrder(false)
        }
      })
    }
  } catch (error) {
    debugError("? Order creation error:", error)

    let errorMessage = "Failed to create order. Please try again."

    // Handle network errors
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      const backendUrl = API_BASE_URL.replace('/api', '');
      errorMessage = `Network Error: Cannot connect to backend server.\n\n` +
        `Expected backend URL: ${backendUrl}\n\n` +
        `Please check:\n` +
        `1. Backend server is running\n` +
        `2. Backend is accessible at ${backendUrl}\n` +
        `3. Check browser console (F12) for more details\n\n` +
        `If backend is not running, start it with:\n` +
        `cd appzetofood/backend && npm start`

      debugError("?? Network Error Details:", {
        code: error.code,
        message: error.message,
        config: {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullUrl: error.config?.baseURL + error.config?.url,
          method: error.config?.method
        },
        backendUrl: backendUrl,
        apiBaseUrl: API_BASE_URL
      })

      // Backend disconnected - no health check (new backend in progress)
    }
    // Handle timeout errors
    else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMessage = "Request timed out. The server is taking too long to respond. Please try again."
    }
    // Handle other axios errors
    else if (error.response) {
      // Server responded with error status
      errorMessage = error.response.data?.message || `Server error: ${error.response.status}`
    }
    // Handle other errors
    else if (error.message) {
      errorMessage = error.message
    }

    alert(errorMessage)
    setIsPlacingOrder(false)
  }
}

const handleGoToOrders = () => {
  setShowOrderSuccess(false)
  navigate(`/user/orders/${placedOrderId}?confirmed=true`, {
    state: placedOrderData ? { prefetchedOrder: placedOrderData } : undefined,
  })
}

const isCartContextMissing = !cartContext || Object.keys(cartContext).length === 0;
if (isCartContextMissing) {
  debugError('? CartProvider not found. Make sure Cart component is rendered within UserLayout.');
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Cart Error</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Cart functionality is not available. Please refresh the page.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}

if (hasQuickItems && hasFoodItems) {
  return (
    <MixedSharedCart
      initialAddress={defaultAddress}
      addressMode={activeAddress?.type === "current" ? "current" : "saved"}
    />
  )
}

if (isQuickCart) {
  return (
    <QuickSharedCart
      initialAddress={defaultAddress}
      addressMode={activeAddress?.type === "current" ? "current" : "saved"}
    />
  )
}

// Empty cart state - but don't show if order success or placing order modal is active
if (cart.length === 0 && !showOrderSuccess && !showPlacingOrder) {
  return (
    <AnimatedPage className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-gray-800 dark:text-white">Cart</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Utensils className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Your cart is empty</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Add items from a restaurant to start a new order</p>
        <Link to="/user">
          <Button className="bg-primary-orange hover:opacity-90 text-white">Browse Restaurants</Button>
        </Link>
      </div>
    </AnimatedPage>
  )
}

let calculatedDeliveryTime = restaurantData?.estimatedDeliveryTime || "15-20 mins";
let maxUpperBound = 0;
let maxTimeString = "";

cart.forEach((item) => {
  const timeStr = String(item.preparationTime || "0");
  const matches = timeStr.match(/\d+/g);
  if (matches) {
    const upper = Math.max(...matches.map(Number));
    if (upper > maxUpperBound) {
      maxUpperBound = upper;
      maxTimeString = timeStr;
    }
  }
});

if (maxTimeString && maxUpperBound > 0) {
  calculatedDeliveryTime = maxTimeString.includes("min") ? maxTimeString : `${maxTimeString} mins`;
}

return (
  <div className="relative min-h-screen overflow-x-hidden bg-slate-50 dark:bg-[#0a0a0a]">
    {/* Header - Sticky at top */}
    <div className="bg-white dark:bg-[#1a1a1a] border-b dark:border-gray-800 sticky top-0 z-20 flex-shrink-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">{restaurantName}</p>
              <p className="text-sm md:text-base font-medium text-gray-800 dark:text-white truncate">
                {calculatedDeliveryTime} to <span className="font-semibold">Location</span>
                <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs md:text-sm">{defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || defaultAddress?.city || "Select address") : "Select address"}</span>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0"
            onClick={handleShare}
          >
            <Share2 className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      </div>
    </div>

    {/* Scrollable Content Area */}
    <div className="flex-1 overflow-y-auto overflow-x-hidden pb-48 md:pb-6">
      {/* Offline Banner */}
      {isOffline && (
        <div className="bg-red-500 text-white px-4 py-2 text-center text-sm font-medium z-50 animate-fadeIn">
          You are currently offline. Please check your internet connection.
        </div>
      )}

      {/* Savings Banner */}
      {otherPlatformSavings > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 md:px-6 py-2.5 flex-shrink-0 border-b border-emerald-100 dark:border-emerald-800/30">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">
              You're saving {RUPEE_SYMBOL}{Math.round(otherPlatformSavings)} compared to other platforms!
            </p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
        <div className="max-w-3xl mx-auto">
          {/* Main Cart Content */}
          <div className="space-y-2 md:space-y-4">
            {/* Cart Items */}
            <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 md:py-5 rounded-2xl md:rounded-3xl shadow-sm border border-slate-100 dark:border-gray-800">
              <div className="space-y-3 md:space-y-4">
                {cart.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex min-w-0 items-start gap-2 md:gap-4 cursor-pointer"
                    onClick={() => {
                      let itemWithVariants = item;
                      if (!hasFoodVariants(item) && item.variantId && menuData) {
                        let foundItem = null;
                        const sectionsToSearch = Array.isArray(menuData)
                          ? menuData
                          : menuData.sections
                            ? menuData.sections
                            : menuData.data?.menu?.sections
                              ? menuData.data.menu.sections
                              : [];
                        for (const category of sectionsToSearch) {
                          if (category.items) {
                            foundItem = category.items.find(i => String(i.id) === String(item.itemId) || String(i._id) === String(item.itemId));
                            if (foundItem) break;
                          }
                        }
                        if (foundItem && hasFoodVariants(foundItem)) {
                          itemWithVariants = { ...item, variants: foundItem.variants, variations: foundItem.variations };
                        }
                      }
                      setSelectedProduct(itemWithVariants)
                      setSelectedVariantId(itemWithVariants.variantId || getDefaultFoodVariant(itemWithVariants)?.id || "")
                      setSelectedItemImageIndex(0)
                      setShowItemDetail(true)
                    }}
                  >
                    {/* Veg/Non-veg indicator */}
                    <div className={`w-4 h-4 md:w-5 md:h-5 border-2 ${item.isVeg !== false ? 'border-green-600' : 'border-red-600'} flex items-center justify-center mt-1 flex-shrink-0`}>
                      <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${item.isVeg !== false ? 'bg-green-600' : 'bg-red-600'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200 leading-tight">{item.name}</p>
                      {item.variantName ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.variantName}</p>
                      ) : null}
                    </div>

                    <div 
                      className="flex shrink-0 items-center gap-2 md:gap-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Quantity controls */}
                      <div className="flex items-center bg-white dark:bg-[#222] rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-8">
                        <button
                          className="w-8 h-full flex items-center justify-center text-[#FF0000] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                        <span className="w-6 text-[13px] font-bold text-gray-800 dark:text-gray-200 text-center">
                          {item.quantity}
                        </span>
                        <button
                          className="w-8 h-full flex items-center justify-center text-[#FF0000] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => {
                            let itemWithVariants = item;
                            if (!hasFoodVariants(item) && item.variantId && menuData) {
                              let foundItem = null;

                              // Normalize menuData to array of sections/categories
                              const sectionsToSearch = Array.isArray(menuData)
                                ? menuData
                                : menuData.sections
                                  ? menuData.sections
                                  : menuData.data?.menu?.sections
                                    ? menuData.data.menu.sections
                                    : [];

                              for (const category of sectionsToSearch) {
                                if (category.items) {
                                  foundItem = category.items.find(i => String(i.id) === String(item.itemId) || String(i._id) === String(item.itemId));
                                  if (foundItem) break;
                                }
                              }

                              if (foundItem && hasFoodVariants(foundItem)) {
                                itemWithVariants = { ...item, variants: foundItem.variants, variations: foundItem.variations };
                              }
                            }

                            if (hasFoodVariants(itemWithVariants) || itemWithVariants.variantId) {
                              setSelectedProduct(itemWithVariants)
                              setSelectedVariantId(itemWithVariants.variantId || getDefaultFoodVariant(itemWithVariants)?.id || "")
                              setSelectedItemImageIndex(0)
                              setShowItemDetail(true)
                            } else {
                              updateQuantity(item.id, item.quantity + 1)
                            }
                          }}
                        >
                          <Plus className="h-3 w-3 md:h-4 md:w-4" />
                        </button>
                      </div>

                      <div className="min-w-[50px] md:min-w-[86px] text-right">
                        {Number(item.otherPrice || 0) > Number(item.price || 0) ? (
                          <p className="text-[11px] text-gray-400 line-through">
                            {RUPEE_SYMBOL}{(Number(item.otherPrice || 0) * (item.quantity || 1)).toFixed(0)}
                          </p>
                        ) : null}
                        <p className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">
                          {RUPEE_SYMBOL}{((item.price || 0) * (item.quantity || 1)).toFixed(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add more items */}
              <button
                onClick={handleBack}
                className="flex items-center gap-2 mt-4 md:mt-6 text-[#FF0000] dark:text-[#FF0000]"
              >
                <Plus className="h-4 w-4 md:h-5 md:w-5" />
                <span className="text-sm md:text-base font-medium">Add more items</span>
              </button>
            </div>

            {/* Delivery Time */}
            <div className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-gray-100 bg-white p-4 md:p-6 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
              <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-700 border border-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] md:text-base font-bold text-gray-900 dark:text-white">
                      Delivery in {calculatedDeliveryTime}
                    </p>
                    <p className="text-[13px] md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Standard delivery to your location
                    </p>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isScheduled
                          setIsScheduled(next)
                          if (next) {
                            clearQuickDeliveryToast()
                            setQuickFallbackNotice(null)
                            setDeliveryType("standard")
                          }
                        }}
                        className="text-[13px] font-semibold text-[#FF0000] hover:underline"
                      >
                        {isScheduled ? "Switch to standard delivery" : "Schedule for later"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {isScheduled && (
                <div className="relative mt-5 flex flex-col gap-3 border-t border-red-200/70 pt-4 dark:border-red-900/40 sm:flex-row">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Date (Up to Tomorrow)</label>
                    <input
                      type="date"
                      min={new Date().toLocaleDateString('en-CA')}
                      max={new Date(Date.now() + 86400000).toLocaleDateString('en-CA')}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-xl border border-red-200 bg-white/90 p-2.5 text-sm text-gray-800 focus:outline-none focus:border-[#FF0000] dark:border-red-900/50 dark:bg-[#0f0f0f] dark:text-gray-200"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Time</label>
                    {availableTimeSlots.length > 0 ? (
                      <div className="relative">
                        <select
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="w-full appearance-none rounded-xl border border-red-200 bg-white/90 p-2.5 pr-8 text-sm text-gray-800 focus:outline-none focus:border-[#FF0000] dark:border-red-900/50 dark:bg-[#0f0f0f] dark:text-gray-200"
                        >
                          {availableTimeSlots.map(slot => (
                            <option key={slot.value} value={slot.value}>{slot.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                      </div>
                    ) : (
                      <div className="w-full rounded-xl border border-dashed border-red-200 bg-white/70 p-2.5 text-center text-sm text-gray-500 dark:border-red-900/50 dark:bg-white/5 dark:text-gray-400">
                        {scheduledDate ? "No slots available" : "Select date first"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>


            {/* Note & Cutlery */}
            <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="flex-1 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl text-sm md:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <FileText className="h-4 w-4 md:h-5 md:w-5" />
                <span className="truncate">{note || "Add a note for the delivery partner"}</span>
              </button>
              <button
                onClick={() => setShowRestaurantNoteInput(!showRestaurantNoteInput)}
                className="flex-1 flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl text-sm md:text-base text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <MessageCircle className="h-4 w-4 md:h-5 md:w-5" />
                <span className="truncate">{restaurantNote || "Add a note for the restaurant"}</span>
              </button>
              <button
                onClick={() => setSendCutlery(!sendCutlery)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl text-sm md:text-base ${sendCutlery ? 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300' : 'border-[#FF0000] dark:border-[#FF0000]/50 text-[#FF0000] dark:text-[#FF0000] bg-[#FFF2EB] dark:bg-[#FF0000]/10'}`}
              >
                <Utensils className="h-4 w-4 md:h-5 md:w-5" />
                <span className="whitespace-nowrap">
                  {sendCutlery ? "Send cutlery" : "Don't send cutlery"}
                </span>
              </button>
            </div>

            {/* Note Input */}
            {showNoteInput && (
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl border border-slate-100 dark:border-gray-800">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Delivery instructions
                </p>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Eg. Call when outside, ring bell once, leave at gate"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none focus:border-[#FF0000] dark:focus:border-[#FF0000] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100"
                  maxLength={240}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    This note will be saved with the order and will be visible to the delivery partner.
                  </p>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {note.length}/240
                  </span>
                </div>
              </div>
            )}
            {showRestaurantNoteInput && (
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-3 md:py-4 rounded-lg md:rounded-xl border border-slate-100 dark:border-gray-800">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Restaurant instructions
                </p>
                <textarea
                  value={restaurantNote}
                  onChange={(e) => setRestaurantNote(e.target.value)}
                  placeholder="Eg. Less spicy, no onion, pack gravy separately"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg md:rounded-xl p-3 md:p-4 text-sm md:text-base resize-none h-20 md:h-24 focus:outline-none focus:border-[#FF0000] dark:focus:border-[#FF0000] bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100"
                  maxLength={240}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    This note will be shown to restaurant with the order.
                  </p>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {restaurantNote.length}/240
                  </span>
                </div>
              </div>
            )}

            {/* Complete your meal section - Approved Addons */}
            {addons.length > 0 && (
              <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
                <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-[#FF0000]" />
                  </div>
                  <span className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">Complete your meal with</span>
                </div>
                {loadingAddons ? (
                  <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex-shrink-0 w-28 md:w-36 animate-pulse">
                        <div className="w-full h-28 md:h-36 bg-gray-200 dark:bg-gray-700 rounded-lg md:rounded-xl" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1 w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 -mx-4 md:-mx-6 px-4 md:px-6 scrollbar-hide">
                    {addons
                      .filter(addon => !vegMode || addon.foodType === 'Veg' || addon.foodType !== 'Non-Veg')
                      .map((addon) => {
                        const quantity = getDishQuantity(addon);
                        return (
                          <div key={addon.id} className="flex-shrink-0 w-28 md:w-36">
                            <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg md:rounded-xl overflow-hidden">
                              <img
                                src={addon.image || (addon.images && addon.images[0]) || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"}
                                alt={addon.name}
                                className="w-full h-28 md:h-36 object-cover rounded-lg md:rounded-xl"
                                onError={(e) => {
                                  e.target.onerror = null
                                  e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"
                                }}
                              />
                              <div className="absolute top-1 md:top-2 left-1 md:left-2">
                                <div className={`w-3.5 h-3.5 md:w-4 md:h-4 bg-white border flex items-center justify-center rounded ${addon.foodType === 'Non-Veg' ? 'border-red-600' : 'border-green-600'}`}>
                                  <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${addon.foodType === 'Non-Veg' ? 'bg-red-600' : 'bg-green-600'}`} />
                                </div>
                              </div>
                              {quantity > 0 ? (
                                <div className="absolute bottom-1 md:bottom-2 right-1 md:right-2 flex items-center bg-white border border-[#FF0000] rounded shadow-sm">
                                  <button
                                    onClick={() => {
                                      const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
                                      const cartRestaurantName = cart[0]?.restaurant || restaurantName;
                                      const addonWithInfo = {
                                        ...addon,
                                        restaurant: cartRestaurantName,
                                        restaurantId: cartRestaurantId,
                                        isVeg: addon.foodType !== 'Non-Veg'
                                      };
                                      updateItemQuantityDetail(addonWithInfo, quantity - 1);
                                    }}
                                    className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-l"
                                  >
                                    <Minus className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#FF0000]" />
                                  </button>
                                  <span className="w-5 text-center text-xs md:text-sm font-semibold text-[#FF0000]">
                                    {quantity}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
                                      const cartRestaurantName = cart[0]?.restaurant || restaurantName;
                                      const addonWithInfo = {
                                        ...addon,
                                        restaurant: cartRestaurantName,
                                        restaurantId: cartRestaurantId,
                                        isVeg: addon.foodType !== 'Non-Veg'
                                      };
                                      updateItemQuantityDetail(addonWithInfo, quantity + 1);
                                    }}
                                    className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-r"
                                  >
                                    <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#FF0000]" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    const cartRestaurantId = cart[0]?.restaurantId || restaurantId;
                                    const cartRestaurantName = cart[0]?.restaurant || restaurantName;

                                    if (!cartRestaurantId || !cartRestaurantName) {
                                      toast.error('Restaurant information is missing. Please refresh the page.');
                                      return;
                                    }

                                    const addonWithInfo = {
                                      ...addon,
                                      restaurant: cartRestaurantName,
                                      restaurantId: cartRestaurantId,
                                      isVeg: addon.foodType !== 'Non-Veg'
                                    };

                                    updateItemQuantityDetail(addonWithInfo, 1);
                                  }}
                                  className="absolute bottom-1 md:bottom-2 right-1 md:right-2 w-6 h-6 md:w-7 md:h-7 bg-white border border-[#FF0000] rounded flex items-center justify-center shadow-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                  <Plus className="h-3.5 w-3.5 md:h-4 md:w-4 text-[#FF0000]" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs md:text-sm font-medium text-gray-800 dark:text-gray-200 mt-1.5 md:mt-2 line-clamp-2 leading-tight">{addon.name}</p>
                            {addon.description && (
                              <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{addon.description}</p>
                            )}
                            <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 font-semibold mt-0.5">{RUPEE_SYMBOL}{addon.price}</p>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )}

            {/* Coupon Section */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-slate-100 dark:border-gray-800 shadow-sm flex flex-col">
              {deliveryFee === 0 && (
                <div className="px-4 py-3 md:px-6 md:py-4 border-b border-dashed border-gray-200 dark:border-gray-800 flex items-center gap-3 bg-[#f4fcf7] dark:bg-green-900/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600 fill-green-600/20" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    You saved {RUPEE_SYMBOL}{Number((pricing?.totalDeliveryFee ?? deliveryFee ?? feeSettings.baseDeliveryFee) || 0).toFixed(2)} on delivery
                  </span>
                </div>
              )}

              {/* Applied Coupon View */}
              {appliedCoupon ? (
                <div className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <Percent className="h-5 w-5 text-[#FF0000] mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">'{appliedCoupon.code}' applied</p>
                      <p className="text-xs text-[#FF0000] font-medium mt-0.5">You saved {RUPEE_SYMBOL}{discount}</p>
                    </div>
                  </div>
                  <button onClick={handleRemoveCoupon} className="text-[#FF0000] text-xs font-semibold px-2 hover:underline">REMOVE</button>
                </div>
              ) : (
                /* Available / Input View */
                <div className="px-4 py-3 md:px-6 md:py-4 flex flex-col gap-3">
                  {/* Input for manual code */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-2">
                    <input
                      type="text"
                      value={manualCouponCode}
                      onChange={(e) => setManualCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="flex-1 min-h-[48px] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0a0a0a] px-4 py-3 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:border-[#FF0000]"
                    />
                    <button
                      className="bg-white dark:bg-[#1a1a1a] border border-[#FF0000] text-[#FF0000] rounded-xl px-6 min-h-[48px] text-sm font-semibold uppercase hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-[0.98] transition-all"
                      onClick={handleApplyCouponCode}
                    >
                      APPLY
                    </button>
                  </div>

                  {loadingCoupons ? (
                    <p className="text-sm text-gray-500">Loading offers...</p>
                  ) : availableCoupons.length > 0 ? (
                    <div className="space-y-3 mt-1">
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Available Coupons</p>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {availableCoupons.map((coupon) => {
                          const canApply = coupon.meetsMinOrder !== false;
                          return (
                            <div key={coupon.code} className="flex items-start justify-between p-3 rounded-2xl border border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/30">
                              <div className="flex items-start gap-3 flex-1">
                                <Percent className="h-5 w-5 text-gray-700 dark:text-gray-300 mt-0.5 opacity-80" />
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight mb-1">
                                    <span className="bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded text-xs tracking-wider border border-slate-300/40 mr-2">
                                      {coupon.code}
                                    </span>
                                    {coupon.discountDisplay || `Save ${RUPEE_SYMBOL}${coupon.discount}`}
                                  </p>
                                  {isFirstTimeOnlyCoupon(coupon) && (
                                    <p className="text-[11px] text-[#FF0000] mb-1 font-medium">First-time users only</p>
                                  )}
                                  {coupon.meetsMinOrder === false ? (
                                    <p className="text-xs text-blue-600 font-semibold mb-1">
                                      Add items worth {RUPEE_SYMBOL}{Number(coupon.amountToUnlock || 0)} to apply this coupon
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{coupon.description}</p>
                                  )}
                                </div>
                              </div>
                              <button
                                className={`border rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider shadow-sm transition-all duration-200 ${canApply
                                  ? "border-[#FF0000] text-[#FF0000] hover:bg-red-50"
                                  : "border-gray-300 text-gray-400 cursor-not-allowed bg-gray-50/50"
                                  }`}
                                onClick={() => handleApplyCoupon(coupon)}
                                disabled={!canApply}
                              >
                                APPLY
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-2">
                      <Percent className="h-5 w-5 text-gray-400" />
                      <p className="text-sm text-gray-500">No offers available for this restaurant currently</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery Type */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-slate-100 dark:border-gray-800 shadow-sm flex flex-col p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-bold text-[#118A42] dark:text-green-500">Delivery Modes</h3>
                  <span className="bg-[#118A42] text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wide">NEW</span>
                </div>
                <span className="text-sm font-medium text-gray-500">Instructions</span>
              </div>

              <div className="flex flex-col gap-0">
                {/* Food Quick Delivery — mutually exclusive with Schedule */}
                {showQuickOption && (
                  <div
                    onClick={() => {
                      if (!quickGatesOpen && deliveryType !== "quick") {
                        showQuickDeliveryUnavailableToast(
                          pricing?.quickDelivery?.reason ||
                          "Quick Delivery not available for this restaurant/zone yet",
                        )
                        return
                      }
                      clearQuickDeliveryToast()
                      setQuickFallbackNotice(null)
                      setDeliveryType("quick")
                      if (isScheduled) setIsScheduled(false)
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all ${deliveryType === "quick" ? "bg-gray-50 dark:bg-gray-800/50" : "bg-transparent"
                      } ${!quickGatesOpen && deliveryType !== "quick" ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="mt-1">
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${deliveryType === "quick" ? "border-[#118A42]" : "border-gray-300 dark:border-gray-600"
                        } ${!quickGatesOpen && deliveryType !== "quick" ? "bg-gray-100 dark:bg-gray-800" : ""}`}>
                        {deliveryType === "quick" && <div className="w-2.5 h-2.5 bg-[#118A42] rounded-full" />}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[15px] font-semibold ${!quickGatesOpen && deliveryType !== "quick"
                            ? "text-gray-600 dark:text-gray-400"
                            : deliveryType === "quick"
                              ? "text-gray-900 dark:text-white"
                              : "text-gray-600 dark:text-gray-400"
                          }`}>
                          Quick Delivery
                        </span>
                        <span className={`text-[15px] font-medium ${!quickGatesOpen && deliveryType !== "quick"
                            ? "text-gray-500 dark:text-gray-500"
                            : "text-gray-700 dark:text-gray-300"
                          }`}>
                          {quickDeliveryFee > 0
                            ? `+${formatQuickCharge(quickDeliveryFee)}`
                            : pricing?.quickDelivery?.charge
                              ? `+${formatQuickCharge(pricing.quickDelivery.charge)}`
                              : "Server priced"}
                        </span>
                      </div>
                      <span className={`text-xs mt-0.5 ${!quickGatesOpen && deliveryType !== "quick"
                          ? "text-red-500 font-medium"
                          : "text-gray-400"
                        }`}>
                        {!quickGatesOpen && deliveryType !== "quick"
                          ? (pricing?.quickDelivery?.reason ? mapQuickDeliveryReason(pricing.quickDelivery.reason) : "Unavailable at your location")
                          : (quickEtaLabel
                            ? `Promise ${quickEtaLabel}`
                            : "Faster delivery when restaurant & zone enable Quick")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Basic Delivery */}
                <div
                  onClick={() => {
                    clearQuickDeliveryToast()
                    setQuickFallbackNotice(null)
                    setDeliveryType("standard")
                  }}
                  className={`flex items-start gap-3 p-3 cursor-pointer rounded-xl transition-all ${deliveryType === "standard" || isScheduled ? "bg-gray-50 dark:bg-gray-800/50" : "bg-transparent"
                    }`}
                >
                  <div className="mt-1">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${deliveryType === "standard" || isScheduled ? "border-[#118A42]" : "border-gray-300 dark:border-gray-600"
                      }`}>
                      {(deliveryType === "standard" || isScheduled) && <div className="w-2.5 h-2.5 bg-[#118A42] rounded-full" />}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span className={`text-[15px] font-semibold ${deliveryType === "standard" || isScheduled ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                      Basic
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">
                      {isScheduled ? "Schedule uses Basic delivery" : "Standard delivery fee"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
              <div className="flex items-start justify-between w-full text-left">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-xl mt-0.5">
                    <MapPin className="h-5 w-5 text-[#FF0000]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col">
                      <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
                        Delivery at{" "}
                        <span className="font-semibold">
                          {activeAddress?.type === "current" ? "Current location" : "Location"}
                        </span>
                      </p>
                      {activeAddress?.type === "current" ? (
                        <div className="mt-1">
                          {currentLocationLoading ? (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                              Finding your current address...
                            </p>
                          ) : (
                            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {formatFullAddress(activeAddress) ||
                                activeAddress?.formattedAddress ||
                                activeAddress?.address ||
                                "Add delivery address"}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] md:text-[11px] font-semibold bg-[#FFF2EB] text-[#FF0000] dark:bg-[#FF0000]/10 dark:text-[#FF0000] border border-[#FF0000]/30">
                              GPS enabled
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 pr-4">
                          {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Add delivery address") : "Add delivery address"}
                        </p>
                      )}
                    </div>
                    {!hasSavedAddress && (
                      <p className="text-sm text-[#FF0000] mt-2 font-medium">
                        Select a delivery location to continue
                      </p>
                    )}
                    {/* Address Selection Buttons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {["Home", "Work", "Other"].map((label) => {
                        const normalizedLabel = normalizeAddressLabel(label)
                        const addressExists = addresses.some(addr => normalizeAddressLabel(addr.label) === normalizedLabel)
                        return (
                          <button
                            key={label}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleSelectAddressByLabel(label)
                            }}
                            disabled={!addressExists}
                            className={`text-xs px-4 py-1.5 rounded-full font-semibold transition-all ${addressExists
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-gray-800 dark:text-gray-300'
                              : 'bg-gray-50 text-gray-400 border border-gray-100 cursor-not-allowed dark:bg-gray-900'
                              }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    {addresses.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {addresses.map((address) => {
                          const addressId = getAddressId(address)
                          const isSelected = addressId && addressId === activeAddressId
                          return (
                            <button
                              key={addressId || `${address.label}-${address.street}-${address.city}`}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleSelectSavedAddress(address)
                              }}
                              className={`w-full text-left rounded-xl border-2 p-3 transition-colors ${isSelected
                                ? "border-[#FF0000] bg-red-50/50 dark:bg-[#FF0000]/5"
                                : "border-slate-100 dark:border-gray-800 hover:border-slate-200"
                                }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                    {getDisplayAddressLabel(address.label)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                                    {formatFullAddress(address) || address.address || "Address details"}
                                  </p>
                                </div>
                                {isSelected && (
                                  <span className="text-[10px] bg-[#FF0000] text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider whitespace-nowrap">
                                    Selected
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openLocationSelector}
                  className="p-2 text-[#FF0000] bg-red-50 rounded-full hover:bg-red-100 transition-colors dark:bg-red-900/20 dark:hover:bg-red-900/40"
                  aria-label="Open location selector"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-4 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                  <Phone className="h-4 w-4 md:h-5 md:w-5 text-gray-500 dark:text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm md:text-base text-gray-800 dark:text-gray-200 font-medium">
                      {recipientName}, <span className="font-semibold">{recipientPhone || "+91-XXXXXXXXXX"}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Order recipient details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingRecipient((prev) => !prev)}
                  className="text-[#FF0000] text-xs md:text-sm font-semibold whitespace-nowrap"
                >
                  {isEditingRecipient ? "Done" : "Change"}
                </button>
              </div>

              {isEditingRecipient && (
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      value={recipientDetails.name}
                      onChange={(e) =>
                        setRecipientDetails((prev) => ({
                          ...prev,
                          name: sanitizeRecipientName(e.target.value),
                        }))
                      }
                      placeholder="Enter recipient name"
                      maxLength={50}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111111] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#FF0000]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={recipientDetails.phone}
                      onChange={(e) =>
                        setRecipientDetails((prev) => ({
                          ...prev,
                          phone: sanitizeRecipientPhone(e.target.value),
                        }))
                      }
                      placeholder="Enter recipient phone"
                      maxLength={10}
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111111] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-[#FF0000]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    If you are ordering for someone else, please save their name and phone number here.
                  </p>
                </div>
              )}
            </div>
            {/* Bill Details */}
            <div className="bg-white dark:bg-[#1a1a1a] px-4 md:px-6 py-5 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800">
              <button
                onClick={() => setShowBillDetails(!showBillDetails)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <div className="text-left">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-base text-gray-800 dark:text-gray-200 font-semibold tracking-wide">Total Bill</span>
                      {savings > 0 ? (
                        <>
                          <span className="text-base text-gray-400 dark:text-gray-500 line-through font-medium">{RUPEE_SYMBOL}{totalBeforeDiscount.toFixed(2)}</span>
                          <span className="text-base font-bold text-gray-900 dark:text-white">{RUPEE_SYMBOL}{total.toFixed(2)}</span>
                          <span className="text-[11px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-center ml-1 font-semibold border border-blue-200 dark:border-blue-800">
                            You saved {RUPEE_SYMBOL}{savings.toFixed(0)}
                          </span>
                        </>
                      ) : (
                        <span className="text-base font-bold text-gray-900 dark:text-white">{RUPEE_SYMBOL}{total.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Incl. taxes and charges</p>
                    {otherPlatformSubtotal > subtotal && (
                      <p className="text-xs font-semibold text-[#FF0000] dark:text-red-400 mt-1">
                        Other platform item total {RUPEE_SYMBOL}{otherPlatformSubtotal.toFixed(0)} • Save {RUPEE_SYMBOL}{otherPlatformSavings.toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${showBillDetails ? 'rotate-90' : ''}`} />
              </button>

              {showBillDetails && (
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Item Total</span>
                    <div className="text-right flex items-center gap-2">
                      {otherPlatformSubtotal > subtotal && (
                        <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                          Other: {RUPEE_SYMBOL}{otherPlatformSubtotal.toFixed(0)}
                        </span>
                      )}
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{subtotal.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 border-b border-dashed border-gray-400 pb-[1px]">
                      Delivery Fee {hasDistanceDeliveryBreakdown ? `| ${Number(resolvedDistanceKm).toFixed(1)} kms` : ""}
                    </span>
                    <div className="text-right">
                      <span className={deliveryFee === 0 ? "text-[#FF0000] font-semibold" : "text-gray-800 dark:text-gray-200 font-medium"}>
                        {deliveryFee === 0 ? "FREE" : `${RUPEE_SYMBOL}${deliveryFee.toFixed(0)}`}
                      </span>
                    </div>
                  </div>
                  {quickDeliveryFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Quick Delivery</span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">
                        {RUPEE_SYMBOL}{quickDeliveryFee.toFixed(0)}
                      </span>
                    </div>
                  )}

                  {platformFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Platform Fee</span>
                      <div className="text-right">
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{platformFee.toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                  {packagingFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Packaging Fee</span>
                      <div className="text-right">
                        <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{packagingFee.toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 border-b border-dashed border-gray-400 pb-[1px]">Government Taxes</span>
                    <span className="text-gray-800 dark:text-gray-200 font-medium">{RUPEE_SYMBOL}{gstCharges.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-[#FF0000] font-medium">
                      <span>Item Discount</span>
                      <span>-{RUPEE_SYMBOL}{discount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-bold pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 text-gray-900 dark:text-white">
                    <span>To Pay</span>
                    <span>{RUPEE_SYMBOL}{total.toFixed(2)}</span>
                  </div>

                  {/* Price Comparison Summary - Moved below To Pay */}
                  {otherPlatformSubtotal > subtotal && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#FF0000] dark:text-red-400 uppercase tracking-wider">Other Platform Price</span>
                        <span className="text-sm font-bold text-gray-500">{RUPEE_SYMBOL}{otherPlatformSubtotal.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs font-bold text-[#FF0000] dark:text-red-400 uppercase tracking-wider">Your Savings</span>
                        <span className="text-sm font-bold text-[#FF0000]">{RUPEE_SYMBOL}{otherPlatformSavings.toFixed(0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>

    {/* Bottom Sticky - Place Order */}
    <div
      className="bg-white dark:bg-[#1a1a1a] md:bg-transparent border-t dark:border-gray-800 md:border-t-0 shadow-lg md:shadow-none z-30 flex-shrink-0 fixed md:static bottom-0 left-0 right-0 w-full"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
        <div className="w-full max-w-3xl mx-auto space-y-3">
          {/* Pay Using - Slim Pro UI */}
          <div
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-[#222222] rounded-xl border border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#282828] active:scale-[0.98] transition-all duration-200 shadow-sm"
            onClick={() => setShowPaymentSheet(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100/80 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                {selectedPaymentMethod === "wallet" ? (
                  <Wallet className="h-5 w-5 text-[#FF0000]" />
                ) : selectedPaymentMethod === "razorpay" ? (
                  <Zap className="h-5 w-5 text-[#FF0000]" />
                ) : (
                  <Banknote className="h-5 w-5 text-[#FF0000]" />
                )}
              </div>
              <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold opacity-80">
                  PAYING WITH
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    {selectedPaymentLabel}
                  </p>
                  {selectedPaymentMethod === "wallet" && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-1 rounded">
                      {RUPEE_SYMBOL}{walletBalance.toFixed(0)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 text-[#FF0000] font-bold text-[11px] uppercase tracking-widest bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded-lg">
              CHANGE <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={isPlacingOrder || (selectedPaymentMethod === "wallet" && walletBalance < total)}
            className="w-full bg-gradient-to-r from-[#FF0000] to-[#FF0000] hover:from-[#C83C00] hover:to-[#CF2834] text-white px-6 h-12 md:h-14 rounded-2xl font-bold shadow-lg shadow-[#FF0000]/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between transition-transform active:scale-[0.98]"
          >
            {(selectedPaymentMethod === "razorpay" || selectedPaymentMethod === "wallet" || selectedPaymentMethod === "cash") && (
              <div className="text-left flex flex-col justify-center border-r-[1.5px] border-white/20 pr-4">
                <span className="text-xs md:text-sm font-semibold text-white/90">{RUPEE_SYMBOL}{total.toFixed(2)}</span>
                <span className="text-[9px] md:text-[10px] uppercase font-bold tracking-wider text-white/80 mt-[-2px]">Total</span>
              </div>
            )}
            <div className="flex items-center gap-1 mx-auto text-sm md:text-lg tracking-wide">
              {isPlacingOrder
                ? "Processing..."
                : !hasSavedAddress
                  ? "Select Address"
                  : "Place Order"}
              <div className="flex align-center h-full">
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    {/* Placing Order Modal */}
    {showPlacingOrder && (
      <div className="fixed inset-0 z-[60] h-screen w-full overflow-hidden">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Modal Sheet */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl overflow-hidden"
          style={{ animation: 'slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="px-6 py-8">
            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Placing your order</h2>

            {/* Payment Info */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-white shadow-sm">
                <CreditCard className="w-6 h-6 text-gray-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedPaymentMethod === "razorpay"
                    ? `Pay ${RUPEE_SYMBOL}${total.toFixed(2)} online (Razorpay)`
                    : selectedPaymentMethod === "wallet"
                      ? `Pay ${RUPEE_SYMBOL}${total.toFixed(2)} from Wallet`
                      : `Pay on delivery (COD)`}
                </p>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-xl border border-gray-200 flex items-center justify-center bg-gray-50">
                <svg className="w-7 h-7 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path d="M9 22V12h6v10" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">Delivering to Location</p>
                <p className="text-sm text-gray-600 mt-1">
                  {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Address") : "Add address"}
                </p>
                <p className="text-sm text-gray-500">
                  {defaultAddress ? (formatFullAddress(defaultAddress) || "Address") : "Address"}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative mb-6">
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF0000] to-[#C83C00] rounded-full transition-all duration-100 ease-linear"
                  style={{
                    width: `${orderProgress}%`,
                    boxShadow: '0 0 10px rgba(235, 89, 14, 0.5)'
                  }}
                />
              </div>
              {/* Animated shimmer effect */}
              <div
                className="absolute inset-0 h-2.5 rounded-full overflow-hidden pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                  animation: 'shimmer 1.5s infinite',
                  width: `${orderProgress}%`
                }}
              />
            </div>

            {/* Cancel Button */}
            <button
              onClick={() => {
                setShowPlacingOrder(false)
                setIsPlacingOrder(false)
              }}
              className="w-full text-right"
            >
              <span className="text-[#FF0000] font-semibold text-base hover:text-[#C83C00] transition-colors">
                CANCEL
              </span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Order Success Celebration Page */}
    {showOrderSuccess && (
      <div
        className="fixed inset-0 z-[70] bg-white dark:bg-[#0a0a0a] flex h-screen w-full flex-col items-center justify-center overflow-hidden"
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      >
        {/* Confetti Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Animated confetti pieces */}
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                backgroundColor: ['#FF0000', '#3b82f6', '#f59e0b', '#ef4444', '#C83C00', '#ec4899'][Math.floor(Math.random() * 6)],
                animation: `confettiFall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s infinite`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>

        {/* Success Content */}
        <div className="relative z-10 flex flex-col items-center px-6">
          {/* Success Tick Circle */}
          <div
            className="relative mb-8"
            style={{ animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both' }}
          >
            {/* Outer ring animation */}
            <div
              className="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-500 dark:border-green-400"
              style={{
                animation: 'ringPulse 1.5s ease-out infinite',
                opacity: 0.3
              }}
            />
            {/* Main circle */}
            <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 dark:from-green-500 dark:to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-200/60 dark:shadow-green-900/40">
              <svg
                className="w-16 h-16 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'checkDraw 0.5s ease-out 0.5s both' }}
              >
                <path d="M5 12l5 5L19 7" className="check-path" />
              </svg>
            </div>
            {/* Sparkles */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 dark:bg-yellow-300 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  animation: `sparkle 0.6s ease-out ${0.3 + i * 0.1}s both`,
                  transform: `rotate(${i * 60}deg) translateY(-80px)`,
                }}
              />
            ))}
          </div>

          {/* Location Info */}
          <div
            className="text-center"
            style={{ animation: 'slideUp 0.5s ease-out 0.6s both' }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-5 h-5 text-red-500 dark:text-red-400">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {defaultAddress?.city || "Your Location"}
              </h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-base">
              {defaultAddress ? (formatFullAddress(defaultAddress) || defaultAddress?.formattedAddress || defaultAddress?.address || "Delivery Address") : "Delivery Address"}
            </p>
          </div>

          {/* Order Placed Message */}
          <div
            className="mt-12 text-center"
            style={{ animation: 'slideUp 0.5s ease-out 0.8s both' }}
          >
            <h3 className="text-3xl font-bold text-[#FF0000] dark:text-red-400 mb-2">Order Placed!</h3>
            <p className="text-gray-600 dark:text-gray-300">Your delicious food is on its way</p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleGoToOrders}
            className="mt-10 bg-[#FF0000] hover:bg-[#C83C00] text-white font-semibold py-4 px-12 rounded-xl shadow-lg shadow-red-200/70 dark:shadow-red-950/40 transition-all hover:shadow-xl hover:scale-105"
            style={{ animation: 'slideUp 0.5s ease-out 1s both' }}
          >
            Track Your Order
          </button>
        </div>
      </div>
    )}

    {/* Payment Selection Bottom Sheet */}
    <AnimatePresence>
      {showPaymentSheet && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPaymentSheet(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] rounded-t-[2rem] z-[101] shadow-2xl overflow-hidden max-h-[82vh] md:max-h-[60vh] flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="p-5 md:p-6 flex flex-col h-full min-h-0">
              {/* Compact Drag handle */}
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-5" />

              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-none">Payment Method</h2>
                  <p className="text-[13px] font-medium text-gray-500 mt-1.5">Select how you want to pay</p>
                </div>
                <button
                  onClick={() => setShowPaymentSheet(false)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar pb-4 flex-1 min-h-0">
                {isCodBlockedByOrderValue && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    {codBlockedMessage}
                  </div>
                )}
                {paymentOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      if (!option.disabled) {
                        setSelectedPaymentMethod(option.id)
                        setShowPaymentSheet(false)
                      }
                    }}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group ${selectedPaymentMethod === option.id
                      ? 'border-[#FF0000] bg-red-50 dark:bg-red-900/10 shadow-sm'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] hover:border-red-200 dark:hover:border-red-900/30 shadow-sm'
                      } ${option.disabled ? 'opacity-40 grayscale-[0.8] cursor-not-allowed' : 'cursor-pointer active:scale-[0.98]'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${selectedPaymentMethod === option.id
                        ? 'bg-red-100 dark:bg-red-900/30 text-[#FF0000]'
                        : option.color
                        }`}>
                        {option.icon}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-[15px] font-semibold tracking-tight leading-none transition-colors ${selectedPaymentMethod === option.id ? 'text-[#FF0000] dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                            {option.name}
                          </span>
                          {option.badge && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm tracking-wider ${selectedPaymentMethod === option.id
                              ? 'bg-red-100 text-[#FF0000] dark:bg-red-900/40'
                              : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                              }`}>
                              {option.badge}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <p className={`text-[12px] transition-colors ${selectedPaymentMethod === option.id ? 'text-red-600/80 dark:text-red-400/80' : 'text-gray-500'
                            }`}>
                            {option.description}
                          </p>
                          {option.subInfo && !option.disabled && (
                            <>
                              <span className={`w-1 h-1 rounded-full ${selectedPaymentMethod === option.id ? 'bg-red-300 dark:bg-red-700' : 'bg-gray-300 dark:bg-gray-700'
                                }`} />
                              <p className={`text-[10px] font-bold uppercase tracking-tighter transition-colors ${selectedPaymentMethod === option.id ? 'text-[#FF0000]' : 'text-emerald-600 dark:text-emerald-500'
                                }`}>
                                {option.subInfo}
                              </p>
                            </>
                          )}
                        </div>
                        {option.disabled && (
                          <p className="text-[10px] font-medium text-red-500 mt-1">
                            {option.disabledText}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300 ${selectedPaymentMethod === option.id
                      ? 'bg-[#FF0000] border-[#FF0000]'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'
                      }`}>
                      {selectedPaymentMethod === option.id && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                ))}
              </div>

              <div
                className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white dark:bg-[#1a1a1a]"
                style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom, 0px))" }}
              >
                <div className="flex-shrink-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total Pay</p>
                  <p className="text-xl font-bold text-[#FF0000] tabular-nums">{RUPEE_SYMBOL}{total.toFixed(0)}</p>
                </div>
                <Button
                  onClick={() => setShowPaymentSheet(false)}
                  className="flex-1 bg-[#FF0000] hover:bg-[#C83C00] text-white h-11 rounded-xl text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-[0.98]"
                >
                  Confirm Order
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* Animation Styles */}
    <style>{`
        @keyframes fadeInBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpBannerSmooth {
          from { transform: translateY(100%) scale(0.95); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes slideUpBanner {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmerBanner {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scaleInBounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes checkMarkDraw {
          0% { stroke-dasharray: 100; stroke-dashoffset: 100; opacity: 0; }
          50% { opacity: 1; }
          100% { stroke-dasharray: 100; stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes slideUpFull {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideUpModal {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { stroke-dasharray: 100; stroke-dashoffset: 100; }
          100% { stroke-dasharray: 100; stroke-dashoffset: 0; }
        }
        @keyframes ringPulse {
          0% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes sparkle {
          0% { transform: rotate(var(--rotation, 0deg)) translateY(0) scale(0); opacity: 1; }
          100% { transform: rotate(var(--rotation, 0deg)) translateY(-80px) scale(1); opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes confettiFall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .animate-slideUpFull {
          animation: slideUpFull 0.3s ease-out;
        }
        .check-path {
          stroke-dasharray: 100;
          stroke-dashoffset: 0;
        }
      `}</style>

    {/* Share Modal */}
    {typeof window !== "undefined" &&
      createPortal(
        <AnimatePresence>
          {showShareModal && sharePayload && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-[10020]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowShareModal(false)}
              />
              <motion.div
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10021] w-[92vw] max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.16 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">Share</h3>
                  <button
                    className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setShowShareModal(false)}
                    aria-label="Close share modal"
                  >
                    <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                <div className="px-5 py-4 space-y-2">
                  {typeof navigator !== "undefined" && navigator.share && (
                    <button
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      onClick={handleSystemShareFromModal}
                    >
                      <Share2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Share via system apps</span>
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                    onClick={() => openShareTarget("whatsapp")}
                  >
                    <MessageCircle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                    onClick={() => openShareTarget("telegram")}
                  >
                    <Send className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Telegram</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                    onClick={() => openShareTarget("email")}
                  >
                    <Mail className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Email</span>
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                    onClick={copyShareLink}
                  >
                    <Copy className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Copy link</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    <RestaurantItemDetailSheet
      open={showItemDetail}
      onClose={() => {
        setShowItemDetail(false);
        setSelectedProduct(null);
      }}
      selectedItem={selectedProduct}
      selectedItemImageIndex={selectedItemImageIndex}
      setSelectedItemImageIndex={setSelectedItemImageIndex}
      selectedVariantId={selectedVariantId}
      setSelectedVariantId={setSelectedVariantId}
      restaurant={{ id: restaurantId, name: restaurantName }}
      shouldShowGrayscale={false}
      isRecommendedItem={() => false}
      showBookmark={false}
      showShare={false}
      getDishQuantity={getDishQuantity}
      updateItemQuantity={updateItemQuantityDetail}
      getVariantForDish={getVariantForDish}
    />
  </div>
)
}      
