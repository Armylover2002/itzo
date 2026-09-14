import { cn } from "@food/utils/utils";

/**
 * FilterBar — the one filter/toolbar surface that sits under the PageHeader.
 *
 * Layout: `start` slot (search/filters, left) and `end` slot (actions, right).
 * Falls back to `children` if you want full control. Wrapped in the shared
 * `.blaze-card` surface so it matches every other panel.
 */
export default function FilterBar({ start, end, children, className }) {
  return (
    <div
      className={cn(
        "blaze-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      {children ? (
        children
      ) : (
        <>
          <div className="flex flex-1 flex-wrap items-center gap-2.5">{start}</div>
          {end && <div className="flex flex-wrap items-center gap-2.5">{end}</div>}
        </>
      )}
    </div>
  );
}
