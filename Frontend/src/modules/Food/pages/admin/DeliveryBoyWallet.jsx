import { useState, useEffect, useMemo } from "react"
import { Search, PiggyBank, Loader2, Package } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const formatCurrency = (amount) => {
  if (amount == null) return "\u20B90.00"
  return `\u20B9${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function DeliveryBoyWallet() {
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

    return () => {
      isMounted = false
    }
  }, [currentUser])

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::deliveryman_management::wallet", "edit")
  }, [currentUser, resolvedPermissions])

  const [wallets, setWallets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const limit = 20

  const fetchWallets = async (overrides = {}) => {
    const p = overrides.page || page
    const silent = overrides.silent || false
    try {
      if (!silent) setLoading(true)
      const res = await adminAPI.getDeliveryWallets({
        search: searchQuery.trim() || undefined,
        page: p,
        limit,
      })
      if (res?.data?.success) {
        const data = res.data.data
        setWallets(data?.wallets || [])
        setTotal(data?.pagination?.total || 0)
        setPages(data?.pagination?.pages || 1)
      } else {
        if (!silent) toast.error(res?.data?.message || "Failed to fetch delivery boy wallets")
        setWallets([])
      }
    } catch (err) {
      debugError("Error fetching delivery boy wallets:", err)
      if (!silent) toast.error(err?.response?.data?.message || "Failed to fetch delivery boy wallets")
      setWallets([])
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallets()
  }, [page])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      fetchWallets({ page: 1 })
    }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Real-time polling: fetch data every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWallets({ silent: true })
    }, 10000)
    return () => clearInterval(interval)
  }, [page, searchQuery])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <PiggyBank className="w-5 h-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">Delivery boy Wallet</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            View each delivery boy&apos;s wallet details: name, ID, remaining cash limit, pocket balance, cash collected, total earning, bonus, total withdrawal, cash in hand.
          </p>
          {!canEdit && currentUser?.role !== "ADMIN" ? (
            <p className="text-xs text-slate-500 mt-3">
              Wallet adjustment controls are unavailable for your role on this screen.
            </p>
          ) : null}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Wallets</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {total}
              </span>
            </div>
            <div className="relative flex-1 sm:flex-initial min-w-[200px] max-w-xs">
              <input
                type="text"
                placeholder="Search by name, ID, phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading wallets…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider text-emerald-600">Pocket balance</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider text-red-600">Cash in hand</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Rem. cash limit</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total earning</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider text-green-600">Order Earning</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider text-blue-600">Addon Earning</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total withdrawal</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Orders</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {wallets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-16 h-16 text-slate-400 mb-4" />
                          <p className="text-lg font-semibold text-slate-700">No wallets</p>
                          <p className="text-sm text-slate-500">No delivery boys found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w, i) => (
                      <tr key={w.walletId || w.deliveryId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{(page - 1) * limit + i + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">{w.name || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">{w.deliveryIdString || "—"}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(w.pocketBalance)}</span>
                            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                              (Earn: {formatCurrency(w.totalEarning)} + Bonus: {formatCurrency(w.bonus)})
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">{formatCurrency(w.cashCollected)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.remainingCashLimit)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.totalEarning)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">{formatCurrency(w.orderEarning)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{formatCurrency(w.addonEarning)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.bonus)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(w.totalWithdrawn)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{w.totalDeliveries || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Page {page} of {pages} · {total} total
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

