import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image as ImageIcon } from "lucide-react"
import { deliveryAPI } from "@food/api"
import { toast } from "sonner"
import { isFlutterBridgeAvailable, openCamera } from "@food/utils/imageUploadUtils"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const DB_NAME = "DeliverySignupDB"
const STORE_NAME = "documents"

const initDB = () => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = (e) => resolve(e.target.result)
      request.onerror = () => resolve(null)
    } catch (e) {
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

const clearDB = async () => {
  const db = await initDB()
  if (!db) return
  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).clear()
  } catch (e) {
    debugError("Error clearing DB:", e)
  }
}

const createEmptyUploadedDocs = () => ({
  profilePhoto: null,
  aadharPhoto: null,
  panPhoto: null,
  drivingLicensePhoto: null
})

const sanitizeUploadedDocValue = (value) => {
  if (!value) return null

  if (typeof value === "string") {
    return value.startsWith("blob:") ? null : value
  }

  if (typeof value === "object") {
    const url = typeof value.url === "string" ? value.url : ""
    if (url.startsWith("blob:")) {
      return null
    }
    return value
  }

  return null
}

const sanitizeUploadedDocs = (docs) => ({
  profilePhoto: sanitizeUploadedDocValue(docs?.profilePhoto),
  aadharPhoto: sanitizeUploadedDocValue(docs?.aadharPhoto),
  panPhoto: sanitizeUploadedDocValue(docs?.panPhoto),
  drivingLicensePhoto: sanitizeUploadedDocValue(docs?.drivingLicensePhoto)
})

const hasDocumentValue = (localFile, uploadedValue) => {
  if (localFile instanceof File) return true
  if (typeof uploadedValue === "string") return uploadedValue.trim().length > 0
  if (uploadedValue && typeof uploadedValue === "object") {
    if (typeof uploadedValue.url === "string" && uploadedValue.url.trim()) return true
    if (uploadedValue && uploadedValue.file === true) return true
  }
  return false
}

const getFriendlyRegistrationError = (error) => {
  const rawMessage =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    ""

  if (/E11000 duplicate key error/i.test(rawMessage)) {
    if (/vehicleNumber_1/i.test(rawMessage) || /vehicleNumber/i.test(rawMessage)) {
      return "This vehicle number is already registered. Please use a different vehicle number."
    }

    if (/panNumber_1/i.test(rawMessage) || /panNumber/i.test(rawMessage)) {
      return "This PAN number is already registered."
    }

    if (/aadharNumber_1/i.test(rawMessage) || /aadharNumber/i.test(rawMessage)) {
      return "This Aadhar number is already registered."
    }

    if (/drivingLicense/i.test(rawMessage)) {
      return "This driving license number is already registered."
    }

    return "This account detail is already registered. Please check your information."
  }

  return rawMessage || "Failed to register. Please try again."
}


export default function SignupStep2() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()
  const isMobileDevice =
    typeof navigator !== "undefined" &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "")
  const fileInputRefs = useRef({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })
  const [documents, setDocuments] = useState({
    profilePhoto: null,
    aadharPhoto: null,
    panPhoto: null,
    drivingLicensePhoto: null
  })
  const [uploadedDocs, setUploadedDocs] = useState(() => {
    const saved = sessionStorage.getItem("deliverySignupDocs")
    if (saved) {
      try {
        return sanitizeUploadedDocs(JSON.parse(saved))
      } catch (e) {
        debugError("Error parsing saved docs:", e)
      }
    }
    return createEmptyUploadedDocs()
  })
  const [activePicker, setActivePicker] = useState(null) // { docType: string, title: string, ref: any }
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploading, setUploading] = useState({})
  const [restoring, setRestoring] = useState({})

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    let isMounted = true

    const loadSavedFiles = async () => {
      const docTypes = ["profilePhoto", "aadharPhoto", "panPhoto", "drivingLicensePhoto"]
      const restored = {}
      let hasRestored = false

      // Pre-check: verify IndexedDB is actually available and responsive
      // before showing the "Restoring..." state to the user
      let dbAvailable = false
      try {
        if (typeof indexedDB !== "undefined" && indexedDB) {
          const testDb = await Promise.race([
            initDB(),
            new Promise((resolve) => setTimeout(() => resolve(null), 1500))
          ])
          if (testDb) {
            dbAvailable = true
            // Only close if it's a real IDBDatabase object we opened for testing
            try { testDb.close() } catch (_) {}
          }
        }
      } catch (_) {
        dbAvailable = false
      }

      // If IndexedDB isn't available or not responsive, skip restoration entirely
      if (!dbAvailable) {
        return
      }

      if (!isMounted) return
      setRestoring(Object.fromEntries(docTypes.map(t => [t, true])))

      // Safety timeout: ensure "Restoring..." never gets stuck
      const safetyTimeout = setTimeout(() => {
        if (isMounted) {
          setRestoring({})
        }
      }, 3000)

      try {
        for (const type of docTypes) {
          if (!isMounted) break
          const file = await Promise.race([
            getFileFromDB(type),
            new Promise((resolve) => setTimeout(() => resolve(null), 2000))
          ])
          if (file && (file instanceof File || file instanceof Blob)) {
            const restoredFile = file instanceof File ? file : new File([file], `${type}.jpg`, { type: file.type || "image/jpeg" })
            restored[type] = restoredFile
            hasRestored = true
          }
        }
      } catch (e) {
        debugError("Error loading saved files from DB:", e)
      } finally {
        clearTimeout(safetyTimeout)
        if (isMounted) {
          setRestoring({})
        }
      }

      if (hasRestored && isMounted) {
        setDocuments(prev => ({ ...prev, ...restored }))
      }
    }
    loadSavedFiles()

    return () => {
      isMounted = false
    }
  }, [])

  // Save uploaded docs to session storage whenever they change
  useEffect(() => {
    sessionStorage.setItem("deliverySignupDocs", JSON.stringify(uploadedDocs))
  }, [uploadedDocs])

  useEffect(() => {
    return () => {
      Object.values(documents).forEach((file) => {
        if (file instanceof File) {
          const previewUrl = file.previewUrl || file._previewUrl
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
          }
        }
      })
    }
  }, [])

  const getPreviewSrc = (docType) => {
    const uploaded = uploadedDocs[docType]
    if (typeof uploaded === "string") return uploaded
    if (uploaded?.url) return uploaded.url

    const localFile = documents[docType]
    if (localFile instanceof File) {
      if (!localFile._previewUrl) {
        localFile._previewUrl = URL.createObjectURL(localFile)
      }
      return localFile._previewUrl
    }
    return null
  }

  const handleOpenUploadOptions = (docType) => {
    fileInputRefs.current[docType]?.click()
  }

  const handleFileSelect = async (docType, file) => {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB")
      return
    }

    setDocuments((prev) => {
      const oldFile = prev[docType]
      if (oldFile && oldFile._previewUrl) {
        URL.revokeObjectURL(oldFile._previewUrl)
      }
      return { ...prev, [docType]: file }
    })
    setUploadedDocs((prev) => ({ ...prev, [docType]: { file: true } }))
    await saveFileToDB(docType, file)
    toast.success(`${docType.replace(/([A-Z])/g, " $1").trim()} selected`)
  }

  const handleTakeCameraPhoto = (docType, label) => {
    openCamera({
      onSelectFile: (file) => handleFileSelect(docType, file),
      fileNamePrefix: `signup-${docType}`
    })
  }

  const handlePickFromGallery = (docType) => {
    fileInputRefs.current[docType]?.click()
  }

  const handleRemove = (docType) => {
    setDocuments(prev => {
      const file = prev[docType]
      if (file && file._previewUrl) {
        URL.revokeObjectURL(file._previewUrl)
      }
      return { ...prev, [docType]: null }
    })
    setUploadedDocs(prev => ({
      ...prev,
      [docType]: null
    }))
    removeFileFromDB(docType)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const hasProfilePhoto = hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto)
    const hasAadharPhoto = hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto)
    const hasPanPhoto = hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto)
    const hasDrivingLicensePhoto = hasDocumentValue(
      documents.drivingLicensePhoto,
      uploadedDocs.drivingLicensePhoto
    )

    if (!hasProfilePhoto || !hasAadharPhoto || !hasPanPhoto || !hasDrivingLicensePhoto) {
      toast.error("Please upload all required documents")
      return
    }

    const raw = sessionStorage.getItem("deliverySignupDetails")
    if (!raw) {
      toast.error("Session expired. Please start from Create Account.")
      navigate("/food/delivery/signup", { replace: true })
      return
    }

    let details
    try {
      details = JSON.parse(raw)
    } catch {
      toast.error("Invalid session. Please start from Create Account.")
      navigate("/food/delivery/signup", { replace: true })
      return
    }

    const formData = new FormData()
    formData.append("name", details.name || "")
    formData.append("phone", String(details.phone || "").replace(/\D/g, "").slice(0, 15))
    if (details.email) formData.append("email", String(details.email).trim())
    if (details.ref) formData.append("ref", String(details.ref).trim())
    if (details.countryCode) formData.append("countryCode", details.countryCode)
    if (details.address) formData.append("address", details.address)
    if (details.city) formData.append("city", details.city)
    if (details.state) formData.append("state", details.state)
    if (details.vehicleType) formData.append("vehicleType", details.vehicleType)
    if (details.vehicleName) formData.append("vehicleName", details.vehicleName)
    if (details.vehicleNumber) formData.append("vehicleNumber", details.vehicleNumber)
    if (details.drivingLicenseNumber) {
      formData.append("drivingLicenseNumber", details.drivingLicenseNumber)
      formData.append("documents[drivingLicense][number]", details.drivingLicenseNumber)
    }
    if (details.panNumber) formData.append("panNumber", details.panNumber)
    if (details.aadharNumber) formData.append("aadharNumber", details.aadharNumber)
    if (documents.profilePhoto instanceof File) {
      formData.append("profilePhoto", documents.profilePhoto)
    }
    if (documents.aadharPhoto instanceof File) {
      formData.append("aadharPhoto", documents.aadharPhoto)
    }
    if (documents.panPhoto instanceof File) {
      formData.append("panPhoto", documents.panPhoto)
    }
    if (documents.drivingLicensePhoto instanceof File) {
      formData.append("drivingLicensePhoto", documents.drivingLicensePhoto)
    }

    // Try to get FCM token before registering
    let fcmToken = null;
    let platform = "web";
    try {
      if (typeof window !== "undefined") {
        if (window.flutter_inappwebview) {
          platform = "mobile";
          const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"];
          for (const handlerName of handlerNames) {
            try {
              const t = await window.flutter_inappwebview.callHandler(handlerName, { module: "delivery" });
              if (t && typeof t === "string" && t.length > 20) {
                fcmToken = t.trim();
                break;
              }
            } catch (e) {}
          }
        } else {
          fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null;
        }
      }
    } catch (e) {
      debugWarn("Failed to get FCM token during signup", e);
    }

    if (fcmToken) {
      formData.append("fcmToken", fcmToken);
      formData.append("platform", platform);
    }

    const isCompleteProfile = sessionStorage.getItem("deliveryNeedsRegistration") === "true"

    setIsSubmitting(true)

    try {
      // New number (OTP ke baad pehli baar): DB me abhi partner nahi hai,
      // is case me register hi call karna hai (no auth token needed).
      const response = isCompleteProfile
        ? await deliveryAPI.register(formData)
        : await deliveryAPI.completeProfile(formData)

      if (response?.data?.success) {
        sessionStorage.removeItem("deliverySignupDetails")
        sessionStorage.removeItem("deliverySignupDocs")
        clearDB()
        if (isCompleteProfile) {
          sessionStorage.removeItem("deliveryNeedsRegistration")
          const pendingPhone = `${details.countryCode || "+91"} ${String(details.phone || "").replace(/\D/g, "").slice(0, 15)}`.trim()
          sessionStorage.setItem("deliveryPendingPhone", pendingPhone)
          toast.success("Registration submitted. Verification is in progress.")
          setTimeout(
            () =>
              navigate("/food/delivery/verification", {
                replace: true,
                state: { phone: pendingPhone },
              }),
            1200
          )
        } else {
          const pendingPhone = `${details.countryCode || "+91"} ${String(details.phone || "").replace(/\D/g, "").slice(0, 15)}`.trim()
          sessionStorage.setItem("deliveryPendingPhone", pendingPhone)
          toast.success("Profile submitted. Waiting for admin approval.")
          setTimeout(
            () =>
              navigate("/food/delivery/verification", {
                replace: true,
                state: { phone: pendingPhone },
              }),
            1200
          )
        }
      }
    } catch (error) {
      debugError("Error submitting registration:", error)
      const message = getFriendlyRegistrationError(error)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const DocumentUpload = ({ docType, label, required = true }) => {
    const uploaded = uploadedDocs[docType]
    const isUploading = uploading[docType] || restoring[docType]
    const hasUploadedDocument = hasDocumentValue(documents[docType], uploaded)

    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label} {required && <span className="text-red-500">*</span>}
        </label>

        {hasUploadedDocument ? (
          <div className="relative">
            <img
              src={getPreviewSrc(docType)}
              alt={label}
              className="w-full h-48 object-cover rounded-lg"
            />
            <button
              type="button"
              onClick={() => handleRemove(docType)}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
              <Check className="w-4 h-4" />
              <span>Uploaded</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary transition-colors px-4">
            <div className="flex flex-col items-center justify-center pt-5 pb-3">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <p className="text-sm text-gray-500">{uploading[docType] ? "Uploading..." : "Restoring..."}</p>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 mb-1">Upload document</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                </>
              )}
            </div>

            {!isUploading && (
              <div className="w-full grid grid-cols-2 gap-2 pb-4">
                <button
                  type="button"
                  onClick={() => handleTakeCameraPhoto(docType, label)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer hover:bg-primary/90 transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePickFromGallery(docType)}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100/50 transition-all active:scale-95"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Gallery</span>
                </button>
              </div>
            )}

            <input
              ref={(node) => {
                fileInputRefs.current[docType] = node
              }}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
              onClick={(e) => {
                e.target.value = ""
              }}
              onChange={(e) => {
                const selectedFile = e.target.files[0]
                if (selectedFile) {
                  handleFileSelect(docType, selectedFile)
                }
                e.target.value = ""
              }}
              disabled={isUploading}
            />
          </div>
        )}
      </div>
    )
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
        <h1 className="text-lg font-medium">Upload Documents</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Document Verification</h2>
          <p className="text-sm text-gray-600">Please upload clear photos of your documents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <DocumentUpload docType="profilePhoto" label="Profile Photo" required={true} />
          <DocumentUpload docType="aadharPhoto" label="Aadhar Card Photo" required={true} />
          <DocumentUpload docType="panPhoto" label="PAN Card Photo" required={true} />
          <DocumentUpload docType="drivingLicensePhoto" label="Driving License Photo" required={true} />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto) ||
              !hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto) ||
              !hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto) ||
              !hasDocumentValue(documents.drivingLicensePhoto, uploadedDocs.drivingLicensePhoto)
            }
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting ||
              !hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto) ||
              !hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto) ||
              !hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto) ||
              !hasDocumentValue(documents.drivingLicensePhoto, uploadedDocs.drivingLicensePhoto)
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
          >
            {isSubmitting ? "Submitting..." : "Complete Signup"}
          </button>
        </form>
      </div>

    </div>
  )
}

