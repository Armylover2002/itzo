import { useEffect, useState } from "react"
import apiClient from "@/services/api/axios"

const formatMoney = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`

const statusLabelMap = {
  all: "All",
  new: "New",
  preparing: "Being Prepared",
  "on-the-way": "On the Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
}

export default function QuickCommerceOrders({ statusKey = "all" }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const res = await apiClient.get("/quick-commerce/admin/orders", { contextModule: "admin" })
        setOrders(res?.data?.result || [])
      } catch {
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  const normalizedStatus = String(statusKey || "all").toLowerCase()
  const filteredOrders =
    normalizedStatus === "all"
      ? orders
      : orders.filter((order) => String(order.status || "").toLowerCase() === normalizedStatus)
  const heading = statusLabelMap[normalizedStatus] || "All"

  return (
    <div className="px-4 py-4 lg:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Quick Commerce Orders - {heading}</h1>
          <p className="text-sm text-slate-500">Dedicated orders view for "{heading}" status.</p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>Loading orders...</td>
                </tr>
              )}
              {!loading && orders.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>No orders found.</td>
                </tr>
              )}
              {!loading && orders.length > 0 && filteredOrders.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>No {heading.toLowerCase()} orders found.</td>
                </tr>
              )}
              {!loading && filteredOrders.map((order) => (
                <tr key={order.id || order._id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">{order.orderNumber || order.id || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{order.customerName || order.customer?.name || "-"}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{formatMoney(order.total)}</td>
                  <td className="px-4 py-3 uppercase text-xs font-semibold text-emerald-700">{order.status || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
