import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { 
  ArrowLeft,
  ChevronDown,
  Calendar,
  Upload,
  Megaphone
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function NewAdvertisementPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showValidityPicker, setShowValidityPicker] = useState(false)
  const [formData, setFormData] = useState({
    category: "Video Promotion",
    validity: "",
    title: "",
    description: "",
    fileDescription: "",
    videoDescription: ""
  })
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadedVideo, setUploadedVideo] = useState(null)
  const categoryRef = useRef(null)
  const validityRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setShowCategoryDropdown(false)
      }
      if (validityRef.current && !validityRef.current.contains(event.target)) {
        setShowValidityPicker(false)
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

  const handleFileSelect = (file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Max 5MB allowed.")
        return
      }
      setUploadedFile(file)
      // For preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          fileDescription: file.name
        }))
      }
      reader.readAsDataURL(file)
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
    if (type === "file") {
      handleFileSelect(file)
    } else if (type === "video") {
      setUploadedVideo(file)
    }
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

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-24 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">New Advertisement</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
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

              {/* Validity Field */}
              <div className="relative" ref={validityRef}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Validity <span className="text-red-500">*</span>
                </label>
                <button
                  onClick={() => setShowValidityPicker(!showValidityPicker)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className={`text-sm ${formData.validity ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formData.validity || "Select date"}
                  </span>
                  <Calendar className="w-5 h-5 text-[#ff8100]" />
                </button>
                {showValidityPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4"
                  >
                    <input
                      type="date"
                      value={formData.validity}
                      onChange={(e) => {
                        handleInputChange("validity", e.target.value)
                        setShowValidityPicker(false)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff8100]"
                    />
                  </motion.div>
                )}
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
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff8100] resize-none"
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {getCharacterCount(formData.description)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload Files Section - First */}
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
                  {uploadedFile ? (
                    <div className="text-center">
                      <p className="text-sm text-gray-700">{uploadedFile.name}</p>
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff8100] resize-none"
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

        {/* Upload Files Section - Video */}
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

              {/* Video Upload Area */}
              <div className="relative">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <input
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
                    {uploadedVideo ? (
                      <div>
                        <p className="text-sm text-gray-700 mb-2">{uploadedVideo.name}</p>
                        <p className="text-xs text-gray-500">{(uploadedVideo.size / (1024 * 1024)).toFixed(2)} MB</p>
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

                {/* Preview Button */}
                <div className="absolute top-4 right-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 bg-[#e7eaef] rounded-lg flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>
                  <button className="px-3 py-1 bg-[#ff8100] hover:bg-[#e67300] text-white text-xs font-medium rounded-lg transition-colors">
                    Preview
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-50 md:relative md:border-t-0 md:px-4 md:py-4 md:mt-6">
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setFormData({
                category: "Video Promotion",
                validity: "",
                title: "",
                description: "",
                fileDescription: "",
                videoDescription: ""
              })
              setUploadedFile(null)
              setUploadedVideo(null)
            }}
            variant="outline"
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg border-0"
          >
            Reset
          </Button>
          <Button
            onClick={() => {
              debugLog("Create ad:", formData)
              // Navigate to advertisements list after creation
              navigate("/restaurant/advertisements")
            }}
            className="flex-1 bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg"
          >
            Create Ads
          </Button>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <BottomNavbar />

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


