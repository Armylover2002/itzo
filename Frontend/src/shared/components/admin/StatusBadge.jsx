import { Badge } from "@food/components/ui/badge";
import { cn } from "@food/utils/utils";

/**
 * StatusBadge — the one status chip for the whole admin panel.
 * Composes the existing Badge primitive (no duplication) and maps common
 * status strings to a unified, brand-aligned color set.
 */
const STATUS_STYLES = {
  success: "bg-[#ECFDF3] text-[#15803D] border-[#BBF7D0]",
  warning: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  danger: "bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]",
  info: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  primary: "bg-[var(--blaze-primary-light)] text-[var(--blaze-primary)] border-[#FFD6D6]",
  neutral: "bg-[#F4F4F5] text-[#52525B] border-[#E4E4E7]",
};

// Map many real-world status words to a tone.
const STATUS_ALIASES = {
  active: "success",
  approved: "success",
  completed: "success",
  delivered: "success",
  paid: "success",
  settled: "success",
  success: "success",
  online: "success",

  pending: "warning",
  processing: "warning",
  warning: "warning",
  queued: "warning",
  inreview: "warning",
  return: "warning",
  returnrequested: "warning",
  returnapproved: "warning",
  returnpickupassigned: "warning",
  returnintransit: "warning",
  returned: "warning",
  refundcompleted: "success",

  rejected: "danger",
  returnrejected: "danger",
  returncancelled: "danger",
  cancelled: "danger",
  canceled: "danger",
  failed: "danger",
  danger: "danger",
  error: "danger",
  refunded: "danger",
  expired: "danger",

  info: "info",
  scheduled: "info",

  inactive: "neutral",
  offline: "neutral",
  draft: "neutral",
  neutral: "neutral",
};

export default function StatusBadge({ status, label, tone, className }) {
  const key = String(tone || status || "")
    .toLowerCase()
    .replace(/[\s_-]/g, "");
  const resolvedTone = tone || STATUS_ALIASES[key] || "neutral";
  const text = label || status || "—";

  return (
    <Badge
      variant="outline"
      className={cn("rounded-full font-medium capitalize", STATUS_STYLES[resolvedTone], className)}
    >
      {text}
    </Badge>
  );
}
