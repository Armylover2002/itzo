import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Edit,
  Pencil,
  Plus,
  MapPin,
  Clock,
  Star,
  ChevronRight,
  X,
  Trash2,
  AlertCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

const PRIMARY_CONTACT_DUPLICATE_MSG = "This contact number is already registered with another restaurant."
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable, convertBase64ToFile } from "@food/utils/imageUploadUtils"
import { Switch } from "@food/components/ui/switch"
import { useLiveLocation } from "@food/contexts/LiveLocationContext"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const CUISINES_STORAGE_KEY = "restaurant_cuisines"

export default function OutletInfo() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const { liveTrackingEnabled, currentLocation, lastLocationUpdate, handleToggleTracking } = useLiveLocation()

  // State management
  const [restaurantData, setRestaurantData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [restaurantName, setRestaurantName] = useState("")
  const [isPureVeg, setIsPureVeg] = useState(false)
  const [cuisineTags, setCuisineTags] = useState("")
  const [address, setAddress] = useState("")
  const [primaryPhone, setPrimaryPhone] = useState("")
  const [ownerInfo, setOwnerInfo] = useState({ name: "", phone: "", email: "" })
  const [legalInfo, setLegalInfo] = useState({ fssai: "", gst: "", pan: "" })
  const [bankInfo, setBankInfo] = useState({ account: "", type: "", holder: "", ifsc: "" })
  const [mainImage, setMainImage] = useState("")
  const [thumbnailImage, setThumbnailImage] = useState("")
  const [coverImages, setCoverImages] = useState([])
  const [showEditNameDialog, setShowEditNameDialog] = useState(false)
  const [editNameValue, setEditNameValue] = useState("")
  const [showEditFoodTypeDialog, setShowEditFoodTypeDialog] = useState(false)
  const [editFoodTypeValue, setEditFoodTypeValue] = useState(false)
  const [showEditPhoneDialog, setShowEditPhoneDialog] = useState(false)
  const [editPhoneValue, setEditPhoneValue] = useState("")
  const [editPhoneError, setEditPhoneError] = useState("")
  const [restaurantId, setRestaurantId] = useState("")
  const [restaurantMongoId, setRestaurantMongoId] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageType, setImageType] = useState(null)
  const [uploadingCount, setUploadingCount] = useState(0)
  const [showExpiryAlert, setShowExpiryAlert] = useState(false)
  const [daysToExpiry, setDaysToExpiry] = useState(null)
  
  const profileImageInputRef = useRef(null)
  const menuImageInputRef = useRef(null)
  const [activePicker, setActivePicker] = useState(null) // { type: 'profile' | 'cover', ref: any, title: string, multiple: boolean }

  // Format address from location object
  const formatAddress = (location) => {
    if (!location) return ""
    
    // Priority 1: Full formatted address
    if (location.formattedAddress && location.formattedAddress.trim() !== "" && location.formattedAddress !== "Select location") {
      return location.formattedAddress.trim()
    }

    if (location.address && location.address.trim() !== "") {
      return location.address.trim()
    }

    // Priority 2: Structured address parts
    const parts = []
    if (location.addressLine1) parts.push(location.addressLine1.trim())
    if (location.addressLine2) parts.push(location.addressLine2.trim())
    if (location.area) parts.push(location.area.trim())
    if (location.landmark) parts.push(location.landmark.trim())
    if (location.city) {
      const city = location.city.trim()
      if (!parts.some(p => p.includes(city))) {
        parts.push(city)
      }
    }
    if (location.state) {
      const state = location.state.trim()
      if (!parts.some(p => p.includes(state))) {
        parts.push(state)
      }
    }
    if (location.pincode || location.zipCode) {
      parts.push(String(location.pincode || location.zipCode).trim())
    }
    
    return parts.join(", ") || ""
  }

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          
          const pending = data.pendingProfileChanges?.proposed || {}

          // Set restaurant name
          setRestaurantName((pending.restaurantName ?? data.restaurantName ?? data.name) || "")
          setIsPureVeg(pending.pureVegRestaurant ?? data.pureVegRestaurant ?? false)
          
          // Set restaurant ID
          setRestaurantId(data.restaurantId || data.id || "")
          const mongoId = String(data.id || data._id || "")
          setRestaurantMongoId(mongoId)
          
          // Format and set address
          const locToUse = pending.location || data.location || data
          const formattedAddress = formatAddress(locToUse)
          setAddress(formattedAddress)
          setPrimaryPhone((pending.primaryContactNumber ?? data.primaryContactNumber ?? pending.ownerPhone ?? data.ownerPhone) || "")
          
          // Set Owner Info
          setOwnerInfo({
            name: (pending.ownerName ?? data.ownerName) || "",
            phone: (pending.ownerPhone ?? data.ownerPhone) || "",
            email: (pending.ownerEmail ?? data.ownerEmail) || ""
          })

          // Set Legal Info
          setLegalInfo({
            fssai: (pending.fssaiNumber ?? data.fssaiNumber) || "",
            gst: (pending.gstNumber ?? data.gstNumber) || "",
            pan: (pending.panNumber ?? data.panNumber) || ""
          })

          // Set Bank Info
          setBankInfo({
            account: (pending.accountNumber ?? data.accountNumber) || "",
            type: (pending.accountType ?? data.accountType) || "",
            holder: (pending.accountHolderName ?? data.accountHolderName) || "",
            ifsc: (pending.ifscCode ?? data.ifscCode) || ""
          })
          
          // Format cuisines
          if (data.cuisines && Array.isArray(data.cuisines)) {
            setCuisineTags(data.cuisines.join(", "))
          }
          
          // Set images
          if (data.profileImage?.url) {
            setThumbnailImage(data.profileImage.url)
          } else if (typeof data.profileImage === 'string') {
            setThumbnailImage(data.profileImage)
          }

          if (data.coverImages && Array.isArray(data.coverImages) && data.coverImages.length > 0) {
            const formattedCovers = data.coverImages.map(img => typeof img === 'string' ? { url: img } : img)
            setCoverImages(formattedCovers)
            setMainImage(formattedCovers[0].url)
          } else if (data.menuImages && Array.isArray(data.menuImages) && data.menuImages.length > 0) {
            const formattedMenus = data.menuImages.map(img => typeof img === 'string' ? { url: img } : img)
            setCoverImages(formattedMenus)
            setMainImage(formattedMenus[0].url)
          } else {
            setCoverImages([])
          }
        }
      } catch (error) {
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error fetching restaurant data:", error)
        }
      } finally {
        if (restaurantData?.fssaiExpiry) {
          const expiry = new Date(restaurantData.fssaiExpiry)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const diffTime = expiry - today
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          setDaysToExpiry(diffDays)
          
          if (diffDays <= 4) {
            setShowExpiryAlert(true)
          }
        }
        setLoading(false)
      }
    }

    fetchRestaurantData()

    // Listen for updates from edit pages
    const handleCuisinesUpdate = () => {
      fetchRestaurantData()
    }
    const handleAddressUpdate = () => {
      fetchRestaurantData()
    }

    window.addEventListener("cuisinesUpdated", handleCuisinesUpdate)
    window.addEventListener("addressUpdated", handleAddressUpdate)
    
    return () => {
      window.removeEventListener("cuisinesUpdated", handleCuisinesUpdate)
      window.removeEventListener("addressUpdated", handleAddressUpdate)
    }
  }, [])

  // Handle profile image replacement
  const handleProfileImageReplace = async (file) => {
    if (!file) return

    try {
      setUploadingImage(true)
      setImageType('profile')

      // Upload image to Cloudinary
      const uploadResponse = await restaurantAPI.uploadProfileImage(file)
      const uploadedImage = uploadResponse?.data?.data?.profileImage

      if (uploadedImage) {
        if (uploadedImage.url) {
          setThumbnailImage(uploadedImage.url)
        }
        
        // Refresh restaurant data
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
          if (data.profileImage?.url) {
            setThumbnailImage(data.profileImage.url)
          }
        }
      }
    } catch (error) {
      debugError("Error uploading profile image:", error)
      toast.error("Failed to upload image. Please try again.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  // Handle multiple cover images addition
  const handleCoverImageAdd = async (files) => {
    if (!files || (Array.isArray(files) && files.length === 0)) return
    const fileArray = Array.isArray(files) ? files : [files]

    try {
      setUploadingImage(true)
      setImageType('menu')
      setUploadingCount(fileArray.length)

      // Get current images
      const currentResponse = await restaurantAPI.getCurrentRestaurant()
      const currentData = currentResponse?.data?.data?.restaurant || currentResponse?.data?.restaurant
      const existingImages = currentData?.menuImages && Array.isArray(currentData.menuImages)
        ? currentData.menuImages.map(img => ({
            url: img.url,
            publicId: img.publicId
          }))
        : []

      const uploadedImageData = []
      const failedUploads = []
      
      for (let i = 0; i < fileArray.length; i++) {
        try {
          const uploadResponse = await restaurantAPI.uploadMenuImage(fileArray[i])
          const uploadedImage = uploadResponse?.data?.data?.menuImage
          if (uploadedImage?.url) {
            uploadedImageData.push({
              url: uploadedImage.url,
              publicId: uploadedImage.publicId || null
            })
          }
        } catch (error) {
          failedUploads.push({ fileName: fileArray[i]?.name || "image", error: error.message })
        }
      }

      if (uploadedImageData.length > 0) {
        const allImages = [...existingImages]
        uploadedImageData.forEach(uploaded => {
          if (!allImages.find(img => img.url === uploaded.url)) {
            allImages.push(uploaded)
          }
        })

        try {
          await restaurantAPI.updateProfile({ menuImages: allImages })
          toast.success(`Successfully uploaded ${uploadedImageData.length} image(s)`)
        } catch (updateError) {
          toast.error("Images uploaded but failed to save.")
        }

        setCoverImages(allImages)
        if (allImages.length > 0) setMainImage(allImages[0].url)
      }
    } catch (error) {
      toast.error("Failed to upload images.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
      setUploadingCount(0)
    }
  }

  const handleImageClick = (type, ref, title, multiple = false) => {
    if (isFlutterBridgeAvailable()) {
      setActivePicker({ type, ref, title, multiple })
    } else {
      ref.current?.click()
    }
  }

  // Handle cover image deletion
  const handleCoverImageDelete = async (indexToDelete) => {
    if (!window.confirm("Are you sure you want to delete this cover image?")) return

    try {
      setUploadingImage(true)
      setImageType('menu')

      const updatedImages = coverImages.filter((_, index) => index !== indexToDelete)
      const menuImagesForBackend = updatedImages.map(img => ({
        url: img.url,
        publicId: img.publicId || null
      }))

      await restaurantAPI.updateProfile({ menuImages: menuImagesForBackend })
      setCoverImages(updatedImages)
      if (indexToDelete === 0 && updatedImages.length > 0) {
        setMainImage(updatedImages[0].url)
      } else if (updatedImages.length === 0) {
        setMainImage("https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&h=400&fit=crop")
      }
      toast.success("Image deleted successfully")
    } catch (error) {
      toast.error("Failed to delete image.")
    } finally {
      setUploadingImage(false)
      setImageType(null)
    }
  }

  // Handle edit name dialog
  const handleOpenEditDialog = () => {
    setEditNameValue(restaurantName)
    setShowEditNameDialog(true)
  }

  const handleSaveName = async () => {
    const newName = editNameValue.trim()
    if (!newName) return
    try {
      await restaurantAPI.updateProfile({ name: newName })
      setRestaurantName(newName)
      setShowEditNameDialog(false)
      toast.success("Name updated successfully")
    } catch (error) {
      toast.error("Failed to update name")
    }
  }

  // Handle edit food type dialog
  const handleOpenFoodTypeDialog = () => {
    setEditFoodTypeValue(isPureVeg)
    setShowEditFoodTypeDialog(true)
  }

  const handleSaveFoodType = async () => {
    try {
      await restaurantAPI.updateProfile({ pureVegRestaurant: editFoodTypeValue })
      setIsPureVeg(editFoodTypeValue)
      setShowEditFoodTypeDialog(false)
      toast.success("Food type updated successfully")
    } catch (error) {
      toast.error("Failed to update food type")
    }
  }

  // Handle edit phone dialog
  const handleOpenPhoneDialog = () => {
    setEditPhoneValue(primaryPhone)
    setEditPhoneError("")
    setShowEditPhoneDialog(true)
  }

  const handleSavePhone = async () => {
    const newPhone = editPhoneValue.trim()
    if (!newPhone) return
    
    // Basic validation: Check if 10 digits
    if (!/^\d{10}$/.test(newPhone)) {
      setEditPhoneError("Please enter a valid 10-digit phone number")
      toast.error("Please enter a valid 10-digit phone number")
      return
    }

    try {
      setEditPhoneError("")
      await restaurantAPI.updateProfile({ primaryContactNumber: newPhone })
      setPrimaryPhone(newPhone)
      setShowEditPhoneDialog(false)
      toast.success("Phone number updated successfully")
    } catch (error) {
      const message =
        error?.response?.data?.message === PRIMARY_CONTACT_DUPLICATE_MSG
          ? PRIMARY_CONTACT_DUPLICATE_MSG
          : error?.response?.data?.message || "Failed to update phone number"
      setEditPhoneError(message)
      toast.error(message)
    }
  }

  return (
    <>
      <div className="min-h-full overflow-x-hidden bg-white lg:bg-slate-50 lg:pb-10">
        {/* Header */}
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 lg:mx-auto lg:max-w-6xl lg:px-8 lg:py-5">
            <div className="flex flex-1 items-center gap-3">
              <button onClick={goBack} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 lg:hidden">
                <ArrowLeft className="h-6 w-6 text-gray-900" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900 lg:text-2xl">Outlet info</h1>
                <p className="hidden text-sm text-gray-500 lg:block">Manage your restaurant profile, contact, and compliance details</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-normal text-gray-900">
                Restaurant id: {loading ? "Loading..." : (restaurantMongoId && restaurantMongoId.length >= 5 ? restaurantMongoId.slice(-5) : (restaurantId || "N/A"))}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:mx-auto lg:max-w-6xl lg:px-8 lg:pt-6">
        {/* Main Image Section */}
        <div className="relative h-[200px] w-full overflow-visible lg:h-[280px] lg:overflow-hidden lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm">
          <img src={mainImage} alt="Restaurant banner" className="w-full h-full object-cover" />
          
          <button
            onClick={() => handleImageClick('cover', menuImageInputRef, "Add Cover Image", true)}
            disabled={uploadingImage}
            className="absolute bottom-4 right-4 bg-black/90 hover:bg-black px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-sm font-medium text-white transition-colors shadow-lg z-20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>{uploadingImage && imageType === 'menu' ? `Uploading ${uploadingCount}...` : 'Add image'}</span>
          </button>
          <input
            ref={menuImageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleCoverImageAdd(Array.from(e.target.files || []))}
          />
          
          {/* Cover Images Gallery */}
          {coverImages.length > 0 && (
            <div className="absolute bottom-16 right-4 flex gap-2.5 z-10">
              {coverImages.slice(0, 4).map((img, index) => (
                <div
                  key={index}
                  className={`relative w-14 h-14 rounded-xl border-2 overflow-hidden bg-gray-200 shadow-md transition-all ${
                    mainImage === img.url ? "border-black scale-105" : "border-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMainImage(img.url)}
                    className="w-full h-full"
                  >
                    <img src={img.url} alt={`Cover ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCoverImageDelete(index); }}
                    disabled={uploadingImage}
                    className="absolute top-1 right-1 bg-red-500/95 hover:bg-red-600 p-1 rounded-full transition-colors z-10"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {coverImages.length > 4 && (
                <div className="w-14 h-14 rounded-xl border-2 border-white bg-black/70 flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">+{coverImages.length - 4}</span>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Restaurant Header Info */}
        <div className="relative z-30 mb-8 px-4 -mt-12 lg:px-0 lg:-mt-14">
          <div className="flex items-end gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl border-4 border-white bg-white shadow-lg overflow-hidden">
                <img 
                  src={thumbnailImage} 
                  alt="Restaurant thumbnail" 
                  className="w-full h-full object-cover" 
                />
                {uploadingImage && imageType === 'profile' && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <button
                onClick={() => handleImageClick('profile', profileImageInputRef, "Update Profile Photo")}
                disabled={uploadingImage}
                className="absolute -bottom-1 -right-1 bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition-colors border border-gray-100"
                title="Edit photo"
              >
                <Pencil className="w-4 h-4 text-[#0D315B]" />
              </button>
              <input
                ref={profileImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleProfileImageReplace(e.target.files?.[0])}
              />
            </div>
            
            <div className="pb-6 flex-1 min-w-0">
              <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight truncate">
                {restaurantName || "Restaurant Name"}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1 w-8 bg-[#0D315B] rounded-full" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Information
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Sections */}
        <div className="space-y-8 px-4 pb-20 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:px-0 lg:pb-10">
          {/* Basic Information */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 ml-1">
               <div className="w-1 h-4 bg-gray-300 rounded-full" />
               <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Details</h3>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-1">Restaurant Name</p>
                  <p className="text-base font-bold text-gray-900">{restaurantName || "N/A"}</p>
                </div>
                <button onClick={handleOpenEditDialog} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>
              
              <div className="p-4 flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-1">Food Type</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 border-2 ${isPureVeg ? "border-green-600" : "border-amber-600"} flex items-center justify-center p-0.5`}>
                      <div className={`w-full h-full rounded-full ${isPureVeg ? "bg-green-600" : "bg-amber-600"}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{isPureVeg ? "Pure Veg" : "Mixed"}</span>
                  </div>
                </div>
                <button onClick={handleOpenFoodTypeDialog} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>
            </div>
          </section>

          {/* Location & Contact */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Location & Contact</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-400 font-medium">Outlet Address</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">{address || "Address not set"}</p>
                </div>
                <button onClick={() => navigate("/food/restaurant/edit-address")} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>

              <div className="p-4 flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-1">Primary Phone</p>
                  <p className="text-sm font-bold text-gray-800">{primaryPhone || "Not provided"}</p>
                </div>
                <button onClick={handleOpenPhoneDialog} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>
            </div>
          </section>

          {/* Owner Details */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Owner Details</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-1">Owner Name</p>
                  <p className="text-sm font-bold text-gray-800">{restaurantData?.ownerName || "Not provided"}</p>
                </div>
                <button onClick={() => navigate("/food/restaurant/edit-owner")} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>
              
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Owner Phone</p>
                <p className="text-sm font-semibold text-gray-800">{ownerInfo.phone || "N/A"}</p>
              </div>

              <div className="p-4">
                <p className="text-xs text-gray-400 font-medium mb-1">Owner Email</p>
                <p className="text-sm font-bold text-gray-800">{restaurantData?.ownerEmail || "Not provided"}</p>
              </div>
            </div>
          </section>

          {/* Legal & Compliance */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Legal & Compliance</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-1">FSSAI License</p>
                  <p className="text-sm font-bold text-gray-800">{restaurantData?.fssaiNumber || "Not provided"}</p>
                </div>
                <button onClick={() => navigate("/food/restaurant/fssai")} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100">
                  <p className="text-xs text-gray-400 font-medium mb-1">GST Number</p>
                  <p className="text-sm font-bold text-gray-800">{restaurantData?.gstNumber || "Not provided"}</p>
              </div>

              <div className="p-4">
                  <p className="text-xs text-gray-400 font-medium mb-1">PAN Number</p>
                  <p className="text-sm font-bold text-gray-800">{restaurantData?.panNumber || "Not provided"}</p>
              </div>
            </div>
          </section>

          {/* Operational Settings */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Operational</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs text-gray-400 font-medium">Outlet Timings</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {restaurantData?.openingTime && restaurantData?.closingTime 
                      ? `${restaurantData.openingTime} - ${restaurantData.closingTime}` 
                      : "Timings not set"}
                  </p>
                </div>
                <button onClick={() => navigate("/food/restaurant/outlet-timings")} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>

              <div className="p-4">
                <p className="text-xs text-gray-400 font-medium mb-1">Service Zone</p>
                <p className="text-sm font-semibold text-gray-800">{restaurantData?.zoneName || "Not assigned"}</p>
              </div>
            </div>
          </section>

          {restaurantData?.businessType === "Street Food Vendor" && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Current Operating Location</h3>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">Live Location</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {liveTrackingEnabled ? "Currently broadcasting your live position" : "Not broadcasting"}
                    </p>
                  </div>
                  <Switch checked={liveTrackingEnabled} onCheckedChange={handleToggleTracking} />
                </div>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2">
                  <p className="text-xs text-gray-500">Movable Location</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {currentLocation?.formattedAddress || currentLocation?.address || "Not set yet"}
                  </p>
                  {lastLocationUpdate && (
                    <p className="text-[11px] text-gray-400">
                      Updated {new Date(lastLocationUpdate).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </p>
                  )}
                  <button
                    onClick={() => navigate("/food/restaurant/move-location")}
                    className="w-full mt-1 rounded-lg border border-gray-200 py-2 text-xs font-bold text-gray-700 hover:bg-white transition-colors"
                  >
                    Move
                  </button>
                  <p className="text-[11px] text-gray-400">
                    You can move your location anywhere within {restaurantData?.zoneName || "your assigned zone"}.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Bank Account */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider ml-1">Bank Account</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm lg:shadow-md lg:border-slate-200">
              <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium mb-1">Account Number</p>
                  <p className="text-sm font-bold text-gray-800">{bankInfo.account || "Not provided"}</p>
                </div>
                <button onClick={() => navigate("/food/restaurant/update-bank-details")} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                  <Pencil className="w-4 h-4 text-[#0D315B]" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1">Account Holder Name</p>
                <p className="text-sm font-bold text-gray-800">{bankInfo.holder || "Not provided"}</p>
              </div>

              <div className="p-4">
                  <p className="text-xs text-gray-400 font-medium mb-1">IFSC Code</p>
                  <p className="text-sm font-bold text-gray-800">{bankInfo.ifsc || "Not provided"}</p>
              </div>
            </div>
          </section>
        </div>
        </div>
      </div>

      <Dialog open={showEditNameDialog} onOpenChange={setShowEditNameDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-xl w-[90%]">
          <DialogHeader className="p-4 border-b border-gray-100"><DialogTitle className="text-lg font-bold">Edit restaurant name</DialogTitle></DialogHeader>
          <div className="p-4"><Input value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} placeholder="Enter restaurant name" className="w-full" /></div>
          <DialogFooter className="p-4 bg-gray-50 flex flex-row gap-3">
            <Button variant="outline" onClick={() => setShowEditNameDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveName} disabled={!editNameValue.trim()} className="bg-[#0D315B] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditFoodTypeDialog} onOpenChange={setShowEditFoodTypeDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-xl w-[90%]">
          <DialogHeader className="p-4 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold">Edit food type</DialogTitle>
          </DialogHeader>
          <div className="p-4 flex flex-col gap-3">
            <div 
              onClick={() => setEditFoodTypeValue(true)}
              className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${editFoodTypeValue ? 'border-green-600 bg-green-50' : 'border-gray-200'}`}
            >
              <div className="w-4 h-4 border-2 border-green-600 flex items-center justify-center p-0.5">
                {editFoodTypeValue && <div className="w-full h-full rounded-full bg-green-600" />}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">Pure Veg</span>
                <span className="text-xs text-gray-500">Only vegetarian items on the menu</span>
              </div>
            </div>
            
            <div 
              onClick={() => setEditFoodTypeValue(false)}
              className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${!editFoodTypeValue ? 'border-amber-600 bg-amber-50' : 'border-gray-200'}`}
            >
              <div className="w-4 h-4 border-2 border-amber-600 flex items-center justify-center p-0.5">
                {!editFoodTypeValue && <div className="w-full h-full rounded-full bg-amber-600" />}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">Mixed</span>
                <span className="text-xs text-gray-500">Veg and non-veg items on the menu</span>
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 bg-gray-50 flex flex-row gap-3">
            <Button variant="outline" onClick={() => setShowEditFoodTypeDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveFoodType} className="bg-blue-600 text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditPhoneDialog} onOpenChange={setShowEditPhoneDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-xl w-[90%]">
          <DialogHeader className="p-4 border-b border-gray-100">
            <DialogTitle className="text-lg font-bold">Edit primary phone</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <Input 
              id="restaurant-field-primaryContactNumber"
              data-restaurant-field="primaryContactNumber"
              value={editPhoneValue} 
              onChange={(e) => {
                setEditPhoneError("")
                setEditPhoneValue(e.target.value.replace(/\D/g, '').slice(0, 10))
              }} 
              placeholder="Enter 10-digit phone number" 
              className={`w-full ${editPhoneError ? "border-red-500 ring-1 ring-red-300" : ""}`}
              type="tel"
              maxLength={10}
            />
            {editPhoneError && (
              <p className="mt-2 text-xs text-red-600">{editPhoneError}</p>
            )}
          </div>
          <DialogFooter className="p-4 bg-gray-50 flex flex-row gap-3">
            <Button variant="outline" onClick={() => setShowEditPhoneDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSavePhone} 
              disabled={!editPhoneValue.trim() || editPhoneValue.length !== 10} 
              className="bg-blue-600 text-white"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageSourcePicker
        isOpen={!!activePicker}
        onClose={() => setActivePicker(null)}
        onFileSelect={(file) => {
          if (activePicker?.type === 'profile') {
            handleProfileImageReplace(file)
          } else {
            handleCoverImageAdd(file)
          }
        }}
        title={activePicker?.title}
        description={`Choose how to upload your ${activePicker?.type} photo`}
        fileNamePrefix={`outlet-${activePicker?.type}`}
        galleryInputRef={activePicker?.ref}
      />

      {/* FSSAI Expiry Alert Modal */}
      <Dialog open={showExpiryAlert} onOpenChange={setShowExpiryAlert}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-[#fff4f4] p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 mb-2">
              FSSAI License Expiring
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 px-4">
              {daysToExpiry <= 0 
                ? "Your FSSAI license has expired. Please update it immediately to continue your business operations."
                : `Your FSSAI license is expiring in ${daysToExpiry} days. Please update it now to avoid any interruption in service.`}
            </DialogDescription>
          </div>
          <DialogFooter className="p-4 bg-white flex flex-col gap-2 sm:flex-col">
            <Button 
              className="w-full bg-black hover:bg-gray-800 text-white rounded-full py-6 text-base font-semibold"
              onClick={() => {
                setShowExpiryAlert(false)
                navigate("/food/restaurant/fssai/update")
              }}
            >
              Update License Now
            </Button>
            <Button 
              variant="ghost"
              className="w-full text-gray-500 rounded-full hover:bg-gray-100"
              onClick={() => setShowExpiryAlert(false)}
            >
              Remind me later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
