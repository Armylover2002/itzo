import * as React from "react"

import { cn } from "@food/utils/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground dark:bg-input/30 flex min-h-20 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-neutral-900 focus-visible:ring-neutral-900/40 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
