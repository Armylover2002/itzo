import { useState, useEffect } from "react"
import { onboardingFeeAPI } from "@/services/api"
import { Settings, Save, ShieldAlert, CheckCircle2 } from "lucide-react"
import toast from "react-hot-toast"

export default function OnboardingFeeManagement() {
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({
    RESTAURANT: { price: 0, isActive: false },
    SELLER: { price: 0, isActive: false },
    DELIVERY_PARTNER: { price: 0, isActive: false }
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await onboardingFeeAPI.getConfig()
      if (res?.data?.success) {
        // Map backend response safely
        const data = res.data.data || {}
        setConfig({
          RESTAURANT: {
            price: data.RESTAURANT?.price ?? 0,
            isActive: data.RESTAURANT?.isActive ?? false
          },
          SELLER: {
            price: data.SELLER?.price ?? 0,
            isActive: data.SELLER?.isActive ?? false
          },
          DELIVERY_PARTNER: {
            price: data.DELIVERY_PARTNER?.price ?? 0,
            isActive: data.DELIVERY_PARTNER?.isActive ?? false
          }
        })
      } else {
        toast.error("Failed to load onboarding fee configurations")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error connecting to settings server")
    } finally {
      setLoading(false)
    }
  }

  const handlePriceChange = (role, value) => {
    const numeric = parseFloat(value) || 0
    setConfig(prev => ({
      ...prev,
      [role]: { ...prev[role], price: numeric }
    }))
  }

  const handleToggleActive = (role) => {
    setConfig(prev => ({
      ...prev,
      [role]: { ...prev[role], isActive: !prev[role].isActive }
    }))
  }

  const handleSave = async (role) => {
    try {
      const payload = {
        price: config[role].price,
        isActive: config[role].isActive
      }
      const res = await onboardingFeeAPI.updateConfig(role, payload)
      if (res?.data?.success) {
        toast.success(`${role.replace("_", " ")} fee settings updated!`)
        fetchConfig()
      } else {
        toast.error("Failed to save configuration")
      }
    } catch (err) {
      console.error(err)
      toast.error(err.response?.data?.message || "Error saving settings")
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#FFEDED] rounded-lg text-[#FF0000]">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Onboarding Fee Management</h1>
              <p className="text-sm text-slate-500 mt-1">Configure registration fees for restaurants, sellers, and delivery partners.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#FF0000] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {/* 1. Restaurant */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Restaurant Onboarding Fee</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Charged during restaurant registration finish step</p>
                </div>
                <button
                  onClick={() => handleToggleActive("RESTAURANT")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    config.RESTAURANT.isActive ? "bg-[#FF0000]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.RESTAURANT.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Onboarding Price (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
                    <input
                      type="number"
                      value={config.RESTAURANT.price}
                      onChange={(e) => handlePriceChange("RESTAURANT", e.target.value)}
                      className="pl-8 pr-4 py-2 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000]/30 focus:border-[#FF0000]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {config.RESTAURANT.isActive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                        <ShieldAlert className="w-3.5 h-3.5" /> Deactivated
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave("RESTAURANT")}
                    className="px-4 py-2 bg-[#FF0000] hover:bg-[#d85418] text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Seller */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Seller Onboarding Fee</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Charged during quick commerce seller profile approval submission</p>
                </div>
                <button
                  onClick={() => handleToggleActive("SELLER")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    config.SELLER.isActive ? "bg-[#FF0000]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.SELLER.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Onboarding Price (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
                    <input
                      type="number"
                      value={config.SELLER.price}
                      onChange={(e) => handlePriceChange("SELLER", e.target.value)}
                      className="pl-8 pr-4 py-2 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000]/30 focus:border-[#FF0000]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {config.SELLER.isActive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                        <ShieldAlert className="w-3.5 h-3.5" /> Deactivated
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave("SELLER")}
                    className="px-4 py-2 bg-[#FF0000] hover:bg-[#d85418] text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Delivery Boy */}
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Delivery Boy Onboarding Fee</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Charged during delivery partner registration checkout</p>
                </div>
                <button
                  onClick={() => handleToggleActive("DELIVERY_PARTNER")}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    config.DELIVERY_PARTNER.isActive ? "bg-[#FF0000]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      config.DELIVERY_PARTNER.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="p-6 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Onboarding Price (INR)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
                    <input
                      type="number"
                      value={config.DELIVERY_PARTNER.price}
                      onChange={(e) => handlePriceChange("DELIVERY_PARTNER", e.target.value)}
                      className="pl-8 pr-4 py-2 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000]/30 focus:border-[#FF0000]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {config.DELIVERY_PARTNER.isActive ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full">
                        <ShieldAlert className="w-3.5 h-3.5" /> Deactivated
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave("DELIVERY_PARTNER")}
                    className="px-4 py-2 bg-[#FF0000] hover:bg-[#d85418] text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
