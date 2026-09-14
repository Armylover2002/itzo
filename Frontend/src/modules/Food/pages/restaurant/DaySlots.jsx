import { useState, useRef, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { ArrowLeft, Clock, Edit2, Trash2, ChevronDown, AlertTriangle, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Checkbox } from "@food/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@food/components/ui/popover"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const getDefaultDayData = () => ({
  isOpen: true,
  slots: [{ id: Date.now(), start: "03:45", end: "02:15", startPeriod: "am", endPeriod: "pm" }]
})

// Time Picker Wheel Component
function TimePickerWheel({ 
  isOpen, 
  onClose, 
  initialHour, 
  initialMinute, 
  initialPeriod,
  onConfirm 
}) {
  const parsedHour = Math.max(1, Math.min(12, parseInt(initialHour) || 1))
  // Ensure minute is a valid number between 0-59
  const parsedMinute = Math.max(0, Math.min(59, parseInt(initialMinute) || 0))
  const parsedPeriod = (initialPeriod === "am" || initialPeriod === "pm") ? initialPeriod : "am"
  
  const [selectedHour, setSelectedHour] = useState(parsedHour)
  const [selectedMinute, setSelectedMinute] = useState(parsedMinute)
  const [selectedPeriod, setSelectedPeriod] = useState(parsedPeriod)
  
  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const periodRef = useRef(null)

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const periods = ["am", "pm"]

  // Update state when initial values change
  useEffect(() => {
    if (isOpen) {
      setSelectedHour(parsedHour)
      setSelectedMinute(parsedMinute)
      setSelectedPeriod(parsedPeriod)
    }
  }, [isOpen, initialHour, initialMinute, initialPeriod, parsedHour, parsedMinute, parsedPeriod])

  // Scroll to selected value on mount and prevent body scroll
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll
      document.body.style.overflow = 'hidden'

      // Update state first
      setSelectedHour(parsedHour)
      setSelectedMinute(parsedMinute)
      setSelectedPeriod(parsedPeriod)

      // Wait for DOM to render, then scroll to position
      const timer = setTimeout(() => {
        const padding = 80 // h-20 top padding
        const itemHeight = 40

        // Scroll hour and update state - set immediately first
        const hourIndex = parsedHour - 1
        if (hourRef.current) {
          const hourScrollPos = padding + (hourIndex * itemHeight)
          hourRef.current.scrollTop = hourScrollPos
          setSelectedHour(parsedHour)
          // Then smooth scroll
          setTimeout(() => {
            hourRef.current?.scrollTo({
              top: hourScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        // Scroll minute and update state - set immediately first
        const minuteIndex = parsedMinute
        if (minuteRef.current) {
          const minuteScrollPos = padding + (minuteIndex * itemHeight)
          minuteRef.current.scrollTop = minuteScrollPos
          setSelectedMinute(parsedMinute)
          // Then smooth scroll
          setTimeout(() => {
            minuteRef.current?.scrollTo({
              top: minuteScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }

        // Scroll period and update state - set immediately first
        const periodIndex = periods.indexOf(parsedPeriod)
        if (periodRef.current) {
          const periodScrollPos = padding + (periodIndex * itemHeight)
          periodRef.current.scrollTop = periodScrollPos
          setSelectedPeriod(parsedPeriod)
          // Then smooth scroll
          setTimeout(() => {
            periodRef.current?.scrollTo({
              top: periodScrollPos,
              behavior: 'smooth'
            })
          }, 50)
        }
      }, 150)
      
      return () => {
        clearTimeout(timer)
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen, parsedHour, parsedMinute, parsedPeriod])

  const scrollToValue = (container, index, itemHeight, updateState = null, values = null, immediate = false) => {
    if (!container) return
    const scrollPosition = index * itemHeight
    const clampedIndex = Math.max(0, Math.min(index, values ? values.length - 1 : index))
    
    // First set position immediately to ensure it's correct
    container.scrollTop = clampedIndex * itemHeight
    
    // Update state immediately
    if (updateState && values && values[clampedIndex] !== undefined) {
      updateState(values[clampedIndex])
    }
    
    // Then do smooth scroll if not immediate
    if (!immediate) {
      setTimeout(() => {
        container.scrollTo({
          top: clampedIndex * itemHeight,
          behavior: 'smooth'
        })
      }, 50)
    }
  }

  const handleScroll = (container, setValue, values, itemHeight) => {
    if (!container) return

    const padding = 80 // top spacer (h-20)
    const itemCenterOffset = itemHeight / 2
    const scrollTop = container.scrollTop
    const containerCenter = scrollTop + container.clientHeight / 2

    // Index of item whose center is closest to the visual center line
    const index = Math.round(
      (containerCenter - padding - itemCenterOffset) / itemHeight
    )

    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))
    const newValue = values[clampedIndex]

    if (newValue !== undefined) {
      setValue(newValue)
    }
  }

  const snapToCenter = (container, setValue, values, itemHeight) => {
    if (!container) return

    const padding = 80
    const itemCenterOffset = itemHeight / 2
    const scrollTop = container.scrollTop
    const containerCenter = scrollTop + container.clientHeight / 2

    const index = Math.round(
      (containerCenter - padding - itemCenterOffset) / itemHeight
    )
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1))

    const snapPosition = padding + clampedIndex * itemHeight
    container.scrollTo({
      top: snapPosition,
      behavior: "smooth",
    })

    if (values[clampedIndex] !== undefined) {
      setValue(values[clampedIndex])
    }
  }

  const handleConfirm = () => {
    const hourStr = selectedHour.toString()
    const minuteStr = selectedMinute.toString().padStart(2, '0')
    onConfirm(hourStr, minuteStr, selectedPeriod)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-lg shadow-2xl w-full max-w-xs overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Time Picker Content */}
          <div className="flex items-center justify-center py-8 px-4 relative">
            <style>{`
              .time-picker-scroll::-webkit-scrollbar {
                display: none;
              }
              .time-picker-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
            `}</style>
            
            {/* Hour Column */}
            <div className="flex-1 flex flex-col items-center">
              <div 
                ref={hourRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(hourRef.current, setSelectedHour, hours, 40)}
                onTouchEnd={() => snapToCenter(hourRef.current, setSelectedHour, hours, 40)}
              >
                <div className="h-20"></div>
                {hours.map((hour, index) => (
                  <div
                    key={hour}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${
                        selectedHour === hour
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                      }`}
                    >
                      {hour}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            {/* Colon Separator */}
            <div className="px-2">
              <span className="text-2xl font-bold text-gray-900">:</span>
            </div>

            {/* Minute Column */}
            <div className="flex-1 flex flex-col items-center">
              <div 
                ref={minuteRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(minuteRef.current, setSelectedMinute, minutes, 40)}
                onTouchEnd={() => snapToCenter(minuteRef.current, setSelectedMinute, minutes, 40)}
              >
                <div className="h-20"></div>
                {minutes.map((minute, index) => (
                  <div
                    key={minute}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${
                        selectedMinute === minute
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                      }`}
                    >
                      {minute.toString().padStart(2, "0")}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            {/* Period Column */}
            <div className="flex-1 flex flex-col items-center">
              <div 
                ref={periodRef}
                className="w-full h-48 overflow-y-scroll time-picker-scroll snap-y snap-mandatory"
                style={{
                  scrollSnapType: 'y mandatory',
                  scrollBehavior: 'smooth',
                  WebkitOverflowScrolling: 'touch'
                }}
                onScroll={() => handleScroll(periodRef.current, setSelectedPeriod, periods, 40)}
                onTouchEnd={() => snapToCenter(periodRef.current, setSelectedPeriod, periods, 40)}
              >
                <div className="h-20"></div>
                {periods.map((period, index) => (
                  <div
                    key={period}
                    className="h-10 flex items-center justify-center snap-center"
                    style={{ minHeight: '40px' }}
                  >
                    <span
                      className={`text-lg transition-all duration-200 ${
                        selectedPeriod === period
                          ? "font-bold text-gray-900 text-xl"
                          : "font-normal text-gray-400 text-base"
                      }`}
                    >
                      {period.toUpperCase()}
                    </span>
                  </div>
                ))}
                <div className="h-20"></div>
              </div>
            </div>

            {/* Selection Indicator Lines */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="border-t border-gray-300 mx-4"></div>
              <div className="border-b border-gray-300 mx-4 mt-10"></div>
            </div>
          </div>

          {/* Okay Button */}
          <div className="border-t border-gray-200 px-4 py-4 flex justify-center">
            <button
              onClick={handleConfirm}
              className="text-blue-600 hover:text-blue-700 font-medium text-base transition-colors"
            >
              Okay
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function DaySlots() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const { day } = useParams()
  const dayName = day ? day.charAt(0).toUpperCase() + day.slice(1) : "Monday"
  
  const [dayData, setDayData] = useState(getDefaultDayData)

  const [copyToAllDays, setCopyToAllDays] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [slotToDelete, setSlotToDelete] = useState(null)
  const [timePickerOpen, setTimePickerOpen] = useState({ 
    slotId: null, 
    field: null,
    type: null // 'time' or 'period'
  })
  
  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => i + 1)
  
  // Generate minute options (00-59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))
  
  // Get current hour and minute from slot time
  const getTimeParts = (timeStr) => {
    if (!timeStr || !timeStr.includes(":")) return { hour: "1", minute: "00" }
    const [h, m] = timeStr.split(":")
    const hour = parseInt(h) || 1
    return {
      hour: hour.toString(),
      minute: (m || "00").padStart(2, '0')
    }
  }
  
  // Handle time selection from custom picker
  const handleCustomTimeChange = (slotId, field, hour, minute, period = null) => {
    const formattedTime = `${hour}:${minute}`
    updateSlot(slotId, field, formattedTime)
    if (period && (field === "start" || field === "end")) {
      const periodField = field === "start" ? "startPeriod" : "endPeriod"
      updateSlot(slotId, periodField, period)
    }
  }

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  // Calculate duration for a slot
  const calculateSlotDuration = (start, end, startPeriod, endPeriod) => {
    const parseTime = (timeStr, period) => {
      if (!timeStr || !timeStr.includes(":")) return 0
      const [hours, minutes] = timeStr.split(":")
      let hour = parseInt(hours) || 0
      const mins = parseInt(minutes) || 0
      if (period === "pm" && hour !== 12) hour += 12
      if (period === "am" && hour === 12) hour = 0
      return hour * 60 + mins
    }

    const startMinutes = parseTime(start, startPeriod)
    const endMinutes = parseTime(end, endPeriod)
    let diff = endMinutes - startMinutes
    
    if (diff < 0) diff += 24 * 60
    
    const hours = Math.floor(diff / 60)
    const minutes = diff % 60
    
    if (minutes === 0) {
      return `${hours} hrs`
    }
    return `${hours} hrs ${minutes} mins`
  }

  // Calculate total duration
  const calculateTotalDuration = () => {
    if (!dayData.slots || dayData.slots.length === 0) return "0 hrs"

    let totalMinutes = 0
    dayData.slots.forEach(slot => {
      const parseTime = (timeStr, period) => {
        const [hours, minutes] = timeStr.split(":")
        let hour = parseInt(hours)
        if (period === "pm" && hour !== 12) hour += 12
        if (period === "am" && hour === 12) hour = 0
        return hour * 60 + parseInt(minutes)
      }

      const startMinutes = parseTime(slot.start, slot.startPeriod)
      const endMinutes = parseTime(slot.end, slot.endPeriod)
      let diff = endMinutes - startMinutes
      if (diff < 0) diff += 24 * 60
      totalMinutes += diff
    })

    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (minutes === 0) {
      return `${hours} hrs`
    }
    return `${hours} hrs ${minutes} mins`
  }

  const updateSlot = (slotId, field, value) => {
    setDayData(prev => ({
      ...prev,
      slots: prev.slots.map(slot =>
        slot.id === slotId ? { ...slot, [field]: value } : slot
      )
    }))
  }

  const addSlot = () => {
    if (dayData.slots.length >= 3) {
      alert("Maximum 3 slots allowed per day")
      return
    }
    setDayData(prev => ({
      ...prev,
      slots: [
        ...prev.slots,
        {
          id: Date.now() + Math.random(),
          start: "09:00",
          end: "05:00",
          startPeriod: "am",
          endPeriod: "pm"
        }
      ]
    }))
  }

  const deleteSlot = (slotId) => {
    if (dayData.slots.length === 1) {
      alert("At least one slot is required")
      return
    }
    
    // Open confirmation dialog
    setSlotToDelete(slotId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (slotToDelete) {
      setDayData(prev => ({
        ...prev,
        slots: prev.slots.filter(slot => slot.id !== slotToDelete)
      }))
      setDeleteDialogOpen(false)
      setSlotToDelete(null)
    }
  }

  const handleSave = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      let allDays = saved ? JSON.parse(saved) : {}

      if (copyToAllDays) {
        // Copy to all days
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        dayNames.forEach(d => {
          allDays[d] = { ...dayData }
        })
      } else {
        // Update only current day
        allDays[dayName] = dayData
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(allDays))
      window.dispatchEvent(new Event("outletTimingsUpdated"))
      navigate("/restaurant/outlet-timings")
    } catch (error) {
      debugError("Error saving day slots:", error)
      alert("Error saving slots. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/restaurant/outlet-timings")}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{dayName}</h1>
            <p className="text-sm text-gray-500">{companyName} delivery</p>
          </div>
        </div>
      </div>
        
        <div className="bg-gray-50 p-2">
          <p className="text-sm text-gray-700">
            Add or modify your restaurant timings here. You can create maximum up to 3 time slots in a day.
          </p>
        </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">  
        {/* Instructional Text */}

        {/* Time Slots */}
        <div className="space-y-6 divide-gray-400">
          {dayData.slots.map((slot, index) => {
            const duration = calculateSlotDuration(slot.start, slot.end, slot.startPeriod, slot.endPeriod)
            return (
              <motion.div
                key={slot.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                className="bg-white rounded-0 p-4 space-y-3 mb-0 border-b border-gray-200"
              >
                {/* Slot Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-base font-bold text-gray-900">Slot-{index + 1}</span>
                    <span className="text-sm text-gray-600 ml-2">({duration})</span>
                  </div>
                  <button
                    onClick={() => deleteSlot(slot.id)}
                    className="w-8 h-8 bg-pink-100 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                    aria-label="Delete slot"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>

                {/* Start Time - All in one row */}
                <div className="flex w-full justify-between items-center gap-3">
                  <div className="flex  items-center gap-2 shrink-0">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Start Time</span>
                  </div>
                  <div 
                    className="relative flex items-center border border-gray-300 rounded-sm bg-gray-50 cursor-pointer"
                    onClick={() => setTimePickerOpen({ slotId: slot.id, field: "start", type: "time" })}
                  >
                    <input
                      type="text"
                      value={slot.start}
                      readOnly
                      placeholder="03:45"
                      className="w-20 px-2 py-2 bg-transparent text-gray-900 font-bold focus:outline-none cursor-pointer"
                      style={{ fontSize: '15px' }}
                    />
                    <button
                      type="button"
                      className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors z-10 relative"
                      aria-label="Open time picker"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 shrink-0" />
                    </button>
                  </div>
                  <div 
                    className="shrink-0 cursor-pointer"
                    onClick={() => setTimePickerOpen({ slotId: slot.id, field: "start", type: "period" })}
                  >
                    <div className="w-[70px] h-9 px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 font-medium flex items-center justify-between">
                      <span>{slot.startPeriod.toUpperCase()}</span>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </div>
                  </div>
                </div>

                {/* End Time - All in one row */}
                <div className="flex w-full justify-between items-center gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium mr-1 text-gray-700 whitespace-nowrap">End Time</span>
                  </div>
                  <div 
                    className="relative flex items-center border border-gray-300 rounded-sm bg-gray-50 cursor-pointer"
                    onClick={() => setTimePickerOpen({ slotId: slot.id, field: "end", type: "time" })}
                  >
                    <input
                      type="text"
                      value={slot.end}
                      readOnly
                      placeholder="02:15"
                      className="w-20 px-2 py-2 bg-transparent text-gray-900 font-bold focus:outline-none cursor-pointer"
                      style={{ fontSize: '15px' }}
                    />
                    <button
                      type="button"
                      className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors z-10 relative"
                      aria-label="Open time picker"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500 shrink-0" />
                    </button>
                  </div>
                  <div 
                    className="shrink-0 cursor-pointer"
                    onClick={() => setTimePickerOpen({ slotId: slot.id, field: "end", type: "period" })}
                  >
                    <div className="w-[70px] h-9 px-3 py-2 border border-gray-300 rounded-sm bg-white text-gray-900 font-medium flex items-center justify-between">
                      <span>{slot.endPeriod.toUpperCase()}</span>
                      <ChevronDown className="w-4 h-4 opacity-50" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Add Time Slot Button */}
        {dayData.slots.length < 3 && (
          <button
            onClick={addSlot}
            className="w-full text-blue-600 hover:text-blue-700 text-sm font-medium py-3 transition-colors"
          >
            + Add time slot
          </button>
        )}
      </div>

      {/* Sticky Bottom Controls */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-4 z-40 shadow-lg">
        <div className="space-y-4">
          {/* Copy to all days */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="copy-to-all"
              checked={copyToAllDays}
              onCheckedChange={setCopyToAllDays}
              className="w-5 h-5 border-2 border-gray-300 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <label
              htmlFor="copy-to-all"
              className="text-sm text-gray-700 cursor-pointer"
            >
              Copy above timings to all days
            </label>
          </div>

          {/* Total Duration */}
          <div className="text-sm text-gray-700">
            Total: {calculateTotalDuration()}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            className="w-full bg-gray-800 hover:bg-gray-900 text-white font-medium py-3 rounded-lg"
          >
            Save
          </Button>
        </div>
      </div>

      {/* Time Picker Modal */}
      {timePickerOpen.slotId && timePickerOpen.type === "time" && (() => {
        const currentSlot = dayData.slots.find(s => s.id === timePickerOpen.slotId)
        if (!currentSlot) return null
        const timeParts = getTimeParts(timePickerOpen.field === "start" ? currentSlot.start : currentSlot.end)
        const currentPeriod = timePickerOpen.field === "start" ? currentSlot.startPeriod : currentSlot.endPeriod
        
        return (
          <TimePickerWheel
            isOpen={true}
            onClose={() => setTimePickerOpen({ slotId: null, field: null, type: null })}
            initialHour={timeParts.hour}
            initialMinute={timeParts.minute}
            initialPeriod={currentPeriod}
            onConfirm={(hour, minute, period) => {
              handleCustomTimeChange(timePickerOpen.slotId, timePickerOpen.field, hour, minute, period)
              setTimePickerOpen({ slotId: null, field: null, type: null })
            }}
          />
        )
      })()}

      {/* Period Picker Modal */}
      {timePickerOpen.slotId && timePickerOpen.type === "period" && (() => {
        const currentSlot = dayData.slots.find(s => s.id === timePickerOpen.slotId)
        if (!currentSlot) return null
        const timeParts = getTimeParts(timePickerOpen.field === "start" ? currentSlot.start : currentSlot.end)
        const currentPeriod = timePickerOpen.field === "start" ? currentSlot.startPeriod : currentSlot.endPeriod
        
        return (
          <TimePickerWheel
            isOpen={true}
            onClose={() => setTimePickerOpen({ slotId: null, field: null, type: null })}
            initialHour={timeParts.hour}
            initialMinute={timeParts.minute}
            initialPeriod={currentPeriod}
            onConfirm={(hour, minute, period) => {
              handleCustomTimeChange(timePickerOpen.slotId, timePickerOpen.field, hour, minute, period)
              setTimePickerOpen({ slotId: null, field: null, type: null })
            }}
          />
        )
      })()}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-4">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <DialogTitle className="text-left">Delete Time Slot</DialogTitle>
            </div>
            <DialogDescription className="text-left text-gray-600 pt-2">
              Are you sure you want to delete this time slot? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)  
                setSlotToDelete(null)
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

