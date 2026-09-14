import { useState, useEffect, useRef, useMemo } from "react"
import { motion } from "framer-motion"
import { useNavigate, useParams } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import useKeyboardInset from "@food/hooks/useKeyboardInset"
import { 
  ArrowLeft,
  ChevronDown,
  Calendar,
  Upload,
  X
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"

const todayISO = () => {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const parseValidity = (ad) => {
  const raw = String(ad?.validity || "").trim()
  if (raw && raw.includes(" to ")) {
    const [start, end] = raw.split(" to ").map((x) => x.trim())
    return { startDate: start || "", endDate: end || "" }
  }
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { startDate: raw, endDate: raw }
  }
  const durationStart = ad?.duration?.start
  const durationEnd = ad?.duration?.end
  const isoStart = /^\d{4}-\d{2}-\d{2}$/.test(String(durationStart || "")) ? String(durationStart) : ""
  const isoEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(durationEnd || "")) ? String(durationEnd) : ""
  return { startDate: isoStart, endDate: isoEnd }
}

export default function EditAdvertisementPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const keyboardInset = useKeyboardInset()
  const { id } = useParams()
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showStartDatePicker, setShowStartDatePicker] = useState(false)
  const [showEndDatePicker, setShowEndDatePicker] = useState(false)
  const [adData, setAdData] = useState(null)
  const [formData, setFormData] = useState({
    category: "",
    startDate: "",
    endDate: "",
    title: "",
    description: "",
    fileDescription: "",
    videoDescription: ""
  })
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadedVideo, setUploadedVideo] = useState(null)
  const categoryRef = useRef(null)
  const startDateRef = useRef(null)
  const endDateRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Load ad data on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!id) return
      try {
        setLoading(true)
        const response = await restaurantAPI.getAdvertisement(id)
        const data = response?.data?.data
        if (cancelled) return
        if (!data) {
          setAdData(null)
          return
        }
        setAdData(data)
        const parsedDates = parseValidity(data)
        setFormData({
          category: data.adsType || data.type || data.category || "Image Promotion",
          startDate: parsedDates.startDate,
          endDate: parsedDates.endDate,
          title: data.title || "",
          description: data.description || "",
          fileDescription: data.fileDescription || "",
          videoDescription: data.videoDescription || ""
        })
      } catch (err) {
        if (!cancelled) {
          setAdData(null)
          toast.error(err?.response?.data?.message || "Failed to load advertisement")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setShowCategoryDropdown(false)
      }
      if (startDateRef.current && !startDateRef.current.contains(event.target)) {
        setShowStartDatePicker(false)
      }
      if (endDateRef.current && !endDateRef.current.contains(event.target)) {
        setShowEndDatePicker(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const categories = [
    "Video Promotion",
    "Restaurant Promotion",
    "Image Promotion",
    "Banner Promotion"
  ]

  const isVideoPromotion = formData.category === "Video Promotion"
  const requiresImage = ["Image Promotion", "Banner Promotion", "Restaurant Promotion"].includes(formData.category)
  const minStartDate = todayISO()
  const hasExistingImage = Boolean(adData?.imageUrl)
  const hasExistingVideo = Boolean(adData?.videoUrl)

  const imagePreviewUrl = useMemo(() => {
    if (!uploadedFile) return null
    return URL.createObjectURL(uploadedFile)
  }, [uploadedFile])

  const videoPreviewUrl = useMemo(() => {
    if (!uploadedVideo) return null
    return URL.createObjectURL(uploadedVideo)
  }, [uploadedVideo])

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    }
  }, [imagePreviewUrl])

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  const handleFileSelect = (file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Max 5MB allowed.")
        return
      }
      setUploadedFile(file)
      setFormData(prev => ({
        ...prev,
        fileDescription: prev.fileDescription?.trim() ? prev.fileDescription : file.name
      }))
    }
  }

  const handleFileClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0]
    if (!file) return
    if (type === "file") {
      handleFileSelect(file)
    } else if (type === "video") {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Video size too large. Max 5MB allowed.")
        return
      }
      setUploadedVideo(file)
      setFormData(prev => ({
        ...prev,
        videoDescription: prev.videoDescription?.trim() ? prev.videoDescription : file.name
      }))
    }
    e.target.value = ""
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const getCharacterCount = (text, maxLength = 100) => {
    return `${text.length}/${maxLength}`
  }

  const handleUpdate = async () => {
    if (!id) return
    if (!formData.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!formData.description.trim()) {
      toast.error("Description is required")
      return
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error("Start Date and End Date are required")
      return
    }
    if (formData.startDate < minStartDate) {
      toast.error("Start date cannot be in the past")
      return
    }
    if (formData.endDate < formData.startDate) {
      toast.error("End date must be on or after start date")
      return
    }
    if (isVideoPromotion && !uploadedVideo && !hasExistingVideo) {
      toast.error("Please upload a video for Video Promotion")
      return
    }
    if (requiresImage && !uploadedFile && !hasExistingImage) {
      toast.error("Please upload an image for this advertisement type")
      return
    }

    try {
      setSubmitting(true)
      const payload = new FormData()
      payload.append("title", formData.title.trim())
      payload.append("description", formData.description.trim())
      payload.append("adsType", formData.category)
      payload.append("category", formData.category)
      payload.append("validity", `${formData.startDate} to ${formData.endDate}`)
      payload.append("fileDescription", formData.fileDescription || "")
      payload.append("videoDescription", formData.videoDescription || "")
      if (uploadedFile) payload.append("image", uploadedFile)
      if (uploadedVideo) payload.append("video", uploadedVideo)

      await restaurantAPI.updateAdvertisement(id, payload)
      toast.success("Advertisement updated and pending approval")
      navigate("/food/restaurant/advertisements")
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update advertisement")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading advertisement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden pb-40 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Edit Advertisement</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {!adData && (
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-6 text-center">
              <p className="text-gray-900 font-semibold">Advertisement unavailable</p>
              <p className="text-sm text-gray-600 mt-2">
                This advertisement can&apos;t be edited because no real data was loaded.
              </p>
            </CardContent>
          </Card>
        )}
        {/* Category Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-base font-bold text-gray-900">Category Info</h2>

              {/* Category Dropdown */}
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{formData.category}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showCategoryDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                  >
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => {
                          handleInputChange("category", category)
                          setShowCategoryDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {category}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative" ref={startDateRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <button
                    onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className={`text-sm ${formData.startDate ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.startDate || "Select start"}
                    </span>
                    <Calendar className="w-5 h-5 text-[#FF0000]" />
                  </button>
                  {showStartDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4"
                    >
                      <input
                        type="date"
                        value={formData.startDate}
                        min={minStartDate}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value && value < minStartDate) {
                            toast.error("Start date cannot be in the past")
                            return
                          }
                          handleInputChange("startDate", value)
                          if (formData.endDate && value && formData.endDate < value) {
                            handleInputChange("endDate", "")
                          }
                          setShowStartDatePicker(false)
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                      />
                    </motion.div>
                  )}
                </div>

                <div className="relative" ref={endDateRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <button
                    onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <span className={`text-sm ${formData.endDate ? 'text-gray-900' : 'text-gray-400'}`}>
                      {formData.endDate || "Select end"}
                    </span>
                    <Calendar className="w-5 h-5 text-[#FF0000]" />
                  </button>
                  {showEndDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4"
                    >
                      <input
                        type="date"
                        value={formData.endDate}
                        min={formData.startDate || minStartDate}
                        onChange={(e) => {
                          if (!formData.startDate) {
                            toast.error("Please select a start date first")
                            return
                          }
                          handleInputChange("endDate", e.target.value)
                          setShowEndDatePicker(false)
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000]"
                      />
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title (English) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Enter title"
                  className="w-full"
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (English) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter description"
                    maxLength={100}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000] resize-none"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {getCharacterCount(formData.description)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {requiresImage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-base font-bold text-gray-900">
                Upload Files <span className="text-red-500">*</span>
              </h2>

              {/* File Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div 
                  onClick={handleFileClick}
                  className="block cursor-pointer"
                >
                  {uploadedFile && imagePreviewUrl ? (
                    <div className="space-y-3">
                      <div className="relative mx-auto max-w-xs">
                        <img
                          src={imagePreviewUrl}
                          alt="Ad preview"
                          className="w-full max-h-56 object-contain rounded-lg border border-gray-200 bg-gray-50"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setUploadedFile(null)
                          }}
                          className="absolute -top-2 -right-2 p-1 rounded-full bg-white border border-gray-200 shadow"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                      <p className="text-sm text-center text-gray-700">{uploadedFile.name}</p>
                    </div>
                  ) : adData?.imageUrl ? (
                    <div className="text-center space-y-2">
                      <img
                        src={adData.imageUrl}
                        alt="Current ad"
                        className="w-full max-h-56 object-contain rounded-lg border border-gray-200 bg-gray-50"
                      />
                      <p className="text-xs text-gray-500">Current image</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Click to upload file</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, "file")}
                    accept="image/*"
                  />
                </div>

                {/* File Description */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (English) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.fileDescription}
                      onChange={(e) => handleInputChange("fileDescription", e.target.value)}
                      placeholder="Enter description"
                      maxLength={100}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF0000] resize-none"
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {getCharacterCount(formData.fileDescription)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {isVideoPromotion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="bg-white shadow-sm border border-gray-100">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-base font-bold text-gray-900">
                Upload Files <span className="text-red-500">*</span>
              </h2>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    ref={videoInputRef}
                    type="file"
                    id="video-upload"
                    onChange={(e) => handleFileUpload(e, "video")}
                    className="hidden"
                    accept="video/mp4,video/webm,video/x-matroska"
                  />
                  <label
                    htmlFor="video-upload"
                    className="block cursor-pointer text-center"
                  >
                    {uploadedVideo && videoPreviewUrl ? (
                      <div className="space-y-3">
                        <video
                          src={videoPreviewUrl}
                          controls
                          className="w-full max-h-64 rounded-lg border border-gray-200 bg-black"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm text-gray-700">{uploadedVideo.name}</p>
                            <p className="text-xs text-gray-500">{(uploadedVideo.size / (1024 * 1024)).toFixed(2)} MB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setUploadedVideo(null)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : adData?.videoUrl ? (
                      <div>
                        <video src={adData.videoUrl} controls className="w-full rounded-lg max-h-64 bg-black mb-2" />
                        <p className="text-xs text-gray-500">Current video</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-700 mb-1">Click to Upload Ads Video</p>
                        <p className="text-xs text-gray-500 mb-1">Maximum 5 MB</p>
                        <p className="text-xs text-gray-500">Supports: MP4, WEBM, MKV</p>
                      </>
                    )}
                  </label>
                </div>
            </CardContent>
          </Card>
        </motion.div>
        )}
      </div>

      {/* Bottom Buttons */}
      {keyboardInset === 0 && (
      <div className="fixed bottom-[88px] left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-50 md:relative md:bottom-0 md:border-t-0 md:px-4 md:py-4 md:mt-6">
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setFormData({
                category: "",
                startDate: "",
                endDate: "",
                title: "",
                description: "",
                fileDescription: "",
                videoDescription: ""
              })
              setUploadedFile(null)
              setUploadedVideo(null)
            }}
            disabled={!adData}
            variant="outline"
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg border-0"
          >
            Reset
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={!adData || submitting}
            className="flex-1 bg-[#FF0000] hover:bg-[#E60000] text-white font-semibold py-3 rounded-lg disabled:opacity-60"
          >
            {submitting ? "Updating..." : "Update Ads"}
          </Button>
        </div>
      </div>
      )}

      <div className="lg:hidden">
        <BottomNavOrders />
      </div>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleFileSelect}
        title="Upload Ad Image"
        description="Choose how to upload your advertisement image"
        fileNamePrefix="ad-photo"
        galleryInputRef={fileInputRef}
      />
    </div>
  )
}


