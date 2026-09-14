import { useState, useMemo, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "./button"

interface WeekCalendarProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onClose?: () => void
}

export function WeekCalendar({ selectedDate, onDateChange, onClose }: WeekCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  
  // Sync current month with selected date
  useEffect(() => {
    setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
  }, [selectedDate])
  
  // Get week start (Monday) and end (Sunday) for a given date
  const getWeekRange = (date: Date) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    const monday = new Date(d.setDate(diff))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    return { start: monday, end: sunday }
  }
  
  const selectedWeek = getWeekRange(selectedDate)
  
  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - startDate.getDay() + (startDate.getDay() === 0 ? -6 : 1)) // Start from Monday
    
    const days = []
    const currentDate = new Date(startDate)
    
    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return days
  }, [currentMonth])
  
  // Check if a date is in the selected week
  const isInSelectedWeek = (date: Date) => {
    const week = getWeekRange(date)
    return week.start.getTime() === selectedWeek.start.getTime() &&
           week.end.getTime() === selectedWeek.end.getTime()
  }
  
  // Check if date is in current month
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth()
  }
  
  // Handle date click
  const handleDateClick = (date: Date) => {
    onDateChange(date)
    if (onClose) {
      setTimeout(() => onClose(), 100)
    }
  }
  
  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"]
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-full max-w-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPreviousMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-semibold text-gray-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, index) => {
          const isSelected = isInSelectedWeek(date)
          const isCurrentMonthDay = isCurrentMonth(date)
          const isToday = date.toDateString() === new Date().toDateString()
          
          return (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              className={`
                h-9 w-9 text-xs rounded-md transition-colors
                ${isCurrentMonthDay ? 'text-gray-900' : 'text-gray-400'}
                ${isSelected 
                  ? 'bg-green-500 text-white font-semibold' 
                  : 'hover:bg-gray-100'
                }
                ${isToday && !isSelected ? 'bg-blue-50 text-blue-600 font-medium' : ''}
              `}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
      
      {/* Selected week display */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-xs text-gray-600 text-center">
          Selected: {selectedWeek.start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - {selectedWeek.end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    </div>
  )
}

