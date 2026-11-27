import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, MapPin, Store, IndianRupee, X, Loader2, Pencil, ExternalLink, Wallet } from "lucide-react"
import { toast } from "sonner"
import { hubAPI, restaurantAPI } from "@food/api"
import { enterOutletSession } from "@food/utils/auth"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import OutletLocationPicker from "@food/components/restaurant/OutletLocationPicker"

function getApiErrorMessage(error, fallback = "Something went wrong") {
  return error?.response?.data?.message || error?.message || fallback
}

function CreateOutletModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    outletLabel: "",
    franchiseLoginId: "",
    password: "",
    useMainHubInventory: true,
  })
  const [location, setLocation] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.outletLabel.trim()) return setError("Outlet name is required")
    if (!form.franchiseLoginId.trim()) return setError("Login ID is required")
    if (form.password.length < 6) return setError("Password must be at least 6 characters")

    setSubmitting(true)
    setError("")
    try {
      await hubAPI.createOutlet({
        outletLabel: form.outletLabel.trim(),
        franchiseLoginId: form.franchiseLoginId.trim(),
        password: form.password,
        useMainHubInventory: form.useMainHubInventory,
        location: location?.latitude != null
          ? { latitude: location.latitude, longitude: location.longitude, formattedAddress: location.formattedAddress }
          : undefined,
      })
      toast.success("Outlet created")
      onCreated()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to create outlet"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Add franchise outlet</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Outlet name</label>
            <input
              value={form.outletLabel}
              onChange={(e) => setForm((f) => ({ ...f, outletLabel: e.target.value }))}
              placeholder="e.g. Indiranagar branch"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10335D]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Franchise login ID</label>
            <input
              value={form.franchiseLoginId}
              onChange={(e) => setForm((f) => ({ ...f, franchiseLoginId: e.target.value }))}
              placeholder="e.g. indiranagar-branch"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10335D]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 6 characters"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10335D]"
            />
          </div>
          <OutletLocationPicker value={location} onChange={setLocation} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.useMainHubInventory}
              onChange={(e) => setForm((f) => ({ ...f, useMainHubInventory: e.target.checked }))}
            />
            Use main hub's menu/inventory
          </label>
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-11 rounded-xl bg-[#10335D] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? "Creating..." : "Create outlet"}
        </button>
      </div>
    </div>
  )
}

function EditOutletModal({ outlet, onClose, onSaved }) {
  const [form, setForm] = useState({
    outletLabel: outlet.outletLabel || "",
    password: "",
    useMainHubInventory: Boolean(outlet.useMainHubInventory),
  })
  const [location, setLocation] = useState(
    outlet.location?.latitude != null
      ? {
          latitude: outlet.location.latitude,
          longitude: outlet.location.longitude,
          formattedAddress: outlet.location.formattedAddress || "",
        }
      : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.outletLabel.trim()) return setError("Outlet name is required")
    if (form.password && form.password.length < 6) {
      return setError("Password must be at least 6 characters")
    }

    setSubmitting(true)
    setError("")
    try {
      const payload = {
        outletLabel: form.outletLabel.trim(),
        useMainHubInventory: form.useMainHubInventory,
      }
      if (form.password) payload.password = form.password
      if (location?.latitude != null) {
        payload.location = {
          latitude: location.latitude,
          longitude: location.longitude,
          formattedAddress: location.formattedAddress,
        }
      }
      await hubAPI.updateOutlet(outlet._id, payload)
      toast.success("Outlet updated")
      onSaved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to update outlet"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Edit outlet</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500">Outlet name</label>
            <input
              value={form.outletLabel}
              onChange={(e) => setForm((f) => ({ ...f, outletLabel: e.target.value }))}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10335D]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Franchise login ID</label>
            <input
              value={outlet.franchiseLoginId}
              disabled
              className="mt-1 w-full border border-gray-100 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">New password (leave blank to keep current)</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 6 characters"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10335D]"
            />
          </div>
          <OutletLocationPicker value={location} onChange={setLocation} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.useMainHubInventory}
              onChange={(e) => setForm((f) => ({ ...f, useMainHubInventory: e.target.checked }))}
            />
            Use main hub's menu/inventory
          </label>
          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-11 rounded-xl bg-[#10335D] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  )
}

/**
 * Per-location withdraw. Each location (the main restaurant and every outlet)
 * has its own wallet and its own bank account, so a withdrawal always names the
 * location it is paid out for — balances are never pooled.
 */
function WithdrawModal({ row, onClose, onDone }) {
  const [amount, setAmount] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const available = Number(row.availableBalance || 0)

  const handleSubmit = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError("Enter a valid amount")
    if (value > available) return setError(`Only ₹${available.toFixed(0)} is available for this location`)

    setSubmitting(true)
    setError("")
    try {
      await restaurantAPI.createWithdrawalRequest(value, {
        // Omitted for the main restaurant — that is the logged-in account itself.
        outletId: row.isMain ? undefined : row.restaurantId,
        idempotencyKey: `hub-wd-${row.restaurantId}-${Date.now()}`,
      })
      toast.success("Withdrawal request submitted")
      onDone()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to request withdrawal"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Withdraw</h3>
            <p className="text-xs text-gray-500">{row.name}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl px-3 py-2">
          <p className="text-xs text-gray-500">Available for this location</p>
          <p className="text-lg font-bold text-gray-900">₹{available.toFixed(0)}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#10335D]"
          />
        </div>

        <p className="text-[11px] text-gray-400">
          Paid into this location&apos;s own bank account. If it has no bank details saved yet, open the
          outlet and add them first.
        </p>
        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-11 rounded-xl bg-[#10335D] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          {submitting ? "Requesting..." : "Request withdrawal"}
        </button>
      </div>
    </div>
  )
}

export default function HubOutlets() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [outlets, setOutlets] = useState([])
  const [earnings, setEarnings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingOutlet, setEditingOutlet] = useState(null)
  const [withdrawRow, setWithdrawRow] = useState(null)
  const [switchingId, setSwitchingId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [outletsRes, earningsRes] = await Promise.all([
        hubAPI.listOutlets(),
        hubAPI.getEarnings(),
      ])
      setOutlets(outletsRes?.data?.data || [])
      setEarnings(earningsRes?.data?.data || null)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load outlets"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Open an outlet's panel: the server issues a session for that outlet and the
   * whole app reloads as that outlet. The hub's session is stashed first, so the
   * banner's "Back to main" restores it without re-login.
   */
  const handleOpenOutlet = async (outlet) => {
    setSwitchingId(String(outlet._id))
    try {
      const res = await hubAPI.switchToOutlet(outlet._id)
      const payload = res?.data?.data
      if (!payload?.accessToken) throw new Error("Could not open this outlet")
      enterOutletSession(payload)
      // Hard reload so every context re-reads the new session from storage.
      window.location.assign("/food/restaurant/orders")
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to open outlet"))
      setSwitchingId("")
    }
  }

  const handleToggleActive = async (outlet) => {
    try {
      await hubAPI.updateOutlet(outlet._id, { isActive: !outlet.isActive })
      toast.success(outlet.isActive ? "Outlet deactivated" : "Outlet activated")
      load()
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-200 sticky top-0 z-10">
        <button onClick={goBack} className="p-1 text-gray-700">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Hub & franchise outlets</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {earnings && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Combined earnings</p>
            <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
              <IndianRupee size={20} />
              {Number(earnings.totals?.lifetimeEarnings || 0).toFixed(0)}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Available balance: ₹{Number(earnings.totals?.availableBalance || 0).toFixed(0)} across {earnings.outlets?.length || 0} location(s)
            </p>

            {/* Money is tracked and paid out per location — the total above is
                only a rollup, never a single pooled balance. */}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              {(earnings.outlets || []).map((row) => {
                const isMain = Boolean(row.isMain)
                return (
                  <div key={String(row.restaurantId)} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {isMain ? `${row.name} (Main)` : row.name}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Available ₹{Number(row.availableBalance || 0).toFixed(0)} · Lifetime ₹
                        {Number(row.lifetimeEarnings || 0).toFixed(0)}
                      </p>
                    </div>
                    <button
                      onClick={() => setWithdrawRow({ ...row, isMain })}
                      disabled={Number(row.availableBalance || 0) <= 0}
                      className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#10335D]/10 text-[#10335D] disabled:opacity-40"
                    >
                      <Wallet size={12} /> Withdraw
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowCreate(true)}
          className="w-full h-12 rounded-xl border-2 border-dashed border-[#10335D]/40 text-[#10335D] font-bold text-sm flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add franchise outlet
        </button>

        {loading ? (
          <div className="py-10 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : outlets.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">
            No franchise outlets yet. Add one to let it login with its own ID/password.
          </p>
        ) : (
          <div className="space-y-3">
            {outlets.map((outlet) => {
              const row = earnings?.outlets?.find((o) => String(o.restaurantId) === String(outlet._id))
              return (
                <div key={outlet._id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Store size={18} className="text-[#10335D]" />
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{outlet.outletLabel}</p>
                        <p className="text-xs text-gray-400">Login ID: {outlet.franchiseLoginId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenOutlet(outlet)}
                        disabled={switchingId === String(outlet._id)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full bg-[#10335D] text-white disabled:opacity-50"
                        title="Open this outlet's panel"
                      >
                        {switchingId === String(outlet._id) ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ExternalLink size={12} />
                        )}
                        Open
                      </button>
                      <button
                        onClick={() => setEditingOutlet(outlet)}
                        className="p-1.5 rounded-full text-gray-400 hover:text-[#10335D] hover:bg-gray-100"
                        title="Edit outlet"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(outlet)}
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          outlet.isActive !== false
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {outlet.isActive !== false ? "Active" : "Inactive"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    {outlet.location?.formattedAddress || outlet.location?.address ? (
                      <span className="flex items-center gap-1 min-w-0">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">{outlet.location.formattedAddress || outlet.location.address}</span>
                      </span>
                    ) : null}
                    <span>{outlet.useMainHubInventory ? "Shares hub menu" : "Own menu"}</span>
                  </div>
                  {row ? (
                    <p className="mt-2 text-xs font-semibold text-gray-600">
                      Lifetime earnings: ₹{Number(row.lifetimeEarnings || 0).toFixed(0)}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateOutletModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}

      {editingOutlet && (
        <EditOutletModal
          outlet={editingOutlet}
          onClose={() => setEditingOutlet(null)}
          onSaved={load}
        />
      )}

      {withdrawRow && (
        <WithdrawModal
          row={withdrawRow}
          onClose={() => setWithdrawRow(null)}
          onDone={load}
        />
      )}
    </div>
  )
}
