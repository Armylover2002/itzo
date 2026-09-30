import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronUp, ChevronDown } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"
import ShiftTimingsEditor from "@food/components/restaurant/ShiftTimingsEditor"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const defaultShift = () => [{ openingTime: "09:00", closingTime: "22:00" }]

const getDefaultDays = () => ({
  Monday: { isOpen: true, shifts: defaultShift() },
  Tuesday: { isOpen: true, shifts: defaultShift() },
  Wednesday: { isOpen: true, shifts: defaultShift() },
  Thursday: { isOpen: true, shifts: defaultShift() },
  Friday: { isOpen: true, shifts: defaultShift() },
  Saturday: { isOpen: true, shifts: defaultShift() },
  Sunday: { isOpen: true, shifts: defaultShift() },
})

export default function OutletTimings() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [expandedDay, setExpandedDay] = useState("Monday")
  const isInternalUpdate = useRef(false)
  const [days, setDays] = useState(getDefaultDays)
  const [loading, setLoading] = useState(true)
  const [pendingApproval, setPendingApproval] = useState(false)
  const saveTimerRef = useRef(null)

  // Load from backend on mount. Response's outletTimings is day-keyed and always carries
  // a `.shifts` array per day (falls back to a single-entry array mirroring the legacy
  // openingTime/closingTime if the restaurant has old-style flat timing data).
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await restaurantAPI.getOutletTimings()
        const payload = res?.data?.data || res?.data
        const outletTimings = payload?.outletTimings
        if (mounted && outletTimings && typeof outletTimings === "object") {
          setDays({ ...getDefaultDays(), ...outletTimings })
        }
        if (mounted) setPendingApproval(Boolean(payload?.pendingApproval))
      } catch (error) {
        debugError("Error loading outlet timings from backend:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Manual save handler. Builds the day-keyed payload the backend's
  // normalizeTimingsFromInput expects: { isOpen, openingTime, closingTime, shifts }
  // per day, with shifts as the source of truth (openingTime/closingTime sent for
  // back-compat, derived from shifts[0]).
  const handleSave = async () => {
    try {
      setLoading(true)
      const outgoing = {}
      for (const [day, dayData] of Object.entries(days)) {
        const shifts = (dayData.shifts || []).map((s) => ({
          openingTime: s.openingTime,
          closingTime: s.closingTime,
        }))
        outgoing[day] = {
          isOpen: Boolean(dayData.isOpen) && shifts.length > 0,
          openingTime: shifts[0]?.openingTime || "",
          closingTime: shifts[0]?.closingTime || "",
          shifts,
        }
      }
      const resp = await restaurantAPI.saveOutletTimings(outgoing)
      const payload = resp?.data?.data || resp?.data
      setPendingApproval(Boolean(payload?.pendingApproval))
      window.dispatchEvent(new Event("outletTimingsUpdated"))
      isInternalUpdate.current = false // Reset after successful save
      toast.success("Outlet timings saved successfully")
    } catch (error) {
      debugError("Error saving outlet timings to backend:", error)
      toast.error("Failed to save outlet timings")
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (day) => {
    setExpandedDay(expandedDay === day ? null : day)
  }

  const toggleDayOpen = (day) => {
    isInternalUpdate.current = true
    setDays((prev) => {
      const newOpen = !prev[day].isOpen
      return {
        ...prev,
        [day]: {
          ...prev[day],
          isOpen: newOpen,
          shifts: newOpen
            ? (prev[day].shifts && prev[day].shifts.length ? prev[day].shifts : defaultShift())
            : [],
        },
      }
    })
  }

  const handleShiftsChange = (day, shifts) => {
    isInternalUpdate.current = true
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], shifts },
    }))
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  const renderShiftsEditor = (day, dayData) =>
    dayData.isOpen ? (
      <ShiftTimingsEditor
        shifts={dayData.shifts}
        onChange={(shifts) => handleShiftsChange(day, shifts)}
        hideDayToggle
      />
    ) : (
      <p className="text-sm text-gray-500 lg:pl-0 pl-6">This day is closed</p>
    )

  if (loading) {
    return (
      <div className="min-h-full bg-white flex items-center justify-center lg:bg-slate-50">
        <div className="text-sm text-gray-600">Loading outlet timings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-white overflow-x-hidden lg:bg-slate-50 lg:pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 backdrop-blur bg-white/95">
        <div className="flex items-center gap-3 lg:max-w-4xl lg:mx-auto lg:px-8 lg:py-2">
          <button
            onClick={() => navigate("/food/restaurant/explore")}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900 lg:text-2xl">Outlet timings</h1>
            <p className="hidden text-sm text-gray-500 lg:block">Set your weekly opening and closing hours for delivery</p>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-[#10335D] text-white rounded-lg text-sm font-semibold hover:bg-[#0A2647] transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 lg:max-w-4xl lg:mx-auto lg:px-8 lg:py-8">
        {/* Delivery Section Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-left">
              <h2 className="text-base font-semibold text-blue-600 lg:text-lg">{companyName} delivery</h2>
              <p className="hidden lg:block text-sm text-gray-500 mt-1">Don't forget to save your changes</p>
            </div>
          </div>
          <div className="h-0.5 bg-blue-600 lg:max-w-xs"></div>
        </div>

        {/* Desktop layout: one row per day, shift editor expands below the toggle */}
        <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {dayNames.map((day, index) => {
            const dayData = days[day] || { isOpen: true, shifts: defaultShift() }
            return (
              <div
                key={`desktop-${day}`}
                className={`px-6 py-5 ${index !== dayNames.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-gray-900">{day}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">{dayData.isOpen ? "Open" : "Closed"}</span>
                    <Switch
                      checked={dayData.isOpen}
                      onCheckedChange={() => toggleDayOpen(day)}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                    />
                  </div>
                </div>
                <div className="mt-4 max-w-xl">{renderShiftsEditor(day, dayData)}</div>
              </div>
            )
          })}
        </div>

        {/* Mobile accordion */}
        <div className="space-y-2 lg:hidden">
          {dayNames.map((day, index) => {
            const dayData = days[day] || { isOpen: true, shifts: defaultShift() }
            const isExpanded = expandedDay === day

            return (
              <motion.div
                key={day}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="bg-white border border-gray-200 rounded-sm overflow-hidden"
              >
                {/* Day Header */}
                <div
                  className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-color transition-all ${isExpanded ? "bg-gray-100" : ""}`}
                >
                  <button
                    onClick={() => toggleDay(day)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-700" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-700" />
                    )}
                    <span className="text-base font-medium text-gray-900">{day}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-700">{dayData.isOpen ? "Open" : "Close"}</span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={dayData.isOpen}
                        onCheckedChange={() => toggleDayOpen(day)}
                        className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-4 border-t border-gray-100">
                        {renderShiftsEditor(day, dayData)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
