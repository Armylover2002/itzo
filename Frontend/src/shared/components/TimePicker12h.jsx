import { useEffect, useState } from "react"

// 12-hour (AM/PM) time picker that replaces native <input type="time">, which renders in
// 24-hour "railway" format on many devices. The value in/out stays "HH:mm" (24h) so every
// existing consumer, validator and the backend keep working unchanged — only the UI differs.
//
// `className` styles the outer box (pass the same border/padding/rounded classes the old
// input used); the hour / minute / AM-PM selects inside are borderless.

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTE_STEP = 5
const BASE_MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) =>
  String(i * MINUTE_STEP).padStart(2, "0"),
)

const EMPTY_PARTS = { hour: "", minute: "", period: "" }

/** "HH:mm" (24h) -> { hour: "1".."12", minute: "00".."59", period: "AM" | "PM" } */
export const toTwelveHourParts = (value) => {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || "").trim())
  if (!match) return EMPTY_PARTS
  const h24 = Number(match[1])
  if (h24 > 23 || Number(match[2]) > 59) return EMPTY_PARTS
  return {
    hour: String(h24 % 12 || 12),
    minute: match[2],
    period: h24 >= 12 ? "PM" : "AM",
  }
}

/** { hour, minute, period } -> "HH:mm" (24h) */
export const fromTwelveHourParts = ({ hour, minute, period }) => {
  let h = Number(hour) % 12
  if (period === "PM") h += 12
  return `${String(h).padStart(2, "0")}:${minute || "00"}`
}

export default function TimePicker12h({
  value,
  onChange,
  disabled = false,
  required = false,
  className = "",
  ariaLabel = "Time",
}) {
  const [parts, setParts] = useState(() => toTwelveHourParts(value))

  // Keep local parts in sync when the parent value changes (e.g. draft restore, reset).
  // Local state lets the user pick minute/AM-PM before the hour without losing it.
  useEffect(() => {
    if (value) {
      setParts(toTwelveHourParts(value))
    } else {
      // Empty value: clear a previously complete pick (parent reset), keep a partial one.
      setParts((prev) => (prev.hour ? EMPTY_PARTS : prev))
    }
  }, [value])

  const update = (patch) => {
    const next = { ...parts, ...patch }
    if (!next.hour) {
      setParts(next)
      return
    }
    const filled = { ...next, minute: next.minute || "00", period: next.period || "AM" }
    setParts(filled)
    onChange?.(fromTwelveHourParts(filled))
  }

  // Preserve an off-step minute coming from existing data (e.g. 09:07).
  const minutes =
    parts.minute && !BASE_MINUTES.includes(parts.minute)
      ? [...BASE_MINUTES, parts.minute].sort()
      : BASE_MINUTES

  const selectClass =
    "appearance-none bg-transparent text-inherit outline-none cursor-pointer disabled:cursor-not-allowed text-center"
  const optionClass = "bg-white text-gray-900"

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex items-center gap-0.5 ${disabled ? "opacity-60" : ""} ${className}`}
    >
      <select
        aria-label={`${ariaLabel} hour`}
        value={parts.hour}
        disabled={disabled}
        required={required}
        onChange={(e) => update({ hour: e.target.value })}
        className={`${selectClass} min-w-[2ch]`}
      >
        <option value="" disabled className={optionClass}>
          --
        </option>
        {HOURS.map((h) => (
          <option key={h} value={h} className={optionClass}>
            {h}
          </option>
        ))}
      </select>
      <span className="select-none">:</span>
      <select
        aria-label={`${ariaLabel} minute`}
        value={parts.minute}
        disabled={disabled}
        onChange={(e) => update({ minute: e.target.value })}
        className={`${selectClass} min-w-[2ch]`}
      >
        <option value="" disabled className={optionClass}>
          --
        </option>
        {minutes.map((m) => (
          <option key={m} value={m} className={optionClass}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label={`${ariaLabel} AM or PM`}
        value={parts.period}
        disabled={disabled}
        onChange={(e) => update({ period: e.target.value })}
        className={`${selectClass} ml-auto pl-1 font-semibold`}
      >
        <option value="" disabled className={optionClass}>
          --
        </option>
        <option value="AM" className={optionClass}>AM</option>
        <option value="PM" className={optionClass}>PM</option>
      </select>
    </div>
  )
}
