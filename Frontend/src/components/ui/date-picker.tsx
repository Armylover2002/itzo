import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import Button from "@shared/components/ui/Button";

interface DatePickerProps {
  value?: string; // ISO date string yyyy-MM-dd
  onChange: (value: string | "") => void;
  min?: string;
  max?: string;
  placeholder?: string;
  align?: "left" | "right";
  popupClassName?: string;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  min,
  max,
  placeholder = "dd-mm-yyyy",
  align = "left",
  popupClassName,
  disabled = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  // Stable id per DatePicker instance so we can close others when one opens
  const idRef = React.useRef<string>(Math.random().toString(36).slice(2));
  const selectedDate = value ? new Date(value) : undefined;

  // Close when another DatePicker opens
  React.useEffect(() => {
    const handleAnyOpen = (event: CustomEvent<string>) => {
      if (event.detail !== idRef.current) {
        setOpen(false);
      }
    };

    // Type cast because addEventListener doesn't know about CustomEvent generic
    const listener = (e: Event) => handleAnyOpen(e as CustomEvent<string>);

    window.addEventListener("date-picker-open", listener);
    return () => {
      window.removeEventListener("date-picker-open", listener);
    };
  }, []);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const isDisabled = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (min) {
      const minDate = new Date(min);
      minDate.setHours(0, 0, 0, 0);
      if (d < minDate) return true;
    }
    if (max) {
      const maxDate = new Date(max);
      maxDate.setHours(23, 59, 59, 999);
      if (d > maxDate) return true;
    }
    return false;
  };

  const handleSelect = (date?: Date) => {
    if (!date) {
      onChange("");
      setOpen(false);
      return;
    }
    if (isDisabled(date)) {
      return;
    }
    const iso = date.toISOString().split("T")[0];
    onChange(iso);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-semibold text-[11px] h-9 px-3 rounded-lg border border-slate-200 bg-slate-50",
          !value && "text-slate-400",
          disabled && "opacity-60 cursor-not-allowed"
        )}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          const next = !open;
          if (next) {
            window.dispatchEvent(
              new CustomEvent("date-picker-open", {
                detail: idRef.current,
              })
            );
          }
          setOpen(next);
        }}
      >
        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
        {value && selectedDate
          ? format(selectedDate, "dd MMM yyyy")
          : placeholder}
      </Button>
      {open && (
        <div
          className={cn(
            "absolute z-50 top-full mt-2 w-[280px] max-w-[90vw] rounded-xl border border-slate-200 bg-white shadow-xl",
            align === "right" ? "right-0" : "left-0",
            popupClassName
          )}
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            disabled={isDisabled}
            onDayClick={(_day, _modifiers, e) => {
              e.preventDefault();
            }}
            captionLayout="dropdown"
            className="rounded-lg border"
          />
        </div>
      )}
    </div>
  );
};

