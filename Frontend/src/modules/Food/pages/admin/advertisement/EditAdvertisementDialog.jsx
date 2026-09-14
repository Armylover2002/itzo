import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"

const ADS_TYPES = [
  "Restaurant Promotion",
  "Video Promotion",
  "Image Promotion",
  "Banner Promotion",
]

export default function EditAdvertisementDialog({ isOpen, onOpenChange, ad, onSuccess }) {
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    adsType: "Restaurant Promotion",
    validity: "",
    priority: "2",
  })
  const [imageFile, setImageFile] = useState(null)
  const [videoFile, setVideoFile] = useState(null)

  useEffect(() => {
    if (ad && isOpen) {
      setFormData({
        title: ad.adsTitle || ad.title || "",
        description: ad.description || "",
        adsType: ad.adsType || "Restaurant Promotion",
        validity: ad.duration || ad.validity || "",
        priority: ad.priority ? String(ad.priority) : "2",
      })
      setImageFile(null)
      setVideoFile(null)
    }
  }, [ad, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!formData.validity.trim()) {
      toast.error("Validity is required")
      return
    }

    try {
      setSubmitting(true)
      const payload = new FormData()
      payload.append("title", formData.title.trim())
      payload.append("description", formData.description.trim())
      payload.append("adsType", formData.adsType)
      payload.append("category", formData.adsType)
      payload.append("validity", formData.validity.trim())
      if (imageFile) payload.append("image", imageFile)
      if (videoFile) payload.append("video", videoFile)

      await adminAPI.updateAdvertisement(ad._id, payload)
      
      if (formData.priority !== String(ad.priority || "2")) {
        try {
          await adminAPI.updateAdvertisementPriority(ad._id, formData.priority)
        } catch (priorityErr) {
          console.error("Failed to update priority", priorityErr)
        }
      }

      toast.success("Advertisement updated successfully")
      onSuccess?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update advertisement")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Edit Advertisement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Restaurant</label>
            <input
              type="text"
              value={ad?.restaurantName || ""}
              disabled
              className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-slate-100 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Advertisement title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Short description"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ads Type</label>
              <select
                value={formData.adsType}
                onChange={(e) => setFormData((prev) => ({ ...prev, adsType: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {ADS_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData((prev) => ({ ...prev, priority: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="1">1 (High)</option>
                <option value="2">2 (Normal)</option>
                <option value="3">3 (Low)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date (Validity)</label>
              <input
                type="date"
                value={formData.validity.split(" to ")[0] || ""}
                onChange={(e) => {
                  const start = e.target.value;
                  const end = formData.validity.split(" to ")[1] || "";
                  setFormData((prev) => ({ ...prev, validity: end ? `${start} to ${end}` : start }));
                }}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={formData.validity.split(" to ")[1] || ""}
                min={formData.validity.split(" to ")[0] || ""}
                onChange={(e) => {
                  const end = e.target.value;
                  const start = formData.validity.split(" to ")[0] || "";
                  if (start || !end) {
                     setFormData((prev) => ({ ...prev, validity: end ? `${start} to ${end}` : start }));
                  } else {
                     toast.error("Please select a start date first");
                  }
                }}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {formData.adsType === "Video Promotion" ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Video</label>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty to keep existing video</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Leave empty to keep existing image</p>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 h-11 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
