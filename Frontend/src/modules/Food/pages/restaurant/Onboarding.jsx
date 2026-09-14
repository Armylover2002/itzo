import { useEffect, useRef, useState } from "react"
import { useNavigate, useSearchParams, useLocation } from "react-router-dom"
import { Input } from "@food/components/ui/input"
import { Button } from "@food/components/ui/button"
import { Label } from "@food/components/ui/label"
import { Image as ImageIcon, Upload, Clock, Calendar as CalendarIcon, X, CheckCircle2, Store, MapPin, FileText, Truck } from "lucide-react"
import RestaurantOnboardingShell from "@food/components/restaurant/RestaurantOnboardingShell"
import OnboardingLocationSection from "@food/components/restaurant/OnboardingLocationSection"
import {
  ONBOARDING_SECTION,
  ONBOARDING_SECTION_TITLE,
  ONBOARDING_SECTION_DESC,
  ONBOARDING_LABEL,
  ONBOARDING_HINT,
  ONBOARDING_INPUT,
  ONBOARDING_CHIP_ACTIVE,
  ONBOARDING_CHIP_INACTIVE,
  ONBOARDING_DAY_ACTIVE,
  ONBOARDING_DAY_INACTIVE,
} from "@food/components/restaurant/onboardingStyles"
import { getAppLogo, getRestaurantLoginBanner, subscribeBusinessSettings } from "@common/utils/businessSettings"
import loginBg from "@food/assets/loginbanner.png"
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover"
import { Calendar } from "@food/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { restaurantAPI, zoneAPI, api, onboardingFeeAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { determineStepToShow } from "@food/utils/onboardingUtils"
import {
  validateOnboardingStep1,
  validateOnboardingStep2,
  validateOnboardingStep3,
  validateOnboardingStep4,
  onboardingInputClass,
} from "@food/utils/onboardingValidation"
import { clearOnboardingDraft, clearOnboardingFileCache } from "@food/utils/onboardingDraftStorage"
import OnboardingRestaurantCardPreview from "@food/components/restaurant/OnboardingRestaurantCardPreview"
import { toast } from "sonner"

const OWNER_PHONE_DUPLICATE_MSG = "This phone number is already registered with another restaurant."
const PRIMARY_CONTACT_DUPLICATE_MSG = "This contact number is already registered with another restaurant."
const ONBOARDING_FORM_BACKUP_KEY = "restaurant_onboarding_form_backup_v1"
const getRestaurantPhoneFieldError = (error) => {
  const msg = error?.response?.data?.message || error?.response?.data?.error || ""
  if (msg === PRIMARY_CONTACT_DUPLICATE_MSG) {
    return { field: "primaryContactNumber", message: msg }
  }
  if (msg === OWNER_PHONE_DUPLICATE_MSG) {
    return { field: "ownerPhone", message: msg }
  }
  if (/already registered|already exists|pending approval/i.test(msg)) {
    if (/contact/i.test(msg)) {
      return { field: "primaryContactNumber", message: msg }
    }
    return { field: "ownerPhone", message: msg }
  }
  return null
}
import { useCompanyName } from "@food/hooks/useCompanyName"
import { clearModuleAuth, clearAuthData, getRestaurantPendingPhone, setAuthData, setRestaurantPendingPhone } from "@food/utils/auth"
import { persistRestaurantAuthFromPayload } from "@food/utils/restaurantApproval"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable, openCamera } from "@food/utils/imageUploadUtils"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


const scrollOnboardingToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  const main = document.getElementById("onboarding-main-scroll")
  if (main) main.scrollTo({ top: 0, left: 0, behavior: "instant" })
}

const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ESTIMATED_DELIVERY_TIME_OPTIONS = [
  "10-15 mins",
  "15-20 mins",
  "20-25 mins",
  "25-30 mins",
  "30-35 mins",
  "35-40 mins",
  "40-45 mins",
  "45-50 mins",
  "50-60 mins",
]

const PAN_NUMBER_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const GST_NUMBER_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const FSSAI_NUMBER_REGEX = /^\d{14}$/
const BANK_ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/
const IFSC_CODE_REGEX = /^[A-Z0-9]{11}$/
const ACCOUNT_HOLDER_NAME_REGEX = /^[A-Za-z ]+$/
const GST_LEGAL_NAME_REGEX = /^[A-Za-z ]+$/
const NAME_REGEX = /^[A-Za-z ]+$/
const OWNER_EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
const PHONE_NUMBER_REGEX = /^\d{10,12}$/
const PRIMARY_PHONE_NUMBER_REGEX = /^\d{10}$/
const PINCODE_REGEX = /^\d{6}$/
const LOCAL_IMAGE_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif"
const GALLERY_IMAGE_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"

const FieldErrorMsg = ({ message }) =>
  message ? <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p> : null

const ONBOARDING_DOC_PREVIEW =
  "relative mt-3 aspect-[4/3] max-h-40 w-full max-w-xs overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"

const isUploadableFile = (value) => {
  if (!value || typeof value !== "object") return false

  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true

  return (
    typeof value.size === "number" &&
    (typeof value.slice === "function" || typeof value.arrayBuffer === "function")
  )
}

const getImageAssetUrl = (value) => {
  if (!value) return ""
  if (typeof value === "string" && value.startsWith("http")) return value
  if (value?.url && typeof value.url === "string") return value.url
  return ""
}

const hasValidImageAsset = (value) => isUploadableFile(value) || Boolean(getImageAssetUrl(value))

const hasValidMenuImageAsset = (value) => hasValidImageAsset(value)

const pickNonEmpty = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === "string" && !value.trim()) continue
    return value
  }
  return ""
}

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "").slice(-15)

const getDisplayPhone = (value) => normalizePhoneDigits(value).slice(-10)

const buildOnboardingStepFormData = (stepNum, { step1, step2, step3 }) => {
  const formData = new FormData()
  formData.append("ownerPhone", normalizePhoneDigits(step1.ownerPhone))

  if (stepNum === 1) {
    formData.append("restaurantName", step1.restaurantName || "")
    formData.append(
      "pureVegRestaurant",
      step1.pureVegRestaurant === true ? "true" : "false",
    )
    formData.append("businessType", step1.businessType === "Street Food Vendor" ? "Street Food Vendor" : "Fixed Restaurant")
    formData.append("ownerName", step1.ownerName || "")
    formData.append("ownerEmail", (step1.ownerEmail || "").trim())
    formData.append("primaryContactNumber", normalizePhoneDigits(step1.primaryContactNumber))
    formData.append("zoneId", step1.zoneId || "")
    formData.append("addressLine1", step1.location?.addressLine1 || "")
    formData.append("addressLine2", step1.location?.addressLine2 || "")
    formData.append("area", step1.location?.area || "")
    formData.append("city", step1.location?.city || "")
    formData.append("state", step1.location?.state || "")
    formData.append("pincode", step1.location?.pincode || "")
    formData.append("landmark", step1.location?.landmark || "")
    formData.append("formattedAddress", step1.location?.formattedAddress || "")
    formData.append("latitude", String(step1.location?.latitude || ""))
    formData.append("longitude", String(step1.location?.longitude || ""))
    formData.append("ref", step1.ref || "")
  }

  if (stepNum === 2) {
    formData.append("cuisines", (step2.cuisines || []).join(","))
    formData.append("openingTime", normalizeTimeValue(step2.openingTime) || "")
    formData.append("closingTime", normalizeTimeValue(step2.closingTime) || "")
    formData.append("openDays", (step2.openDays || []).join(","))

    const menuFiles = (step2.menuImages || []).filter((f) => isUploadableFile(f))
    menuFiles.forEach((file) => formData.append("menuImages", file))

    if (isUploadableFile(step2.profileImage)) {
      formData.append("profileImage", step2.profileImage)
    }
  }

  if (stepNum === 3) {
    formData.append("panNumber", step3.panNumber || "")
    formData.append("nameOnPan", step3.nameOnPan || "")
    if (isUploadableFile(step3.panImage)) {
      formData.append("panImage", step3.panImage)
    }

    formData.append("gstRegistered", step3.gstRegistered ? "true" : "false")
    if (step3.gstRegistered) {
      formData.append("gstNumber", step3.gstNumber || "")
      formData.append("gstLegalName", step3.gstLegalName || "")
      formData.append("gstAddress", step3.gstAddress || "")
      if (isUploadableFile(step3.gstImage)) {
        formData.append("gstImage", step3.gstImage)
      }
    }

    formData.append("fssaiNumber", step3.fssaiNumber || "")
    formData.append("fssaiExpiry", step3.fssaiExpiry || "")
    if (isUploadableFile(step3.fssaiImage)) {
      formData.append("fssaiImage", step3.fssaiImage)
    }

    formData.append("accountNumber", step3.accountNumber || "")
    formData.append("ifscCode", (step3.ifscCode || "").toUpperCase())
    formData.append("accountHolderName", step3.accountHolderName || "")
    formData.append("accountType", step3.accountType || "")
  }

  return formData
}

const getVerifiedPhoneFromStoredRestaurant = () => {
  try {
    const pending = getRestaurantPendingPhone() || localStorage.getItem("restaurant_pendingPhone")
    if (pending && pending.trim()) {
      return getDisplayPhone(pending.trim())
    }

    const authDataRaw = sessionStorage.getItem("restaurantAuthData")
    if (authDataRaw) {
      const authData = JSON.parse(authDataRaw)
      if (authData?.phone?.trim()) {
        return getDisplayPhone(authData.phone.trim())
      }
    }

    const loginPhone = sessionStorage.getItem("restaurantLoginPhone")
    if (loginPhone && loginPhone.trim()) {
      return getDisplayPhone(loginPhone.trim())
    }

    const storedUser = localStorage.getItem("restaurant_user")
    if (!storedUser) return ""
    const user = JSON.parse(storedUser)
    const candidates = [
      user?.ownerPhone,
      user?.primaryContactNumber,
      user?.phone,
      user?.phoneNumber,
      user?.mobile,
      user?.contactNumber,
      user?.contact?.phone,
      user?.owner?.phone,
      user?.restaurant?.phone,
    ]
    const phone = candidates.find((value) => typeof value === "string" && value.trim())
    return phone ? getDisplayPhone(phone.trim()) : ""
  } catch {
    return ""
  }
}

const resolveVerifiedOwnerPhone = (...candidates) => {
  for (const value of candidates) {
    const display = getDisplayPhone(value)
    if (display) return display
  }
  return ""
}

const normalizeAccountTypeValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "saving" || normalized === "savings") return "Saving"
  if (normalized === "current") return "Current"
  return ""
}

const normalizeZoneIdValue = (value) => {
  if (!value) return ""
  if (typeof value === "string") return value
  return String(value?._id || value?.id || value || "")
}

const getZoneDisplayName = (zone) =>
  zone?.name || zone?.zoneName || zone?.serviceLocation || ""

const getTodayLocalYMD = () => formatDateToLocalYMD(new Date())

const finishRegistrationAndGoPending = async (registerResponse, ownerPhone, navigate) => {
  persistRestaurantAuthFromPayload(
    registerResponse?.data?.data || registerResponse?.data,
    setAuthData,
  )
  sessionStorage.removeItem("restaurantReonboard")
  sessionStorage.removeItem("restaurant_registrationToken")
  await clearOnboardingDraft()
  clearOnboardingFormBackup()
  clearOnboardingFileCache()
  const phone = normalizePhoneDigits(ownerPhone)
  try {
    localStorage.setItem("restaurant_pendingPhone", phone)
  } catch {
    // Ignore storage failures
  }
  toast.success("Registration submitted. Awaiting admin approval.", { duration: 4000 })
  navigate("/food/restaurant/pending-verification", {
    replace: true,
    state: { phone },
  })
}

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  const normalized = normalizeTimeValue(timeString)
  if (!normalized || !normalized.includes(":")) {
    return null
  }
  const [hours, minutes] = normalized.split(":").map(Number)
  return new Date(2000, 0, 1, hours || 0, minutes || 0)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date) return ""
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

const normalizeTimeValue = (value) => {
  if (!value) return ""

  const raw = String(value).trim()
  if (!raw) return ""

  // Already in HH:mm format
  if (/^\d{2}:\d{2}$/.test(raw)) {
    return raw
  }

  // Handle H:mm by zero-padding hour
  if (/^\d{1}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":")
    return `${h.padStart(2, "0")}:${m}`
  }

  // Fallback for ISO / Date-like strings
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return timeToString(parsed)
  }

  return ""
}

const normalizeBackupPhone = (value) => normalizePhoneDigits(value).slice(-10)

const readOnboardingFormBackup = () => {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(ONBOARDING_FORM_BACKUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

const writeOnboardingFormBackup = (payload) => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.setItem(ONBOARDING_FORM_BACKUP_KEY, JSON.stringify(payload))
  } catch {
    // Ignore storage failures in constrained webviews.
  }
}

const clearOnboardingFormBackup = () => {
  if (typeof localStorage === "undefined") return
  try {
    localStorage.removeItem(ONBOARDING_FORM_BACKUP_KEY)
  } catch {
    // Ignore storage failures.
  }
}

const formatDateToLocalYMD = (date) => {
  if (!date || Number.isNaN(date.getTime?.())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseLocalYMDDate = (value) => {
  if (!value || typeof value !== "string") return undefined
  const parts = value.split("-").map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined
  const [year, month, day] = parts
  return new Date(year, month - 1, day)
}

/**
 * Ray-casting point-in-polygon check for frontend validation.
 */
function TimeSelector({ label, value, onChange, hasError = false }) {
  const timeValue = stringToTime(value)

  const handleTimeChange = (newValue) => {
    if (!newValue) {
      onChange("")
      return
    }
    const timeString = timeToString(newValue)
    onChange(timeString)
  }

  return (
    <div className={`rounded-xl border bg-slate-50/80 px-4 py-3 transition-colors focus-within:ring-2 ${
      hasError
        ? "border-red-400 ring-2 ring-red-200 focus-within:border-red-400 focus-within:ring-red-200"
        : "border-slate-200 focus-within:border-[#FF0000]/30 focus-within:ring-[#FF0000]/10"
    }`}>
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-[#FF0000]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">{label}</span>
      </div>
      <MobileTimePicker
        value={timeValue}
        onChange={handleTimeChange}
        onAccept={handleTimeChange}
        slotProps={{
          textField: {
            variant: "outlined",
            size: "small",
            placeholder: "Select time",
            sx: {
              "& .MuiOutlinedInput-root": {
                height: "36px",
                fontSize: "12px",
                backgroundColor: "white",
                "& fieldset": {
                  borderColor: "#e5e7eb",
                },
                "&:hover fieldset": {
                  borderColor: "#d1d5db",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#FF0000",
                },
              },
              "& .MuiInputBase-input": {
                padding: "8px 12px",
                fontSize: "12px",
              },
            },
            onBlur: (event) => {
              const normalized = normalizeTimeValue(event?.target?.value)
              if (normalized) {
                onChange(normalized)
              }
            },
          },
        }}
        format="hh:mm a"
      />
    </div>
  )
}

export default function RestaurantOnboarding() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [paymentInProgress, setPaymentInProgress] = useState(false)
  const [error, setError] = useState("")
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [feeConfig, setFeeConfig] = useState(undefined)
  const [fetchingFees, setFetchingFees] = useState(false)
  const [isReonboardBypass, setIsReonboardBypass] = useState(false)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo("restaurant"))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return banner?.url && banner?.active ? banner.url : loginBg
  })

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo("restaurant")
      if (logo) setLogoUrl(logo)
      const banner = getRestaurantLoginBanner()
      if (banner?.url && banner?.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true)
        const res = await onboardingFeeAPI.getPublicFees()
        const fees = res?.data?.data || res?.data
        if (fees && fees.RESTAURANT) {
          setFeeConfig(fees.RESTAURANT)
        }
      } catch (err) {
        debugError("Failed to fetch public onboarding fee:", err)
      } finally {
        setFetchingFees(false)
      }
    }
    fetchFees()
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await restaurantAPI.logout()
      clearModuleAuth("restaurant")
      clearAuthData()
      await clearOnboardingDraft()
      clearOnboardingFormBackup()
      clearOnboardingFileCache()
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      navigate("/food/restaurant/login", { replace: true })
    } catch (error) {
      debugError("Logout failed:", error)
      clearModuleAuth("restaurant")
      await clearOnboardingDraft()
      clearOnboardingFormBackup()
      clearOnboardingFileCache()
      navigate("/food/restaurant/login", { replace: true })
    } finally {
      setIsLoggingOut(false)
    }
  }

  const [verifiedPhoneNumber, setVerifiedPhoneNumber] = useState(() =>
    resolveVerifiedOwnerPhone(
      location.state?.verifiedPhone,
      getVerifiedPhoneFromStoredRestaurant(),
    ),
  )
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [isEditing, setIsEditing] = useState(true)
  const [isFssaiCalendarOpen, setIsFssaiCalendarOpen] = useState(false)
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)

  const [step1, setStep1] = useState(() => {
    const verified = resolveVerifiedOwnerPhone(
      location.state?.verifiedPhone,
      getVerifiedPhoneFromStoredRestaurant(),
    )
    return {
      restaurantName: "",
      pureVegRestaurant: null,
      businessType: "Fixed Restaurant",
      ownerName: "",
      ownerEmail: "",
      ownerPhone: verified,
      primaryContactNumber: verified,
      zoneId: "",
      zoneName: "",
      ref: "",
      location: {
        formattedAddress: "",
        addressLine1: "",
        addressLine2: "",
        area: "",
        city: "",
        state: "",
        pincode: "",
        landmark: "",
        latitude: "",
        longitude: "",
      },
    }
  })

  const [step2, setStep2] = useState({
    menuImages: [],
    profileImage: null,
    cuisines: [],
    openingTime: "11:00",
    closingTime: "23:00",
    openDays: [...daysOfWeek],
  })

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

  const [step4, setStep4] = useState({
    estimatedDeliveryTime: "",
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const previewUrlCacheRef = useRef(new Map())
  const hasRestoredDraftStepRef = useRef(false)
  const onboardingDraftRef = useRef(null)
  const paymentFlowInProgressRef = useRef(false)
  const menuImagesInputRef = useRef(null)
  const profileImageInputRef = useRef(null)
  const panImageInputRef = useRef(null)
  const gstImageInputRef = useRef(null)
  const fssaiImageInputRef = useRef(null)
  const [sourcePicker, setSourcePicker] = useState({
    isOpen: false,
    title: "",
    onSelectFile: null,
    fileNamePrefix: "camera-image",
    fallbackInputRef: null,
  })

  const goToStep = (nextStep, options = {}) => {
    const normalizedStep = Math.min(4, Math.max(1, Number(nextStep) || 1))
    const shouldReplace = options.replace === true
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set("step", String(normalizedStep))
    setStep(normalizedStep)
    setFieldErrors({})
    setSearchParams(nextParams, { replace: shouldReplace })
    requestAnimationFrame(() => scrollOnboardingToTop())
  }

  const clearFieldError = (field) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const inputCls = (field) => onboardingInputClass(fieldErrors, field, ONBOARDING_INPUT)

  useEffect(() => {
    scrollOnboardingToTop()
  }, [step])

  const getPreviewImageUrl = (value) => {
    if (!value) return null
    if (typeof value === "string") return value
    if (value?.url && typeof value.url === "string") return value.url

    if (isUploadableFile(value)) {
      const cache = previewUrlCacheRef.current
      const cached = cache.get(value)
      if (cached) return cached
      try {
        const objectUrl = URL.createObjectURL(value)
        cache.set(value, objectUrl)
        return objectUrl
      } catch {
        return null
      }
    }

    return null
  }

  const openBrowserCameraFallback = ({ onSelectFile }) => {
    try {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.capture = "environment"
      input.onchange = (event) => {
        const file = event?.target?.files?.[0] || null
        if (file) onSelectFile(file)
      }
      input.click()
    } catch (error) {
      debugError("Browser camera fallback failed:", error)
    }
  }

  const openImageSourcePicker = ({ title, onSelectFile, fileNamePrefix, fallbackInputRef }) => {
    setSourcePicker({
      isOpen: true,
      title: title || "Select image source",
      onSelectFile,
      fileNamePrefix: fileNamePrefix || "camera-image",
      fallbackInputRef: fallbackInputRef || null,
    })
  }

  const closeImageSourcePicker = () => {
    setSourcePicker((prev) => ({ ...prev, isOpen: false }))
  }

  const handlePickFromDevice = () => {
    const fallbackRef = sourcePicker.fallbackInputRef
    closeImageSourcePicker()
    fallbackRef?.current?.click()
  }

  const handlePickFromCamera = async () => {
    const pickerConfig = {
      onSelectFile: sourcePicker.onSelectFile,
      fileNamePrefix: sourcePicker.fileNamePrefix,
    }
    closeImageSourcePicker()
    await openCamera(pickerConfig)
  }

  const openOnboardingImagePicker = ({
    title,
    fallbackInputRef,
    fileNamePrefix,
    onSelectFile,
  }) => {
    openImageSourcePicker({
      title,
      fallbackInputRef,
      fileNamePrefix,
      onSelectFile,
    })
  }


  // Load from localStorage/server on mount and check URL parameter
  useEffect(() => {
    const navigationVerifiedPhone = resolveVerifiedOwnerPhone(
      location.state?.verifiedPhone,
      getVerifiedPhoneFromStoredRestaurant(),
    )
    if (navigationVerifiedPhone) {
      setVerifiedPhoneNumber(navigationVerifiedPhone)
    }

    const initOnboardingData = async () => {
      try {
        setLoading(true)

        let serverData = null
        let isReonboard = sessionStorage.getItem("restaurantReonboard") === "true"

        if (isReonboard) {
          setIsEditing(true)
          setIsReonboardBypass(true) // bypass payment for re-applying
        } else {
          try {
            const res = await restaurantAPI.getCurrentRestaurant()
            serverData = res?.data?.data?.restaurant || res?.data?.restaurant
          } catch (err) {
            setIsEditing(true)
            if (err?.response?.status === 401) {
              debugError("Authentication error fetching onboarding:", err)
            } else {
              debugError("Error fetching onboarding data:", err)
            }
          }
        }

        const verifiedPhone = resolveVerifiedOwnerPhone(
          location.state?.verifiedPhone,
          getVerifiedPhoneFromStoredRestaurant(),
        )

        // Fetch server-side draft for in-progress onboarding (resume after tab close)
        if (!serverData && !isReonboard && verifiedPhone) {
          try {
            const draftRes = await restaurantAPI.getOnboardingDraft(verifiedPhone)
            const draftData = draftRes?.data?.data?.restaurant || draftRes?.data?.restaurant
            if (draftData?.status === "onboarding") {
              serverData = draftData
              onboardingDraftRef.current = draftData
            }
          } catch (draftErr) {
            if (draftErr?.response?.status !== 404) {
              debugError("Error fetching onboarding draft:", draftErr)
            }
          }
        }

        // 1. Initial Default State
        let initialStep1 = {
          restaurantName: "",
          pureVegRestaurant: null,
          businessType: "Fixed Restaurant",
          ownerName: "",
          ownerEmail: "",
          ownerPhone: verifiedPhone,
          primaryContactNumber: verifiedPhone,
          zoneId: "",
          zoneName: "",
          ref: "",
          location: {
            formattedAddress: "",
            addressLine1: "",
            addressLine2: "",
            area: "",
            city: "",
            state: "",
            pincode: "",
            landmark: "",
            latitude: "",
            longitude: "",
          },
        }

        let initialStep2 = {
          menuImages: [],
          profileImage: null,
          cuisines: [],
          openingTime: "11:00",
          closingTime: "23:00",
          openDays: [...daysOfWeek],
        }

        let initialStep3 = {
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
        }

        let initialStep4 = {
          estimatedDeliveryTime: "",
        }

        // 2. Overlay Server Data
        if (serverData) {
          onboardingDraftRef.current = serverData
          setIsEditing(serverData.status === "rejected" || serverData.status === "pending" || serverData.status === "onboarding")

          if (serverData.status === "rejected") {
            setIsReonboardBypass(true)
            setTimeout(() => {
              toast.error(`Previous application rejected: ${serverData.rejectionReason || 'Please update your details'}`)
            }, 500)
          } else if (serverData.status !== "onboarding") {
            // Pending/approved profiles — not a fresh onboarding payment flow
            setIsReonboardBypass(true)
          }

          initialStep1 = {
            restaurantName: serverData.name || serverData.restaurantName || "",
            pureVegRestaurant: typeof serverData.pureVegRestaurant === "boolean" ? serverData.pureVegRestaurant : null,
            businessType: serverData.businessType === "Street Food Vendor" ? "Street Food Vendor" : "Fixed Restaurant",
            ownerName: serverData.ownerName || "",
            ownerEmail: serverData.ownerEmail || "",
            ownerPhone: serverData.ownerPhone || verifiedPhone,
            zoneId: normalizeZoneIdValue(serverData.zoneId) || "",
            zoneName:
              serverData.zoneName ||
              getZoneDisplayName(
                typeof serverData.zoneId === "object" ? serverData.zoneId : null,
              ) ||
              "",
            primaryContactNumber: serverData.primaryContactNumber || verifiedPhone,
            ref: "",
            location: {
              formattedAddress: serverData.location?.formattedAddress || serverData.location?.address || "",
              addressLine1: serverData.location?.addressLine1 || "",
              addressLine2: serverData.location?.addressLine2 || "",
              area: serverData.location?.area || "",
              city: serverData.location?.city || "",
              state: serverData.location?.state || "",
              pincode: serverData.location?.pincode || "",
              landmark: serverData.location?.landmark || "",
              latitude: serverData.location?.latitude ?? "",
              longitude: serverData.location?.longitude ?? "",
            },
          }

          initialStep2 = {
            menuImages: serverData.menuImages || [],
            profileImage: serverData.profileImage || null,
            cuisines: serverData.cuisines || [],
            openingTime: normalizeTimeValue(serverData.openingTime),
            closingTime: normalizeTimeValue(serverData.closingTime),
            openDays: serverData.openDays || [],
          }

          initialStep3 = {
            panNumber: serverData.panNumber || "",
            nameOnPan: serverData.nameOnPan || "",
            panImage: serverData.panImage || null,
            gstRegistered: !!serverData.gstRegistered,
            gstNumber: serverData.gstNumber || "",
            gstLegalName: serverData.gstLegalName || "",
            gstAddress: serverData.gstAddress || "",
            gstImage: serverData.gstImage || null,
            fssaiNumber: serverData.fssaiNumber || "",
            fssaiExpiry: serverData.fssaiExpiry ? String(serverData.fssaiExpiry).split('T')[0] : "",
            fssaiImage: serverData.fssaiImage || null,
            accountNumber: serverData.accountNumber || "",
            confirmAccountNumber: serverData.accountNumber || "",
            ifscCode: (serverData.ifscCode || "").toUpperCase(),
            accountHolderName: serverData.accountHolderName || "",
            accountType: normalizeAccountTypeValue(serverData.accountType || ""),
          }

          initialStep4 = {
            estimatedDeliveryTime: serverData.estimatedDeliveryTime || "",
          }
        } else if (!isReonboard) {
          setIsEditing(true)
        }

        const finalVerifiedPhone = resolveVerifiedOwnerPhone(
          verifiedPhone,
          initialStep1.ownerPhone,
          serverData?.ownerPhone,
        )
        if (finalVerifiedPhone) {
          initialStep1.ownerPhone = finalVerifiedPhone
          setVerifiedPhoneNumber(finalVerifiedPhone)
          setRestaurantPendingPhone(finalVerifiedPhone)
        }

        let stepToShow = 1

        // Restore latest in-progress client backup (important for APK refresh/webview reload).
        const localBackup = readOnboardingFormBackup()
        const backupPhone = normalizeBackupPhone(localBackup?.phone)
        const currentPhone = normalizeBackupPhone(finalVerifiedPhone || initialStep1.ownerPhone)
        const stepParamFromUrl = searchParams.get("step")
        if (
          localBackup?.step1 &&
          localBackup?.step2 &&
          localBackup?.step3 &&
          (
            !currentPhone ||
            (backupPhone && backupPhone === currentPhone)
          )
        ) {
          initialStep1 = {
            ...initialStep1,
            ...localBackup.step1,
            ownerPhone: pickNonEmpty(localBackup?.step1?.ownerPhone, initialStep1.ownerPhone),
            primaryContactNumber: pickNonEmpty(
              localBackup?.step1?.primaryContactNumber,
              initialStep1.primaryContactNumber,
            ),
            location: {
              ...initialStep1.location,
              ...(localBackup?.step1?.location || {}),
            },
          }
          initialStep2 = { ...initialStep2, ...localBackup.step2 }
          initialStep3 = { ...initialStep3, ...localBackup.step3 }
          initialStep4 = { ...initialStep4, ...(localBackup.step4 || {}) }
          if (!stepParamFromUrl && Number(localBackup.currentStep) >= 1 && Number(localBackup.currentStep) <= 4) {
            stepToShow = Number(localBackup.currentStep)
          }
        }

        // Apply initialized values to React state
        setStep1(initialStep1)
        setStep2(initialStep2)
        setStep3(initialStep3)
        setStep4(initialStep4)

        // 4. Handle Routing step parameter
        const stepParam = searchParams.get("step")
        if (stepParam) {
          const stepNum = parseInt(stepParam, 10)
          if (stepNum >= 1 && stepNum <= 4) {
            stepToShow = stepNum
            setStep(stepNum)
          }
        } else {
          if (serverData) {
            if (serverData.status === "onboarding") {
              stepToShow = Math.min(Math.max(Number(serverData.onboardingStep) || 2, 1), 4)
              hasRestoredDraftStepRef.current = true
            } else if (serverData.status === "approved" || serverData.status === "pending") {
              stepToShow = 1
            } else {
              const combinedData = {
                completedSteps: serverData?.onboarding?.completedSteps,
                step1: initialStep1,
                step2: {
                  ...initialStep2,
                  deliveryTimings: {
                    openingTime: initialStep2.openingTime,
                    closingTime: initialStep2.closingTime,
                  },
                  menuImageUrls: initialStep2.menuImages,
                  profileImageUrl: initialStep2.profileImage,
                },
                step3: {
                  pan: {
                    panNumber: initialStep3.panNumber,
                    nameOnPan: initialStep3.nameOnPan,
                    image: initialStep3.panImage,
                  },
                  gst: {
                    isRegistered: !!initialStep3.gstRegistered,
                    gstNumber: initialStep3.gstNumber,
                    legalName: initialStep3.gstLegalName,
                    address: initialStep3.gstAddress,
                    image: initialStep3.gstImage,
                  },
                  fssai: {
                    registrationNumber: initialStep3.fssaiNumber,
                    expiryDate: initialStep3.fssaiExpiry,
                    image: initialStep3.fssaiImage,
                  },
                  bank: {
                    accountNumber: initialStep3.accountNumber,
                    ifscCode: initialStep3.ifscCode,
                    accountHolderName: initialStep3.accountHolderName,
                    accountType: initialStep3.accountType,
                  },
                }
              }
              const determined = determineStepToShow(combinedData)
              stepToShow = determined || 1
            }
          }
          goToStep(stepToShow, { replace: true })
        }
      } catch (err) {
        setIsEditing(true)
        debugError("Error during onboarding initialization:", err)
      } finally {
        setLoading(false)
      }
    }

    initOnboardingData()
  }, [])

  // Sync step parameter changes to the step state without resetting other states
  useEffect(() => {
    const stepParam = searchParams.get("step")
    if (stepParam) {
      const stepNum = parseInt(stepParam, 10)
      if (stepNum >= 1 && stepNum <= 4) {
        setStep(stepNum)
      }
    }
  }, [searchParams])

  useEffect(() => {
    if (!verifiedPhoneNumber) return
    setStep1((prev) => {
      if (prev.ownerPhone === verifiedPhoneNumber) return prev
      return { ...prev, ownerPhone: verifiedPhoneNumber }
    })
  }, [verifiedPhoneNumber])

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      setStep1((prev) => ({ ...prev, ref }))
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined

    const updateInset = () => {
      const vv = window.visualViewport
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height))
      setKeyboardInset(inset > 120 ? inset : 0)
    }

    updateInset()
    window.visualViewport.addEventListener("resize", updateInset)
    window.visualViewport.addEventListener("scroll", updateInset)
    return () => {
      window.visualViewport.removeEventListener("resize", updateInset)
      window.visualViewport.removeEventListener("scroll", updateInset)
    }
  }, [])

  useEffect(() => {
    return () => {
      previewUrlCacheRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url)
        } catch {
          // Ignore revoke errors
        }
      })
      previewUrlCacheRef.current.clear()
    }
  }, [])

  // Persist onboarding form snapshot locally so APK/webview refresh does not clear filled data.
  useEffect(() => {
    if (loading) return
    const phone = normalizeBackupPhone(
      verifiedPhoneNumber || step1.ownerPhone || step1.primaryContactNumber,
    )
    if (!phone) return

    const timer = setTimeout(() => {
      writeOnboardingFormBackup({
        phone,
        step1,
        step2,
        step3,
        step4,
        currentStep: step,
        timestamp: Date.now(),
      })
    }, 250)

    return () => clearTimeout(timer)
  }, [loading, verifiedPhoneNumber, step, step1, step2, step3, step4])

  const handleUpload = async (file, folder) => {
    try {
      // Uploading is done on final registration submit (multipart /register).
      // Keep this method for backward compatibility in case other flows call it.
      throw new Error("Image uploads are submitted during registration")
    } catch (err) {
      // Provide more informative error message for upload failures
      const errorMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to upload image"
      debugError("Upload error:", errorMsg, err)
      throw new Error(`Image upload failed: ${errorMsg}`)
    }
  }

  const requiresOnboardingFee =
    Boolean(feeConfig?.isActive && Number(feeConfig?.price) > 0 && !isReonboardBypass)

  const getMergedStepsForSubmit = () => {
    const draft = onboardingDraftRef.current
    const draftLocation = draft?.location || {}

    const mergedStep1 = {
      ...step1,
      restaurantName: pickNonEmpty(step1.restaurantName, draft?.restaurantName, draft?.name),
      pureVegRestaurant:
        typeof step1.pureVegRestaurant === "boolean"
          ? step1.pureVegRestaurant
          : (typeof draft?.pureVegRestaurant === "boolean" ? draft.pureVegRestaurant : false),
      ownerName: pickNonEmpty(step1.ownerName, draft?.ownerName),
      ownerEmail: pickNonEmpty(step1.ownerEmail, draft?.ownerEmail),
      ownerPhone: pickNonEmpty(step1.ownerPhone, draft?.ownerPhone, verifiedPhoneNumber),
      primaryContactNumber: pickNonEmpty(step1.primaryContactNumber, draft?.primaryContactNumber),
      zoneId: pickNonEmpty(normalizeZoneIdValue(step1.zoneId), normalizeZoneIdValue(draft?.zoneId)),
      location: {
        ...step1.location,
        formattedAddress: pickNonEmpty(step1.location?.formattedAddress, draftLocation.formattedAddress),
        addressLine1: pickNonEmpty(step1.location?.addressLine1, draftLocation.addressLine1),
        addressLine2: pickNonEmpty(step1.location?.addressLine2, draftLocation.addressLine2),
        area: pickNonEmpty(step1.location?.area, draftLocation.area),
        city: pickNonEmpty(step1.location?.city, draftLocation.city),
        state: pickNonEmpty(step1.location?.state, draftLocation.state),
        pincode: pickNonEmpty(step1.location?.pincode, draftLocation.pincode),
        landmark: pickNonEmpty(step1.location?.landmark, draftLocation.landmark),
        latitude: pickNonEmpty(step1.location?.latitude, draftLocation.latitude),
        longitude: pickNonEmpty(step1.location?.longitude, draftLocation.longitude),
      },
    }

    const mergedStep2 = {
      ...step2,
      cuisines: (step2.cuisines?.length ? step2.cuisines : draft?.cuisines) || [],
      openingTime: pickNonEmpty(step2.openingTime, draft?.openingTime),
      closingTime: pickNonEmpty(step2.closingTime, draft?.closingTime),
      openDays: (step2.openDays?.length ? step2.openDays : draft?.openDays) || [],
      menuImages: (step2.menuImages?.length ? step2.menuImages : draft?.menuImages) || [],
      profileImage: step2.profileImage || draft?.profileImage || null,
    }

    const mergedStep3 = {
      ...step3,
      panNumber: pickNonEmpty(step3.panNumber, draft?.panNumber),
      nameOnPan: pickNonEmpty(step3.nameOnPan, draft?.nameOnPan),
      panImage: step3.panImage || draft?.panImage || null,
      gstRegistered: typeof step3.gstRegistered === "boolean" ? step3.gstRegistered : !!draft?.gstRegistered,
      gstNumber: pickNonEmpty(step3.gstNumber, draft?.gstNumber),
      gstLegalName: pickNonEmpty(step3.gstLegalName, draft?.gstLegalName),
      gstAddress: pickNonEmpty(step3.gstAddress, draft?.gstAddress),
      gstImage: step3.gstImage || draft?.gstImage || null,
      fssaiNumber: pickNonEmpty(step3.fssaiNumber, draft?.fssaiNumber),
      fssaiExpiry: pickNonEmpty(
        step3.fssaiExpiry,
        draft?.fssaiExpiry ? String(draft.fssaiExpiry).split("T")[0] : "",
      ),
      fssaiImage: step3.fssaiImage || draft?.fssaiImage || null,
      accountNumber: pickNonEmpty(step3.accountNumber, draft?.accountNumber),
      ifscCode: pickNonEmpty(step3.ifscCode, draft?.ifscCode),
      accountHolderName: pickNonEmpty(step3.accountHolderName, draft?.accountHolderName),
      accountType: normalizeAccountTypeValue(pickNonEmpty(step3.accountType, draft?.accountType)),
    }

    return { mergedStep1, mergedStep2, mergedStep3 }
  }

  const handleNext = async () => {
    if (saving || paymentInProgress || paymentFlowInProgressRef.current) {
      return
    }
    console.log("NEXT CLICKED")
    setError("")

    let validationErrors = {}
    if (step === 1) {
      validationErrors = validateOnboardingStep1(step1, zones)
    } else if (step === 2) {
      validationErrors = validateOnboardingStep2(step2)
    } else if (step === 3) {
      validationErrors = validateOnboardingStep3(step3, getTodayLocalYMD)
    } else if (step === 4) {
      validationErrors = validateOnboardingStep4(step4)
    }

    const errorKeys = Object.keys(validationErrors)
    if (errorKeys.length > 0) {
      setFieldErrors(validationErrors)
      scrollOnboardingToTop()
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      if (step === 1) {
        const formData = buildOnboardingStepFormData(1, { step1, step2, step3 })
        await restaurantAPI.saveOnboardingStep(1, formData)
        goToStep(2)
      } else if (step === 2) {
        const formData = buildOnboardingStepFormData(2, { step1, step2, step3 })
        await restaurantAPI.saveOnboardingStep(2, formData)
        goToStep(3)
      } else if (step === 3) {
        const formData = buildOnboardingStepFormData(3, { step1, step2, step3 })
        await restaurantAPI.saveOnboardingStep(3, formData)
        goToStep(4)
      } else if (step === 4) {
        const { mergedStep1, mergedStep2, mergedStep3 } = getMergedStepsForSubmit()

        if (!mergedStep1.restaurantName?.trim()) {
          throw new Error("Restaurant name is required")
        }

        // Final submit: create restaurant in DB using backend multipart endpoint.
        const formData = new FormData()

        // Step 1
        formData.append("restaurantName", mergedStep1.restaurantName || "")
        formData.append(
          "pureVegRestaurant",
          mergedStep1.pureVegRestaurant === true ? "true" : "false",
        )
        formData.append("businessType", mergedStep1.businessType === "Street Food Vendor" ? "Street Food Vendor" : "Fixed Restaurant")
        formData.append("ownerName", mergedStep1.ownerName || "")
        formData.append("ownerEmail", (mergedStep1.ownerEmail || "").trim())
        formData.append("ownerPhone", normalizePhoneDigits(mergedStep1.ownerPhone))
        formData.append("primaryContactNumber", normalizePhoneDigits(mergedStep1.primaryContactNumber))
        formData.append("zoneId", mergedStep1.zoneId || "")
        formData.append("addressLine1", mergedStep1.location?.addressLine1 || "")
        formData.append("addressLine2", mergedStep1.location?.addressLine2 || "")
        formData.append("area", mergedStep1.location?.area || "")
        formData.append("city", mergedStep1.location?.city || "")
        formData.append("state", mergedStep1.location?.state || "")
        formData.append("pincode", mergedStep1.location?.pincode || "")
        formData.append("landmark", mergedStep1.location?.landmark || "")
        formData.append("formattedAddress", mergedStep1.location?.formattedAddress || "")
        formData.append("latitude", String(mergedStep1.location?.latitude || ""))
        formData.append("longitude", String(mergedStep1.location?.longitude || ""))
        formData.append("ref", mergedStep1.ref || "")

        // Step 2
        formData.append("cuisines", (mergedStep2.cuisines || []).join(","))
        formData.append("openingTime", normalizeTimeValue(mergedStep2.openingTime) || "")
        formData.append("closingTime", normalizeTimeValue(mergedStep2.closingTime) || "")
        formData.append("openDays", (mergedStep2.openDays || []).join(","))

        const menuFiles = (mergedStep2.menuImages || []).filter((f) => isUploadableFile(f))
        const hasExistingMenuImages = (mergedStep2.menuImages || []).some(hasValidMenuImageAsset)
        if (menuFiles.length === 0 && !hasExistingMenuImages) {
          throw new Error("At least one menu image must be uploaded")
        }
        menuFiles.forEach((file) => formData.append("menuImages", file))

        if (isUploadableFile(mergedStep2.profileImage)) {
          formData.append("profileImage", mergedStep2.profileImage)
        } else if (!hasValidImageAsset(mergedStep2.profileImage)) {
          throw new Error("Restaurant profile image is required")
        }

        // Step 3
        formData.append("panNumber", mergedStep3.panNumber || "")
        formData.append("nameOnPan", mergedStep3.nameOnPan || "")
        if (isUploadableFile(mergedStep3.panImage)) {
          formData.append("panImage", mergedStep3.panImage)
        } else if (!hasValidImageAsset(mergedStep3.panImage)) {
          throw new Error("PAN image is required")
        }

        formData.append("gstRegistered", mergedStep3.gstRegistered ? "true" : "false")
        if (mergedStep3.gstRegistered) {
          formData.append("gstNumber", mergedStep3.gstNumber || "")
          formData.append("gstLegalName", mergedStep3.gstLegalName || "")
          formData.append("gstAddress", mergedStep3.gstAddress || "")
          if (isUploadableFile(mergedStep3.gstImage)) {
            formData.append("gstImage", mergedStep3.gstImage)
          } else if (!hasValidImageAsset(mergedStep3.gstImage)) {
            throw new Error("GST image is required when GST registered")
          }
        }

        formData.append("fssaiNumber", mergedStep3.fssaiNumber || "")
        formData.append("fssaiExpiry", mergedStep3.fssaiExpiry || "")
        if (isUploadableFile(mergedStep3.fssaiImage)) {
          formData.append("fssaiImage", mergedStep3.fssaiImage)
        } else if (!hasValidImageAsset(mergedStep3.fssaiImage)) {
          throw new Error("FSSAI image is required")
        }

        const usesExistingAssets =
          (menuFiles.length === 0 && hasExistingMenuImages) ||
          (!isUploadableFile(mergedStep2.profileImage) && hasValidImageAsset(mergedStep2.profileImage)) ||
          (!isUploadableFile(mergedStep3.panImage) && hasValidImageAsset(mergedStep3.panImage)) ||
          (!isUploadableFile(mergedStep3.fssaiImage) && hasValidImageAsset(mergedStep3.fssaiImage)) ||
          (mergedStep3.gstRegistered && !isUploadableFile(mergedStep3.gstImage) && hasValidImageAsset(mergedStep3.gstImage))

        if (usesExistingAssets || onboardingDraftRef.current?.status === "onboarding") {
          formData.append("finalizeOnboarding", "true")
        }

        formData.append("accountNumber", mergedStep3.accountNumber || "")
        formData.append("ifscCode", (mergedStep3.ifscCode || "").toUpperCase())
        formData.append("accountHolderName", mergedStep3.accountHolderName || "")
        formData.append("accountType", mergedStep3.accountType || "")

        // Step 4
        formData.append("estimatedDeliveryTime", step4.estimatedDeliveryTime || "")

        // Check if onboarding fee config exists, is active, and is greater than 0
        if (requiresOnboardingFee) {
          const orderRes = await onboardingFeeAPI.createOrder({
            role: "RESTAURANT",
            name: mergedStep1.ownerName || mergedStep1.restaurantName,
            phone: normalizePhoneDigits(mergedStep1.ownerPhone),
            email: mergedStep1.ownerEmail || ""
          });
          const orderData = orderRes?.data?.data || orderRes?.data;

          if (!orderData || !orderData.orderId) {
            throw new Error("Failed to create onboarding payment order");
          }

          if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
            toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.");
            formData.append("razorpayOrderId", orderData.orderId);
            formData.append("razorpayPaymentId", `mock_pay_${Date.now()}`);
            formData.append("razorpaySignature", `mock_sig_${Date.now()}`);

            const registerResponse = await restaurantAPI.register(formData);
            await finishRegistrationAndGoPending(
              registerResponse,
              mergedStep1.ownerPhone,
              navigate,
            );
          } else {
            // Keep Next locked while Razorpay is open to prevent duplicate createOrder calls.
            paymentFlowInProgressRef.current = true
            setPaymentInProgress(true)
            const rzpOptions = {
              key: orderData.keyId,
              amount: Math.round(orderData.amount * 100),
              currency: orderData.currency || "INR",
              order_id: orderData.orderId,
              name: "Onboarding Fee Payment",
              description: `Onboarding fee for ${mergedStep1.restaurantName}`,
              prefill: {
                name: mergedStep1.ownerName || "",
                email: mergedStep1.ownerEmail || "",
                contact: normalizePhoneDigits(mergedStep1.ownerPhone)
              },
              handler: async (response) => {
                try {
                  setSaving(true);
                  formData.append("razorpayOrderId", response.razorpay_order_id);
                  formData.append("razorpayPaymentId", response.razorpay_payment_id);
                  formData.append("razorpaySignature", response.razorpay_signature);

                  const registerResponse = await restaurantAPI.register(formData);
                  await finishRegistrationAndGoPending(
                    registerResponse,
                    mergedStep1.ownerPhone,
                    navigate,
                  );
                } catch (err) {
                  const phoneError = getRestaurantPhoneFieldError(err)
                  if (phoneError) {
                    setFieldErrors((prev) => ({ ...prev, [phoneError.field]: phoneError.message }))
                    setError(phoneError.message)
                    toast.error(phoneError.message)
                    document.getElementById(`restaurant-field-${phoneError.field}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })
                    return
                  }
                  const msg =
                    err?.response?.data?.message ||
                    err?.response?.data?.error ||
                    err?.message ||
                    "Failed to save onboarding data";
                  setError(msg);
                  toast.error(msg);
                } finally {
                  paymentFlowInProgressRef.current = false
                  setPaymentInProgress(false)
                  setSaving(false);
                }
              },
              onError: (err) => {
                toast.error(err?.description || "Payment failed. Please try again.");
                setError(err?.description || "Payment failed");
                paymentFlowInProgressRef.current = false
                setPaymentInProgress(false)
                setSaving(false);
              },
              onClose: () => {
                toast.error("Payment modal closed. Payment is required to complete onboarding.");
                paymentFlowInProgressRef.current = false
                setPaymentInProgress(false)
                setSaving(false);
              }
            };
            await initRazorpayPayment(rzpOptions);
          }
        } else {
          const registerResponse = await restaurantAPI.register(formData);
          await finishRegistrationAndGoPending(
            registerResponse,
            mergedStep1.ownerPhone,
            navigate,
          );
        }
      }
    } catch (err) {
      const phoneError = getRestaurantPhoneFieldError(err)
      if (phoneError) {
        setFieldErrors((prev) => ({ ...prev, [phoneError.field]: phoneError.message }))
        setError(phoneError.message)
        toast.error(phoneError.message)
        document.getElementById(`restaurant-field-${phoneError.field}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" })
        return
      }
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save onboarding data"
      setError(msg)
      toast.error(msg)
    } finally {
      // Do not unlock Next while Razorpay modal is still open.
      if (!paymentFlowInProgressRef.current) {
        setSaving(false)
      }
    }
  }



  const toggleDay = (day) => {
    clearFieldError("openDays")
    setStep2((prev) => {
      const exists = prev.openDays.includes(day)
      if (exists) {
        return { ...prev, openDays: prev.openDays.filter((d) => d !== day) }
      }
      return { ...prev, openDays: [...prev.openDays, day] }
    })
  }

  const handleZoneChange = (newZoneId) => {
    clearFieldError("zoneId")
    clearFieldError("locationPin")
    const selectedZone = zones.find((z) => String(z._id || z.id) === String(newZoneId))
    setStep1((prev) => ({
      ...prev,
      zoneId: newZoneId,
      zoneName: getZoneDisplayName(selectedZone),
      location: {
        formattedAddress: "",
        addressLine1: "",
        addressLine2: "",
        area: "",
        city: "",
        state: "",
        pincode: "",
        landmark: "",
        latitude: "",
        longitude: "",
      },
    }))
  }

  const handleLocationChange = (payload) => {
    clearFieldError("locationPin")
    clearFieldError("addressLine1")
    clearFieldError("area")
    clearFieldError("city")
    clearFieldError("pincode")
    if (payload?.outsideZone) {
      setStep1((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          latitude: "",
          longitude: "",
          formattedAddress: "",
        },
      }))
      return
    }

    setStep1((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        formattedAddress: payload.formattedAddress ?? prev.location.formattedAddress,
        addressLine1: payload.addressLine1 ?? prev.location.addressLine1,
        area: payload.area ?? prev.location.area,
        city: payload.city ?? prev.location.city,
        state: payload.state ?? prev.location.state,
        pincode: payload.pincode ?? prev.location.pincode,
        latitude: payload.latitude ?? prev.location.latitude,
        longitude: payload.longitude ?? prev.location.longitude,
      },
    }))
  }

  const renderStep1 = () => (
    <div className="space-y-5 lg:space-y-6">
      <section className={ONBOARDING_SECTION}>
        <h2 className={ONBOARDING_SECTION_TITLE}>Restaurant information</h2>
        <div className="space-y-4">
          <div>
            <Label className={ONBOARDING_LABEL}>Restaurant name*</Label>
            <Input
              value={step1.restaurantName || ""}
              onChange={(e) => {
                clearFieldError("restaurantName")
                const val = e.target.value.replace(/[^A-Za-z ]/g, "")
                setStep1({ ...step1, restaurantName: val })
              }}
              className={inputCls("restaurantName")}
              placeholder="Customers will see this name"
              disabled={!isEditing}
            />
            <FieldErrorMsg message={fieldErrors.restaurantName} />
          </div>
          <div>
            <Label className={ONBOARDING_LABEL}>Pure veg restaurant?*</Label>
            <div className={`mt-2.5 flex flex-wrap items-center gap-2 ${fieldErrors.pureVegRestaurant ? "rounded-xl ring-2 ring-red-200 p-1" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  if (!isEditing) return
                  clearFieldError("pureVegRestaurant")
                  setStep1({ ...step1, pureVegRestaurant: true })
                }}
                className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  step1.pureVegRestaurant === true
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                    : ONBOARDING_CHIP_INACTIVE
                } ${!isEditing ? "cursor-not-allowed opacity-70" : ""}`}
              >
                Yes, Pure Veg
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isEditing) return
                  clearFieldError("pureVegRestaurant")
                  setStep1({ ...step1, pureVegRestaurant: false })
                }}
                className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  step1.pureVegRestaurant === false
                    ? ONBOARDING_CHIP_ACTIVE
                    : ONBOARDING_CHIP_INACTIVE
                } ${!isEditing ? "cursor-not-allowed opacity-70" : ""}`}
              >
                No, Mixed Menu
              </button>
            </div>
            <FieldErrorMsg message={fieldErrors.pureVegRestaurant} />
            <p className={`${ONBOARDING_HINT} mt-2`}>
              This helps users filter restaurants by dietary preference.
            </p>
          </div>
          <div>
            <Label className={ONBOARDING_LABEL}>Business Type*</Label>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isEditing) return
                  setStep1({ ...step1, businessType: "Fixed Restaurant" })
                }}
                className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  (step1.businessType || "Fixed Restaurant") === "Fixed Restaurant"
                    ? ONBOARDING_CHIP_ACTIVE
                    : ONBOARDING_CHIP_INACTIVE
                } ${!isEditing ? "cursor-not-allowed opacity-70" : ""}`}
              >
                Fixed Restaurant
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isEditing) return
                  setStep1({ ...step1, businessType: "Street Food Vendor" })
                }}
                className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                  step1.businessType === "Street Food Vendor"
                    ? ONBOARDING_CHIP_ACTIVE
                    : ONBOARDING_CHIP_INACTIVE
                } ${!isEditing ? "cursor-not-allowed opacity-70" : ""}`}
              >
                Street Food Vendor
              </button>
            </div>
            <p className={`${ONBOARDING_HINT} mt-2`}>
              Street Food Vendors get access to live location broadcasting after approval.
            </p>
          </div>
        </div>
      </section>

      <section className={ONBOARDING_SECTION}>
        <h2 className={ONBOARDING_SECTION_TITLE}>Owner details</h2>
        <p className={ONBOARDING_SECTION_DESC}>
          These details will be used for all business communications and updates.
        </p>
        <div className="space-y-4">
          <div>
            <Label className={ONBOARDING_LABEL}>Full name*</Label>
            <Input
              value={step1.ownerName || ""}
              onChange={(e) => {
                clearFieldError("ownerName")
                const val = e.target.value.replace(/[^A-Za-z ]/g, "")
                setStep1({ ...step1, ownerName: val })
              }}
              className={inputCls("ownerName")}
              placeholder="Owner full name"
              disabled={!isEditing}
            />
            <FieldErrorMsg message={fieldErrors.ownerName} />
          </div>
          <div>
            <Label className={ONBOARDING_LABEL}>Email address*</Label>
            <Input
              type="email"
              value={step1.ownerEmail || ""}
              onChange={(e) => {
                clearFieldError("ownerEmail")
                setStep1({ ...step1, ownerEmail: e.target.value })
              }}
              onBlur={(e) =>
                setStep1((prev) => ({
                  ...prev,
                  ownerEmail: String(e.target.value || "").trim().toLowerCase(),
                }))
              }
              className={inputCls("ownerEmail")}
              placeholder="owner@example.com"
              inputMode="email"
              pattern={OWNER_EMAIL_REGEX.source}
              disabled={!isEditing}
            />
            <FieldErrorMsg message={fieldErrors.ownerEmail} />
          </div>
          <div>
            <Label className={ONBOARDING_LABEL}>Phone number*</Label>
            <Input
              id="restaurant-field-ownerPhone"
              data-restaurant-field="ownerPhone"
              type="tel"
              value={
                step1.ownerPhone ||
                verifiedPhoneNumber ||
                getVerifiedPhoneFromStoredRestaurant() ||
                ""
              }
              readOnly={Boolean(
                verifiedPhoneNumber || getVerifiedPhoneFromStoredRestaurant(),
              )}
              maxLength={10}
              className={`mt-1.5 text-sm ${
                fieldErrors.ownerPhone
                  ? "border-red-400 ring-2 ring-red-200"
                  : "cursor-not-allowed bg-slate-100 text-slate-700"
              }`}
              placeholder="Owner phone number"
              disabled={Boolean(
                verifiedPhoneNumber || getVerifiedPhoneFromStoredRestaurant(),
              )}
            />
            <FieldErrorMsg message={fieldErrors.ownerPhone} />
            {verifiedPhoneNumber || getVerifiedPhoneFromStoredRestaurant() ? (
              <p className={`${ONBOARDING_HINT} mt-2`}>
                This is your OTP-verified number and cannot be changed.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>Restaurant contact & location</h2>
        <div>
          <Label className={ONBOARDING_LABEL}>Primary contact number*</Label>
          <Input
            id="restaurant-field-primaryContactNumber"
            data-restaurant-field="primaryContactNumber"
            type="tel"
            value={step1.primaryContactNumber || ""}
            onChange={(e) => {
              clearFieldError("primaryContactNumber")
              const val = e.target.value.replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, primaryContactNumber: val })
            }}
            onKeyDown={(e) => {
              const allowed = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"]
              if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault()
              if (/^\d$/.test(e.key) && (step1.primaryContactNumber || "").length >= 10) e.preventDefault()
            }}
            onPaste={(e) => {
              e.preventDefault()
              clearFieldError("primaryContactNumber")
              const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10)
              setStep1({ ...step1, primaryContactNumber: pasted })
            }}
            maxLength={10}
            inputMode="numeric"
            className={inputCls("primaryContactNumber")}
            placeholder="Primary contact number (10 digits)"
            disabled={!isEditing}
          />
          <FieldErrorMsg message={fieldErrors.primaryContactNumber} />
          <p className={`${ONBOARDING_HINT} mt-2`}>
            Customers, delivery partners and {companyName} may call on this number for order
            support.
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-medium text-slate-700">
            Add your restaurant's location for order pick-up.
          </p>
          <OnboardingLocationSection
            zoneId={step1.zoneId}
            zones={zones}
            zonesLoading={zonesLoading}
            isEditing={isEditing}
            location={step1.location}
            onZoneChange={handleZoneChange}
            onLocationChange={handleLocationChange}
            zoneError={fieldErrors.zoneId}
            locationError={fieldErrors.locationPin}
          />
          <Input
            value={step1.location?.addressLine1 || ""}
            onChange={(e) => {
              clearFieldError("addressLine1")
              setStep1({
                ...step1,
                location: { ...step1.location, addressLine1: e.target.value },
              })
            }}
            className={inputCls("addressLine1")}
            placeholder="Shop no. / building no. (optional)"
          />
          <FieldErrorMsg message={fieldErrors.addressLine1} />
          <Input
            value={step1.location?.addressLine2 || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, addressLine2: e.target.value },
              })
            }
            className={ONBOARDING_INPUT}
            placeholder="Floor / tower (optional)"
          />
          <Input
            value={step1.location?.landmark || ""}
            onChange={(e) =>
              setStep1({
                ...step1,
                location: { ...step1.location, landmark: e.target.value },
              })
            }
            className={ONBOARDING_INPUT}
            placeholder="Nearby landmark (optional)"
          />
          <Input
            value={step1.location?.area || ""}
            onChange={(e) => {
              clearFieldError("area")
              setStep1({
                ...step1,
                location: { ...step1.location, area: e.target.value },
              })
            }}
            className={inputCls("area")}
            placeholder="Area / Sector / Locality*"
          />
          <FieldErrorMsg message={fieldErrors.area} />
          <Input
            value={step1.location?.city || ""}
            onChange={(e) => {
              clearFieldError("city")
              setStep1({
                ...step1,
                location: { ...step1.location, city: e.target.value.replace(/[^A-Za-z ]/g, "") },
              })
            }}
            className={inputCls("city")}
            placeholder="City"
          />
          <FieldErrorMsg message={fieldErrors.city} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              value={step1.location?.state || ""}
              onChange={(e) =>
                setStep1({
                  ...step1,
                  location: { ...step1.location, state: e.target.value.replace(/[^A-Za-z ]/g, "") },
                })
              }
              className={ONBOARDING_INPUT}
              placeholder="State"
            />
            <Input
              value={step1.location?.pincode || ""}
              onChange={(e) => {
                clearFieldError("pincode")
                setStep1({
                  ...step1,
                  location: { ...step1.location, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) },
                })
              }}
              className={inputCls("pincode")}
              placeholder="Pincode"
            />
          </div>
          <FieldErrorMsg message={fieldErrors.pincode} />
          <p className={ONBOARDING_HINT}>
            Please ensure that this address is the same as mentioned on your FSSAI license.
          </p>
        </div>
      </section>
    </div>
  )

  // Load zones once on mount so step 4 summary can resolve the selected zone name.
  useEffect(() => {
    let cancelled = false
    setZonesLoading(true)
    zoneAPI.getPublicZones()
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
    return () => { cancelled = true }
  }, [])

  // Backfill zone name when zones load after zoneId was restored from draft/local storage.
  useEffect(() => {
    if (!step1.zoneId?.trim() || step1.zoneName?.trim() || zones.length === 0) return
    const selectedZone = zones.find((z) => String(z._id || z.id) === String(step1.zoneId))
    const resolvedName = getZoneDisplayName(selectedZone)
    if (resolvedName) {
      setStep1((prev) => ({ ...prev, zoneName: resolvedName }))
    }
  }, [zones, step1.zoneId, step1.zoneName])

  const renderStep2 = () => (
    <div className="space-y-5 lg:space-y-6">
      <section className={`${ONBOARDING_SECTION} space-y-5`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>Menu & photos</h2>
        <p className={ONBOARDING_HINT}>
          Add clear photos of your printed menu and a primary profile image. This helps customers
          understand what you serve.
        </p>

        <div className="space-y-2">
          <Label className={ONBOARDING_LABEL}>Menu images</Label>
          <div className={`mt-1 flex flex-col items-center justify-between gap-4 rounded-xl border-2 border-dashed px-4 py-5 sm:flex-row ${
            fieldErrors.menuImages
              ? "border-red-300 bg-red-50/40"
              : "border-slate-200 bg-slate-50/70"
          }`}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
                <ImageIcon className="h-5 w-5 text-[#FF0000]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-900">Upload menu images</span>
                <span className={ONBOARDING_HINT}>
                  JPG, PNG, WebP — You can select multiple files
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer rounded-full border-slate-200 text-xs sm:w-auto"
              onClick={() =>
                openOnboardingImagePicker({
                  title: "Add menu image",
                  fallbackInputRef: menuImagesInputRef,
                  fileNamePrefix: "menu-image",
                  onSelectFile: (file) => {
                    clearFieldError("menuImages")
                    setStep2((prev) => ({
                      ...prev,
                      menuImages: [...(prev.menuImages || []), file],
                    }))
                  },
                })
              }
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
            <input
              id="menuImagesInput"
              type="file"
              multiple
              accept={LOCAL_IMAGE_FILE_ACCEPT}
              className="hidden"
              ref={menuImagesInputRef}
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (!files.length) return
                clearFieldError("menuImages")
                debugLog('?? Menu images selected:', files.length, 'files')
                setStep2((prev) => ({
                  ...prev,
                  menuImages: [...(prev.menuImages || []), ...files], // Append new files to existing ones
                }))
                // Reset input to allow selecting same file again
                e.target.value = ''
              }}
            />
          </div>
          <FieldErrorMsg message={fieldErrors.menuImages} />

          {/* Menu image previews */}
          {!!step2.menuImages.length && (
            <div className="mt-2 grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {step2.menuImages.map((file, idx) => {
                // Handle both File objects and URL objects
                let imageUrl = null
                let imageName = `Image ${idx + 1}`

                if (isUploadableFile(file)) {
                  imageUrl = getPreviewImageUrl(file)
                  imageName = file.name || imageName
                } else if (file?.url) {
                  // If it's an object with url property (from backend)
                  imageUrl = file.url
                  imageName = file.name || `Image ${idx + 1}`
                } else if (typeof file === 'string') {
                  // If it's a direct URL string
                  imageUrl = file
                }

                return (
                  <div
                    key={idx}
                    className="relative aspect-square overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200"
                  >
                    <div className="absolute right-1 top-1 z-30">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setStep2((prev) => ({
                            ...prev,
                            menuImages: prev.menuImages.filter((_, i) => i !== idx),
                          }));
                        }}
                        className="cursor-pointer rounded-full bg-red-500 p-1.5 text-white shadow-md transition-colors hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={`Menu ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-500 px-2 text-center">
                        Preview unavailable
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                      <p className="text-[10px] text-white truncate">
                        {imageName}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Profile image */}
        <div className={`space-y-2 ${fieldErrors.profileImage ? "rounded-xl ring-2 ring-red-200 p-2" : ""}`}>
          <Label className={ONBOARDING_LABEL}>Restaurant profile image</Label>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-sm lg:h-16 lg:w-16">
                {step2.profileImage ? (
                  (() => {
                    const imageSrc = getPreviewImageUrl(step2.profileImage)

                    return imageSrc ? (
                      <img
                        src={imageSrc}
                        alt="Restaurant profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-gray-500" />
                    );
                  })()
                ) : (
                  <ImageIcon className="w-6 h-6 text-gray-500" />
                )}
              </div>
              {step2.profileImage && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStep2((prev) => ({
                      ...prev,
                      profileImage: null,
                    }));
                  }}
                  className="absolute -right-1 -top-1 z-10 cursor-pointer rounded-full bg-red-500 p-1 text-white shadow-md transition-colors hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900">Upload profile image</span>
                <span className={ONBOARDING_HINT}>
                  This will be shown on your listing card and restaurant page.
                </span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full cursor-pointer rounded-full border-slate-200 text-xs"
            onClick={() =>
              openOnboardingImagePicker({
                title: "Upload profile image",
                fallbackInputRef: profileImageInputRef,
                fileNamePrefix: "restaurant-profile",
                onSelectFile: (file) => {
                  clearFieldError("profileImage")
                  setStep2((prev) => ({
                    ...prev,
                    profileImage: file,
                  }))
                },
              })
            }
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          <input
            id="profileImageInput"
            type="file"
            accept={LOCAL_IMAGE_FILE_ACCEPT}
            className="hidden"
            ref={profileImageInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                clearFieldError("profileImage")
                debugLog('?? Profile image selected:', file.name)
                setStep2((prev) => ({
                  ...prev,
                  profileImage: file,
                }))
              }
              // Reset input to allow selecting same file again
              e.target.value = ''
            }}
          />
          <FieldErrorMsg message={fieldErrors.profileImage} />
        </div>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-5`}>
        <div className="space-y-3">
          <Label className={ONBOARDING_LABEL}>Delivery timings</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimeSelector
              label="Opening time"
              value={step2.openingTime || ""}
              hasError={Boolean(fieldErrors.openingTime)}
              onChange={(val) => {
                clearFieldError("openingTime")
                setStep2((prev) => ({ ...prev, openingTime: normalizeTimeValue(val) || "" }))
              }}
            />
            <TimeSelector
              label="Closing time"
              value={step2.closingTime || ""}
              hasError={Boolean(fieldErrors.closingTime)}
              onChange={(val) => {
                clearFieldError("closingTime")
                setStep2((prev) => ({ ...prev, closingTime: normalizeTimeValue(val) || "" }))
              }}
            />
          </div>
          <FieldErrorMsg message={fieldErrors.openingTime || fieldErrors.closingTime} />
        </div>

        {/* Open days in a calendar-like grid */}
        <div className="space-y-2">
          <Label className={`${ONBOARDING_LABEL} flex items-center gap-1.5`}>
            <CalendarIcon className="h-3.5 w-3.5 text-[#FF0000]" />
            <span>Open days</span>
          </Label>
          <p className={ONBOARDING_HINT}>
            Select the days your restaurant accepts delivery orders.
          </p>
          <div className={`mt-2 grid grid-cols-7 gap-1.5 sm:gap-2 ${
            fieldErrors.openDays ? "rounded-xl p-1 ring-2 ring-red-200" : ""
          }`}>
            {daysOfWeek.map((day) => {
              const active = step2.openDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border text-[11px] font-semibold transition-all duration-200 ${
                    active ? ONBOARDING_DAY_ACTIVE : ONBOARDING_DAY_INACTIVE
                  }`}
                >
                  {day.charAt(0)}
                </button>
              )
            })}
          </div>
          <FieldErrorMsg message={fieldErrors.openDays} />
        </div>
      </section>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-5 lg:space-y-6">
      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>PAN details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className={ONBOARDING_LABEL}>PAN number</Label>
            <Input
              value={step3.panNumber || ""}
              onChange={(e) => {
                clearFieldError("panNumber")
                const normalized = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 10)
                setStep3({ ...step3, panNumber: normalized })
              }}
              className={inputCls("panNumber")}
              placeholder="ABCDE1234F"
            />
            <FieldErrorMsg message={fieldErrors.panNumber} />
          </div>
          <div>
            <Label className={ONBOARDING_LABEL}>PAN Card Holder Name</Label>
            <Input
              value={step3.nameOnPan || ""}
              onChange={(e) => {
                clearFieldError("nameOnPan")
                setStep3({
                  ...step3,
                  nameOnPan: e.target.value.replace(/[^A-Za-z ]/g, ""),
                })
              }}
              className={inputCls("nameOnPan")}
              placeholder="Name as printed on PAN card"
            />
            <FieldErrorMsg message={fieldErrors.nameOnPan} />
          </div>
        </div>
        <div className={fieldErrors.panImage ? "rounded-xl ring-2 ring-red-200 p-2" : ""}>
          <Label className={ONBOARDING_LABEL}>PAN image</Label>
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full cursor-pointer rounded-full border-slate-200 text-xs"
            onClick={() =>
              openOnboardingImagePicker({
                title: "Upload PAN image",
                fallbackInputRef: panImageInputRef,
                fileNamePrefix: "pan-image",
                onSelectFile: (file) => {
                  clearFieldError("panImage")
                  setStep3((prev) => ({ ...prev, panImage: file }))
                },
              })
            }
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Upload
          </Button>
          <input
            type="file"
            accept={GALLERY_IMAGE_ACCEPT}
            className="hidden"
            ref={panImageInputRef}
            onChange={(e) => {
              clearFieldError("panImage")
              setStep3((prev) => ({ ...prev, panImage: e.target.files?.[0] || null }))
            }}
          />
          {step3.panImage && (
            <div className={ONBOARDING_DOC_PREVIEW}>
              {getPreviewImageUrl(step3.panImage) ? (
                <img
                  src={getPreviewImageUrl(step3.panImage)}
                  alt="PAN document"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  Preview unavailable
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setStep3((prev) => ({ ...prev, panImage: null }))
                }}
                className="absolute right-2 top-2 cursor-pointer rounded-full bg-red-500 p-1 shadow-md transition-colors hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <FieldErrorMsg message={fieldErrors.panImage} />
        </div>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>GST details</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">GST registered?</span>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: true })}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              step3.gstRegistered ? ONBOARDING_CHIP_ACTIVE : ONBOARDING_CHIP_INACTIVE
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setStep3({ ...step3, gstRegistered: false })}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              !step3.gstRegistered ? ONBOARDING_CHIP_ACTIVE : ONBOARDING_CHIP_INACTIVE
            }`}
          >
            No
          </button>
        </div>
        {step3.gstRegistered && (
          <div className="space-y-3">
            <Input
              value={step3.gstNumber || ""}
              onChange={(e) => {
                clearFieldError("gstNumber")
                setStep3({
                  ...step3,
                  gstNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15),
                })
              }}
              className={inputCls("gstNumber")}
              placeholder="GST number (15 characters)"
            />
            <FieldErrorMsg message={fieldErrors.gstNumber} />
            <Input
              value={step3.gstLegalName || ""}
              onChange={(e) => {
                clearFieldError("gstLegalName")
                setStep3({
                  ...step3,
                  gstLegalName: e.target.value.replace(/[^A-Za-z ]/g, ""),
                })
              }}
              className={inputCls("gstLegalName")}
              placeholder="Legal name"
            />
            <FieldErrorMsg message={fieldErrors.gstLegalName} />
            <Input
              value={step3.gstAddress || ""}
              onChange={(e) => {
                clearFieldError("gstAddress")
                setStep3({ ...step3, gstAddress: e.target.value })
              }}
              className={inputCls("gstAddress")}
              placeholder="Registered address"
            />
            <FieldErrorMsg message={fieldErrors.gstAddress} />
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer rounded-full border-slate-200 text-xs"
              onClick={() =>
                openOnboardingImagePicker({
                  title: "Upload GST certificate",
                  fallbackInputRef: gstImageInputRef,
                  fileNamePrefix: "gst-image",
                  onSelectFile: (file) => {
                    clearFieldError("gstImage")
                    setStep3((prev) => ({ ...prev, gstImage: file }))
                  },
                })
              }
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
            <input
              type="file"
              accept={GALLERY_IMAGE_ACCEPT}
              className="hidden"
              ref={gstImageInputRef}
              onChange={(e) => {
                clearFieldError("gstImage")
                setStep3((prev) => ({ ...prev, gstImage: e.target.files?.[0] || null }))
              }}
            />
            {step3.gstImage && (
              <div className={ONBOARDING_DOC_PREVIEW}>
                {getPreviewImageUrl(step3.gstImage) ? (
                  <img
                    src={getPreviewImageUrl(step3.gstImage)}
                    alt="GST document"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                    Preview unavailable
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setStep3((prev) => ({ ...prev, gstImage: null }))
                  }}
                  className="absolute right-2 top-2 cursor-pointer rounded-full bg-red-500 p-1 shadow-md transition-colors hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <FieldErrorMsg message={fieldErrors.gstImage} />
          </div>
        )}
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>FSSAI details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className={ONBOARDING_LABEL}>FSSAI number</Label>
            <Input
              value={step3.fssaiNumber || ""}
              onChange={(e) => {
                clearFieldError("fssaiNumber")
                setStep3({ ...step3, fssaiNumber: e.target.value.replace(/\D/g, "").slice(0, 14) })
              }}
              className={inputCls("fssaiNumber")}
              placeholder="FSSAI number (14 digits)"
            />
            <FieldErrorMsg message={fieldErrors.fssaiNumber} />
          </div>
          <div>
            <Label className={`${ONBOARDING_LABEL} mb-1 block`}>FSSAI expiry date</Label>
            <Popover open={isFssaiCalendarOpen} onOpenChange={setIsFssaiCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsFssaiCalendarOpen(true)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl border bg-slate-50/80 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 ${
                    fieldErrors.fssaiExpiry
                      ? "border-red-400 ring-2 ring-red-200 focus-visible:ring-red-300"
                      : "border-slate-200 focus-visible:ring-[#FF0000]/20"
                  }`}
                >
                  <span className={step3.fssaiExpiry ? "text-slate-900" : "text-slate-500"}>
                    {step3.fssaiExpiry
                      ? parseLocalYMDDate(step3.fssaiExpiry)?.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                      : "Select expiry date"}
                  </span>
                  <CalendarIcon className="h-4 w-4 text-[#FF0000]" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-100" align="start">
                <div className="bg-white rounded-md shadow-lg border border-gray-200">
                  <Calendar
                    mode="single"
                    selected={parseLocalYMDDate(step3.fssaiExpiry)}
                    disabled={(date) => formatDateToLocalYMD(date) < getTodayLocalYMD()}
                    onSelect={(date) => {
                      if (date && formatDateToLocalYMD(date) >= getTodayLocalYMD()) {
                        clearFieldError("fssaiExpiry")
                        const formattedDate = formatDateToLocalYMD(date)
                        setStep3({ ...step3, fssaiExpiry: formattedDate })
                        setIsFssaiCalendarOpen(false)
                      }
                    }}
                    initialFocus
                    classNames={{
                      today: "bg-transparent text-foreground border-none", // Remove today highlight
                    }}
                  />
                </div>
              </PopoverContent>
            </Popover>
            <FieldErrorMsg message={fieldErrors.fssaiExpiry} />
          </div>
        </div>
        <div className={fieldErrors.fssaiImage ? "rounded-xl ring-2 ring-red-200 p-2" : ""}>
        <Button
          type="button"
          variant="outline"
          className="w-full cursor-pointer rounded-full border-slate-200 text-xs"
          onClick={() =>
            openOnboardingImagePicker({
              title: "Upload FSSAI image",
              fallbackInputRef: fssaiImageInputRef,
              fileNamePrefix: "fssai-image",
              onSelectFile: (file) => {
                clearFieldError("fssaiImage")
                setStep3((prev) => ({ ...prev, fssaiImage: file }))
              },
            })
          }
        >
          <Upload className="w-4 h-4 mr-1.5" />
          Upload
        </Button>
        <input
          type="file"
          accept={GALLERY_IMAGE_ACCEPT}
          className="hidden"
          ref={fssaiImageInputRef}
          onChange={(e) => {
            clearFieldError("fssaiImage")
            setStep3((prev) => ({ ...prev, fssaiImage: e.target.files?.[0] || null }))
          }}
        />
        {step3.fssaiImage && (
          <div className={ONBOARDING_DOC_PREVIEW}>
            {getPreviewImageUrl(step3.fssaiImage) ? (
              <img
                src={getPreviewImageUrl(step3.fssaiImage)}
                alt="FSSAI document"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                Preview unavailable
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setStep3((prev) => ({ ...prev, fssaiImage: null }))
              }}
              className="absolute right-2 top-2 cursor-pointer rounded-full bg-red-500 p-1 text-white shadow-md transition-colors hover:bg-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        <FieldErrorMsg message={fieldErrors.fssaiImage} />
        </div>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>Bank account details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
          <Input
            value={step3.accountNumber || ""}
            onChange={(e) => {
              clearFieldError("accountNumber")
              setStep3({ ...step3, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 18) })
            }}
            className={inputCls("accountNumber")}
            placeholder="Account number"
          />
          <FieldErrorMsg message={fieldErrors.accountNumber} />
          </div>
          <div>
          <Input
            value={step3.confirmAccountNumber || ""}
            onChange={(e) => {
              clearFieldError("confirmAccountNumber")
              setStep3({
                ...step3,
                confirmAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 18),
              })
            }}
            className={inputCls("confirmAccountNumber")}
            placeholder="Re-enter account number"
          />
          <FieldErrorMsg message={fieldErrors.confirmAccountNumber} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
          <Input
            value={step3.ifscCode || ""}
            onChange={(e) => {
              clearFieldError("ifscCode")
              setStep3({
                ...step3,
                ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11),
              })
            }}
            className={inputCls("ifscCode")}
            placeholder="IFSC code"
          />
          <FieldErrorMsg message={fieldErrors.ifscCode} />
          </div>
          <div>
          <Select
            value={step3.accountType || ""}
            onValueChange={(value) => {
              clearFieldError("accountType")
              setStep3({ ...step3, accountType: value })
            }}
          >
            <SelectTrigger className={`${inputCls("accountType")} mt-0`}>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Saving">Saving</SelectItem>
              <SelectItem value="Current">Current</SelectItem>
            </SelectContent>
          </Select>
          <FieldErrorMsg message={fieldErrors.accountType} />
          </div>
        </div>
        <Input
          value={step3.accountHolderName || ""}
          onChange={(e) => {
            clearFieldError("accountHolderName")
            setStep3({
              ...step3,
              accountHolderName: e.target.value.replace(/[^A-Za-z ]/g, ""),
            })
          }}
          className={inputCls("accountHolderName")}
          placeholder="Account holder name"
        />
        <FieldErrorMsg message={fieldErrors.accountHolderName} />
      </section>
    </div>
  )

  const selectedZoneLabel = zones.find((z) => String(z._id || z.id) === String(step1.zoneId))
  const selectedZoneName =
    step1.zoneName?.trim() ||
    getZoneDisplayName(selectedZoneLabel) ||
    onboardingDraftRef.current?.zoneName ||
    "—"

  const renderStep4 = () => (
    <div className="space-y-5 lg:space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#FF0000]/15 bg-gradient-to-br from-[#FF0000]/5 via-white to-orange-50 p-5 sm:p-6 lg:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF0000]">Final step</p>
        <h2 className="mt-2 text-xl font-black text-slate-900 sm:text-2xl">You&apos;re almost live on {companyName}</h2>
        <p className={`${ONBOARDING_SECTION_DESC} mt-2 max-w-xl`}>
          Review your details below, set how long deliveries usually take, then submit for admin approval.
        </p>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>Application summary</h2>
        <p className={ONBOARDING_SECTION_DESC}>
          Quick snapshot of what you&apos;ve submitted in the previous steps.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-[#FF0000]">
              <Store className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Restaurant</span>
            </div>
            <p className="font-bold text-slate-900">{step1.restaurantName || "—"}</p>
            <p className="mt-1 text-xs text-slate-500">{step1.ownerName || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-[#FF0000]">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Zone & area</span>
            </div>
            <p className="font-bold text-slate-900">{selectedZoneName}</p>
            <p className="mt-1 text-xs text-slate-500">{step1.location?.area || step1.location?.city || "—"}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-[#FF0000]">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Delivery hours</span>
            </div>
            <p className="font-bold text-slate-900">
              {step2.openingTime && step2.closingTime
                ? `${step2.openingTime} – ${step2.closingTime}`
                : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {(step2.openDays || []).length
                ? `${step2.openDays.join(", ")} open`
                : "No days selected"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <div className="mb-2 flex items-center gap-2 text-[#FF0000]">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Documents</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                PAN {step3.panNumber ? "added" : "pending"}
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                FSSAI {step3.fssaiNumber ? "added" : "pending"}
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Bank details {step3.accountNumber ? "added" : "pending"}
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>How customers will see you</h2>
        <p className={ONBOARDING_SECTION_DESC}>
          Preview of your restaurant card on the user home page.
        </p>
        <OnboardingRestaurantCardPreview
          restaurantName={step1.restaurantName}
          profileImageUrl={getPreviewImageUrl(step2.profileImage) || getImageAssetUrl(step2.profileImage)}
          pureVeg={step1.pureVegRestaurant}
          area={step1.location?.area}
          city={step1.location?.city}
          estimatedDeliveryTime={step4.estimatedDeliveryTime}
          cuisines={step2.cuisines}
        />
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-4`}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF0000]/10">
            <Truck className="h-5 w-5 text-[#FF0000]" />
          </div>
          <div>
            <h2 className={ONBOARDING_SECTION_TITLE}>Estimated delivery time</h2>
            <p className={ONBOARDING_SECTION_DESC}>
              Shown to customers on your listing. Pick the usual time from order to doorstep.
            </p>
          </div>
        </div>
        <div>
          <Label className={ONBOARDING_LABEL}>Estimated delivery time*</Label>
          <Select
            value={step4.estimatedDeliveryTime || ""}
            onValueChange={(value) => {
              clearFieldError("estimatedDeliveryTime")
              setStep4({ ...step4, estimatedDeliveryTime: value })
            }}
          >
            <SelectTrigger className={inputCls("estimatedDeliveryTime")}>
              <SelectValue placeholder="Select estimated timing" />
            </SelectTrigger>
            <SelectContent>
              {[
                ...ESTIMATED_DELIVERY_TIME_OPTIONS,
                ...(step4.estimatedDeliveryTime &&
                  !ESTIMATED_DELIVERY_TIME_OPTIONS.includes(step4.estimatedDeliveryTime)
                  ? [step4.estimatedDeliveryTime]
                  : []),
              ].map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldErrorMsg message={fieldErrors.estimatedDeliveryTime} />
        </div>
      </section>

      <section className={`${ONBOARDING_SECTION} space-y-3`}>
        <h2 className={ONBOARDING_SECTION_TITLE}>What happens next?</h2>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/10 text-xs font-bold text-[#FF0000]">1</span>
            <span>Your application is sent to the {companyName} team for verification.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/10 text-xs font-bold text-[#FF0000]">2</span>
            <span>We review your documents, location, and menu details.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF0000]/10 text-xs font-bold text-[#FF0000]">3</span>
            <span>Once approved, your restaurant dashboard and orders go live.</span>
          </li>
        </ol>
      </section>

      {fetchingFees && !feeConfig && (
        <section className={`${ONBOARDING_SECTION} border-slate-200`}>
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF0000]" />
            <p className="text-sm font-medium text-slate-600">Loading onboarding fee details...</p>
          </div>
        </section>
      )}

      {requiresOnboardingFee && (
        <section className="space-y-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 sm:p-6 lg:p-8 shadow-sm">
          <h2 className="text-lg font-bold text-amber-900 sm:text-xl">Onboarding fee</h2>
          <p className="text-sm leading-relaxed text-amber-800">
            Admin has set a one-time onboarding fee for restaurant registration. Payment is required before your application can be submitted for approval.
          </p>
          <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl border border-amber-100 bg-white p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount payable</p>
              <p className="text-3xl font-black text-slate-900">₹{Number(feeConfig.price).toLocaleString("en-IN")}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold text-slate-500">Payment method</p>
              <p className="text-sm font-bold text-slate-800">Secure online payment</p>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-amber-700">
            When you click <span className="font-bold">Finish</span>, you will be redirected to complete this payment. Your registration will be submitted only after successful payment.
          </p>
        </section>
      )}
    </div>
  )

  const renderStep = () => {
    if (step === 1) return renderStep1()
    if (step === 2) return renderStep2()
    if (step === 3) return renderStep3()
    return renderStep4()
  }

  const handleBack = () => {
    if (step > 1) {
      goToStep(step - 1)
    } else {
      handleLogout()
    }
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <RestaurantOnboardingShell
        step={step}
        companyName={companyName}
        bannerUrl={bannerUrl}
        logoUrl={logoUrl}
        loading={loading}
        saving={saving || paymentInProgress}
        error={error}
        keyboardInset={keyboardInset}
        isEditing={isEditing}
        isLoggingOut={isLoggingOut}
        requiresOnboardingFee={requiresOnboardingFee}
        feeConfig={feeConfig}
        onBack={handleBack}
        onLogout={handleLogout}
        onEnableEdit={() => setIsEditing(true)}
        onNext={handleNext}
      >
        <div
          onFocusCapture={(e) => {
            const target = e.target
            if (!(target instanceof HTMLElement)) return
            if (!target.matches("input, textarea, select")) return
            window.setTimeout(() => {
              target.scrollIntoView({ behavior: "smooth", block: "center" })
            }, 250)
          }}
        >
          {renderStep()}
        </div>
      </RestaurantOnboardingShell>

      <ImageSourcePicker
        isOpen={sourcePicker.isOpen}
        onClose={closeImageSourcePicker}
        onFileSelect={sourcePicker.onSelectFile}
        title={sourcePicker.title}
        fileNamePrefix={sourcePicker.fileNamePrefix}
        galleryInputRef={sourcePicker.fallbackInputRef}
      />
    </LocalizationProvider>
  )
}



