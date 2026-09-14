import React from "react";
import { addDays, startOfWeek, endOfWeek } from "date-fns";

// Hoisted formatter — created once at module load, never recreated per call
const weekDayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
import { cn } from "@food/utils/utils";
import { Button } from "@food/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover";
import { Calendar } from "@food/components/ui/calendar";
import { ChevronDown } from "lucide-react";

/**
 * WeekSelector (JSX version)
 * - Pills: This week, Last week, Select week ?
 * - Centered date range with hairlines (like screenshot)
 * - shadcn/ui + Tailwind
 */
export default function WeekSelector({ weekStartsOn = 0, onChange, className }) {
  const [open, setOpen] = React.useState(false);
  const [anchorDate, setAnchorDate] = React.useState(new Date());

  const computeRange = React.useCallback(
    (date) => ({
      start: startOfWeek(date, { weekStartsOn }),
      end: endOfWeek(date, { weekStartsOn }),
    }),
    [weekStartsOn]
  );

  // current range shown
  const [range, setRange] = React.useState(() => computeRange(new Date()));

  const setThisWeek = () => {
    const r = computeRange(new Date());
    setRange(r);
    setAnchorDate(new Date());
    if (onChange) onChange(r);
  };

  const setLastWeek = () => {
    const lastWeekDate = addDays(new Date(), -7);
    const r = computeRange(lastWeekDate);
    setRange(r);
    setAnchorDate(lastWeekDate);
    if (onChange) onChange(r);
  };

  const onSelectDate = (date) => {
    if (!date) return;
    const r = computeRange(date);
    setRange(r);
    setAnchorDate(date);
    setOpen(false);
    if (onChange) onChange(r);
  };

  const fmt = (d) => weekDayFormatter.format(d).replace(" ", " ");

  return (
    <div className={cn("w-full", className)}>
      {/* Pills */}
      <div className="flex flex-nowrap items-center justify-center gap-1.5">
        <Button
          variant="outline"
          onClick={setThisWeek}
          className={cn(
            "rounded-md px-2 h-10 text-xs whitespace-nowrap",
            isSameRange(range, computeRange(new Date())) &&
            "bg-emerald-50 text-emerald-900 border-emerald-200"
          )}
        >
          This week
        </Button>

        <Button
          variant="outline"
          onClick={setLastWeek}
          className="rounded-md px-2 h-10 text-xs whitespace-nowrap"
        >
          Last week
        </Button>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="rounded-md px-2 h-10 text-xs inline-flex items-center justify-center whitespace-nowrap"
            >
              Select day <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0" align="start">
            {/* Using single-date selection; we compute its week. */}
            <Calendar
              mode="single"
              selected={anchorDate}
              onSelect={onSelectDate}
              className="rounded-md"
              captionLayout="dropdown-buttons"
              fromYear={2020}
              toYear={2030}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Divider + Date Range */}
      <div className="mt-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-muted" />
        <div className="text-lg sm:text-xl font-semibold text-muted-foreground">
          {fmt(range.start)} - {fmt(range.end)}
        </div>
        <div className="h-px flex-1 bg-muted" />
      </div>
    </div>
  );
}

function isSameRange(a, b) {
  return (
    a.start.toDateString() === b.start.toDateString() &&
    a.end.toDateString() === b.end.toDateString()
  );
}
