import { convertBase64ToFile } from "@food/utils/imageUploadUtils"

const debugError = (...args) => {}

export const ONBOARDING_DRAFT_KEY = "restaurant_onboarding_data"
export const ONBOARDING_SESSION_ID_KEY = "restaurant_onboarding_session_id"
const LEGACY_LOCAL_DRAFT_KEY = "restaurant_onboarding"

const DB_NAME = "RestaurantOnboardingDB"
const STORE_NAME = "onboarding_files"
const FILE_KEY_PREFIXES = [
  "restaurant-profile",
  "pan-image",
  "gst-image",
  "fssai-image",
  ...Array.from({ length: 20 }, (_, i) => `menu-image-${i + 1}`),
]

let cachedDB = null

const isUploadableFile = (value) => {
  if (!value || typeof value !== "object") return false
  if (typeof File !== "undefined" && value instanceof File) return true
  if (typeof Blob !== "undefined" && value instanceof Blob) return true
  return (
    typeof value.size === "number" &&
    (typeof value.slice === "function" || typeof value.arrayBuffer === "function")
  )
}

const initDB = () =>
  new Promise((resolve) => {
    if (cachedDB) return resolve(cachedDB)
    if (typeof indexedDB === "undefined" || !indexedDB) return resolve(null)

    const timeoutId = setTimeout(() => resolve(null), 2000)
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
      request.onsuccess = (event) => {
        clearTimeout(timeoutId)
        cachedDB = event.target.result
        resolve(cachedDB)
      }
      request.onerror = () => {
        clearTimeout(timeoutId)
        resolve(null)
      }
    } catch {
      clearTimeout(timeoutId)
      resolve(null)
    }
  })

const saveFileToDB = async (key, file) => {
  if (!file) return removeFileFromDB(key)
  const db = await initDB()
  if (!db) return
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      store.put(file, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => resolve()
    } catch {
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
    } catch {
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
  } catch (error) {
    debugError("Error removing file from DB:", error)
  }
}

export const getOrCreateOnboardingSessionId = () => {
  if (typeof sessionStorage === "undefined") return "default"
  let sessionId = sessionStorage.getItem(ONBOARDING_SESSION_ID_KEY)
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(ONBOARDING_SESSION_ID_KEY, sessionId)
  }
  return sessionId
}

export const getOnboardingFileKey = (prefix) =>
  `${getOrCreateOnboardingSessionId()}:${prefix}`

const serializeDraftImage = async (value, fallbackPrefix) => {
  const fileKey = getOnboardingFileKey(fallbackPrefix)

  if (!value) {
    await removeFileFromDB(fileKey)
    await removeFileFromDB(fallbackPrefix)
    return null
  }

  if (isUploadableFile(value)) {
    await saveFileToDB(fileKey, value)
    return {
      kind: "db-file",
      dbKey: fileKey,
      name: value.name || `${fallbackPrefix}-${Date.now()}.jpg`,
      mimeType: value.type || "image/jpeg",
      lastModified: Number(value.lastModified || Date.now()),
    }
  }

  if (typeof value === "string" && value.startsWith("http")) return value
  if (value?.url && typeof value.url === "string") return value

  return null
}

export const restoreDraftImage = async (value, fallbackPrefix) => {
  if (!value) return null

  if (value?.kind === "db-file" && value?.dbKey) {
    try {
      let file = await getFileFromDB(value.dbKey)
      if (!file) {
        file = await getFileFromDB(fallbackPrefix)
      }
      if (file && (file instanceof File || file instanceof Blob)) {
        return file instanceof File
          ? file
          : new File([file], value.name || `${fallbackPrefix}.jpg`, {
              type: value.mimeType || file.type || "image/jpeg",
            })
      }
    } catch {
      return null
    }
  }

  if (value?.kind === "draft-file" && value?.dataUrl) {
    try {
      return convertBase64ToFile(
        value.dataUrl,
        value.mimeType || "image/jpeg",
        fallbackPrefix,
        value.name || "",
      )
    } catch {
      return null
    }
  }

  if (typeof value === "string" && value.startsWith("http")) return value
  if (value?.url && typeof value.url === "string") return value

  return null
}

const migrateLegacyLocalDraft = () => {
  if (typeof localStorage === "undefined" || typeof sessionStorage === "undefined") return null

  try {
    const existingSessionDraft = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
    if (existingSessionDraft) return null

    const legacyDraft =
      localStorage.getItem(ONBOARDING_DRAFT_KEY) ||
      localStorage.getItem(LEGACY_LOCAL_DRAFT_KEY)
    if (!legacyDraft) return null

    sessionStorage.setItem(ONBOARDING_DRAFT_KEY, legacyDraft)
    getOrCreateOnboardingSessionId()
    localStorage.removeItem(ONBOARDING_DRAFT_KEY)
    localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY)
    return JSON.parse(legacyDraft)
  } catch (error) {
    debugError("Failed to migrate legacy onboarding draft:", error)
    return null
  }
}

export const saveOnboardingDraft = async (step1, step2, step3, step4, currentStep) => {
  if (typeof sessionStorage === "undefined") return

  try {
    getOrCreateOnboardingSessionId()

    const serializedMenuImages = await Promise.all(
      (step2.menuImages || []).map((img, index) =>
        serializeDraftImage(img, `menu-image-${index + 1}`),
      ),
    )

    const serializableStep2 = {
      ...step2,
      menuImages: serializedMenuImages.filter(Boolean),
      profileImage: await serializeDraftImage(step2.profileImage, "restaurant-profile"),
    }

    const serializableStep3 = {
      ...step3,
      panImage: await serializeDraftImage(step3.panImage, "pan-image"),
      gstImage: await serializeDraftImage(step3.gstImage, "gst-image"),
      fssaiImage: await serializeDraftImage(step3.fssaiImage, "fssai-image"),
    }

    const dataToSave = {
      step1,
      step2: serializableStep2,
      step3: serializableStep3,
      step4: step4 || {},
      currentStep,
      timestamp: Date.now(),
    }

    sessionStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(dataToSave))
  } catch (error) {
    debugError("Failed to save onboarding draft:", error)
  }
}

export const loadOnboardingDraft = () => {
  migrateLegacyLocalDraft()

  if (typeof sessionStorage === "undefined") return null

  try {
    const stored = sessionStorage.getItem(ONBOARDING_DRAFT_KEY)
    if (stored) return JSON.parse(stored)
  } catch (error) {
    debugError("Failed to load onboarding draft:", error)
  }

  return null
}

export const clearOnboardingDraft = async () => {
  const sessionId =
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(ONBOARDING_SESSION_ID_KEY)
      : null

  const keysToClear = new Set(FILE_KEY_PREFIXES)
  if (sessionId) {
    FILE_KEY_PREFIXES.forEach((prefix) => keysToClear.add(`${sessionId}:${prefix}`))
  }

  await Promise.all([...keysToClear].map((key) => removeFileFromDB(key)))

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(ONBOARDING_DRAFT_KEY)
    sessionStorage.removeItem(ONBOARDING_SESSION_ID_KEY)
  }

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY)
    localStorage.removeItem(LEGACY_LOCAL_DRAFT_KEY)
  }
}

let onboardingFileCache = {
  step2: {
    menuImages: [],
    profileImage: null,
  },
  step3: {
    panImage: null,
    gstImage: null,
    fssaiImage: null,
  },
}

export const syncOnboardingFileCache = (step2, step3) => {
  onboardingFileCache = {
    step2: {
      menuImages: (step2?.menuImages || []).filter((img) => isUploadableFile(img)),
      profileImage: isUploadableFile(step2?.profileImage) ? step2.profileImage : null,
    },
    step3: {
      panImage: isUploadableFile(step3?.panImage) ? step3.panImage : null,
      gstImage: isUploadableFile(step3?.gstImage) ? step3.gstImage : null,
      fssaiImage: isUploadableFile(step3?.fssaiImage) ? step3.fssaiImage : null,
    },
  }
}

export const clearOnboardingFileCache = () => {
  onboardingFileCache = {
    step2: {
      menuImages: [],
      profileImage: null,
    },
    step3: {
      panImage: null,
      gstImage: null,
      fssaiImage: null,
    },
  }
}

export const getOnboardingFileCache = () => onboardingFileCache
