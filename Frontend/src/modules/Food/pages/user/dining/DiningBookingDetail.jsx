import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Check, Loader2, MapPin, Receipt, UtensilsCrossed, Users, X } from "lucide-react"
import { userAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { normalizeImageUrl } from "@food/utils/common"
import { formatSlotRange } from "@food/utils/dining"
import { useAuth } from "@core/context/AuthContext"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api(\/v1)?\/?$/i, "")

const statusBadgeClass = (status) => {
  switch (status) {
    case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200"
    case "seated": return "bg-indigo-50 text-indigo-700 border-indigo-200"
    case "completed": return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "cancelled": return "bg-rose-50 text-rose-700 border-rose-200"
    case "no_show": return "bg-gray-100 text-gray-600 border-gray-200"
    default: return "bg-amber-50 text-amber-700 border-amber-200"
  }
}

const PROGRESS_STEPS = [
  { key: "pending", label: "Booked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "seated", label: "Seated" },
  { key: "completed", label: "Completed" },
]

function BookingProgress({ status }) {
  if (["cancelled", "no_show"].includes(status)) return null
  const currentIndex = PROGRESS_STEPS.findIndex((s) => s.key === status)
  return (
    <div className="mt-4 flex items-center">
      {PROGRESS_STEPS.map((step, idx) => {
        const done = idx <= currentIndex
        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${done ? "bg-[#FE5502] text-white" : "bg-gray-100 text-gray-400"}`}>
                {done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span className={`text-[10px] font-medium ${done ? "text-[#FE5502]" : "text-gray-400"}`}>{step.label}</span>
            </div>
            {idx < PROGRESS_STEPS.length - 1 && (
              <div className={`mx-1 mb-4 h-0.5 flex-1 ${idx < currentIndex ? "bg-[#FE5502]" : "bg-gray-100"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DiningBookingDetail() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [reservation, setReservation] = useState(null)
  const [bill, setBill] = useState(null)
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const response = await userAPI.getMyDiningReservationDetail(bookingId)
      const r = response?.data?.data?.reservation
      setReservation(r || null)
      if (r?.billId) {
        try {
          const billRes = await userAPI.getDiningBill(r.billId)
          setBill(billRes?.data?.data?.bill || null)
        } catch {
          setBill(null)
        }
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load booking")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [bookingId])

  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking?")) return
    try {
      setCancelling(true)
      const response = await userAPI.cancelDiningReservation(bookingId, "Cancelled by user")
      if (response?.data?.success) {
        toast.success("Booking cancelled")
        load()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to cancel booking")
    } finally {
      setCancelling(false)
    }
  }

  const handlePayNow = async () => {
    if (!bill?._id) return
    try {
      setPaying(true)
      const orderRes = await userAPI.createDiningBillPaymentOrder(bill._id)
      const orderData = orderRes?.data?.data
      if (!orderData?.orderId) throw new Error("Failed to create payment order")

      await initRazorpayPayment({
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: "Dining Bill",
        description: reservation?.restaurantNameSnapshot || "Dining bill payment",
        prefill: { name: user?.name || "", contact: user?.phone || "" },
        handler: async (response) => {
          try {
            const verifyRes = await userAPI.verifyDiningBillPayment(bill._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            if (verifyRes?.data?.success) {
              toast.success("Payment successful!")
              load()
            }
          } catch (error) {
            toast.error(error?.response?.data?.message || "Payment verification failed")
          } finally {
            setPaying(false)
          }
        },
        onError: (error) => {
          toast.error(error?.description || "Payment failed")
          setPaying(false)
        },
        onClose: () => setPaying(false),
      })
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to start payment")
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FE5502]" />
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="p-6 text-center text-gray-600">
        Booking not found.
        <button onClick={() => navigate(-1)} className="mt-3 block text-sm text-[#FE5502] underline">Go back</button>
      </div>
    )
  }

  const canCancel = ["pending", "confirmed"].includes(reservation.status)
  const billPayable = bill?.status === "finalized"
  const billPaid = bill?.status === "paid" || bill?.status === "settled"
  const restaurant = reservation.restaurant
  const restaurantImage = normalizeImageUrl(
    restaurant?.coverImages?.[0] || (typeof restaurant?.profileImage === "string" ? restaurant.profileImage : restaurant?.profileImage?.url),
    BACKEND_ORIGIN,
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-10 dark:bg-[#121212]">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-[#1a1a1a]">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Booking Details</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                {restaurantImage ? (
                  <img src={restaurantImage} alt={reservation.restaurantNameSnapshot} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <UtensilsCrossed className="h-6 w-6 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-gray-900 dark:text-white">{reservation.restaurantNameSnapshot}</p>
                {(restaurant?.area || restaurant?.city) && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{[restaurant?.area, restaurant?.city].filter(Boolean).join(", ")}</span>
                  </p>
                )}
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {new Date(reservation.bookingDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {formatSlotRange(reservation.slotStart, reservation.slotEnd)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400"><Users className="h-4 w-4" /> {reservation.guests} guests</p>
              </div>
            </div>
            <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${statusBadgeClass(reservation.status)}`}>
              {String(reservation.status || "").replace("_", " ")}
            </span>
          </div>

          <BookingProgress status={reservation.status} />

          {reservation.specialRequest && (
            <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">"{reservation.specialRequest}"</p>
          )}
          {reservation.status === "cancelled" && reservation.cancellationReason && (
            <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Cancelled: {reservation.cancellationReason}</p>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> {cancelling ? "Cancelling..." : "Cancel Booking"}
            </button>
          )}
        </div>

        {bill && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#1a1a1a]">
            <div className="mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Your Bill</h2>
            </div>
            <div className="space-y-2">
              {(bill.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>{item.name} × {item.quantity}</span>
                  <span>₹{item.total?.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span>₹{bill.subtotal?.toLocaleString("en-IN")}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Discount</span>
                  <span>-₹{bill.discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              {bill.taxAmount > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Tax</span>
                  <span>₹{bill.taxAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-bold text-gray-900 dark:text-white">
                <span>Total</span>
                <span>₹{bill.grandTotal?.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {billPaid ? (
              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">Paid</p>
            ) : billPayable ? (
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FE5502] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {paying ? "Processing..." : `Pay ₹${bill.grandTotal?.toLocaleString("en-IN")}`}
              </button>
            ) : (
              <p className="mt-4 text-center text-sm text-gray-400">Bill is being prepared by the restaurant</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
