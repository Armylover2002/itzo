import { useEffect, useMemo, useState } from "react"
import { Loader2, Search, Settings2, UtensilsCrossed } from "lucide-react"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

const PERMISSION_KEY = "food::dining_management::dining_restaurants"
const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")

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

export default function DiningRestaurants() {
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

  const [searchQuery, setSearchQuery] = useState("")
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [commissionTarget, setCommissionTarget] = useState(null)
  const [commissionForm, setCommissionForm] = useState({ override: false, type: "percentage", value: 10 })
  const [saving, setSaving] = useState(false)

  const fetchRestaurants = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDiningRestaurants({ limit: 200 })
      const list = response?.data?.data?.restaurants || []
      setRestaurants(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dining restaurants")
      setRestaurants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRestaurants() }, [])

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return restaurants
    return restaurants.filter((profile) => String(profile?.restaurant?.restaurantName || "").toLowerCase().includes(query))
  }, [restaurants, searchQuery])

  const openCommissionEditor = (profile) => {
    if (!canEdit) { toast.error("Permission denied"); return }
    setCommissionTarget(profile)
    setCommissionForm({
      override: Boolean(profile?.commission?.override),
      type: profile?.commission?.type || "percentage",
      value: profile?.commission?.value ?? 10,
    })
  }

  const saveCommission = async () => {
    if (!commissionTarget) return
    try {
      setSaving(true)
      const response = await adminAPI.setDiningCommissionOverride(commissionTarget._id, commissionForm)
      if (response?.data?.success) {
        toast.success("Commission updated")
        setCommissionTarget(null)
        fetchRestaurants()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update commission")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dining Restaurants</h1>
              <p className="text-sm text-slate-500">Restaurants approved for Dining, with commission and setup status.</p>
            </div>
          </div>
          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search restaurants"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[30%] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Restaurant</th>
                <th className="w-[15%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Dining Live</th>
                <th className="w-[15%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Open Days</th>
                <th className="w-[20%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Commission</th>
                <th className="w-[20%] px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center">
                  <p className="text-lg font-semibold text-slate-700">No dining restaurants yet</p>
                  <p className="mt-1 text-sm text-slate-500">Approve requests to see restaurants here.</p>
                </td></tr>
              ) : (
                filtered.map((profile) => {
                  const openDaysCount = (profile?.slots || []).filter((s) => s.isOpen).length
                  return (
                    <tr key={profile._id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <RestaurantAvatar restaurant={profile?.restaurant} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{profile?.restaurant?.restaurantName || "Unknown"}</p>
                            <p className="truncate text-xs text-slate-400">{[profile?.restaurant?.area, profile?.restaurant?.city].filter(Boolean).join(", ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${profile?.isDiningEnabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {profile?.isDiningEnabled ? "Live" : "Off"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-slate-600">{openDaysCount} / 7</td>
                      <td className="px-4 py-4 text-sm text-slate-600">
                        {profile?.commission?.override ? (
                          <span className="font-medium text-slate-800">
                            {profile.commission.type === "percentage" ? `${profile.commission.value}%` : `₹${profile.commission.value}`} (override)
                          </span>
                        ) : (
                          <span className="text-slate-400">Global default</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {canEdit && (
                          <button onClick={() => openCommissionEditor(profile)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                            <Settings2 className="h-3.5 w-3.5" />
                            Commission
                          </button>
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

      {commissionTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={() => setCommissionTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Commission Override</h3>
            <p className="mt-1 text-sm text-slate-600">{commissionTarget?.restaurant?.restaurantName}</p>

            <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={commissionForm.override}
                onChange={(event) => setCommissionForm((prev) => ({ ...prev, override: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Use a custom commission for this restaurant
            </label>

            {commissionForm.override && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Type</label>
                  <select
                    value={commissionForm.type}
                    onChange={(event) => setCommissionForm((prev) => ({ ...prev, type: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="amount">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">Value</label>
                  <input
                    type="number"
                    min="0"
                    max={commissionForm.type === "percentage" ? 100 : undefined}
                    value={commissionForm.value}
                    onChange={(event) => setCommissionForm((prev) => ({ ...prev, value: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button onClick={() => setCommissionTarget(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button onClick={saveCommission} disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
