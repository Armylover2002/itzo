import * as React from "react"
import { cn } from "@food/utils/utils"

const RadioGroupContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
}>({})

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string
    onValueChange?: (value: string) => void
  }
>(({ className, value, onValueChange, ...props }, ref) => {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div ref={ref} className={cn("space-y-2", className)} {...props} />
    </RadioGroupContext.Provider>
  )
})
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string
  }
>(({ className, value, ...props }, ref) => {
  const { value: selectedValue, onValueChange } = React.useContext(RadioGroupContext)
  const isSelected = selectedValue === value

  return (
    <button
      type="button"
      ref={ref}
      role="radio"
      aria-checked={isSelected}
      onClick={() => onValueChange?.(value)}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border-2 border-gray-300 transition-colors",
        isSelected && "border-blue-600 bg-blue-600",
        className
      )}
      {...props}
    >
      {isSelected && (
        <div className="h-full w-full rounded-full bg-white scale-50" />
      )}
    </button>
  )
})
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }

