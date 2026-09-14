import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ChevronLeft, Loader2, Send } from "lucide-react"
import { restaurantAPI } from "@food/api"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { toast } from "sonner"

const CATEGORY_OPTIONS = [
  { value: "orders", label: "Orders" },
  { value: "payments", label: "Payments" },
  { value: "menu", label: "Menu" },
  { value: "restaurant", label: "Restaurant Profile" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
]

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in-progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
]

const getStatusStyle = (status) => {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (status === "in-progress") return "bg-blue-100 text-blue-700 border-blue-200"
  return "bg-amber-100 text-amber-700 border-amber-200"
}

export default function RestaurantSupport() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [form, setForm] = useState({
    category: "orders",
    issueType: "",
    subject: "",
    orderRef: "",
    priority: "medium",
    description: "",
  })

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((t) => t.status === "open").length
    const inProgress = tickets.filter((t) => t.status === "in-progress").length
    const resolved = tickets.filter((t) => t.status === "resolved").length
    return { total, open, inProgress, resolved }
  }, [tickets])

  const loadTickets = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getSupportTickets({
        status: statusFilter || undefined,
        limit: 100,
        page: 1,
      })
      const list = response?.data?.data?.tickets || []
      setTickets(list)
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load support tickets")
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [statusFilter])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.issueType.trim()) {
      toast.error("Issue type is required")
      return
    }
    try {
      setSubmitting(true)
      await restaurantAPI.createSupportTicket({
        category: form.category,
        issueType: form.issueType.trim(),
        subject: form.subject.trim(),
        orderRef: form.orderRef.trim(),
        priority: form.priority,
        description: form.description.trim(),
      })
      toast.success("Support ticket submitted")
      setForm((prev) => ({ ...prev, issueType: "", subject: "", orderRef: "", description: "" }))
      await loadTickets()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit support ticket")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-50 flex flex-col lg:pb-8">
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 backdrop-blur bg-white/95">
        <div className="px-4 py-3 flex items-center gap-3 lg:max-w-6xl lg:mx-auto lg:px-8 lg:py-5 lg:w-full">
          <button
            onClick={goBack}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors lg:hidden"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-slate-900" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 lg:text-2xl">Support</h1>
            <p className="text-xs text-slate-500 lg:text-sm">Raise issue and track admin response</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28 lg:max-w-6xl lg:mx-auto lg:px-8 lg:py-6 lg:pb-8 lg:w-full lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start lg:space-y-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-700">Open</p>
            <p className="text-lg font-bold text-amber-800">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700">In progress</p>
            <p className="text-lg font-bold text-blue-800">{stats.inProgress}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">Resolved</p>
            <p className="text-lg font-bold text-emerald-800">{stats.resolved}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Raise support ticket</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <input
            value={form.issueType}
            onChange={(e) => setForm((prev) => ({ ...prev, issueType: e.target.value }))}
            placeholder="Issue type (required)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            maxLength={120}
          />
          <input
            value={form.subject}
            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
            placeholder="Short subject"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            maxLength={180}
          />
          <input
            value={form.orderRef}
            onChange={(e) => setForm((prev) => ({ ...prev, orderRef: e.target.value }))}
            placeholder="Order ID (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            maxLength={80}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your issue"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-24 resize-none"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-black text-white py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Ticket
          </button>
        </form>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900">My tickets</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs bg-white"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              No support tickets found.
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket._id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">
                      #{String(ticket._id).slice(-6)} • {new Date(ticket.createdAt).toLocaleString()}
                    </p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold capitalize ${getStatusStyle(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {ticket.issueType}
                  </p>
                  {ticket.subject ? (
                    <p className="text-xs text-slate-600 mt-1">
                      Subject: {ticket.subject}
                    </p>
                  ) : null}
                  {ticket.orderRef ? (
                    <p className="text-xs text-slate-600 mt-1">
                      Order: {ticket.orderRef}
                    </p>
                  ) : null}
                  {ticket.description ? (
                    <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                  ) : null}
                  {ticket.adminResponse ? (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                      <p className="text-[11px] font-semibold text-blue-700 uppercase">Admin response</p>
                      <p className="text-sm text-blue-900 mt-1 whitespace-pre-wrap">{ticket.adminResponse}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNavOrders />
      </div>
    </div>
  )
}
