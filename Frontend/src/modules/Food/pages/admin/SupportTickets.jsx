import { useEffect, useMemo, useState } from "react"
import { supportAPI } from "@food/api"
import { toast } from "sonner"

export default function SupportTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: "", type: "", source: "all" })
  const [editing, setEditing] = useState({})

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === "open").length
    const inProgress = tickets.filter((t) => t.status === "in-progress").length
    const resolved = tickets.filter((t) => t.status === "resolved").length
    return { total, open, inProgress, resolved }
  }, [tickets])

  const getUserLabel = (ticket) => {
    if (ticket.source === "restaurant") return "Restaurant Panel"
    const user = ticket.user || {}
    const name = user.name || ticket.userName || ""
    const phone = user.phone || ticket.userPhone || ""
    if (name && phone) return `${name} (${phone})`
    if (name) return name
    if (phone) return phone
    const id = ticket.userId ? String(ticket.userId).slice(-6) : ""
    return id ? `#${id}` : "-"
  }

  const getRestaurantLabel = (ticket) => {
    const restaurant = ticket.restaurant || {}
    const name = restaurant.name || ticket.restaurantName || ""
    const city = restaurant.city || ""
    if (name && city) return `${name} (${city})`
    if (name) return name
    return "-"
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await supportAPI.getSupportTicketsAdmin(filters)
      const list = res?.data?.data?.tickets || res?.data?.tickets || []
      setTickets(list)
    } catch {
      toast.error("Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [filters.status, filters.type, filters.source])

  const update = async (id, patch) => {
    const ticket = tickets.find((t) => String(t._id) === String(id))
    try {
      await supportAPI.updateSupportTicketAdmin(id, { ...patch, source: ticket?.source || "user" })
      toast.success("Updated")
      setTickets((prev) => prev.map((t) => (String(t._id) === String(id) ? { ...t, ...patch } : t)))
    } catch {
      toast.error("Failed to update")
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Support Tickets</h1>
              <p className="text-sm text-slate-500 mt-1">Review and respond to user and restaurant support tickets.</p>
            </div>
            <div className="flex gap-2">
              <select
                value={filters.source}
                onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="user">User</option>
                <option value="restaurant">Restaurant</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                disabled={filters.source === "restaurant"}
              >
                <option value="">All Types</option>
                <option value="order">Order</option>
                <option value="restaurant">Restaurant</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Total {stats.total}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Open {stats.open}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f7f3fc] text-[#460d8b] border border-[#d8c4f1]">
              <span className="w-2 h-2 rounded-full bg-primary" />
              In progress {stats.inProgress}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Resolved {stats.resolved}
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-600">
                  <th className="px-4 py-3">Id</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Type/Category</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Response</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-500">No tickets</td></tr>
                ) : tickets.map((t) => (
                  <tr key={t._id}>
                    <td className="px-4 py-3">#{String(t._id).slice(-6)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {t.source || "user"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getUserLabel(t)}</td>
                    <td className="px-4 py-3">{getRestaurantLabel(t)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                        {t.source === "restaurant" ? (t.category || "other") : t.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{t.issueType}</div>
                      {t.subject ? <div className="text-xs text-slate-500 mt-0.5">Subject: {t.subject}</div> : null}
                      {t.orderRef ? <div className="text-xs text-slate-500 mt-0.5">Order: {t.orderRef}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => update(t._id, { status: e.target.value })}
                        className="border rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <input
                        className="border rounded px-2 py-1 text-sm w-64"
                        value={editing[t._id] ?? t.adminResponse ?? ""}
                        onChange={(e) => setEditing((p) => ({ ...p, [t._id]: e.target.value }))}
                        placeholder="Write response"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors" onClick={() => update(t._id, { adminResponse: editing[t._id] ?? t.adminResponse ?? "" })}>
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
