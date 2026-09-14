import * as React from "react"

import { cn } from "@food/utils/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  (props, ref) => {
    const { className, type, value, ...restProps } = props
    
    // Ensure value is always a string (never undefined/null) when provided
    // This prevents "uncontrolled to controlled" React warnings
    // When value prop exists (even if undefined), always convert to string
    // This ensures React sees it as controlled from the start
    const safeValue = value == null ? "" : String(value)
    
    // If value prop was provided in original props (even if undefined), always use string
    // This ensures React sees it as controlled from the start, preventing warnings
    // Only omit value prop if it was never provided in the first place (uncontrolled input)
    const hasValueProp = "value" in props
    const inputProps = hasValueProp
      ? { ...restProps, value: safeValue }
      : restProps
    
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "file:text-foreground text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-background px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-neutral-900 focus-visible:ring-neutral-900/40 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className
        )}
        {...inputProps}
      />
    )
  }
)

Input.displayName = "Input"

export { Input }
