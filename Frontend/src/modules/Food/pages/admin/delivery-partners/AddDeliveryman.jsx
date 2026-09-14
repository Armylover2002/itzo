import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Bike,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  User,
  X,
  CheckCircle2
} from "lucide-react"
import { toast } from "sonner"
import { adminAPI, deliveryAPI } from "@food/api"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import {
  canPerformAdminPermissionAction,
  extractAdminPermissions,
  extractAdminRoleId,
  fetchAdminRolePermissions,
} from "@food/utils/adminPermissions"

const GMAIL_TYPOS = [
  "gnail.com",
  "gmal.com",
  "gmaill.com",
  "gamil.com",
  "gmial.com",
  "gmail.co",
  "gmail.con",
  "gmail.cm",
  "g-mail.com",
]

const DL_REGEX = /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const VEHICLE_REG_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{4}$/
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const DRAFT_STORAGE_KEY = "admin_add_driver_draft_v1"
const IDB_NAME = "admin-add-driver-docs"
const IDB_STORE = "files"

const emptyDetails = () => ({
  name: "",
  phone: "",
  countryCode: "+91",
  email: "",
  address: "",
  city: "",
  state: "",
  vehicles: [],
  drivingLicenseNumber: "",
  panNumber: "",
  aadharNumber: "",
})

const readDraft = () => {
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return {
      step: parsed.step === 2 ? 2 : 1,
      details: { ...emptyDetails(), ...(parsed.details || {}) },
    }
  } catch {
    return null
  }
}

const writeDraft = (step, details) => {
  try {
    sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        step,
        details: {
          ...details,
          vehicles: Array.isArray(details?.vehicles) ? details.vehicles : [],
        },
        savedAt: Date.now(),
      }),
    )
  } catch {
    // ignore quota
  }
}

const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // ignore
  }
}

const openDocsDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null)
      return
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const saveDocFile = async (key, file) => {
  const db = await openDocsDb()
  if (!db || !file) return
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite")
    tx.objectStore(IDB_STORE).put(file, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const removeDocFile = async (key) => {
  const db = await openDocsDb()
  if (!db) return
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite")
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const clearAllDocFiles = async () => {
  const db = await openDocsDb()
  if (!db) return
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite")
    tx.objectStore(IDB_STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const loadAllDocFiles = async () => {
  const db = await openDocsDb()
  if (!db) return {}
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly")
    const store = tx.objectStore(IDB_STORE)
    const req = store.openCursor()
    const out = {}
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve(out)
        return
      }
      out[cursor.key] = cursor.value
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

const isBicycleCategory = (category = "") => {
  const cat = String(category).toLowerCase()
  return cat === "bicycle" || cat === "electric bike" || cat === "electric_bike"
}

const VEHICLE_TYPE_OPTIONS = ["Bike", "Scooter", "Bicycle", "Van"]

const REQUIRED_DOCS_BY_VEHICLE_TYPE = {
  bicycle: [],
  bike: ['pollution'],
  scooter: ['pollution'],
  van: ['pollution', 'fitness', 'permit'],
}

const getRequiredDocuments = (category) =>
  REQUIRED_DOCS_BY_VEHICLE_TYPE[String(category || "").toLowerCase()] || ['pollution']

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
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizedValue)) {
    return false
  }
  const [, domain = ""] = normalizedValue.split("@")
  if (GMAIL_TYPOS.includes(domain)) return false
  if (domain.startsWith("gmail.") && domain !== "gmail.com") return false
  return true
}

function DocUploadCard({ label, required, file, onSelect, onRemove, error }) {
  const inputRef = useRef(null)
  const previewUrl = useMemo(() => {
    if (!(file instanceof File || file instanceof Blob)) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col group"
    >
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {file ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-blue-200">
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="w-full h-40 object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-sm text-slate-500">
              <FileText className="w-8 h-8 text-blue-500 mb-2" />
              <span className="truncate max-w-[200px] font-medium">{file.name || "Selected file"}</span>
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            type="button"
            onClick={onRemove}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-white"
          >
            <X className="w-4 h-4" />
          </motion.button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <p className="text-white text-xs truncate font-medium">{file.name}</p>
          </div>
        </div>
      ) : (
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            error 
              ? "border-red-300 bg-red-50/50 hover:bg-red-50" 
              : "border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30"
          }`}
        >
          <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 transition-colors duration-300 ${error ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-500 group-hover:text-white'}`}>
            <Upload className="w-5 h-5" />
          </div>
          <p className={`text-sm font-semibold mb-1 ${error ? 'text-red-600' : 'text-slate-700'}`}>Click to upload document</p>
          <p className="text-xs text-slate-500 font-medium">JPG, PNG up to 5 MB</p>
        </motion.button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0]
          e.target.value = ""
          if (selected) onSelect(selected)
        }}
      />
      {error ? <p className="text-xs text-red-500 mt-1">{error}</p> : null}
    </motion.div>
  )
}

export default function AddDeliveryman() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  const initialDraft = useMemo(() => readDraft(), [])
  const [step, setStep] = useState(initialDraft?.step || 1)
  const [details, setDetails] = useState(() => initialDraft?.details || emptyDetails())
  const [errors, setErrors] = useState({})
  const [documents, setDocuments] = useState({})
  const [docErrors, setDocErrors] = useState({})
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState({
    vehicleType: "",
    registrationNumber: "",
    model: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Restore uploaded docs after refresh
  useEffect(() => {
    let cancelled = false
    loadAllDocFiles()
      .then((files) => {
        if (!cancelled && files && Object.keys(files).length > 0) {
          setDocuments(files)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Persist profile/vehicle draft so refresh does not wipe the form
  useEffect(() => {
    writeDraft(step, details)
  }, [step, details])

  useEffect(() => {
    let isMounted = true
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }
      const existingPermissions = extractAdminPermissions(currentUser)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }
      const roleId = extractAdminRoleId(currentUser)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }
      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }
    resolvePermissions()
    return () => {
      isMounted = false
    }
  }, [currentUser])

  const canCreate = useMemo(
    () =>
      canPerformAdminPermissionAction(
        currentUser,
        resolvedPermissions,
        "food::deliveryman_management::deliveryman::list",
        "create",
      ),
    [currentUser, resolvedPermissions],
  )

  const requiresDl = details.vehicles.some((v) => !isBicycleCategory(v.category))

  const updateDetail = (name, value) => {
    let updatedValue = value
    if (name === "name") updatedValue = sanitizeNameValue(value)
    if (name === "city" || name === "state") updatedValue = sanitizeLocationValue(value)
    if (name === "email") updatedValue = value.replace(/\s/g, "").toLowerCase()
    if (name === "phone") updatedValue = value.replace(/\D/g, "").slice(0, 10)
    if (name === "drivingLicenseNumber") {
      updatedValue = updatedValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16)
    }
    if (name === "panNumber") {
      updatedValue = updatedValue.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10)
    }
    if (name === "aadharNumber") {
      const digits = value.replace(/\D/g, "").slice(0, 12)
      updatedValue = digits.replace(/(\d{4})(?=\d)/g, "$1 ")
    }
    setDetails((prev) => ({ ...prev, [name]: updatedValue }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const handleAddVehicle = () => {
    if (!newVehicle.vehicleType) {
      toast.error("Please select a vehicle category")
      return
    }

    if (
      details.vehicles.some(
        (v) => String(v.category) === String(newVehicle.vehicleType),
      )
    ) {
      toast.error("This vehicle type is already added")
      return
    }

    const registrationRequired = !isBicycleCategory(newVehicle.vehicleType)
    if (registrationRequired) {
      const normalizedReg = newVehicle.registrationNumber.trim().toUpperCase()
      if (!normalizedReg) {
        toast.error("Registration Number is required for this vehicle")
        return
      }
      if (!VEHICLE_REG_REGEX.test(normalizedReg)) {
        toast.error("Invalid Indian vehicle number format (e.g., MH12AB1234)")
        return
      }
      if (details.vehicles.some((v) => v.registrationNumber === normalizedReg)) {
        toast.error("This vehicle number is already added")
        return
      }
    }

    setDetails((prev) => ({
      ...prev,
      vehicles: [
        ...prev.vehicles,
        {
          id: Date.now().toString(),
          name: newVehicle.vehicleType,
          category: newVehicle.vehicleType,
          registrationNumber: newVehicle.registrationNumber.trim().toUpperCase(),
          model: newVehicle.model.trim(),
          status: "Draft",
        },
      ],
    }))
    setNewVehicle({ vehicleType: "", registrationNumber: "", model: "" })
    setShowAddVehicle(false)
    if (errors.vehicles) setErrors((prev) => ({ ...prev, vehicles: "" }))
    toast.success("Vehicle added")
  }

  const validateStep1 = () => {
    const next = {}
    if (!details.name.trim()) next.name = "Name is required"
    else if (!isValidNameValue(details.name)) next.name = "Name can contain letters only"

    const phone = details.phone.replace(/\D/g, "")
    if (!phone) next.phone = "Phone number is required"
    else if (phone.length !== 10) next.phone = "Enter a valid 10-digit phone number"

    if (details.email && !isValidEmailValue(details.email)) {
      next.email = "Enter a valid email address. Gmail must be gmail.com"
    }

    if (!details.address.trim()) next.address = "Address is required"
    if (!details.city.trim()) next.city = "City is required"
    else if (!isValidLocationValue(details.city)) next.city = "City can contain letters only"
    if (!details.state.trim()) next.state = "State is required"
    else if (!isValidLocationValue(details.state)) next.state = "State can contain letters only"

    if (details.vehicles.length === 0) next.vehicles = "Please add at least one vehicle"

    if (requiresDl) {
      if (!details.drivingLicenseNumber.trim()) {
        next.drivingLicenseNumber = "Driving license number is required"
      } else if (!DL_REGEX.test(details.drivingLicenseNumber)) {
        next.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
      }
    } else if (
      details.drivingLicenseNumber.trim() &&
      !DL_REGEX.test(details.drivingLicenseNumber)
    ) {
      next.drivingLicenseNumber = "Invalid DL format (e.g., MH1220110012345)"
    }

    if (!details.panNumber.trim()) next.panNumber = "PAN number is required"
    else if (!PAN_REGEX.test(details.panNumber.replace(/\s/g, ""))) {
      next.panNumber = "Invalid PAN format (e.g., ABCDE1234F)"
    }

    const aadharClean = details.aadharNumber.replace(/\s/g, "")
    if (!aadharClean) next.aadharNumber = "Aadhar number is required"
    else if (!/^\d{12}$/.test(aadharClean)) next.aadharNumber = "Aadhar number must be 12 digits"

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleStep1Continue = async (e) => {
    e.preventDefault()
    if (!canCreate) {
      toast.error("Permission denied")
      return
    }
    if (!validateStep1()) {
      toast.error("Please fill all required fields correctly")
      return
    }

    setIsSubmitting(true)
    try {
      await deliveryAPI.validateDocumentsPublic({
        drivingLicenseNumber: details.drivingLicenseNumber,
        panNumber: details.panNumber,
        aadharNumber: details.aadharNumber.replace(/\s/g, ""),
        phone: details.phone.replace(/\D/g, "").slice(-10),
      })
      setStep(2)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (error) {
      if (error?.response?.status === 409) {
        const backendErrors = error.response.data?.errors || {}
        setErrors((prev) => ({ ...prev, ...backendErrors }))
        toast.error(error.response.data?.message || "Duplicate documents found")
      } else {
        toast.error(error?.response?.data?.message || "Failed to validate documents")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const pickDocument = (key, file) => {
    if (!file.type?.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image size should be less than 5MB")
      return
    }
    setDocuments((prev) => ({ ...prev, [key]: file }))
    void saveDocFile(key, file)
    if (docErrors[key]) setDocErrors((prev) => ({ ...prev, [key]: "" }))
  }

  const removeDocument = (key) => {
    setDocuments((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    void removeDocFile(key)
  }

  const validateStep2 = () => {
    const next = {}
    ;["profilePhoto", "aadharPhoto", "panPhoto", "drivingLicensePhoto"].forEach((key) => {
      if (!documents[key]) next[key] = "Required"
    })

    details.vehicles.forEach((v) => {
      const isBicycle = isBicycleCategory(v.category)
      const reqDocs = getRequiredDocuments(v.category)
      const requiredKeys = [
        `vehiclePhoto_${v.id}`,
        ...(isBicycle ? [] : [`rc_${v.id}`, `insurance_${v.id}`]),
        ...reqDocs.map((d) => `${d}_${v.id}`),
      ]
      requiredKeys.forEach((key) => {
        if (!documents[key]) next[key] = "Required"
      })
    })

    setDocErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canCreate) {
      toast.error("Permission denied")
      return
    }
    if (!validateStep2()) {
      toast.error("Please upload all required documents")
      return
    }

    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("name", details.name.trim())
      formData.append("phone", details.phone.replace(/\D/g, "").slice(-10))
      formData.append("countryCode", details.countryCode || "+91")
      if (details.email) formData.append("email", details.email.trim())
      formData.append("address", details.address.trim())
      formData.append("city", details.city.trim())
      formData.append("state", details.state.trim())
      formData.append("vehicles", JSON.stringify(details.vehicles))
      formData.append("submissionType", "initial")
      if (details.drivingLicenseNumber) {
        formData.append("drivingLicenseNumber", details.drivingLicenseNumber)
        formData.append("documents[drivingLicense][number]", details.drivingLicenseNumber)
      }
      formData.append("panNumber", details.panNumber.trim().toUpperCase())
      formData.append("aadharNumber", details.aadharNumber.replace(/\s/g, ""))

      Object.entries(documents).forEach(([key, file]) => {
        if (file instanceof File || file instanceof Blob) {
          formData.append(key, file, file.name || `${key}.jpg`)
        }
      })

      const res = await adminAPI.createDeliveryPartner(formData)
      if (res?.data?.success) {
        toast.success(
          "Driver added and approved. They can log in on the driver app with this phone via OTP.",
        )
        clearDraft()
        void clearAllDocFiles()
        navigate("/ecs/food/delivery-partners")
        return
      }
      toast.error(res?.data?.message || "Failed to add driver")
    } catch (error) {
      if (error?.response?.status === 409) {
        const backendErrors = error.response.data?.errors || {}
        setErrors((prev) => ({ ...prev, ...backendErrors }))
        setStep(1)
        toast.error(error.response.data?.message || "Duplicate documents found")
      } else {
        toast.error(error?.response?.data?.message || "Failed to add driver")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!canCreate && currentUser?.role !== "ADMIN") {
    // Employees without create still see denial after permissions resolve; ADMIN always allowed.
  }

  return (
    <div className="p-4 lg:p-8 min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50/30">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-600/5 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -left-40 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto relative z-10"
      >
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 p-6 lg:p-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
            <div className="flex items-start gap-4">
              <motion.button
                whileHover={{ scale: 1.05, x: -2 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() =>
                  step === 2 ? setStep(1) : navigate("/ecs/food/delivery-partners")
                }
                className="p-2.5 rounded-xl border border-slate-200/80 bg-white/50 shadow-sm hover:bg-white hover:border-blue-200 hover:text-blue-600 transition-all text-slate-600 mt-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </motion.button>
              <div>
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tight">Add Delivery Partner</h1>
                <p className="text-sm text-slate-500 mt-1.5 font-medium max-w-md leading-relaxed">
                  Onboard a new driver effortlessly. They will be auto-approved and can instantly log in using their phone OTP.
                </p>
              </div>
            </div>
            
            {/* Redesigned Step Indicator */}
            <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50">
              <div
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  step === 1 ? "text-white shadow-md" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {step === 1 && (
                  <motion.div 
                    layoutId="activeTab" 
                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <User className="w-4 h-4" /> Profile
                </span>
              </div>
              <div
                className={`relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  step === 2 ? "text-white shadow-md" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {step === 2 && (
                  <motion.div 
                    layoutId="activeTab" 
                    className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Documents
                </span>
              </div>
            </div>
          </div>

          {!canCreate ? (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="rounded-xl border border-amber-200/80 bg-amber-50/80 backdrop-blur-sm px-5 py-4 text-sm font-medium text-amber-800 mb-8 shadow-sm flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              You do not have permission to create delivery partners.
            </motion.div>
          ) : null}

          <div className="relative min-h-[400px]">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.form 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleStep1Continue} 
                  className="space-y-6"
                >
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Profile details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={details.name}
                      onChange={(e) => updateDetail("name", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.name ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="Enter full name"
                    />
                    {errors.name ? <p className="text-xs text-red-500 mt-1">{errors.name}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <div className="flex">
                      <span className="px-3 py-2.5 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 text-sm">
                        +91
                      </span>
                      <input
                        value={details.phone}
                        onChange={(e) => updateDetail("phone", e.target.value)}
                        className={`flex-1 px-4 py-2.5 border rounded-r-lg text-sm ${
                          errors.phone ? "border-red-500" : "border-slate-300"
                        }`}
                        placeholder="10-digit mobile number"
                        inputMode="numeric"
                      />
                    </div>
                    {errors.phone ? <p className="text-xs text-red-500 mt-1">{errors.phone}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                    <input
                      value={details.email}
                      onChange={(e) => updateDetail("email", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.email ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="optional@email.com"
                    />
                    {errors.email ? <p className="text-xs text-red-500 mt-1">{errors.email}</p> : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={details.address}
                      onChange={(e) => updateDetail("address", e.target.value)}
                      rows={2}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.address ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="Full address"
                    />
                    {errors.address ? (
                      <p className="text-xs text-red-500 mt-1">{errors.address}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={details.city}
                      onChange={(e) => updateDetail("city", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.city ? "border-red-500" : "border-slate-300"
                      }`}
                    />
                    {errors.city ? <p className="text-xs text-red-500 mt-1">{errors.city}</p> : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={details.state}
                      onChange={(e) => updateDetail("state", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.state ? "border-red-500" : "border-slate-300"
                      }`}
                    />
                    {errors.state ? <p className="text-xs text-red-500 mt-1">{errors.state}</p> : null}
                  </div>
                </div>
              </section>

              <section className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Bike className="w-4 h-4 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Vehicles</h2>
                </div>
                {details.vehicles.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    No vehicles added yet.
                    {errors.vehicles ? (
                      <p className="text-red-500 text-xs mt-2">{errors.vehicles}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {details.vehicles.map((v) => {
                      return (
                        <div
                          key={v.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-4"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-14 h-14 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                              <Bike className="w-6 h-6 text-slate-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{v.name}</p>
                              <p className="text-xs text-slate-500">{v.category}</p>
                              <p className="text-sm text-slate-700 mt-1">
                                Reg: {v.registrationNumber || "N/A"}
                                {v.model ? ` · ${v.model}` : ""}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const docKeys = [
                                `vehiclePhoto_${v.id}`,
                                `rc_${v.id}`,
                                `insurance_${v.id}`,
                                `fitness_${v.id}`,
                                `pollution_${v.id}`,
                                `permit_${v.id}`,
                              ]
                              setDetails((prev) => ({
                                ...prev,
                                vehicles: prev.vehicles.filter((item) => item.id !== v.id),
                              }))
                              setDocuments((prev) => {
                                const next = { ...prev }
                                docKeys.forEach((key) => {
                                  delete next[key]
                                  void removeDocFile(key)
                                })
                                return next
                              })
                            }}
                            className="p-2 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!showAddVehicle ? (
                  <button
                    type="button"
                    onClick={() => setShowAddVehicle(true)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add vehicle
                  </button>
                ) : (
                  <div className="mt-3 rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Vehicle type
                      </label>
                      <select
                        value={newVehicle.vehicleType}
                        onChange={(e) =>
                          setNewVehicle((p) => ({ ...p, vehicleType: e.target.value }))
                        }
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                      >
                        <option value="">Select vehicle</option>
                        {VEHICLE_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Registration number
                        </label>
                        <input
                          value={newVehicle.registrationNumber}
                          onChange={(e) =>
                            setNewVehicle((p) => ({
                              ...p,
                              registrationNumber: e.target.value.toUpperCase().slice(0, 10),
                            }))
                          }
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="MH12AB1234"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Model
                        </label>
                        <input
                          value={newVehicle.model}
                          onChange={(e) =>
                            setNewVehicle((p) => ({ ...p, model: e.target.value }))
                          }
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setShowAddVehicle(false)}
                        className="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddVehicle}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white"
                      >
                        Save vehicle
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <h2 className="text-lg font-semibold text-slate-900">Identity numbers</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Driving license {requiresDl ? <span className="text-red-500">*</span> : null}
                    </label>
                    <input
                      value={details.drivingLicenseNumber}
                      onChange={(e) => updateDetail("drivingLicenseNumber", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.drivingLicenseNumber ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="MH1220110012345"
                    />
                    {errors.drivingLicenseNumber ? (
                      <p className="text-xs text-red-500 mt-1">{errors.drivingLicenseNumber}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      PAN <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={details.panNumber}
                      onChange={(e) => updateDetail("panNumber", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.panNumber ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="ABCDE1234F"
                    />
                    {errors.panNumber ? (
                      <p className="text-xs text-red-500 mt-1">{errors.panNumber}</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Aadhaar <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={details.aadharNumber}
                      onChange={(e) => updateDetail("aadharNumber", e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-lg text-sm ${
                        errors.aadharNumber ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="XXXX XXXX XXXX"
                      inputMode="numeric"
                    />
                    {errors.aadharNumber ? (
                      <p className="text-xs text-red-500 mt-1">{errors.aadharNumber}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/ecs/food/delivery-partners")}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || !canCreate}
                  className="px-6 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 inline-flex items-center gap-2 transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continue to documents
                </motion.button>
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleSubmit} 
              className="space-y-6"
            >
              <section>
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Personal documents</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocUploadCard
                    label="Profile photo"
                    required
                    file={documents.profilePhoto}
                    error={docErrors.profilePhoto}
                    onSelect={(file) => pickDocument("profilePhoto", file)}
                    onRemove={() => removeDocument("profilePhoto")}
                  />
                  <DocUploadCard
                    label="Aadhaar photo"
                    required
                    file={documents.aadharPhoto}
                    error={docErrors.aadharPhoto}
                    onSelect={(file) => pickDocument("aadharPhoto", file)}
                    onRemove={() => removeDocument("aadharPhoto")}
                  />
                  <DocUploadCard
                    label="PAN photo"
                    required
                    file={documents.panPhoto}
                    error={docErrors.panPhoto}
                    onSelect={(file) => pickDocument("panPhoto", file)}
                    onRemove={() => removeDocument("panPhoto")}
                  />
                  <DocUploadCard
                    label="Driving license photo"
                    required
                    file={documents.drivingLicensePhoto}
                    error={docErrors.drivingLicensePhoto}
                    onSelect={(file) => pickDocument("drivingLicensePhoto", file)}
                    onRemove={() => removeDocument("drivingLicensePhoto")}
                  />
                </div>
              </section>

              {details.vehicles.map((v) => {
                const isBicycle = isBicycleCategory(v.category)
                const reqDocs = getRequiredDocuments(v.category)
                return (
                  <section key={v.id} className="pt-2 border-t border-slate-100">
                    <h2 className="text-lg font-semibold text-slate-900 mb-1">
                      Vehicle docs — {v.name}
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">
                      {v.registrationNumber || "No registration"} · {v.category}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <DocUploadCard
                        label="Vehicle photo"
                        required
                        file={documents[`vehiclePhoto_${v.id}`]}
                        error={docErrors[`vehiclePhoto_${v.id}`]}
                        onSelect={(file) => pickDocument(`vehiclePhoto_${v.id}`, file)}
                        onRemove={() => removeDocument(`vehiclePhoto_${v.id}`)}
                      />
                      {!isBicycle ? (
                        <>
                          <DocUploadCard
                            label="RC photo"
                            required
                            file={documents[`rc_${v.id}`]}
                            error={docErrors[`rc_${v.id}`]}
                            onSelect={(file) => pickDocument(`rc_${v.id}`, file)}
                            onRemove={() => removeDocument(`rc_${v.id}`)}
                          />
                          <DocUploadCard
                            label="Insurance photo"
                            required
                            file={documents[`insurance_${v.id}`]}
                            error={docErrors[`insurance_${v.id}`]}
                            onSelect={(file) => pickDocument(`insurance_${v.id}`, file)}
                            onRemove={() => removeDocument(`insurance_${v.id}`)}
                          />
                        </>
                      ) : null}
                      {reqDocs.includes("fitness") ? (
                        <DocUploadCard
                          label="Fitness certificate"
                          required
                          file={documents[`fitness_${v.id}`]}
                          error={docErrors[`fitness_${v.id}`]}
                          onSelect={(file) => pickDocument(`fitness_${v.id}`, file)}
                          onRemove={() => removeDocument(`fitness_${v.id}`)}
                        />
                      ) : null}
                      {reqDocs.includes("pollution") ? (
                        <DocUploadCard
                          label="Pollution certificate"
                          required
                          file={documents[`pollution_${v.id}`]}
                          error={docErrors[`pollution_${v.id}`]}
                          onSelect={(file) => pickDocument(`pollution_${v.id}`, file)}
                          onRemove={() => removeDocument(`pollution_${v.id}`)}
                        />
                      ) : null}
                      {reqDocs.includes("permit") ? (
                        <DocUploadCard
                          label="Permit"
                          required
                          file={documents[`permit_${v.id}`]}
                          error={docErrors[`permit_${v.id}`]}
                          onSelect={(file) => pickDocument(`permit_${v.id}`, file)}
                          onRemove={() => removeDocument(`permit_${v.id}`)}
                        />
                      ) : null}
                    </div>
                  </section>
                )
              })}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white"
                >
                  Back
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isSubmitting || !canCreate}
                  className="px-6 py-3 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30 disabled:opacity-50 inline-flex items-center gap-2 transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Add & approve driver
                </motion.button>
              </div>
            </motion.form>
          )}
          </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
