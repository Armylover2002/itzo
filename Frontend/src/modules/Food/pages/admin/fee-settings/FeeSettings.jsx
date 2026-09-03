import { useEffect, useState } from "react"
import { Save, Loader2, DollarSign, Plus, Trash2, Edit, Check, X, Truck, Store } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const EMPTY_RULE = {
  minOrderAmount: "",
  maxOrderAmount: "",
  maxDistanceKm: "",
  sponsorType: "USER_FULL",
  sponsoredKm: "",
}

const toInputValue = (value) => (value == null ? "" : String(value))
const toNullableNumber = (value) =>
  value === "" || value == null ? undefined : Number(value)

export default function FeeSettings() {
  const [feeSettings, setFeeSettings] = useState({
    baseDistanceKm: "",
    baseDeliveryFee: "",
    perKmCharge: "",
    sponsorRules: [],
    platformFee: "",
    gstRate: "",
  })
  const [loadingFeeSettings, setLoadingFeeSettings] = useState(false)
  const [savingFeeSettings, setSavingFeeSettings] = useState(false)
  const [editingRuleIndex, setEditingRuleIndex] = useState(null)
  const [ruleDraft, setRuleDraft] = useState(EMPTY_RULE)

  const hydrateFeeSettings = (settings) => ({
    baseDistanceKm: toInputValue(settings?.baseDistanceKm),
    baseDeliveryFee: toInputValue(settings?.baseDeliveryFee ?? settings?.deliveryFee),
    perKmCharge: toInputValue(settings?.perKmCharge),
    sponsorRules: Array.isArray(settings?.sponsorRules) ? settings.sponsorRules : [],
    platformFee: toInputValue(settings?.platformFee),
    gstRate: toInputValue(settings?.gstRate),
  })

  const fetchFeeSettings = async () => {
    try {
      setLoadingFeeSettings(true)
      const response = await adminAPI.getFeeSettings()
      if (response.data.success && response.data.data.feeSettings) {
        setFeeSettings(hydrateFeeSettings(response.data.data.feeSettings))
      } else {
        setFeeSettings(hydrateFeeSettings(null))
      }
    } catch (error) {
      toast.error("Failed to load fee settings")
    } finally {
      setLoadingFeeSettings(false)
    }
  }

  useEffect(() => {
    fetchFeeSettings()
  }, [])

  const validateRuleDraft = () => {
    const minOrderAmount = Number(ruleDraft.minOrderAmount)
    const maxOrderAmount =
      ruleDraft.maxOrderAmount === "" ? null : Number(ruleDraft.maxOrderAmount)
    const maxDistanceKm = Number(ruleDraft.maxDistanceKm)
    const sponsoredKm =
      ruleDraft.sponsoredKm === "" ? null : Number(ruleDraft.sponsoredKm)

    if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
      toast.error("Minimum order amount must be 0 or more")
      return null
    }
    if (maxOrderAmount != null && (!Number.isFinite(maxOrderAmount) || maxOrderAmount < minOrderAmount)) {
      toast.error("Maximum order amount must be greater than or equal to minimum order amount")
      return null
    }
    if (!Number.isFinite(maxDistanceKm) || maxDistanceKm < 0) {
      toast.error("Maximum distance must be 0 or more")
      return null
    }
    if (ruleDraft.sponsorType === "SPLIT" && (!Number.isFinite(sponsoredKm) || sponsoredKm < 0)) {
      toast.error("Sponsored KM is required for split rules")
      return null
    }

    return {
      minOrderAmount,
      maxOrderAmount,
      maxDistanceKm,
      sponsorType: ruleDraft.sponsorType,
      sponsoredKm: ruleDraft.sponsorType === "SPLIT" ? sponsoredKm : null,
    }
  }

  const handleAddRule = () => {
    const nextRule = validateRuleDraft()
    if (!nextRule) return

    setFeeSettings((prev) => ({
      ...prev,
      sponsorRules: [...prev.sponsorRules, nextRule],
    }))
    setRuleDraft(EMPTY_RULE)
    toast.success("Rule added successfully")
  }

  const handleEditRule = (index) => {
    const rule = feeSettings.sponsorRules[index]
    if (!rule) return
    setEditingRuleIndex(index)
    setRuleDraft({
      minOrderAmount: toInputValue(rule.minOrderAmount),
      maxOrderAmount: toInputValue(rule.maxOrderAmount),
      maxDistanceKm: toInputValue(rule.maxDistanceKm),
      sponsorType: rule.sponsorType || "USER_FULL",
      sponsoredKm: toInputValue(rule.sponsoredKm),
    })
  }

  const handleSaveRule = () => {
    const nextRule = validateRuleDraft()
    if (!nextRule) return
    setFeeSettings((prev) => ({
      ...prev,
      sponsorRules: prev.sponsorRules.map((rule, index) =>
        index === editingRuleIndex ? nextRule : rule,
      ),
    }))
    setEditingRuleIndex(null)
    setRuleDraft(EMPTY_RULE)
    toast.success("Rule updated successfully")
  }

  const handleDeleteRule = (index) => {
    setFeeSettings((prev) => ({
      ...prev,
      sponsorRules: prev.sponsorRules.filter((_, ruleIndex) => ruleIndex !== index),
    }))
    if (editingRuleIndex === index) {
      setEditingRuleIndex(null)
      setRuleDraft(EMPTY_RULE)
    }
    toast.success("Rule deleted successfully")
  }

  const handleCancelEdit = () => {
    setEditingRuleIndex(null)
    setRuleDraft(EMPTY_RULE)
  }

  const handleSaveFeeSettings = async () => {
    const baseDistanceKm = toNullableNumber(feeSettings.baseDistanceKm)
    const baseDeliveryFee = toNullableNumber(feeSettings.baseDeliveryFee)
    const perKmCharge = toNullableNumber(feeSettings.perKmCharge)

    if (baseDistanceKm === undefined || baseDistanceKm < 0) {
      toast.error("Base distance is required")
      return
    }
    if (baseDeliveryFee === undefined || baseDeliveryFee < 0) {
      toast.error("Base delivery fee is required")
      return
    }
    if (perKmCharge === undefined || perKmCharge < 0) {
      toast.error("Per KM charge is required")
      return
    }

    try {
      setSavingFeeSettings(true)
      const response = await adminAPI.createOrUpdateFeeSettings({
        baseDistanceKm,
        baseDeliveryFee,
        perKmCharge,
        sponsorRules: feeSettings.sponsorRules,
        platformFee: toNullableNumber(feeSettings.platformFee),
        gstRate: toNullableNumber(feeSettings.gstRate),
        isActive: true,
      })

      if (response.data.success) {
        toast.success("Fee settings saved successfully")
        setFeeSettings(hydrateFeeSettings(response?.data?.data?.feeSettings))
      } else {
        toast.error(response.data.message || "Failed to save fee settings")
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save fee settings")
    } finally {
      setSavingFeeSettings(false)
    }
  }

  const previewBaseDistance = Number(feeSettings.baseDistanceKm || 0)
  const previewBaseFee = Number(feeSettings.baseDeliveryFee || 0)
  const previewPerKmCharge = Number(feeSettings.perKmCharge || 0)
  const previewLongDistanceFee =
    previewBaseFee +
    Math.max(0, 5 - Math.max(0, previewBaseDistance)) * previewPerKmCharge

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery & Platform Fee</h1>
        </div>
        <p className="text-sm text-slate-600">
          Configure distance-based delivery pricing, sponsor rules, platform fee, and GST.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fee Configuration</h2>
              <p className="text-sm text-slate-500 mt-1">
                Only the FOOD delivery fee model is changed here. Mixed-order settings continue elsewhere.
              </p>
            </div>
            <Button
              onClick={handleSaveFeeSettings}
              disabled={savingFeeSettings || loadingFeeSettings}
              className="bg-[#6412c6] hover:bg-[#550fa8] text-white flex items-center gap-2"
            >
              {savingFeeSettings ? (
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

          {loadingFeeSettings ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Base Delivery Config</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Base Distance (KM)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={feeSettings.baseDistanceKm}
                        onChange={(e) => setFeeSettings((prev) => ({ ...prev, baseDistanceKm: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Base Delivery Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={feeSettings.baseDeliveryFee}
                        onChange={(e) => setFeeSettings((prev) => ({ ...prev, baseDeliveryFee: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="40"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Per KM Charge (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={feeSettings.perKmCharge}
                        onChange={(e) => setFeeSettings((prev) => ({ ...prev, perKmCharge: e.target.value }))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="10"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-emerald-200 bg-emerald-50 rounded-xl p-5">
                  <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-[0.14em] mb-3">Preview</h4>
                  <div className="space-y-2 text-sm text-emerald-900">
                    <p>0-{previewBaseDistance || 0} KM: ₹{previewBaseFee.toFixed(2)}</p>
                    <p>
                      5 KM example: ₹{previewLongDistanceFee.toFixed(2)}
                    </p>
                    <p className="text-emerald-700">
                      Formula: base fee + extra distance × per KM charge
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-5 mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-slate-900">Dynamic Delivery Sponsor Rules</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  If no rule matches, the default behavior is <strong className="text-slate-700">USER_FULL</strong>.
                </p>

                {feeSettings.sponsorRules.length > 0 && (
                  <div className="overflow-x-auto mb-5">
                    <table className="w-full border border-slate-200 rounded-lg">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Min Order</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Max Order</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Max Distance</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Sponsor Type</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Sponsored KM</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeSettings.sponsorRules.map((rule, index) => (
                          <tr key={`${rule.sponsorType}-${index}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm border-b border-slate-100">₹{Number(rule.minOrderAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm border-b border-slate-100">
                              {rule.maxOrderAmount == null ? "No limit" : `₹${Number(rule.maxOrderAmount).toFixed(2)}`}
                            </td>
                            <td className="px-4 py-3 text-sm border-b border-slate-100">{Number(rule.maxDistanceKm || 0).toFixed(2)} KM</td>
                            <td className="px-4 py-3 text-sm border-b border-slate-100">{rule.sponsorType}</td>
                            <td className="px-4 py-3 text-sm border-b border-slate-100">
                              {rule.sponsorType === "SPLIT" ? `${Number(rule.sponsoredKm || 0).toFixed(2)} KM` : "--"}
                            </td>
                            <td className="px-4 py-3 text-center border-b border-slate-100">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleEditRule(index)}
                                  className="p-1.5 text-primary hover:bg-[#f7f3fc] rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRule(index)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="w-4 h-4 text-green-600" />
                    <h4 className="text-sm font-semibold text-slate-700">
                      {editingRuleIndex === null ? "Add Sponsor Rule" : "Edit Sponsor Rule"}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Min Order Amount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ruleDraft.minOrderAmount}
                        onChange={(e) => setRuleDraft((prev) => ({ ...prev, minOrderAmount: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Max Order Amount (optional)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ruleDraft.maxOrderAmount}
                        onChange={(e) => setRuleDraft((prev) => ({ ...prev, maxOrderAmount: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="Leave empty"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Max Distance (KM)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={ruleDraft.maxDistanceKm}
                        onChange={(e) => setRuleDraft((prev) => ({ ...prev, maxDistanceKm: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="7"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Sponsor Type</label>
                      <select
                        value={ruleDraft.sponsorType}
                        onChange={(e) => setRuleDraft((prev) => ({ ...prev, sponsorType: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      >
                        <option value="USER_FULL">USER_FULL</option>
                        <option value="RESTAURANT_FULL">RESTAURANT_FULL</option>
                        <option value="SPLIT">SPLIT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Sponsored KM</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={ruleDraft.sponsoredKm}
                        onChange={(e) => setRuleDraft((prev) => ({ ...prev, sponsoredKm: e.target.value }))}
                        disabled={ruleDraft.sponsorType !== "SPLIT"}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none disabled:bg-slate-100"
                        placeholder={ruleDraft.sponsorType === "SPLIT" ? "7" : "Only for split"}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    {editingRuleIndex !== null && (
                      <Button
                        onClick={handleCancelEdit}
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={editingRuleIndex === null ? handleAddRule : handleSaveRule}
                      className="bg-[#6412c6] hover:bg-[#550fa8] text-white"
                    >
                      {editingRuleIndex === null ? (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Rule
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Save Rule
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-200 pt-6 mt-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Platform Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={feeSettings.platformFee}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, platformFee: e.target.value }))}
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="5"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={feeSettings.gstRate}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, gstRate: e.target.value }))}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                    placeholder="5"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
