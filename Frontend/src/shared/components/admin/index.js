/**
 * Blaze Admin Design System — single import surface.
 *
 * Every admin page should build from these so the whole product looks like
 * one product. New components compose existing primitives (Card, Button,
 * Badge, Input, Select, Skeleton, Pagination, EmptyState) — nothing is
 * duplicated.
 */

// Layout & structure
export { default as PageHeader } from "./PageHeader";
export { default as SectionCard } from "./SectionCard";

// Data display
export { default as StatCard } from "./StatCard";
export { default as StatusBadge } from "./StatusBadge";
export { default as AdminTable } from "./AdminTable";

// Toolbars / filters / actions
export { default as FilterBar } from "./FilterBar";

// States
export {
  KpiCardSkeleton,
  KpiGridSkeleton,
  CardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "./LoadingState";

// Forms
export { FormLayout, FormSection, FormRow, FormField } from "./FormLayout";

// Reused existing primitives, surfaced here so pages have one import source
export { default as EmptyState } from "@/shared/components/EmptyState";
export { default as Pagination } from "@/shared/components/ui/Pagination";
export { BLAZE_CHART } from "@/shared/theme/blazeChartTheme";
