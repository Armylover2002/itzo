import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, X, Check, Camera, Image as ImageIcon, Truck } from "lucide-react"
import { deliveryAPI, onboardingFeeAPI } from "@food/api"
import { toast } from "sonner"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { openCamera, openGallery } from "@food/utils/imageUploadUtils"
import useDeliveryBackNavigation from "../../hooks/useDeliveryBackNavigation"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const DB_NAME = "DeliverySignupDB"
const STORE_NAME = "documents"

let cachedDB = null
const initDB = () => {
  return new Promise((resolve) => {
    try {
      if (cachedDB) {
        return resolve(cachedDB);
      }
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }
      const timeoutId = setTimeout(() => {
        resolve(null);
      }, 2000);

      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        try {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch (err) {
          console.error("🔍 [initDB] error during upgrade:", err);
        }
      };
      request.onsuccess = (e) => {
        clearTimeout(timeoutId);
        cachedDB = e.target.result;
        resolve(cachedDB);
      };
      request.onerror = (err) => {
        console.error("🔍 [initDB] open error event:", err);
        clearTimeout(timeoutId);
        resolve(null);
      };
    } catch (e) {
      console.error("🔍 [initDB] synchronous exception caught:", e);
      resolve(null);
    }
  });
}

const saveFileToDB = async (key, file) => {
  try {
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
  } catch (err) {
    return
  }
}

const getFileFromDB = async (key, isRetry = false) => {
  try {
    const db = await initDB();
    if (!db) {
      return null;
    }
    return new Promise((resolve) => {
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        console.warn(`🔍 [getFileFromDB] timed out (1500ms) for key: ${key}`);
        if (!isRetry) {
          cachedDB = null;
          resolve(getFileFromDB(key, true));
        } else {
          resolve(null);
        }
      }, 1500);

      try {
        const transaction = db.transaction(STORE_NAME, "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(key)

        request.onsuccess = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          resolve(request.result);
        }

        request.onerror = (err) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.error(`🔍 [getFileFromDB] get error for key: ${key}:`, err);
          if (!isRetry) {
            cachedDB = null;
            resolve(getFileFromDB(key, true));
          } else {
            resolve(null);
          }
        }

        transaction.onabort = (event) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.warn(`🔍 [getFileFromDB] transaction aborted for key: ${key}:`, event);
          if (!isRetry) {
            cachedDB = null;
            resolve(getFileFromDB(key, true));
          } else {
            resolve(null);
          }
        }

        transaction.onerror = (event) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutId);
          console.error(`🔍 [getFileFromDB] transaction error for key: ${key}:`, event);
          if (!isRetry) {
            cachedDB = null;
            resolve(getFileFromDB(key, true));
          } else {
            resolve(null);
          }
        }

      } catch (e) {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        console.error(`🔍 [getFileFromDB] transaction/store exception for key: ${key}:`, e);
        if (!isRetry) {
          cachedDB = null;
          resolve(getFileFromDB(key, true));
        } else {
          resolve(null);
        }
      }
    })
  } catch (err) {
    console.error(`🔍 [getFileFromDB] outer catch exception for key: ${key}:`, err);
    if (!isRetry) {
      cachedDB = null;
      return getFileFromDB(key, true);
    }
    return null;
  }
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

const sanitizeUploadedDocs = (docs) => {
  if (!docs || typeof docs !== 'object') return createEmptyUploadedDocs();
  const sanitized = {};
  Object.keys(docs).forEach(key => {
    sanitized[key] = sanitizeUploadedDocValue(docs[key]);
  });
  return {
    ...createEmptyUploadedDocs(),
    ...sanitized
  };
}

const hasDocumentValue = (localFile, uploadedValue) => {
  if (localFile instanceof File || localFile instanceof Blob) return true
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

const buildFormData = async (details, documents) => {
  const formData = new FormData()

  formData.append("name", details.name || "")
  formData.append("phone", String(details.phone || "").replace(/\D/g, "").slice(0, 15))
  if (details.email) formData.append("email", String(details.email).trim())
  if (details.ref) formData.append("ref", String(details.ref).trim())
  if (details.countryCode) formData.append("countryCode", details.countryCode)
  if (details.address) formData.append("address", details.address)
  if (details.city) formData.append("city", details.city)
  if (details.state) formData.append("state", details.state)
  
  if (details.vehicles && Array.isArray(details.vehicles)) {
    // Send array as JSON string for future backend processing
    formData.append("vehicles", JSON.stringify(details.vehicles))
  }

  const submissionType =
    sessionStorage.getItem("deliverySubmissionType") ||
    (sessionStorage.getItem("deliveryIsRejected") === "true"
      ? "new_onboarding"
      : "initial")
  formData.append("submissionType", submissionType)

  if (details.drivingLicenseNumber) {
    formData.append("drivingLicenseNumber", details.drivingLicenseNumber)
    formData.append("documents[drivingLicense][number]", details.drivingLicenseNumber)
  }
  if (details.panNumber) formData.append("panNumber", details.panNumber)
  if (details.aadharNumber) formData.append("aadharNumber", details.aadharNumber)

  Object.keys(documents).forEach(key => {
    const file = documents[key];
    if (file instanceof File || file instanceof Blob) {
      formData.append(key, file, file.name || `${key}.jpg`)
    }
  })

  let fcmToken = null
  let platform = "web"
  try {
    if (typeof window !== "undefined") {
      if (window.flutter_inappwebview) {
        platform = "mobile"
        const handlerNames = ["getFcmToken", "getFCMToken", "getPushToken", "getFirebaseToken"]
        for (const handlerName of handlerNames) {
          try {
            // Promise.race prevents execution from hanging if the handler is not registered
            const t = await Promise.race([
              window.flutter_inappwebview.callHandler(handlerName, { module: "delivery" }),
              new Promise((resolve) => setTimeout(() => resolve(null), 800))
            ])
            if (t && typeof t === "string" && t.length > 20) {
              fcmToken = t.trim()
              break
            }
          } catch (e) { }
        }
      } else {
        fcmToken = localStorage.getItem("fcm_web_registered_token_delivery") || null
      }
    }
  } catch (e) {
    debugWarn("Failed to get FCM token", e)
  }

  if (fcmToken) {
    formData.append("fcmToken", fcmToken)
    formData.append("platform", platform)
  }

  return formData
}

const submitRegistration = async ({ isCompleteProfile, formData, navigate }) => {
  const response = isCompleteProfile
    ? await deliveryAPI.register(formData)
    : await deliveryAPI.completeProfile(formData)

  if (response?.data?.success) {
    const raw = sessionStorage.getItem("deliverySignupDetails")
    const details = raw ? JSON.parse(raw) : {}
    sessionStorage.removeItem("deliverySignupDetails")
    sessionStorage.removeItem("deliverySignupDocs")
    sessionStorage.removeItem("deliveryIsRejected")
    sessionStorage.removeItem("deliverySubmissionType")
    sessionStorage.removeItem("deliveryRejectionContext")
    sessionStorage.removeItem("deliveryPaymentSuccessData")
    clearDB()

    const pendingPhone = `${details.countryCode || "+91"} ${String(details.phone || "").replace(/\D/g, "").slice(0, 15)}`.trim()
    sessionStorage.setItem("deliveryPendingPhone", pendingPhone)

    if (isCompleteProfile) {
      sessionStorage.removeItem("deliveryNeedsRegistration")
      toast.success("Registration submitted. Verification is in progress.")
    } else {
      toast.success("Profile submitted. Waiting for admin approval.")
    }

    setTimeout(
      () => navigate("/food/delivery/verification", { replace: true, state: { phone: pendingPhone } }),
      1200
    )
    return true
  }

  const serverMessage =
    response?.data?.message ||
    response?.data?.error ||
    "Registration failed. Please try again."
  throw new Error(serverMessage)
}

const REQUIRED_DOCS_BY_VEHICLE_TYPE = {
  bicycle: [],
  bike: ['pollution'],
  scooter: ['pollution'],
  van: ['pollution', 'fitness', 'permit'],
}

const getRequiredDocuments = (category) =>
  REQUIRED_DOCS_BY_VEHICLE_TYPE[(category || "").toLowerCase()] || ['pollution']

export default function SignupStep2() {
  const navigate = useNavigate()
  const goBack = useDeliveryBackNavigation()
  const signupDetailsRaw = sessionStorage.getItem("deliverySignupDetails")

  let signupDetails = {}
  try {
    if (signupDetailsRaw) {
      signupDetails = JSON.parse(signupDetailsRaw)
    }
  } catch (e) { }

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

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploading, setUploading] = useState({})
  const [feeConfig, setFeeConfig] = useState(null)
  const [fetchingFees, setFetchingFees] = useState(false)
  const [paymentSuccessData, setPaymentSuccessData] = useState(() => {
    const saved = sessionStorage.getItem("deliveryPaymentSuccessData")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        return null
      }
    }
    return null
  })

  const documentsRef = useRef(documents)
  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  useEffect(() => {
    let isMounted = true;
    const loadFromDB = async () => {
      const keys = ["profilePhoto", "aadharPhoto", "panPhoto", "drivingLicensePhoto"];
      if (signupDetails.vehicles) {
        signupDetails.vehicles.forEach(v => {
          keys.push(`vehiclePhoto_${v.id}`);
          keys.push(`rc_${v.id}`);
          keys.push(`insurance_${v.id}`);
          keys.push(`fitness_${v.id}`);
          keys.push(`pollution_${v.id}`);
          keys.push(`permit_${v.id}`);
        });
      }
      
      const loaded = {};
      for (const key of keys) {
        if (uploadedDocs[key]) {
          const file = await getFileFromDB(key);
          if (file) {
            loaded[key] = file;
          }
        }
      }
      if (isMounted && Object.keys(loaded).length > 0) {
        setDocuments(prev => ({ ...prev, ...loaded }));
      }
    };
    loadFromDB();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const fetchFees = async () => {
      try {
        setFetchingFees(true)
        const isRejected = sessionStorage.getItem("deliveryIsRejected") === "true"
        if (isRejected) {
          setFeeConfig(null)
          return
        }
        const res = await onboardingFeeAPI.getPublicFees()
        const fees = res?.data?.data || res?.data
        if (fees && fees.DELIVERY_PARTNER) {
          setFeeConfig(fees.DELIVERY_PARTNER)
        }
      } catch (err) {
        debugError("Failed to fetch public onboarding fee for delivery partner:", err)
      } finally {
        setFetchingFees(false)
      }
    }
    fetchFees()
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [])

  useEffect(() => {
    sessionStorage.setItem("deliverySignupDocs", JSON.stringify(uploadedDocs))
  }, [uploadedDocs])

  useEffect(() => {
    return () => {
      Object.values(documentsRef.current).forEach((file) => {
        if (file instanceof File || file instanceof Blob) {
          const previewUrl = file._previewUrl || file.previewUrl
          if (previewUrl && previewUrl.startsWith('blob:')) {
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
    if (localFile instanceof File || localFile instanceof Blob) {
      if (!localFile._previewUrl) {
        localFile._previewUrl = URL.createObjectURL(localFile)
      }
      return localFile._previewUrl
    }
    return null
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
    openGallery({
      onSelectFile: (file) => handleFileSelect(docType, file),
      fileNamePrefix: `signup-${docType}`
    })
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

  const isFormValid = () => {
    if (!hasDocumentValue(documents.profilePhoto, uploadedDocs.profilePhoto)) return false;
    if (!hasDocumentValue(documents.aadharPhoto, uploadedDocs.aadharPhoto)) return false;
    if (!hasDocumentValue(documents.panPhoto, uploadedDocs.panPhoto)) return false;
    if (!hasDocumentValue(documents.drivingLicensePhoto, uploadedDocs.drivingLicensePhoto)) return false;

    let hasAllVehicleDocs = true;
    (signupDetails.vehicles || []).forEach(v => {
      const category = v.category || v.name || "";
      const isBicycle = category.toLowerCase() === "bicycle";
      if (!hasDocumentValue(documents[`vehiclePhoto_${v.id}`], uploadedDocs[`vehiclePhoto_${v.id}`])) hasAllVehicleDocs = false;
      if (isBicycle) return;
      if (!hasDocumentValue(documents[`rc_${v.id}`], uploadedDocs[`rc_${v.id}`])) hasAllVehicleDocs = false;
      if (!hasDocumentValue(documents[`insurance_${v.id}`], uploadedDocs[`insurance_${v.id}`])) hasAllVehicleDocs = false;

      const reqDocs = getRequiredDocuments(category);
      if (reqDocs.includes('fitness') && !hasDocumentValue(documents[`fitness_${v.id}`], uploadedDocs[`fitness_${v.id}`])) hasAllVehicleDocs = false;
      if (reqDocs.includes('pollution') && !hasDocumentValue(documents[`pollution_${v.id}`], uploadedDocs[`pollution_${v.id}`])) hasAllVehicleDocs = false;
      if (reqDocs.includes('permit') && !hasDocumentValue(documents[`permit_${v.id}`], uploadedDocs[`permit_${v.id}`])) hasAllVehicleDocs = false;
    });
    return hasAllVehicleDocs;
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isFormValid()) {
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

    const isCompleteProfile = sessionStorage.getItem("deliveryNeedsRegistration") === "true"

    setIsSubmitting(true)
    try {
      if (paymentSuccessData) {
        toast.info("Using previously completed payment details.")
        const formData = await buildFormData(details, documentsRef.current)
        formData.append("razorpayOrderId", paymentSuccessData.razorpayOrderId)
        formData.append("razorpayPaymentId", paymentSuccessData.razorpayPaymentId)
        formData.append("razorpaySignature", paymentSuccessData.razorpaySignature)

        await submitRegistration({ isCompleteProfile, formData, navigate })
        setIsSubmitting(false)
        return
      }

      if (feeConfig && feeConfig.isActive && feeConfig.price > 0) {
        const orderRes = await onboardingFeeAPI.createOrder({
          role: "DELIVERY_PARTNER",
          name: details.name || "Delivery Partner",
          phone: String(details.phone || "").replace(/\D/g, "").slice(0, 15),
          email: details.email || ""
        })
        const orderData = orderRes?.data?.data || orderRes?.data

        if (!orderData || !orderData.orderId) {
          throw new Error("Failed to create onboarding payment order")
        }

        if (orderData.isMock || orderData.orderId.startsWith("mock_ord_")) {
          toast.success("Developer Mode: Payment bypassed. Submitting mock payment details.")
          const formData = await buildFormData(details, documentsRef.current)
          formData.append("razorpayOrderId", orderData.orderId)
          formData.append("razorpayPaymentId", `mock_pay_${Date.now()}`)
          formData.append("razorpaySignature", `mock_sig_${Date.now()}`)

          await submitRegistration({ isCompleteProfile, formData, navigate })
          setIsSubmitting(false)
          return

        } else {
          const rzpOptions = {
            key: orderData.keyId,
            amount: Math.round(feeConfig.price * 100),
            currency: orderData.currency || "INR",
            order_id: orderData.orderId,
            name: "Onboarding Fee Payment",
            description: `Onboarding fee for ${details.name}`,
            prefill: {
              name: details.name || "",
              email: details.email || "",
              contact: String(details.phone || "").replace(/\D/g, "").slice(0, 15)
            },
            handler: async (response) => {
              try {
                setIsSubmitting(true)
                const payData = {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature
                }
                setPaymentSuccessData(payData)
                sessionStorage.setItem("deliveryPaymentSuccessData", JSON.stringify(payData))

                const formData = await buildFormData(details, documentsRef.current)
                formData.append("razorpayOrderId", response.razorpay_order_id)
                formData.append("razorpayPaymentId", response.razorpay_payment_id)
                formData.append("razorpaySignature", response.razorpay_signature)

                await submitRegistration({ isCompleteProfile, formData, navigate })
              } catch (err) {
                debugError("Error submitting registration after payment:", err)
                toast.error(getFriendlyRegistrationError(err))
              } finally {
                setIsSubmitting(false)
              }
            },
            onError: (err) => {
              toast.error(err?.description || "Payment failed. Please try again.")
              setIsSubmitting(false)
            },
            onClose: () => {
              toast.error("Payment modal closed. Payment is required to complete signup.")
              setIsSubmitting(false)
            }
          }

          await initRazorpayPayment(rzpOptions)
          return
        }

      } else {
        const formData = await buildFormData(details, documentsRef.current)
        await submitRegistration({ isCompleteProfile, formData, navigate })
        setIsSubmitting(false)
      }
    } catch (error) {
      debugError("Error submitting registration:", error)
      toast.error(getFriendlyRegistrationError(error))
      setIsSubmitting(false)
    }
  }

  const DocumentUpload = ({ docType, label, required = true }) => {
    const uploaded = uploadedDocs[docType]
    const isUploading = uploading[docType]
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
              disabled={isSubmitting}
              className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-500 text-white px-3 py-1 rounded-full flex items-center gap-1 text-sm">
              <Check className="w-4 h-4" />
              <span>Uploaded</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition-colors px-4">
            <div className="flex flex-col items-center justify-center pt-5 pb-3">
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mb-2"></div>
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
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold cursor-pointer hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePickFromGallery(docType)}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#00B761] text-white text-xs font-bold cursor-pointer hover:bg-[#00A055] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={isUploading || isSubmitting}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell-page fixed inset-0 z-20 flex !min-h-0 flex-col overflow-hidden bg-gray-100">
      {/* Header */}
      <div className="app-shell-page__header safe-top z-50 shrink-0 bg-white px-4 py-3 flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-medium">Upload Documents</h1>
      </div>

      {/* Content */}
      <div className="app-shell-page__body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Document Verification</h2>
          <p className="text-sm text-gray-600">Please upload clear photos of your documents</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="mb-4">
             <h3 className="text-lg font-bold text-gray-900 mb-4">Global Documents</h3>
          </div>
          <DocumentUpload docType="profilePhoto" label="Profile Photo" required={true} />
          <DocumentUpload docType="aadharPhoto" label="Aadhar Card Photo" required={true} />
          <DocumentUpload docType="panPhoto" label="PAN Card Photo" required={true} />
          <DocumentUpload docType="drivingLicensePhoto" label="Driving License Photo" required={true} />

          {signupDetails.vehicles && signupDetails.vehicles.length > 0 && (
             <div className="pt-6 mt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Vehicle Documents</h3>
                <p className="text-sm text-gray-600 mb-4">Please upload documents for each of your selected vehicles.</p>
                <div className="space-y-6">
                  {signupDetails.vehicles.map(v => {
                    const displayName = v.name || v.category || "Vehicle"
                    const category = v.category || v.name || ""
                    const isBicycle = category.toLowerCase() === "bicycle"
                    const reqDocs = getRequiredDocuments(category);

                    return (
                      <div key={v.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-white rounded-lg p-1.5 border border-gray-200 shadow-sm flex items-center justify-center">
                            <Truck className="w-6 h-6 text-gray-400" />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{displayName}</h4>
                            <p className="text-xs text-gray-500">{v.registrationNumber || "No Reg No"}</p>
                          </div>
                        </div>

                        <DocumentUpload docType={`vehiclePhoto_${v.id}`} label={`${displayName} Photo`} required={true} />
                        {!isBicycle && (
                          <>
                            <DocumentUpload docType={`rc_${v.id}`} label="RC (Registration Certificate)" required={true} />
                            <DocumentUpload docType={`insurance_${v.id}`} label="Vehicle Insurance" required={true} />
                          </>
                        )}
                        {reqDocs.includes('fitness') && (
                           <DocumentUpload docType={`fitness_${v.id}`} label="Fitness Certificate" required={true} />
                        )}
                        {reqDocs.includes('pollution') && (
                           <DocumentUpload docType={`pollution_${v.id}`} label="Pollution Certificate" required={true} />
                        )}
                        {reqDocs.includes('permit') && (
                           <DocumentUpload docType={`permit_${v.id}`} label="Vehicle Permit" required={true} />
                        )}
                      </div>
                    )
                  })}
                </div>
             </div>
          )}

          {feeConfig && feeConfig.isActive && feeConfig.price > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1 mt-6">
              <h3 className="text-sm font-bold text-red-800">Required Onboarding Fee</h3>
              <p className="text-xs text-red-700">
                An onboarding fee of <span className="font-bold">₹{feeConfig.price}</span> is required to register as a delivery partner. You will pay secure online on the next step.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isFormValid()}
            className={`w-full py-4 rounded-lg font-bold text-white text-base transition-colors mt-6 ${isSubmitting || !isFormValid()
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#00B761] hover:bg-[#00A055]"
              }`}
          >
            {isSubmitting ? "Submitting..." : "Complete Signup"}
          </button>
        </form>
      </div>
    </div>
  )
}
