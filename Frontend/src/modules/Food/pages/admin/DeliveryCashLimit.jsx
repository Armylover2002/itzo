import { useCallback, useEffect, useRef, useState } from "react"
import { IndianRupee, Loader2, Wallet } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliveryCashLimit() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingWithdrawal, setSavingWithdrawal] = useState(false)
  const [savingMaxWithdrawal, setSavingMaxWithdrawal] = useState(false)
  const [deliveryCashLimit, setDeliveryCashLimit] = useState("")
  const [deliveryWithdrawalLimit, setDeliveryWithdrawalLimit] = useState("")
  const [deliveryMaxWithdrawalLimit, setDeliveryMaxWithdrawalLimit] = useState("")
  const isMountedRef = useRef(true)

  const fetchLimit = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await adminAPI.getDeliveryCashLimit()
      const data = response?.data?.data || response?.data || {}
      const limit = data.deliveryCashLimit
      const wl = data.deliveryWithdrawalLimit ?? 100
      const maxWl = data.deliveryMaxWithdrawalLimit
      if (!isMountedRef.current) return
      setDeliveryCashLimit(limit !== undefined && limit !== null ? String(limit) : "")
      setDeliveryWithdrawalLimit(wl !== undefined && wl !== null ? String(wl) : "100")
      setDeliveryMaxWithdrawalLimit(
        maxWl !== undefined && maxWl !== null && Number(maxWl) > 0 ? String(maxWl) : ""
      )
    } catch (error) {
      debugError("Error fetching delivery cash limit:", error)
      if (!isMountedRef.current) return
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to load delivery cash limit")
      }
      setDeliveryCashLimit("")
      setDeliveryWithdrawalLimit("100")
      setDeliveryMaxWithdrawalLimit("")
    } finally {
      if (!silent && isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const parseMaxWithdrawal = (raw) => {
    if (raw === "" || raw === null || raw === undefined) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return NaN
    return n === 0 ? null : n
  }

  const validateMinMax = (minValue, maxValue) => {
    if (maxValue != null && maxValue < minValue) {
      toast.error("Maximum withdrawal limit must be ? minimum withdrawal limit")
      return false
    }
    return true
  }

  const buildPayload = ({ cash, min, max }) => ({
    deliveryCashLimit: cash,
    deliveryWithdrawalLimit: min,
    deliveryMaxWithdrawalLimit: max,
  })

  const saveLimit = async () => {
    const value = Number(deliveryCashLimit)
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Cash limit must be a number (>= 0)")
      return
    }
    const withdrawalValue = Number(deliveryWithdrawalLimit)
    if (!Number.isFinite(withdrawalValue) || withdrawalValue < 0) {
      toast.error("Minimum withdrawal limit must be a number (>= 0)")
      return
    }
    const maxValue = parseMaxWithdrawal(deliveryMaxWithdrawalLimit)
    if (Number.isNaN(maxValue)) {
      toast.error("Maximum withdrawal limit must be a number (>= 0), or leave empty for unlimited")
      return
    }
    if (!validateMinMax(withdrawalValue, maxValue)) return

    try {
      setSaving(true)
      const response = await adminAPI.updateDeliveryCashLimit(
        buildPayload({ cash: value, min: withdrawalValue, max: maxValue })
      )
      const saved =
        response?.data?.data?.deliveryCashLimit ??
        response?.data?.deliveryCashLimit ??
        value
      setDeliveryCashLimit(String(saved))
      toast.success("Delivery cash limit updated successfully")
      await fetchLimit({ silent: true })
    } catch (error) {
      debugError("Error saving delivery cash limit:", error)
      toast.error(error.response?.data?.message || "Failed to update delivery cash limit")
    } finally {
      setSaving(false)
    }
  }

  const saveWithdrawalLimit = async () => {
    const value = Number(deliveryWithdrawalLimit)
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Minimum withdrawal limit must be a number (>= 0)")
      return
    }
    const cashValue = Number(deliveryCashLimit)
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      toast.error("Cash limit must be a number (>= 0)")
      return
    }
    const maxValue = parseMaxWithdrawal(deliveryMaxWithdrawalLimit)
    if (Number.isNaN(maxValue)) {
      toast.error("Maximum withdrawal limit must be a number (>= 0), or leave empty for unlimited")
      return
    }
    if (!validateMinMax(value, maxValue)) return

    try {
      setSavingWithdrawal(true)
      const response = await adminAPI.updateDeliveryCashLimit(
        buildPayload({ cash: cashValue, min: value, max: maxValue })
      )
      const saved =
        response?.data?.data?.deliveryWithdrawalLimit ??
        response?.data?.deliveryWithdrawalLimit ??
        value
      setDeliveryWithdrawalLimit(String(saved))
      toast.success("Minimum withdrawal limit updated successfully")
      await fetchLimit({ silent: true })
    } catch (error) {
      debugError("Error saving withdrawal limit:", error)
      toast.error(error.response?.data?.message || "Failed to update withdrawal limit")
    } finally {
      setSavingWithdrawal(false)
    }
  }

  const saveMaxWithdrawalLimit = async () => {
    const maxValue = parseMaxWithdrawal(deliveryMaxWithdrawalLimit)
    if (Number.isNaN(maxValue)) {
      toast.error("Maximum withdrawal limit must be a number (>= 0), or leave empty for unlimited")
      return
    }
    const minValue = Number(deliveryWithdrawalLimit)
    if (!Number.isFinite(minValue) || minValue < 0) {
      toast.error("Minimum withdrawal limit must be a number (>= 0)")
      return
    }
    const cashValue = Number(deliveryCashLimit)
    if (!Number.isFinite(cashValue) || cashValue < 0) {
      toast.error("Cash limit must be a number (>= 0)")
      return
    }
    if (!validateMinMax(minValue, maxValue)) return

    try {
      setSavingMaxWithdrawal(true)
      const response = await adminAPI.updateDeliveryCashLimit(
        buildPayload({ cash: cashValue, min: minValue, max: maxValue })
      )
      const saved =
        response?.data?.data?.deliveryMaxWithdrawalLimit ??
        response?.data?.deliveryMaxWithdrawalLimit ??
        maxValue
      setDeliveryMaxWithdrawalLimit(
        saved !== undefined && saved !== null && Number(saved) > 0 ? String(saved) : ""
      )
      toast.success(
        maxValue == null
          ? "Maximum withdrawal limit cleared (unlimited)"
          : "Maximum withdrawal limit updated successfully"
      )
      await fetchLimit({ silent: true })
    } catch (error) {
      debugError("Error saving max withdrawal limit:", error)
      toast.error(error.response?.data?.message || "Failed to update maximum withdrawal limit")
    } finally {
      setSavingMaxWithdrawal(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchLimit()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchLimit])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <IndianRupee className="w-5 h-5 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Delivery Cash Limit</h1>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            Set a <strong>global COD cash limit</strong> and <strong>minimum / maximum withdrawal amounts</strong> for all delivery
            partners. Cash limit is used for Available cash limit in the delivery app; withdrawal is allowed only when
            the amount is within the configured min/max range.
          </p>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <IndianRupee className="w-5 h-5 text-emerald-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-emerald-900 mb-1">
                  Delivery Boy Available Cash Limit (Global)
                </div>
                <div className="text-sm text-emerald-800/80 mb-3">
                  When COD cash is collected, delivery partner&apos;s remaining limit will decrease automatically.
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryCashLimit}
                      onChange={(e) => setDeliveryCashLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm border-emerald-200"
                      placeholder={loading ? "Loading..." : "e.g., 2000"}
                      disabled={loading || saving}
                    />
                    {loading && (
                      <p className="text-xs text-emerald-700/80 mt-1 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading current limit�
                      </p>
                    )}
                  </div>
                  <button
                    onClick={saveLimit}
                    disabled={loading || saving}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-1">
                  Minimum Withdrawal Amount (Global)
                </div>
                <div className="text-sm text-amber-800/80 mb-3">
                  Delivery boy can withdraw only when the withdrawal amount is <strong>at least</strong> this value.
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryWithdrawalLimit}
                      onChange={(e) => setDeliveryWithdrawalLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm border-amber-200"
                      placeholder={loading ? "Loading..." : "e.g., 100"}
                      disabled={loading || savingWithdrawal}
                    />
                    {loading && (
                      <p className="text-xs text-amber-700/80 mt-1 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading�
                      </p>
                    )}
                  </div>
                  <button
                    onClick={saveWithdrawalLimit}
                    disabled={loading || savingWithdrawal}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingWithdrawal && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-sky-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-sky-900 mb-1">
                  Maximum Withdrawal Amount (Global)
                </div>
                <div className="text-sm text-sky-800/80 mb-3">
                  Delivery boy cannot withdraw more than this amount in a single request. Leave empty for unlimited
                  (backward compatible with existing settings).
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryMaxWithdrawalLimit}
                      onChange={(e) => setDeliveryMaxWithdrawalLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm border-sky-200"
                      placeholder={loading ? "Loading..." : "e.g., 5000 (empty = unlimited)"}
                      disabled={loading || savingMaxWithdrawal}
                    />
                    {loading && (
                      <p className="text-xs text-sky-700/80 mt-1 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading�
                      </p>
                    )}
                  </div>
                  <button
                    onClick={saveMaxWithdrawalLimit}
                    disabled={loading || savingMaxWithdrawal}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingMaxWithdrawal && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
