/**
 * Cross-platform file saving.
 *
 * Browsers handle `<a download>` with a blob URL fine, but Android/iOS webview
 * shells used for the APK never trigger a download for blob URLs, so the tap
 * silently does nothing. There we hand the file to the OS share sheet instead.
 */

export const isNativeAppShell = () => {
  if (typeof window === "undefined") return false
  const ua = String(window.navigator?.userAgent || "").toLowerCase()
  return (
    Boolean(window.flutter_inappwebview) ||
    Boolean(window.ReactNativeWebView) ||
    String(window.location?.protocol || "").toLowerCase() === "file:" ||
    ua.includes(" wv") ||
    ua.includes("; wv") ||
    ua.includes("flutterwebview")
  )
}

export const isMobileDevice = () => {
  if (typeof navigator === "undefined") return false
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "")
}

export const canSharePdfFiles = () => {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
  if (typeof File !== "function") return false

  try {
    const probe = new File(["%PDF-1.4"], "invoice.pdf", { type: "application/pdf" })
    return typeof navigator.canShare !== "function" || navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

const shareBlobFile = async (blob, fileName) => {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false
  if (typeof File !== "function") return false

  const mimeType = blob.type || "application/octet-stream"
  const file = new File([blob], fileName, { type: mimeType })
  if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
    return false
  }

  try {
    await navigator.share({
      files: [file],
      title: fileName,
    })
    return true
  } catch (error) {
    // User dismissing the share sheet is a successful outcome, not a failure to save.
    if (error?.name === "AbortError") return true
    return false
  }
}

/** Share a PDF blob via the native share sheet (WhatsApp, Drive, etc.). */
export const sharePdfBlob = async (blob, fileName) => {
  if (!blob) return false
  const pdfBlob =
    blob.type === "application/pdf"
      ? blob
      : new Blob([blob], { type: "application/pdf" })
  return shareBlobFile(pdfBlob, fileName)
}

const anchorDownload = async (blob, fileName) => {
  if (typeof document === "undefined") return false
  // WebView shells cannot reliably save via anchor clicks; use file share instead.
  if (isNativeAppShell()) return false

  let url = ""
  try {
    url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.rel = "noopener"
    link.style.display = "none"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch (error) {
    console.error("Download failed:", error)
    return false
  } finally {
    if (url) {
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }
  }
}

const openBlobInNewTab = (blob) => {
  if (typeof window === "undefined") return false
  const url = URL.createObjectURL(blob)
  const opened = window.open(url, "_blank")
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  return Boolean(opened)
}

/**
 * Saves a blob, returning true when the file reached the user by any route.
 * PDFs on mobile / WebView share as a file attachment first (WhatsApp, etc.).
 */
export const saveBlobAsFile = async (blob, fileName, options = {}) => {
  if (!blob) return false

  const isPdf =
    options.isPdf === true ||
    blob.type === "application/pdf" ||
    String(fileName || "").toLowerCase().endsWith(".pdf")

  const preferDownload = options.preferDownload === true

  const shouldSharePdfFirst =
    !preferDownload &&
    (options.preferShare === true ||
      (isPdf &&
        options.preferShare !== false &&
        (isNativeAppShell() || (isMobileDevice() && canSharePdfFiles()))))

  if (shouldSharePdfFirst && (await shareBlobFile(blob, fileName))) return true

  if (isPdf || preferDownload) {
    if (await anchorDownload(blob, fileName)) return true
    if (openBlobInNewTab(blob)) return true
  }

  if (!preferDownload && (await shareBlobFile(blob, fileName))) return true
  if (!isPdf && (await anchorDownload(blob, fileName))) return true

  return openBlobInNewTab(blob)
}

/**
 * Saves a jsPDF document. Falls back to jsPDF's own save() as a last resort.
 */
export const savePdfDocument = async (doc, fileName, options = {}) => {
  try {
    const blob = doc.output("blob")
    const saved = await saveBlobAsFile(blob, fileName, {
      isPdf: true,
      preferShare: options.preferShare,
      preferDownload: options.preferDownload,
    })
    if (saved) return true
  } catch {
    // Fall through to jsPDF's built-in save below.
  }

  try {
    doc.save(fileName)
    return true
  } catch {
    return false
  }
}
