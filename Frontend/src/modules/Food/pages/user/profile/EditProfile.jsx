import { useState, useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, X, Pencil, Loader2, Camera, Upload } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Card, CardContent } from "@food/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@food/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { useProfile } from "@food/context/ProfileContext"
import { userAPI } from "@food/api"
import { toast } from "sonner"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import dayjs from 'dayjs'
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}
// Gender options
const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
]

// Load profile data from localStorage (legacy + current keys)
const loadProfileFromStorage = () => {
  try {
    const candidates = ["user_user", "userProfile", "appzeto_user_profile"]
    for (const key of candidates) {
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored)
    }
  } catch (error) {
    debugError('Error loading profile from localStorage:', error)
  }
  return null
}

// Save profile data to localStorage (keep keys used by ProfileContext)
const saveProfileToStorage = (data) => {
  try {
    localStorage.setItem('user_user', JSON.stringify(data))
    localStorage.setItem('userProfile', JSON.stringify(data))
  } catch (error) {
    debugError('Error saving profile to localStorage:', error)
  }
}

const normalizePhoneToTenDigits = (value) =>
  String(value || "").replace(/\D/g, "").slice(-10)

const buildFormDataFromProfile = (profile = {}) => ({
  name: profile.name || "",
  mobile: normalizePhoneToTenDigits(profile.mobile || profile.phone || ""),
  alternatePhone: normalizePhoneToTenDigits(profile.alternatePhone || ""),
  email: profile.email || "",
  dateOfBirth: profile.dateOfBirth
    ? (typeof profile.dateOfBirth === 'string'
      ? dayjs(profile.dateOfBirth)
      : dayjs(profile.dateOfBirth))
    : null,
  anniversary: profile.anniversary
    ? (typeof profile.anniversary === 'string'
      ? dayjs(profile.anniversary)
      : dayjs(profile.anniversary))
    : null,
  gender: profile.gender || "",
})

const clearEditProfileDraft = () => {
  try {
    localStorage.removeItem("user_edit_profile_draft")
  } catch (error) {
    debugError('Error clearing edit profile draft from localStorage:', error)
  }
}

export default function EditProfile() {
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = useAppBackNavigation()
  const isSharedProfile = location.pathname.startsWith("/profile")
  const profileSource = new URLSearchParams(location.search).get("from")
  const sharedSourceQuery = profileSource ? `?from=${profileSource}` : ""
  const profileHomePath = isSharedProfile ? `/profile${sharedSourceQuery}` : "/user/profile"
  const { userProfile, updateUserProfile } = useProfile()

  // Load from localStorage or use context
  const storedProfile = loadProfileFromStorage()
  const initialProfile = storedProfile || userProfile || {}

  const initialFormData = buildFormDataFromProfile(initialProfile)

  const [formData, setFormData] = useState(initialFormData)
  const [initialData] = useState(initialFormData)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [profileImage, setProfileImage] = useState(initialProfile?.profileImage || "")
  const [imagePreview, setImagePreview] = useState(initialProfile?.profileImage || "")
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({
    mobile: "",
    alternatePhone: "",
    email: "",
    dateOfBirth: "",
  })
  const fileInputRef = useRef(null)
  const hydratedFromDraftRef = useRef(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Track dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark') || 
                     document.body.classList.contains('dark') ||
                     document.documentElement.style.colorScheme === 'dark';
      setIsDarkMode(isDark)
    }
    checkDarkMode()
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Update form data when profile changes
  useEffect(() => {
    if (hydratedFromDraftRef.current) return

    const storedProfile = loadProfileFromStorage()
    const profile = storedProfile || userProfile || {}
    const newFormData = buildFormDataFromProfile(profile)
    setFormData(newFormData)

    // Update profile image
    if (profile.profileImage) {
      setProfileImage(profile.profileImage)
      setImagePreview(profile.profileImage)
    }
  }, [userProfile])

  useEffect(() => {
    clearEditProfileDraft()
  }, [])

  const datePickerTextFieldSx = {
    '& .MuiOutlinedInput-root': {
      height: '48px',
      borderRadius: '8px',
      backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff',
      color: isDarkMode ? '#ffffff' : '#111827',
      '& fieldset': {
        borderColor: isDarkMode ? '#374151' : '#d1d5db',
      },
      '&:hover fieldset': {
        borderColor: isDarkMode ? '#4b5563' : '#9ca3af',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'var(--color-primary-orange)',
        borderWidth: '1px',
      },
    },
    '& .MuiInputBase-input': {
      padding: '12px 14px',
      fontSize: '16px',
      color: isDarkMode ? '#ffffff !important' : '#111827 !important',
      WebkitTextFillColor: isDarkMode ? '#ffffff !important' : '#111827 !important',
      caretColor: isDarkMode ? '#ffffff' : '#111827',
    },
    '& .MuiPickersSectionList-root': {
      color: isDarkMode ? '#ffffff !important' : '#111827 !important',
    },
    '& .MuiPickersSectionList-section': {
      color: isDarkMode ? '#ffffff !important' : '#111827 !important',
    },
    '& .MuiPickersInputBase-sectionsContainer': {
      color: isDarkMode ? '#ffffff !important' : '#111827 !important',
    },
    '& .MuiInputAdornment-root .MuiIconButton-root': {
      color: isDarkMode ? '#ffffff !important' : 'inherit',
    },
    '& .MuiSvgIcon-root': {
      color: isDarkMode ? '#ffffff !important' : 'inherit',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: isDarkMode ? '#374151 !important' : '#d1d5db !important',
    },
    colorScheme: isDarkMode ? 'dark' : 'light',
  }

  // Get avatar initial
  const avatarInitial = formData.name?.charAt(0).toUpperCase() || 'A'

  // Check if form has changes
  useEffect(() => {
    const currentData = JSON.stringify(formData)
    const savedData = JSON.stringify(initialData)
    setHasChanges(currentData !== savedData)
  }, [formData, initialData])

  const validateName = (value) => {
    if (!value) return ""
    return /^[a-zA-Z\s]+$/.test(value) ? "" : "invalid name"
  }

  const validateEmail = (value) => {
    if (!value) return ""
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Please enter a valid email"
  }

  const validateMobile = (value) => {
    if (!value) return ""
    return /^\d{10}$/.test(value) ? "" : "Mobile number must be 10 digits"
  }

  const validateAlternatePhone = (value) => {
    if (!value) return ""
    return /^\d{10}$/.test(value) ? "" : "Alternate mobile number must be 10 digits"
  }

  const validateDateOfBirth = (value) => {
    if (!value) return ""
    const dob = dayjs(value)
    if (!dob.isValid()) return "Please select a valid date of birth"
    return dob.isAfter(dayjs(), "day") ? "Date of birth cannot be in the future" : ""
  }

  const handleChange = (field, value) => {
    let normalizedValue = value
    let errorMessage = ""

    if (field === "mobile") {
      normalizedValue = String(value || "").replace(/\D/g, "").slice(0, 10)
      errorMessage = validateMobile(normalizedValue)
    } else if (field === "alternatePhone") {
      normalizedValue = String(value || "").replace(/\D/g, "").slice(0, 10)
      errorMessage = validateAlternatePhone(normalizedValue)
    } else if (field === "email") {
      normalizedValue = String(value || "").trim()
      errorMessage = validateEmail(normalizedValue)
    } else if (field === "dateOfBirth") {
      errorMessage = validateDateOfBirth(normalizedValue)
    } else if (field === "name") {
      errorMessage = validateName(normalizedValue)
    }

    setFormData((prev) => ({
      ...prev,
      [field]: normalizedValue
    }))

    if (field === "mobile" || field === "alternatePhone" || field === "email" || field === "dateOfBirth" || field === "name") {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: errorMessage
      }))
    }
  }

  const handleClear = (field) => {
    setFormData(prev => ({
      ...prev,
      [field]: ""
    }))
  }

  const processProfileImageFile = async (file) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB')
      return
    }

    // Show preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)

    // Upload to server
    try {
      setIsUploadingImage(true)
      const response = await userAPI.uploadProfileImage(file)
      const imageUrl = response?.data?.data?.profileImage || response?.data?.profileImage

      if (imageUrl) {
        setProfileImage(imageUrl)
        setImagePreview(imageUrl)
        toast.success('Profile image uploaded successfully')

        const committedProfile = loadProfileFromStorage() || userProfile || {}
        const committedMobile = normalizePhoneToTenDigits(committedProfile.mobile || committedProfile.phone || "")
        const mergedProfile = {
          ...committedProfile,
          phone: committedMobile,
          mobile: committedMobile,
          profileImage: imageUrl,
        }

        // Only persist the uploaded image here. Other fields must wait for Update Profile.
        updateUserProfile(mergedProfile)
        saveProfileToStorage(mergedProfile)

        // Dispatch event to refresh profile
        window.dispatchEvent(new Event("userAuthChanged"))
      }
    } catch (error) {
      debugError('Error uploading image:', error)
      toast.error(error?.response?.data?.message || 'Failed to upload image')
      // Revert preview
      setImagePreview(profileImage)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      await processProfileImageFile(file)
    }
    e.target.value = ""
  }

  const handleProfileImageAction = () => {
    if (isFlutterBridgeAvailable()) {
      setPhotoPickerOpen(true)
      return
    }

    fileInputRef.current?.click()
  }

  const validateForm = () => {
    const nextErrors = {
      mobile: validateMobile(formData.mobile),
      alternatePhone: validateAlternatePhone(formData.alternatePhone),
      email: validateEmail(formData.email),
      dateOfBirth: validateDateOfBirth(formData.dateOfBirth),
    }
    setFieldErrors(nextErrors)
    return !Object.values(nextErrors).some(Boolean)
  }

  const handleUpdate = async () => {
    if (isSaving) return
    if (!validateForm()) {
      toast.error("Please fix the highlighted fields")
      return
    }

    try {
      setIsSaving(true)

      // Prepare data for API
      const updateData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.mobile || undefined,
        alternatePhone: formData.alternatePhone || undefined,
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.format('YYYY-MM-DD') : undefined,
        anniversary: formData.anniversary ? formData.anniversary.format('YYYY-MM-DD') : undefined,
        gender: formData.gender || undefined,
        profileImage: profileImage || undefined, // Include profileImage in update
      }

      // Call API to update profile
      const response = await userAPI.updateProfile(updateData)
      const updatedUser = response?.data?.data?.user || response?.data?.user

      if (updatedUser) {
        // Update context with all fields including profileImage
        updateUserProfile({
          ...updatedUser,
          phone: updatedUser.phone || formData.mobile,
          alternatePhone: updatedUser.alternatePhone || formData.alternatePhone,
          profileImage: updatedUser.profileImage || profileImage,
        })

        // Save to localStorage with complete data
        saveProfileToStorage({
          name: updatedUser.name || formData.name,
          phone: updatedUser.phone || formData.mobile,
          mobile: updatedUser.phone || formData.mobile,
          alternatePhone: updatedUser.alternatePhone || formData.alternatePhone,
          email: updatedUser.email || formData.email,
          profileImage: updatedUser.profileImage || profileImage,
          dateOfBirth: updatedUser.dateOfBirth || formData.dateOfBirth?.format('YYYY-MM-DD'),
          anniversary: updatedUser.anniversary || formData.anniversary?.format('YYYY-MM-DD'),
          gender: updatedUser.gender || formData.gender,
        })
        clearEditProfileDraft()

        // Dispatch event to refresh profile from API
        window.dispatchEvent(new Event("userAuthChanged"))

        toast.success('Profile updated successfully')

        // Navigate back
        navigate(profileHomePath)
      }
    } catch (error) {
      debugError('Error updating profile:', error)
      toast.error(error?.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMobileChange = () => {
    // Navigate to mobile change page or show modal
    debugLog('Change mobile clicked')
  }

  const handleEmailChange = () => {
    // Navigate to email change page or show modal
    debugLog('Change email clicked')
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 md:py-5 lg:py-6">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Your Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 sm:py-8 md:py-10 lg:py-12 pb-28 md:pb-12 space-y-6 md:space-y-8 lg:space-y-10">
        {/* Avatar Section */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="h-24 w-24 bg-primary-orange border-0">
              {imagePreview && (
                <AvatarImage
                  src={imagePreview}
                  alt={formData.name || 'User'}
                />
              )}
              <AvatarFallback className="bg-primary-orange text-white text-3xl font-semibold">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
            {/* Edit Icon */}
            <button
              onClick={handleProfileImageAction}
              disabled={isUploadingImage}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary-orange rounded-full flex items-center justify-center shadow-lg border-2 border-white hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Pencil className="h-4 w-4 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Form Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
          <CardContent className="p-4 sm:p-5 md:p-6 lg:p-8 space-y-4 md:space-y-5 lg:space-y-6">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-white">
                Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="pr-10 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-primary-orange focus:ring-1 focus:ring-primary-orange rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  placeholder="Name"
                />
                {formData.name && (
                  <button
                    type="button"
                    onClick={() => handleClear('name')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              {fieldErrors.name && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>
              )}
            </div>

            {/* Mobile Field */}
            <div className="space-y-1.5">
              <Label htmlFor="mobile" className="text-sm font-medium text-gray-700 dark:text-white">
                Mobile
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleChange('mobile', e.target.value)}
                  className="flex-1 h-12 text-base  border border-gray-300 dark:border-gray-700 focus:border-primary-orange focus:ring-1 focus:ring-primary-orange rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  placeholder="Mobile"
                />
              </div>
              {fieldErrors.mobile && (
                <p className="text-xs text-red-600">{fieldErrors.mobile}</p>
              )}
            </div>

            {/* Alternate Mobile Field */}
            <div className="space-y-1.5">
              <Label htmlFor="alternatePhone" className="text-sm font-medium text-gray-700 dark:text-white">
                Alternate Mobile <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="alternatePhone"
                  type="tel"
                  value={formData.alternatePhone || ""}
                  onChange={(e) => handleChange('alternatePhone', e.target.value)}
                  className="flex-1 h-12 text-base  border border-gray-300 dark:border-gray-700 focus:border-primary-orange focus:ring-1 focus:ring-primary-orange rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  placeholder="Alternate Mobile"
                />
              </div>
              {fieldErrors.alternatePhone && (
                <p className="text-xs text-red-600">{fieldErrors.alternatePhone}</p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-white">
                Email
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="flex-1 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-primary-orange focus:ring-1 focus:ring-primary-orange rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white"
                  placeholder="Email"
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Date of Birth Field */}
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700 dark:text-white">
                Date of birth
              </Label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={formData.dateOfBirth}
                  onChange={(newValue) => handleChange('dateOfBirth', newValue)}
                  maxDate={dayjs()}
                  slotProps={{
                    textField: {
                      className: "w-full",
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </LocalizationProvider>
              {fieldErrors.dateOfBirth && (
                <p className="text-xs text-red-600">{fieldErrors.dateOfBirth}</p>
              )}
            </div>

            {/* Anniversary Field */}
            <div className="space-y-1.5">
              <Label htmlFor="anniversary" className="text-sm font-medium text-gray-700 dark:text-white">
                Anniversary <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
              </Label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  value={formData.anniversary}
                  onChange={(newValue) => handleChange('anniversary', newValue)}
                  slotProps={{
                    textField: {
                      className: "w-full",
                      sx: datePickerTextFieldSx,
                    },
                  }}
                />
              </LocalizationProvider>
            </div>

            {/* Gender Field */}
            <div className="space-y-1.5">
              <Label htmlFor="gender" className="text-sm font-medium text-gray-700 dark:text-white">
                Gender
              </Label>
              <Select
                value={formData.gender || ""}
                onValueChange={(value) => handleChange('gender', value)}
              >
                <SelectTrigger className="h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-primary-orange focus:ring-1 focus:ring-primary-orange rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  {genderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Update Profile Button */}
        <Button
          onClick={handleUpdate}
          disabled={!hasChanges || isSaving || isUploadingImage}
          className={`w-full h-14 rounded-xl font-semibold text-base transition-all mb-2 ${hasChanges && !isSaving && !isUploadingImage
              ? 'bg-primary-orange hover:bg-primary-hover text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Update profile'
          )}
        </Button>

        <ImageSourcePicker
          isOpen={photoPickerOpen}
          onClose={() => setPhotoPickerOpen(false)}
          onFileSelect={processProfileImageFile}
          title="Update profile photo"
          description="Choose how you want to upload your profile photo."
          fileNamePrefix="profile-photo"
          galleryInputRef={fileInputRef}
        />
      </div>
    </div>
  )
}
