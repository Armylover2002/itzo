import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { restaurantAPI } from "@food/api"
import Loader from "@food/components/Loader"
import {
  getCurrentUser,
  isModuleAuthenticated,
  isRestaurantPendingApproval,
  updateStoredModuleUser,
} from "@food/utils/auth"
import {
  extractRestaurantFromResponse,
  isRestaurantApproved,
  isRestaurantInitialPendingApproval,
} from "@food/utils/restaurantApproval"

export default function RestaurantApprovalGuard({ children }) {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [redirectToPending, setRedirectToPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    const verifyApprovalStatus = async () => {
      if (!isModuleAuthenticated("restaurant")) {
        if (!cancelled) setChecking(false)
        return
      }

      const cachedUser = getCurrentUser("restaurant")
      if (isRestaurantPendingApproval(cachedUser)) {
        if (!cancelled) {
          setRedirectToPending(true)
          setChecking(false)
        }
        return
      }

      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const restaurant = extractRestaurantFromResponse(response)

        if (cancelled) return

        if (restaurant) {
          updateStoredModuleUser("restaurant", restaurant)

          const status = String(restaurant?.status || "").toLowerCase()
          if (!isRestaurantApproved(restaurant) && (isRestaurantInitialPendingApproval(restaurant) || status === "rejected")) {
            setRedirectToPending(true)
          }
        }
      } catch {
        // Allow dashboard render if status check fails while authenticated.
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    verifyApprovalStatus()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (checking) {
    return <Loader />
  }

  if (redirectToPending) {
    return (
      <Navigate
        to="/food/restaurant/pending-verification"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return children
}
