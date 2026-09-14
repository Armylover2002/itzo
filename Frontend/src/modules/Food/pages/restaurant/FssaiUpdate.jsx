import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft, Upload, Loader2, X } from "lucide-react"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { toast } from "sonner"
import { restaurantAPI } from "@food/api"
import { clearModuleAuth } from "@food/utils/auth"

export default function FssaiUpdate() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [fssaiNumber, setFssaiNumber] = useState("")
  const [fssaiExpiry, setFssaiExpiry] = useState("")
  const [originalExpiry, setOriginalExpiry] = useState("")
  const [uploadedFile, setUploadedFile] = useState(null)
  const [existingImageUrl, setExistingImageUrl] = useState("")
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const fetchCurrentData = async () => {
      try {
        setFetching(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setFssaiNumber(data.fssaiNumber || "")
          // Format date for input YYYY-MM-DD
          if (data.fssaiExpiry) {
            const date = new Date(data.fssaiExpiry)
            const formatted = date.toISOString().split('T')[0]
            setFssaiExpiry(formatted)
            setOriginalExpiry(formatted)
          }
          setExistingImageUrl(typeof data.fssaiImage === 'string' ? data.fssaiImage : data.fssaiImage?.url || "")
        }
      } catch (error) {
        console.error("Error fetching FSSAI data:", error)
      } finally {
        setFetching(false)
      }
    }
    fetchCurrentData()
  }, [])

  const handleFileSelect = (file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Max 5MB allowed.")
        return
      }
      setUploadedFile(file)
      toast.success("FSSAI license selected")
    }
  }

  const handleFileClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!fssaiNumber.trim()) {
      toast.error("FSSAI number is required")
      return
    }

    if (!/^\d{14}$/.test(fssaiNumber.trim())) {
      toast.error("FSSAI number must be exactly 14 digits")
      return
    }

    if (!fssaiExpiry) {
      toast.error("Expiry date is required")
      return
    }

    const expiryDate = new Date(fssaiExpiry)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (expiryDate < today) {
      toast.error("Expiry date must be in the future")
      return
    }

    if (!uploadedFile && !existingImageUrl) {
      toast.error("FSSAI license document is required")
      return
    }

    try {
      setLoading(true)
      let imageUrl = existingImageUrl

      // 1. Upload new image if selected
      if (uploadedFile) {
        const uploadRes = await restaurantAPI.uploadMenuImage(uploadedFile)
        imageUrl = uploadRes?.data?.data?.menuImage?.url || uploadRes?.data?.menuImage?.url || ""
      }

      // 2. Update profile
      const response = await restaurantAPI.updateProfile({
        fssaiNumber: fssaiNumber.trim(),
        fssaiExpiry: fssaiExpiry,
        fssaiImage: imageUrl
      })

      const result = response?.data?.data || response?.data
      console.log("Update response result:", result)

      if (result?.requireLogout || result?.restaurant?.requireLogout) {
        if (!result?.restaurant?.wasEverApproved && !result?.wasEverApproved) {
          toast.success("FSSAI details updated. Account sent for re-verification.")
          setTimeout(() => {
            clearModuleAuth("restaurant")
            window.location.href = "/food/restaurant/pending-verification"
          }, 2000)
          return
        }
      }

      toast.success(
        result?.pendingReviewSubmitted || result?.restaurant?.pendingReviewSubmitted
          ? "FSSAI update submitted for admin review. Customers still see your previous approved details until approved."
          : "FSSAI details updated and sent for admin review"
      )
      navigate("/food/restaurant/fssai")
    } catch (error) {
      console.error("Error updating FSSAI:", error)
      toast.error(error.response?.data?.message || "Failed to update FSSAI details")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-full bg-white lg:bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
        <p className="text-sm text-gray-500">Loading current details...</p>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-white lg:bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3 lg:max-w-2xl lg:mx-auto lg:px-8 lg:py-5 lg:w-full">
          <button
            onClick={() => navigate("/food/restaurant/fssai")}
            className="p-2 rounded-full hover:bg-gray-100 lg:hidden"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 lg:text-2xl lg:font-bold">Update FSSAI</h1>
            <p className="hidden text-sm text-gray-500 lg:block">Upload or update your food license details</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} id="fssai-form" className="flex-1 px-4 pt-4 pb-28 lg:max-w-2xl lg:mx-auto lg:px-8 lg:py-6 lg:pb-4 lg:w-full space-y-4 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-white lg:p-8 lg:shadow-sm lg:mb-8">
        <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1 lg:text-sm">
            FSSAI registration number
          </label>
          <input
            type="text"
            value={fssaiNumber}
            onChange={(e) => setFssaiNumber(e.target.value.replace(/\D/g, '').slice(0, 14))}
            placeholder="14-digit registration number"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
          <p className="text-[10px] text-gray-500 mt-1">Exactly 14 digits required</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Valid up to
          </label>
          <input
            type="date"
            value={fssaiExpiry}
            min={(() => {
              const today = new Date().toISOString().split('T')[0];
              if (!originalExpiry) return today;
              return originalExpiry > today ? originalExpiry : today;
            })()}
            onChange={(e) => setFssaiExpiry(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="block text-xs font-medium text-gray-700 lg:text-sm">
            Upload your FSSAI license
          </label>
          <div 
            onClick={handleFileClick}
            className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-100 transition-colors"
          >
            {uploadedFile ? (
              <div className="space-y-2">
                <div className="text-2xl">✅</div>
                <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                <p className="text-xs text-gray-500">Click to change</p>
              </div>
            ) : existingImageUrl ? (
              <div className="space-y-2">
                <img src={existingImageUrl} alt="Current FSSAI" className="h-20 w-auto mx-auto object-contain rounded-lg border" />
                <p className="text-xs text-gray-500">Current license document</p>
                <p className="text-[10px] text-blue-600 font-medium">Click to upload new</p>
              </div>
            ) : (
              <>
                <div className="mb-2 text-2xl">⬆️</div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Upload your FSSAI license
                </p>
                <p className="text-xs text-gray-500">
                  jpeg, png, or pdf (up to 5MB)
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              accept="image/*,application/pdf"
            />
          </div>

        </div>
        </div>
      </form>

      {/* Bottom button */}
      <div className="px-4 pb-6 pt-2 border-t border-gray-200 bg-white lg:max-w-2xl lg:mx-auto lg:px-8 lg:w-full lg:border-t-0 lg:bg-transparent lg:pb-8">
        <button
          type="submit"
          form="fssai-form"
          className={`w-full py-3 rounded-full text-sm font-medium transition-colors flex items-center justify-center gap-2 lg:rounded-xl lg:py-3.5 ${
            fssaiNumber 
              ? "bg-black text-white hover:bg-gray-900" 
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
          disabled={!fssaiNumber || loading}
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Updating..." : "Confirm"}
        </button>
      </div>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleFileSelect}
        title="Upload FSSAI License"
        description="Choose how to upload your FSSAI license"
        fileNamePrefix="fssai-license"
        galleryInputRef={fileInputRef}
      />
    </div>
  )
}
