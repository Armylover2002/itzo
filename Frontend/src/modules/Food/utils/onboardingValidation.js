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

const isUploadableFile = (value) => {
  if (!value || typeof value !== "object") return false
  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true
  return (
    typeof value.size === "number" &&
    (typeof value.slice === "function" || typeof value.arrayBuffer === "function")
  )
}

const hasValidImageAsset = (value) => {
  if (!value) return false
  if (isUploadableFile(value)) return true
  if (typeof value === "string" && value.startsWith("http")) return true
  if (value?.url && typeof value.url === "string") return true
  return false
}

export const isPointInPolygon = (lat, lng, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = Number(polygon[i].longitude || polygon[i].lng)
    const yi = Number(polygon[i].latitude || polygon[i].lat)
    const xj = Number(polygon[j].longitude || polygon[j].lng)
    const yj = Number(polygon[j].latitude || polygon[j].lat)
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export const validateOnboardingStep1 = (step1, zones = []) => {
  const errors = {}

  if (!step1.restaurantName?.trim()) {
    errors.restaurantName = "Restaurant name is required"
  }
  if (typeof step1.pureVegRestaurant !== "boolean") {
    errors.pureVegRestaurant = "Please select whether your restaurant is pure veg"
  }
  if (!step1.ownerName?.trim()) {
    errors.ownerName = "Owner name is required"
  } else if (!NAME_REGEX.test(step1.ownerName.trim())) {
    errors.ownerName = "Owner name must contain only letters"
  }
  if (!step1.ownerEmail?.trim()) {
    errors.ownerEmail = "Owner email is required"
  } else if (!OWNER_EMAIL_REGEX.test(step1.ownerEmail.trim())) {
    errors.ownerEmail = "Email must be a valid @gmail.com address"
  }
  if (!step1.ownerPhone?.trim()) {
    errors.ownerPhone = "Owner phone number is required"
  } else if (!PHONE_NUMBER_REGEX.test(step1.ownerPhone.trim())) {
    errors.ownerPhone = "Owner phone number must be a valid 10 to 12-digit number"
  }
  if (!step1.primaryContactNumber?.trim()) {
    errors.primaryContactNumber = "Primary contact number is required"
  } else if (!PRIMARY_PHONE_NUMBER_REGEX.test(step1.primaryContactNumber.trim())) {
    errors.primaryContactNumber = "Primary contact number must contain exactly 10 digits"
  }
  if (!step1.zoneId?.trim()) {
    errors.zoneId = "Service zone is required"
  }
  if (
    step1.zoneId &&
    (!step1.location?.latitude || !step1.location?.longitude)
  ) {
    errors.locationPin = "Please pin your restaurant location inside the selected service zone"
  }
  if (!step1.location?.addressLine1?.trim()) {
    errors.addressLine1 = "Building/Floor/Street address is required"
  }
  if (!step1.location?.area?.trim()) {
    errors.area = "Area/Sector/Locality is required"
  }
  if (!step1.location?.city?.trim()) {
    errors.city = "City is required"
  }
  if (!step1.location?.pincode?.trim()) {
    errors.pincode = "Pincode is required"
  } else if (!PINCODE_REGEX.test(step1.location.pincode.trim())) {
    errors.pincode = "Pincode must contain exactly 6 digits"
  }

  if (step1.zoneId && step1.location?.latitude && step1.location?.longitude) {
    const selectedZone = zones.find((z) => String(z._id || z.id) === step1.zoneId)
    if (selectedZone && Array.isArray(selectedZone.coordinates) && selectedZone.coordinates.length >= 3) {
      const isInside = isPointInPolygon(
        Number(step1.location.latitude),
        Number(step1.location.longitude),
        selectedZone.coordinates,
      )
      if (!isInside) {
        errors.locationPin = "Selected address is outside the selected zone"
      }
    }
  }

  return errors
}

const MAX_SHIFTS = 3
const timeStringToMinutes = (value) => {
  if (!value || typeof value !== "string") return null
  const [h, m] = value.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export const validateOnboardingStep2 = (step2) => {
  const errors = {}
  const hasMenuImages = step2.menuImages && step2.menuImages.length > 0

  if (!hasMenuImages) {
    errors.menuImages = "At least one menu image is required"
  } else {
    const validMenuImages = step2.menuImages.filter((img) => hasValidImageAsset(img))
    if (validMenuImages.length === 0) {
      errors.menuImages = "Please upload at least one valid menu image"
    }
  }

  if (!step2.profileImage) {
    errors.profileImage = "Restaurant profile image is required"
  } else if (!hasValidImageAsset(step2.profileImage)) {
    errors.profileImage = "Please upload a valid restaurant profile image"
  }

  // Mirrors AddRestaurant.jsx's validateShifts / backend normalizeShiftsList rules: each
  // shift's times set and open != close, at least one day selected across shifts, max 3
  // shifts, no overlapping shifts on a shared day (skip strict overlap math for overnight
  // shifts, closingTime < openingTime — same wraparound convention as restaurantAvailability.js).
  const shifts = Array.isArray(step2.shifts) ? step2.shifts : []
  const shiftErrors = {}

  if (shifts.length === 0) {
    shiftErrors.general = "Please add at least one shift"
  } else {
    if (shifts.length > MAX_SHIFTS) {
      shiftErrors.general = `A maximum of ${MAX_SHIFTS} shifts is allowed`
    }

    const withMinutes = shifts.map((shift) => ({
      ...shift,
      openingMinutes: timeStringToMinutes(shift.openingTime),
      closingMinutes: timeStringToMinutes(shift.closingTime),
    }))

    withMinutes.forEach((shift, index) => {
      if (shift.openingMinutes === null || shift.closingMinutes === null) {
        shiftErrors[index] = "Opening and closing time are required"
      } else if (shift.openingMinutes === shift.closingMinutes) {
        shiftErrors[index] = "Opening time and closing time cannot be same"
      } else if (!shift.days || shift.days.length === 0) {
        shiftErrors[index] = "Please select at least one day"
      }
    })

    const allDays = new Set(shifts.flatMap((s) => s.days || []))
    if (allDays.size === 0 && !shiftErrors.general) {
      shiftErrors.general = "Select at least one open day"
    }

    allDays.forEach((day) => {
      const dayShifts = withMinutes
        .map((shift, index) => ({ ...shift, index }))
        .filter((shift) => (shift.days || []).includes(day) && shift.openingMinutes !== null && shift.closingMinutes !== null)
      for (let i = 0; i < dayShifts.length; i++) {
        for (let j = i + 1; j < dayShifts.length; j++) {
          const a = dayShifts[i]
          const b = dayShifts[j]
          const aOvernight = a.closingMinutes < a.openingMinutes
          const bOvernight = b.closingMinutes < b.openingMinutes
          if (!aOvernight && !bOvernight && a.openingMinutes < b.closingMinutes && b.openingMinutes < a.closingMinutes) {
            const msg = `Overlaps with another shift on ${day}`
            shiftErrors[a.index] = shiftErrors[a.index] || msg
            shiftErrors[b.index] = shiftErrors[b.index] || msg
          }
        }
      }
    })
  }

  if (Object.keys(shiftErrors).length > 0) {
    errors.shifts = shiftErrors
  }

  return errors
}

export const validateOnboardingStep3 = (step3, getTodayLocalYMD) => {
  const errors = {}

  if (!step3.panNumber?.trim()) {
    errors.panNumber = "PAN number is required"
  } else if (!PAN_NUMBER_REGEX.test(step3.panNumber.trim().toUpperCase())) {
    errors.panNumber = "PAN number must be valid (e.g., ABCDE1234F)"
  }
  if (!step3.nameOnPan?.trim()) {
    errors.nameOnPan = "Name on PAN is required"
  }
  if (!step3.panImage) {
    errors.panImage = "PAN image is required"
  } else if (!hasValidImageAsset(step3.panImage)) {
    errors.panImage = "Please upload a valid PAN image"
  }

  // When applying for FSSAI through onboarding, the owner has no number/expiry/image yet —
  // skip those checks and instead require the licensing partner application (the same form
  // used on the public Restaurant Consulting page — see LicensingSupportModal) to have been
  // submitted, which is how fssaiApplicationId gets set.
  if (!step3.fssaiApplyForLicense) {
    if (!step3.fssaiNumber?.trim()) {
      errors.fssaiNumber = "FSSAI number is required"
    } else if (!FSSAI_NUMBER_REGEX.test(step3.fssaiNumber.trim())) {
      errors.fssaiNumber = "FSSAI number must contain exactly 14 digits"
    }
    if (!step3.fssaiExpiry?.trim()) {
      errors.fssaiExpiry = "FSSAI expiry date is required"
    } else if (step3.fssaiExpiry < getTodayLocalYMD()) {
      errors.fssaiExpiry = "FSSAI expiry date cannot be in the past"
    }
    if (!step3.fssaiImage) {
      errors.fssaiImage = "FSSAI image is required"
    } else if (!hasValidImageAsset(step3.fssaiImage)) {
      errors.fssaiImage = "Please upload a valid FSSAI image"
    }
  } else if (!step3.fssaiApplicationId) {
    errors.fssaiApplicationId = "Please submit the FSSAI licensing application form"
  }

  if (step3.gstRegistered) {
    if (!step3.gstNumber?.trim()) {
      errors.gstNumber = "GST number is required when GST registered"
    } else if (!GST_NUMBER_REGEX.test(step3.gstNumber.trim().toUpperCase())) {
      errors.gstNumber = "GST number must be a valid 15-character GSTIN"
    }
    if (!step3.gstLegalName?.trim()) {
      errors.gstLegalName = "GST legal name is required when GST registered"
    } else if (!GST_LEGAL_NAME_REGEX.test(step3.gstLegalName.trim())) {
      errors.gstLegalName = "GST legal name must contain only letters"
    }
    if (!step3.gstAddress?.trim()) {
      errors.gstAddress = "GST registered address is required when GST registered"
    }
    if (!step3.gstImage) {
      errors.gstImage = "GST image is required when GST registered"
    } else if (!hasValidImageAsset(step3.gstImage)) {
      errors.gstImage = "Please upload a valid GST image"
    }
  }

  if (!step3.accountNumber?.trim()) {
    errors.accountNumber = "Account number is required"
  } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.accountNumber.trim())) {
    errors.accountNumber = "Account number must contain 9 to 18 digits only"
  }
  if (!step3.confirmAccountNumber?.trim()) {
    errors.confirmAccountNumber = "Please confirm your account number"
  } else if (!BANK_ACCOUNT_NUMBER_REGEX.test(step3.confirmAccountNumber.trim())) {
    errors.confirmAccountNumber = "Confirm account number must contain 9 to 18 digits only"
  }
  if (
    step3.accountNumber &&
    step3.confirmAccountNumber &&
    step3.accountNumber !== step3.confirmAccountNumber
  ) {
    errors.confirmAccountNumber = "Account number and confirmation do not match"
  }
  if (!step3.ifscCode?.trim()) {
    errors.ifscCode = "IFSC code is required"
  } else if (!IFSC_CODE_REGEX.test(step3.ifscCode.trim().toUpperCase())) {
    errors.ifscCode = "IFSC code must contain exactly 11 alphanumeric characters"
  }
  if (!step3.accountHolderName?.trim()) {
    errors.accountHolderName = "Account holder name is required"
  } else if (!ACCOUNT_HOLDER_NAME_REGEX.test(step3.accountHolderName.trim())) {
    errors.accountHolderName = "Account holder name must contain only letters"
  }
  if (!step3.accountType?.trim()) {
    errors.accountType = "Account type is required"
  } else if (!["Saving", "Current"].includes(step3.accountType.trim())) {
    errors.accountType = "Account type must be either Saving or Current"
  }

  return errors
}

export const validateOnboardingStep4 = (step4) => {
  const errors = {}
  if (!step4.estimatedDeliveryTime?.trim()) {
    errors.estimatedDeliveryTime = "Estimated delivery time is required"
  }
  return errors
}

export const onboardingInputClass = (fieldErrors, field, baseClass) => {
  if (fieldErrors?.[field]) {
    return `${baseClass} border-red-400 ring-2 ring-red-200 focus-visible:ring-red-300`
  }
  return baseClass
}
