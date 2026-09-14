import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react"

const OrdersContext = createContext(null)

export function OrdersProvider({ children }) {
  const hasCustomerAuth = () => {
    if (typeof window === "undefined") return false
    return Boolean(
      localStorage.getItem("auth_customer") ||
      localStorage.getItem("user_accessToken") ||
      localStorage.getItem("accessToken")
    )
  }

  const [orders, setOrders] = useState(() => {
    if (typeof window === "undefined") return []
    if (!hasCustomerAuth()) return []
    try {
      const saved = localStorage.getItem("userOrders")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (!hasCustomerAuth()) {
      try {
        localStorage.removeItem("userOrders")
      } catch {
        // ignore storage errors
      }
      if (orders.length > 0) {
        setOrders([])
      }
      return
    }

    try {
      // Only items that exist or are linked to an authenticated user
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" || !!localStorage.getItem("user_accessToken");
      if (orders.length > 0 || isAuthenticated) {
        localStorage.setItem("userOrders", JSON.stringify(orders))
      }
    } catch {
      // ignore storage errors
    }
  }, [orders])

  const createOrder = (orderData) => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      ...orderData,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      tracking: {
        confirmed: { status: true, timestamp: new Date().toISOString() },
        preparing: { status: false, timestamp: null },
        outForDelivery: { status: false, timestamp: null },
        delivered: { status: false, timestamp: null }
      }
    }
    setOrders((prevOrders) => [newOrder, ...prevOrders])
    return newOrder.id
  }

  const getOrderById = useCallback((orderId) => {
    return orders.find(order => order.id === orderId)
  }, [orders])

  const getAllOrders = useCallback(() => {
    return orders.toSorted((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [orders])

  const updateOrderStatus = useCallback((orderId, status) => {
    setOrders((prevOrders) => prevOrders.map(order => {
      if (order.id === orderId) {
        const updatedTracking = { ...order.tracking }
        if (status === "preparing") {
          updatedTracking.preparing = { status: true, timestamp: new Date().toISOString() }
        } else if (status === "outForDelivery") {
          updatedTracking.outForDelivery = { status: true, timestamp: new Date().toISOString() }
        } else if (status === "delivered") {
          updatedTracking.delivered = { status: true, timestamp: new Date().toISOString() }
        }
        return {
          ...order,
          status,
          tracking: updatedTracking
        }
      }
      return order
    }))
  }, [])

  const value = useMemo(() => ({
    orders,
    createOrder,
    getOrderById,
    getAllOrders,
    updateOrderStatus
  }), [orders])

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (!context) {
    throw new Error("useOrders must be used within an OrdersProvider")
  }
  return context
}

export function useOptionalOrders() {
  return useContext(OrdersContext)
}
