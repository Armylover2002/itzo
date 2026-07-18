import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useParams, Link, useSearchParams, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import {
  ArrowLeft,
  Share2,
  RefreshCw,
  Download,
  Phone,
  User,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  MessageSquare,
  X,
  Check,
  Shield,
  Receipt,
  CircleSlash,
  Loader2,
  Star,
  Package
} from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Textarea } from "@food/components/ui/textarea"
import { useOptionalOrders } from "@food/context/OrdersContext"
import { useProfile } from "@food/context/ProfileContext"
import { useLocation as useUserLocation } from "@food/hooks/useLocation"
import DeliveryTrackingMap from "@food/components/user/DeliveryTrackingMap"
import { orderAPI, restaurantAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { useUserNotifications } from "@food/hooks/useUserNotifications"
import { customerApi } from "../../../../quickCommerce/user/services/customerApi"
import DeliveryOtpDisplay from "../../../../quickCommerce/user/components/DeliveryOtpDisplay"
import circleIcon from "@food/assets/circleicon.png"
import itzoLogo from "@/assets/Logo.png"
import { generateOrderInvoicePDF } from "@common/utils/pdfInvoiceUtils"
import { RESTAURANT_PIN_SVG, CUSTOMER_PIN_SVG, RIDER_BIKE_SVG } from "@food/constants/mapIcons"

// Fallback definitions in case imports fail at runtime or are shadowed
const DEFAULT_CUSTOMER_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#10B981"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/><circle cx="12" cy="9" r="3" fill="#FFFFFF"/></svg>`;
const SAFE_CUSTOMER_PIN = typeof CUSTOMER_PIN_SVG !== 'undefined' ? CUSTOMER_PIN_SVG : DEFAULT_CUSTOMER_PIN;
const DEFAULT_RESTAURANT_PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#FE5502"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.08.48 1.52 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5 14.5 7.62 14.5 9 13.38 11.5 12 11.5z"/><circle cx="12" cy="9" r="3" fill="#FFFFFF"/></svg>`;
const SAFE_RESTAURANT_PIN = typeof RESTAURANT_PIN_SVG !== 'undefined' ? RESTAURANT_PIN_SVG : DEFAULT_RESTAURANT_PIN;

const debugLog = (...args) => console.log('[OrderTracking]', ...args)
const debugWarn = (...args) => console.warn('[OrderTracking]', ...args)
const debugError = (...args) => console.error('[OrderTracking]', ...args)
const INVOICE_BRAND_NAME = "Itzo"


// Animated checkmark component
const AnimatedCheckmark = ({ delay = 0 }) => (
  <motion.svg
    width="80"
    height="80"
    viewBox="0 0 80 80"
    initial="hidden"
    animate="visible"
    className="mx-auto"
  >
    <motion.circle
      cx="40"
      cy="40"
      r="36"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    />
    <motion.path
      d="M24 40 L35 51 L56 30"
      fill="none"
      stroke="#22c55e"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay: delay + 0.4, ease: "easeOut" }}
    />
  </motion.svg>
)

// Real Delivery Map Component with User Live Location
const DeliveryMap = React.memo(({ orderId, order, isVisible, fallbackCustomerCoords = null, userLiveCoords = null, userLocationAccuracy = null, onEtaUpdate = null }) => {
  const toPointFromGeoJSON = (coords) => {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  // Memoize coordinates to prevent re-calculating on every parent render
  const restaurantCoords = useMemo(() => {
    // Try multiple sources for restaurant coordinates
    let coords = null;

    if (order?.restaurantLocation?.coordinates &&
      Array.isArray(order.restaurantLocation.coordinates) &&
      order.restaurantLocation.coordinates.length >= 2) {
      coords = order.restaurantLocation.coordinates;
    }
    else if (order?.restaurantId?.location?.coordinates &&
      Array.isArray(order.restaurantId.location.coordinates) &&
      order.restaurantId.location.coordinates.length >= 2) {
      coords = order.restaurantId.location.coordinates;
    }
    else if (order?.restaurantId?.location?.latitude && order?.restaurantId?.location?.longitude) {
      coords = [order.restaurantId.location.longitude, order.restaurantId.location.latitude];
    }

    const fromCoords = toPointFromGeoJSON(coords);
    if (fromCoords) return fromCoords;

    const fallbackLat = Number(order?.restaurantId?.location?.latitude || order?.restaurant?.location?.latitude);
    const fallbackLng = Number(order?.restaurantId?.location?.longitude || order?.restaurant?.location?.longitude);
    if (Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)) {
      return { lat: fallbackLat, lng: fallbackLng };
    }
    return null;
  }, [order?.restaurantId, order?.restaurantLocation, order?.restaurant]);

  const customerCoords = useMemo(() => {
    const coords = order?.address?.coordinates || order?.address?.location?.coordinates;
    const fromCoords = toPointFromGeoJSON(coords);
    if (fromCoords) return fromCoords;

    if (
      fallbackCustomerCoords &&
      Number.isFinite(fallbackCustomerCoords.lat) &&
      Number.isFinite(fallbackCustomerCoords.lng)
    ) {
      return fallbackCustomerCoords;
    }
    return null;
  }, [order?.address, fallbackCustomerCoords]);

  // Delivery boy data
  const deliveryBoyData = useMemo(() => order?.deliveryPartner ? {
    name: order.deliveryPartner.name || 'Delivery Partner',
    avatar: order.deliveryPartner.avatar || null
  } : null, [order?.deliveryPartner]);

  // Firebase and backend write tracking under order.orderId (string) or mongoId; subscribe to all so we receive updates
  const orderTrackingIdsList = useMemo(() => [
    order?.orderId,
    order?.mongoId,
    order?._id,
    orderId,
    order?.id
  ].filter(Boolean), [order?.orderId, order?.mongoId, order?._id, orderId, order?.id]);

  if (!isVisible || !orderId || !order || !restaurantCoords || !customerCoords) {
    return (
      <div
        className="relative min-h-[450px] bg-gradient-to-b from-gray-100 to-gray-200"
        style={{ height: '450px' }}
      />
    );
  }

  return (
    <div
      className="relative w-full min-h-[450px] overflow-visible"
      style={{ height: '450px' }}
    >
      <DeliveryTrackingMap
        orderId={orderId}
        orderTrackingIds={orderTrackingIdsList}
        restaurantCoords={restaurantCoords}
        customerCoords={customerCoords}

        userLiveCoords={userLiveCoords}
        userLocationAccuracy={userLocationAccuracy}
        deliveryBoyData={deliveryBoyData}
        order={order}
        onEtaUpdate={onEtaUpdate}
      />
    </div>
  );
});

// Section item component
const SectionItem = ({ icon: Icon, iconNode, title, subtitle, onClick, showArrow = true, rightContent }) => (
  <motion.button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left border-b border-dashed border-gray-200 last:border-0"
    whileTap={{ scale: 0.99 }}
  >
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {iconNode ? (
        <div
          className="w-6 h-6 flex-shrink-0 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
        >
          {iconNode}
        </div>
      ) : (
        <Icon className="w-5 h-5 text-gray-600 flex-shrink-0" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{title}</p>
      {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
    </div>
    {rightContent || (showArrow && <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />)}
  </motion.button>
)

const getRestaurantCoordsFromOrder = (apiOrder, fallback = null) => {
  if (
    apiOrder?.restaurantId?.location?.coordinates &&
    Array.isArray(apiOrder.restaurantId.location.coordinates) &&
    apiOrder.restaurantId.location.coordinates.length >= 2
  ) {
    return apiOrder.restaurantId.location.coordinates
  }
  if (apiOrder?.restaurantId?.location?.latitude && apiOrder?.restaurantId?.location?.longitude) {
    return [apiOrder.restaurantId.location.longitude, apiOrder.restaurantId.location.latitude]
  }
  if (
    apiOrder?.restaurant?.location?.coordinates &&
    Array.isArray(apiOrder.restaurant.location.coordinates) &&
    apiOrder.restaurant.location.coordinates.length >= 2
  ) {
    return apiOrder.restaurant.location.coordinates
  }
  return fallback || null
}

const getRestaurantAddressFromOrder = (apiOrder, previousOrder = null, explicitRestaurantAddress = null) => {
  if (explicitRestaurantAddress && String(explicitRestaurantAddress).trim()) {
    return String(explicitRestaurantAddress).trim()
  }

  const location = apiOrder?.restaurantId?.location || apiOrder?.restaurant?.location || {}

  if (location?.formattedAddress && String(location.formattedAddress).trim()) {
    return String(location.formattedAddress).trim()
  }
  if (location?.address && String(location.address).trim()) {
    return String(location.address).trim()
  }
  if (location?.addressLine1 && String(location.addressLine1).trim()) {
    return String(location.addressLine1).trim()
  }

  const parts = [location?.street, location?.area, location?.city, location?.state, location?.zipCode]
    .map((value) => (value == null ? '' : String(value).trim()))
    .filter(Boolean)

  if (parts.length > 0) return parts.join(', ')

  return previousOrder?.restaurantAddress || apiOrder?.restaurantAddress || apiOrder?.restaurant?.address || 'Restaurant location'
}

const getCustomerCoordsFromApiOrder = (apiOrder, previousOrder = null) => {
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {}
  const fromLoc = addr?.location?.coordinates
  if (Array.isArray(fromLoc) && fromLoc.length >= 2) return fromLoc
  const flat = addr?.coordinates
  if (Array.isArray(flat) && flat.length >= 2) return flat
  const prev = previousOrder?.address?.coordinates || previousOrder?.address?.location?.coordinates
  if (Array.isArray(prev) && prev.length >= 2) return prev
  return null
}

const buildAddressFromPickupPoint = (point) => {
  const raw = [
    point?.address,
    point?.formattedAddress,
    point?.location?.address,
    point?.location?.formattedAddress,
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean)

  if (raw) return raw

  const coords = point?.location?.coordinates
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0])
    const lat = Number(coords[1])
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    }
  }

  return ""
}

const buildPickupSources = (apiOrder, previousOrder = null, restaurantAddress = "") => {
  const pickupPoints = Array.isArray(apiOrder?.pickupPoints) ? apiOrder.pickupPoints : []
  const previousSources = Array.isArray(previousOrder?.pickupSources) ? previousOrder.pickupSources : []

  const normalized = pickupPoints
    .map((point, index) => {
      const pickupType = point?.pickupType === "quick" ? "quick" : "food"
      const fallbackAddress =
        pickupType === "food"
          ? restaurantAddress || previousOrder?.restaurantAddress || ""
          : ""

      return {
        id: point?.legId || `${pickupType}:${point?.sourceId || index}`,
        pickupType,
        label: pickupType === "quick" ? "Store" : "Restaurant",
        name: String(
          point?.sourceName ||
            (pickupType === "quick"
              ? "Seller Store"
              : apiOrder?.restaurantName || previousOrder?.restaurant || "Restaurant"),
        ).trim(),
        address: buildAddressFromPickupPoint(point) || fallbackAddress || "Address not available",
        phone:
          pickupType === "food"
            ? String(
                apiOrder?.restaurantPhone ||
                  apiOrder?.restaurantId?.phone ||
                  apiOrder?.restaurant?.phone ||
                  previousOrder?.restaurantPhone ||
                  "",
              ).trim()
            : String(point?.phone || point?.contactPhone || "").trim(),
      }
    })
    .filter((source) => source.name || source.address)

  if (normalized.length > 0) return normalized

  if (previousSources.length > 0) return previousSources

  return [
    {
      id: "food:primary",
      pickupType: "food",
      label: "Restaurant",
      name: String(apiOrder?.restaurantName || previousOrder?.restaurant || "Restaurant").trim(),
      address: restaurantAddress || previousOrder?.restaurantAddress || "Restaurant location",
      phone: String(
        apiOrder?.restaurantPhone ||
          apiOrder?.restaurantId?.phone ||
          apiOrder?.restaurant?.phone ||
          previousOrder?.restaurantPhone ||
          "",
      ).trim(),
    },
  ]
}

const getPartnerDisplayAvatar = (avatar, name = "Delivery Partner") => {
  const trimmedAvatar = String(avatar || "").trim()
  if (trimmedAvatar) return trimmedAvatar

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=eff6ff&color=1d4ed8&size=128`
}

const formatPartnerRating = (rating) => {
  const numericRating = Number(rating)
  if (!Number.isFinite(numericRating) || numericRating <= 0) return ""
  return numericRating.toFixed(1)
}

const formatInvoiceCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`

const formatInvoiceDateTime = (value) => {
  if (!value) return "N/A"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

const normalizeDeliveryPartner = (partnerRef, fallbackName = "Delivery Partner") => {
  if (!partnerRef) return null

  if (typeof partnerRef === "string") {
    return {
      id: partnerRef,
      name: fallbackName,
      phone: "",
      avatar: "",
      rating: null,
      totalRatings: 0,
    }
  }

  const name = String(
    partnerRef?.name ||
      partnerRef?.fullName ||
      partnerRef?.displayName ||
      fallbackName,
  ).trim() || fallbackName

  return {
    id: partnerRef?._id || partnerRef?.id || "",
    name,
    phone: String(partnerRef?.phone || partnerRef?.phoneNumber || "").trim(),
    avatar: String(
      partnerRef?.avatar ||
        partnerRef?.profilePicture ||
        partnerRef?.profileImage ||
        "",
    ).trim(),
    rating: Number.isFinite(Number(partnerRef?.rating)) ? Number(partnerRef.rating) : null,
    totalRatings: Number(partnerRef?.totalRatings || 0),
  }
}

const buildTrackingDeliveryPartners = (apiOrder, previousOrder = null) => {
  const previousPartners = Array.isArray(previousOrder?.deliveryPartners)
    ? previousOrder.deliveryPartners
    : []
  const legs = Array.isArray(apiOrder?.dispatchPlan?.legs) ? apiOrder.dispatchPlan.legs : []
  const seen = new Set()

  const normalizedLegPartners = legs
    .map((leg, index) => {
      const deliveryPartner = normalizeDeliveryPartner(
        leg?.deliveryPartnerId,
        leg?.pickupType === "quick" ? "Store Rider" : "Restaurant Rider",
      )

      if (!deliveryPartner?.id && !deliveryPartner?.name) return null

      const key = String(
        leg?.legId ||
          deliveryPartner?.id ||
          `${leg?.pickupType || "delivery"}:${leg?.sourceId || index}`,
      )

      if (seen.has(key)) return null
      seen.add(key)

      const pickupType = leg?.pickupType === "quick" ? "quick" : "food"
      const sourceLabel = pickupType === "quick" ? "Store pickup" : "Restaurant pickup"

      return {
        id: deliveryPartner?.id || key,
        legId: leg?.legId || key,
        pickupType,
        sourceId: leg?.sourceId || null,
        sourceName: String(leg?.sourceName || "").trim(),
        label: sourceLabel,
        statusText:
          pickupType === "quick"
            ? "Handling the store pickup for your express order"
            : "Handling the restaurant pickup for your express order",
        name: deliveryPartner.name,
        phone: deliveryPartner.phone,
        avatar: deliveryPartner.avatar,
        rating: deliveryPartner.rating,
        totalRatings: deliveryPartner.totalRatings,
      }
    })
    .filter(Boolean)

  if (normalizedLegPartners.length > 0) return normalizedLegPartners

  const singlePartner = normalizeDeliveryPartner(
    apiOrder?.deliveryPartnerId || apiOrder?.dispatch?.deliveryPartnerId,
    "Delivery Partner",
  )

  if (singlePartner) {
    return [
      {
        id: singlePartner.id || "primary-delivery-partner",
        legId: null,
        pickupType: "food",
        sourceId: null,
        sourceName: "",
        label: "Delivery partner",
        statusText: "Your delivery partner is arriving",
        name: singlePartner.name,
        phone: singlePartner.phone,
        avatar: singlePartner.avatar,
        rating: singlePartner.rating,
        totalRatings: singlePartner.totalRatings,
      },
    ]
  }

  return previousPartners
}

const transformOrderForTracking = (apiOrder, previousOrder = null, explicitRestaurantCoords = null, explicitRestaurantAddress = null) => {
  const restaurantCoords = explicitRestaurantCoords || getRestaurantCoordsFromOrder(apiOrder, previousOrder?.restaurantLocation?.coordinates)
  const restaurantAddress = getRestaurantAddressFromOrder(apiOrder, previousOrder, explicitRestaurantAddress)
  // API returns `deliveryAddress`; some paths use `address`
  const addr = apiOrder?.address || apiOrder?.deliveryAddress || {}
  const customerCoordsResolved = getCustomerCoordsFromApiOrder(apiOrder, previousOrder)
  const pickupSources = buildPickupSources(apiOrder, previousOrder, restaurantAddress)
  const deliveryPartners = buildTrackingDeliveryPartners(apiOrder, previousOrder)
  const primaryDeliveryPartner = deliveryPartners[0] || null

  return {
    id: apiOrder?.orderId || apiOrder?._id,
    mongoId: apiOrder?._id || null,
    orderId: apiOrder?.orderId || apiOrder?._id,
    restaurant: apiOrder?.restaurantName || previousOrder?.restaurant || (apiOrder?.orderType === 'quick' || /^QC/i.test(apiOrder?.orderId || apiOrder?._id) ? 'Store' : 'Restaurant'),
    orderType: apiOrder?.orderType || previousOrder?.orderType || 'food',
    restaurantPhone:
      apiOrder?.restaurantPhone ||
      apiOrder?.restaurantId?.phone ||
      apiOrder?.restaurantId?.ownerPhone ||
      apiOrder?.restaurant?.phone ||
      apiOrder?.restaurant?.ownerPhone ||
      previousOrder?.restaurantPhone ||
      '',
    restaurantAddress,
    restaurantId: apiOrder?.restaurantId || previousOrder?.restaurantId || null,
    userId: apiOrder?.userId || previousOrder?.userId || null,
    userName: apiOrder?.userName || apiOrder?.userId?.name || apiOrder?.userId?.fullName || previousOrder?.userName || '',
    userPhone: apiOrder?.userPhone || apiOrder?.userId?.phone || addr?.phone || apiOrder?.deliveryAddress?.phone || previousOrder?.userPhone || '',
    address: {
      street: addr?.street || previousOrder?.address?.street || '',
      city: addr?.city || previousOrder?.address?.city || '',
      state: addr?.state || previousOrder?.address?.state || '',
      zipCode: addr?.zipCode || previousOrder?.address?.zipCode || '',
      additionalDetails: addr?.additionalDetails || previousOrder?.address?.additionalDetails || '',
      phone: addr?.phone || apiOrder?.deliveryAddress?.phone || previousOrder?.address?.phone || '',
      formattedAddress: addr?.formattedAddress ||
        (addr?.street && addr?.city
          ? `${addr.street}${addr.additionalDetails ? `, ${addr.additionalDetails}` : ''}, ${addr.city}${addr.state ? `, ${addr.state}` : ''}${addr.zipCode ? ` ${addr.zipCode}` : ''}`
          : previousOrder?.address?.formattedAddress || addr?.city || ''),
      coordinates: customerCoordsResolved || addr?.location?.coordinates || previousOrder?.address?.coordinates || null
    },
    restaurantLocation: {
      coordinates: restaurantCoords
    },
    pickupSources,
    items: apiOrder?.items?.map(item => ({
      name: item.name,
      variantName: item.variantName || '',
      quantity: item.quantity,
      price: item.price
    })) || previousOrder?.items || [],
    total: apiOrder?.pricing?.total || previousOrder?.total || 0,
    // Backend canonical field is orderStatus; keep legacy `status` for UI compatibility.
    status: apiOrder?.orderStatus || apiOrder?.status || previousOrder?.status || 'pending',
    deliveryPartner: primaryDeliveryPartner || previousOrder?.deliveryPartner || null,
    deliveryPartners,
    deliveryPartnerId:
      primaryDeliveryPartner?.id ||
      apiOrder?.deliveryPartnerId?._id ||
      apiOrder?.deliveryPartnerId ||
      apiOrder?.dispatch?.deliveryPartnerId?._id ||
      apiOrder?.dispatch?.deliveryPartnerId ||
      apiOrder?.assignmentInfo?.deliveryPartnerId ||
      null,
    dispatch: apiOrder?.dispatch || previousOrder?.dispatch || null,
    assignmentInfo: apiOrder?.assignmentInfo || previousOrder?.assignmentInfo || null,
    tracking: apiOrder?.tracking || previousOrder?.tracking || {},
    deliveryState: apiOrder?.deliveryState || previousOrder?.deliveryState || null,
    createdAt: apiOrder?.createdAt || previousOrder?.createdAt || null,
    totalAmount: apiOrder?.pricing?.total || apiOrder?.totalAmount || previousOrder?.totalAmount || 0,
    deliveryFee: apiOrder?.pricing?.deliveryFee || apiOrder?.deliveryFee || previousOrder?.deliveryFee || 0,
    gst: apiOrder?.pricing?.tax || apiOrder?.pricing?.gst || apiOrder?.gst || apiOrder?.tax || previousOrder?.gst || 0,
    packagingFee: apiOrder?.pricing?.packagingFee || apiOrder?.packagingFee || 0,
    platformFee: apiOrder?.pricing?.platformFee || apiOrder?.platformFee || 0,
    discount: apiOrder?.pricing?.discount || apiOrder?.discount || 0,
    subtotal: apiOrder?.pricing?.subtotal || apiOrder?.subtotal || 0,
    paymentMethod: apiOrder?.paymentMethod || apiOrder?.payment?.method || previousOrder?.paymentMethod || null,
    payment: apiOrder?.payment || previousOrder?.payment || null,
    // Preserve delivery OTP code received via socket event.
    // API responses intentionally strip the secret code for security,
    // so without preserving it the UI would lose the OTP on each poll refresh.
    deliveryVerification: (() => {
      const prevDV = previousOrder?.deliveryVerification || null
      const apiDV = apiOrder?.deliveryVerification || null
      const handoverOtp = apiOrder?.handoverOtp || null
      
      if (!prevDV && !apiDV && !handoverOtp) return null

      const prevDropOtp = prevDV?.dropOtp || null
      const apiDropOtp = apiDV?.dropOtp || null
      
      const merged = {
        ...(prevDV || {}),
        ...(apiDV || {})
      }

      // Prioritize: 1. Real-time handoverOtp from current API response
      // 2. Previously preserved code in local state (from socket or earlier poll)
      // 3. Nested code field in API response (if ever present)
      const finalCode = handoverOtp || prevDropOtp?.code || apiDropOtp?.code

      if (finalCode || prevDropOtp?.required || apiDropOtp?.required) {
        merged.dropOtp = {
          ...(prevDropOtp || {}),
          ...(apiDropOtp || {}),
          code: finalCode
        }
      }
      return merged
    })(),
    returnRequest: apiOrder?.returnRequest || previousOrder?.returnRequest || null
  }
}

/**
 * Backend uses `orderStatus` (created, confirmed, preparing, ready_for_pickup, picked_up, delivered, cancelled_*).
 * This page used to read legacy `status` only — so UI never updated. Map canonical + legacy values to tracking steps.
 */
function mapBackendOrderStatusToUi(raw) {
  const s = String(raw || "").toLowerCase()
  if (!s || s === "pending" || s === "created") return "placed"
  if (s === "scheduled") return "scheduled"
  if (s === "confirmed" || s === "accepted") return "confirmed"
  if (s === "preparing" || s === "processed") return "preparing"
  if (s === "ready" || s === "ready_for_pickup" || s === "reached_pickup" || s === "order_confirmed") return "ready"
  if (s === "picked_up" || s === "out_for_delivery" || s === "en_route_to_delivery") return "on_way"
  if (s === "reached_drop" || s === "at_drop" || s === "at_delivery") return "at_drop"
  if (s === "delivered" || s === "completed") return "delivered"
  if (s.includes("cancelled") || s === "cancelled") return "cancelled"
  return "placed"
}

function mapOrderToTrackingUiStatus(orderLike) {
  if (!orderLike) return "placed"
  const statusRaw = orderLike.status || orderLike.orderStatus
  const phase = orderLike.deliveryState?.currentPhase

  // Terminal states handled first
  if (isFoodOrderCancelledStatus(statusRaw)) return "cancelled"
  if (statusRaw === "delivered" || statusRaw === "completed") return "delivered"

  // Live Ride / Phase-based mapping (Highest priority for precision)
  const isRiderAccepted = orderLike.dispatch?.status === "accepted" || orderLike.assignmentInfo?.status === "accepted" || orderLike.deliveryPartner?.status === "accepted";
  
  if (phase === "reached_drop" || phase === "at_drop" || statusRaw === "at_drop") return "at_drop"
  if (phase === "en_route_to_delivery" || statusRaw === "picked_up" || statusRaw === "out_for_delivery") return "on_way"
  if (phase === "at_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "at_pickup"
  if (phase === "en_route_to_pickup" && orderLike.deliveryPartnerId && isRiderAccepted) return "assigned"

  // Fallback to basic status mapping
  return mapBackendOrderStatusToUi(statusRaw)
}

/** Prefer live delivery phase when present (socket / polling include deliveryState). */
function isFoodOrderCancelledStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase()
  return s === "cancelled" || s.includes("cancelled")
}

function normalizeLookupId(value) {
  if (value == null) return ""
  const raw = String(value).trim()
  if (!raw || raw === "undefined" || raw === "null") return ""
  return raw
}

function extractOrderDetailsPayload(response) {
  if (response?.data?.success && response?.data?.result && typeof response.data.result === "object") {
    return response.data.result
  }
  if (response?.data?.success && response?.data?.data?.order) {
    return response.data.data.order
  }
  if (response?.data?.order && typeof response.data.order === "object") {
    return response.data.order
  }
  if (response?.data?.data && typeof response.data.data === "object" && !Array.isArray(response.data.data)) {
    return response.data.data.order || response.data.data
  }
  return null
}

function normalizeQuickWorkflowStatus(rawStatus) {
  const status = String(rawStatus || "").trim().toUpperCase()
  if (!status) return null
  if (status === "CREATED" || status === "PENDING") return "created"
  if (status === "CONFIRMED" || status === "ACCEPTED") return "confirmed"
  if (status === "PACKING" || status === "PREPARING" || status === "PROCESSING") return "preparing"
  if (status === "READY" || status === "READY_FOR_PICKUP") return "ready_for_pickup"
  if (status === "OUT_FOR_DELIVERY" || status === "PICKED_UP") return "out_for_delivery"
  if (status === "DELIVERED" || status === "COMPLETED") return "delivered"
  if (status.includes("CANCEL")) return "cancelled"
  return status.toLowerCase()
}

function normalizeQuickOrderForTracking(rawOrder) {
  if (!rawOrder || typeof rawOrder !== "object") return rawOrder

  const seller =
    rawOrder.seller ||
    rawOrder.store ||
    rawOrder.storeId ||
    rawOrder.sellerId ||
    {}

  const sellerCoords = Array.isArray(seller?.location?.coordinates)
    ? seller.location.coordinates
    : Number.isFinite(Number(seller?.location?.lng)) && Number.isFinite(Number(seller?.location?.lat))
      ? [Number(seller.location.lng), Number(seller.location.lat)]
      : null

  const sellerName = String(
    rawOrder.storeName ||
      rawOrder.sellerName ||
      seller?.name ||
      seller?.storeName ||
      "Store",
  ).trim()

  const sellerAddress = String(
    seller?.location?.formattedAddress ||
      seller?.location?.address ||
      seller?.address ||
      rawOrder.restaurantAddress ||
      rawOrder.storeAddress ||
      rawOrder.pickupAddress ||
      "",
  ).trim()

  const address = rawOrder.address || rawOrder.deliveryAddress || {}
  const addressCoords = Array.isArray(address?.location?.coordinates)
    ? address.location.coordinates
    : Number.isFinite(Number(address?.location?.lng)) && Number.isFinite(Number(address?.location?.lat))
      ? [Number(address.location.lng), Number(address.location.lat)]
      : null

  const deliveryPartner =
    rawOrder.deliveryPartnerId ||
    rawOrder.deliveryPartner ||
    rawOrder.deliveryBoy ||
    rawOrder.rider ||
    null

  return {
    ...rawOrder,
    orderType: "quick",
    restaurantName: rawOrder.restaurantName || sellerName,
    restaurantPhone:
      rawOrder.restaurantPhone ||
      seller?.phone ||
      seller?.phoneNumber ||
      "",
    restaurantId: rawOrder.restaurantId || seller || null,
    restaurantAddress: rawOrder.restaurantAddress || sellerAddress,
    status:
      rawOrder.status ||
      rawOrder.orderStatus ||
      normalizeQuickWorkflowStatus(rawOrder.workflowStatus) ||
      "created",
    orderStatus:
      rawOrder.orderStatus ||
      normalizeQuickWorkflowStatus(rawOrder.workflowStatus) ||
      rawOrder.status ||
      "created",
    address: {
      ...address,
      street: address?.street || address?.address || "",
      formattedAddress:
        address?.formattedAddress ||
        address?.address ||
        [address?.street, address?.city, address?.state, address?.zipCode]
          .filter(Boolean)
          .join(", "),
      location:
        addressCoords && !address?.location?.coordinates
          ? { ...(address.location || {}), coordinates: addressCoords }
          : address.location,
    },
    pickupPoints:
      Array.isArray(rawOrder.pickupPoints) && rawOrder.pickupPoints.length > 0
        ? rawOrder.pickupPoints
        : [
            {
              pickupType: "quick",
              sourceId: seller?._id || seller?.id || rawOrder.sellerId || rawOrder.storeId || "quick-store",
              sourceName: sellerName,
              phone: seller?.phone || seller?.phoneNumber || "",
              address: sellerAddress,
              location: sellerCoords
                ? {
                    coordinates: sellerCoords,
                    formattedAddress: sellerAddress,
                    address: sellerAddress,
                  }
                : undefined,
            },
          ],
    deliveryPartnerId: rawOrder.deliveryPartnerId || deliveryPartner || null,
  }
}

export default function OrderTracking() {
  const navigate = useNavigate()
  const companyName = useCompanyName()
  const { orderId } = useParams()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const confirmed = searchParams.get("confirmed") === "true"
  const prefetchedOrder =
    location.state?.prefetchedOrder ||
    location.state?.order ||
    null
  const isQuickOrder =
    String(location.state?.orderType || "").toLowerCase() === "quick" ||
    /^QC/i.test(String(orderId || ""))
  const backPath = isQuickOrder ? "/quick" : "/food/user"
  const ordersContext = useOptionalOrders()
  const getOrderById = ordersContext?.getOrderById || (() => null)
  const getOrderByIdRef = useRef(getOrderById)
  useEffect(() => {
    getOrderByIdRef.current = getOrderById
  }, [getOrderById])
  const { profile, getDefaultAddress } = useProfile()
  const { location: userLiveLocation } = useUserLocation()

  const { isConnected: isSocketConnected } = useUserNotifications()
  
  // State for order data
  const [order, setOrder] = useState(() =>
    prefetchedOrder
      ? transformOrderForTracking(
          isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder,
        )
      : null,
  )
  const [loading, setLoading] = useState(() => !prefetchedOrder)
  const [error, setError] = useState(null)

  const [showConfirmation, setShowConfirmation] = useState(confirmed)
  const [orderStatus, setOrderStatus] = useState(() => 
    prefetchedOrder 
      ? mapOrderToTrackingUiStatus(isQuickOrder ? normalizeQuickOrderForTracking(prefetchedOrder) : prefetchedOrder) 
      : 'placed'
  )
  const [estimatedTime, setEstimatedTime] = useState(29)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("")
  const [refundDestination, setRefundDestination] = useState("gateway")
  const [isCancelling, setIsCancelling] = useState(false)
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false)
  const [deliveryInstructions, setDeliveryInstructions] = useState("")
  const [isUpdatingInstructions, setIsUpdatingInstructions] = useState(false)
  const [resolvedLookupId, setResolvedLookupId] = useState("")
  const [timerNow, setTimerNow] = useState(Date.now())
  
  // Rating states
  const [ratingModal, setRatingModal] = useState({ open: false, order: null })
  const [selectedRestaurantRating, setSelectedRestaurantRating] = useState(null)
  const [selectedDeliveryRating, setSelectedDeliveryRating] = useState(null)
  const [restaurantFeedbackText, setRestaurantFeedbackText] = useState("")
  const [deliveryFeedbackText, setDeliveryFeedbackText] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)
  const [shownRatingForOrders, setShownRatingForOrders] = useState(() => {
    try {
      const stored = localStorage.getItem('shownRatingForOrders')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Save shown ratings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('shownRatingForOrders', JSON.stringify(Array.from(shownRatingForOrders)))
    } catch (error) {
      debugError('Error saving shownRatingForOrders to localStorage:', error)
    }
  }, [shownRatingForOrders])
  const handleEtaUpdate = useCallback((newEta) => setEstimatedTime(newEta), [])
  const lastRealtimeRefreshRef = useRef(0)
  const confirmationShownAtRef = useRef(confirmed ? Date.now() : 0)
  const trackingOrderIdsRef = useRef(new Set())
  const terminalPollStopRef = useRef(false)
  const lookupIdsRef = useRef([])
  const isInitialPollRequestedRef = useRef(null)
  const lastPollExecutionRef = useRef(0) // New: Hard throttle for extreme cases

  // Delivery handover OTP received via socket event.
  // Kept separately so UI still renders even if the event arrives
  // before the order API poll populates `order` state.
  const [socketDropOtpCode, setSocketDropOtpCode] = useState(null)

  useEffect(() => {
    if (!prefetchedOrder) return
    const normalizedPrefetched = isQuickOrder
      ? normalizeQuickOrderForTracking(prefetchedOrder)
      : prefetchedOrder
    setOrder((prev) => transformOrderForTracking(normalizedPrefetched, prev))
    setOrderStatus(mapOrderToTrackingUiStatus(normalizedPrefetched))
    setError(null)
    setLoading(false)
  }, [isQuickOrder, prefetchedOrder])


  // OTP received via socket event (deliveryDropOtp)
  useEffect(() => {
    const handleDeliveryDropOtp = (event) => {
      const detail = event?.detail || {}
      const otp = detail?.otp != null ? String(detail.otp) : null
      const evtOrderId = detail?.orderId != null ? String(detail.orderId) : null
      const evtOrderMongoId =
        detail?.orderMongoId != null ? String(detail.orderMongoId) : null

      if (!otp) return

      // If the order is already loaded, match by either orderId or mongoId.
      // Otherwise, match against the current URL param.
      const currentIds = [String(orderId)]
      if (order?.orderId) currentIds.push(String(order.orderId))
      if (order?.mongoId) currentIds.push(String(order.mongoId))
      if (order?._id) currentIds.push(String(order._id))

      const matches =
        (evtOrderId && currentIds.includes(evtOrderId)) ||
        (evtOrderMongoId && currentIds.includes(evtOrderMongoId))

      if (!matches) return

      // Always store so UI can render even if `order` hasn't loaded yet.
      setSocketDropOtpCode(otp)

      setOrder((prev) => {
        if (!prev) return prev
        const prevDV = prev.deliveryVerification || {}
        const prevDropOtp = prevDV.dropOtp || {}
        
        // Only update if code actually changed to avoid render loops
        if (prevDropOtp.code === otp) return prev;
        
        return {
          ...prev,
          deliveryVerification: {
            ...prevDV,
            dropOtp: {
              ...prevDropOtp,
              required: true,
              verified: false,
              code: otp
            }
          }
        }
      })
    }

    window.addEventListener('deliveryDropOtp', handleDeliveryDropOtp)
    return () => window.removeEventListener('deliveryDropOtp', handleDeliveryDropOtp)
  }, [orderId, order])

  // --------------------------------------------------------------------------
  // DATA FETCHING & POLLING STABILITY (FIXED FOR HAMMERING)
  // --------------------------------------------------------------------------

  // Socket notifications include order ids — keep a set so events match this page.
  useEffect(() => {
    const s = trackingOrderIdsRef.current
    s.add(String(orderId))
    if (order?.orderId) s.add(String(order.orderId))
    if (order?.mongoId) s.add(String(order.mongoId))
    if (order?.id) s.add(String(order.id))
  }, [orderId, order?.orderId, order?.mongoId, order?.id])

  useEffect(() => {
    const ids = [
      resolvedLookupId,
      orderId,
      order?.orderId,
      order?.mongoId,
      order?._id,
      order?.id,
    ]
      .map(normalizeLookupId)
      .filter(Boolean)
    lookupIdsRef.current = Array.from(new Set(ids))
  }, [orderId, resolvedLookupId, order?.orderId, order?.mongoId, order?._id, order?.id])

  // Stability Nuke: Move function bodies into a ref-protected execute flow
  const stableOpsRef = useRef({
    resolveOrderFromList: async (rawLookupId) => {
      const needle = normalizeLookupId(rawLookupId)
      if (!needle) return null
      if (isQuickOrder) return null
      const maxPages = 3
      const limit = 50

      for (let page = 1; page <= maxPages; page += 1) {
        const listResponse = await orderAPI.getOrders({ page, limit })
        let orders = []
        if (listResponse?.data?.success && listResponse?.data?.data?.orders) {
          orders = listResponse.data.data.orders || []
        } else if (listResponse?.data?.orders) {
          orders = listResponse.data.orders || []
        } else if (Array.isArray(listResponse?.data?.data?.data)) {
          orders = listResponse.data.data.data || []
        } else if (Array.isArray(listResponse?.data?.data)) {
          orders = listResponse.data.data || []
        }

        const matched = (orders || []).find((o) => {
          const candidates = [o?._id, o?.id, o?.orderId, o?.mongoId].map(normalizeLookupId)
          return candidates.includes(needle)
        })
        if (matched) return matched
        const totalPages = Number(listResponse?.data?.data?.pagination?.pages) || Number(listResponse?.data?.data?.totalPages) || 1
        if (page >= totalPages) break
      }
      return null
    },
    fetchOrderDetailsWithFallback: async (options = {}) => {
      const lookupIds = lookupIdsRef.current
      if (lookupIds.length === 0) throw new Error("Order id required")
      let lastError = null
      for (const id of lookupIds) {
        try {
          if (isQuickOrder) {
            return await customerApi.getOrderDetails(id, options)
          }
          return await orderAPI.getOrderDetails(id, options)
        } catch (err) {
          lastError = err
          if (err?.response?.status === 400 || err?.response?.status === 404) continue
          throw err
        }
      }
      throw lastError || new Error("Failed to fetch order details")
    }
  });

  const resolveOrderFromList = useCallback((id) => stableOpsRef.current.resolveOrderFromList(id), [])
  const fetchOrderDetailsWithFallback = useCallback((opts) => stableOpsRef.current.fetchOrderDetailsWithFallback(opts), [])

  // Clear OTP when order is finalized.
  useEffect(() => {
    if (!order) return
    const status = mapOrderToTrackingUiStatus(order)
    if (status === 'delivered' || status === 'cancelled') {
      setSocketDropOtpCode(null)


      setOrder((prev) => {
        if (!prev?.deliveryVerification?.dropOtp?.code) return prev
        return {
          ...prev,
          deliveryVerification: {
            ...(prev.deliveryVerification || {}),
            dropOtp: {
              ...(prev.deliveryVerification?.dropOtp || {}),
              code: null
            }
          }
        }
      })
    }
  }, [orderStatus, order])

  const defaultAddress = getDefaultAddress()
  const fallbackCustomerCoords = useMemo(() => {
    const orderCoords = order?.address?.coordinates || order?.address?.location?.coordinates
    if (Array.isArray(orderCoords) && orderCoords.length >= 2) {
      const lng = Number(orderCoords[0])
      const lat = Number(orderCoords[1])
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng }
      }
    }

    const defaultCoords = defaultAddress?.location?.coordinates
    if (Array.isArray(defaultCoords) && defaultCoords.length >= 2) {
      const lng = Number(defaultCoords[0])
      const lat = Number(defaultCoords[1])
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng }
      }
    }

    const liveLat = Number(userLiveLocation?.latitude)
    const liveLng = Number(userLiveLocation?.longitude)
    if (Number.isFinite(liveLat) && Number.isFinite(liveLng)) {
      return { lat: liveLat, lng: liveLng }
    }

    return null
  }, [
    order?.address?.coordinates,
    order?.address?.location?.coordinates,
    defaultAddress?.location?.coordinates,
    userLiveLocation?.latitude,
    userLiveLocation?.longitude
  ])

  const userLiveCoords = useMemo(() => {
    const lat = Number(userLiveLocation?.latitude)
    const lng = Number(userLiveLocation?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }, [userLiveLocation?.latitude, userLiveLocation?.longitude])

  const isAdminAccepted = useMemo(() => {
    const status = order?.status
    return [
      "confirmed",
      "preparing",
      "ready",
      "ready_for_pickup",
      "picked_up",
    ].includes(status)
  }, [order?.status])

  const isOnlinePaidForRefundChoice = useMemo(() => {
    if (isQuickOrder) return false

    const paymentMethod = String(order?.payment?.method || order?.paymentMethod || "").trim().toLowerCase()
    return ["razorpay", "razorpay_qr"].includes(paymentMethod)
  }, [isQuickOrder, order?.payment?.method, order?.paymentMethod])

  // Single source of truth: backend order.status (+ deliveryState phase for live ride)
  useEffect(() => {
    if (!order) return
    setOrderStatus(mapOrderToTrackingUiStatus(order))
  }, [
    order?.status,
    order?.deliveryState?.currentPhase,
    order?.deliveryState?.status,
  ])

  const acceptedAtMs = useMemo(() => {
    const timestamp =
      order?.tracking?.confirmed?.timestamp ||
      order?.tracking?.preparing?.timestamp ||
      order?.updatedAt ||
      order?.createdAt

    const parsed = timestamp ? new Date(timestamp).getTime() : NaN
    return Number.isFinite(parsed) ? parsed : null
  }, [order?.tracking?.confirmed?.timestamp, order?.tracking?.preparing?.timestamp, order?.updatedAt, order?.createdAt])

  const editWindowRemainingMs = useMemo(() => {
    if (!isAdminAccepted || !acceptedAtMs) return 0
    const remaining = 60000 - (timerNow - acceptedAtMs)
    return Math.max(0, remaining)
  }, [isAdminAccepted, acceptedAtMs, timerNow])

  const isEditWindowOpen = editWindowRemainingMs > 0

  const editWindowText = useMemo(() => {
    const totalSeconds = Math.ceil(editWindowRemainingMs / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }, [editWindowRemainingMs])

  const pickupSources = useMemo(() => {
    const rawSources = Array.isArray(order?.pickupSources) ? order.pickupSources : []
    return rawSources.filter((source) => source?.name || source?.address)
  }, [order?.pickupSources])

  const handleCallRestaurant = (e) => {
    // Prevent event bubbling if necessary
    if (e && e.stopPropagation) e.stopPropagation();

    const rawPhone =
      order?.restaurantPhone ||
      order?.restaurantId?.phone ||
      order?.restaurantId?.ownerPhone ||
      order?.restaurantId?.contact?.phone ||
      order?.restaurant?.phone ||
      order?.restaurant?.ownerPhone ||
      order?.restaurantId?.location?.phone ||
      '';

    const cleanPhone = String(rawPhone).replace(/[^\d+]/g, '');
    
    if (!cleanPhone || cleanPhone.length < 5) {
      toast.error(`${isQuickOrder ? 'Store' : 'Restaurant'} phone number not available`);
      return;
    }

    debugLog(`?? Attempting to call ${isQuickOrder ? 'store' : 'restaurant'}:`, cleanPhone);
    
    // Most compatible way to trigger dialer on overall mobile/web environments:
    // Create a temporary hidden anchor and programmatically click it.
    try {
      const link = document.createElement('a');
      link.href = `tel:${cleanPhone}`;
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      debugError('Call failed via link click:', err);
      // Last-ditch fallback
      window.location.assign(`tel:${cleanPhone}`);
    }
  };

  const handleCallPickupSource = (phone, e) => {
    if (e && e.stopPropagation) e.stopPropagation();

    const cleanPhone = String(phone || "").replace(/[^\d+]/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
      toast.error("Phone number not available");
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = `tel:${cleanPhone}`;
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      debugError('Call failed via pickup source link click:', err);
      window.location.assign(`tel:${cleanPhone}`);
    }
  };

  const handleCallRider = (phone, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    const rawPhone = phone || order?.deliveryPartner?.phone || '';
    const cleanPhone = String(rawPhone).replace(/[^\d+]/g, '');

    if (!cleanPhone || cleanPhone.length < 5) {
      toast.error('Rider phone number not available');
      return;
    }

    debugLog('?? Attempting to call rider:', cleanPhone);
    
    try {
      const link = document.createElement('a');
      link.href = `tel:${cleanPhone}`;
      link.setAttribute('target', '_self');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      debugError('Call failed via link click:', err);
      window.location.assign(`tel:${cleanPhone}`);
    }
  };

  const customerDeliveryOtp = useMemo(() => {
    const rawDropOtp = order?.deliveryVerification?.dropOtp
    const primitiveDropOtp =
      typeof rawDropOtp === "string" || typeof rawDropOtp === "number"
        ? rawDropOtp
        : null
    const codeFromOrder =
      order?.deliveryVerification?.dropOtp?.code ??
      order?.handoverOtp ??
      order?.deliveryOtp ??
      primitiveDropOtp
    const code = codeFromOrder ?? socketDropOtpCode
    return code ? String(code) : null
  }, [
    order?.deliveryVerification?.dropOtp?.code,
    order?.deliveryVerification?.dropOtp,
    order?.handoverOtp,
    order?.deliveryOtp,
    socketDropOtpCode,
  ])

  useEffect(() => {
    if (!isEditWindowOpen) return
    const interval = setInterval(() => {
      setTimerNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [isEditWindowOpen])

  // Poll for order updates (especially when delivery partner accepts)

  const pollRef = useRef(null);

  // Main fetch & polling core logic. (Isolated from socket connection stat-changes)
  useEffect(() => {
    if (!orderId) return;

    let isSubscribed = true;
    let requestInProgress = false;
    const NO_RESULT = Symbol("no-order-result");

    const poll = async (isInitial = false) => {
      if (!isSubscribed || requestInProgress) return;
      if (terminalPollStopRef.current && !isInitial) return;

      const now = Date.now();
      if (isInitial && now - lastPollExecutionRef.current < 1000 && order) return;
      if (isInitial) lastPollExecutionRef.current = now;

      // Check context immediately to avoid loaders if data exists locally
      if (isInitial) {
        const rawContext = isQuickOrder ? null : getOrderByIdRef.current(orderId);
        if (rawContext) {
          setOrder(transformOrderForTracking(rawContext));
          setLoading(false);
        }
      }

      requestInProgress = true;
      try {
        let response = null;
        let finalOrderData = null;

        if (isInitial && !isQuickOrder) {
          try {
            response = await fetchOrderDetailsWithFallback({ force: true });
            finalOrderData = extractOrderDetailsPayload(response);
            if (!finalOrderData) throw new Error("detail lookup returned empty payload");
          } catch (err) {
            // Propagate forbidden immediately to avoid unnecessary backend queries
            if (err?.response?.status === 403) {
              throw err;
            }
            try {
              finalOrderData = await resolveOrderFromList(orderId);
            } catch (listErr) {
              throw err;
            }
          }
        } else {
          response = await fetchOrderDetailsWithFallback({ force: isInitial });
          finalOrderData = extractOrderDetailsPayload(response);
        }

        if (!isSubscribed) return;

        if (finalOrderData) {
          setOrder(prev => {
            const transformedOrder = transformOrderForTracking(
              isQuickOrder ? normalizeQuickOrderForTracking(finalOrderData) : finalOrderData,
              prev,
            );
            const ui = mapOrderToTrackingUiStatus(transformedOrder);
            terminalPollStopRef.current = ui === 'delivered' || ui === 'cancelled';
            return transformedOrder;
          });
          setError(null);
          setLoading(false);
          return;
        }

        if (isInitial && !order) {
          setError(response?.data?.message || 'Order not found');
          terminalPollStopRef.current = true;
        }
      } catch (err) {
        if (isInitial && !order) {
          if (!isSubscribed) return;
          setError(err.response?.data?.message || err.message || 'Failed to fetch order details');
          terminalPollStopRef.current = true;
        }
      } finally {
        requestInProgress = false;
        if (isInitial && isSubscribed) setLoading(false);
      }
    };

    pollRef.current = poll;
    terminalPollStopRef.current = false;

    if (isInitialPollRequestedRef.current !== orderId) {
      isInitialPollRequestedRef.current = orderId;
      poll(true);
    }

    return () => {
      isSubscribed = false;
      isInitialPollRequestedRef.current = null;
    };
  }, [isQuickOrder, orderId, fetchOrderDetailsWithFallback, resolveOrderFromList]);

  // Interval Manager (dynamically adapts based on socket connection state independently)
  useEffect(() => {
    if (!orderId) return;

    const tick = () => {
      if (terminalPollStopRef.current) return;
      if (document.hidden) return;
      // Delegate to the latest instance of our polling function capturing current state
      if (pollRef.current) pollRef.current(false);
    };
    
    const pollInterval = (isSocketConnected || window.orderSocketConnected) ? 12000 : 5000;
    const interval = setInterval(tick, pollInterval);

    return () => clearInterval(interval);
  }, [orderId, isSocketConnected]);

  useEffect(() => {
    if (!order) return
    const ui = mapOrderToTrackingUiStatus(order)
    terminalPollStopRef.current = ui === 'delivered' || ui === 'cancelled'
  }, [order])

  // Post-checkout splash only — real status comes from API / poll / socket.
  useEffect(() => {
    if (!confirmed) return
    confirmationShownAtRef.current = Date.now()
    setShowConfirmation(true)
  }, [confirmed, orderId])

  useEffect(() => {
    if (!showConfirmation) return

    const elapsed = Date.now() - confirmationShownAtRef.current
    const minVisibleMs = 250
    const maxVisibleMs = 700
    const hasResolvedData = Boolean(order) || Boolean(error) || !loading
    const remaining = hasResolvedData
      ? Math.max(0, minVisibleMs - elapsed)
      : Math.max(0, maxVisibleMs - elapsed)

    const timer1 = setTimeout(() => setShowConfirmation(false), remaining)
    return () => clearTimeout(timer1)
  }, [showConfirmation, order, error, loading])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEstimatedTime((prev) => Math.max(0, prev - 1))
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Auto-show rating popup when order is delivered
  useEffect(() => {
    if (orderStatus !== 'delivered' || !order || ratingModal.open) return;

    const orderIdToRate = order.orderId || order.mongoId || order._id || orderId;
    if (!orderIdToRate) return;

    const idStr = String(orderIdToRate);
    const hasShownPopup = shownRatingForOrders.has(idStr);
    
    // Check if already rated (using structure from transformOrderForTracking)
    const hasRestaurantRating = Number.isFinite(Number(order.ratings?.restaurant?.rating));
    const hasDeliveryPartner = !!order.deliveryPartnerId;
    const hasDeliveryRating = Number.isFinite(Number(order.ratings?.deliveryPartner?.rating));
    const hasRating = hasRestaurantRating && (!hasDeliveryPartner || hasDeliveryRating);

    if (!hasRating && !hasShownPopup) {
      debugLog('? Auto-triggering rating popup for delivered order:', idStr);
      
      // Mark as shown to avoid re-triggering
      setShownRatingForOrders(prev => {
        const next = new Set(prev);
        next.add(idStr);
        return next;
      });

      // Show after a short delay for better UX
      const timer = setTimeout(() => {
        setRatingModal({ open: true, order: order });
        setSelectedRestaurantRating(null);
        setSelectedDeliveryRating(null);
        setRestaurantFeedbackText("");
        setDeliveryFeedbackText("");
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [orderStatus, order, shownRatingForOrders, ratingModal.open, orderId]);

  // Listen for order status updates from socket (e.g., "Delivery partner on the way")
  useEffect(() => {
    const handleOrderStatusNotification = (event) => {
      const payload = event?.detail || {};
      const { message, status, estimatedDeliveryTime, orderId: evtOrderId, orderMongoId } = payload;

      const evtKeys = [evtOrderId, orderMongoId, payload?._id].filter(Boolean).map(String)
      const idMatches =
        evtKeys.length === 0 ||
        evtKeys.some((k) => String(k) === String(orderId)) ||
        evtKeys.some((k) => trackingOrderIdsRef.current.has(k))

      debugLog('?? Order status notification received:', { message, status, idMatches });

      if (idMatches) {
        const next = mapOrderToTrackingUiStatus({
          status,
          orderStatus: payload.orderStatus || status,
          deliveryState: payload.deliveryState,
        });
        setOrderStatus(next);

        // Pull latest order state without refresh spam on bursty socket events.
        const now = Date.now();
        if (now - lastRealtimeRefreshRef.current > 1500 && !isRefreshing) {
          lastRealtimeRefreshRef.current = now;
          handleRefresh();
        }
      }

      // Show notification toast
      if (message) {
        toast.success(message, {
          id: `order-status-${orderId}`,
          duration: 4000,
          description: estimatedDeliveryTime
            ? `Estimated delivery in ${Math.round(estimatedDeliveryTime / 60)} minutes`
            : undefined
        });

        // Optional: Vibrate device if supported
        if (navigator.vibrate) {
          navigator.vibrate([100]);
        }
      }
    };

    // Listen for custom event from DeliveryTrackingMap
    window.addEventListener('orderStatusNotification', handleOrderStatusNotification);

    return () => {
      window.removeEventListener('orderStatusNotification', handleOrderStatusNotification);
    };
  }, [orderId])

  const handleCancelOrder = () => {
    // Check if order can be cancelled (only Razorpay orders that aren't delivered/cancelled)
    if (!order) return;

    if (isAdminAccepted && !isEditWindowOpen) {
      toast.error('Cancellation window ended. You can no longer cancel this order.');
      return;
    }

    if (order.status === 'cancelled') {
      toast.error('Order is already cancelled');
      return;
    }

    if (order.status === 'delivered') {
      toast.error('Cannot cancel a delivered order');
      return;
    }

    // Allow cancellation for all payment methods (Razorpay, COD, Wallet)
    // Only restrict if order is already cancelled or delivered (checked above)

    setRefundDestination(
      order?.payment?.refund?.requestedMethod === "wallet" ? "wallet" : "gateway",
    )
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsCancelling(true);
    try {
      const cancelLookupId =
        lookupIdsRef.current[0] || normalizeLookupId(orderId)
      const response = isQuickOrder
        ? await customerApi.cancelOrder(cancelLookupId)
        : await orderAPI.cancelOrder(cancelLookupId, {
            reason: cancellationReason.trim(),
            ...(isOnlinePaidForRefundChoice ? { refundTo: refundDestination } : {}),
          });
      if (response.data?.success) {
        const paymentMethod = order?.payment?.method || order?.paymentMethod;
        const successMessage = response.data?.message ||
          (paymentMethod === 'cash' || paymentMethod === 'cod'
            ? 'Order cancelled successfully. No refund required as payment was not made.'
            : `Order cancelled successfully. Refund will be reviewed by admin and sent to ${
                refundDestination === "wallet" ? "your wallet" : "your original payment method"
              }.`);
        toast.success(successMessage);
        setShowCancelDialog(false);
        setCancellationReason("");
        setRefundDestination("gateway");
        // Refresh order data
        const orderResponse = await fetchOrderDetailsWithFallback({ force: true });
        if (orderResponse.data?.success && orderResponse.data.data?.order) {
          const apiOrder = orderResponse.data.data.order;
          setOrder(transformOrderForTracking(apiOrder, order));
        }
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      debugError('Error cancelling order:', error);
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateInstructions = async () => {
    try {
      if (isQuickOrder || typeof orderAPI.updateOrderInstructions !== "function") {
        toast.error("Delivery instructions update is not available for this order yet");
        return;
      }
      setIsUpdatingInstructions(true);
      const response = await orderAPI.updateOrderInstructions(resolvedLookupId || orderId, deliveryInstructions);
      if (response.data?.success) {
        toast.success("Delivery instructions updated");
        setIsInstructionsModalOpen(false);
        const updatedOrder = response.data.data?.order;
        if (updatedOrder) {
          setOrder(prev => transformOrderForTracking(updatedOrder, prev));
        } else {
          setOrder(prev => ({ ...prev, note: deliveryInstructions }));
        }
      } else {
        toast.error(response.data?.message || "Failed to update instructions");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update instructions");
    } finally {
      setIsUpdatingInstructions(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Track my order from ${order?.restaurant || companyName}`,
          text: `Hey! Track my order from ${order?.restaurant || companyName} with ID #${order?.orderId || order?.id}.`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Tracking link copied to clipboard!");
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        debugError('Error sharing:', error);
        toast.error("Failed to share link");
      }
    }
  };

  const handleCloseRating = () => {
    setRatingModal({ open: false, order: null })
    setSelectedRestaurantRating(null)
    setSelectedDeliveryRating(null)
    setRestaurantFeedbackText("")
    setDeliveryFeedbackText("")
  }

  const handleSubmitRating = async () => {
    const hasDeliveryPartner = !!order?.deliveryPartnerId;
    const isMissingDeliveryRating = hasDeliveryPartner && selectedDeliveryRating === null;
    
    if (!order || selectedRestaurantRating === null || isMissingDeliveryRating) {
      toast.error("Please select all required ratings first");
      return;
    }

    try {
      setSubmittingRating(true);
      const targetId = order.mongoId || order._id || orderId;
      
      const response = await orderAPI.submitOrderRatings(targetId, {
        restaurantRating: selectedRestaurantRating,
        deliveryPartnerRating: hasDeliveryPartner ? selectedDeliveryRating : undefined,
        restaurantComment: restaurantFeedbackText || undefined,
        deliveryPartnerComment: hasDeliveryPartner ? (deliveryFeedbackText || undefined) : undefined,
      });

      const updatedOrderData = response?.data?.data?.order || response?.data?.order || null;
      
      if (updatedOrderData) {
        setOrder(prev => transformOrderForTracking(updatedOrderData, prev));
      } else {
        // Fallback update if API response doesn't include the full order
        setOrder(prev => ({
          ...prev,
          ratings: {
            ...prev.ratings,
            restaurant: { rating: selectedRestaurantRating, comment: restaurantFeedbackText },
            deliveryPartner: hasDeliveryPartner ? { rating: selectedDeliveryRating, comment: deliveryFeedbackText } : undefined
          }
        }));
      }

      toast.success("Thanks for rating your order!");
      handleCloseRating();
    } catch (error) {
      debugError("Error submitting order ratings:", error);
      toast.error(error?.response?.data?.message || "Failed to submit ratings. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetchOrderDetailsWithFallback({ force: true })
      const apiOrder = extractOrderDetailsPayload(response)
      if (apiOrder) {
        const normalizedOrder = isQuickOrder
          ? normalizeQuickOrderForTracking(apiOrder)
          : apiOrder

        // Extract restaurant location coordinates with multiple fallbacks
        let restaurantCoords = null;
        let restaurantAddress = null;

        // Priority 1: restaurantId.location.coordinates (GeoJSON format: [lng, lat])
        if (normalizedOrder.restaurantId?.location?.coordinates &&
          Array.isArray(normalizedOrder.restaurantId.location.coordinates) &&
          normalizedOrder.restaurantId.location.coordinates.length >= 2) {
          restaurantCoords = normalizedOrder.restaurantId.location.coordinates;
        }
        // Priority 2: restaurantId.location with latitude/longitude properties
        else if (normalizedOrder.restaurantId?.location?.latitude && normalizedOrder.restaurantId?.location?.longitude) {
          restaurantCoords = [normalizedOrder.restaurantId.location.longitude, normalizedOrder.restaurantId.location.latitude];
        }
        // Priority 3: Check nested restaurant data
        else if (normalizedOrder.restaurant?.location?.coordinates) {
          restaurantCoords = normalizedOrder.restaurant.location.coordinates;
        }
        // Priority 4: Check if restaurantId is a string ID and fetch restaurant details
        else if (!isQuickOrder && typeof normalizedOrder.restaurantId === 'string') {
          debugLog('?? restaurantId is a string ID, fetching restaurant details...', normalizedOrder.restaurantId);
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(normalizedOrder.restaurantId);
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              const restaurant = restaurantResponse.data.data.restaurant;
              if (restaurant.location?.coordinates && Array.isArray(restaurant.location.coordinates) && restaurant.location.coordinates.length >= 2) {
                restaurantCoords = restaurant.location.coordinates;
                debugLog('? Fetched restaurant coordinates from API:', restaurantCoords);
              }
              restaurantAddress =
                restaurant?.location?.formattedAddress ||
                restaurant?.location?.address ||
                restaurant?.address ||
                null;
            }
          } catch (err) {
            debugError('? Error fetching restaurant details:', err);
          }
        }

        setOrder(transformOrderForTracking(normalizedOrder, order, restaurantCoords, restaurantAddress))
        setOrderStatus(mapOrderToTrackingUiStatus(normalizedOrder))
      }
    } catch (err) {
      debugError('Error refreshing order:', err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDownloadInvoice = useCallback(async () => {
    if (!order) {
      toast.error("Order details are not ready yet")
      return
    }
    try {
      await generateOrderInvoicePDF(order, itzoLogo)
      toast.success("Invoice downloaded")
    } catch (error) {
      debugError("Error generating invoice PDF:", error)
      toast.error("Failed to download invoice")
    }
  }, [order, orderStatus, profile?.name, profile?.phone])

  // --------------------------------------------------------------------------
  // RENDER (Final JSX)
  // --------------------------------------------------------------------------

  // Loading state (moved after hooks)
  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </AnimatedPage>
    )
  }

  // Error state (moved after hooks)
  if (error || !order) {
    return (
      <AnimatedPage className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-lg mx-auto text-center py-20">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The order you\'re looking for doesn\'t exist.'}</p>
          <Link to={backPath}>
            <Button>Back to Orders</Button>
          </Link>
        </div>
      </AnimatedPage>
    )
  }

  const statusConfig = {
    scheduled: {
      title: "Order Scheduled",
      subtitle: isQuickOrder ? "Your order is scheduled. Please wait for the store to respond." : "Your order is scheduled. Please wait for the restaurant to respond.",
      color: "bg-primary",
      iconType: 'food'
    },
    placed: {
      title: "Order Placed",
      subtitle: isQuickOrder ? "Waiting for store to accept" : "Waiting for restaurant to accept",
      color: "bg-green-600",
      iconType: 'food'
    },
    confirmed: {
      title: "Order Confirmed",
      subtitle: isQuickOrder ? "Store has accepted your order" : "Restaurant has accepted your order",
      color: "bg-green-600",
      iconType: 'food'
    },
    preparing: {
      title: isQuickOrder ? "Items are being packed" : "Food is being prepared",
      subtitle: typeof estimatedTime === 'number' ? `Arriving in ${estimatedTime} mins` : (isQuickOrder ? "Packing your items" : "Cooking your meal"),
      color: "bg-green-600",
      iconType: 'food'
    },
    assigned: {
      title: "Rider is arriving",
      subtitle: isQuickOrder ? "A delivery partner is arriving at the store" : "A delivery partner is arriving at the restaurant",
      color: "bg-green-600",
      iconType: 'rider'
    },
    at_pickup: {
      title: isQuickOrder ? "Rider at store" : "Rider at restaurant",
      subtitle: "Rider is waiting for your order",
      color: "bg-green-600",
      iconType: 'rider'
    },
    ready: {
      title: "Handover in progress",
      subtitle: "Rider is picking up your order",
      color: "bg-green-600",
      iconType: 'rider'
    },
    on_way: {
      title: "Out for delivery",
      subtitle: typeof estimatedTime === 'number' ? `Arriving in ${estimatedTime} mins` : "Rider is out for delivery",
      color: "bg-green-600",
      iconType: 'rider'
    },
    at_drop: {
      title: "Arrived at location",
      subtitle: "Please come to the door",
      color: "bg-green-600",
      iconType: 'rider'
    },
    delivered: {
      title: "Order delivered",
      subtitle: isQuickOrder ? "Enjoy your purchase!" : "Enjoy your meal!",
      color: "bg-green-600",
      iconType: 'delivered'
    },
    cancelled: {
      title: "Order cancelled",
      subtitle: "This order has been cancelled",
      color: "bg-red-600",
      iconType: 'cancelled'
    }
  }

  const currentStatus = statusConfig[orderStatus] || statusConfig.placed
  const isDeliveredOrder =
    orderStatus === "delivered" ||
    order?.status === "delivered" ||
    Boolean(order?.deliveredAt)
  const visibleDeliveryPartners = Array.isArray(order?.deliveryPartners)
    ? order.deliveryPartners.filter(Boolean)
    : []
  const hasMultipleDeliveryPartners = visibleDeliveryPartners.length > 1
  const hasActiveDeliveryTracking =
    visibleDeliveryPartners.length > 0 ||
    Boolean(order?.deliveryPartnerId) ||
    Boolean(order?.deliveryState?.currentLocation) ||
    ['assigned', 'at_pickup', 'ready', 'on_way', 'at_drop', 'delivered'].includes(orderStatus)
  const previewPickupSource = pickupSources[0] || null
  const previewPickupLabel =
    previewPickupSource?.pickupType === 'quick'
      ? 'Store'
      : order?.orderType === 'mixed'
        ? 'Pickup point'
        : 'Restaurant'
  const previewPickupAddress =
    previewPickupSource?.address ||
    order?.restaurantAddress ||
    'Preparing pickup location'
  const previewDropAddress =
    order?.address?.formattedAddress ||
    [
      order?.address?.street,
      order?.address?.additionalDetails,
      order?.address?.city,
      order?.address?.state,
      order?.address?.zipCode,
    ]
      .filter(Boolean)
      .join(', ') ||
    'Preparing delivery address'

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
      {/* Order Confirmed Modal */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#1a1a1a] flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="text-center px-8"
            >
              <AnimatedCheckmark delay={0.3} />
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="text-2xl font-bold text-gray-900 mt-6"
              >
                Order Confirmed!
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="text-gray-600 mt-2"
              >
                Your order has been placed successfully
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="mt-8"
              >
                <div className="w-8 h-8 border-2 border-[#FE5502] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-3">Loading order details...</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Green Header */}
      <motion.div
        className={`${currentStatus.color} text-white sticky top-0 z-40`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Navigation bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link to={backPath}>
            <motion.button
              className="w-10 h-10 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>
          </Link>
          <h2 className="font-semibold text-lg">{order.restaurant}</h2>
          <motion.button
            className="w-10 h-10 flex items-center justify-center cursor-pointer"
            whileTap={{ scale: 0.9 }}
            onClick={handleShare}
          >
            <Share2 className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Status section - hidden for success milestones as requested */}
        {!['at_pickup', 'ready', 'on_way', 'at_drop', 'delivered'].includes(orderStatus) && (
          <div className="px-4 pb-4 text-center">
            <motion.h1
              className="text-2xl font-bold mb-3"
              key={currentStatus.title}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {currentStatus.title}
            </motion.h1>

            {/* Status pill */}
            <motion.div
              className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="text-sm">{currentStatus.subtitle}</span>
              {orderStatus === 'preparing' && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white" />
                  <span className="text-sm text-orange-200">On time</span>
                </>
              )}
              <motion.button
                onClick={handleRefresh}
                className="ml-1"
                animate={{ rotate: isRefreshing ? 360 : 0 }}
                transition={{ duration: 0.5 }}
              >
              <RefreshCw className="w-4 h-4" />
            </motion.button>
          </motion.div>
        </div>
      )}
      </motion.div>

      {/* Map Section */}
      {!isDeliveredOrder && orderStatus !== 'cancelled' && (
        <>
          <DeliveryMap
            orderId={orderId}
            order={order}
            isVisible={order !== null}
            fallbackCustomerCoords={fallbackCustomerCoords}
            userLiveCoords={userLiveCoords}
            userLocationAccuracy={userLiveLocation?.accuracy ?? null}
            onEtaUpdate={handleEtaUpdate}
          />
          {!hasActiveDeliveryTracking && (
            <motion.div
              className="mx-4 mt-4 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 p-5 shadow-sm"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                    Live tracking
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-gray-900">
                    {orderStatus === 'scheduled' ? 'Order Scheduled' : 'Waiting for delivery partner assignment'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {orderStatus === 'scheduled' 
                      ? `The ${isQuickOrder ? 'store' : 'restaurant'} will receive your order 15 minutes before the scheduled time.` 
                      : 'The route map is ready. Live rider movement will appear here as soon as a rider accepts the trip.'}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
                  {currentStatus.title}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/70 bg-white/90 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-[#FE5502]">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="my-2 h-10 w-px border-l-2 border-dashed border-emerald-200" />
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <HomeIcon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 space-y-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        {previewPickupLabel}
                      </p>
                      <p className="mt-1 font-semibold text-gray-900">
                        {previewPickupSource?.name || order?.restaurant || 'Pickup location'}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {previewPickupAddress}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        Delivery address
                      </p>
                      <p className="mt-1 font-semibold text-gray-900">
                        Customer location
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {previewDropAddress}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Scrollable Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-4 md:py-6 space-y-4 md:space-y-6 pb-24 md:pb-32">


        {customerDeliveryOtp && orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <motion.div
            className="bg-orange-50 rounded-xl p-4 shadow-sm border border-orange-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Delivery OTP</p>
            <p className="text-2xl font-extrabold text-orange-900 mt-1 tracking-widest">{customerDeliveryOtp}</p>
            <p className="text-xs text-orange-700 mt-1">Share this 4-digit OTP with your delivery partner at drop-off.</p>
          </motion.div>
        )}

        {isQuickOrder && !customerDeliveryOtp && orderStatus !== 'delivered' && orderStatus !== 'cancelled' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
          >
            <DeliveryOtpDisplay orderId={order?.orderId || order?.mongoId || orderId} />
          </motion.div>
        )}

        {/* Dynamic Status Card */}
        <motion.div
          className="bg-white rounded-xl p-4 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 ${
              currentStatus.iconType === 'rider' ? 'bg-orange-50' : 
              currentStatus.iconType === 'cancelled' ? 'bg-red-50' : 
              currentStatus.iconType === 'delivered' ? 'bg-green-50' : 
              'bg-red-50'
            }`}>
              {currentStatus.iconType === 'rider' ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: RIDER_BIKE_SVG.replace(/width="\d+"/, 'width="100%"').replace(/height="\d+"/, 'height="100%"') }} 
                  className="w-full h-full" 
                />
              ) : currentStatus.iconType === 'cancelled' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-red-500">
                  <X className="w-full h-full" />
                </div>
              ) : currentStatus.iconType === 'delivered' ? (
                <div className="w-full h-full flex items-center justify-center p-2 text-green-500">
                  <Check className="w-full h-full" />
                </div>
              ) : (
                <img
                  src={circleIcon}
                  alt={currentStatus.title}
                  className="w-10 h-10 object-contain"
                />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 leading-tight">{currentStatus.title}</p>
              <p className="text-sm text-gray-500 mt-1 leading-snug">{currentStatus.subtitle}</p>
            </div>
          </div>
        </motion.div>

        {/* Delivery Partner Info */}
        {visibleDeliveryPartners.length > 0 && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <div className="px-4 pt-4 pb-2 border-b border-dashed border-gray-200">
              <p className="font-semibold text-gray-900">
                {hasMultipleDeliveryPartners ? 'Express delivery partners' : 'Delivery partner'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {hasMultipleDeliveryPartners
                  ? 'Each pickup in your express order can have its own rider.'
                  : 'Your delivery partner is handling this order.'}
              </p>
            </div>
            {visibleDeliveryPartners.map((partner, index) => (
              <div
                key={partner?.legId || partner?.id || index}
                className={`flex items-center gap-3 p-4 ${
                  index !== visibleDeliveryPartners.length - 1 ? 'border-b border-dashed border-gray-200' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-orange-50 overflow-hidden flex items-center justify-center flex-shrink-0 border border-orange-100 p-1">
                  <img
                    src={getPartnerDisplayAvatar(partner?.avatar, partner?.name)}
                    alt={partner?.name || 'Rider'}
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null
                      event.currentTarget.src = getPartnerDisplayAvatar("", partner?.name || "Rider")
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">
                      {partner?.name || 'Delivery Partner'}
                    </p>
                    {hasMultipleDeliveryPartners && (
                      <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                        {partner?.label || 'Pickup rider'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {partner?.sourceName
                      ? `${partner.label} for ${partner.sourceName}`
                      : partner?.statusText || 'Your delivery partner is arriving'}
                  </p>
                  {formatPartnerRating(partner?.rating) ? (
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                      <span className="font-semibold">★ {formatPartnerRating(partner?.rating)}</span>
                      <span className="text-gray-400">
                        {Number(partner?.totalRatings || 0) > 0
                          ? `(${Number(partner?.totalRatings)} ratings)`
                          : '(New rider)'}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-gray-400">Rating not available yet</div>
                  )}
                </div>
                <motion.button
                  className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center"
                  onClick={(e) => handleCallRider(partner?.phone, e)}
                  whileTap={{ scale: 0.9 }}
                >
                  <Phone className="w-5 h-5 text-primary" />
                </motion.button>
              </div>
            ))}
            {order?.note && !isDeliveredOrder && (
              <div className="bg-orange-50/50 p-3 mx-4 mb-4 rounded-lg flex items-start gap-2 border border-orange-100">
                <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Instruction for Rider</p>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">"{order.note}"</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Delivery Partner Safety */}
        {!isDeliveredOrder && (
          <motion.button
            className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            whileTap={{ scale: 0.99 }}
          >
            <Shield className="w-6 h-6 text-gray-600" />
            <span className="flex-1 text-left font-medium text-gray-900">
              Learn about delivery partner safety
            </span>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </motion.button>
        )}

        {/* Delivery Details Banner */}
        {!isDeliveredOrder && (
          <motion.div
            className="bg-yellow-50 rounded-xl p-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <p className="text-yellow-800 font-medium">
              All your delivery details in one place 🚀
            </p>
          </motion.div>
        )}

        {/* Contact & Address Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <SectionItem
            icon={User}
            title={
              order?.userName ||
              order?.userId?.fullName ||
              order?.userId?.name ||
              order?.user?.name ||
              order?.user?.firstName ||
              profile?.fullName ||
              profile?.name ||
              'Customer'
            }
            subtitle={
              order?.userPhone ||
              order?.userId?.phone?.number ||
              order?.userId?.phone ||
              order?.user?.phone?.number ||
              order?.user?.phone ||
              order?.user?.phoneNumber ||
              order?.deliveryAddress?.phone ||
              order?.address?.phone ||
              profile?.phone ||
              defaultAddress?.phone ||
              'Phone number not available'
            }
            showArrow={false}
          />
          <SectionItem
            iconNode={
              <div
                dangerouslySetInnerHTML={{ __html: SAFE_CUSTOMER_PIN }}
                className="w-6 h-6 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
              />
            }
            title="Delivery at Location"
            subtitle={(() => {
              // Priority 1: Use order address formattedAddress (live location address)
              if (order?.address?.formattedAddress && order.address.formattedAddress !== "Select location") {
                return order.address.formattedAddress
              }

              // Priority 2: Build full address from order address parts
              if (order?.address) {
                const orderAddressParts = []
                if (order.address.street) orderAddressParts.push(order.address.street)
                if (order.address.additionalDetails) orderAddressParts.push(order.address.additionalDetails)
                if (order.address.city) orderAddressParts.push(order.address.city)
                if (order.address.state) orderAddressParts.push(order.address.state)
                if (order.address.zipCode) orderAddressParts.push(order.address.zipCode)
                if (orderAddressParts.length > 0) {
                  return orderAddressParts.join(', ')
                }
              }

              // Priority 3: Use defaultAddress formattedAddress (live location address)
              if (defaultAddress?.formattedAddress && defaultAddress.formattedAddress !== "Select location") {
                return defaultAddress.formattedAddress
              }

              // Priority 4: Build full address from defaultAddress parts
              if (defaultAddress) {
                const defaultAddressParts = []
                if (defaultAddress.street) defaultAddressParts.push(defaultAddress.street)
                if (defaultAddress.additionalDetails) defaultAddressParts.push(defaultAddress.additionalDetails)
                if (defaultAddress.city) defaultAddressParts.push(defaultAddress.city)
                if (defaultAddress.state) defaultAddressParts.push(defaultAddress.state)
                if (defaultAddress.zipCode) defaultAddressParts.push(defaultAddress.zipCode)
                if (defaultAddressParts.length > 0) {
                  return defaultAddressParts.join(', ')
                }
              }

              return 'Add delivery address'
            })()}
            showArrow={false}
          />
          {!isDeliveredOrder && (
            <SectionItem
              icon={MessageSquare}
              title={order?.note ? "Edit delivery instructions" : "Add delivery instructions"}
              subtitle={order?.note ? order.note.substring(0, 35) + (order.note.length > 35 ? "..." : "") : ""}
              onClick={() => {
                setDeliveryInstructions(order?.note || "");
                setIsInstructionsModalOpen(true);
              }}
            />
          )}
        </motion.div>

        {/* Pickup Sources Section */}
        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <div className="p-4 border-b border-dashed border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  {order?.orderType === 'mixed' ? 'Pickup Points' : (isQuickOrder ? 'Store' : 'Restaurant')}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {order?.orderType === 'mixed'
                    ? 'Restaurant and store details for this mixed order'
                    : 'Pickup details for your order'}
                </p>
              </div>
              {pickupSources.length === 1 && (
                <motion.button
                  className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"
                  onClick={handleCallRestaurant}
                  whileTap={{ scale: 0.9 }}
                >
                  <Phone className="w-5 h-5 text-[#FE5502]" />
                </motion.button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {pickupSources.map((source, index) => {
                const isQuick = source.pickupType === 'quick'
                const badgeClasses = isQuick
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : 'bg-red-50 text-orange-700 border-orange-200'

                return (
                  <div
                    key={source.id || `${source.pickupType}-${index}`}
                    className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${isQuick ? 'bg-orange-100' : 'bg-red-100'} flex-shrink-0`}>
                        <div
                          dangerouslySetInnerHTML={{ __html: SAFE_RESTAURANT_PIN }}
                          className="w-7 h-7 [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClasses}`}>
                          {pickupSources.length > 1 ? `${source.label} ${index + 1}` : source.label}
                        </span>
                        <p className="mt-2 font-semibold text-gray-900">{source.name}</p>
                        <p className="mt-1 text-sm text-gray-500">{source.address || 'Address not available'}</p>
                      </div>
                      {source.phone ? (
                        <motion.button
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${isQuick ? 'bg-orange-50' : 'bg-red-50'}`}
                          onClick={(e) => handleCallPickupSource(source.phone, e)}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Phone className={`w-5 h-5 ${isQuick ? 'text-primary' : 'text-[#FE5502]'}`} />
                        </motion.button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order Items */}
          <div
            className="p-4 border-b border-dashed border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => setShowOrderDetails(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="space-y-1">
                  {order?.items?.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-4 h-4 rounded border border-green-600 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-green-600" />
                      </span>
                      <span>{item.quantity} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </motion.div>

        {!isAdminAccepted && !isDeliveredOrder && orderStatus !== 'cancelled' && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <SectionItem
              icon={CircleSlash}
              title="Cancel order"
              subtitle=""
              onClick={handleCancelOrder}
            />
          </motion.div>
        )}

        {isQuickOrder && isDeliveredOrder && (
          <motion.div
            className="bg-white rounded-xl shadow-sm overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            {order.returnRequest ? (
              <SectionItem
                icon={RefreshCw}
                title="View Return Request"
                subtitle="Check the status of your return request"
                onClick={() => navigate(`/quick/returns/${order.returnRequest._id}`)}
              />
            ) : (
              <SectionItem
                icon={Package}
                title="Return Order"
                subtitle="Request a return for this delivered order"
                onClick={() => navigate(`/quick/returns/create/${orderId}`)}
              />
            )}
          </motion.div>
        )}

        <motion.div
          className="bg-white rounded-xl shadow-sm overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.82 }}
        >
          <SectionItem
            icon={Download}
            title="Download invoice"
            subtitle="Get a dynamic PDF invoice for this order"
            onClick={handleDownloadInvoice}
          />
        </motion.div>

      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-xl w-[95%] max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Cancel Order
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-6 px-2">
            <div className="space-y-2 w-full">
              <Textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="e.g., Changed my mind, Wrong address, etc."
                className="w-full min-h-[100px] resize-none border-2 border-gray-300 rounded-lg px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 focus:outline-none transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed disabled:border-gray-200"
                disabled={isCancelling}
              />
            </div>
            {isOnlinePaidForRefundChoice ? (
              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Refund destination</p>
                  <p className="text-xs text-gray-500">
                    Choose where your refund should go if admin approves the cancellation.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRefundDestination("gateway")}
                    disabled={isCancelling}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      refundDestination === "gateway"
                        ? "border-orange-500 bg-red-50 text-orange-900"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    } ${isCancelling ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <p className="text-sm font-semibold">Original payment method</p>
                    <p className="mt-1 text-xs text-gray-500">Refund back through Razorpay.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundDestination("wallet")}
                    disabled={isCancelling}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      refundDestination === "wallet"
                        ? "border-orange-500 bg-red-50 text-orange-900"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                    } ${isCancelling ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <p className="text-sm font-semibold">Wallet</p>
                    <p className="mt-1 text-xs text-gray-500">Refund as wallet balance for faster reuse.</p>
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancellationReason("");
                  setRefundDestination("gateway");
                }}
                disabled={isCancelling}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancellationReason.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  'Confirm Cancellation'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={showOrderDetails} onOpenChange={setShowOrderDetails}>
        <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-md bg-white rounded-2xl p-0 overflow-hidden border-none outline-none">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 pr-12">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold text-gray-900">Order Details</DialogTitle>
            </div>
          </DialogHeader>

          <div className="p-6 pt-4 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Order Meta Info */}
            <div className="flex flex-col gap-1 b">
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Date & Time</p>
                  <p className="text-sm font-medium text-gray-900">
                    {order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }) : 'N/A'}
                  </p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                  <span className="text-sm font-bold text-green-600 uppercase">
                    {order?.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Instructions Section */}
            {order?.note && (
              <div className="bg-red-50/50 rounded-xl p-4 border border-orange-100 flex gap-3">
                <MessageSquare className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-1">Delivery Instructions</p>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium capitalize">
                    {order.note}
                  </p>
                </div>
              </div>
            )}

            {/* Items Section */}
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Order Items</p>
              <div className="space-y-4">
                {order?.items?.map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-5 h-5 rounded border border-green-600 flex items-center justify-center mt-0.5 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                        {item.variantName ? (
                          <p className="text-sm text-gray-500 mt-0.5">{item.variantName}</p>
                        ) : null}
                        <p className="text-sm text-gray-500 mt-0.5">Quantity: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">Bill Summary</p>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Item Total</span>
                <span className="text-gray-900 font-medium">₹{Number(order?.subtotal || 0).toFixed(2)}</span>
              </div>

              {Number(order?.packagingFee) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Packaging Charges</span>
                  <span className="text-gray-900 font-medium">₹{Number(order.packagingFee).toFixed(2)}</span>
                </div>
              )}

              {Number(order?.platformFee) > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Platform Fee</span>
                  <span className="text-gray-900 font-medium">₹{Number(order.platformFee).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="text-gray-900 font-medium">₹{Number(order?.deliveryFee || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">Taxes & Charges (GST)</span>
                <span className="text-gray-900 font-medium">₹{Number(order?.gst || 0).toFixed(2)}</span>
              </div>

              {Number(order?.discount) > 0 && (
                <div className="flex justify-between items-center text-sm text-green-600 font-medium">
                  <span>Discount Applied</span>
                  <span>-₹{Number(order.discount).toFixed(2)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                <span className="text-base font-bold text-gray-900">Total Amount</span>
                <span className="text-lg font-bold text-gray-900">₹{Number(order?.totalAmount || 0).toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method */}
            {order?.paymentMethod && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-gray-600">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm font-medium">Payment Method</span>
                </div>
                <span className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                  {order.paymentMethod}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-100">
            <Button
              onClick={() => setShowOrderDetails(false)}
              className="w-full bg-gray-900 text-white font-bold h-12 rounded-xl"
            >
              Okay
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Instructions Modal */}
      <Dialog open={isInstructionsModalOpen} onOpenChange={setIsInstructionsModalOpen}>
        <DialogContent className="sm:max-w-md w-[95vw] rounded-3xl p-6 border-0 shadow-2xl bg-white max-h-[90vh] overflow-y-auto z-[200]">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
              Delivery Instructions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Add instructions for the delivery partner to help them find your address or know where to leave your order.
            </p>
            <Textarea
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="E.g. Ring the doorbell, leave at the front desk..."
              className="min-h-[120px] resize-none border-gray-200 focus:ring-orange-500 rounded-xl bg-gray-50 text-base"
            />
            <Button 
              onClick={handleUpdateInstructions} 
              disabled={isUpdatingInstructions}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold h-12 rounded-xl border-none"
            >
              {isUpdatingInstructions ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Instructions"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating & Feedback Modal */}
      <AnimatePresence>
        {ratingModal.open && ratingModal.order && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
            >
              {/* Header with gradient */}
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Star className="w-5 h-5 fill-white" />
                    Rate Your Experience
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseRating}
                    className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-white/90">{ratingModal.order.restaurant}</p>
              </div>

              <div className="px-6 py-6 space-y-6">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    {isQuickOrder ? 'Store rating' : 'Restaurant rating'} (out of 5)
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((num) => {
                      const isActive = (selectedRestaurantRating || 0) >= num
                      return (
                        <button
                          key={`restaurant-${num}`}
                          type="button"
                          onClick={() => setSelectedRestaurantRating(num)}
                          className="p-2 transition-transform hover:scale-125 active:scale-95"
                        >
                          <Star
                            className={`w-10 h-10 transition-all ${isActive
                                ? "text-yellow-400 fill-yellow-400 drop-shadow-lg"
                                : "text-gray-200 hover:text-yellow-200"
                              }`}
                          />
                        </button>
                      )
                    })}
                  </div>
                  <Textarea
                    rows={2}
                    value={restaurantFeedbackText}
                    onChange={(e) => setRestaurantFeedbackText(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-100 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none transition-all"
                    placeholder="Tell us what you liked (optional)"
                  />
                </div>

                {!!order?.deliveryPartnerId && (
                  <div className="pt-4 border-t border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 mb-3">
                      Delivery partner rating (out of 5)
                    </p>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      {[1, 2, 3, 4, 5].map((num) => {
                        const isActive = (selectedDeliveryRating || 0) >= num
                        return (
                          <button
                            key={`delivery-${num}`}
                            type="button"
                            onClick={() => setSelectedDeliveryRating(num)}
                            className="p-2 transition-transform hover:scale-125 active:scale-95"
                          >
                            <Star
                              className={`w-10 h-10 transition-all ${isActive
                                  ? "text-yellow-400 fill-yellow-400 drop-shadow-lg"
                                  : "text-gray-200 hover:text-yellow-200"
                                }`}
                            />
                          </button>
                        )
                      })}
                    </div>
                    <Textarea
                      rows={2}
                      value={deliveryFeedbackText}
                      onChange={(e) => setDeliveryFeedbackText(e.target.value)}
                      className="w-full rounded-xl border-2 border-gray-100 px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none transition-all"
                      placeholder="How was the delivery? (optional)"
                    />
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="button"
                  disabled={submittingRating || selectedRestaurantRating === null || (!!order?.deliveryPartnerId && selectedDeliveryRating === null)}
                  onClick={handleSubmitRating}
                  className="w-full rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-base font-bold h-12 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
                >
                  {submittingRating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Submit Ratings
                    </>
                  )}
                </Button>

                {selectedRestaurantRating === null && (
                  <p className="text-[10px] text-center text-gray-400">Please select a rating to enable submission</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
