import { useState, useEffect } from "react"
import { Save, Loader2, Settings2, Ruler, Compass, AlertCircle } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

export default function MixedOrderEligibility() {
  const [settings, setSettings] = useState({
    mixedOrderDistanceLimit: "",
    mixedOrderAngleLimit: "",
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getFeeSettings()
      if (response.data.success && response.data.data.feeSettings) {
        setSettings({
          mixedOrderDistanceLimit: response.data.data.feeSettings.mixedOrderDistanceLimit ?? "2",
          mixedOrderAngleLimit: response.data.data.feeSettings.mixedOrderAngleLimit ?? "35",
        })
      }
    } catch (error) {
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleDistanceChange = (e) => {
    const dist = e.target.value
    const distNum = Number(dist)
    // Auto-calculate angle: Angle = (Distance * 17.5)
    // Based on original ratio: 2km -> 35deg
    const calculatedAngle = distNum > 0 ? (distNum * 17.5).toFixed(1) : "0"
    
    setSettings({
      mixedOrderDistanceLimit: dist,
      mixedOrderAngleLimit: calculatedAngle
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await adminAPI.createOrUpdateFeeSettings({
        mixedOrderDistanceLimit: Number(settings.mixedOrderDistanceLimit),
        mixedOrderAngleLimit: Number(settings.mixedOrderAngleLimit),
        isActive: true,
      })

      if (response.data.success) {
        toast.success('Mixed order eligibility settings saved')
      } else {
        toast.error(response.data.message || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Settings2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Mixed Order Eligibility</h1>
        </div>
        <p className="text-sm text-slate-600">
          Configure the maximum distance and direction alignment required for mixed orders (Food + Quick Commerce)
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Configuration</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Adjust distance and direction thresholds
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Changes
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Info Card */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <strong>How it works:</strong> Mixed orders allow users to buy from a Restaurant and a Shop together. 
                    To ensure efficiency, both pickups must be close to each other and in the same direction towards the customer.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Distance Limit */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800">
                      <Ruler className="w-4 h-4 text-indigo-500" />
                      <label className="font-semibold text-sm">Pickup Distance Limit (KM)</label>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.mixedOrderDistanceLimit}
                        onChange={handleDistanceChange}
                        min="0"
                        step="0.1"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-lg"
                        placeholder="2.0"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">km</div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Maximum allowed distance between the Restaurant and the Shop.
                    </p>
                  </div>

                  {/* Angle Limit */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-800">
                      <Compass className="w-4 h-4 text-indigo-500" />
                      <label className="font-semibold text-sm">Direction Angle Limit (Degrees)</label>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={settings.mixedOrderAngleLimit}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none font-medium text-lg text-slate-600 cursor-not-allowed"
                        placeholder="35.0"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">°</div>
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      Auto-calculated: Larger distance allows for wider route alignment.
                    </p>
                  </div>
                </div>

                {/* Visualization / Summary */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Summary of Rule</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Max Pickup Separation:</span>
                      <span className="font-bold text-slate-900">{settings.mixedOrderDistanceLimit || 0} Kilometers</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600">Max Direction Deviation:</span>
                      <span className="font-bold text-slate-900">{settings.mixedOrderAngleLimit || 0} Degrees</span>
                    </div>
                    <div className="pt-3 border-t border-slate-200 text-xs text-slate-500">
                      Orders exceeding these limits will be handled as <strong>Split Orders</strong> (multiple riders) or restricted from <strong>Express Delivery</strong>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
