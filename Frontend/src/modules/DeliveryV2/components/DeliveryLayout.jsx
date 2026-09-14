import { useLocation, useNavigate } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { setAppType } from "@common/utils/businessSettings"
import BottomNavigation from "./BottomNavigation"
import { getUnreadDeliveryNotificationCount } from "@food/utils/deliveryNotifications"
import { deliveryAPI } from "@food/api"

import useDeliveryPartnerHydration from '@/modules/DeliveryV2/hooks/useDeliveryPartnerHydration';

export default function DeliveryLayout({
  children,
  showGig = false,
  showPocket = false,
  onHomeClick,
  onGigClick
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const redirectedAfterApprovalRef = useRef(false)
  const [requestBadgeCount, setRequestBadgeCount] = useState(() =>
    getUnreadDeliveryNotificationCount()
  )
  const [approvalStatus, setApprovalStatus] = useState("loading")
  useDeliveryPartnerHydration()

  useEffect(() => {
    setAppType('delivery')

    let cancelled = false
    const syncApprovalStatus = async () => {
      try {
        const res = await deliveryAPI.getMe()
        if (cancelled) return
        const user = res?.data?.data?.user ?? res?.data?.user
        const status = user?.status ?? "approved"
        setApprovalStatus(status)
        if (user && typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("delivery_user", JSON.stringify(user))
          } catch (_) {}
        }
        if (
          String(status).toLowerCase() === "approved" &&
          !redirectedAfterApprovalRef.current
        ) {
          redirectedAfterApprovalRef.current = true
          navigate("/food/delivery", { replace: true })
        }
      } catch (_) {
        if (!cancelled) setApprovalStatus("pending")
      }
    }

    syncApprovalStatus()
    const intervalId = window.setInterval(syncApprovalStatus, 15000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [navigate])

  useEffect(() => {
    setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    const handleNotificationUpdate = () => {
      setRequestBadgeCount(getUnreadDeliveryNotificationCount())
    }
    window.addEventListener("deliveryNotificationsUpdated", handleNotificationUpdate)
    window.addEventListener("storage", handleNotificationUpdate)
    return () => {
      window.removeEventListener("deliveryNotificationsUpdated", handleNotificationUpdate)
      window.removeEventListener("storage", handleNotificationUpdate)
    }
  }, [location.pathname])

  const showBottomNav = [
    "/food/delivery",
    "/food/delivery/requests",
    "/food/delivery/trip-history",
    "/food/delivery/profile"
  ].includes(location.pathname)

  if (approvalStatus === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </main>
    )
  }

  if (approvalStatus !== "approved") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center space-y-4 rounded-xl bg-white p-6 shadow-sm border border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Pending Admin Approval</h1>
          <p className="text-gray-600 text-sm">
            Your profile has been submitted. You will get full access once admin approves your account.
          </p>
          <p className="text-gray-500 text-xs">This page auto-refreshes and redirects after approval.</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main>
        {children}
      </main>
      {showBottomNav && (
        <BottomNavigation
          showGig={showGig}
          showPocket={showPocket}
          onHomeClick={onHomeClick}
          onGigClick={onGigClick}
          requestBadgeCount={requestBadgeCount}
        />
      )}
    </>
  )
}

