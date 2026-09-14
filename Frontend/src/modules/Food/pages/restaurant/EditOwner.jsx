import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import {
  ArrowLeft,
  User,
  Edit,
  Trash2,
} from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { restaurantAPI } from "@food/api"
import OptimizedImage from "@food/components/OptimizedImage"
import { clearModuleAuth } from "@food/utils/auth"
import { firebaseAuth, ensureFirebaseInitialized } from "@food/firebase"

import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const STORAGE_KEY = "restaurant_owner_contact"

export default function EditOwner() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [ownerData, setOwnerData] = useState({
    name: "",
    phone: "",
    email: "",
    photo: null
  })
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    photo: null
  })
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState(null)
  const fileInputRef = useRef(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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

  // Fetch restaurant data from backend on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoading(true)
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          const ownerDataFromBackend = {
            name: data.ownerName || data.name || "",
            phone: data.ownerPhone || data.primaryContactNumber || data.phone || "",
            email: data.ownerEmail || data.email || "",
            photo: data.profileImage?.url || null
          }
          setOwnerData(ownerDataFromBackend)
          setFormData(ownerDataFromBackend)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          debugError("Error fetching restaurant data:", error)
        }
        // Fallback to localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved)
            setOwnerData(parsed)
            setFormData(parsed)
          }
        } catch (e) {
          debugError("Error loading owner data from localStorage:", e)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchRestaurantData()
  }, [])

  // Check for changes
  useEffect(() => {
    const changed = 
      formData.name !== ownerData.name ||
      formData.email !== ownerData.email ||
      profileImageFile !== null
    setHasChanges(changed)
  }, [formData.name, formData.email, ownerData.name, ownerData.email, profileImageFile])

  const handleInputChange = (field, value) => {
    let sanitizedValue = value
    if (field === 'name') {
      // Allow only letters and spaces
      sanitizedValue = value.replace(/[^A-Za-z\s]/g, '')
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }))
  }

  const handlePhotoClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handlePhotoSelect = (file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Max 5MB allowed.")
        return
      }
      setProfileImageFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const photoData = e.target?.result
        setFormData(prev => ({
          ...prev,
          photo: photoData
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    handlePhotoSelect(file)
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      // Validate inputs
      const nameRegex = /^[A-Za-z\s]+$/
      if (!nameRegex.test(formData.name.trim())) {
        toast.error("Name should only contain letters and spaces")
        setSaving(false)
        return
      }

      // Email validation (stricter regex)
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,5}$/
      const emailToValidate = formData.email ? String(formData.email).trim() : ""
      
      if (emailToValidate && !emailRegex.test(emailToValidate)) {
        toast.error("Invalid email format (e.g. name@gmail.com)")
        setSaving(false)
        return
      }

      // First, upload profile image if changed
      let uploadedPhotoUrl = null
      if (profileImageFile) {
        try {
          const imageResponse = await restaurantAPI.uploadProfileImage(profileImageFile)
          const imageData = imageResponse?.data?.data?.image || imageResponse?.data?.image
          if (imageData?.url) {
            uploadedPhotoUrl = imageData.url
          }
        } catch (error) {
          debugError("Error uploading profile image:", error)
          toast.error("Failed to upload profile image. Please try again.")
          setSaving(false)
          return
        }
      }

      // Update owner details in backend
      const updatePayload = {
        ownerName: formData.name.trim(),
        ownerEmail: formData.email.trim(),
        ownerPhone: formData.phone.trim(),
      }

      // If profile image was uploaded, include it
      if (profileImageFile && uploadedPhotoUrl) {
        // Extract publicId from the uploaded image response if available
        // For now, we'll let the backend handle it via the profileImage field
        // The uploadProfileImage already updates it, so we might not need to send it again
      }

      const response = await restaurantAPI.updateProfile(updatePayload)
      
      if (response?.data?.success) {
        // Merge uploaded photo URL into the saved snapshot
        const savedFormData = uploadedPhotoUrl
          ? { ...formData, photo: uploadedPhotoUrl }
          : { ...formData }
        // Save to localStorage as backup
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFormData))
        } catch (e) {
          debugError("Error saving to localStorage:", e)
        }
        
        // Dispatch event to notify parent page
        window.dispatchEvent(new Event("ownerDataUpdated"))
        
        // Update local state
        setOwnerData(savedFormData)
        setProfileImageFile(null)
        setHasChanges(false)
        
        // Navigate back
        goBack()
      } else {
        throw new Error("Invalid response from server")
      }
    } catch (error) {
      debugError("Error saving owner data:", error)
      alert(`Failed to save owner details: ${error.response?.data?.message || error.message || "Please try again."}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (isDeleting) return // Prevent multiple clicks
    
    setIsDeleting(true)
    
    try {
      // Call backend API to delete the account
      await restaurantAPI.deleteAccount()
      
      // Sign out from Firebase if restaurant logged in via Google
      try {
        const { signOut } = await import("firebase/auth")
        // Firebase Auth is lazy-initialized now; ensure it before accessing firebaseAuth.currentUser
        ensureFirebaseInitialized({ enableAuth: true, enableRealtimeDb: false })
        const currentUser = firebaseAuth.currentUser
        if (currentUser) {
          await signOut(firebaseAuth)
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        debugWarn("Firebase logout failed, continuing with cleanup:", firebaseError)
      }

      // Clear restaurant module authentication data
      clearModuleAuth("restaurant")
      
      // Clear all restaurant-related localStorage data
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem("restaurant_onboarding")
      localStorage.removeItem("restaurant_accessToken")
      localStorage.removeItem("restaurant_authenticated")
      localStorage.removeItem("restaurant_user")
      localStorage.removeItem("restaurant_invited_users")
      
      // Clear sessionStorage
      sessionStorage.removeItem("restaurantAuthData")
      
      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"))
      
      setShowDeleteDialog(false)
      
      // Navigate to welcome page
      setTimeout(() => {
        navigate("/restaurant/welcome", { replace: true })
      }, 300)
    } catch (error) {
      debugError("Error deleting account:", error)
      alert(`Failed to delete account: ${error.response?.data?.message || error.message || "Please try again."}`)
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-white overflow-x-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Contact details</h1>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-6 space-y-6">
          {/* Profile Photo Section */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {loading ? (
                  <User className="w-12 h-12 text-gray-500" />
                ) : formData.photo ? (
                  <OptimizedImage
                    src={formData.photo}
                    alt="Owner profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-500" />
                )}
              </div>
            </div>
            <button
              onClick={handlePhotoClick}
              disabled={loading || saving}
              className="text-blue-600 text-sm font-normal hover:text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Edit photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
              disabled={loading || saving}
            />
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Name</label>
              <div className="relative">
                <Input
                  type="text"
                  value={loading ? "Loading..." : formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter name"
                  className="w-full pr-10"
                  disabled={loading || saving}
                />
                <Edit className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
              </div>
            </div>

            {/* Phone Number Field */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Phone number</label>
              <Input
                type="tel"
                value={loading ? "Loading..." : formData.phone}
                placeholder="Enter phone number"
                className="w-full focus-visible:border-black focus-visible:ring-0"
                readOnly
                disabled={loading || saving}
              />
            </div>

            {/* Email Field */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Email</label>
              <div className="relative">
                <Input
                  type="email"
                  value={loading ? "Loading..." : formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter email address"
                  className="w-full pr-10 focus-visible:border-black focus-visible:ring-0"
                  disabled={loading || saving}
                />
                <Edit className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Delete Account Section */}
          <div className="pt-4">
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-sm font-normal">Delete your Appzeto account</span>
            </button>
          </div>
        </div>

        {/* Delete Account Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md p-4 w-[90%]">
            <DialogHeader className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <span className="text-2xl leading-none text-red-600">!</span>
              </div>
              <DialogTitle className="text-base font-semibold text-gray-900 text-center">
                You are about to delete your Appzeto account
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-gray-600 text-center">
                All information associated with your account will be deleted, and you will lose access to your restaurant permanently.
                This information cannot be recovered once the account is deleted. Are you sure you want to proceed?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col gap-2 sm:flex-col">
              <Button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Confirm"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save Button - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 z-40">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || loading || saving}
            className={`w-full py-3 ${
              hasChanges && !loading && !saving
                ? "bg-black hover:bg-gray-900 text-white" 
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            } transition-colors`}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handlePhotoSelect}
        title="Update owner photo"
        description="Choose how to upload your owner profile photo"
        fileNamePrefix="owner-photo"
        galleryInputRef={fileInputRef}
      />
    </>
  )
}

