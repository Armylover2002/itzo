import React from "react";
import { cn } from "@/lib/utils";
import {
  normalizeReturnItemRow,
  formatReturnItemMoney,
} from "@/shared/utils/returnItemDetails";

const DetailRow = ({ label, value, highlight = false, negative = false }) => {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span
        className={cn(
          "font-semibold text-right",
          highlight ? "text-slate-900 font-black" : "text-slate-700",
          negative && "text-rose-600",
        )}
      >
        {value}
      </span>
    </div>
  );
};

const ReturnItemCard = ({ item, variant = "default" }) => {
  const row = normalizeReturnItemRow(item);
  const isCompact = variant === "compact";

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:p-4 space-y-2.5",
        isCompact && "p-3 space-y-2",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 leading-snug">{row.name}</p>
        {row.variant ? (
          <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
            Variant: <span className="text-slate-800">{row.variant}</span>
          </p>
        ) : null}
        {row.productId ? (
          <p className="text-[10px] font-mono text-slate-400 mt-1 break-all">
            ID: {row.productId}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="rounded-xl bg-white border border-slate-100 px-2.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Ordered
          </p>
          <p className="text-sm font-black text-slate-900 mt-0.5">{row.orderedQty}</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-100 px-2.5 py-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Returning
          </p>
          <p className="text-sm font-black text-amber-700 mt-0.5">{row.returnedQty}</p>
        </div>
        {row.remainingQty > 0 ? (
          <div className="rounded-xl bg-white border border-slate-100 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Remaining
            </p>
            <p className="text-sm font-black text-slate-700 mt-0.5">{row.remainingQty}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl bg-white border border-slate-100 px-3 py-2.5 space-y-1.5">
        <DetailRow
          label="Unit price"
          value={formatReturnItemMoney(row.unitPrice)}
        />
        <DetailRow
          label={`Line total (${row.returnedQty} × ${formatReturnItemMoney(row.unitPrice)})`}
          value={formatReturnItemMoney(row.lineSubtotal)}
        />
        {row.discountShare > 0 ? (
          <DetailRow
            label="Discount share"
            value={`-${formatReturnItemMoney(row.discountShare)}`}
            negative
          />
        ) : null}
        {row.couponShare > 0 ? (
          <DetailRow
            label="Coupon adjustment"
            value={`-${formatReturnItemMoney(row.couponShare)}`}
            negative
          />
        ) : null}
        {row.taxShare > 0 ? (
          <DetailRow
            label="GST (in refund)"
            value={`+${formatReturnItemMoney(row.taxShare)}`}
          />
        ) : null}
        <div className="border-t border-slate-100 pt-1.5">
          <DetailRow
            label="Item refund"
            value={formatReturnItemMoney(row.refundAmount)}
            highlight
          />
        </div>
      </div>
    </div>
  );
};

const ReturnItemsDetailList = ({
  items = [],
  title = "Returned items",
  emptyLabel = "No return items recorded.",
  variant = "default",
  className,
}) => {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center", className)}>
        <p className="text-xs font-medium text-slate-500">{emptyLabel}</p>
      </div>
    );
  }

  const totalRefund = list.reduce(
    (sum, item) => sum + normalizeReturnItemRow(item).refundAmount,
    0,
  );

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
          {title}
        </p>
        <p className="text-xs font-black text-slate-900">
          Total {formatReturnItemMoney(totalRefund)}
        </p>
      </div>
      <div className="space-y-2.5">
        {list.map((item) => (
          <ReturnItemCard
            key={normalizeReturnItemRow(item).key}
            item={item}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
};

export default ReturnItemsDetailList;
