import { useEffect, useState, useRef, useCallback } from "react"
import { MapPin, X } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { useLocation } from "@food/hooks/useLocation"
import {
  hasValidCoordinates,
  queryGeolocationPermission,
  isLocationPromptDismissed,
  dismissLocationPromptForSession,
  dismissLocationPromptPermanently,
  peekLocationPromptAfterLogin,
  clearLocationPromptAfterLogin,
} from "@food/utils/locationStorage"

const PROMPT_DELAY_MS = 600
const PROMPT_DELAY_AFTER_LOGIN_MS = 400

export default function LocationPrompt() {
  const { loading, requestLocation } = useLocation()
  const [showPrompt, setShowPrompt] = useState(false)
  const [permissionBlocked, setPermissionBlocked] = useState(false)
  const cardRef = useRef(null)
  const requestLocationRef = useRef(requestLocation)

  useEffect(() => {
    requestLocationRef.current = requestLocation
  }, [requestLocation])

  const animateIn = useCallback(() => {
    requestAnimationFrame(() => {
      if (!cardRef.current) return
      cardRef.current.style.opacity = "0"
      cardRef.current.style.transform = "translateY(20px)"
      requestAnimationFrame(() => {
        if (cardRef.current) {
          cardRef.current.style.opacity = "1"
          cardRef.current.style.transform = "translateY(0)"
        }
      })
    })
  }, [])

  const closePrompt = useCallback(() => {
    setShowPrompt(false)
    setPermissionBlocked(false)
    document.body.style.overflow = ""
  }, [])

  const openPrompt = useCallback(
    (blocked = false) => {
      setPermissionBlocked(blocked)
      setShowPrompt(true)
      document.body.style.overflow = "hidden"
      animateIn()
    },
    [animateIn],
  )

  // Run once on mount — avoids timer cancellation when geolocationPermission updates.
  useEffect(() => {
    let cancelled = false

    const tryShowPrompt = async () => {
      const afterLogin = peekLocationPromptAfterLogin()
      const permissionState = await queryGeolocationPermission()

      if (cancelled) return

      clearLocationPromptAfterLogin()

      // Browser already allowed: skip modal, refresh GPS silently (no popup needed).
      if (permissionState === "granted") {
        if (afterLogin) {
          requestLocationRef.current?.().catch(() => {})
        }
        return
      }

      const dismissed = isLocationPromptDismissed(permissionState)
      if (dismissed && !afterLogin) return

      // Show modal for: first visit, post-login, prompt, or blocked/denied.
      if (
        afterLogin ||
        permissionState === "prompt" ||
        permissionState === "denied"
      ) {
        openPrompt(permissionState === "denied")
      }
    }

    const delay = peekLocationPromptAfterLogin()
      ? PROMPT_DELAY_AFTER_LOGIN_MS
      : PROMPT_DELAY_MS

    const timer = window.setTimeout(tryShowPrompt, delay)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.body.style.overflow = ""
    }
  }, [openPrompt])

  const handleAllow = async () => {
    if (permissionBlocked) {
      closePrompt()
      dismissLocationPromptForSession()
      return
    }

    try {
      const loc = await requestLocation()
      if (hasValidCoordinates(loc)) {
        closePrompt()
        dismissLocationPromptPermanently()
      }
    } catch {
      // Keep modal open so the user can retry or dismiss.
    }
  }

  const handleDismiss = () => {
    closePrompt()
    dismissLocationPromptForSession()
  }

  if (!showPrompt) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-prompt-title"
    >
      <Card
        ref={cardRef}
        className="mx-auto my-auto w-full max-w-md border-2 border-gray-200 shadow-2xl"
      >
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <MapPin className="h-6 w-6 text-primary-orange" />
            </div>
            <div>
              <CardTitle id="location-prompt-title">
                {permissionBlocked
                  ? "Location Access Blocked"
                  : "Enable Location Services"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {permissionBlocked
                  ? "Allow location in your browser settings to continue"
                  : "Get faster delivery and better recommendations"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {permissionBlocked
              ? "Location is blocked for this site. Click the lock icon in your browser address bar, set Location to Allow, then reload this page. You can also pick a delivery address manually from the header."
              : "We use your location to show nearby restaurants and provide accurate delivery times. Your location data is stored locally and never shared."}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1"
            >
              Not Now
            </Button>
            <Button
              onClick={handleAllow}
              className="flex-1 bg-primary-orange text-white hover:opacity-90"
              disabled={loading && !permissionBlocked}
            >
              {permissionBlocked
                ? "Got It"
                : loading
                  ? "Getting location..."
                  : "Allow Location"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
