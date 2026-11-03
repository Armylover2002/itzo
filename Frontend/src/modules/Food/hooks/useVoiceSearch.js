import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/**
 * Mic button for the search boxes. Uses the browser's SpeechRecognition where it exists.
 * The Android app shell (WebView) has no speech API, so the old code just did nothing there;
 * `start()` now returns false in that case so the caller can focus the input, and the user is
 * told to use the keyboard's own mic instead.
 */
export function useVoiceSearch(onResult, { lang = "en-IN" } = {}) {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort()
      } catch {
        // already stopped
      }
    },
    [],
  )

  const start = useCallback(() => {
    const SpeechRecognition =
      typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SpeechRecognition) {
      toast.info("Voice search isn't available here. Tap the microphone on your keyboard to speak.")
      return false
    }

    // Second tap while listening stops it.
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch {
        // ignore
      }
      return true
    }

    const recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        toast.error("Microphone access is blocked. Allow it in your settings to use voice search.")
      } else if (event?.error === "no-speech") {
        toast.info("Didn't catch that. Please try again.")
      }
    }
    recognition.onresult = (event) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim()
      if (transcript) onResultRef.current?.(transcript)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setIsListening(false)
      recognitionRef.current = null
      return false
    }
    return true
  }, [isListening, lang])

  return { isListening, start }
}
