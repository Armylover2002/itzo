import { useEffect, useMemo, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

const PERMISSION_KEY = "food::dining_management::dining_settings"

const defaultForm = {
  commissionType: "percentage",
  commissionValue: 10,
  minAdvanceBookingMinutes: 30,
  maxAdvanceBookingDays: 30,
  cancellationWindowMinutes: 60,
  taxPercent: 0,
}

export default function DiningSettings() {
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

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(defaultForm)

  useEffect(() => {
    let cancelled = false
    adminAPI.getDiningSettings()
      .then((response) => {
        const settings = response?.data?.data?.settings
        if (!settings || cancelled) return
        setForm({
          commissionType: settings?.defaultCommission?.type || "percentage",
          commissionValue: settings?.defaultCommission?.value ?? 10,
          minAdvanceBookingMinutes: settings?.minAdvanceBookingMinutes ?? 30,
          maxAdvanceBookingDays: settings?.maxAdvanceBookingDays ?? 30,
          cancellationWindowMinutes: settings?.cancellationWindowMinutes ?? 60,
          taxPercent: settings?.taxPercent ?? 0,
        })
      })
      .catch((error) => toast.error(error?.response?.data?.message || "Failed to load dining settings"))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canEdit) { toast.error("Permission denied"); return }

    const commissionValue = Number(form.commissionValue)
    if (!Number.isFinite(commissionValue) || commissionValue < 0 || (form.commissionType === "percentage" && commissionValue > 100)) {
      toast.error("Enter a valid commission value (0-100 for percentage)")
      return
    }

    try {
      setSaving(true)
      const response = await adminAPI.updateDiningSettings({
        defaultCommission: { type: form.commissionType, value: commissionValue },
        minAdvanceBookingMinutes: Number(form.minAdvanceBookingMinutes) || 0,
        maxAdvanceBookingDays: Number(form.maxAdvanceBookingDays) || 0,
        cancellationWindowMinutes: Number(form.cancellationWindowMinutes) || 0,
        taxPercent: Number(form.taxPercent) || 0,
      })
      if (response?.data?.success) toast.success("Dining settings updated")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Dining Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Platform-wide defaults for Dining. Restaurants can be given a commission override individually from the Restaurants page.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Default Commission</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Type</label>
              <select
                value={form.commissionType}
                onChange={handleChange("commissionType")}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900 disabled:opacity-60"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="amount">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Value {form.commissionType === "percentage" ? "(%)" : "(₹)"}
              </label>
              <input
                type="number"
                min="0"
                max={form.commissionType === "percentage" ? 100 : undefined}
                step="0.01"
                value={form.commissionValue}
                onChange={handleChange("commissionValue")}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Booking Rules</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Minimum advance booking (minutes)</label>
              <input
                type="number"
                min="0"
                value={form.minAdvanceBookingMinutes}
                onChange={handleChange("minAdvanceBookingMinutes")}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Maximum advance booking (days)</label>
              <input
                type="number"
                min="0"
                value={form.maxAdvanceBookingDays}
                onChange={handleChange("maxAdvanceBookingDays")}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Cancellation window (minutes)</label>
              <input
                type="number"
                min="0"
                value={form.cancellationWindowMinutes}
                onChange={handleChange("cancellationWindowMinutes")}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-slate-400">Users can't cancel within this window before their slot.</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Tax on bills (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxPercent}
                onChange={handleChange("taxPercent")}
                disabled={!canEdit}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        {canEdit && (
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        )}
      </form>
    </div>
  )
}
