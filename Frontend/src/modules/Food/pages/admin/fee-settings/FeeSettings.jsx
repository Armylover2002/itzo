import { useState, useEffect } from "react"
import { Save, Loader2, DollarSign, Plus, Trash2, Edit, Check, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Fee Settings Component - Range-based delivery fee configuration
export default function FeeSettings() {
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: "",
    deliveryFeeRanges: [],
    platformFee: "",
    packagingFee: "",
    gstRate: "",
    quickDelivery: {
      enabled: false,
      charge: 30,
      platformSharePct: 70,
      riderSharePct: 30,
      restaurantSharePct: 0,
      maxDistanceKm: 8,
      maxEtaMinutes: 30,
      defaultKitchenPrepMinutes: 12,
    },
  })

  /** Admin UI — business fields only (engineering knobs are server-internal). */
  const defaultQuickDeliveryBusiness = () => ({
    enabled: false,
    charge: 30,
    platformSharePct: 70,
    riderSharePct: 30,
    restaurantSharePct: 0,
    maxDistanceKm: 8,
    maxEtaMinutes: 30,
    defaultKitchenPrepMinutes: 12,
  })

  const mapFeeSettingsFromApi = (src) => {
    const qd = src?.quickDelivery && typeof src.quickDelivery === "object" ? src.quickDelivery : {}
    return {
      deliveryFee: src?.deliveryFee ?? "",
      deliveryFeeRanges: src?.deliveryFeeRanges || [],
      platformFee: src?.platformFee ?? "",
      packagingFee: src?.packagingFee ?? "",
      gstRate: src?.gstRate ?? "",
      quickDelivery: {
        ...defaultQuickDeliveryBusiness(),
        enabled: qd.enabled === true,
        charge: qd.charge ?? 30,
        platformSharePct: qd.platformSharePct ?? 70,
        riderSharePct: qd.riderSharePct ?? 30,
        restaurantSharePct: qd.restaurantSharePct ?? 0,
        maxDistanceKm: qd.maxDistanceKm ?? 8,
        maxEtaMinutes: qd.maxEtaMinutes ?? 30,
        defaultKitchenPrepMinutes: qd.defaultKitchenPrepMinutes ?? 12,
      },
    }
  }
  const [loadingFeeSettings, setLoadingFeeSettings] = useState(false)
  const [savingFeeSettings, setSavingFeeSettings] = useState(false)
  const [editingRangeIndex, setEditingRangeIndex] = useState(null)
  const [newRange, setNewRange] = useState({ 
    min: '', 
    max: '', 
    fee: '0', 
    deliveryBoyPerKm: '0', 
    deliveryBoyBasePay: '0' 
  })

  const QUICK_SHARE_TOTAL_ERROR =
    "Platform Share + Rider Share + Restaurant Share must equal exactly 100%."
  const QUICK_CHARGE_ERROR = "Quick Charge must be greater than or equal to 0."
  const QUICK_DISTANCE_ERROR = "Maximum Delivery Distance must be greater than 0."
  const QUICK_ETA_ERROR = "Maximum ETA must be greater than 0."
  const QUICK_PREP_ERROR = "Default kitchen prep must be between 1 and 90 minutes."

  const getQuickShareTotals = (qd = feeSettings.quickDelivery) => {
    const platformRaw = qd?.platformSharePct
    const riderRaw = qd?.riderSharePct
    const restaurantRaw = qd?.restaurantSharePct
    if (
      platformRaw === "" ||
      riderRaw === "" ||
      restaurantRaw === "" ||
      platformRaw == null ||
      riderRaw == null ||
      restaurantRaw == null
    ) {
      return {
        platformSharePct: NaN,
        riderSharePct: NaN,
        restaurantSharePct: NaN,
        total: NaN,
        isValid: false,
        bothFinite: false,
      }
    }
    const platformSharePct = Number(platformRaw)
    const riderSharePct = Number(riderRaw)
    const restaurantSharePct = Number(restaurantRaw)
    const bothFinite =
      Number.isFinite(platformSharePct) &&
      Number.isFinite(riderSharePct) &&
      Number.isFinite(restaurantSharePct)
    const total = bothFinite
      ? platformSharePct + riderSharePct + restaurantSharePct
      : NaN
    const isValid = bothFinite && Math.abs(total - 100) < 0.01
    return {
      platformSharePct,
      riderSharePct,
      restaurantSharePct,
      total,
      isValid,
      bothFinite,
    }
  }

  const getQuickBusinessFieldErrors = (qd = feeSettings.quickDelivery) => {
    const errors = {}
    const chargeRaw = qd?.charge
    const distanceRaw = qd?.maxDistanceKm
    const etaRaw = qd?.maxEtaMinutes

    if (chargeRaw === "" || chargeRaw == null || !Number.isFinite(Number(chargeRaw)) || Number(chargeRaw) < 0) {
      errors.charge = QUICK_CHARGE_ERROR
    }
    if (distanceRaw === "" || distanceRaw == null || !Number.isFinite(Number(distanceRaw)) || !(Number(distanceRaw) > 0)) {
      errors.maxDistanceKm = QUICK_DISTANCE_ERROR
    }
    if (etaRaw === "" || etaRaw == null || !Number.isFinite(Number(etaRaw)) || !(Number(etaRaw) > 0)) {
      errors.maxEtaMinutes = QUICK_ETA_ERROR
    }
    const prepRaw = qd?.defaultKitchenPrepMinutes
    if (
      prepRaw === "" ||
      prepRaw == null ||
      !Number.isFinite(Number(prepRaw)) ||
      Number(prepRaw) < 1 ||
      Number(prepRaw) > 90
    ) {
      errors.defaultKitchenPrepMinutes = QUICK_PREP_ERROR
    }
    if (!getQuickShareTotals(qd).isValid) {
      errors.shareTotal = QUICK_SHARE_TOTAL_ERROR
    }
    return errors
  }

  const quickFieldErrors = getQuickBusinessFieldErrors()
  const quickShareInvalid = Boolean(quickFieldErrors.shareTotal)
  const quickFinanceInvalid = Object.keys(quickFieldErrors).length > 0

  // Fetch fee settings
  const fetchFeeSettings = async () => {
    try {
      setLoadingFeeSettings(true)
      const response = await adminAPI.getFeeSettings()
      if (response.data.success && response.data.data.feeSettings) {
        setFeeSettings(mapFeeSettingsFromApi(response.data.data.feeSettings))
      } else if (response.data.success && response.data.data.feeSettings === null) {
        // Not configured yet - keep empty fields (no defaults for basic fees).
        setFeeSettings({
          deliveryFee: "",
          deliveryFeeRanges: [],
          platformFee: "",
          packagingFee: "",
          gstRate: "",
          quickDelivery: defaultQuickDeliveryBusiness(),
        })
      }
    } catch (error) {
      debugError('Error fetching fee settings:', error)
      toast.error('Failed to load fee settings')
    } finally {
      setLoadingFeeSettings(false)
    }
  }

  // Fetch fee settings on mount
  useEffect(() => {
    fetchFeeSettings()
  }, [])

  // Unified save function
  const saveSettings = async (settingsToSave) => {
    const qd = settingsToSave.quickDelivery || defaultQuickDeliveryBusiness()
    const fieldErrors = getQuickBusinessFieldErrors(qd)
    if (Object.keys(fieldErrors).length > 0) {
      toast.error(
        fieldErrors.shareTotal ||
          fieldErrors.charge ||
          fieldErrors.maxDistanceKm ||
          fieldErrors.maxEtaMinutes ||
          fieldErrors.defaultKitchenPrepMinutes
      )
      return false
    }

    try {
      setSavingFeeSettings(true)
      const payload = {
        deliveryFee: settingsToSave.deliveryFee === "" ? undefined : Number(settingsToSave.deliveryFee),
        deliveryFeeRanges: settingsToSave.deliveryFeeRanges.map(r => ({
          ...r,
          deliveryBoyPerKm: r.deliveryBoyPerKm === "" ? 0 : Number(r.deliveryBoyPerKm),
          deliveryBoyBasePay: r.deliveryBoyBasePay === "" ? 0 : Number(r.deliveryBoyBasePay),
        })),
        platformFee: settingsToSave.platformFee === "" ? undefined : Number(settingsToSave.platformFee),
        packagingFee: settingsToSave.packagingFee === "" ? undefined : Number(settingsToSave.packagingFee),
        gstRate: settingsToSave.gstRate === "" ? undefined : Number(settingsToSave.gstRate),
        // Business fields only — server preserves / defaults engineering internals
        quickDelivery: {
          enabled: qd.enabled === true,
          charge: Number(qd.charge) || 0,
          platformSharePct: Number(qd.platformSharePct) || 0,
          riderSharePct: Number(qd.riderSharePct) || 0,
          restaurantSharePct: Number(qd.restaurantSharePct) || 0,
          maxDistanceKm: Number(qd.maxDistanceKm) || 0,
          maxEtaMinutes: Number(qd.maxEtaMinutes) || 0,
          defaultKitchenPrepMinutes: Number(qd.defaultKitchenPrepMinutes) || 12,
        },
        isActive: true,
      }
      
      debugLog('[DEBUG] Saving Fee Settings Payload:', payload)
      
      const response = await adminAPI.createOrUpdateFeeSettings(payload)

      if (response.data.success) {
        toast.success('Settings saved successfully')
        const saved = response?.data?.data?.feeSettings
        if (saved) {
          setFeeSettings(mapFeeSettingsFromApi(saved))
        }
        return true
      } else {
        toast.error(response.data.message || 'Failed to save settings')
        return false
      }
    } catch (error) {
      debugError('Error saving fee settings:', error)
      toast.error(error.response?.data?.message || 'Failed to save settings')
      return false
    } finally {
      setSavingFeeSettings(false)
    }
  }

  // Save fee settings (main button)
  const handleSaveFeeSettings = async () => {
    await saveSettings(feeSettings)
  }
  // Check if any range (other than the one being edited) has a base pay set
  const hasBasePayConfigured = (excludeIndex = null) => {
    return feeSettings.deliveryFeeRanges.some((range, idx) => 
      idx !== excludeIndex && Number(range.deliveryBoyBasePay) > 0
    )
  }

  // Add or update delivery fee range
  const handleAddRange = async () => {
    // Robust validation: check if values are present and not just empty strings
    const minRaw = String(newRange.min).trim()
    const maxRaw = String(newRange.max).trim()
    const feeRaw = String(newRange.fee).trim()

    if (minRaw === '' || maxRaw === '' || feeRaw === '') {
      toast.error('Please fill all fields (Min, Max, Fee)')
      return
    }

    const min = Number(minRaw)
    const max = Number(maxRaw)
    const fee = Number(feeRaw)
    const dbPerKm = Number(newRange.deliveryBoyPerKm || 0)
    const dbBasePay = Number(newRange.deliveryBoyBasePay || 0)

    if (isNaN(min) || isNaN(max) || isNaN(fee) || isNaN(dbPerKm) || isNaN(dbBasePay)) {
      toast.error('Please enter valid numbers')
      return
    }

    if (min < 0 || max < 0 || fee < 0 || dbPerKm < 0 || dbBasePay < 0) {
      toast.error('All values must be positive numbers')
      return
    }

    // Mutual exclusivity within range
    if (dbPerKm > 0 && dbBasePay > 0) {
      toast.error('Please set either Per KM Amount or Base Pay, not both')
      return
    }

    // Base Pay uniqueness check
    if (dbBasePay > 0 && hasBasePayConfigured()) {
      toast.error('Base Pay can only be set for one range. It is already configured in another range.')
      return
    }

    if (min >= max) {
      toast.error('Min distance must be less than Max distance')
      return
    }

    // Check for overlapping ranges (excluding the current one being edited)
    const otherRanges = editingRangeIndex !== null
      ? feeSettings.deliveryFeeRanges.filter((_, i) => i !== editingRangeIndex)
      : feeSettings.deliveryFeeRanges

    for (const range of otherRanges) {
      if (
        (min >= range.min && min < range.max) ||
        (max > range.min && max <= range.max) ||
        (min <= range.min && max >= range.max)
      ) {
        toast.error('This range overlaps with an existing range')
        return
      }
    }

    const updatedRanges = [...feeSettings.deliveryFeeRanges, { 
      min, 
      max, 
      fee, 
      deliveryBoyPerKm: dbPerKm, 
      deliveryBoyBasePay: dbBasePay 
    }]
    updatedRanges.sort((a, b) => a.min - b.min)

    const updatedSettings = {
      ...feeSettings,
      deliveryFeeRanges: updatedRanges
    }

    setFeeSettings(updatedSettings)
    
    // Save to DB immediately
    await saveSettings(updatedSettings)

    // Reset state
    setNewRange({ min: '', max: '', fee: '0', deliveryBoyPerKm: '0', deliveryBoyBasePay: '0' })
  }

  // Delete delivery fee range
  const handleDeleteRange = async (index) => {
    const newRanges = feeSettings.deliveryFeeRanges.filter((_, i) => i !== index)
    const updatedSettings = {
      ...feeSettings,
      deliveryFeeRanges: newRanges
    }
    setFeeSettings(updatedSettings)
    await saveSettings(updatedSettings)
  }

  // Edit delivery fee range
  const handleEditRange = (index) => {
    const range = feeSettings.deliveryFeeRanges[index]
    setNewRange({ 
      min: range.min, 
      max: range.max, 
      fee: range.fee || '0',
      deliveryBoyPerKm: range.deliveryBoyPerKm ?? '0',
      deliveryBoyBasePay: range.deliveryBoyBasePay ?? '0'
    })
    setEditingRangeIndex(index)
  }

  // Save edited range
  const handleSaveEditRange = async () => {
    if (newRange.min === '' || newRange.max === '' || newRange.fee === '') {
      toast.error('Please fill all fields')
      return
    }

    const min = Number(newRange.min)
    const max = Number(newRange.max)
    const fee = Number(newRange.fee)
    const dbPerKm = Number(newRange.deliveryBoyPerKm || 0)
    const dbBasePay = Number(newRange.deliveryBoyBasePay || 0)

    if (min < 0 || max < 0 || fee < 0 || dbPerKm < 0 || dbBasePay < 0) {
      toast.error('All values must be positive numbers')
      return
    }

    // Mutual exclusivity within range
    if (dbPerKm > 0 && dbBasePay > 0) {
      toast.error('Please set either Per KM Amount or Base Pay, not both')
      return
    }

    // Base Pay uniqueness check
    if (dbBasePay > 0 && hasBasePayConfigured(editingRangeIndex)) {
      toast.error('Base Pay can only be set for one range. It is already configured in another range.')
      return
    }

    if (min >= max) {
      toast.error('Min value must be less than Max value')
      return
    }

    const ranges = [...feeSettings.deliveryFeeRanges]
    // Remove the range being edited
    ranges.splice(editingRangeIndex, 1)

    // Check for overlapping ranges
    for (const range of ranges) {
      if ((min >= range.min && min < range.max) || (max > range.min && max <= range.max) || (min <= range.min && max >= range.max)) {
        toast.error('This range overlaps with an existing range')
        return
      }
    }

    // Add updated range
    ranges.push({ 
      min, 
      max, 
      fee, 
      deliveryBoyPerKm: dbPerKm, 
      deliveryBoyBasePay: dbBasePay 
    })
    ranges.sort((a, b) => a.min - b.min)

    const updatedSettings = {
      ...feeSettings,
      deliveryFeeRanges: ranges
    }

    setFeeSettings(updatedSettings)
    await saveSettings(updatedSettings)

    setNewRange({ min: '', max: '', fee: '0', deliveryBoyPerKm: '0', deliveryBoyBasePay: '0' })
    setEditingRangeIndex(null)
  }

  // Cancel edit
  const handleCancelEdit = () => {
    setNewRange({ min: '', max: '', fee: '0', deliveryBoyPerKm: '0', deliveryBoyBasePay: '0' })
    setEditingRangeIndex(null)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery & Platform Fee</h1>
        </div>
        <p className="text-sm text-slate-600">
          Configure delivery fee, platform fee, and GST settings for orders
        </p>
      </div>

      {/* Fee Settings Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fee Configuration</h2>
              <p className="text-sm text-slate-500 mt-1">
                Set the fees and charges that will be applied to all orders
              </p>
            </div>
            <Button
              onClick={handleSaveFeeSettings}
              disabled={savingFeeSettings || loadingFeeSettings || quickFinanceInvalid}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              {/* Delivery Fee Ranges Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Delivery Fee by Distance Range</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Set different delivery fees based on distance ranges (in km)
                    </p>
                  </div>
                </div>

                {/* Ranges Table */}
                {feeSettings.deliveryFeeRanges.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full border border-slate-200 rounded-lg">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Min Distance (km)</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Max Distance (km)</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">User Delivery Fee (₹)</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">DB Per KM (₹)</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">DB Base Pay (₹)</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {feeSettings.deliveryFeeRanges
                          .map((range, originalIndex) => ({ range, originalIndex }))
                          .sort((a, b) => a.range.min - b.range.min)
                          .map(({ range, originalIndex }) => {
                            const isEditing = editingRangeIndex === originalIndex;
                            return (
                              <tr key={originalIndex} className={`${isEditing ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}>
                                  <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        value={newRange.min}
                                        onChange={(e) => setNewRange({ ...newRange, min: e.target.value })}
                                        className="w-24 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                      <span className="text-slate-400">km</span>
                                    </div>
                                  ) : (
                                    <>{range.min} km</>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        value={newRange.max}
                                        onChange={(e) => setNewRange({ ...newRange, max: e.target.value })}
                                        className="w-24 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                      />
                                      <span className="text-slate-400">km</span>
                                    </div>
                                  ) : (
                                    <>{range.max} km</>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-green-600 border-b border-slate-100">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">₹</span>
                                      <input
                                        type="number"
                                        value={newRange.fee}
                                        onChange={(e) => setNewRange({ ...newRange, fee: e.target.value })}
                                        className="w-20 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-green-600 font-medium"
                                      />
                                    </div>
                                  ) : (
                                    <>₹{range.fee}</>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">₹</span>
                                      <input
                                        type="number"
                                        value={newRange.deliveryBoyPerKm}
                                        disabled={Number(newRange.deliveryBoyBasePay) > 0}
                                        onChange={(e) => setNewRange({ ...newRange, deliveryBoyPerKm: e.target.value, deliveryBoyBasePay: '0' })}
                                        className="w-20 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        placeholder="0"
                                      />
                                    </div>
                                  ) : (
                                    <>{range.deliveryBoyPerKm !== undefined && range.deliveryBoyPerKm !== null ? `₹${range.deliveryBoyPerKm}` : '-'}</>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-900 border-b border-slate-100">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-slate-400">₹</span>
                                      <input
                                        type="number"
                                        value={newRange.deliveryBoyBasePay}
                                        disabled={Number(newRange.deliveryBoyPerKm) > 0 || (hasBasePayConfigured(originalIndex))}
                                        onChange={(e) => setNewRange({ ...newRange, deliveryBoyBasePay: e.target.value, deliveryBoyPerKm: '0' })}
                                        className="w-20 px-2 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        placeholder="0"
                                      />
                                    </div>
                                  ) : (
                                    <>{range.deliveryBoyBasePay !== undefined && range.deliveryBoyBasePay !== null ? `₹${range.deliveryBoyBasePay}` : '-'}</>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center border-b border-slate-100">
                                  <div className="flex items-center justify-center gap-2">
                                    {isEditing ? (
                                      <>
                                        <button
                                          onClick={handleSaveEditRange}
                                          className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                                          title="Save"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={handleCancelEdit}
                                          className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                          title="Cancel"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleEditRange(originalIndex)}
                                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="Edit"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteRange(originalIndex)}
                                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add/Edit Range Form */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      {editingRangeIndex !== null ? (
                        <Edit className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Plus className="w-4 h-4 text-green-600" />
                      )}
                    <h4 className="text-sm font-semibold text-slate-700">
                      {editingRangeIndex !== null ? 'Edit Range' : 'Add New Range'}
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Min Distance (km)</label>
                      <input
                        type="number"
                        value={newRange.min}
                        onChange={(e) => setNewRange({ ...newRange, min: e.target.value })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Max Distance (km)</label>
                      <input
                        type="number"
                        value={newRange.max}
                        onChange={(e) => setNewRange({ ...newRange, max: e.target.value })}
                        min="0"
                        step="0.1"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        placeholder="5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">User Delivery Fee (₹)</label>
                      <input
                        type="number"
                        value={newRange.fee}
                        onChange={(e) => setNewRange({ ...newRange, fee: e.target.value })}
                        min="0"
                        step="1"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">DB Per KM (₹)</label>
                      <input
                        type="number"
                        value={newRange.deliveryBoyPerKm}
                        disabled={Number(newRange.deliveryBoyBasePay) > 0}
                        onChange={(e) => setNewRange({ ...newRange, deliveryBoyPerKm: e.target.value, deliveryBoyBasePay: '0' })}
                        min="0"
                        step="1"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">DB Base Pay (₹)</label>
                      <input
                        type="number"
                        value={newRange.deliveryBoyBasePay}
                        disabled={Number(newRange.deliveryBoyPerKm) > 0 || (hasBasePayConfigured(editingRangeIndex))}
                        onChange={(e) => setNewRange({ ...newRange, deliveryBoyBasePay: e.target.value, deliveryBoyPerKm: '0' })}
                        min="0"
                        step="1"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        onClick={editingRangeIndex !== null ? handleSaveEditRange : handleAddRange}
                        className={`${editingRangeIndex !== null ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white text-sm flex-1 flex items-center justify-center gap-2`}
                      >
                        {editingRangeIndex !== null ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {editingRangeIndex !== null ? 'Update' : 'Add Range'}
                      </Button>
                      {editingRangeIndex !== null && (
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="border-slate-300 text-slate-600 hover:bg-slate-100"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 italic">
                    Example: Orders within 0 to 3 km will have ₹20 delivery fee.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-200 pt-6 mt-6">

                {/* Platform Fee */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Platform Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={feeSettings.platformFee}
                    onChange={(e) => setFeeSettings({ ...feeSettings, platformFee: e.target.value })}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                    placeholder="5"
                  />
                  <p className="text-xs text-slate-500">
                    Platform service fee per order
                  </p>
                </div>

                {/* Packaging Fee */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Packaging Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={feeSettings.packagingFee}
                    onChange={(e) => setFeeSettings({ ...feeSettings, packagingFee: e.target.value })}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                    placeholder="0"
                  />
                  <p className="text-xs text-slate-500">
                    Packaging / packing charge per order
                  </p>
                </div>

                {/* GST Rate */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={feeSettings.gstRate}
                    onChange={(e) => setFeeSettings({ ...feeSettings, gstRate: e.target.value })}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                    placeholder="5"
                  />
                  <p className="text-xs text-slate-500">
                    GST percentage applied on order subtotal
                  </p>
                </div>
              </div>

              {/* Food Quick Delivery — Global business config only */}
              <div className="border-t border-slate-200 pt-6 mt-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Food Quick Delivery (Global)</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Enable Quick for Instant Food when Global, Restaurant, and Zone are all on.
                      Maximum Delivery Distance is the customer-path eligibility cap.
                      Maximum ETA is the quote eligibility cap (not a dispatch setting).
                      Rider search radius, MOV, and SLA are platform-managed.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feeSettings.quickDelivery?.enabled === true}
                      onChange={(e) =>
                        setFeeSettings({
                          ...feeSettings,
                          quickDelivery: {
                            ...feeSettings.quickDelivery,
                            enabled: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    Enable Quick Delivery
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { key: "charge", label: "Quick Charge (₹)", step: "1" },
                    { key: "platformSharePct", label: "Platform Share (%)", step: "1" },
                    { key: "riderSharePct", label: "Rider Share (%)", step: "1" },
                    { key: "restaurantSharePct", label: "Restaurant Share (%)", step: "1" },
                    { key: "maxDistanceKm", label: "Maximum Delivery Distance (km)", step: "0.1" },
                    { key: "maxEtaMinutes", label: "Maximum ETA (minutes)", step: "1" },
                    {
                      key: "defaultKitchenPrepMinutes",
                      label: "Default Kitchen Prep (minutes)",
                      step: "1",
                    },
                  ].map((field) => {
                    const isShareField =
                      field.key === "platformSharePct" ||
                      field.key === "riderSharePct" ||
                      field.key === "restaurantSharePct"
                    const fieldError =
                      field.key === "charge"
                        ? quickFieldErrors.charge
                        : field.key === "maxDistanceKm"
                          ? quickFieldErrors.maxDistanceKm
                          : field.key === "maxEtaMinutes"
                            ? quickFieldErrors.maxEtaMinutes
                            : field.key === "defaultKitchenPrepMinutes"
                              ? quickFieldErrors.defaultKitchenPrepMinutes
                              : isShareField
                                ? quickFieldErrors.shareTotal
                                : null
                    return (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-xs font-medium text-slate-600">{field.label}</label>
                      <input
                        type="number"
                        min={
                          field.key === "charge"
                            ? "0"
                            : field.key === "maxDistanceKm" || field.key === "maxEtaMinutes"
                              ? "0.01"
                              : field.key === "defaultKitchenPrepMinutes"
                                ? "1"
                                : "0"
                        }
                        max={
                          isShareField
                            ? "100"
                            : field.key === "defaultKitchenPrepMinutes"
                              ? "90"
                              : undefined
                        }
                        step={field.step}
                        value={feeSettings.quickDelivery?.[field.key] ?? ""}
                        onChange={(e) => {
                          const next = {
                            ...feeSettings.quickDelivery,
                            [field.key]: e.target.value === "" ? "" : Number(e.target.value),
                          }
                          setFeeSettings({ ...feeSettings, quickDelivery: next })
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 outline-none ${
                          fieldError
                            ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                            : "border-slate-300 focus:ring-green-500 focus:border-green-500"
                        }`}
                      />
                      {fieldError && !isShareField && (
                        <p className="text-xs text-red-600" role="alert">{fieldError}</p>
                      )}
                      {!fieldError && field.key === "defaultKitchenPrepMinutes" && (
                        <p className="text-[11px] text-slate-500">
                          Used when a restaurant has not set its own kitchen prep time.
                        </p>
                      )}
                    </div>
                    )
                  })}
                </div>
                {quickShareInvalid && (
                  <p className="text-sm text-red-600 font-medium" role="alert">
                    {QUICK_SHARE_TOTAL_ERROR}
                  </p>
                )}
              </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
