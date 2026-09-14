import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Bell, RefreshCw, X } from "lucide-react"
import { restaurantAPI } from "@food/api"
import useNotificationInbox from "@food/hooks/useNotificationInbox"
import { getLifecycleDisplay } from "@food/utils/orderLifecycleDisplay"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const DISMISSED_KEY = "restaurant_dismissed_notifications"

const getStatusLabel = (status = "", orderLike = null) => {
  const life = getLifecycleDisplay(
    orderLike || { orderStatus: status, status },
    { audience: "restaurant" },
  );
  if (life) return life.subtitle || life.title;

  const normalized = String(status).toLowerCase()
  if (normalized === "confirmed") return "New order received"
  if (normalized === "preparing") return "Order is preparing"
  if (normalized === "ready") return "Order is ready for pickup"
  if (normalized === "out_for_delivery") return "Order out for delivery"
  if (normalized === "delivered") return "Order delivered"
  if (normalized === "cancelled") return "Order cancelled"
  if (normalized === "rejected") return "Order rejected"
  return "Order update"
}

export default function Notifications() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const {
    items: broadcastNotifications,
    loading: broadcastLoading,
    markAsRead: markBroadcastAsRead,
    dismiss: dismissBroadcastNotification,
    dismissAll: dismissAllBroadcastNotifications,
    refresh: refreshBroadcastNotifications,
  } = useNotificationInbox("restaurant", { limit: 100, pollMs: 5 * 60 * 1000 })

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      // Canonical dashboard list (page=1, limit=50) — shares restaurantAPI.getOrders cache with OrdersMain.
      const response = await restaurantAPI.getOrders()
      const rows = response?.data?.data?.orders || response?.data?.data?.data?.orders || []
      setOrders(rows)
    } catch (error) {
      if (error.response?.status !== 401) {
        debugError("Error fetching notifications:", error)
      }
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  useEffect(() => {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissedIds))
  }, [dismissedIds])

  const notifications = useMemo(() => {
    const orderNotifications = (orders || [])
      .map((order) => {
        const id = order._id || order.orderId
        const timestamp = order.updatedAt || order.createdAt
        return {
          id,
          orderId: order.orderId || "N/A",
          message: getStatusLabel(order.orderStatus || order.status, order),
          timeValue: timestamp ? new Date(timestamp).getTime() : 0,
          time: timestamp
            ? new Date(timestamp).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "N/A",
        }
      })
      .filter((item) => item.id && !dismissedIds.includes(item.id))
    const broadcastRows = (broadcastNotifications || []).map((item) => ({
      id: item.id,
      message: item.title || "Broadcast notification",
      detail: item.message || "",
      source: "broadcast",
      read: item.read,
      timeValue: item.createdAt ? new Date(item.createdAt).getTime() : 0,
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : "N/A",
    }))

    return [...broadcastRows, ...orderNotifications].sort((a, b) => b.timeValue - a.timeValue)
  }, [broadcastNotifications, dismissedIds, orders])

  const removeNotification = (id, source = "order") => {
    if (source === "broadcast") {
      dismissBroadcastNotification(id)
      return
    }
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const clearAll = () => {
    dismissAllBroadcastNotifications()
    const ids = notifications
      .filter((item) => item.source !== "broadcast")
      .map((n) => n.id)
      .filter(Boolean)
    setDismissedIds((prev) => [...new Set([...prev, ...ids])])
  }

  const handleRefresh = async () => {
    await Promise.all([fetchNotifications(), refreshBroadcastNotifications()])
  }

  return (
    <div className="min-h-full bg-white lg:bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 lg:max-w-4xl lg:mx-auto lg:px-8 lg:py-5 lg:w-full">
          <button
            onClick={() => navigate("/food/restaurant")}
            className="p-2 rounded-full hover:bg-gray-100 lg:hidden"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 flex-1 lg:text-2xl lg:font-bold">Notifications</h1>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-28 lg:max-w-4xl lg:mx-auto lg:px-8 lg:py-6 lg:pb-8 lg:w-full">
        {!loading && notifications.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={clearAll}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          </div>
        )}

        {loading || broadcastLoading ? (
          <div className="text-center text-sm text-gray-600 py-12">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-sm text-gray-600 py-12">No notifications</div>
        ) : (
          <div className="space-y-2 lg:space-y-3">
            {notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => item.source === "broadcast" ? markBroadcastAsRead(item.id) : undefined}
                className={`border rounded-lg p-3 flex items-start justify-between gap-3 lg:rounded-xl lg:p-4 lg:shadow-sm ${item.source === "broadcast" && !item.read ? "border-blue-200 bg-blue-50/40 cursor-pointer" : "border-gray-200 lg:bg-white"}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.source === "broadcast" && <Bell className="w-4 h-4 text-blue-600" />}
                    <p className="text-sm font-medium text-gray-900">{item.message}</p>
                  </div>
                  {item.source === "broadcast" ? (
                    <p className="text-xs text-gray-600 mt-0.5">{item.detail || "Admin notification"}</p>
                  ) : (
                    <p className="text-xs text-gray-600 mt-0.5">Order: {item.orderId}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">{item.time}</p>
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    removeNotification(item.id, item.source)
                  }}
                  className="p-1.5 rounded-full hover:bg-gray-100"
                  aria-label="Remove notification"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

