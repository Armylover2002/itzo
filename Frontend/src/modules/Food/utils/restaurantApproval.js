export const extractRestaurantFromResponse = (response) =>
  response?.data?.data?.restaurant ||
  response?.data?.restaurant ||
  response?.data?.data?.user ||
  response?.data?.user ||
  null

export const restaurantHadPriorApproval = (restaurant) => {
  if (!restaurant) return false
  if (restaurant.wasEverApproved === true) return true
  if (restaurant.approvedAt) return true
  return String(restaurant?.status || "").toLowerCase() === "approved"
}

export const hasRestaurantReVerification = (restaurant) => {
  const rv = restaurant?.reVerification
  if (!rv || typeof rv !== "object") return false
  return Boolean(
    rv.reVerificationReason ||
      rv.isZoneUpdate ||
      rv.updatedZone ||
      rv.previousZone ||
      rv.previousAddress
  )
}

/** Block full-screen pending verification — only for first-time onboarding approval */
export const isRestaurantInitialPendingApproval = (restaurant) => {
  if (!restaurant) return false
  const status = String(restaurant?.status || "").toLowerCase()
  if (status !== "pending") return false
  if (restaurantHadPriorApproval(restaurant)) return false
  if (hasRestaurantReVerification(restaurant)) return false
  return true
}

export const isRestaurantApproved = (restaurant) => {
  const status = String(restaurant?.status || "").toLowerCase()
  if (status === "approved") return true
  if (restaurantHadPriorApproval(restaurant)) return true
  if (hasRestaurantReVerification(restaurant) && status === "pending") return true
  return restaurant?.isActive === true && status !== "pending" && status !== "rejected"
}

export const persistRestaurantAuthFromPayload = (payload, setAuthData) => {
  const accessToken = payload?.accessToken
  const refreshToken = payload?.refreshToken ?? null
  const restaurant = payload?.restaurant || payload?.user
  if (!accessToken || !restaurant) return false

  setAuthData("restaurant", accessToken, restaurant, refreshToken)
  window.dispatchEvent(new Event("restaurantAuthChanged"))
  return true
}
