import { Plus, Pencil, Calendar, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"

export default function AddEditBasicCampaignDialog({ isOpen, onOpenChange, campaign, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    dateStart: "",
    dateEnd: "",
    timeStart: "",
    timeEnd: "",
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title || "",
        dateStart: campaign.dateStart || "",
        dateEnd: campaign.dateEnd || "",
        timeStart: campaign.timeStart || "",
        timeEnd: campaign.timeEnd || "",
      })
    } else {
      setFormData({
        title: "",
        dateStart: "",
        dateEnd: "",
        timeStart: "",
        timeEnd: "",
      })
    }
    setErrors({})
  }, [campaign, isOpen])

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.title.trim()) {
      newErrors.title = "Title is required"
    }
    
    if (!formData.dateStart) {
      newErrors.dateStart = "Start date is required"
    }
    
    if (!formData.dateEnd) {
      newErrors.dateEnd = "End date is required"
    }
    
    if (formData.dateStart && formData.dateEnd) {
      const start = new Date(formData.dateStart)
      const end = new Date(formData.dateEnd)
      if (end < start) {
        newErrors.dateEnd = "End date must be after start date"
      }
    }
    
    if (!formData.timeStart) {
      newErrors.timeStart = "Start time is required"
    }
    
    if (!formData.timeEnd) {
      newErrors.timeEnd = "End time is required"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2">
            {campaign ? <Pencil className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-blue-600" />}
            {campaign ? "Edit Campaign" : "Add New Campaign"}
          </DialogTitle>
          <DialogDescription>
            {campaign ? "Update campaign information" : "Create a new basic campaign"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter campaign title"
                className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                  errors.title ? "border-red-500" : "border-slate-300"
                }`}
                required
              />
              {errors.title && (
                <p className="text-xs text-red-500 mt-1">{errors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dateStart}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateStart: e.target.value }))}
                    className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.dateStart ? "border-red-500" : "border-slate-300"
                    }`}
                    required
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.dateStart && (
                  <p className="text-xs text-red-500 mt-1">{errors.dateStart}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  End Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.dateEnd}
                    onChange={(e) => setFormData(prev => ({ ...prev, dateEnd: e.target.value }))}
                    className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.dateEnd ? "border-red-500" : "border-slate-300"
                    }`}
                    required
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.dateEnd && (
                  <p className="text-xs text-red-500 mt-1">{errors.dateEnd}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.timeStart}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeStart: e.target.value }))}
                    className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.timeStart ? "border-red-500" : "border-slate-300"
                    }`}
                    required
                  />
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.timeStart && (
                  <p className="text-xs text-red-500 mt-1">{errors.timeStart}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  End Time <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={formData.timeEnd}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeEnd: e.target.value }))}
                    className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.timeEnd ? "border-red-500" : "border-slate-300"
                    }`}
                    required
                  />
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.timeEnd && (
                  <p className="text-xs text-red-500 mt-1">{errors.timeEnd}</p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
            >
              {campaign ? "Update Campaign" : "Create Campaign"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

