import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image as ImageIcon, Truck, User, FileText, CheckCircle, Mail, MapPin, Building2, Map, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { openCamera, openGallery } from "@food/utils/imageUploadUtils"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
import { deliveryAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const DB_NAME = "DeliverySignupDB"
const STORE_NAME = "documents"

const VEHICLE_TYPE_OPTIONS = ["Bike", "Scooter", "Bicycle", "Van"]

let cachedDB = null
const initDB = () => {
  return new Promise((resolve) => {
    if (cachedDB) {
      return resolve(cachedDB)
    }
    // WebView mein indexedDB available nahi bhi ho sakta
    if (typeof indexedDB === 'undefined' || !indexedDB) {
      return resolve(null)
    }
    // Safety timeout: WebView mein indexedDB.open() kabhi kabhi hang karta hai
    // 2 seconds ke baad null return kar do taaki UI stuck na rahe
    const timeoutId = setTimeout(() => resolve(null), 2000)
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = (e) => {
        clearTimeout(timeoutId)
        cachedDB = e.target.result
        resolve(cachedDB)
      }
      request.onerror = () => {
        clearTimeout(timeoutId)
        resolve(null)
      }
    } catch (e) {
      clearTimeout(timeoutId)
      resolve(null)
    }
  })
}

const saveFileToDB = async (key, file) => {
  const db = await initDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      store.put(file, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    } catch (e) {
      resolve()
    }
  })
}

const getFileFromDB = async (key) => {
  const db = await initDB()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch (e) {
      resolve(null)
    }
  })
}

const removeFileFromDB = async (key) => {
  const db = await initDB()
  if (!db) return
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).delete(key)
  } catch (e) {
    debugError("Error removing file from DB:", e)
  }
}



export default function SignupStep1() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const queryRef = searchParams.get("ref") || ""

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("deliverySignupDetails")
    const base = {
      name: "",
      phone: "",
      countryCode: "+91",
      ref: queryRef,
      email: "",
      address: "",
      city: "",
      state: "",
      vehicles: [],
      drivingLicenseNumber: "",
      panNumber: "",
      aadharNumber: ""
    }
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Ensure vehicles is an array even if old data had vehicleType
        const vehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
        return { ...base, ...parsed, ref: parsed.ref || queryRef, vehicles }
      } catch (e) {
        debugError("Error parsing saved details:", e)
      }
    }
    return base
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState({
    vehicleType: "",
    registrationNumber: "",
    model: ""
  })

  const handleAddVehicle = () => {
    if (!newVehicle.vehicleType) {
      toast.error("Please select a vehicle category");
      return;
    }

    const isBicycle = newVehicle.vehicleType.toLowerCase() === "bicycle";
    // Future ready registration requirement
    const registrationRequired = !isBicycle;

    if (registrationRequired) {
      const normalizedReg = newVehicle.registrationNumber.trim().toUpperCase();
      if (!normalizedReg) {
        toast.error("Vehicle Number is required for this vehicle");
        return;
      }

      if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/.test(normalizedReg)) {
        toast.error("Invalid Indian vehicle number format (e.g., MH12AB1234)");
        return;
      }

      const isDuplicate = formData.vehicles.some(v => v.registrationNumber === normalizedReg);
      if (isDuplicate) {
        toast.error("This vehicle number is already added to your list");
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      vehicles: [...prev.vehicles, {
        id: Date.now().toString(),
        name: newVehicle.vehicleType,
        category: newVehicle.vehicleType,
        registrationNumber: newVehicle.registrationNumber.trim().toUpperCase(),
        model: newVehicle.model.trim(),
        status: "Draft"
      }]
    }));

    setNewVehicle({ vehicleType: "", registrationNumber: "", model: "" });
    setShowAddVehicle(false);
    toast.success("Vehicle added successfully");
    if (errors.vehicles) {
      setErrors(prev => ({ ...prev, vehicles: "" }));
    }
  }

  const handleRemoveVehicle = (id) => {
    setFormData(prev => ({
      ...prev,
      vehicles: prev.vehicles.filter(v => v.id !== id)
    }));
  }

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

  // Save data to session storage whenever formData changes
  useEffect(() => {
    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(formData))
  }, [formData])

  const handleChange = (e) => {
    const { name, value } = e.target
    let updatedValue = value

    if (name === "drivingLicenseNumber") {
      updatedValue = updatedValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16)
    }

    if (name === "panNumber") {
      updatedValue = updatedValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)
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

    if (formData.vehicles.length === 0) {
      newErrors.vehicles = "Please add at least one vehicle"
    }

    const requiresDl = formData.vehicles.some(v => {
      const cat = (v.category || v.name || "").toLowerCase();
      return cat !== "bicycle" && cat !== "electric bike" && cat !== "electric_bike";
    });

    if (requiresDl) {
      if (!formData.drivingLicenseNumber.trim()) {
        newErrors.drivingLicenseNumber = "Driving license number is required"
      } else if (!/^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(formData.drivingLicenseNumber)) {
        newErrors.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
      }
    } else {
      if (formData.drivingLicenseNumber.trim()) {
        if (!/^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(formData.drivingLicenseNumber)) {
          newErrors.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
        }
      }
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
      // Focus first error field
      setTimeout(() => {
         const firstError = Object.keys(errors)[0]
         if (firstError) document.querySelector(`[name="${firstError}"]`)?.focus()
      }, 100)
      return
    }

    setIsSubmitting(true)

    try {
      // Validate unique documents with backend.
      // Pass phone (+ partnerId when reapplying) so rejected partners can reuse their own docs.
      let partnerId = null;
      try {
        const ctxRaw = sessionStorage.getItem("deliveryRejectionContext");
        const ctx = ctxRaw ? JSON.parse(ctxRaw) : null;
        partnerId = ctx?.partnerId || null;
      } catch {
        /* ignore */
      }
      const phoneDigits = String(formData.phone || "").replace(/\D/g, "").slice(-10);
      await deliveryAPI.validateDocumentsPublic({
         drivingLicenseNumber: formData.drivingLicenseNumber,
         panNumber: formData.panNumber,
         aadharNumber: formData.aadharNumber,
         phone: phoneDigits || undefined,
         ...(partnerId ? { partnerId } : {}),
      })

      const details = {
        name: formData.name.trim(),
        phone: String(formData.phone || "").replace(/\D/g, "").slice(0, 15),
        countryCode: formData.countryCode || "+91",
        ref: String(formData.ref || "").trim() || "",
        email: formData.email?.trim() || "",
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        vehicles: formData.vehicles,
        drivingLicenseNumber: formData.drivingLicenseNumber.trim().toUpperCase(),
        panNumber: formData.panNumber.trim().toUpperCase(),
        aadharNumber: formData.aadharNumber.replace(/\s/g, "")
      }
      sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details))
      toast.success("Details saved")
      navigate("/food/delivery/signup/documents", {
        state: location.state || undefined,
      })
    } catch (error) {
      debugError("Error saving details:", error)
      if (error?.response?.status === 409) {
          const backendErrors = error.response.data?.errors || {}
          setErrors(prev => ({ ...prev, ...backendErrors }))
          toast.error(error.response.data?.message || "Duplicate documents found")
          setTimeout(() => {
              const firstError = Object.keys(backendErrors)[0]
              if (firstError) document.querySelector(`[name="${firstError}"]`)?.focus()
          }, 100)
      } else {
          toast.error("Failed to save. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const requiresDl = formData.vehicles.some(v => {
    const cat = (v.category || v.name || "").toLowerCase();
    return cat !== "bicycle" && cat !== "electric bike" && cat !== "electric_bike";
  });

  return (
    <div className="app-shell-page fixed inset-0 z-20 flex !min-h-0 flex-col overflow-hidden bg-[#fafafa] font-sans">
      {/* Top Header — stays pinned; only the form below scrolls */}
      <div className="app-shell-page__header safe-top z-50 shrink-0 bg-white px-4 py-4 flex flex-col shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-wide leading-tight">Create Account</h1>
            <p className="text-xs text-gray-500 font-medium">Complete the steps to get started</p>
          </div>
        </div>
        
        {/* Stepper */}
        <div className="flex items-center justify-between px-6 mb-4 relative max-w-sm mx-auto w-full">
          {/* Connecting Line Background */}
          <div className="absolute left-[20%] right-[20%] top-6 h-[2px] bg-gray-200 z-0"></div>
          
          {/* Step 1 */}
          <div className="relative z-10 flex flex-col items-center gap-2">
             <div className="w-12 h-12 rounded-full bg-[#00B761] text-white flex items-center justify-center shadow-md ring-4 ring-green-50">
               <User className="w-5 h-5" />
             </div>
             <span className="text-[11px] font-bold text-[#00B761] text-center">Profile</span>
          </div>
          
          {/* Step 2 */}
          <div className="relative z-10 flex flex-col items-center gap-2">
             <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 text-gray-400 flex items-center justify-center">
               <FileText className="w-5 h-5" />
             </div>
             <span className="text-[11px] font-semibold text-gray-400 text-center">Documents</span>
          </div>
          
          {/* Step 3 */}
          <div className="relative z-10 flex flex-col items-center gap-2">
             <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 text-gray-400 flex items-center justify-center">
               <CheckCircle className="w-5 h-5" />
             </div>
             <span className="text-[11px] font-semibold text-gray-400 text-center">Review</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="app-shell-page__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        
        {/* Form Card */}
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-50 w-full max-w-md mx-auto p-6">
          
          {/* Form Card Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-[#00B761] rounded-xl flex items-center justify-center shadow-sm shrink-0">
              <User className="text-white w-6 h-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Your Profile</h2>
              <p className="text-[13px] text-gray-500 font-medium">Tell us about yourself</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  inputMode="text"
                  className={`w-full pl-11 pr-4 py-3.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 ${
                    errors.name ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                  }`}
                  placeholder="Enter your full name"
                />
              </div>
              {errors.name && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  inputMode="email"
                  className={`w-full pl-11 pr-4 py-3.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 ${
                    errors.email ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                  }`}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.email}</p>}
              
              <div className="flex items-start gap-2 mt-2 ml-1">
                <div className="w-3.5 h-3.5 rounded-full border border-gray-300 flex items-center justify-center shrink-0 mt-0.5">
                   <span className="text-gray-400 text-[9px]">i</span>
                </div>
                <p className="text-xs text-gray-500 leading-tight">We'll use this email to send you important updates and notifications.</p>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute top-3.5 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={2}
                  className={`w-full pl-11 pr-4 py-3.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 resize-none ${
                    errors.address ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                  }`}
                  placeholder="Enter your address"
                />
              </div>
              {errors.address && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.address}</p>}
            </div>

            {/* City and State */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                  City <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Building2 className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={`w-full pl-9 pr-3 py-3 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 text-sm ${
                      errors.city ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                    }`}
                    placeholder="City"
                  />
                </div>
                {errors.city && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.city}</p>}
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                  State <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Map className="w-4 h-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className={`w-full pl-9 pr-3 py-3 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 text-sm ${
                      errors.state ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                    }`}
                    placeholder="State"
                  />
                </div>
                {errors.state && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.state}</p>}
              </div>
            </div>

            {/* My Vehicles Section */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-[#00B761]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">My Vehicles</h3>
                </div>
              </div>
              
              {formData.vehicles.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm font-medium text-gray-500">No vehicles added yet.</p>
                  {errors.vehicles && <p className="text-red-500 text-xs mt-2">{errors.vehicles}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.vehicles.map(v => {
                    const displayName = v.name || v.category || "Vehicle"
                    const displayCategory = v.category || ""
                    return (
                      <div key={v.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveVehicle(v.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 bg-gray-50 rounded-lg flex items-center justify-center p-2 border border-gray-100 shrink-0">
                            <Truck className="w-6 h-6 text-gray-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-[15px] truncate">{displayName}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{displayCategory}</p>
                            
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-400 block mb-0.5">Reg. Number</span>
                                <span className="font-semibold text-gray-800">{v.registrationNumber || "N/A"}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block mb-0.5">Status</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-[#00B761]">
                                  {v.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {!showAddVehicle ? (
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(true)}
                  className="mt-4 w-full py-3.5 rounded-xl border-2 border-dashed border-[#00B761] text-[#00B761] font-bold hover:bg-green-50 transition-colors flex items-center justify-center gap-2 text-[13px]"
                >
                  <span>+ Add Another Vehicle</span>
                </button>
              ) : (
                <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 text-[13px]">Add New Vehicle</h4>
                    <button type="button" onClick={() => setShowAddVehicle(false)} className="text-gray-400 hover:text-gray-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">
                        Select Vehicle <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={newVehicle.vehicleType}
                          onChange={(e) => setNewVehicle(p => ({ ...p, vehicleType: e.target.value }))}
                          className="appearance-none w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 focus:border-[#00B761] text-sm font-medium pr-10 cursor-pointer"
                        >
                          <option value="" disabled>Choose from list...</option>
                          {VEHICLE_TYPE_OPTIONS.map(option => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">
                        Vehicle Number
                      </label>
                      <input
                        type="text"
                        value={newVehicle.registrationNumber}
                        onChange={(e) => setNewVehicle(p => ({ ...p, registrationNumber: e.target.value.toUpperCase().slice(0, 10) }))}
                        className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 focus:border-[#00B761] text-sm font-medium"
                        placeholder="e.g., MH12AB1234"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5 ml-1">
                        Vehicle Model (Optional)
                      </label>
                      <input
                        type="text"
                        value={newVehicle.model}
                        onChange={(e) => setNewVehicle(p => ({ ...p, model: e.target.value }))}
                        className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 focus:border-[#00B761] text-sm font-medium"
                        placeholder="e.g., 2022 Edition"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleAddVehicle}
                      className="w-full py-3.5 rounded-xl font-bold text-white bg-gray-900 hover:bg-black transition-colors text-sm shadow-md"
                    >
                      Confirm Vehicle
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Driving License Number */}
            <div className="pt-2">
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                Driving License Number {requiresDl && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                name="drivingLicenseNumber"
                value={formData.drivingLicenseNumber}
                onChange={handleChange}
                maxLength={16}
                className={`w-full px-4 py-3.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 uppercase ${
                  errors.drivingLicenseNumber ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                }`}
                placeholder="e.g., MH1220110012345"
              />
              {errors.drivingLicenseNumber && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.drivingLicenseNumber}</p>}
            </div>

            {/* PAN Number */}
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                PAN Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="panNumber"
                value={formData.panNumber}
                onChange={handleChange}
                maxLength={10}
                className={`w-full px-4 py-3.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 uppercase ${
                  errors.panNumber ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                }`}
                placeholder="ABCDE1234F"
              />
              {errors.panNumber && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.panNumber}</p>}
            </div>

            {/* Aadhar Number */}
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5 ml-1">
                Aadhar Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="aadharNumber"
                value={formData.aadharNumber}
                onChange={handleChange}
                maxLength={14}
                inputMode="numeric"
                className={`w-full px-4 py-3.5 bg-gray-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00B761]/20 transition-colors font-medium text-gray-900 ${
                  errors.aadharNumber ? "border-red-500" : "border-gray-200 focus:border-[#00B761]"
                }`}
                placeholder="1234 5678 9012"
              />
              {errors.aadharNumber && <p className="text-red-500 text-xs mt-1.5 ml-1 font-medium">{errors.aadharNumber}</p>}
            </div>

            {/* Submit Button */}
            <div className="pt-4 pb-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-4 rounded-xl font-bold text-white text-[15px] transition-all shadow-lg active:scale-[0.98] ${
                  isSubmitting
                    ? "bg-gray-400 cursor-not-allowed shadow-none"
                    : "bg-[#00B761] hover:bg-[#00A055] shadow-green-200/50"
                }`}
              >
                {isSubmitting ? "Saving..." : "Continue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


