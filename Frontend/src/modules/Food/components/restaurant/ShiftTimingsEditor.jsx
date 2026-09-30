import { Clock, Plus, X } from "lucide-react"

// Shared multi-shift timing picker used by owner onboarding, admin's direct-add-restaurant
// flow, and the restaurant dashboard's own outlet-timings page. Keep it simple: a list of
// up to 3 shift cards, each with an open/close time and its own 7-day toggle grid.
//
// Shift shape: { openingTime: "HH:mm", closingTime: "HH:mm", days: ["Mon", ...] }
export const MAX_SHIFTS = 3
export const SHIFT_DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export const emptyShift = () => ({ openingTime: "", closingTime: "", days: [] })

// Back-compat helper: turn the legacy single-window { openingTime, closingTime, openDays }
// shape into the shifts array this editor expects, so onboarding/admin can seed it once.
export const shiftsFromLegacyWindow = (openingTime, closingTime, openDays) => [
  {
    openingTime: openingTime || "",
    closingTime: closingTime || "",
    days: Array.isArray(openDays) ? openDays : [],
  },
]

export default function ShiftTimingsEditor({ shifts, onChange, errors = {}, disabled = false, hideDayToggle = false }) {
  const list = Array.isArray(shifts) && shifts.length ? shifts : [emptyShift()]

  const updateShift = (index, patch) => {
    onChange(list.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const toggleDay = (index, day) => {
    const shift = list[index]
    const has = shift.days.includes(day)
    updateShift(index, {
      days: has ? shift.days.filter((d) => d !== day) : [...shift.days, day],
    })
  }

  const addShift = () => {
    if (list.length >= MAX_SHIFTS) return
    onChange([...list, emptyShift()])
  }

  const removeShift = (index) => {
    onChange(list.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {list.map((shift, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700">
              <Clock className="h-3.5 w-3.5 text-[#10335D]" />
              Shift {index + 1}
            </span>
            {list.length > 1 && !disabled && (
              <button
                type="button"
                onClick={() => removeShift(index)}
                className="text-slate-400 transition-colors hover:text-red-500"
                aria-label={`Remove shift ${index + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs">
              <span className="mb-1 block text-slate-600">Opening time</span>
              <input
                type="time"
                value={shift.openingTime || ""}
                disabled={disabled}
                onChange={(e) => updateShift(index, { openingTime: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#10335D]/40 focus:outline-none focus:ring-2 focus:ring-[#10335D]/10"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-slate-600">Closing time</span>
              <input
                type="time"
                value={shift.closingTime || ""}
                disabled={disabled}
                onChange={(e) => updateShift(index, { closingTime: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#10335D]/40 focus:outline-none focus:ring-2 focus:ring-[#10335D]/10"
              />
            </label>
          </div>

          {!hideDayToggle && (
            <div className="grid grid-cols-7 gap-1.5">
              {SHIFT_DAY_LABELS.map((day) => {
                const active = shift.days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDay(index, day)}
                    className={`flex aspect-square items-center justify-center rounded-lg border text-[11px] font-semibold transition-colors ${
                      active
                        ? "border-[#10335D] bg-[#10335D] text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {day.charAt(0)}
                  </button>
                )
              })}
            </div>
          )}

          {errors[index] && <p className="text-xs text-red-500">{errors[index]}</p>}
        </div>
      ))}

      {list.length < MAX_SHIFTS && !disabled && (
        <button
          type="button"
          onClick={addShift}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#10335D] hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add another shift
        </button>
      )}
      {errors.general && <p className="text-xs text-red-500">{errors.general}</p>}
    </div>
  )
}
