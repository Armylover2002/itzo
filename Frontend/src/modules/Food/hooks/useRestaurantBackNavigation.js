import { useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const toRestaurantPath = (value) => {
  if (typeof value !== "string") return null
  const trimmed = value.trim()

  if (!trimmed) return null
  if (trimmed.startsWith("/food/restaurant")) return trimmed
  if (trimmed === "/restaurant") return "/food/restaurant"
  if (trimmed.startsWith("/restaurant/")) return `/food${trimmed}`

  return null
}

const getNormalizedRestaurantPath = (pathname) => {
  if (pathname.startsWith("/food/restaurant")) {
    return pathname.slice("/food/restaurant".length) || "/"
  }

  return pathname || "/"
}

const resolveRestaurantBackPath = ({ pathname, state }) => {
  const normalizedPath = getNormalizedRestaurantPath(pathname)
  const explicitBackPath = toRestaurantPath(state?.backTo) || toRestaurantPath(state?.from)

  if (
    normalizedPath === "/orders/all" ||
    /^\/orders\/[^/]+$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/restaurant"
  }

  if (
    normalizedPath === "/food/all" ||
    /^\/food\/[^/]+$/.test(normalizedPath) ||
    /^\/food\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/restaurant/inventory"
  }

  if (
    normalizedPath === "/advertisements/new" ||
    /^\/advertisements\/[^/]+$/.test(normalizedPath) ||
    /^\/advertisements\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/restaurant/advertisements"
  }

  if (normalizedPath === "/advertisements") {
    return explicitBackPath || "/food/restaurant/explore"
  }

  if (
    normalizedPath === "/coupon/new" ||
    /^\/coupon\/[^/]+\/edit$/.test(normalizedPath)
  ) {
    return explicitBackPath || "/food/restaurant"
  }

  if (
    normalizedPath === "/edit-owner" ||
    normalizedPath === "/edit-address" ||
    normalizedPath === "/phone" ||
    normalizedPath === "/manage-outlets" ||
    normalizedPath === "/update-bank-details" ||
    normalizedPath === "/fssai" ||
    normalizedPath === "/fssai/update" ||
    normalizedPath === "/outlet-timings" ||
    /^\/outlet-timings\/[^/]+$/.test(normalizedPath) ||
    normalizedPath === "/zone-setup"
  ) {
    return explicitBackPath || "/food/restaurant/outlet-info"
  }

  if (normalizedPath === "/outlet-info") {
    return explicitBackPath || "/food/restaurant/explore"
  }

  if (
    normalizedPath === "/settings" ||
    normalizedPath === "/delivery-settings" ||
    normalizedPath === "/rush-hour" ||
    normalizedPath === "/status" ||
    normalizedPath === "/menu-categories"
  ) {
    return explicitBackPath || "/food/restaurant/inventory"
  }

  if (
    normalizedPath === "/terms" ||
    normalizedPath === "/privacy"
  ) {
    return explicitBackPath || "/food/restaurant/explore"
  }

  if (
    normalizedPath === "/reviews" ||
    /^\/reviews\/[^/]+\/reply$/.test(normalizedPath) ||
    normalizedPath === "/ratings-reviews" ||
    normalizedPath === "/dish-ratings"
  ) {
    return explicitBackPath || "/food/restaurant/feedback"
  }

  if (
    normalizedPath === "/help-centre/support" ||
    normalizedPath === "/share-feedback"
  ) {
    return explicitBackPath || "/food/restaurant/feedback"
  }

  if (
    normalizedPath === "/finance-details" ||
    normalizedPath === "/download-report"
  ) {
    return explicitBackPath || "/food/restaurant/hub-finance"
  }

  if (/^\/hub-menu\/item\/[^/]+$/.test(normalizedPath)) {
    return explicitBackPath || "/food/restaurant/inventory"
  }

  if (explicitBackPath && explicitBackPath !== pathname) {
    return explicitBackPath
  }

  return "/food/restaurant"
}

export default function useRestaurantBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(() => {
    navigate(resolveRestaurantBackPath(location))
  }, [location, navigate])
}
