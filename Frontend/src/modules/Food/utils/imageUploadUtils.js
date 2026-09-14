import { toast } from "sonner"
import { compressImage } from "@/shared/utils/imageCompression"

const openTransientImageInput = ({
  onSelectFile,
  accept = "image/*",
  capture = undefined,
}) => {
  if (typeof document === "undefined") {
    throw new Error("Document is not available")
  }

  const input = document.createElement("input")
  input.type = "file"
  input.accept = accept
  input.multiple = false
  if (capture) {
    input.setAttribute("capture", capture)
  }

  input.style.position = "fixed"
  input.style.left = "-9999px"
  input.style.width = "1px"
  input.style.height = "1px"
  input.style.opacity = "0"
  input.style.pointerEvents = "none"

  const cleanup = () => {
    input.onchange = null
    input.oncancel = null
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }

  input.onchange = async (event) => {
    const file = event?.target?.files?.[0] || null
    if (file) {
      const compressed = await compressImage(file)
      onSelectFile(compressed)
    }
    cleanup()
  }

  input.oncancel = cleanup
  document.body.appendChild(input)

  if (typeof input.showPicker === "function") {
    try {
      input.showPicker()
      return
    } catch {
      // Fall back to the standard click-based picker below.
    }
  }

  input.click()
}

/**
 * Utility to convert base64 image data from Flutter bridge into a File object
 */
export const convertBase64ToFile = (
  base64Value,
  mimeType = "image/jpeg",
  fileNamePrefix = "upload",
  originalFileName = "",
) => {
  if (!base64Value || typeof base64Value !== "string") {
    throw new Error("Invalid base64 image data")
  }

  let pureBase64 = base64Value
  if (base64Value.includes(",")) {
    pureBase64 = base64Value.split(",")[1]
  }

  try {
    const byteCharacters = atob(pureBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    const normalizedFileName = String(originalFileName || "").trim()
    const extension = normalizedFileName.includes(".")
      ? normalizedFileName.split(".").pop()
      : mimeType.includes("png")
        ? "png"
        : mimeType.includes("webp")
          ? "webp"
          : "jpg"
    const blob = new Blob([byteArray], { type: mimeType })
    const fileName = normalizedFileName || `${fileNamePrefix}-${Date.now()}.${extension}`
    return new File([blob], fileName, { type: mimeType })
  } catch (error) {
    console.error("Base64 conversion failed:", error)
    throw new Error("Failed to process image data")
  }
}

/**
 * Standard browser camera fallback
 */
export const openBrowserCameraFallback = (onSelectFile) => {
  try {
    openTransientImageInput({
      onSelectFile,
      accept: "image/*",
      capture: "environment",
    })
  } catch (error) {
    console.error("Browser camera fallback failed:", error)
    toast.error("Could not open camera")
  }
}

/**
 * Check if the Flutter InAppWebView bridge is available
 */
export const isFlutterBridgeAvailable = () => {
  return (
    typeof window !== "undefined" &&
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === "function"
  )
}

/**
 * Open camera via Flutter bridge or browser fallback
 */
export const openCamera = async ({ onSelectFile, fileNamePrefix = "camera-photo", quality = 0.8 }) => {
  try {
    if (!isFlutterBridgeAvailable()) {
      openBrowserCameraFallback(onSelectFile)
      return
    }

    const result = await window.flutter_inappwebview.callHandler("openCamera", {
      source: "camera",
      accept: "image/*",
      multiple: false,
      quality: quality,
    })

    const isSuccess = result?.success === true || Boolean(result?.base64 || result?.base64String || result?.data?.base64)
    if (!result || !isSuccess) return

    let selectedFile = null
    const base64Value = result?.base64 || result?.base64String || result?.data?.base64
    const mimeType = result?.mimeType || result?.type || result?.data?.mimeType || "image/jpeg"
    const originalFileName = result?.fileName || result?.name || result?.data?.fileName || ""

    if (base64Value) {
      selectedFile = convertBase64ToFile(
        base64Value,
        mimeType,
        fileNamePrefix,
        originalFileName,
      )
    } else if (result.file instanceof File || result.file instanceof Blob) {
      selectedFile = result.file
    }

    if (!selectedFile || !String(selectedFile.type || "").startsWith("image/")) {
      toast.error("Failed to capture image")
      return
    }

    const compressed = await compressImage(selectedFile)
    onSelectFile(compressed)
  } catch (error) {
    console.error("Camera capture failed:", error)
    // Try fallback on bridge failure
    openBrowserCameraFallback(onSelectFile)
  }
}

/**
 * Open gallery via Flutter bridge or browser fallback
 */
export const openGallery = async ({ onSelectFile, fileNamePrefix = "gallery-photo", quality = 0.8 }) => {
  try {
    if (!isFlutterBridgeAvailable()) {
      openTransientImageInput({
        onSelectFile,
        accept: "image/*",
      })
      return
    }

    const result = await window.flutter_inappwebview.callHandler("openGallery", {
      source: "gallery",
      accept: "image/*",
      multiple: false,
      quality: quality,
    })

    const isSuccess = result?.success === true || Boolean(result?.base64 || result?.base64String || result?.data?.base64)
    
    // If the native openGallery handler is not registered or failed, fall back to browser upload
    if (!result || !isSuccess) {
      openTransientImageInput({
        onSelectFile,
        accept: "image/*",
      })
      return
    }

    let selectedFile = null
    const base64Value = result?.base64 || result?.base64String || result?.data?.base64
    const mimeType = result?.mimeType || result?.type || result?.data?.mimeType || "image/jpeg"
    const originalFileName = result?.fileName || result?.name || result?.data?.fileName || ""

    if (base64Value) {
      selectedFile = convertBase64ToFile(
        base64Value,
        mimeType,
        fileNamePrefix,
        originalFileName,
      )
    } else if (result.file instanceof File || result.file instanceof Blob) {
      selectedFile = result.file
    }

    if (!selectedFile || !String(selectedFile.type || "").startsWith("image/")) {
      toast.error("Failed to capture image")
      return
    }

    const compressed = await compressImage(selectedFile)
    onSelectFile(compressed)
  } catch (error) {
    console.error("Gallery pick failed:", error)
    openTransientImageInput({
      onSelectFile,
      accept: "image/*",
    })
  }
}
