import { useEffect, useState } from "react"
import { Save, Loader2, Gift } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const debugError = (...args) => {}

function ToggleSwitch({ enabled, onToggle, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex items-center w-11 h-6 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled
          ? "bg-red-600 border-red-600 justify-end"
          : "bg-slate-200 border-slate-300 justify-start"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  )
}

export default function ReferralSettings() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    user: {
      referrerReward: "",
      refereeReward: "",
      limit: "",
    },
    delivery: {
      referrerReward: "",
      refereeReward: "",
      limit: "",
    },
    restaurant: {
      referrerReward: "",
      refereeReward: "",
      limit: "",
    },
    isActive: true,
  })

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getReferralSettings()
      const s = res?.data?.data?.referralSettings
      if (res?.data?.success && s) {
        setSettings({
          user: {
            referrerReward: s.user?.referrerReward ?? "",
            refereeReward: s.user?.refereeReward ?? "",
            limit: s.user?.limit ?? "",
          },
          delivery: {
            referrerReward: s.delivery?.referrerReward ?? "",
            refereeReward: s.delivery?.refereeReward ?? "",
            limit: s.delivery?.limit ?? "",
          },
          restaurant: {
            referrerReward: s.restaurant?.referrerReward ?? "",
            refereeReward: s.restaurant?.refereeReward ?? "",
            limit: s.restaurant?.limit ?? "",
          },
          isActive: s.isActive !== false,
        })
      }
    } catch (e) {
      debugError("Error fetching referral settings:", e)
      toast.error("Failed to load referral settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    try {
      setSaving(true)
      const body = {
        user: {
          referrerReward: Number(settings.user.referrerReward) || 0,
          refereeReward: Number(settings.user.refereeReward) || 0,
          limit: Number(settings.user.limit) || 0,
        },
        delivery: {
          referrerReward: Number(settings.delivery.referrerReward) || 0,
          refereeReward: Number(settings.delivery.refereeReward) || 0,
          limit: Number(settings.delivery.limit) || 0,
        },
        restaurant: {
          referrerReward: Number(settings.restaurant.referrerReward) || 0,
          refereeReward: Number(settings.restaurant.refereeReward) || 0,
          limit: Number(settings.restaurant.limit) || 0,
        },
        isActive: settings.isActive,
      }
      const res = await adminAPI.createOrUpdateReferralSettings(body)
      if (res?.data?.success) {
        toast.success(
          settings.isActive
            ? "Referral settings saved successfully"
            : "Referral program deactivated. Pending restaurant rewards were cancelled."
        )
        fetchSettings()
      } else {
        toast.error(res?.data?.message || "Failed to save referral settings")
      }
    } catch (e) {
      debugError("Error saving referral settings:", e)
      toast.error(e?.response?.data?.message || "Failed to save referral settings")
    } finally {
      setSaving(false)
    }
  }

  const onChange = (section, key) => (e) => {
    const v = String(e.target.value ?? "")
      .replace(/[^\d.]/g, "")
      .replace(/^0+(\d)/, "$1")
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: v,
      },
    }))
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Referral Settings</h1>
        </div>
        <p className="text-sm text-slate-600">
          Configure referral reward amounts and maximum credits per referrer.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Configuration</h2>
              <p className="text-sm text-slate-500 mt-1">
                These values apply instantly to new referrals. Deactivating cancels pending restaurant rewards.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ToggleSwitch
                  enabled={settings.isActive}
                  disabled={loading || saving}
                  onToggle={() =>
                    setSettings((prev) => ({ ...prev, isActive: !prev.isActive }))
                  }
                />
                <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                  {settings.isActive ? "Program active" : "Program inactive"}
                </span>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-3 text-lg border-b pb-2">User Referral</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referrer Reward (₹)</label>
                    <input
                      value={settings.user.referrerReward}
                      onChange={onChange("user", "referrerReward")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 200"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Amount the person who shares gets</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referee Reward (₹)</label>
                    <input
                      value={settings.user.refereeReward}
                      onChange={onChange("user", "refereeReward")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 50"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Amount the new user gets</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max referrals per user</label>
                    <input
                      value={settings.user.limit}
                      onChange={onChange("user", "limit")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 10"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-3 text-lg border-b pb-2">Delivery Partner Referral</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referrer Reward (₹)</label>
                    <input
                      value={settings.delivery.referrerReward}
                      onChange={onChange("delivery", "referrerReward")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 1000"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Amount the existing delivery boy gets</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referee Reward (₹)</label>
                    <input
                      value={settings.delivery.refereeReward}
                      onChange={onChange("delivery", "refereeReward")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 60"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Amount the new delivery boy gets</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max referrals per partner</label>
                    <input
                      value={settings.delivery.limit}
                      onChange={onChange("delivery", "limit")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-3 text-lg border-b pb-2">Restaurant Referral</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referrer Reward (₹)</label>
                    <input
                      value={settings.restaurant.referrerReward}
                      onChange={onChange("restaurant", "referrerReward")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Amount the existing restaurant gets</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Referee Reward (₹)</label>
                    <input
                      value={settings.restaurant.refereeReward}
                      onChange={onChange("restaurant", "refereeReward")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 100"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Amount the new restaurant gets</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Max referrals per restaurant</label>
                    <input
                      value={settings.restaurant.limit}
                      onChange={onChange("restaurant", "limit")}
                      inputMode="numeric"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                      placeholder="e.g. 3"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
