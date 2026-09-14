import { Clock } from "lucide-react"
import { getFoodItemSlotAvailabilityText } from "@food/utils/itemSlotTiming"

export default function ItemSlotAvailabilityNote({ item, className = "" }) {
  const text = getFoodItemSlotAvailabilityText(item)
  if (!text) return null

  return (
    <p
      className={`inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 ${className}`}
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span>{text}</span>
    </p>
  )
}
