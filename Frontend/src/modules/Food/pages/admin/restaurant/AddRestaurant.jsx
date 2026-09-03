import { useState, useRef, useEffect } from "react"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { useNavigate } from "react-router-dom"
import { Building2, Info, Tag, Upload, Calendar, FileText, MapPin, CheckCircle2, X, Image as ImageIcon, Clock, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@food/components/ui/dialog"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Button } from "@food/components/ui/button"
import { adminAPI, uploadAPI, zoneAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => { console.warn(...args) }
const debugError = (...args) => { console.error(...args) }


const cuisinesOptions = [
  "North Indian",
  "South Indian",
  "Chinese",
  "Pizza",
  "Burgers",
  "Bakery",
  "Cafe",
]

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(?!(gmail\\.comm|yahoo\\.con)$)[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^\d{10}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const FSSAI_REGEX = /^\d{14}$/
const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]*$/
const sanitizeDigits = (value = "") => value.replace(/\D/g, "")
const sanitizePan = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
const sanitizeFssai = (value = "") => value.replace(/\D/g, "").slice(0, 14)
const sanitizeIfsc = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11)
const sanitizeGst = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15)
const normalizeName = (value = "") => value.replace(/\s+/g, " ").trimStart()
const hasLetters = (value = "") => /[A-Za-z]/.test(value)
const getTodayLocalYMD = () => new Date().toISOString().split("T")[0]
const timeStringToMinutes = (value = "") => {
  const raw = String(value || "").trim()
  if (!/^\d{2}:\d{2}$/.test(raw)) return null
  const [hours, minutes] = raw.split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return hours * 60 + minutes
}
const getStoredFileLabel = (value) => {
  if (!value) return ""
  if (value instanceof File) return value.name
  if (typeof value === "string") return value.split("/").pop() || "Uploaded document"
  if (value?.url) return value.url.split("/").pop() || "Uploaded document"
  return "Uploaded document"
}
const getStoredImageSrc = (value) => {
  if (!value) return ""
  if (value instanceof File) return URL.createObjectURL(value)
  if (typeof value === "string") return value
  if (value?.url) return value.url
  return ""
}
const isUploadableFile = (value) => {
  if (!value || typeof value !== "object") return false
  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true
  return (
    typeof value.size === "number" &&
    (typeof value.slice === "function" || typeof value.arrayBuffer === "function")
  )
}

const ADMIN_ADD_STORAGE_KEY = "admin_add_restaurant_form_data"
const ADMIN_ADD_FILES_DB = "AdminAddRestaurantFiles"
const ADMIN_ADD_FILES_STORE = "files"
const MAX_MENU_FILES = 10

const openAdminAddFilesDB = () =>
  new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(ADMIN_ADD_FILES_DB, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(ADMIN_ADD_FILES_STORE)) {
          db.createObjectStore(ADMIN_ADD_FILES_STORE)
        }
      }
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = (e) => reject(e.target.error)
    } catch (err) {
      reject(err)
    }
  })

const saveFileToDB = async (key, file) => {
  if (!isUploadableFile(file)) return
  try {
    const db = await openAdminAddFilesDB()
    const tx = db.transaction(ADMIN_ADD_FILES_STORE, "readwrite")
    tx.objectStore(ADMIN_ADD_FILES_STORE).put(file, key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"))
    })
  } catch (err) {
    debugError("Failed to persist file in IndexedDB:", err)
  }
}

const getFileFromDB = async (key) => {
  try {
    const db = await openAdminAddFilesDB()
    const tx = db.transaction(ADMIN_ADD_FILES_STORE, "readonly")
    const request = tx.objectStore(ADMIN_ADD_FILES_STORE).get(key)
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

const deleteFileFromDB = async (key) => {
  try {
    const db = await openAdminAddFilesDB()
    const tx = db.transaction(ADMIN_ADD_FILES_STORE, "readwrite")
    tx.objectStore(ADMIN_ADD_FILES_STORE).delete(key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB delete failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB delete aborted"))
    })
  } catch (err) {
    debugError("Failed to delete file from IndexedDB:", err)
  }
}

const clearAllFilesFromDB = async () => {
  try {
    const db = await openAdminAddFilesDB()
    const tx = db.transaction(ADMIN_ADD_FILES_STORE, "readwrite")
    tx.objectStore(ADMIN_ADD_FILES_STORE).clear()
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error || new Error("IndexedDB clear failed"))
      tx.onabort = () => reject(tx.error || new Error("IndexedDB clear aborted"))
    })
  } catch (err) {
    debugError("Failed to clear IndexedDB files:", err)
  }
}

export default function AddRestaurant() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  // Step 1: Basic Info
  const [step1, setStep1] = useState({
    restaurantName: "",
    pureVegRestaurant: null,
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
    primaryContactNumber: "",
    zoneId: "",
    location: {
      addressLine1: "",
      addressLine2: "",
      area: "",
      city: "",
      state: "",
      pincode: "",
      landmark: "",
      formattedAddress: "",
      latitude: "",
      longitude: "",
    },
  })

  // Step 2: Images & Operational
  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    estimatedDeliveryTime: "",
    openingTime: "",
    closingTime: "",
    openDays: [],
  })

  // Step 3: Documents
  const [step3, setStep3] = useState({
    panNumber: "",
    nameOnPan: "",
    panImage: null,
    gstRegistered: false,
    gstNumber: "",
    gstLegalName: "",
    gstAddress: "",
    gstImage: null,
    fssaiNumber: "",
    fssaiExpiry: "",
    fssaiImage: null,
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    accountType: "",
  })

  const languageTabs = [
    { key: "default", label: "Default" },
    { key: "en", label: "English(EN)" },
    { key: "bn", label: "Bengali - ?????(BN)" },
    { key: "ar", label: "Arabic - ??????? (AR)" },
    { key: "es", label: "Spanish - espa�ol(ES)" },
  ]

  const mainContentRef = useRef(null)

  const clearPersistedFormData = async () => {
    try {
      localStorage.removeItem(ADMIN_ADD_STORAGE_KEY)
    } catch (err) {
      debugError("Failed to clear localStorage form cache:", err)
    }
    await clearAllFilesFromDB()
  }

  useEffect(() => {
    let cancelled = false

    const restoreFormData = async () => {
      try {
        const storedRaw = localStorage.getItem(ADMIN_ADD_STORAGE_KEY)
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw)
          const safeStep = Math.min(Math.max(Number(parsed?.step) || 1, 1), 3)
          if (!cancelled) setStep(safeStep)
          if (parsed?.step1 && !cancelled) {
            setStep1((prev) => ({ ...prev, ...parsed.step1, location: { ...prev.location, ...(parsed.step1.location || {}) } }))
          }
          if (parsed?.step2 && !cancelled) {
            setStep2((prev) => ({ ...prev, ...parsed.step2 }))
          }
          if (parsed?.step3 && !cancelled) {
            setStep3((prev) => ({ ...prev, ...parsed.step3 }))
          }
        }

        const [profileImage, panImage, gstImage, fssaiImage] = await Promise.all([
          getFileFromDB("profileImage"),
          getFileFromDB("panImage"),
          getFileFromDB("gstImage"),
          getFileFromDB("fssaiImage"),
        ])
        const menuFilePromises = Array.from({ length: MAX_MENU_FILES }, (_, i) => getFileFromDB(`menuImage_${i}`))
        const menuFilesFromDB = (await Promise.all(menuFilePromises)).filter(Boolean)

        if (!cancelled) {
          if (profileImage) setStep2((prev) => ({ ...prev, profileImage }))
          if (menuFilesFromDB.length) {
            setStep2((prev) => ({ ...prev, menuImages: [...(prev.menuImages || []), ...menuFilesFromDB] }))
          }
          if (panImage) setStep3((prev) => ({ ...prev, panImage }))
          if (gstImage) setStep3((prev) => ({ ...prev, gstImage }))
          if (fssaiImage) setStep3((prev) => ({ ...prev, fssaiImage }))
        }
      } catch (err) {
        debugError("Failed to restore admin add form data:", err)
      } finally {
        if (!cancelled) setIsHydrated(true)
      }
    }

    restoreFormData()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    try {
      const serializableStep2 = {
        ...step2,
        menuImages: (step2.menuImages || []).filter(
          (img) => !isUploadableFile(img) && (img?.url || (typeof img === "string" && img.trim()))
        ),
        profileImage:
          !isUploadableFile(step2.profileImage) &&
          (step2.profileImage?.url || (typeof step2.profileImage === "string" && step2.profileImage.trim()))
            ? step2.profileImage
            : null,
      }

      const serializableStep3 = {
        ...step3,
        panImage:
          !isUploadableFile(step3.panImage) &&
          (step3.panImage?.url || (typeof step3.panImage === "string" && step3.panImage.trim()))
            ? step3.panImage
            : null,
        gstImage:
          !isUploadableFile(step3.gstImage) &&
          (step3.gstImage?.url || (typeof step3.gstImage === "string" && step3.gstImage.trim()))
            ? step3.gstImage
            : null,
        fssaiImage:
          !isUploadableFile(step3.fssaiImage) &&
          (step3.fssaiImage?.url || (typeof step3.fssaiImage === "string" && step3.fssaiImage.trim()))
            ? step3.fssaiImage
            : null,
      }

      localStorage.setItem(
        ADMIN_ADD_STORAGE_KEY,
        JSON.stringify({
          step,
          step1,
          step2: serializableStep2,
          step3: serializableStep3,
          timestamp: Date.now(),
        })
      )
    } catch (err) {
      debugError("Failed to persist admin add form data:", err)
    }
  }, [isHydrated, step, step1, step2, step3])

  useEffect(() => {
    if (!isHydrated) return
    const uploadableMenuFiles = (step2.menuImages || []).filter((img) => isUploadableFile(img)).slice(0, MAX_MENU_FILES)
    uploadableMenuFiles.forEach((file, idx) => {
      void saveFileToDB(`menuImage_${idx}`, file)
    })
    for (let i = uploadableMenuFiles.length; i < MAX_MENU_FILES; i += 1) {
      void deleteFileFromDB(`menuImage_${i}`)
    }
  }, [isHydrated, step2.menuImages])

  useEffect(() => {
    if (!isHydrated) return
    if (isUploadableFile(step2.profileImage)) {
      void saveFileToDB("profileImage", step2.profileImage)
    } else {
      void deleteFileFromDB("profileImage")
    }
  }, [isHydrated, step2.profileImage])

  useEffect(() => {
    if (!isHydrated) return
    if (isUploadableFile(step3.panImage)) {
      void saveFileToDB("panImage", step3.panImage)
    } else {
      void deleteFileFromDB("panImage")
    }
  }, [isHydrated, step3.panImage])

  useEffect(() => {
    if (!isHydrated) return
    if (isUploadableFile(step3.gstImage)) {
      void saveFileToDB("gstImage", step3.gstImage)
    } else {
      void deleteFileFromDB("gstImage")
    }
  }, [isHydrated, step3.gstImage])

  useEffect(() => {
    if (!isHydrated) return
    if (isUploadableFile(step3.fssaiImage)) {
      void saveFileToDB("fssaiImage", step3.fssaiImage)
    } else {
      void deleteFileFromDB("fssaiImage")
    }
  }, [isHydrated, step3.fssaiImage])

  // Keep UX consistent: each step opens from top after Next/Back.
  useEffect(() => {
    const contentEl = mainContentRef.current
    if (contentEl?.scrollTo) contentEl.scrollTo({ top: 0, behavior: "auto" })
    if (typeof window !== "undefined" && window.scrollTo) window.scrollTo({ top: 0, behavior: "auto" })
    if (typeof document !== "undefined") {
      if (document.documentElement) document.documentElement.scrollTop = 0
      if (document.body) document.body.scrollTop = 0
    }
  }, [step])

  // Upload handler for images
  const handleUpload = async (file, folder) => {
    try {
      const res = await uploadAPI.uploadMedia(file, { folder })
      const d = res?.data?.data || res?.data
      return { url: d.url, publicId: d.publicId }
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      debugError("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  // Validation functions
  const validateStep1 = () => {
    const errors = []
    if (!step1.restaurantName?.trim()) errors.push("Restaurant name is required")
    if (typeof step1.pureVegRestaurant !== "boolean") errors.push("Please select whether restaurant is pure veg")
    if (!step1.ownerName?.trim()) errors.push("Owner name is required")
    if (step1.ownerName?.trim() && (!NAME_REGEX.test(step1.ownerName.trim()) || !hasLetters(step1.ownerName))) {
      errors.push("Owner name must contain valid characters")
    }
    if (!step1.ownerEmail?.trim()) errors.push("Owner email is required")
    if (step1.ownerEmail?.trim() && !EMAIL_REGEX.test(step1.ownerEmail.trim())) errors.push("Please enter a valid email address")
    if (!step1.ownerPhone?.trim()) errors.push("Owner phone number is required")
    if (step1.ownerPhone?.trim() && !PHONE_REGEX.test(step1.ownerPhone.trim())) errors.push("Owner phone number must be 10 digits")
    if (!step1.primaryContactNumber?.trim()) errors.push("Primary contact number is required")
    if (step1.primaryContactNumber?.trim() && !PHONE_REGEX.test(step1.primaryContactNumber.trim())) errors.push("Primary contact number must be 10 digits")
    if (!step1.zoneId?.trim()) errors.push("Service zone is required")
    if (!step1.location?.area?.trim()) errors.push("Area/Sector/Locality is required")
    if (!step1.location?.city?.trim()) errors.push("City is required")
    return errors
  }

  const validateStep2 = () => {
    const errors = []
    if (!step2.menuImages || step2.menuImages.length === 0) errors.push("At least one menu image is required")
    if (!step2.profileImage) errors.push("Restaurant profile image is required")
    if (!step2.cuisines || step2.cuisines.length === 0) errors.push("Please select at least one cuisine")
    if (!step2.estimatedDeliveryTime?.trim()) errors.push("Estimated delivery time is required")
    if (!step2.openingTime?.trim()) errors.push("Opening time is required")
    if (!step2.closingTime?.trim()) errors.push("Closing time is required")
    const openingMinutes = timeStringToMinutes(step2.openingTime)
    const closingMinutes = timeStringToMinutes(step2.closingTime)
    if (openingMinutes !== null && closingMinutes !== null) {
      if (openingMinutes === closingMinutes) {
        errors.push("Opening time and closing time cannot be same")
      } else if (closingMinutes < openingMinutes) {
        errors.push("Closing time cannot be less than opening time")
      }
    }
    if (!step2.openDays || step2.openDays.length === 0) errors.push("Please select at least one open day")
    return errors
  }

  const validateStep3 = () => {
    const errors = []
    if (!step3.panNumber?.trim()) errors.push("PAN number is required")
    if (step3.panNumber?.trim() && !PAN_REGEX.test(step3.panNumber.trim())) errors.push("PAN number must be in valid format")
    if (!step3.nameOnPan?.trim()) errors.push("Name on PAN is required")
    if (step3.nameOnPan?.trim() && (!NAME_REGEX.test(step3.nameOnPan.trim()) || !hasLetters(step3.nameOnPan))) {
      errors.push("Name on PAN must contain characters only")
    }
    if (!step3.panImage) errors.push("PAN image is required")
    if (!step3.fssaiNumber?.trim()) errors.push("FSSAI number is required")
    if (step3.fssaiNumber?.trim() && !FSSAI_REGEX.test(step3.fssaiNumber.trim())) errors.push("FSSAI number must be 14 digits")
    if (!step3.fssaiExpiry?.trim()) errors.push("FSSAI expiry date is required")
    if (step3.fssaiExpiry?.trim() && step3.fssaiExpiry < getTodayLocalYMD()) errors.push("FSSAI expiry date cannot be in the past")
    if (!step3.fssaiImage) errors.push("FSSAI image is required")
    if (step3.gstRegistered) {
      if (!step3.gstNumber?.trim()) errors.push("GST number is required when GST registered")
      if (step3.gstNumber?.trim() && !GST_REGEX.test(step3.gstNumber.trim())) errors.push("GST number must be in valid format")
      if (!step3.gstLegalName?.trim()) errors.push("GST legal name is required when GST registered")
      if (step3.gstLegalName?.trim() && (!NAME_REGEX.test(step3.gstLegalName.trim()) || !hasLetters(step3.gstLegalName))) {
        errors.push("GST legal name must contain characters only")
      }
      if (!step3.gstAddress?.trim()) errors.push("GST registered address is required when GST registered")
      if (step3.gstAddress?.trim() && /^\d+$/.test(step3.gstAddress.trim())) {
        errors.push("GST registered address cannot contain only numbers")
      }
      if (!step3.gstImage) errors.push("GST image is required when GST registered")
    }
    if (!step3.accountNumber?.trim()) errors.push("Account number is required")
    if (step3.accountNumber?.trim() && !ACCOUNT_NUMBER_REGEX.test(step3.accountNumber.trim())) {
      errors.push("Account number must be 9 to 18 digits")
    }
    if (step3.accountNumber !== step3.confirmAccountNumber) errors.push("Account number and confirmation do not match")
    if (!step3.ifscCode?.trim()) errors.push("IFSC code is required")
    if (step3.ifscCode?.trim() && !IFSC_REGEX.test(step3.ifscCode.trim())) errors.push("IFSC code must be in valid format")
    if (!step3.accountHolderName?.trim()) errors.push("Account holder name is required")
    if (step3.accountHolderName?.trim() && (!NAME_REGEX.test(step3.accountHolderName.trim()) || !hasLetters(step3.accountHolderName))) {
      errors.push("Account holder name must contain characters only")
    }
    if (!step3.accountType?.trim()) errors.push("Account type is required")
    if (step3.accountType?.trim() && !["Saving", "Current"].includes(step3.accountType.trim())) errors.push("Account type must be either Saving or Current")
    return errors
  }

  const handleNext = () => {
    setFormErrors({})
    let validationErrors = []

    if (step === 1) {
      validationErrors = validateStep1()
    } else if (step === 2) {
      validationErrors = validateStep2()
    } else if (step === 3) {
      validationErrors = validateStep3()
    }

    if (validationErrors.length > 0) {
      validationErrors.forEach((error) => {
        toast.error(error)
      })
      return
    }

    if (step < 3) {
      setStep(step + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setFormErrors({})

    try {
      // Upload all images first
      let profileImageData = null
      if (step2.profileImage instanceof File) {
        profileImageData = await handleUpload(step2.profileImage, "appzeto/restaurant/profile")
      } else if (step2.profileImage?.url) {
        profileImageData = step2.profileImage
      }

      let menuImagesData = []
      for (const file of step2.menuImages.filter(f => f instanceof File)) {
        const uploaded = await handleUpload(file, "appzeto/restaurant/menu")
        menuImagesData.push(uploaded)
      }
      const existingMenuUrls = step2.menuImages.filter(img => !(img instanceof File) && (img?.url || (typeof img === 'string' && img.startsWith('http'))))
      menuImagesData = [...existingMenuUrls, ...menuImagesData]

      let panImageData = null
      if (step3.panImage instanceof File) {
        panImageData = await handleUpload(step3.panImage, "appzeto/restaurant/pan")
      } else if (step3.panImage?.url) {
        panImageData = step3.panImage
      }

      let gstImageData = null
      if (step3.gstRegistered && step3.gstImage) {
        if (step3.gstImage instanceof File) {
          gstImageData = await handleUpload(step3.gstImage, "appzeto/restaurant/gst")
        } else if (step3.gstImage?.url) {
          gstImageData = step3.gstImage
        }
      }

      let fssaiImageData = null
      if (step3.fssaiImage instanceof File) {
        fssaiImageData = await handleUpload(step3.fssaiImage, "appzeto/restaurant/fssai")
      } else if (step3.fssaiImage?.url) {
        fssaiImageData = step3.fssaiImage
      }

      // Prepare payload
      const payload = {
        // Step 1
        restaurantName: step1.restaurantName,
        pureVegRestaurant: step1.pureVegRestaurant,
        ownerName: step1.ownerName,
        ownerEmail: step1.ownerEmail,
        ownerPhone: step1.ownerPhone,
        primaryContactNumber: step1.primaryContactNumber,
        zoneId: step1.zoneId,
        location: step1.location,
        // Step 2
        menuImages: menuImagesData,
        profileImage: profileImageData,
        cuisines: step2.cuisines,
        estimatedDeliveryTime: step2.estimatedDeliveryTime,
        openingTime: step2.openingTime,
        closingTime: step2.closingTime,
        openDays: step2.openDays,
        // Step 3
        panNumber: step3.panNumber,
        nameOnPan: step3.nameOnPan,
        panImage: panImageData,
        gstRegistered: step3.gstRegistered,
        gstNumber: step3.gstNumber,
        gstLegalName: step3.gstLegalName,
        gstAddress: step3.gstAddress,
        gstImage: gstImageData,
        fssaiNumber: step3.fssaiNumber,
        fssaiExpiry: step3.fssaiExpiry,
        fssaiImage: fssaiImageData,
        accountNumber: step3.accountNumber,
        ifscCode: step3.ifscCode,
        accountHolderName: step3.accountHolderName,
        accountType: step3.accountType,
      }

      // Call backend API
      const response = await adminAPI.createRestaurant(payload)

      const data = response?.data?.data ?? response?.data
      if (response?.data?.success !== false && data) {
        await clearPersistedFormData()
        toast.success("Restaurant created successfully!")
        setShowSuccessDialog(true)
        setTimeout(() => {
          navigate("/ecs/food/restaurants")
        }, 2000)
      } else {
        throw new Error(response?.data?.message || "Failed to create restaurant")
      }
    } catch (error) {
      debugError("Error creating restaurant:", error)
      const errorMsg = error?.response?.data?.message || error?.message || "Failed to create restaurant. Please try again."
      toast.error(errorMsg)
      setFormErrors({ submit: errorMsg })
    } finally {
      setIsSubmitting(false)
    }
  }

  const locationSearchInputRef = useRef(null)
  const placesAutocompleteRef = useRef(null)
  const mapsScriptLoadedRef = useRef(false)

  // Manual search states for fallback
  const [locationSearchValue, setLocationSearchValue] = useState("")
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  useEffect(() => {
    if (step !== 1) return
    let cancelled = false
    setZonesLoading(true)
    zoneAPI
      .getPublicZones()
      .then((res) => {
        const list = res?.data?.data?.zones || res?.data?.zones || []
        if (!cancelled) setZones(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setZones([])
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [step])

  // Initialize Google Places Autocomplete for Step 1 location search.
  useEffect(() => {
    if (step !== 1) return

    let cancelled = false
    let autocomplete = null

    const init = async () => {
      // Wait for the input ref to be attached
      let inputElement = null
      for (let i = 0; i < 50; i++) {
        if (locationSearchInputRef.current) {
          inputElement = locationSearchInputRef.current
          break
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      
      if (!inputElement || cancelled) return

      const loadMaps = async () => {
        // 1. If already fully loaded and available
        if (window.google?.maps?.places?.Autocomplete) {
          mapsScriptLoadedRef.current = true
          return true
        }

        // 2. Load API Key
        const apiKey = await getGoogleMapsApiKey()
        if (!apiKey) {
          debugError("Google Maps API Key missing or invalid")
          return false
        }

        // 3. Catch Google Maps authentication failures
        window.gm_authFailure = () => {
          debugError("Google Maps authentication failed.")
        }

        // 4. Check for any existing script and force libraries=places
        const scripts = Array.from(document.getElementsByTagName("script"))
        const mapsScript = scripts.find(s => s.src?.includes("maps.googleapis.com/maps/api/js"))
        
        if (mapsScript && !mapsScript.src.includes("libraries=places")) {
          mapsScript.remove()
        } else if (mapsScript && mapsScript.src.includes("libraries=places")) {
           for (let i = 0; i < 60; i++) {
              if (window.google?.maps?.places?.Autocomplete) return true
              if (cancelled) return false
              await new Promise(r => setTimeout(r, 100))
           }
        }

        // 5. Create and append new script
        return new Promise((resolve) => {
          const script = document.createElement("script")
          script.id = "google-maps-sdk"
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`
          script.async = true
          script.defer = true
          script.onload = () => {
            setTimeout(() => {
              const ok = !!window.google?.maps?.places?.Autocomplete
              mapsScriptLoadedRef.current = ok
              resolve(ok)
            }, 200)
          }
          script.onerror = () => resolve(false)
          document.head.appendChild(script)
        })
      }

      const parsePlace = (place) => {
        const formattedAddress = place?.formatted_address || ""
        const comps = Array.isArray(place?.address_components) ? place.address_components : []
        const get = (types) => comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || ""
        
        const area = get(["sublocality_level_1", "sublocality", "neighborhood"]) || get(["locality"])
        const city = get(["locality"]) || get(["administrative_area_level_2"])
        const state = get(["administrative_area_level_1"]) || get(["administrative_area_level_2"])
        const pincode = get(["postal_code"])
        const lat = place?.geometry?.location?.lat?.()
        const lng = place?.geometry?.location?.lng?.()
        
        return {
          formattedAddress,
          area,
          city,
          state,
          pincode,
          latitude: typeof lat === 'number' ? Number(lat.toFixed(6)) : "",
          longitude: typeof lng === 'number' ? Number(lng.toFixed(6)) : "",
        }
      }

      const ok = await loadMaps()
      if (!ok || cancelled || !inputElement) return

      if (inputElement.hasAttribute('data-google-places-initialized')) return

      try {
        autocomplete = new window.google.maps.places.Autocomplete(
          inputElement,
          {
            fields: ["formatted_address", "address_components", "geometry"],
            componentRestrictions: { country: "in" },
            types: ["geocode", "establishment"]
          }
        )
        
        inputElement.setAttribute('data-google-places-initialized', 'true')
        placesAutocompleteRef.current = autocomplete

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace()
          if (!place?.geometry) return
          
          const parsed = parsePlace(place)
          setStep1((prev) => ({
            ...prev,
            location: {
              ...prev.location,
              formattedAddress: parsed.formattedAddress || prev.location.formattedAddress,
              addressLine1: parsed.formattedAddress || prev.location.addressLine1 || "",
              area: parsed.area || prev.location.area,
              city: parsed.city || prev.location.city,
              state: parsed.state || prev.location.state,
              pincode: parsed.pincode || prev.location.pincode,
              latitude: parsed.latitude !== "" ? parsed.latitude : prev.location.latitude,
              longitude: parsed.longitude !== "" ? parsed.longitude : prev.location.longitude,
            },
          }))
          
          setLocationSearchValue(parsed.formattedAddress)
          inputElement.blur()
        })
        
        const pacContainerFix = () => {
          const applyFix = () => {
            const containers = document.querySelectorAll('.pac-container');
            if (containers.length > 0) {
              containers.forEach(container => {
                container.style.zIndex = '999999';
                container.style.pointerEvents = 'auto';
                container.style.visibility = 'visible';
                container.style.display = 'block';
              });
            }
          };
          applyFix();
          setTimeout(applyFix, 100);
          setTimeout(applyFix, 300);
        };
        
        inputElement.addEventListener('focus', pacContainerFix);
        inputElement.addEventListener('input', pacContainerFix);
      } catch (e) {
        debugError("Autocomplete error:", e)
      }
    }

    init().catch(() => {})

    return () => {
      cancelled = true
      if (autocomplete) {
        try { window.google?.maps?.event?.clearInstanceListeners(autocomplete) } catch {}
      }
      if (locationSearchInputRef.current) {
        locationSearchInputRef.current.removeAttribute('data-google-places-initialized')
      }
      placesAutocompleteRef.current = null
    }
  }, [step])

  // Hybrid Search Fallback (Nominatim)
  useEffect(() => {
    if (step !== 1) return
    const q = String(locationSearchValue || "").trim()
    if (q.length < 3) {
      setLocationSuggestions([])
      setIsSearchingLocation(false)
      return
    }

    const t = setTimeout(async () => {
      try {
        setIsSearchingLocation(true)
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=4&q=${encodeURIComponent(q)}&countrycodes=in`
        const res = await fetch(url, { headers: { Accept: "application/json" } })
        const json = await res.json()
        const mapped = (Array.isArray(json) ? json : []).map(r => ({
          id: r.place_id,
          display: r.display_name || "",
          lat: Number(r.lat),
          lng: Number(r.lon),
          addr: r.address || {},
        }))
        setLocationSuggestions(mapped)
      } catch (e) {
        debugError("Nominatim search failed:", e)
      } finally {
        setIsSearchingLocation(false)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [locationSearchValue, step])


  // Render functions for each step
  const renderStep1 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Restaurant information</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => setStep1({ ...step1, restaurantName: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Customers will see this name"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Pure veg restaurant?*</Label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep1({ ...step1, pureVegRestaurant: true })}
                className={`px-3 py-1.5 text-xs rounded-full border ${
                  step1.pureVegRestaurant === true
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                Yes, Pure Veg
              </button>
              <button
                type="button"
                onClick={() => setStep1({ ...step1, pureVegRestaurant: false })}
                className={`px-3 py-1.5 text-xs rounded-full border ${
                  step1.pureVegRestaurant === false
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                No, Mixed Menu
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              This helps users filter restaurants by dietary preference.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md">
        <h2 className="text-lg font-semibold text-black mb-4">Owner details</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-700">Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => setStep1({ ...step1, ownerName: normalizeName(e.target.value) })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="Owner full name"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">User Id*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => setStep1({ ...step1, ownerEmail: e.target.value })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="owner@example.com"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Phone number*</Label>
            <Input
              value={step1.ownerPhone || ""}
              onChange={(e) => setStep1({ ...step1, ownerPhone: sanitizeDigits(e.target.value).slice(0, 10) })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="10-digit mobile number"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Restaurant contact & location</h2>
        <div className="relative">
          <Label className="text-xs text-gray-700">Search location</Label>
          <div className="relative">
            <Input
              ref={locationSearchInputRef}
              value={locationSearchValue}
              onChange={(e) => setLocationSearchValue(e.target.value)}
              className="mt-1 bg-white text-sm"
              placeholder="Search and select restaurant address..."
            />
            {isSearchingLocation && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-[#6412c6]" />
              </div>
            )}
          </div>

          {locationSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
              {locationSuggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    const { lat, lng, display, addr } = s
                    const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.locality || ""
                    const city = addr.city || addr.town || addr.village || ""
                    const state = addr.state || ""
                    const pincode = addr.postcode || ""

                    setStep1((prev) => ({
                      ...prev,
                      location: {
                        ...prev.location,
                        formattedAddress: display,
                        addressLine1: display,
                        area: area || prev.location.area,
                        city: city || prev.location.city,
                        state: state || prev.location.state,
                        pincode: pincode || prev.location.pincode,
                        latitude: lat,
                        longitude: lng,
                      },
                    }))
                    setLocationSearchValue(display)
                    setLocationSuggestions([])
                  }}
                  className="w-full px-4 py-2 text-left text-[13px] font-medium text-gray-700 hover:bg-[#f7f3fc] border-b border-gray-100 last:border-none"
                >
                  <span className="truncate">{s.display}</span>
                </button>
              ))}
            </div>
          )}
          
          <p className="text-[11px] text-gray-500 mt-1">
            Search to auto-fill Area, City, State, Pincode and coordinates.
          </p>
        </div>
        <div>
          <Label className="text-xs text-gray-700">Service zone*</Label>
          <select
            value={step1.zoneId || ""}
            onChange={(e) => setStep1({ ...step1, zoneId: e.target.value })}
            className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
            disabled={zonesLoading}
          >
            <option value="">{zonesLoading ? "Loading zones..." : "Select a zone"}</option>
            {zones.map((z) => {
              const id = String(z?._id || z?.id || "")
              const label = z?.name || z?.zoneName || z?.serviceLocation || id
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              )
            })}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            Choose the service zone where your restaurant will be available.
          </p>
        </div>
        <div>
          <Label className="text-xs text-gray-700">Primary contact number*</Label>
          <Input
            value={step1.primaryContactNumber || ""}
            onChange={(e) => setStep1({ ...step1, primaryContactNumber: sanitizeDigits(e.target.value).slice(0, 10) })}
            className="mt-1 bg-white text-sm text-black placeholder-black"
            placeholder="Restaurant's primary contact number"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
        <div className="space-y-3">
          <Input
            value={step1.location?.area || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, area: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Area / Sector / Locality*"
          />
          <Input
            value={step1.location?.city || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, city: e.target.value } })}
            className="bg-white text-sm"
            placeholder="City*"
          />
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine1: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Shop no. / building no. (optional)"
          />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, addressLine2: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Floor / tower (optional)"
          />
          <Input
            value={step1.location?.state || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, state: e.target.value } })}
            className="bg-white text-sm"
            placeholder="State (optional)"
          />
          <Input
            value={step1.location?.pincode || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, pincode: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Pin code (optional)"
          />
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) => setStep1({ ...step1, location: { ...step1.location, landmark: e.target.value } })}
            className="bg-white text-sm"
            placeholder="Nearby landmark (optional)"
          />
        </div>
      </section>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <h2 className="text-lg font-semibold text-black">Menu & photos</h2>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Menu images*</Label>
          <div className="mt-1 border border-dashed border-gray-300 rounded-md bg-gray-50/70 px-4 py-3">
            <label htmlFor="menuImagesInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium cursor-pointer w-full items-center">
              <Upload className="w-4.5 h-4.5" />
              <span>Choose files</span>
            </label>
            <input
              id="menuImagesInput"
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length) {
                  setStep2((prev) => ({ ...prev, menuImages: [...(prev.menuImages || []), ...files] }))
                  e.target.value = ''
                }
              }}
            />
          </div>
          {step2.menuImages.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {step2.menuImages.map((file, idx) => {
                const imageUrl = file instanceof File ? URL.createObjectURL(file) : (file?.url || file)
                return (
                  <div key={idx} className="relative aspect-[4/5] rounded-md overflow-hidden bg-gray-100">
                    {imageUrl && <img src={imageUrl} alt={`Menu ${idx + 1}`} className="w-full h-full object-cover" />}
                    <button
                      type="button"
                      onClick={() => setStep2((prev) => ({ ...prev, menuImages: prev.menuImages.filter((_, i) => i !== idx) }))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-gray-700">Restaurant profile image*</Label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {step2.profileImage ? (
                (() => {
                  const imageSrc = step2.profileImage instanceof File ? URL.createObjectURL(step2.profileImage) : (step2.profileImage?.url || step2.profileImage)
                  return imageSrc ? <img src={imageSrc} alt="Profile" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-500" />
                })()
              ) : (
                <ImageIcon className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <label htmlFor="profileImageInput" className="inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-sm bg-white text-black border-black text-xs font-medium cursor-pointer">
              <Upload className="w-4.5 h-4.5" />
              <span>Upload</span>
            </label>
            <input
              id="profileImageInput"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                if (file) setStep2((prev) => ({ ...prev, profileImage: file }))
                e.target.value = ''
              }}
            />
          </div>
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-5">
        <div>
          <Label className="text-xs text-gray-700">Select cuisines (up to 3)*</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {cuisinesOptions.map((cuisine) => {
              const active = step2.cuisines.includes(cuisine)
              return (
                <button
                  key={cuisine}
                  type="button"
                  onClick={() => {
                    setStep2((prev) => {
                      const exists = prev.cuisines.includes(cuisine)
                      if (exists) return { ...prev, cuisines: prev.cuisines.filter((c) => c !== cuisine) }
                      if (prev.cuisines.length >= 3) return prev
                      return { ...prev, cuisines: [...prev.cuisines, cuisine] }
                    })
                  }}
                  className={`px-3 py-1.5 text-xs rounded-full ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  {cuisine}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs text-gray-700">Outlet timings*</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-700 mb-1 block">Opening time</Label>
              <Input
                type="time"
                value={step2.openingTime || ""}
                onChange={(e) => {
                  const nextOpening = e.target.value
                  const closingMinutes = timeStringToMinutes(step2.closingTime)
                  const openingMinutes = timeStringToMinutes(nextOpening)
                  if (openingMinutes !== null && closingMinutes !== null) {
                    if (openingMinutes === closingMinutes) {
                      toast.error("Opening time and closing time cannot be same")
                      return
                    }
                    if (closingMinutes < openingMinutes) {
                      toast.error("Closing time cannot be less than opening time")
                      return
                    }
                  }
                  setStep2({ ...step2, openingTime: nextOpening })
                }}
                autoComplete="off"
                className="bg-white text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-700 mb-1 block">Closing time</Label>
              <Input
                type="time"
                value={step2.closingTime || ""}
                onChange={(e) => {
                  const nextClosing = e.target.value
                  const openingMinutes = timeStringToMinutes(step2.openingTime)
                  const closingMinutes = timeStringToMinutes(nextClosing)
                  if (openingMinutes !== null && closingMinutes !== null) {
                    if (openingMinutes === closingMinutes) {
                      toast.error("Opening time and closing time cannot be same")
                      return
                    }
                    if (closingMinutes < openingMinutes) {
                      toast.error("Closing time cannot be less than opening time")
                      return
                    }
                  }
                  setStep2({ ...step2, closingTime: nextClosing })
                }}
                autoComplete="off"
                className="bg-white text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs text-gray-700">Estimated delivery time*</Label>
          <Input
            value={step2.estimatedDeliveryTime || ""}
            onChange={(e) => setStep2({ ...step2, estimatedDeliveryTime: e.target.value })}
            autoComplete="off"
            className="mt-1 bg-white text-sm"
            placeholder="e.g., 25-30 mins"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-gray-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-800" />
            <span>Open days*</span>
          </Label>
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setStep2((prev) => {
                      const exists = prev.openDays.includes(day)
                      if (exists) return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
                      return { ...prev, openDays: [...prev.openDays, day] }
                    })
                  }}
                  className={`aspect-square flex items-center justify-center rounded-md text-[11px] font-medium ${active ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">PAN details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-gray-700">PAN number*</Label>
            <Input
              value={step3.panNumber || ""}
              onChange={(e) => setStep3({ ...step3, panNumber: sanitizePan(e.target.value) })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
              placeholder="ABCDE1234F"
              maxLength={10}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-700">Name on PAN*</Label>
            <Input
              value={step3.nameOnPan || ""}
              onChange={(e) => setStep3({ ...step3, nameOnPan: normalizeName(e.target.value) })}
              className="mt-1 bg-white text-sm text-black placeholder-black"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs text-gray-700">PAN image*</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setStep3({ ...step3, panImage: e.target.files?.[0] || null })}
            className="mt-1 bg-white text-sm text-black placeholder-black"
          />
          {step3.panImage && (
            <div className="mt-2 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                <img src={getStoredImageSrc(step3.panImage)} alt="PAN document" className="h-full w-full object-cover" />
              </div>
              <p className="text-xs text-gray-600">Selected: {getStoredFileLabel(step3.panImage)}</p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">GST details</h2>
        <div className="flex gap-4 items-center text-sm">
          <span className="text-gray-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`px-3 py-1.5 text-xs rounded-full ${step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`px-3 py-1.5 text-xs rounded-full ${!step3.gstRegistered ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <Input value={step3.gstNumber || ""} onChange={(e) => setStep3({ ...step3, gstNumber: sanitizeGst(e.target.value) })} className="bg-white text-sm" placeholder="GST number*" maxLength={15} />
            <Input value={step3.gstLegalName || ""} onChange={(e) => setStep3({ ...step3, gstLegalName: normalizeName(e.target.value) })} className="bg-white text-sm" placeholder="Legal name*" />
            <Input value={step3.gstAddress || ""} onChange={(e) => setStep3({ ...step3, gstAddress: e.target.value })} className="bg-white text-sm" placeholder="Registered address*" />
            <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, gstImage: e.target.files?.[0] || null })} className="bg-white text-sm" />
            {step3.gstImage && (
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                  <img src={getStoredImageSrc(step3.gstImage)} alt="GST document" className="h-full w-full object-cover" />
                </div>
                <p className="text-xs text-gray-600">Selected: {getStoredFileLabel(step3.gstImage)}</p>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">FSSAI details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.fssaiNumber || ""} onChange={(e) => setStep3({ ...step3, fssaiNumber: sanitizeFssai(e.target.value) })} className="bg-white text-sm" placeholder="FSSAI number*" inputMode="numeric" maxLength={14} />
          <div>
            <Label className="text-xs text-gray-700 mb-1 block">FSSAI expiry date*</Label>
            <Input
              type="date"
              value={step3.fssaiExpiry || ""}
              onChange={(e) => setStep3({ ...step3, fssaiExpiry: e.target.value })}
              min={getTodayLocalYMD()}
              autoComplete="off"
              className="bg-white text-sm"
            />
          </div>
        </div>
        <Input type="file" accept="image/*" onChange={(e) => setStep3({ ...step3, fssaiImage: e.target.files?.[0] || null })} className="bg-white text-sm" />
        {step3.fssaiImage && (
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
              <img src={getStoredImageSrc(step3.fssaiImage)} alt="FSSAI document" className="h-full w-full object-cover" />
            </div>
            <p className="text-xs text-gray-600">Selected: {getStoredFileLabel(step3.fssaiImage)}</p>
          </div>
        )}
      </section>

      <section className="bg-white p-4 sm:p-6 rounded-md space-y-4">
        <h2 className="text-lg font-semibold text-black">Bank account details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.accountNumber || ""} onChange={(e) => setStep3({ ...step3, accountNumber: sanitizeDigits(e.target.value).slice(0, 18) })} className="bg-white text-sm" placeholder="Account number*" inputMode="numeric" maxLength={18} />
          <Input value={step3.confirmAccountNumber || ""} onChange={(e) => setStep3({ ...step3, confirmAccountNumber: sanitizeDigits(e.target.value).slice(0, 18) })} className="bg-white text-sm" placeholder="Re-enter account number*" inputMode="numeric" maxLength={18} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input value={step3.ifscCode || ""} onChange={(e) => setStep3({ ...step3, ifscCode: sanitizeIfsc(e.target.value) })} className="bg-white text-sm" placeholder="IFSC code*" maxLength={11} />
          <select value={step3.accountType || ""} onChange={(e) => setStep3({ ...step3, accountType: e.target.value })} className="bg-white text-sm border border-input rounded-md h-10 px-3">
            <option value="">Select account type</option>
            <option value="Saving">Saving</option>
            <option value="Current">Current</option>
          </select>
        </div>
        <Input value={step3.accountHolderName || ""} onChange={(e) => setStep3({ ...step3, accountHolderName: normalizeName(e.target.value) })} className="bg-white text-sm" placeholder="Account holder name*" />
      </section>
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    return renderStep3()
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="px-4 py-4 sm:px-6 sm:py-5 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary" />
          <div className="text-sm font-semibold text-black">Add New Restaurant</div>
        </div>
        <div className="text-xs text-gray-600">Step {step} of 3</div>
      </header>

      <main ref={mainContentRef} className="flex-1 px-4 sm:px-6 py-4 space-y-4">
        {renderStep()}
      </main>

      {formErrors.submit && (
        <div className="px-4 sm:px-6 pb-2 text-xs text-red-600">{formErrors.submit}</div>
      )}

      <footer className="px-4 sm:px-6 py-3 bg-white">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="text-sm text-gray-700 bg-transparent"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isSubmitting}
            className="text-sm bg-black text-white px-6"
          >
            {step === 3 ? (isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating... </> : "Create Restaurant") : isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>
      </footer>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md bg-white p-0">
          <div className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative bg-emerald-500 rounded-full p-4">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-slate-900 mb-2">Restaurant Created Successfully!</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                The restaurant has been created successfully.
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}



