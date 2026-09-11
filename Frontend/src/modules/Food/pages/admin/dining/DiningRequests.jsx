import { useEffect, useMemo, useState } from "react"
import { Check, Loader2, MapPin, Search, UtensilsCrossed, X } from "lucide-react"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

const PERMISSION_KEY = "food::dining_management::dining_requests"
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
]

const RestaurantAvatar = ({ restaurant }) => {
  const image = normalizeImageUrl(
    typeof restaurant?.profileImage === "string" ? restaurant.profileImage : restaurant?.profileImage?.url,
    BACKEND_ORIGIN,
  )
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-500">
      {image && !failed ? (
        <img src={image} alt={restaurant?.restaurantName} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        String(restaurant?.restaurantName || "R").slice(0, 1).toUpperCase()
      )}
    </div>
  )
}

export default function DiningRequests() {
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }
      const existingPermissions = extractAdminPermissions(currentUser)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }
      const roleId = extractAdminRoleId(currentUser)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }
      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }
    resolvePermissions()
    return () => { isMounted = false }
  }, [currentUser])

  const canEdit = useMemo(() => canPerformAdminPermissionAction(currentUser, resolvedPermissions, PERMISSION_KEY, "edit"), [currentUser, resolvedPermissions])

  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [requestsByStatus, setRequestsByStatus] = useState({ pending: [], approved: [], rejected: [] })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")

  const fetchAllRequests = async () => {
    try {
      setLoading(true)
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        adminAPI.getDiningRequests({ status: "pending", limit: 200 }),
        adminAPI.getDiningRequests({ status: "approved", limit: 200 }),
        adminAPI.getDiningRequests({ status: "rejected", limit: 200 }),
      ])
      setRequestsByStatus({
        pending: pendingRes?.data?.data?.requests || [],
        approved: approvedRes?.data?.data?.requests || [],
        rejected: rejectedRes?.data?.data?.requests || [],
      })
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dining requests")
      setRequestsByStatus({ pending: [], approved: [], rejected: [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAllRequests() }, [])

  const requests = requestsByStatus[activeTab] || []

  const filteredRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return requests
    return requests.filter((r) => {
      const restaurant = r?.restaurant
      return (
        String(restaurant?.restaurantName || "").toLowerCase().includes(query) ||
        String(restaurant?.ownerName || "").toLowerCase().includes(query) ||
        String(restaurant?.ownerPhone || "").includes(query)
      )
    })
  }, [requests, searchQuery])

  const handleApprove = async (request) => {
    if (!canEdit) { toast.error("Permission denied"); return }
    if (!window.confirm(`Approve dining for "${request?.restaurant?.restaurantName || "this restaurant"}"?`)) return
    try {
      setProcessing(true)
      const response = await adminAPI.reviewDiningRequest(request._id, { approve: true })
      if (response?.data?.success) {
        toast.success("Dining request approved")
        fetchAllRequests()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve request")
    } finally {
      setProcessing(false)
    }
  }

  const openRejectDialog = (request) => {
    if (!canEdit) { toast.error("Permission denied"); return }
    setRejectTarget(request)
    setRejectionReason("")
  }

  const confirmReject = async () => {
    if (!rejectTarget || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    try {
      setProcessing(true)
      const response = await adminAPI.reviewDiningRequest(rejectTarget._id, { approve: false, rejectionReason: rejectionReason.trim() })
      if (response?.data?.success) {
        toast.success("Dining request rejected")
        setRejectTarget(null)
        setRejectionReason("")
        fetchAllRequests()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject request")
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dining Requests</h1>
            <p className="text-sm text-slate-500">Restaurants asking to enable dine-in table booking.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === tab.key ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>
                {requestsByStatus[tab.key]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="relative mt-4 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search restaurant, owner, phone"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[26%] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Restaurant</th>
                <th className="w-[18%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Owner</th>
                <th className="w-[16%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Location</th>
                <th className="w-[13%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Requested On</th>
                <th className="w-[12%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Status</th>
                <th className="w-[15%] px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-sm text-slate-500">Loading requests...</p>
                </td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center">
                  <p className="text-lg font-semibold text-slate-700">No {activeTab} requests</p>
                </td></tr>
              ) : (
                filteredRequests.map((request) => {
                  const restaurant = request?.restaurant
                  return (
                    <tr key={request._id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <RestaurantAvatar restaurant={restaurant} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{restaurant?.restaurantName || "Unknown"}</p>
                            <p className="truncate text-xs text-slate-400">{restaurant?.restaurantId || ""} · {restaurant?.businessType || "Fixed Restaurant"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <p className="font-medium text-slate-800">{restaurant?.ownerName || "-"}</p>
                        <p className="text-xs text-slate-400">{restaurant?.ownerPhone || ""}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{[restaurant?.area, restaurant?.city].filter(Boolean).join(", ") || "-"}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {request?.requestedAt ? new Date(request.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          request.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : request.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {request.status}
                        </span>
                        {request.status === "rejected" && request.rejectionReason && (
                          <p className="mt-1 max-w-[200px] text-xs text-rose-600">{request.rejectionReason}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {request.status === "pending" && canEdit ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleApprove(request)} disabled={processing} className="rounded-lg bg-emerald-600 p-2 text-white disabled:opacity-50" title="Approve">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={() => openRejectDialog(request)} disabled={processing} className="rounded-lg bg-rose-600 p-2 text-white disabled:opacity-50" title="Reject">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-slate-400">
                            {request.reviewedAt ? new Date(request.reviewedAt).toLocaleDateString("en-IN") : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={() => setRejectTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Reject Dining Request</h3>
            <p className="mt-1 text-sm text-slate-600">{rejectTarget?.restaurant?.restaurantName}</p>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Reason for rejection..."
              rows={4}
              className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-900"
            />
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => setRejectTarget(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button onClick={confirmReject} disabled={processing || !rejectionReason.trim()} className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {processing ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
