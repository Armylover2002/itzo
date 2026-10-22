import { X, BadgePercent, ChevronDown, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"
import BottomSheetPortal from "./BottomSheetPortal"
import { getCouponHeadline, getCouponSubline, getCouponTerms } from "../restaurantDetailsUtils"

const copyCode = async (code) => {
  try {
    await navigator.clipboard.writeText(code)
    toast.success(`Code ${code} copied`)
  } catch {
    toast.error("Could not copy code")
  }
}

export default function RestaurantOffersSheet({ open, onClose, restaurant, coupons = [], expandedCoupons, setExpandedCoupons }) {
  const visibleCoupons = coupons.filter((coupon) => coupon?.couponCode)

  const toggle = (key) => {
    setExpandedCoupons((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <BottomSheetPortal open={open} onClose={onClose} sheetClassName="fixed left-0 right-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[10000] bg-white dark:bg-[#1a1a1a] rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:w-[480px] flex flex-col max-h-[85vh] md:max-h-[90vh]">
      <div className="px-4 pt-6 pb-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Offers at {restaurant?.name || "this restaurant"}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {visibleCoupons.length} coupon{visibleCoupons.length === 1 ? "" : "s"} available
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50 dark:bg-[#121212]">
        {visibleCoupons.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">No offers available right now</p>
        )}

        {visibleCoupons.map((coupon) => {
          const key = coupon.id || coupon.couponCode
          const isExpanded = expandedCoupons.has(key)
          const code = String(coupon.couponCode).toUpperCase()
          return (
            <div key={key} className="rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#FB4F01] to-[#ff7a3d] flex items-center justify-center shrink-0">
                  <BadgePercent className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-gray-900 dark:text-white">{getCouponHeadline(coupon)}</p>
                  <p className="text-[11px] font-semibold tracking-wide text-gray-500 dark:text-gray-400 mt-0.5">
                    {getCouponSubline(coupon)}
                  </p>
                </div>
              </div>

              {/* Ticket divider */}
              <div className="relative border-t border-dashed border-gray-200 dark:border-gray-700 mx-4" />

              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => copyCode(code)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-[#FB4F01] bg-orange-50 dark:bg-orange-950/30 px-3 py-1.5 text-xs font-bold tracking-wider text-[#FB4F01]"
                >
                  {code}
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400"
                >
                  {isExpanded ? "Hide details" : "View details"}
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>

              {isExpanded && (
                <ul className="px-4 pb-4 space-y-1.5 list-disc list-inside text-xs text-gray-600 dark:text-gray-400">
                  {getCouponTerms(coupon).map((term) => (
                    <li key={term}>{term}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-4 bg-white dark:bg-[#1a1a1a]">
        <Button
          className="w-full bg-[#1a1a1a] dark:bg-[#FB4F01] hover:bg-[#FB4F01] dark:hover:bg-[#C83C00] text-white border-0 flex items-center justify-center gap-2 py-6 rounded-xl font-bold transition-all shadow-lg"
          onClick={() => onClose()}
        >
          <X className="h-5 w-5" />
          Close
        </Button>
      </div>
    </BottomSheetPortal>
  )
}
