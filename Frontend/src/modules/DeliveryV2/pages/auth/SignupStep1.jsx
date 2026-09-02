import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function SignupStep1() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const queryRef = searchParams.get("ref") || ""

  const [formData, setFormData] = useState(() => {
    const base = {
      name: "",
      phone: "",
      countryCode: "+91",
      ref: queryRef,
      email: "",
      address: "",
      city: "",
      state: "",
      vehicleType: "bike",
      vehicleName: "",
      vehicleNumber: "",
      drivingLicenseNumber: "",
      panNumber: "",
      aadharNumber: ""
    }

    // Try phone-scoped localStorage first (persists across sessions),
    // then fall back to sessionStorage (backward compat)
    let saved = null
    try {
      const sessionRaw = sessionStorage.getItem("deliverySignupDetails")
      if (sessionRaw) {
        const sessionParsed = JSON.parse(sessionRaw)
        const phoneKey = String(sessionParsed.phone || "").replace(/\D/g, "").slice(-10)
        if (phoneKey) {
          saved = localStorage.getItem(`deliverySignup_${phoneKey}_details`) || sessionRaw
        } else {
          saved = sessionRaw
        }
      }
    } catch (e) {
      debugError("Error reading saved details:", e)
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return { ...base, ...parsed, ref: parsed.ref || queryRef }
      } catch (e) {
        debugError("Error parsing saved details:", e)
      }
    }
    return base
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sanitizeLocationValue = (value) =>
    value.replace(/[^A-Za-z\s.-]/g, "").replace(/\s{2,}/g, " ")

  const sanitizeNameValue = (value) =>
    value.replace(/[^A-Za-z\s]/g, "").replace(/\s{2,}/g, " ")

  const isValidLocationValue = (value) =>
    /^[A-Za-z][A-Za-z\s.-]*[A-Za-z.]$/.test(value.trim())

  const isValidNameValue = (value) =>
    /^[A-Za-z][A-Za-z\s]*[A-Za-z]$/.test(value.trim())

  const isValidEmailValue = (value) => {
    const normalizedValue = value.trim().toLowerCase()
    // General email regex
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizedValue)) {
      return false
    }

    const [, domain = ""] = normalizedValue.split("@")
    
    // Catch common typos for Gmail
    const gmailTypos = [
      "gnail.com", "gmal.com", "gmaill.com", "gamil.com", "gmial.com", 
      "gmail.co", "gmail.con", "gmail.cm", "g-mail.com"
    ]
    
    if (gmailTypos.includes(domain)) {
      return false
    }

    // If it starts with gmail. but isn't gmail.com (e.g. gmail.in is usually not a thing)
    if (domain.startsWith("gmail.") && domain !== "gmail.com") {
      return false
    }

    return true
  }

  const sanitizeEmailValue = (value) =>
    value.replace(/\s/g, "").toLowerCase()

  // Save data to session storage and phone-scoped localStorage whenever formData changes
  useEffect(() => {
    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(formData))
    // Also persist to phone-scoped localStorage so data survives app/tab restarts
    const phoneKey = String(formData.phone || "").replace(/\D/g, "").slice(-10)
    if (phoneKey) {
      localStorage.setItem(`deliverySignup_${phoneKey}_details`, JSON.stringify(formData))
    }
  }, [formData])

  const handleChange = (e) => {
    const { name, value } = e.target
    let updatedValue = value

    // Auto-uppercase for Vehicle, DL and PAN numbers
    if (name === "vehicleNumber" || name === "panNumber" || name === "drivingLicenseNumber") {
      updatedValue = value.toUpperCase()
    }

    if (name === "name") {
      updatedValue = sanitizeNameValue(value)
    }

    if (name === "vehicleNumber") {
      updatedValue = updatedValue.slice(0, 10)
    }

    if (name === "drivingLicenseNumber") {
      updatedValue = updatedValue.replace(/[^A-Z0-9]/g, "").slice(0, 16)
    }

    // Restrict Aadhaar to numeric only and format as XXXX XXXX XXXX
    if (name === "aadharNumber") {
      const digits = value.replace(/\D/g, "").slice(0, 12)
      updatedValue = digits.replace(/(\d{4})(?=\d)/g, "$1 ")
    }

    if (name === "city" || name === "state") {
      updatedValue = sanitizeLocationValue(value)
    }

    if (name === "email") {
      updatedValue = sanitizeEmailValue(value)
    }

    setFormData(prev => ({
      ...prev,
      [name]: updatedValue
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
    } else if (!isValidNameValue(formData.name)) {
      newErrors.name = "Name can contain letters only"
    }

    if (formData.email && !isValidEmailValue(formData.email)) {
      newErrors.email = "Enter a valid email address. Gmail must be gmail.com"
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required"
    } else if (!isValidLocationValue(formData.city)) {
      newErrors.city = "City can contain letters only"
    }

    if (!formData.state.trim()) {
      newErrors.state = "State is required"
    } else if (!isValidLocationValue(formData.state)) {
      newErrors.state = "State can contain letters only"
    }

    if (!formData.vehicleNumber.trim()) {
      newErrors.vehicleNumber = "Vehicle number is required"
    } else if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(formData.vehicleNumber)) {
      newErrors.vehicleNumber = "Invalid Indian vehicle number format (e.g., MH12AB1234)"
    }

    if (!formData.drivingLicenseNumber.trim()) {
      newErrors.drivingLicenseNumber = "Driving license number is required"
    } else if (!/^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(formData.drivingLicenseNumber)) {
      newErrors.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
    }

    if (!formData.panNumber.trim()) {
      newErrors.panNumber = "PAN number is required"
    } else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.replace(/\s/g, ""))) {
      newErrors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)"
    }

    const aadharClean = formData.aadharNumber.replace(/\s/g, "")
    if (!aadharClean) {
      newErrors.aadharNumber = "Aadhar number is required"
    } else if (!/^\d{12}$/.test(aadharClean)) {
      newErrors.aadharNumber = "Aadhar number must be 12 digits"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) {
      toast.error("Please fill all required fields correctly")
      return
    }

    setIsSubmitting(true)

    try {
      const details = {
        name: formData.name.trim(),
        phone: String(formData.phone || "").replace(/\D/g, "").slice(0, 15),
        countryCode: formData.countryCode || "+91",
        ref: String(formData.ref || "").trim() || "",
        email: formData.email?.trim() || "",
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        vehicleType: formData.vehicleType || "bike",
        vehicleName: formData.vehicleName?.trim() || "",
        vehicleNumber: formData.vehicleNumber.trim(),
        drivingLicenseNumber: formData.drivingLicenseNumber.trim().toUpperCase(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, "")
      }
      sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
      if (details.phone) {
        localStorage.setItem(`deliverySignup_${details.phone}_details`, JSON.stringify(details))
      }
      toast.success("Details saved")
      navigate("/food/delivery/signup/documents")
    } catch (error) {
      debugError("Error saving details:", error)
      toast.error("Failed to save. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Complete Your Profile</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Basic Details</h2>
          <p className="text-sm text-gray-600">Please provide your information to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              inputMode="text"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.name ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Enter your full name"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (Optional)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              inputMode="email"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.email ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Enter your User Id"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.address ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="Enter your address"
            />
            {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.city ? "border-red-500" : "border-gray-300"
                  }`}
                placeholder="City"
              />
              {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.state ? "border-red-500" : "border-gray-300"
                  }`}
                placeholder="State"
              />
              {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
            </div>
          </div>

          {/* Vehicle Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type <span className="text-red-500">*</span>
            </label>
            <select
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="bike">Bike</option>
              <option value="scooter">Scooter</option>
              <option value="bicycle">Bicycle</option>
              <option value="car">Car</option>
            </select>
          </div>

          {/* Vehicle Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Name/Model (Optional)
            </label>
            <input
              type="text"
              name="vehicleName"
              value={formData.vehicleName}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., Honda Activa"
            />
          </div>

          {/* Vehicle Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="vehicleNumber"
              value={formData.vehicleNumber}
              onChange={handleChange}
              maxLength={10}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.vehicleNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="e.g., MH12AB1234"
            />
            {errors.vehicleNumber && <p className="text-red-500 text-sm mt-1">{errors.vehicleNumber}</p>}
          </div>

          {/* Driving License Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driving License Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="drivingLicenseNumber"
              value={formData.drivingLicenseNumber}
              onChange={handleChange}
              maxLength={16}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase ${errors.drivingLicenseNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="e.g., MH1220110012345"
            />
            {errors.drivingLicenseNumber && <p className="text-red-500 text-sm mt-1">{errors.drivingLicenseNumber}</p>}
          </div>

          {/* PAN Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PAN Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="panNumber"
              value={formData.panNumber}
              onChange={handleChange}
              maxLength={10}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary uppercase ${errors.panNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="ABCDE1234F"
            />
            {errors.panNumber && <p className="text-red-500 text-sm mt-1">{errors.panNumber}</p>}
          </div>

          {/* Aadhar Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aadhar Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="aadharNumber"
              value={formData.aadharNumber}
              onChange={handleChange}
              maxLength={14}
              inputMode="numeric"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${errors.aadharNumber ? "border-red-500" : "border-gray-300"
                }`}
              placeholder="1234 5678 9012"
            />
            {errors.aadharNumber && <p className="text-red-500 text-sm mt-1">{errors.aadharNumber}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  )
}


