import React from "react"

export function Badge({ className = "", children, ...props }) {
  return React.createElement(
    "span",
    {
      className: `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`.trim(),
      ...props,
    },
    children,
  )
}
