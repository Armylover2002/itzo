import { cn } from "@food/utils/utils"

export default function RestaurantBentoGrid({ children, className, variant = "default" }) {
  const variantStyles = {
    default: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
    "dashboard-kpi": "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    "dashboard-charts": "grid grid-cols-1 md:grid-cols-12 gap-4",
  }

  return (
    <div className={cn(variantStyles[variant] || variantStyles.default, className)}>
      {children}
    </div>
  )
}
