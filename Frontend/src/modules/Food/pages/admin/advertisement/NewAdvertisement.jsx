import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Megaphone, Plus } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"

const ADS_TYPES = [
  "Restaurant Promotion",
  "Video Promotion",
  "Image Promotion",
  "Banner Promotion",
]

export default function NewAdvertisement() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState([])
  const [loadingRestaurants, setLoadingRestaurants] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    restaurantId: "",
    title: "",
    description: "",
    adsType: "Restaurant Promotion",
    validity: "",
    priority: "2",
  })
  const [imageFile, setImageFile] = useState(null)
  const [videoFile, setVideoFile] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoadingRestaurants(true)
        const response = await adminAPI.getRestaurants({ limit: 1000, status: "approved" })
        const data = response?.data?.data
        const raw = Array.isArray(data) ? data : (data?.restaurants || [])
        if (!cancelled) {
          setRestaurants(
            raw
              .filter((r) => String(r.status || "").toLowerCase() === "approved")
              .map((r) => ({
                _id: r._id,
                name: r.name || r.restaurantName || String(r._id),
              }))
          )
        }
      } catch (err) {
        if (!cancelled) {
          setRestaurants([])
          toast.error(err?.response?.data?.message || "Failed to load restaurants")
        }
      } finally {
        if (!cancelled) setLoadingRestaurants(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.restaurantId) {
      toast.error("Select a restaurant")
      return
    }
    if (!formData.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!formData.validity.trim()) {
      toast.error("Validity is required")
      return
    }
    if (formData.adsType === "Video Promotion" && !videoFile) {
      toast.error("Video file is required")
      return
    }
    if (
      ["Image Promotion", "Banner Promotion", "Restaurant Promotion"].includes(formData.adsType) &&
      !imageFile
    ) {
      toast.error("Image file is required")
      return
    }

    try {
      setSubmitting(true)
      const payload = new FormData()
      payload.append("restaurantId", formData.restaurantId)
      payload.append("title", formData.title.trim())
      payload.append("description", formData.description.trim())
      payload.append("adsType", formData.adsType)
      payload.append("category", formData.adsType)
      payload.append("validity", formData.validity.trim())
      payload.append("priority", formData.priority)
      payload.append("autoApprove", "true")
      if (imageFile) payload.append("image", imageFile)
      if (videoFile) payload.append("video", videoFile)

      await adminAPI.createAdvertisement(payload)
      toast.success("Advertisement created")
      navigate("/ecs/food/advertisement")
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create advertisement")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              type="button"
              onClick={() => navigate("/ecs/food/advertisement")}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">New Advertisement</h1>
              <p className="text-sm text-slate-500">Create and approve an advertisement for a restaurant</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Restaurant</label>
              <select
                value={formData.restaurantId}
                onChange={(e) => setFormData((prev) => ({ ...prev, restaurantId: e.target.value }))}
                disabled={loadingRestaurants}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">{loadingRestaurants ? "Loading restaurants..." : "Select restaurant"}</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant._id} value={restaurant._id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
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
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate("/ecs/food/advertisement")}
                className="flex-1 h-11 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-11 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {submitting ? "Creating..." : "Create Advertisement"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
