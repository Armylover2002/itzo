import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Wallet } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const debugError = (...args) => {}

export default function RestaurantWithdrawalLimit() {
  const [loading, setLoading] = useState(true)
  const [savingMin, setSavingMin] = useState(false)
  const [savingMax, setSavingMax] = useState(false)
  const [minLimit, setMinLimit] = useState("1")
  const [maxLimit, setMaxLimit] = useState("")
  const isMountedRef = useRef(true)

  const fetchLimits = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const response = await adminAPI.getRestaurantWithdrawalLimit()
      const data = response?.data?.data || response?.data || {}
      if (!isMountedRef.current) return
      setMinLimit(
        data.restaurantMinWithdrawalLimit !== undefined && data.restaurantMinWithdrawalLimit !== null
          ? String(data.restaurantMinWithdrawalLimit)
          : "1"
      )
      const max = data.restaurantMaxWithdrawalLimit
      setMaxLimit(max !== undefined && max !== null && Number(max) > 0 ? String(max) : "")
    } catch (error) {
      debugError("Error fetching restaurant withdrawal limits:", error)
      if (!isMountedRef.current) return
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to load restaurant withdrawal limits")
      }
      setMinLimit("1")
      setMaxLimit("")
    } finally {
      if (!silent && isMountedRef.current) setLoading(false)
    }
  }, [])

  const parseMax = (raw) => {
    if (raw === "" || raw === null || raw === undefined) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return NaN
    return n === 0 ? null : n
  }

  const save = async ({ which }) => {
    const minValue = Number(minLimit)
    if (!Number.isFinite(minValue) || minValue < 0) {
      toast.error("Minimum withdrawal limit must be a number (>= 0)")
      return
    }
    const maxValue = parseMax(maxLimit)
    if (Number.isNaN(maxValue)) {
      toast.error("Maximum withdrawal limit must be a number (>= 0), or leave empty for unlimited")
      return
    }
    if (maxValue != null && maxValue < minValue) {
      toast.error("Maximum withdrawal limit must be ≥ minimum withdrawal limit")
      return
    }

    const setSaving = which === "min" ? setSavingMin : setSavingMax
    try {
      setSaving(true)
      const response = await adminAPI.updateRestaurantWithdrawalLimit({
        restaurantMinWithdrawalLimit: minValue,
        restaurantMaxWithdrawalLimit: maxValue,
      })
      const saved = response?.data?.data || response?.data || {}
      setMinLimit(String(saved.restaurantMinWithdrawalLimit ?? minValue))
      const savedMax = saved.restaurantMaxWithdrawalLimit
      setMaxLimit(savedMax != null && Number(savedMax) > 0 ? String(savedMax) : "")
      toast.success(
        which === "max" && maxValue == null
          ? "Maximum withdrawal limit cleared (unlimited)"
          : "Restaurant withdrawal limits updated successfully"
      )
      await fetchLimits({ silent: true })
    } catch (error) {
      debugError("Error saving restaurant withdrawal limits:", error)
      toast.error(error.response?.data?.message || "Failed to update restaurant withdrawal limits")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchLimits()
    return () => {
      isMountedRef.current = false
    }
  }, [fetchLimits])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Restaurant Withdrawal Limits</h1>
          </div>

          <p className="text-sm text-slate-600 mb-6">
            Configure <strong>minimum</strong> and <strong>maximum</strong> withdrawal amounts for restaurants.
            These settings are independent of delivery partner cash / withdrawal limits.
          </p>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-1">Minimum Withdrawal Amount</div>
                <div className="text-sm text-amber-800/80 mb-3">
                  Restaurant withdrawal requests below this amount will be rejected.
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={minLimit}
                      onChange={(e) => setMinLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm border-amber-200"
                      placeholder={loading ? "Loading..." : "e.g., 100"}
                      disabled={loading || savingMin}
                    />
                  </div>
                  <button
                    onClick={() => save({ which: "min" })}
                    disabled={loading || savingMin}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingMin && <Loader2 className="w-4 h-4 animate-spin" />}
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
                <div className="font-semibold text-sky-900 mb-1">Maximum Withdrawal Amount</div>
                <div className="text-sm text-sky-800/80 mb-3">
                  Restaurant cannot withdraw more than this amount per request. Leave empty for unlimited.
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={maxLimit}
                      onChange={(e) => setMaxLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm border-sky-200"
                      placeholder={loading ? "Loading..." : "e.g., 50000 (empty = unlimited)"}
                      disabled={loading || savingMax}
                    />
                  </div>
                  <button
                    onClick={() => save({ which: "max" })}
                    disabled={loading || savingMax}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingMax && <Loader2 className="w-4 h-4 animate-spin" />}
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
