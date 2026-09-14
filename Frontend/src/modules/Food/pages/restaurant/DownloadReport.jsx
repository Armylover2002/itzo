import { useState, useMemo, useEffect } from "react"
import { ArrowLeft, CheckCircle, Mail } from "lucide-react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"

const REPORT_VIEWS = [
  { id: "detailed", label: "Detailed report" },
  { id: "item", label: "Item sales report" },
]

const VIEW_TYPES = ["DAILY", "WEEKLY", "MONTHLY"]

export default function DownloadReport() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [reportView, setReportView] = useState("detailed")
  const [viewType, setViewType] = useState("DAILY")
  const durations = useMemo(() => {
    if (viewType === "WEEKLY") {
      return [
        { id: "4w", label: "Last 4 weeks" },
        { id: "8w", label: "Last 8 weeks" },
        { id: "12w", label: "Last 12 weeks" },
        { id: "custom", label: "Custom" },
      ]
    }
    if (viewType === "MONTHLY") {
      return [
        { id: "3m", label: "Last 3 months" },
        { id: "6m", label: "Last 6 months" },
        { id: "12m", label: "Last 12 months" },
        { id: "custom", label: "Custom" },
      ]
    }
    return [
      { id: "7", label: "Last 7 days" },
      { id: "14", label: "Last 14 days" },
      { id: "30", label: "Last 30 days" },
      { id: "custom", label: "Custom" },
    ]
  }, [viewType])

  const [duration, setDuration] = useState("7")
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (durations.length > 0 && !durations.find((d) => d.id === duration)) {
      setDuration(durations[0].id)
    }
  }, [viewType, durations, duration])

  const handleSend = () => {
    setShowSuccess(true)
    setTimeout(() => setShowSuccess(false), 2000)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="sticky top-0 z-20 bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-200">
        <button
          className="p-2 -ml-2 rounded-full hover:bg-gray-100"
          onClick={goBack}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Download report</h1>
      </div>

      <div className="bg-[#f8e7a0] text-gray-900 text-sm px-4 py-2">
        You are generating a report for <span className="font-semibold">All Outlets</span>
      </div>

      <div className="flex-1 px-4 py-5 space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Select the report view:</p>
          <div className="space-y-3">
            {REPORT_VIEWS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm text-gray-900">
                <input
                  type="radio"
                  name="reportView"
                  value={opt.id}
                  checked={reportView === opt.id}
                  onChange={() => setReportView(opt.id)}
                  className="w-5 h-5 accent-black"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Select view for data:</p>
          <div className="grid grid-cols-3 border border-gray-300 rounded-xl overflow-hidden text-center text-sm font-semibold">
            {VIEW_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => setViewType(type)}
                className={`py-2 ${viewType === type ? "bg-black text-white" : "bg-white text-gray-800"}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Select duration for report:</p>
          <div className="space-y-3">
            {durations.map((opt) => (
              <label key={opt.id} className="flex items-center gap-3 text-sm text-gray-900">
                <input
                  type="radio"
                  name="duration"
                  value={opt.id}
                  checked={duration === opt.id}
                  onChange={() => setDuration(opt.id)}
                  className="w-5 h-5 accent-black"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pb-6">
        <button
          onClick={handleSend}
          className="w-full bg-black text-white py-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Mail className="w-5 h-5" />
          Send an email
        </button>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-6 pointer-events-none">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-lg border border-gray-200 px-4 py-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Report queued</p>
                <p className="text-xs text-gray-600">We’ll email it to you shortly.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






