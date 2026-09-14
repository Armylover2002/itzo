import * as React from "react"

import { cn } from "@food/utils/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
