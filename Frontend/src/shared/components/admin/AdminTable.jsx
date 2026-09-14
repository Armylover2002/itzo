import { Inbox } from "lucide-react";
import { Skeleton } from "@food/components/ui/skeleton";
import EmptyState from "@/shared/components/EmptyState";
import Pagination from "@/shared/components/ui/Pagination";
import { cn } from "@food/utils/utils";

/**
 * AdminTable — the ONE table for the whole admin panel (Users, Drivers,
 * Vehicles, Goods Types, Orders, Transactions, Wallet, Reports, …).
 *
 * Reuses existing primitives: Skeleton (loading), EmptyState (empty),
 * Pagination (footer). Provides: sticky header, rounded card surface, row
 * hover, status-chip friendly cells, responsive horizontal scroll.
 *
 * columns: [{
 *   key, header, align?: 'left'|'center'|'right', width?,
 *   headerClassName?, cellClassName?,
 *   cell?: (row, index) => ReactNode   // defaults to row[key]
 * }]
 *
 * pagination: { page, totalPages, total, pageSize, onPageChange, onPageSizeChange }
 */
const alignClass = (align) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

export default function AdminTable({
  columns = [],
  data = [],
  loading = false,
  skeletonRows = 6,
  getRowId,
  onRowClick,
  emptyState,
  stickyHeader = true,
  pagination,
  toolbar,
  className,
}) {
  const colCount = columns.length || 1;

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}

      <div className="blaze-card overflow-hidden">
        <div className="blaze-scroll w-full overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead
              className={cn(
                "bg-muted/60 backdrop-blur",
                stickyHeader && "sticky top-0 z-10"
              )}
            >
              <tr className="border-b border-border">
                {columns.map((col, i) => (
                  <th
                    key={col.key ?? i}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      alignClass(col.align),
                      col.headerClassName
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: skeletonRows }).map((_, r) => (
                  <tr key={`sk-${r}`} className="border-b border-border last:border-0">
                    {columns.map((col, c) => (
                      <td key={c} className={cn("px-4 py-3.5", alignClass(col.align))}>
                        <Skeleton
                          className={cn(
                            "h-4 rounded-full",
                            c === 0 ? "w-3/4" : col.align === "right" ? "ml-auto w-16" : "w-4/5"
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-6">
                    <EmptyState
                      icon={emptyState?.icon || <Inbox className="h-10 w-10" />}
                      title={emptyState?.title || "Nothing here yet"}
                      description={
                        emptyState?.description || "Records will appear here once available."
                      }
                      action={emptyState?.action}
                    />
                  </td>
                </tr>
              ) : (
                data.map((row, rIdx) => (
                  <tr
                    key={getRowId ? getRowId(row, rIdx) : rIdx}
                    onClick={onRowClick ? () => onRowClick(row, rIdx) : undefined}
                    className={cn(
                      "border-b border-border transition-colors last:border-0 hover:bg-secondary/50",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((col, cIdx) => (
                      <td
                        key={col.key ?? cIdx}
                        className={cn(
                          "px-4 py-3.5 text-foreground",
                          alignClass(col.align),
                          col.cellClassName
                        )}
                      >
                        {col.cell ? col.cell(row, rIdx) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && (
          <div className="border-t border-border px-4 py-3">
            <Pagination {...pagination} loading={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
