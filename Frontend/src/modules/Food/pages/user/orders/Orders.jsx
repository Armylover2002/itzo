import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, MoreVertical, ChevronRight, Star, RotateCcw, AlertCircle, Loader2, Clock, X, Share2, MessageCircle, Send, Copy, Mail, MessagesSquare, Link2, Calendar } from "lucide-react"
import { orderAPI } from "@food/api"
import { useCart } from "@food/context/CartContext"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@common/utils/businessSettings"
import {
  formatScheduledAtParts,
  formatScheduleCountdown,
  parseValidDate,
} from "@food/utils/scheduleTime"
import { isFoodQuickOrder, formatQuickEtaWindow } from "@food/utils/quickDelivery"
import {
  getCancellationDisplayLabel,
  isRestaurantAcceptanceTimeout,
} from "@food/utils/cancellationDisplay"
import { getLifecycleDisplay } from "@food/utils/orderLifecycleDisplay"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


export default function Orders() {
  const navigate = useNavigate()
  const { replaceCart } = useCart()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingModal, setRatingModal] = useState({ open: false, order: null })
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null)
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null)
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("")
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)
  const [countdowns, setCountdowns] = useState({})
  // Track orders that have shown rating popup - persist in localStorage
  const [shownRatingForOrders, setShownRatingForOrders] = useState(() => {
    try {
      const stored = localStorage.getItem('shownRatingForOrders')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Save to localStorage whenever shownRatingForOrders changes
  useEffect(() => {
    try {
      localStorage.setItem('shownRatingForOrders', JSON.stringify(Array.from(shownRatingForOrders)))
    } catch (error) {
      debugError('Error saving shownRatingForOrders to localStorage:', error)
    }
  }, [shownRatingForOrders])

  // Calculate countdown for an order (ETA for active; schedule remaining for scheduled)
  const calculateCountdown = (order) => {
    if (!order ||
      order.status === 'delivered' ||
      String(order.status).toLowerCase().includes('cancel')) {
      return null
    }

    if (order.status === 'scheduled') {
      const scheduled = parseValidDate(order.scheduledAt)
      if (!scheduled) return null
      return formatScheduleCountdown(scheduled)
    }

    const createdAt = new Date(order.createdAt)
    const now = new Date()
    const elapsedMinutes = Math.floor((now - createdAt) / (1000 * 60))

    // Prefer Food Quick promise window when present
    const maxETA =
      order.etaPromise?.max ||
      order.eta?.max ||
      order.estimatedDeliveryTime ||
      30
    const remainingMinutes = Math.max(0, maxETA - elapsedMinutes)

    return remainingMinutes > 0 ? remainingMinutes : null
  }

  // Update countdowns for all active orders
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns = {}
      orders.forEach(order => {
        const remaining = calculateCountdown(order)
        if (remaining !== null) {
          newCountdowns[order.id] = remaining
        }
      })
      setCountdowns(newCountdowns)
    }

    updateCountdowns()
    const interval = setInterval(updateCountdowns, 10000) // Update every 10 seconds for better UX

    return () => clearInterval(interval)
  }, [orders])

  // Get order status text
  const getOrderStatus = (order) => {
    const status = order.status
    if (status === 'delivered' || status === 'completed') return 'delivered'
    if (status === 'out_for_delivery' || status === 'outForDelivery') return 'outForDelivery'
    if (status === 'ready' || status === 'preparing') return 'preparing'
    if (status === 'scheduled') return 'scheduled'
    if (String(status).toLowerCase().includes('cancel')) return 'cancelled'
    return status || 'confirmed'
  }

  // Auto-show rating popup when order is delivered (only once per order)
  useEffect(() => {
    if (orders.length === 0 || ratingModal.open) {
      return
    }

    debugLog('?? Checking for delivered orders to show rating popup...', {
      totalOrders: orders.length,
      shownRatingForOrders: Array.from(shownRatingForOrders)
    })

    // Find delivered orders that haven't been rated and haven't shown popup yet
    const deliveredOrders = orders.filter(order => {
      // Check originalStatus first (from backend), then fallback to transformed status
      const originalStatus = order.originalStatus || order.status || ''
      const transformedStatus = order.status || ''

      // Check if order is delivered - check both original and transformed status
      const isDelivered =
        originalStatus === 'delivered' ||
        originalStatus === 'completed' ||
        originalStatus.toLowerCase() === 'delivered' ||
        originalStatus.toLowerCase() === 'completed' ||
        transformedStatus === 'delivered' ||
        transformedStatus === 'completed' ||
        transformedStatus.toLowerCase() === 'delivered' ||
        transformedStatus.toLowerCase() === 'completed'

      const hasRestaurantRating = Number.isFinite(Number(order.restaurantRating))
      const hasDeliveryPartner = !!(order.deliveryPartnerId || order.deliveryPartnerName)
      const hasDeliveryRating = Number.isFinite(Number(order.deliveryPartnerRating))
      const hasRating = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating)

      const orderId = order.id || order._id || order.mongoId
      const hasShownPopup = shownRatingForOrders.has(orderId)

      // Also check if order has deliveredAt timestamp (indicates it was delivered)
      const hasDeliveredAt = order.deliveredAt !== null && order.deliveredAt !== undefined

      const shouldShow = (isDelivered || hasDeliveredAt) && !hasRating && !hasShownPopup

      debugLog(`?? Order ${orderId}:`, {
        originalStatus,
        transformedStatus,
        isDelivered,
        hasDeliveredAt,
        hasRating,
        restaurantRating: order.restaurantRating,
        deliveryPartnerRating: order.deliveryPartnerRating,
        hasShownPopup,
        shouldShow
      })

      return shouldShow
    })

    debugLog('? Found delivered orders needing rating:', deliveredOrders.length)

    // Show popup for the first delivered order that needs rating
    if (deliveredOrders.length > 0) {
      const orderToRate = deliveredOrders[0]
      const orderId = orderToRate.id || orderToRate._id || orderToRate.mongoId

      debugLog('?? Showing rating popup for order:', {
        orderId,
        restaurant: orderToRate.restaurant,
        status: orderToRate.status
      })

      // Mark as shown to prevent multiple popups (before showing to prevent race conditions)
      setShownRatingForOrders(prev => new Set([...prev, orderId]))

      // Small delay to ensure smooth UX
      setTimeout(() => {
        debugLog('? Opening rating modal for order:', {
          orderId: orderId,
          restaurant: orderToRate.restaurant,
          status: orderToRate.status,
          originalStatus: orderToRate.originalStatus
        })
        setRatingModal({ open: true, order: orderToRate })
        setSelectedRestaurantRating(null)
        setSelectedDeliveryRating(null)
        setRestaurantFeedbackText("")
        setDeliveryFeedbackText("")
      }, 800) // Show after 0.8 seconds
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, shownRatingForOrders, ratingModal.open])

  // Fetch orders from backend API
  useEffect(() => {
    const FETCH_LIMIT = 100

    const extractOrdersPage = (response) => {
      let pageOrders = []
      let totalPages = 1

      if (response?.data?.success && response?.data?.data?.orders) {
        pageOrders = response.data.data.orders || []
        totalPages = response.data.data?.pagination?.pages || 1
      } else if (response?.data?.orders) {
        pageOrders = response.data.orders || []
        totalPages = response.data?.pagination?.pages || 1
      } else if (
        response?.data?.data &&
        Array.isArray(response.data.data)
      ) {
        pageOrders = response.data.data || []
      }

      return { pageOrders, totalPages }
    }

    const fetchOrdersPages = async ({ firstPageOnly = false } = {}) => {
      const firstResponse = await orderAPI.getOrders({
        limit: FETCH_LIMIT,
        page: 1,
      })
      const { pageOrders: firstPageOrders, totalPages } = extractOrdersPage(firstResponse)

      if (firstPageOnly || totalPages <= 1) {
        return firstPageOrders
      }

      const pagePromises = []
      for (let p = 2; p <= totalPages; p += 1) {
        pagePromises.push(orderAPI.getOrders({ limit: FETCH_LIMIT, page: p }))
      }

      const pageResponses = await Promise.all(pagePromises)
      const remainingOrders = pageResponses.flatMap((resp) => {
        return extractOrdersPage(resp).pageOrders
      })

      return [...firstPageOrders, ...remainingOrders]
    }

    const transformOrders = (rawOrdersData) => {
      const ordersData = rawOrdersData.filter(order => {
        const type = order.orderType || order.module || 'food'
        const orderId = String(order.orderId || order.id || order._id || '')
        return type !== 'quick' && !orderId.startsWith('QC')
      })

      const transformedOrders = ordersData.map(order => {
        const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()
        const backendStatus = order.orderStatus || order.status
        const isCancelled =
          backendStatus === 'cancelled' ||
          backendStatus === 'cancelled_by_user' ||
          backendStatus === 'cancelled_by_restaurant' ||
          backendStatus === 'cancelled_by_admin'
        const cancellationReason = order.cancellationReason || ''
        const isRestaurantCancelled = isCancelled && (
          order.cancelledBy === 'restaurant' ||
          backendStatus === 'cancelled_by_restaurant' ||
          isRestaurantAcceptanceTimeout(order) ||
          /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue|order not accepted within time limit|restaurant did not respond/i.test(cancellationReason)
        )
        const isUserCancelled = isCancelled && (order.cancelledBy === 'user' || backendStatus === 'cancelled_by_user')
        const cancellationLabel = isCancelled
          ? getCancellationDisplayLabel(order) || 'Cancelled'
          : null
        const originalStatus = backendStatus
        const restaurantRating = order.ratings?.restaurant?.rating || null
        const deliveryPartnerRating = order.ratings?.deliveryPartner?.rating || null

        return {
          id: order._id?.toString() || order.orderId || `ORD-${order._id}`,
          mongoId: order._id,
          orderId: order.orderId || order._id?.toString(),
          status: isRestaurantCancelled ? 'restaurant_cancelled' : getOrderStatus({ ...order, status: backendStatus }),
          originalStatus,
          cancellationLabel,
          createdAt: createdAt.toISOString(),
          scheduledAt: order.scheduledAt || null,
          activatedAt: order.activatedAt || null,
          address: order.address || order.deliveryAddress || {},
          items: (order.items || []).map(item => ({
            itemId: item.itemId || item._id || item.id,
            name: item.name || item.foodName || 'Item',
            variantName: item.variantName || '',
            quantity: item.quantity || 1,
            price: item.price || 0,
            image: item.image || null,
            description: item.description || null,
            isVeg: item.isVeg !== undefined ? item.isVeg : (item.category === 'veg' || item.type === 'veg'),
            _id: item._id || item.id,
            id: item.id || item._id
          })),
          total: order.pricing?.total || order.total || 0,
          subtotal: order.pricing?.subtotal || 0,
          deliveryFee: order.pricing?.deliveryFee || 0,
          tax: order.pricing?.tax || 0,
          pricing: order.pricing || {},
          payment: order.payment || {},
          paymentMethod: order.payment?.method || order.paymentMethod,
          restaurant: order.restaurantId?.restaurantName || order.restaurantId?.name || order.restaurantName || 'Restaurant',
          restaurantId: order.restaurantId?._id || order.restaurantId,
          restaurantSlug: order.restaurantId?.slug || null,
          restaurantImage: order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || null,
          restaurantLocation: order.restaurantId?.location?.area || order.restaurantId?.location?.city || order.address?.city || order.deliveryAddress?.city || '',
          restaurantRating,
          deliveryPartnerRating,
          ratings: order.ratings || {},
          rating: restaurantRating || null,
          review: order.review || null,
          tracking: order.tracking || {},
          cancellationReason: cancellationReason,
          isRestaurantCancelled: isRestaurantCancelled,
          isUserCancelled: isUserCancelled,
          cancelledBy: order.cancelledBy,
          eta: order.eta || { min: order.estimatedDeliveryTime || 30, max: order.estimatedDeliveryTime || 30 },
          etaPromise: order.etaPromise || null,
          deliveryMode: order.deliveryMode || "basic",
          sla: order.sla || null,
          estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
          preparationTime: order.preparationTime || 0,
          deliveredAt: order.deliveredAt || null,
          deliveryPartnerId: order.deliveryPartnerId?._id || order.deliveryPartnerId || null,
          deliveryPartnerName: order.deliveryPartnerId?.name || order.deliveryPartnerName || null,
          deliveryPartnerPhone: order.deliveryPartnerId?.phone || order.deliveryPartnerPhone || null,
          note: order.note || null
        }
      })

      transformedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      return transformedOrders
    }

    const fetchOrders = async ({ silent = false, firstPageOnly = false } = {}) => {
      try {
        if (!silent) setLoading(true)
        const rawOrdersData = await fetchOrdersPages({ firstPageOnly })
        const transformedOrders = transformOrders(rawOrdersData)

        if (transformedOrders.length > 0) {
          if (firstPageOnly) {
            // Poll: refresh recent page only; keep older rows already loaded.
            setOrders((prev) => {
              const byKey = new Map(
                (prev || []).map((o) => [String(o.mongoId || o.id || o.orderId), o]),
              )
              for (const order of transformedOrders) {
                byKey.set(String(order.mongoId || order.id || order.orderId), order)
              }
              return Array.from(byKey.values()).sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
              )
            })
          } else {
            setOrders(transformedOrders)
          }
        } else if (!firstPageOnly) {
          setOrders([])
        }
      } catch (error) {
        debugError('Error fetching user orders:', error)
        if (silent) return
        let errorMessage = 'Failed to load orders'
        if (error?.response?.status === 401) {
          errorMessage = 'Please login to view your orders'
        } else if (error?.response?.data?.message) {
          errorMessage = error.response.data.message
        }
        toast.error(errorMessage)
        setOrders([])
      } finally {
        if (!silent) setLoading(false)
      }
    }

    fetchOrders()

    const pollInterval = setInterval(() => {
      if (window.orderSocketConnected) return
      fetchOrders({ silent: true, firstPageOnly: true })
    }, 60000)

    const onStatus = (event) => {
      const detail = event?.detail || {}
      const status = detail.orderStatus || detail.status
      if (!status) return
      const ids = [detail.orderMongoId, detail.orderId].filter(Boolean).map(String)
      if (!ids.length) return
      setOrders((prev) =>
        (prev || []).map((order) => {
          const keys = [order.mongoId, order.id, order.orderId].filter(Boolean).map(String)
          if (!keys.some((k) => ids.includes(k))) return order
          return {
            ...order,
            originalStatus: status,
            status: String(status).includes("cancel")
              ? order.isRestaurantCancelled
                ? "restaurant_cancelled"
                : status
              : status,
            deliveredAt:
              status === "delivered" ? order.deliveredAt || new Date().toISOString() : order.deliveredAt,
          }
        }),
      )
    }
    window.addEventListener("orderStatusNotification", onStatus)

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener("orderStatusNotification", onStatus)
    }
  }, [])

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12

    return `${day} ${month}, ${displayHours}:${minutes}${ampm}`
  }

  // Filter orders based on search query
  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const restaurantMatch = order.restaurant?.toLowerCase().includes(query)
    const itemsMatch = order.items.some(item =>
      (item.name || item.foodName || '').toLowerCase().includes(query)
    )

    return restaurantMatch || itemsMatch
  })

  const ratingModalHasDeliveryPartner = !!(ratingModal.order?.deliveryPartnerId || ratingModal.order?.deliveryPartnerName)
  const ratingSubmitDisabled = submittingRating ||
    selectedRestaurantRating === null ||
    (ratingModalHasDeliveryPartner && selectedDeliveryRating === null)

  // Handle reorder
  const handleReorder = (order) => {
    const restaurantTarget = order.restaurantSlug || order.restaurantId

    if (!restaurantTarget || !order.items?.length) {
      toast.info('Order items or restaurant information not available')
      return
    }

    const reorderItems = order.items
      .map((item, index) => {
        const itemId = item.id || item.itemId || item._id
        if (!itemId) return null

        return {
          id: itemId,
          name: item.name || item.foodName || "Item",
          price: Number(item.price) || 0,
          image: item.image || "",
          restaurant: order.restaurant || "Restaurant",
          restaurantId: order.restaurantId,
          description: item.description || "",
          isVeg: item.isVeg !== false,
          quantity: Math.max(1, Number(item.quantity) || 1),
          reorderIndex: index,
        }
      })
      .filter(Boolean)

    if (!reorderItems.length) {
      toast.error("No reorderable items found in this order")
      return
    }

    replaceCart(reorderItems)
    toast.success("Items added to cart")
    navigate(`/food/user/restaurants/${restaurantTarget}`)
  }

  // Three-dots menu handlers
  const toggleMenuForOrder = (orderId) => {
    setActiveMenuOrderId((current) => (current === orderId ? null : orderId))
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

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Link copied to clipboard!")
    } catch (error) {
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
    } else if (target === "sms") {
      shareLink = `sms:?body=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "facebook") {
      shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    } else if (target === "x") {
      shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "linkedin") {
      shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
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

  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return
    const shared = await tryNativeShare(sharePayload)
    if (shared) {
      setShowShareModal(false)
      toast.success("Shared successfully")
    }
  }

  const handleShareRestaurant = async (order) => {
    const companyName = await getCompanyNameAsync()
    const location =
      order.restaurantLocation ||
      `${order.address?.city || ""}, ${order.address?.state || ""}`.trim()
    const restaurantPath = order.restaurantSlug || order.restaurantId
    const shareUrl = restaurantPath
      ? `${window.location.origin}/food/user/restaurants/${restaurantPath}`
      : `${window.location.origin}/food/user/orders/${order.id}`

    const shareText = `Check out ${order.restaurant} on ${companyName}.
Location: ${location || "Location not available"}
Order again from this restaurant in the ${companyName} app.`

    const payload = {
      title: order.restaurant,
      text: shareText,
      url: shareUrl,
    }

    try {
      const shared = await tryNativeShare(payload)
      if (shared) {
        toast.success("Restaurant shared successfully")
        return
      }

      openShareModal(payload)
    } catch (error) {
      if (error?.name !== "AbortError") {
        debugError("Error sharing restaurant:", error)
        toast.error("Failed to share restaurant")
      }
    } finally {
      setActiveMenuOrderId(null)
    }
  }

  const handleViewOrderDetails = (order) => {
    setActiveMenuOrderId(null)
    navigate(`/user/orders/${order.id}/details`)
  }

  // Open rating modal for an order
  const handleOpenRating = (order) => {
    setRatingModal({ open: true, order })
    setSelectedRestaurantRating(order.restaurantRating || null)
    setSelectedDeliveryRating(order.deliveryPartnerRating || null)
    setRestaurantFeedbackText(order.ratings?.restaurant?.comment || "")
    setDeliveryFeedbackText(order.ratings?.deliveryPartner?.comment || "")
  }

  const handleCloseRating = () => {
    setRatingModal({ open: false, order: null })
    setSelectedRestaurantRating(null)
    setSelectedDeliveryRating(null)
    setRestaurantFeedbackText("")
    setDeliveryFeedbackText("")
  }

  // Submit rating & feedback to backend
  const handleSubmitRating = async () => {
    const hasDeliveryPartner = !!(ratingModal.order?.deliveryPartnerId || ratingModal.order?.deliveryPartnerName)
    const isMissingDeliveryRating = hasDeliveryPartner && selectedDeliveryRating === null
    if (!ratingModal.order || selectedRestaurantRating === null || isMissingDeliveryRating) {
      toast.error("Please select all required ratings first")
      return
    }

    try {
      setSubmittingRating(true)

      const order = ratingModal.order

      const response = await orderAPI.submitOrderRatings(order.id, {
        restaurantRating: selectedRestaurantRating,
        deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
        restaurantComment: restaurantFeedbackText || undefined,
        deliveryPartnerComment: hasDeliveryPartner ? (deliveryFeedbackText || undefined) : undefined,
      })
      const updatedOrder = response?.data?.data?.order || response?.data?.order || null

      // Update local state so UI shows "You rated"
      setOrders(prev =>
        prev.map(o =>
          o.id === order.id ? {
            ...o,
            restaurantRating: updatedOrder?.ratings?.restaurant?.rating ?? selectedRestaurantRating,
            deliveryPartnerRating: updatedOrder?.ratings?.deliveryPartner?.rating ?? (hasDeliveryPartner ? selectedDeliveryRating : null),
            ratings: updatedOrder?.ratings || {
              restaurant: { rating: selectedRestaurantRating, comment: restaurantFeedbackText || "" },
              deliveryPartner: hasDeliveryPartner ? { rating: selectedDeliveryRating, comment: deliveryFeedbackText || "" } : undefined
            },
            rating: updatedOrder?.ratings?.restaurant?.rating ?? selectedRestaurantRating
          } : o
        )
      )

      toast.success("Thanks for rating your order!")

      // Mark this order as rated so popup doesn't show again (before closing modal)
      const orderId = order.id || order._id || order.mongoId
      setShownRatingForOrders(prev => new Set([...prev, orderId]))

      handleCloseRating()
    } catch (error) {
      debugError("Error submitting order ratings:", error)
      toast.error(
        error?.response?.data?.message ||
        "Failed to submit ratings. Please try again."
      )
    } finally {
      setSubmittingRating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-10">
        <div className="bg-white dark:bg-[#111111] p-4 flex items-center shadow-sm sticky top-0 z-10 border-b border-transparent dark:border-gray-800">
          <button onClick={() => navigate('/food/user')} className="p-1 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-white cursor-pointer" />
          </button>
          <h1 className="ml-4 text-xl font-semibold text-gray-800 dark:text-white">Your Orders</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#FF0000] animate-spin" />
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-10">
        <div className="bg-white dark:bg-[#111111] p-4 flex items-center shadow-sm sticky top-0 z-10 border-b border-transparent dark:border-gray-800">
          <button onClick={() => navigate('/food/user')} className="p-1 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-white cursor-pointer" />
          </button>
          <h1 className="ml-4 text-xl font-semibold text-gray-800 dark:text-white">Your Orders</h1>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600 dark:text-gray-300">You haven't placed any orders yet</p>
          <Link to="/user">
            <button className="mt-4 text-[#FF0000] font-medium">Start Ordering</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-10 font-sans">
      {/* Header */}
      <div className="bg-white dark:bg-[#111111] p-4 flex items-center shadow-sm sticky top-0 z-10 border-b border-transparent dark:border-gray-800">
        <button onClick={() => navigate('/food/user')} className="p-1 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-white cursor-pointer" />
        </button>
        <h1 className="ml-4 text-xl font-semibold text-gray-800 dark:text-white">Your Orders</h1>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-white dark:bg-[#111111] mt-1">
        <div className="flex items-center bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-sm">
          <Search className="w-5 h-5 text-[#FF0000]" />
          <input
            type="text"
            placeholder="Search by restaurant or dish"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 ml-3 outline-none bg-transparent text-gray-600 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 py-2 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-300">No orders found matching your search</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            // Check payment method - COD/wallet orders have 'pending' status which is normal
            const isCodOrWallet = order.payment?.method === 'cash' ||
              order.payment?.method === 'cod' ||
              order.payment?.method === 'wallet' ||
              order.paymentMethod === 'cash' ||
              order.paymentMethod === 'cod' ||
              order.paymentMethod === 'wallet'

            // Payment failed only for online payments (razorpay) that actually failed
            // Don't show payment failed for COD/wallet or cancelled orders
            const isCancelled = order.status === 'cancelled' || order.status === 'restaurant_cancelled'
            const paymentFailed = !isCodOrWallet &&
              !isCancelled &&
              (order.payment?.status === 'failed')

            const isDelivered = order.status === 'delivered'
            const isRestaurantCancelled = order.isRestaurantCancelled || order.status === 'restaurant_cancelled'
            const isUserCancelled = order.isUserCancelled || (isCancelled && order.cancelledBy === 'user')
            // Prefer food image from first item; fallback to restaurant image, then generic food photo
            const firstItemImage = order.items?.[0]?.image
            const restaurantImage = firstItemImage
              || order.restaurantImage
              || "https://images.unsplash.com/photo-1604908176997-125188eb3c52?auto=format&fit=crop&w=200&q=80"
            const location = order.restaurantLocation || `${order.address?.city || ''}, ${order.address?.state || ''}`.trim() || 'Location not available'

            return (
              <div key={order.id} className="relative bg-white dark:bg-[#111111] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                {/* Card Header: Restaurant Info */}
                <div className="flex items-start justify-between p-3 pb-2">
                  <div className="flex gap-2">
                    {/* Restaurant Image */}
                    <div className="w-10 h-10 rounded-md bg-gray-200 overflow-hidden flex-shrink-0">
                      <img
                        src={restaurantImage}
                        alt={order.restaurant}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800 dark:text-white text-lg leading-tight">{order.restaurant}</h3>
                        {isFoodQuickOrder(order) && (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                            Quick
                            {formatQuickEtaWindow(order.etaPromise)
                              ? ` · ${formatQuickEtaWindow(order.etaPromise)}`
                              : ""}
                          </span>
                        )}
                        {order.sla?.breached && Number(order.sla?.compensationAmount) > 0 && (
                          <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                            SLA credit ₹{Math.round(Number(order.sla.compensationAmount))}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Order ID: <span className="font-semibold text-gray-700 dark:text-gray-200">{order.orderId || order.id}</span>
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{location}</p>
                      {order.deliveryPartnerName && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          <span className="font-medium">Delivery:</span> {order.deliveryPartnerName}
                          {order.deliveryPartnerPhone && ` | ${order.deliveryPartnerPhone}`}
                        </p>
                      )}
                      {order.restaurantId && (
                        <Link to={`/user/restaurants/${order.restaurantId}`}>
                          <button className="text-xs text-[#FF0000] font-medium flex items-center mt-1 hover:text-[#C83C00]">
                            View menu <span className="ml-0.5">&gt;</span>
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleMenuForOrder(order.id)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </button>
                </div>

                {/* Three-dots dropdown menu */}
                {activeMenuOrderId === order.id && (
                  <div className="absolute right-3 top-10 z-20 w-40 rounded-xl bg-white dark:bg-[#1a1a1a] shadow-lg border border-gray-100 dark:border-gray-700 py-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleShareRestaurant(order)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-white"
                    >
                      Share restaurant
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewOrderDetails(order)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-white"
                    >
                      Order details
                    </button>
                  </div>
                )}

                {/* Separator */}
                <div className="border-t border-dashed border-gray-200 dark:border-gray-700 mx-3 my-1"></div>

                {/* Items List */}
                <div className="px-3 py-1 space-y-1">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => {
                      const isVeg = item.isVeg !== undefined ? item.isVeg : (item.category === 'veg' || item.type === 'veg')
                      const itemName = item.name || item.foodName || 'Item'
                      const itemQuantity = item.quantity || 1
                      const itemPrice = item.price || 0
                      const itemTotal = itemQuantity * itemPrice
                      const itemImage = item.image || null

                      return (
                        <div key={item._id || item.id || item.itemId || idx} className="flex items-start gap-2">
                          {/* Item Image */}
                          {itemImage && (
                            <div className="w-8 h-8 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                              <img
                                src={itemImage}
                                alt={itemName}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1.5">
                              {/* Veg/Non-Veg Icon */}
                              <div className={`w-3 h-3 border ${isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center p-[1px] flex-shrink-0 mt-0.5`}>
                                <div className={`w-full h-full rounded-full ${isVeg ? 'bg-green-600' : 'bg-red-600'}`}></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-800 dark:text-white font-medium block">
                                  {itemQuantity} x {itemName}
                                </span>
                                {item.variantName ? (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.variantName}</p>
                                ) : null}
                                {item.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className="text-sm font-semibold text-gray-800 dark:text-white">{"\u20B9"}{itemTotal.toFixed(2)}</span>
                                {itemQuantity > 1 && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{"\u20B9"}{itemPrice.toFixed(2)} each</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No items found</p>
                  )}
                </div>

                {/* Order Summary Section */}
                <div className="px-3 py-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-md mx-3 my-1.5">
                  <div className="space-y-1">
                    {order.subtotal > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">Subtotal</span>
                        <span className="text-gray-800 dark:text-white font-medium">{"\u20B9"}{order.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {order.deliveryFee > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">Delivery Fee</span>
                        <span className="text-gray-800 dark:text-white font-medium">{"\u20B9"}{order.deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    {(order.pricing?.platformFee || order.platformFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">Platform Fee</span>
                        <span className="text-gray-800 dark:text-white font-medium">{"\u20B9"}{(order.pricing?.platformFee || order.platformFee).toFixed(2)}</span>
                      </div>
                    )}
                    {(order.pricing?.packagingFee || order.packagingFee) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">Packaging Fee</span>
                        <span className="text-gray-800 dark:text-white font-medium">{"\u20B9"}{(order.pricing?.packagingFee || order.packagingFee).toFixed(2)}</span>
                      </div>
                    )}
                    {order.tax > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">Tax</span>
                        <span className="text-gray-800 dark:text-white font-medium">{"\u20B9"}{order.tax.toFixed(2)}</span>
                      </div>
                    )}
                    {order.pricing?.discount > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-green-600">Discount</span>
                        <span className="text-green-600 font-medium">-{"\u20B9"}{order.pricing.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {order.pricing?.couponCode && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-300">Coupon Applied</span>
                        <span className="text-gray-800 dark:text-white font-medium">{order.pricing.couponCode}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-1.5 mt-1.5">
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">Total</span>
                        <span className="text-base font-bold text-gray-900 dark:text-white">{"\u20B9"}{order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Date and Payment Info */}
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Order placed on {formatDate(order.createdAt)}</p>
                    {order.deliveredAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Delivered on {formatDate(order.deliveredAt)}</p>
                    )}
                    {order.payment && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Payment: <span className="font-medium capitalize">
                          {order.payment.method === 'cash' || order.payment.method === 'cod' ? 'Cash on Delivery' :
                            order.payment.method === 'wallet' ? 'Wallet' :
                              order.payment.method === 'razorpay' ? 'Online' :
                                order.payment.method || 'N/A'}
                        </span>
                        {order.payment.status && (
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${(order.payment.status === 'paid' || order.payment.status === 'completed' || order.payment.status === 'captured') ? 'bg-green-100 text-green-700' :
                              (order.payment.status === 'failed' || order.payment.status === 'cancelled') ? 'bg-red-100 text-red-700' :
                                (order.payment.status === 'pending' || order.payment.status === 'cod_pending' || order.payment.status === 'created' || order.payment.status === 'pending_qr') ? 'bg-yellow-100 text-yellow-700' :
                                  (order.payment.status === 'refunded') ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-700'
                            }`}>
                            {order.payment.status === 'cod_pending' || order.payment.status === 'created' || order.payment.status === 'pending_qr' ? 'Pending' :
                              order.payment.status === 'paid' || order.payment.status === 'captured' ? 'Paid' :
                                order.payment.status}
                          </span>
                        )}
                      </p>
                    )}
                    {isDelivered && !paymentFailed && (
                      <p className="text-xs font-medium text-green-600 mt-1">Delivered</p>
                    )}
                    {isRestaurantCancelled && (
                      <p className="text-xs font-medium text-red-500 mt-1">
                        {order.cancellationLabel || getCancellationDisplayLabel(order) || "Restaurant Cancelled"}
                      </p>
                    )}
                    {isUserCancelled && (
                      <p className="text-xs font-medium text-gray-500 mt-1">Cancelled by you</p>
                    )}
                    {isCancelled && !isRestaurantCancelled && !isUserCancelled && (
                      <p className="text-xs font-medium text-gray-500 mt-1">Cancelled</p>
                    )}
                    {order.status === 'scheduled' && (() => {
                      const parts = formatScheduledAtParts(order.scheduledAt)
                      const countdown = countdowns[order.id]
                      if (!parts) return null
                      return (
                      <div className="flex flex-col gap-0.5 mt-1.5 p-2 bg-blue-50 border border-blue-100 rounded-lg w-fit">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-tight">
                            Scheduled For
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-blue-800 pl-5">
                          {parts.dateLabel}
                        </span>
                        <span className="text-xs font-semibold text-blue-800 pl-5">
                          {parts.timeLabel}
                        </span>
                        {countdown != null && (
                          <span className="text-[10px] font-medium text-blue-600 pl-5 mt-0.5">
                            {typeof countdown === "string" ? countdown : `${countdown} min left`}
                          </span>
                        )}
                      </div>
                      )
                    })()}
                  </div>
                  <div className="flex items-center ml-4">
                    <Link to={`/user/orders/${order.id}`}>
                      <button className="text-xs text-[#FF0000] font-medium hover:text-[#C83C00] flex items-center gap-1">
                        View Details
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-100 dark:border-gray-800 mx-4"></div>

                {/* Card Footer: Actions */}
                <div className="px-4 py-3 flex items-center justify-between">
                  {/* Left Side: Rating or Error */}
                  {isRestaurantCancelled ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="bg-red-100 p-1 rounded-full">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <span className="text-xs font-semibold text-red-500">
                          {order.cancellationLabel || getCancellationDisplayLabel(order) || "Restaurant Cancelled"}
                        </span>
                      </div>
                      {order.payment?.method !== 'cash' && order.payment?.method !== 'cod' && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 ml-7">Refund will be processed in 24-48 hours</p>
                      )}
                    </div>
                  ) : paymentFailed ? (
                    <div className="flex items-center gap-2">
                      <div className="bg-red-100 p-1 rounded-full">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <span className="text-xs font-semibold text-red-500">Payment failed</span>
                    </div>
                  ) : isDelivered && order.restaurantRating && (!order.deliveryPartnerId || order.deliveryPartnerRating) ? (
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-gray-800 dark:text-white">You rated</span>
                        <div className="flex bg-yellow-400 text-white px-1 rounded text-[10px] items-center gap-0.5 h-4">
                          R {order.restaurantRating}<Star className="w-2 h-2 fill-current" />
                        </div>
                        {order.deliveryPartnerId && (
                          <div className="flex bg-blue-500 text-white px-1 rounded text-[10px] items-center gap-0.5 h-4">
                            D {order.deliveryPartnerRating}<Star className="w-2 h-2 fill-current" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : isDelivered ? (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Order delivered</p>
                      <button
                        type="button"
                        onClick={() => handleOpenRating(order)}
                        className="text-xs text-[#FF0000] font-medium mt-0.5 flex items-center"
                      >
                        Rate restaurant & delivery <span className="ml-0.5">&gt;</span>
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{(() => {
                        const life = getLifecycleDisplay(order, { audience: "user" });
                        if (life) return life.timelineLabel || life.subtitle;
                        return order.status === 'preparing' ? 'Preparing' : order.status === 'outForDelivery' ? 'Out for delivery' : order.status === 'confirmed' ? 'Order confirmed' : order.status === 'scheduled' ? 'Scheduled' : '';
                      })()}</p>
                      {/* Countdown Timer */}
                      {countdowns[order.id] && countdowns[order.id] > 0 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-[#FF0000] font-medium">
                          <Clock size={12} />
                          <span>{countdowns[order.id]} min{countdowns[order.id] !== 1 ? 's' : ''} remaining</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Right Side: Reorder Button */}
                  {isDelivered && !paymentFailed && (
                    <button
                      onClick={() => handleReorder(order)}
                      className="bg-[#FF0000] hover:bg-[#C83C00] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reorder
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Branding */}
      <div className="flex justify-center mt-8 mb-4">
        <h1 className="text-4xl font-bold text-gray-200 dark:text-gray-700 tracking-tighter italic">Blaze</h1>
      </div>

      {/* Rating & Feedback Modal */}
      {ratingModal.open && ratingModal.order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-[#FF0000] to-[#C83C00] px-6 py-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Star className="w-5 h-5 fill-white" />
                  Rate Your Delivery
                </h2>
                <button
                  type="button"
                  onClick={handleCloseRating}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                >
                  <span className="text-xl">x</span>
                </button>
              </div>
              <p className="text-sm text-white/90">{ratingModal.order.restaurant}</p>
            </div>

            <div className="px-6 py-6">
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Restaurant rating (out of 5)
                </p>
                <div className="flex items-center justify-center gap-2 mb-3">
                  {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => {
                    const isActive = (selectedRestaurantRating || 0) >= num
                    return (
                      <button
                        key={`restaurant-${num}`}
                        type="button"
                        onClick={() => setSelectedRestaurantRating(num)}
                        className="p-2 transition-transform hover:scale-125 active:scale-95"
                      >
                        <Star
                          className={`w-10 h-10 transition-all ${isActive
                            ? "text-yellow-400 fill-yellow-400 drop-shadow-lg"
                            : "text-gray-300 hover:text-yellow-200"
                            }`}
                        />
                      </button>
                    )
                  })}
                </div>
                <textarea
                  rows={2}
                  value={restaurantFeedbackText}
                  onChange={(e) => setRestaurantFeedbackText(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] resize-none transition-all"
                  placeholder="Restaurant feedback (optional)"
                />
              </div>

              {ratingModalHasDeliveryPartner && (
                <div className="mb-6">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    Delivery partner rating (out of 5)
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    {Array.from({ length: 5 }, (_, i) => i + 1).map((num) => {
                      const isActive = (selectedDeliveryRating || 0) >= num
                      return (
                        <button
                          key={`delivery-${num}`}
                          type="button"
                          onClick={() => setSelectedDeliveryRating(num)}
                          className="p-2 transition-transform hover:scale-125 active:scale-95"
                        >
                          <Star
                            className={`w-10 h-10 transition-all ${isActive
                              ? "text-yellow-400 fill-yellow-400 drop-shadow-lg"
                              : "text-gray-300 hover:text-yellow-200"
                              }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    rows={2}
                    value={deliveryFeedbackText}
                    onChange={(e) => setDeliveryFeedbackText(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] resize-none transition-all"
                    placeholder="Delivery partner feedback (optional)"
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                disabled={ratingSubmitDisabled}
                onClick={handleSubmitRating}
                className="w-full rounded-xl bg-gradient-to-r from-[#FF0000] to-[#C83C00] text-white text-base font-bold py-3.5 hover:from-[#C83C00] hover:to-[#C83C00] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg ring-red-500/30 flex items-center justify-center gap-2"
              >
                {submittingRating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Star className="w-5 h-5 fill-white" />
                    Submit Ratings
                  </>
                )}
              </button>

              {ratingSubmitDisabled && (
                <p className="text-xs text-center text-red-500 mt-2">Please select all required ratings to continue</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showShareModal && sharePayload && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 pt-10 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Share restaurant</h3>
                <p className="text-xs text-gray-500 mt-0.5">Native share available ho to sab supported apps wahan dikhenge</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close share modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  type="button"
                  onClick={handleSystemShareFromModal}
                  className="w-full rounded-2xl bg-[#FF0000] px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 hover:bg-[#C83C00] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share via apps
                </button>
              )}

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => openShareTarget("whatsapp")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("telegram")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <Send className="w-5 h-5 text-sky-500" />
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("email")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <Mail className="w-5 h-5 text-rose-500" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("sms")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <MessagesSquare className="w-5 h-5 text-violet-500" />
                  SMS
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("facebook")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <Share2 className="w-5 h-5 text-blue-600" />
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("x")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <Link2 className="w-5 h-5 text-gray-900" />
                  X
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("linkedin")}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <Share2 className="w-5 h-5 text-blue-700" />
                  LinkedIn
                </button>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="rounded-2xl border border-gray-200 px-3 py-4 text-xs font-medium text-gray-700 flex flex-col items-center gap-2 hover:bg-gray-50"
                >
                  <Copy className="w-5 h-5 text-gray-600" />
                  Copy link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

