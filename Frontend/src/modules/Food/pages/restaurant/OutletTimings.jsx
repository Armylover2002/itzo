import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronUp, ChevronDown, Clock, Edit2 } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Helper function to convert "HH:mm" string to Date object
const stringToTime = (timeString) => {
  if (!timeString || !timeString.includes(":")) {
    return new Date(2000, 0, 1, 9, 0) // Default to 9:00 AM
  }
  const [hours, minutes] = timeString.split(":").map(Number)
  // Ensure valid hours (0-23) and minutes (0-59)
  const validHours = Math.max(0, Math.min(23, hours || 9))
  const validMinutes = Math.max(0, Math.min(59, minutes || 0))
  return new Date(2000, 0, 1, validHours, validMinutes)
}

// Helper function to convert Date object to "HH:mm" string
const timeToString = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "09:00"
  }
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

// Format time from 24-hour to 12-hour format for display
const formatTime12Hour = (time24) => {
  if (!time24) return "09:00 AM"
  const [hours, minutes] = time24.split(":").map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  const minutesStr = minutes.toString().padStart(2, '0')
  return `${hours12}:${minutesStr} ${period}`
}

const getDefaultDays = () => ({
  Monday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Tuesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Wednesday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Thursday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Friday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Saturday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
  Sunday: { isOpen: true, openingTime: "09:00", closingTime: "22:00" },
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

  // Load from backend on mount.
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

  // Manual save handler
  const handleSave = async () => {
    try {
      setLoading(true)
      const resp = await restaurantAPI.saveOutletTimings(days)
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
    setDays(prev => {
      const newOpen = !prev[day].isOpen
      return {
        ...prev,
        [day]: {
          ...prev[day],
          isOpen: newOpen,
          openingTime: newOpen ? (prev[day].openingTime || "09:00") : "",
          closingTime: newOpen ? (prev[day].closingTime || "22:00") : ""
        }
      }
    })
  }

  const handleTimeChange = (day, timeType, newTime) => {
    if (!newTime) {
      debugWarn('?? No time value received in handleTimeChange')
      return
    }
    
    isInternalUpdate.current = true
    const timeString = timeToString(newTime)
    
    // Validate time string format
    if (!timeString || !timeString.includes(":")) {
      debugWarn('?? Invalid time string generated:', timeString)
      return
    }
    
    debugLog(`?? Time changed for ${day} - ${timeType}: ${timeString}`)
    
    setDays(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeType]: timeString
      }
    }))
  }

  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  const timePickerSx = {
    "& .MuiOutlinedInput-root": {
      height: "36px",
      fontSize: "12px",
      backgroundColor: "white",
      "& fieldset": { borderColor: "#e5e7eb" },
      "&:hover fieldset": { borderColor: "#d1d5db" },
      "&.Mui-focused fieldset": { borderColor: "#000" },
    },
    "& .MuiInputBase-input": { padding: "8px 12px", fontSize: "12px" },
  }

  const renderTimeFields = (day, dayData) => (
    dayData.isOpen ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Opening time
          </label>
          <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
            <MobileTimePicker
              value={stringToTime(dayData.openingTime)}
              onChange={(newValue) => { if (newValue) handleTimeChange(day, "openingTime", newValue) }}
              onAccept={(newValue) => { if (newValue) handleTimeChange(day, "openingTime", newValue) }}
              slotProps={{
                textField: {
                  variant: "outlined",
                  size: "small",
                  placeholder: "Select opening time",
                  sx: timePickerSx,
                },
              }}
              format="hh:mm a"
            />
          </div>
          <p className="text-xs text-gray-500">Current: {formatTime12Hour(dayData.openingTime)}</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Closing time
          </label>
          <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
            <MobileTimePicker
              value={stringToTime(dayData.closingTime)}
              onChange={(newValue) => { if (newValue) handleTimeChange(day, "closingTime", newValue) }}
              onAccept={(newValue) => { if (newValue) handleTimeChange(day, "closingTime", newValue) }}
              slotProps={{
                textField: {
                  variant: "outlined",
                  size: "small",
                  placeholder: "Select closing time",
                  sx: timePickerSx,
                },
              }}
              format="hh:mm a"
            />
          </div>
          <p className="text-xs text-gray-500">Current: {formatTime12Hour(dayData.closingTime)}</p>
        </div>
      </div>
    ) : (
      <p className="text-sm text-gray-500 lg:pl-0 pl-6">This day is closed</p>
    )
  )

  if (loading) {
    return (
      <div className="min-h-full bg-white flex items-center justify-center lg:bg-slate-50">
        <div className="text-sm text-gray-600">Loading outlet timings...</div>
      </div>
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
              className="px-4 py-2 bg-[#0D315B] text-white rounded-lg text-sm font-semibold hover:bg-[#0A2647] transition-colors"
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

          {/* Desktop table layout */}
          <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="grid grid-cols-[140px_100px_1fr_1fr] gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Day</span>
              <span>Status</span>
              <span>Opening</span>
              <span>Closing</span>
            </div>
            {dayNames.map((day) => {
              const dayData = days[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
              return (
                <div
                  key={`desktop-${day}`}
                  className="grid grid-cols-[140px_100px_1fr_1fr] gap-4 px-6 py-5 border-b border-slate-100 items-start last:border-b-0"
                >
                  <span className="text-sm font-semibold text-gray-900 pt-2">{day}</span>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-xs font-medium text-gray-600">{dayData.isOpen ? "Open" : "Closed"}</span>
                    <Switch
                      checked={dayData.isOpen}
                      onCheckedChange={() => toggleDayOpen(day)}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300"
                    />
                  </div>
                  <div className="min-w-0">
                    {dayData.isOpen ? (
                      <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/60 max-w-[200px]">
                        <MobileTimePicker
                          value={stringToTime(dayData.openingTime)}
                          onChange={(newValue) => { if (newValue) handleTimeChange(day, "openingTime", newValue) }}
                          onAccept={(newValue) => { if (newValue) handleTimeChange(day, "openingTime", newValue) }}
                          slotProps={{ textField: { variant: "outlined", size: "small", sx: timePickerSx } }}
                          format="hh:mm a"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 pt-2 block">—</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {dayData.isOpen ? (
                      <div className="border border-gray-200 rounded-lg px-3 py-2 bg-gray-50/60 max-w-[200px]">
                        <MobileTimePicker
                          value={stringToTime(dayData.closingTime)}
                          onChange={(newValue) => { if (newValue) handleTimeChange(day, "closingTime", newValue) }}
                          onAccept={(newValue) => { if (newValue) handleTimeChange(day, "closingTime", newValue) }}
                          slotProps={{ textField: { variant: "outlined", size: "small", sx: timePickerSx } }}
                          format="hh:mm a"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 pt-2 block">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Mobile accordion */}
          <div className="space-y-2 lg:hidden">
            {dayNames.map((day, index) => {
              const dayData = days[day] || { isOpen: true, openingTime: "09:00", closingTime: "22:00" }
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
                          {renderTimeFields(day, dayData)}
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
    </LocalizationProvider>
  )
}

