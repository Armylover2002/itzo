import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import io from "socket.io-client"
import { FileText, Calendar, Package } from "lucide-react"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import OrdersTable from "@food/components/admin/orders/OrdersTable"
import FilterPanel from "@food/components/admin/orders/FilterPanel"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import RefundModal from "@food/components/admin/orders/RefundModal"
import { useOrdersManagement } from "@food/components/admin/orders/useOrdersManagement"
import { Loader2 } from "lucide-react"
import { OrdersDashboardSkeleton } from "@food/components/ui/loading-skeletons"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"
import alertSound from "@food/assets/audio/alert.mp3"
import originalSound from "@food/assets/audio/original.mp3"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}
const USER_CANCEL_FULL_REFUND_WINDOW_MS = 30 * 1000


// Status configuration with titles, colors, and icons
const statusConfig = {
  "all": { title: "All Orders", color: "emerald", icon: FileText },
  "scheduled": { title: "Scheduled Orders", color: "blue", icon: Calendar },
  "pending": { title: "Pending Orders", color: "amber", icon: Package },
  "accepted": { title: "Accepted Orders", color: "green", icon: Package },
  "processing": { title: "Processing Orders", color: "orange", icon: Package },
  "food-on-the-way": { title: "Food On The Way Orders", color: "amber", icon: Package },
  "delivered": { title: "Delivered Orders", color: "emerald", icon: Package },
  "canceled": { title: "Canceled Orders", color: "rose", icon: Package },
  "restaurant-cancelled": { title: "Restaurant Cancelled Orders", color: "red", icon: Package },
  "payment-failed": { title: "Payment Failed Orders", color: "red", icon: Package },
  "refunded": { title: "Refunded Orders", color: "sky", icon: Package },
  "offline-payments": { title: "Offline Payments", color: "slate", icon: Package },
}

export default function OrdersPage({ statusKey = "all" }) {
  const config = statusConfig[statusKey] || statusConfig["all"]
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [processingRefund, setProcessingRefund] = useState(null)
  const [processingActionOrderId, setProcessingActionOrderId] = useState(null)
  const [deletingOrderId, setDeletingOrderId] = useState(null)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null)
  const showLoadingSkeleton = useDelayedLoading(isLoading, { delay: 120, minDuration: 360 })
  const seenOrderIdsRef = useRef(new Set())
  const isFirstLoadRef = useRef(true)
  const fallbackAudioRef = useRef(null)
  const notificationAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioUnlockedRef = useRef(false)
  const socketRef = useRef(null)
  const recentRealtimeOrderRef = useRef(new Map())
  const activeOrderAlertRef = useRef(null)
  const alertLoopTimerRef = useRef(null)
  const alertLoopStartedAtRef = useRef(0)
  const ALERT_LOOP_INTERVAL_MS = 4500
  const ALERT_LOOP_MAX_MS = 120000

  const resolveAudioSource = useCallback((source, cacheKey = "admin-alert") => {
    if (!source) return source
    if (!import.meta.env.DEV) return source
    const separator = source.includes("?") ? "&" : "?"
    return `${source}${separator}devcache=${cacheKey}`
  }, [])

  const playDeliveryStyleBuzz = useCallback(async () => {
    const selectedSound = localStorage.getItem("delivery_alert_sound") || "zomato_tone"
    const soundFile = selectedSound === "original"
      ? resolveAudioSource(originalSound, "admin-original")
      : resolveAudioSource(alertSound, "admin-alert")

    try {
      if (!notificationAudioRef.current) {
        notificationAudioRef.current = new Audio(soundFile)
        notificationAudioRef.current.preload = "auto"
        notificationAudioRef.current.volume = 1
      } else if (!notificationAudioRef.current.src.includes(soundFile.split("/").pop())) {
        notificationAudioRef.current.pause()
        notificationAudioRef.current.src = soundFile
        notificationAudioRef.current.load()
      }

      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([200, 100, 200, 100, 300])
      }

      notificationAudioRef.current.muted = false
      notificationAudioRef.current.volume = 1
      notificationAudioRef.current.currentTime = 0
      await notificationAudioRef.current.play()
      return true
    } catch (_) {
      return false
    }
  }, [resolveAudioSource])

  const playDefaultRing = useCallback(() => {
    playDeliveryStyleBuzz().then((played) => {
      if (played) return

      try {
        if (!fallbackAudioRef.current) {
          fallbackAudioRef.current = new Audio(alertSound)
          fallbackAudioRef.current.preload = "auto"
          fallbackAudioRef.current.volume = 1
        }

        fallbackAudioRef.current.muted = false
        fallbackAudioRef.current.volume = 1
        fallbackAudioRef.current.currentTime = 0
        fallbackAudioRef.current.play().catch(() => {})
      } catch (_) {}

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx()
        }
        const ctx = audioContextRef.current
        const playWithContext = async () => {
          if (ctx.state === "suspended") {
            await ctx.resume()
          }

          const beep = (startAt, frequency = 880, duration = 0.2) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = "sine"
            osc.frequency.value = frequency
            gain.gain.value = 0.0001
            osc.connect(gain)
            gain.connect(ctx.destination)

            const start = ctx.currentTime + startAt
            osc.start(start)
            gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
            osc.stop(start + duration + 0.02)
          }

          beep(0, 880, 0.2)
          beep(0.26, 880, 0.2)
          beep(0.52, 988, 0.26)

          setTimeout(() => {
            if (ctx.state === "running") {
              ctx.suspend().catch(() => {})
            }
          }, 1200)
        }
        playWithContext().catch(async () => {
          if (fallbackAudioRef.current) {
            fallbackAudioRef.current.currentTime = 0
            await fallbackAudioRef.current.play()
          }
        })
        return
      }
    }).catch((error) => {
      debugWarn("Ring sound could not be played:", error)
    })
  }, [playDeliveryStyleBuzz])

  const stopAlertLoop = useCallback(() => {
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current)
      alertLoopTimerRef.current = null
    }
    alertLoopStartedAtRef.current = 0
  }, [])

  const startAlertLoop = useCallback(() => {
    stopAlertLoop()
    alertLoopStartedAtRef.current = Date.now()

    alertLoopTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - alertLoopStartedAtRef.current
      if (elapsed >= ALERT_LOOP_MAX_MS || !activeOrderAlertRef.current) {
        stopAlertLoop()
        return
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        playDefaultRing()
      }
    }, ALERT_LOOP_INTERVAL_MS)
  }, [playDefaultRing, stopAlertLoop])

  const showBrowserNotification = useCallback(async (title, body, tag) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return
    if (Notification.permission !== "granted") return

    try {
      const options = {
        body,
        tag: tag || undefined,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 300],
        icon: "/favicon.ico",
        data: { targetUrl: "/ecs/orders/all" },
      }

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          await registration.showNotification(title, options)
          return
        }
      }

      const notification = new Notification(title, options)
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (_) {}
  }, [])

  // Unlock audio on first user gesture so rings can play reliably later
  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return

      try {
        if (!fallbackAudioRef.current) {
          fallbackAudioRef.current = new Audio(alertSound)
          fallbackAudioRef.current.preload = "auto"
          fallbackAudioRef.current.volume = 1
        }

        // Prime media element playback permission
        fallbackAudioRef.current.muted = true
        await fallbackAudioRef.current.play()
        fallbackAudioRef.current.pause()
        fallbackAudioRef.current.currentTime = 0
        fallbackAudioRef.current.muted = false

        if (!notificationAudioRef.current) {
          const selectedSound = localStorage.getItem("delivery_alert_sound") || "zomato_tone"
          const soundFile = selectedSound === "original"
            ? resolveAudioSource(originalSound, "admin-original")
            : resolveAudioSource(alertSound, "admin-alert")
          notificationAudioRef.current = new Audio(soundFile)
          notificationAudioRef.current.preload = "auto"
          notificationAudioRef.current.volume = 1
        }
        notificationAudioRef.current.muted = true
        await notificationAudioRef.current.play()
        notificationAudioRef.current.pause()
        notificationAudioRef.current.currentTime = 0
        notificationAudioRef.current.muted = false

        // Prime WebAudio permission
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx && !audioContextRef.current) {
          audioContextRef.current = new AudioCtx()
        }
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
        }
        if (audioContextRef.current?.state === "running") {
          await audioContextRef.current.suspend()
        }

        audioUnlockedRef.current = true
      } catch {
        // Ignore unlock errors; we'll retry on next gesture implicitly
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true })
    window.addEventListener("keydown", unlockAudio)
    window.addEventListener("touchstart", unlockAudio, { passive: true })
    document.addEventListener("click", unlockAudio, { passive: true })
    document.addEventListener("touchstart", unlockAudio, { passive: true })

    return () => {
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      window.removeEventListener("touchstart", unlockAudio)
      document.removeEventListener("click", unlockAudio)
      document.removeEventListener("touchstart", unlockAudio)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopAlertLoop()
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {})
      }
      if (notificationAudioRef.current) {
        notificationAudioRef.current.pause()
        notificationAudioRef.current = null
      }
    }
  }, [stopAlertLoop])

  useEffect(() => {
    if (statusKey !== "all") return
    if (typeof window === "undefined" || typeof Notification === "undefined") return
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [statusKey])

  const fetchOrders = useCallback(async (options = {}) => {
    const { silent = false, withRingCheck = false } = options

    try {
      if (!silent) setIsLoading(true)
      const params = {
        page: 1,
        limit: 1000,
        status:
          statusKey === "all"
            ? undefined
            : statusKey === "restaurant-cancelled"
              ? "cancelled"
              : statusKey,
        cancelledBy: statusKey === "restaurant-cancelled" ? "restaurant" : undefined,
      }

      const response = await adminAPI.getOrders(params)

      const rawOrders =
        response?.data?.data?.orders ??
        response?.data?.orders ??
        response?.data?.data?.docs ??
        response?.data?.data
      const nextOrders = Array.isArray(rawOrders) ? rawOrders : []

      if (response.data?.success) {
        const nextOrderIds = new Set(
          nextOrders
            .map((order) => order.id || order._id || order.orderId)
            .filter(Boolean),
        )

        if (withRingCheck && !isFirstLoadRef.current && statusKey === "all") {
          const hasNewOrder = [...nextOrderIds].some(
            (id) => !seenOrderIdsRef.current.has(id),
          )
          if (hasNewOrder) {
            activeOrderAlertRef.current = { orderId: "polling-new-order" }
            playDefaultRing()
            startAlertLoop()
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
              showBrowserNotification(
                "New order received",
                "A new order arrived",
                `admin-order-poll-${Date.now()}`,
              )
            }
            toast.info("New order received")
          }
        }

        seenOrderIdsRef.current = nextOrderIds
        isFirstLoadRef.current = false
        setOrders(nextOrders)
      } else {
        debugError("Failed to fetch orders:", response.data)
        if (!silent) toast.error("Failed to fetch orders")
        setOrders([])
      }
    } catch (error) {
      debugError("Error fetching orders:", error)
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to fetch orders")
      }
      setOrders([])
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [statusKey, playDefaultRing, showBrowserNotification, startAlertLoop])

  const normalizedOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : []

    return safeOrders.filter(Boolean).map((order) => {
      const createdAtRaw = order.createdAt || order.created_at || order.orderDate || null
      const createdAtCandidate = createdAtRaw ? new Date(createdAtRaw) : null
      const createdAt =
        createdAtCandidate && !Number.isNaN(createdAtCandidate.getTime())
          ? createdAtCandidate
          : null
      const date = createdAt
        ? createdAt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).toUpperCase()
        : ""
      const time = createdAt
        ? createdAt.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).toUpperCase()
        : ""

      const pricing = order.pricing || {}
      const subtotal = Number(pricing.subtotal || 0)
      const deliveryFee = Number(pricing.deliveryFee || 0)
      const platformFee = Number(pricing.platformFee || 0)
      const taxAmount = Number(pricing.tax || 0)
      const discountAmount = Number(pricing.discount || 0)
      const computedTotal = subtotal + deliveryFee + platformFee + taxAmount - discountAmount
      const totalAmount = Number(
        pricing.total != null ? pricing.total : computedTotal
      )

      const paymentMethod = order.payment?.method || order.paymentMethod || ""
      const rawOrderType = String(order.orderType || "").toLowerCase().trim()
      const orderType =
        rawOrderType === "mixed"
          ? "Mixed"
          : rawOrderType === "quick"
            ? "Quick"
            : "Food"
      let paymentType = order.paymentType
      if (!paymentType) {
        if (paymentMethod === "cash" || paymentMethod === "cod") paymentType = "Cash on Delivery"
        else if (paymentMethod === "wallet") paymentType = "Wallet"
        else if (paymentMethod) paymentType = "Online"
        else paymentType = "N/A"
      }

      const paymentStatusRaw = order.payment?.status || ""
      let paymentStatus = order.paymentStatus
      if (!paymentStatus) {
        const s = String(paymentStatusRaw || "").toLowerCase()
        if (s === "refunded") paymentStatus = "Refunded"
        else if (s === "paid" || s === "authorized" || s === "captured" || s === "settled") paymentStatus = "Paid"
        else if (s === "failed") paymentStatus = "Failed"
        else paymentStatus = "Pending"
      }

      const backendStatus = String(order.orderStatus || "").toLowerCase()
      const cancelledAtCandidate = Array.isArray(order.statusHistory)
        ? [...order.statusHistory]
            .reverse()
            .find((entry) => String(entry?.to || "").toLowerCase() === backendStatus)?.at
        : null
      const cancelledAt = cancelledAtCandidate ? new Date(cancelledAtCandidate) : null
      const cancelledAtMs =
        cancelledAt && !Number.isNaN(cancelledAt.getTime())
          ? cancelledAt.getTime()
          : null
      const createdAtMs = createdAt ? createdAt.getTime() : null
      const cancellationElapsedMs =
        createdAtMs !== null && cancelledAtMs !== null ? cancelledAtMs - createdAtMs : null
      let displayStatus = order.orderStatus
      if (!backendStatus || backendStatus === "created" || backendStatus === "confirmed") {
        displayStatus = "Pending"
      } else if (backendStatus === "preparing" || backendStatus === "ready_for_pickup") {
        displayStatus = "Processing"
      } else if (backendStatus === "picked_up") {
        displayStatus = "Food On The Way"
      } else if (backendStatus === "delivered") {
        displayStatus = "Delivered"
      } else if (backendStatus === "cancelled_by_restaurant") {
        displayStatus = "Cancelled by Restaurant"
      } else if (backendStatus === "cancelled_by_user") {
        displayStatus = "Cancelled by User"
      } else if (backendStatus === "cancelled_by_admin") {
        displayStatus = "Canceled"
      }

      const dp = order.dispatch?.deliveryPartnerId
      const deliveryPartnerName =
        order.deliveryPartnerName ||
        dp?.name ||
        ""
      const deliveryPartnerPhone =
        order.deliveryPartnerPhone ||
        dp?.phone ||
        ""

      const items = Array.isArray(order.items)
        ? order.items.map((item) => ({
            quantity: item.quantity || 1,
            name: item.name || item.foodName || item.title || "Item",
            price: item.price || 0,
          }))
        : []

      const customerName = order.customerName || order.userId?.name || "N/A"
      const customerPhone = order.customerPhone || order.userId?.phone || "N/A"
      const restaurant =
        order.restaurant ||
        order.restaurantName ||
        order.restaurantId?.restaurantName ||
        ""

      return {
        ...order,
        id: order._id || order.id,
        orderId: order.orderId || order.id,
        date,
        time,
        orderType,
        customerName,
        customerPhone,
        restaurant,
        items,
        subtotal,
        totalItemAmount: subtotal,
        couponDiscount: discountAmount,
        itemDiscount: 0,
        deliveryCharge: deliveryFee,
        vatTax: taxAmount,
        platformFee,
        totalAmount,
        paymentType,
        paymentStatus,
        orderStatus: displayStatus,
        deliveryPartnerName,
        deliveryPartnerPhone,
        deliveryType: order.deliveryType || "Home Delivery",
        orderOtp: order.deliveryOtp,
        address: order.address || order.customerAddress || order.deliveryAddress,
        refundStatus: order.payment?.refund?.status || (order.payment?.status === 'refunded' ? 'processed' : null),
        refundPreference: {
          requestedMethod: order.payment?.refund?.requestedMethod || null,
          processedMethod: order.payment?.refund?.processedMethod || null,
          requestedByUser: Boolean(order.payment?.refund?.requestedByUser),
        },
        refundPolicy: {
          isUserCancelledOnline:
            backendStatus === "cancelled_by_user" &&
            ["razorpay", "razorpay_qr"].includes(String(paymentMethod || "").toLowerCase()),
          allowPartialRefund:
            backendStatus === "cancelled_by_user" &&
            ["razorpay", "razorpay_qr"].includes(String(paymentMethod || "").toLowerCase()) &&
            cancellationElapsedMs !== null &&
            cancellationElapsedMs > USER_CANCEL_FULL_REFUND_WINDOW_MS,
          requiresFullRefund:
            backendStatus === "cancelled_by_admin" ||
            backendStatus === "cancelled_by_restaurant" ||
            paymentMethod === "wallet" ||
            (
              backendStatus === "cancelled_by_user" &&
              ["razorpay", "razorpay_qr"].includes(String(paymentMethod || "").toLowerCase()) &&
              (
                cancellationElapsedMs === null ||
                cancellationElapsedMs <= USER_CANCEL_FULL_REFUND_WINDOW_MS
              )
            ),
          cancellationElapsedMs,
        },
      }
    })
  }, [orders])

  const {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredOrders,
    count,
    activeFiltersCount,
    restaurants,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  } = useOrdersManagement(normalizedOrders, statusKey, config.title)

  useEffect(() => {
    isFirstLoadRef.current = true
    seenOrderIdsRef.current = new Set()
    fetchOrders({ silent: false, withRingCheck: false })
  }, [fetchOrders])

  useEffect(() => {
    if (statusKey !== "all") return undefined

    const pollId = setInterval(() => {
      fetchOrders({ silent: true, withRingCheck: true })
    }, 5000)

    return () => clearInterval(pollId)
  }, [statusKey, fetchOrders])

  useEffect(() => {
    if (statusKey !== "all") return undefined

    const backendUrl = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")
    // Backend disconnected - do not open Socket.IO (new backend in progress)
    if (!API_BASE_URL || !backendUrl || !backendUrl.startsWith("http")) {
      return undefined
    }

    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })
    socketRef.current = socket

    const handleIncomingRealtimeOrder = (payload = {}) => {
      const orderId = payload?.orderId || payload?.orderMongoId || ""
      if (!orderId) {
        activeOrderAlertRef.current = payload || { orderId: "socket-new-order" }
        playDefaultRing()
        startAlertLoop()
        toast.info("New order received")
        showBrowserNotification(
          "New order received",
          "A new order arrived",
          `admin-order-socket-${Date.now()}`,
        )
        fetchOrders({ silent: true, withRingCheck: false })
        return
      }

      const now = Date.now()
      const lastHandledAt = recentRealtimeOrderRef.current.get(orderId) || 0
      if (now - lastHandledAt < 8000) return
      recentRealtimeOrderRef.current.set(orderId, now)

      const title = "New order received"
      const body = payload?.restaurantName
        ? `${payload.restaurantName} • ${orderId}`
        : `Order ${orderId}`

      activeOrderAlertRef.current = payload || { orderId }
      playDefaultRing()
      startAlertLoop()
      toast.info(title, { description: body })
      showBrowserNotification(title, body, `admin-order-${orderId}`)
      fetchOrders({ silent: true, withRingCheck: false })
    }

    socket.on("connect", () => {
      socket.emit("join-admin-orders")
    })
    socket.on("admin_new_order", handleIncomingRealtimeOrder)
    socket.on("play_notification_sound", handleIncomingRealtimeOrder)

    return () => {
      socket.off("admin_new_order", handleIncomingRealtimeOrder)
      socket.off("play_notification_sound", handleIncomingRealtimeOrder)
      socket.disconnect()
      socketRef.current = null
    }
  }, [statusKey, fetchOrders, playDefaultRing, showBrowserNotification, startAlertLoop])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState !== "hidden") return
      if (!activeOrderAlertRef.current) return

      playDefaultRing()
      showBrowserNotification(
        "New order received",
        "A new order arrived",
        `admin-order-hidden-${Date.now()}`,
      )
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [playDefaultRing, showBrowserNotification])

  const [searchParams] = useSearchParams()
  const orderIdFromUrl = searchParams.get("orderId")

  useEffect(() => {
    if (orderIdFromUrl && normalizedOrders.length > 0) {
      const order = normalizedOrders.find(o => o.id === orderIdFromUrl || o._id === orderIdFromUrl || o.orderId === orderIdFromUrl)
      if (order) {
        handleViewOrder(order)
      }
    }
  }, [orderIdFromUrl, normalizedOrders, handleViewOrder])

  const handleAcceptOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.acceptOrder(orderIdToUse)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} accepted`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to accept order")
      }
    } catch (error) {
      debugError("Error accepting order:", error)
      toast.error(error.response?.data?.message || "Failed to accept order")
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleRejectOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    const reason = prompt(
      `Enter rejection reason for order ${order.orderId}:`,
      "Order rejected by admin",
    )

    if (reason === null) return

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.rejectOrder(orderIdToUse, reason)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} rejected`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to reject order")
      }
    } catch (error) {
      debugError("Error rejecting order:", error)
      toast.error(error.response?.data?.message || "Failed to reject order")
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleDeleteOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    const shouldDelete = confirm(
      `Delete order ${order.orderId} permanently?\n\nThis will remove it from customer and delivery apps as well.`,
    )

    if (!shouldDelete) return

    try {
      setDeletingOrderId(order.id || order.orderId)
      const response = await adminAPI.deleteOrder(orderIdToUse)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} deleted`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to delete order")
      }
    } catch (error) {
      debugError("Error deleting order:", error)
      toast.error(error.response?.data?.message || "Failed to delete order")
    } finally {
      setDeletingOrderId(null)
    }
  }

  // Handle refund button click
  const handleRefund = (order) => {
    setSelectedOrderForRefund(order)
    setRefundModalOpen(true)
  }

  // Process refund with amount
  const processRefund = async (order, refundAmount = null, refundTo = null) => {
    // Try using MongoDB _id first (more reliable for route matching), then fallback to orderId string
    // Backend accepts either MongoDB ObjectId (24 chars) or orderId string
    // Using MongoDB _id is more reliable for route matching (no dashes/special chars)
    const orderIdToUse = order.id || order._id || order.orderId
    
    if (!orderIdToUse) {
      debugError('? No orderId found in order object:', order)
      toast.error('Order ID not found. Please refresh the page and try again.')
      return
    }
    
    debugLog('?? Order details for refund:', {
      orderIdString: order.orderId,
      mongoId: order.id,
      orderIdToUse,
      willUse: order.orderId ? 'orderId string' : 'MongoDB _id',
      refundAmount
    })

    try {
      setProcessingRefund(orderIdToUse)
      
      debugLog('?? Processing refund for order:', {
        orderId: order.orderId,
        id: order.id,
        _id: order._id,
        orderIdToUse,
        refundAmount,
        url: `/api/admin/orders/${orderIdToUse}/refund`
      })
      
      // Include refundAmount in request body if provided (ensure it's a number)
      const requestData = {
        ...(refundAmount !== null ? { refundAmount: parseFloat(refundAmount) } : {}),
        ...(refundTo ? { refundTo } : {}),
      }
      debugLog('?? Request data being sent:', requestData)
      const response = await adminAPI.processRefund(orderIdToUse, requestData)
      
      if (response.data?.success) {
        const effectiveRefundMethod =
          refundTo ||
          order?.refundPreference?.requestedMethod ||
          (order.paymentType === "Wallet" || order.payment?.method === "wallet" ? "wallet" : "gateway")
        const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet";
        toast.success(response.data?.message || (isWalletPayment 
          ? `Wallet refund of \u20B9${refundAmount || order.totalAmount} processed successfully for order ${order.orderId}`
          : `Refund to ${effectiveRefundMethod === "wallet" ? "wallet" : "original payment method"} processed successfully for order ${order.orderId}`))
        // Update the order in the local state immediately to show "Refunded" status
        setOrders(prevOrders => 
          prevOrders.map(o => 
            (o.id === order.id || o.orderId === order.orderId)
              ? {
                  ...o,
                  refundStatus: 'processed',
                  payment: {
                    ...(o.payment || {}),
                    refund: {
                      ...(o.payment?.refund || {}),
                      status: 'processed',
                      processedMethod: effectiveRefundMethod,
                      requestedMethod:
                        o.payment?.refund?.requestedMethod || effectiveRefundMethod,
                    },
                  },
                }
              : o
          )
        )
        // Refresh the orders list to get updated data
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to process refund")
      }
    } catch (error) {
      debugError("? Error processing refund:", error)
      
      // Log full error details for debugging
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url,
        orderId: orderIdToUse,
        refundAmount: refundAmount,
        order: {
          id: order.id,
          orderId: order.orderId,
          _id: order._id
        },
        stack: error.stack
      }
      debugError("? Error details:", JSON.stringify(errorDetails, null, 2))
      
      // Show more specific error message
      let errorMessage = "Failed to process refund"
      
      if (error.response) {
        // Server responded with error
        if (error.response.status === 404) {
          errorMessage = `Order not found (ID: ${orderIdToUse}). Please check if the order exists.`
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.message || "Invalid request. Please check the refund amount."
        } else if (error.response.status === 500) {
          errorMessage = error.response.data?.message || "Server error. Please try again later."
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message
        } else {
          errorMessage = `Error ${error.response.status}: ${error.response.statusText || "Unknown error"}`
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = "Network error. Please check your internet connection and try again."
      } else {
        // Error in setting up the request
        errorMessage = error.message || "Failed to process refund"
      }
      
      debugError("? Final error message:", errorMessage)
      toast.error(errorMessage)
    } finally {
      setProcessingRefund(null)
      setRefundModalOpen(false)
      setSelectedOrderForRefund(null)
    }
  }

  // Handle refund confirmation from modal
  const handleRefundConfirm = (amount, refundTo) => {
    if (selectedOrderForRefund) {
      processRefund(selectedOrderForRefund, amount, refundTo)
    }
  }

  if (showLoadingSkeleton) {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 p-4 lg:p-6">
        <OrdersDashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <OrdersTopbar 
        title={config.title} 
        count={count} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={restaurants}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      <RefundModal
        isOpen={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        order={selectedOrderForRefund}
        onConfirm={handleRefundConfirm}
        isProcessing={processingRefund !== null}
      />
      <OrdersTable 
        orders={filteredOrders} 
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        onRefund={handleRefund}
        onDeleteOrder={statusKey === "all" ? handleDeleteOrder : undefined}
        onAcceptOrder={statusKey === "all" || statusKey === "pending" ? handleAcceptOrder : undefined}
        onRejectOrder={statusKey === "all" || statusKey === "pending" ? handleRejectOrder : undefined}
        actionLoadingOrderId={processingActionOrderId}
        deletingOrderId={deletingOrderId}
      />
    </div>
  )
}

