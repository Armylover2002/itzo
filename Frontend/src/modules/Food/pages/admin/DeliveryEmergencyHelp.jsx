import { useState, useEffect, useMemo } from "react"
import { Phone, Save, Loader2, AlertCircle, CheckCircle2, Ambulance, ShieldAlert, Siren, HeartPulse } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/* ── Per-field validation rules ── */
const FIELD_RULES = {
  medicalEmergency: {
    validate: (v) => /^\d{3}$/.test(v),
    maxLen: 3,
    errorMsg: "Must be exactly 3 digits (e.g. 108)",
  },
  accidentHelpline: {
    validate: (v) => /^\d{3,4}$/.test(v),
    maxLen: 4,
    errorMsg: "Must be 3 or 4 digits (e.g. 112, 1073)",
  },
  contactPolice: {
    validate: (v) => /^\d{3}$/.test(v),
    maxLen: 3,
    errorMsg: "Must be exactly 3 digits (e.g. 100)",
  },
  insurance: {
    validate: (v) => /^\d{10}$/.test(v) || /^1800\d{7,8}$/.test(v),
    maxLen: 12,
    errorMsg: "Must be 10-digit mobile or toll-free (1800xxxxxxx)",
  },
}

function validateField(fieldId, value) {
  if (!value) return "" // empty is allowed (optional)
  const rule = FIELD_RULES[fieldId]
  if (!rule) return ""
  return rule.validate(value) ? "" : rule.errorMsg
}

export default function DeliveryEmergencyHelp() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    medicalEmergency: "",
    accidentHelpline: "",
    contactPolice: "",
    insurance: "",
  })
  const [formErrors, setFormErrors] = useState({})

  // Fetch emergency help numbers on component mount
  useEffect(() => {
    fetchEmergencyHelp()
  }, [])

  const fetchEmergencyHelp = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getEmergencyHelp()
      
      if (response?.data?.success && response?.data?.data) {
        const data = response.data.data
        setFormData({
          medicalEmergency: data.medicalEmergency || "",
          accidentHelpline: data.accidentHelpline || "",
          contactPolice: data.contactPolice || "",
          insurance: data.insurance || "",
        })
      }
    } catch (error) {
      debugError("Error fetching emergency help:", error)
      toast.error("Failed to load emergency help numbers")
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    for (const fieldId of Object.keys(FIELD_RULES)) {
      const msg = validateField(fieldId, formData[fieldId])
      if (msg) errors[fieldId] = msg
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  /* Derived: is form currently valid? Used to disable button. */
  const isFormValid = useMemo(() => {
    for (const fieldId of Object.keys(FIELD_RULES)) {
      const val = formData[fieldId]
      if (val && !FIELD_RULES[fieldId].validate(val)) return false
    }
    return true
  }, [formData])

  const handleInputChange = (field, value) => {
    const rule = FIELD_RULES[field]
    const maxLen = rule ? rule.maxLen : 12
    const sanitizedValue = String(value || "").replace(/[^\d]/g, "").slice(0, maxLen)

    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }))

    // Live inline validation
    const msg = validateField(field, sanitizedValue)
    setFormErrors(prev => {
      if (!msg) {
        const next = { ...prev }
        delete next[field]
        return next
      }
      return { ...prev, [field]: msg }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setSaving(true)
      const response = await adminAPI.createOrUpdateEmergencyHelp({
        medicalEmergency: formData.medicalEmergency.trim(),
        accidentHelpline: formData.accidentHelpline.trim(),
        contactPolice: formData.contactPolice.trim(),
        insurance: formData.insurance.trim(),
      })

      if (response?.data?.success) {
        toast.success("Emergency help numbers saved successfully!")
        // Refresh data
        await fetchEmergencyHelp()
      } else {
        toast.error(response?.data?.message || "Failed to save emergency help numbers")
      }
    } catch (error) {
      debugError("Error saving emergency help:", error)
      toast.error(error?.response?.data?.message || "Failed to save emergency help numbers")
    } finally {
      setSaving(false)
    }
  }

  const emergencyFields = [
    {
      id: "medicalEmergency",
      label: "Medical Emergency",
      placeholder: "108",
      icon: HeartPulse,
      iconColor: "text-red-500",
      description: "Emergency ambulance number — exactly 3 digits"
    },
    {
      id: "accidentHelpline",
      label: "Accident Helpline",
      placeholder: "112 or 1073",
      icon: Ambulance,
      iconColor: "text-red-500",
      description: "Road accident helpline — 3 or 4 digits"
    },
    {
      id: "contactPolice",
      label: "Contact Police",
      placeholder: "100",
      icon: Siren,
      iconColor: "text-blue-500",
      description: "Police emergency number — exactly 3 digits"
    },
    {
      id: "insurance",
      label: "Insurance",
      placeholder: "9876543210 or 18001234567",
      icon: ShieldAlert,
      iconColor: "text-emerald-500",
      description: "10-digit mobile or toll-free number starting with 1800"
    }
  ]

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Phone className="w-6 h-6 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Emergency Help</h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage emergency contact numbers for delivery partners
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Important Information</p>
                <p>
                  These phone numbers will be displayed to delivery partners in the emergency help section. 
                  When a delivery partner clicks on any emergency option, it will automatically dial the corresponding number.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {emergencyFields.map((field) => {
              const IconComp = field.icon
              return (
                <div key={field.id} className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <IconComp className={`w-4 h-4 ${field.iconColor}`} />
                    {field.label}
                  </label>
                  <p className="text-xs text-slate-500">{field.description}</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData[field.id]}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      inputMode="numeric"
                      maxLength={FIELD_RULES[field.id]?.maxLen || 12}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        formErrors[field.id]
                          ? "border-red-300 focus:ring-red-400 bg-red-50/40"
                          : formData[field.id] && !validateField(field.id, formData[field.id])
                          ? "border-green-300 focus:ring-green-400"
                          : "border-slate-300 focus:ring-blue-500"
                      }`}
                    />
                    {/* Green tick for valid filled field */}
                    {formData[field.id] && !formErrors[field.id] && (
                      <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                    )}
                  </div>
                  {formErrors[field.id] && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {formErrors[field.id]}
                    </p>
                  )}
                </div>
              )
            })}

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-200">
              <button
                type="submit"
                disabled={saving || !isFormValid}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Emergency Numbers
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Success Message */}
          {!loading && !saving && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Changes will be reflected immediately for all delivery partners
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

