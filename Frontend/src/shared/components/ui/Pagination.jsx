import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGINATION_CONFIG } from '@/shared/constants/pagination';

const Pagination = ({
    page,
    totalPages,
    total,
    pageSize,
    onPageChange,
    onPageSizeChange,
    loading = false,
    compact = false,
    className,
}) => {
    if ((totalPages <= 1 && !onPageSizeChange) || total === 0) return null;

    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 px-1", compact && "gap-1.5", className)}>
            <p className="ds-caption text-gray-500 text-[11px] shrink-0">
                Showing <span className="font-semibold text-gray-900">{start}-{end}</span> of {total}
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {onPageSizeChange && (
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        disabled={loading}
                        className={cn(
                            "rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 appearance-none pr-5",
                            "focus:ring-1 focus:ring-primary/20 focus:outline-none disabled:opacity-50 cursor-pointer"
                        )}
                    >
                        {PAGINATION_CONFIG.allowedPageSizeOptions.map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                )}
                <button
                    disabled={page <= 1 || loading}
                    onClick={() => onPageChange(page - 1)}
                    className={cn(
                        "inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                        "bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50"
                    )}
                >
                    <ChevronLeft className="h-3 w-3" />
                    Prev
                </button>
                <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    {page} / {totalPages || 1}
                </span>
                <button
                    disabled={page >= totalPages || loading}
                    onClick={() => onPageChange(page + 1)}
                    className={cn(
                        "inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                        "bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-50"
                    )}
                >
                    Next
                    <ChevronRight className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
