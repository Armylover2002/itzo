import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supportAPI } from "@food/api"
import { toast } from "sonner"

const LIMIT = 50

const truncate = (text, max = 80) => {
  const s = String(text || "").trim()
  if (!s) return ""
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export default function SupportTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [category, setCategory] = useState("")
  const [filters, setFilters] = useState({ status: "", type: "", source: "all" })
  const [editing, setEditing] = useState({})
  const [expandedDesc, setExpandedDesc] = useState({})

  const limit = LIMIT
  const totalPages = Math.max(1, Math.ceil((total || 0) / limit))

  const stats = useMemo(() => {
    if (counts && typeof counts === "object") {
      return {
        total: counts.total ?? total ?? tickets.length,
        open: counts.open ?? 0,
        inProgress: counts.inProgress ?? counts["in-progress"] ?? 0,
        resolved: counts.resolved ?? 0,
      }
    }
    return {
      total: total || tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in-progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
    }
  }, [counts, total, tickets])

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

  const getDescription = (ticket) =>
    ticket.description || ticket.message || ticket.details || ticket.issueDescription || ""

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page,
        limit,
        ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
        ...(filters.status && { status: filters.status }),
        ...(filters.type && filters.source !== "restaurant" && { type: filters.type }),
        ...(filters.source && filters.source !== "all" && { source: filters.source }),
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
        ...(filters.source === "restaurant" && category && { category }),
      }
      const res = await supportAPI.getSupportTicketsAdmin(params)
      const data = res?.data?.data || res?.data || {}
      const list = data?.tickets || []
      setTickets(Array.isArray(list) ? list : [])
      setTotal(data?.total ?? data?.pagination?.total ?? (Array.isArray(list) ? list.length : 0))
      setCounts(data?.counts || null)
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load tickets")
      setTickets([])
      setTotal(0)
      setCounts(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch, filters, fromDate, toDate, category])

  const loadRef = useRef(load)
  loadRef.current = load

  // Debounce search only
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const prevDebouncedSearchRef = useRef(debouncedSearch)

  // Load immediately on page/filter changes; when search settles, reset to page 1 first
  useEffect(() => {
    if (prevDebouncedSearchRef.current !== debouncedSearch) {
      prevDebouncedSearchRef.current = debouncedSearch
      if (page !== 1) {
        setPage(1)
        return
      }
    }
    loadRef.current()
  }, [page, debouncedSearch, filters.status, filters.type, filters.source, fromDate, toDate, category])

  const resetPage = () => setPage(1)

  const mergeTicketUpdate = (existing, serverTicket, patch) => {
    if (!serverTicket || typeof serverTicket !== "object") {
      return { ...existing, ...patch }
    }
    const hasMappedUser = serverTicket.user && typeof serverTicket.user === "object" && !Array.isArray(serverTicket.user)
    const hasMappedRestaurant =
      serverTicket.restaurant && typeof serverTicket.restaurant === "object" && !Array.isArray(serverTicket.restaurant)

    return {
      ...existing,
      ...serverTicket,
      source: serverTicket.source || existing.source,
      user: hasMappedUser ? serverTicket.user : existing.user,
      restaurant: hasMappedRestaurant ? serverTicket.restaurant : existing.restaurant,
      restaurantName: serverTicket.restaurantName || existing.restaurantName,
      userId: hasMappedUser
        ? (serverTicket.userId ?? existing.userId)
        : (existing.userId ?? serverTicket.userId),
      restaurantId: hasMappedRestaurant
        ? (serverTicket.restaurantId ?? existing.restaurantId)
        : (existing.restaurantId ?? serverTicket.restaurantId),
    }
  }

  const update = async (id, patch) => {
    const ticket = tickets.find((t) => String(t._id) === String(id))
    const source = ticket?.source || patch.source || "user"

    if (Object.prototype.hasOwnProperty.call(patch, "adminResponse")) {
      const responseText = String(patch.adminResponse ?? "").trim()
      if (!responseText) {
        toast.error("Admin response cannot be empty")
        return
      }
      patch = { ...patch, adminResponse: responseText }
    }

    try {
      const res = await supportAPI.updateSupportTicketAdmin(id, { ...patch, source })
      const serverTicket =
        res?.data?.data?.ticket ||
        res?.data?.ticket ||
        res?.data?.data ||
        null
      toast.success("Updated")
      setTickets((prev) =>
        prev.map((t) => {
          if (String(t._id) !== String(id)) return t
          return mergeTicketUpdate(t, serverTicket, patch)
        })
      )
      if (Object.prototype.hasOwnProperty.call(patch, "adminResponse")) {
        setEditing((p) => {
          const next = { ...p }
          delete next[id]
          return next
        })
      }
      // Refresh counters (and list) to stay consistent with filters
      await loadRef.current()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update")
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
            <div className="flex flex-wrap gap-2">
              <select
                value={filters.source}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, source: e.target.value, type: e.target.value === "restaurant" ? "" : p.type }))
                  setCategory("")
                  resetPage()
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="user">User</option>
                <option value="restaurant">Restaurant</option>
              </select>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, status: e.target.value }))
                  resetPage()
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => {
                  setFilters((p) => ({ ...p, type: e.target.value }))
                  resetPage()
                }}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                disabled={filters.source === "restaurant"}
              >
                <option value="">All Types</option>
                <option value="order">Order</option>
                <option value="restaurant">Restaurant</option>
                <option value="other">Other</option>
              </select>
              {filters.source === "restaurant" && (
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    resetPage()
                  }}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="orders">Orders</option>
                  <option value="payments">Payments</option>
                  <option value="menu">Menu</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="technical">Technical</option>
                  <option value="other">Other</option>
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
              }}
              placeholder="Search tickets..."
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
            />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                resetPage()
              }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              title="From date"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                resetPage()
              }}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              title="To date"
            />
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
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
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
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-600">
                  <th className="px-4 py-3">Id</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Restaurant</th>
                  <th className="px-4 py-3">Type/Category</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Response</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-500">Loading...</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-500">No tickets</td></tr>
                ) : tickets.map((t) => {
                  const desc = getDescription(t)
                  const isExpanded = !!expandedDesc[t._id]
                  return (
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
                      <td className="px-4 py-3 max-w-[220px]">
                        {desc ? (
                          <div className="text-sm text-slate-700">
                            <span>{isExpanded ? desc : truncate(desc, 80)}</span>
                            {desc.length > 80 && (
                              <button
                                type="button"
                                className="ml-1 text-xs text-blue-600 hover:underline"
                                onClick={() =>
                                  setExpandedDesc((p) => ({ ...p, [t._id]: !p[t._id] }))
                                }
                              >
                                {isExpanded ? "Less" : "More"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
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
                        <button
                          className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                          onClick={() =>
                            update(t._id, {
                              adminResponse: editing[t._id] ?? t.adminResponse ?? "",
                            })
                          }
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
