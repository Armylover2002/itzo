import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toDeliveryPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()

  if (!trimmed) return null
  if (trimmed.startsWith("/food/delivery")) return trimmed
  if (trimmed === "/delivery") return "/food/delivery"
  if (trimmed.startsWith("/delivery/")) return `/food${trimmed}`

  return null
}

const getNormalizedDeliveryPath = (pathname) => {
  if (pathname.startsWith("/food/delivery")) {
    return pathname.slice("/food/delivery".length) || "/"
  }

  return pathname || "/"
}

const resolveDeliveryBackPath = ({ pathname, state }) => {
  const normalizedPath = getNormalizedDeliveryPath(pathname)
  const explicitBackPath = toDeliveryPath(state?.backTo) || toDeliveryPath(state?.from)

  if (normalizedPath === "/signup/details") {
    // Prefer explicit back target from Rejected → Edit/Create New.
    if (explicitBackPath) return explicitBackPath

    // Reapply flows keep rejection context in session — UI back must return to Rejected,
    // not the dead `/signup` alias that redirects to Login.
    try {
      const submissionType = sessionStorage.getItem("deliverySubmissionType")
      const isRejectedFlow = sessionStorage.getItem("deliveryIsRejected") === "true"
      if (
        isRejectedFlow ||
        submissionType === "edit_existing" ||
        submissionType === "new_onboarding"
      ) {
        return "/food/delivery/onboarding/rejected"
      }
    } catch {
      /* ignore */
    }

    return "/food/delivery/login"
  }
  if (normalizedPath === "/signup/documents") return "/food/delivery/signup/details"
  if (normalizedPath === "/otp") return explicitBackPath || "/food/delivery/login"
  if (normalizedPath === "/terms" || normalizedPath === "/privacy" || normalizedPath === "/support") {
    return explicitBackPath || "/food/delivery/login"
  }

  if (
    normalizedPath === "/profile/details" ||
    normalizedPath === "/profile/terms" ||
    normalizedPath === "/profile/privacy" ||
    normalizedPath === "/profile/support" ||
    normalizedPath === "/help/tickets"
  ) {
    return explicitBackPath || "/food/delivery/profile"
  }

  if (
    normalizedPath === "/profile/bank" ||
    normalizedPath === "/profile/documents"
  ) {
    return explicitBackPath || "/food/delivery/profile/details"
  }

  if (normalizedPath === "/help/id-card") {
    return explicitBackPath || "/food/delivery"
  }

  if (
    normalizedPath === "/help/tickets/create" ||
    /^\/help\/tickets\/[^/]+$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/delivery/help/tickets"
  }

  if (
    normalizedPath === "/pocket/payout" ||
    normalizedPath === "/pocket/statement" ||
    normalizedPath === "/pocket/deductions" ||
    normalizedPath === "/pocket/limit-settlement" ||
    normalizedPath === "/pocket/balance" ||
    normalizedPath === "/pocket/cash-limit" ||
    normalizedPath === "/pocket/details"
  ) {
    return explicitBackPath || "/food/delivery/pocket"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/food/delivery"
}

export default function useDeliveryBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    const path = resolveDeliveryBackPath(location)
    // Preserve Rejected → Signup backTo when returning documents → details.
    if (
      path === "/food/delivery/signup/details" &&
      location.state?.backTo
    ) {
      navigate(path, { state: { backTo: location.state.backTo } })
      return
    }
    navigate(path)
  }, [location, navigate])
}
