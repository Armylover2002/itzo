import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Upload, Image as ImageIcon } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"
import { getRestaurantData, updateRestaurantData } from "@food/utils/restaurantManagement"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import { restaurantAPI } from "@food/api"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { toast } from "sonner"

const debugError = (...args) => {}

export default function EditRestaurantPage() {
  const navigate = useNavigate()
  const [activeLanguage, setActiveLanguage] = useState("english")
  const [showMenu, setShowMenu] = useState(false)
  
  const logoInputRef = useRef(null)
  const coverInputRef = useRef(null)
  const metaInputRef = useRef(null)
  const [activePicker, setActivePicker] = useState(null) // { type: string, ref: any, title: string }

  const [formData, setFormData] = useState(() => {
    const savedData = getRestaurantData()
    return {
      restaurantName: savedData.restaurantName || {
        english: "Hungry Puppets",
        bengali: "",
        arabic: "",
        spanish: ""
      },
      phoneNumber: savedData.phoneNumber || "+101747410000",
      address: savedData.address || "House: 00, Road: 00, Test City",
      logo: savedData.logo || null,
      cover: savedData.cover || null,
      metaTitle: savedData.metaTitle || "Hungry Puppets Restaurant: Where Fla",
      metaDescription: savedData.metaDescription || "Satisfy your cravings and indulge in a culinary adventure at Hungry Puppets Restaurant. Our menu is a symphony of taste, offering a delightful fusion of flavors that excite both palate and",
      metaImage: savedData.metaImage || null
    }
  })

  // Reload data when component mounts or data changes
  useEffect(() => {
    const refreshData = () => {
      const savedData = getRestaurantData()
      setFormData({
        restaurantName: savedData.restaurantName || {
          english: "Hungry Puppets",
          bengali: "",
          arabic: "",
          spanish: ""
        },
        phoneNumber: savedData.phoneNumber || "+101747410000",
        address: savedData.address || "House: 00, Road: 00, Test City",
        logo: savedData.logo || null,
        cover: savedData.cover || null,
        metaTitle: savedData.metaTitle || "Hungry Puppets Restaurant: Where Fla",
        metaDescription: savedData.metaDescription || "Satisfy your cravings and indulge in a culinary adventure at Hungry Puppets Restaurant. Our menu is a symphony of taste, offering a delightful fusion of flavors that excite both palate and",
        metaImage: savedData.metaImage || null
      })
    }

    refreshData()

    window.addEventListener('restaurantDataUpdated', refreshData)
    window.addEventListener('storage', refreshData)

    return () => {
      window.removeEventListener('restaurantDataUpdated', refreshData)
      window.removeEventListener('storage', refreshData)
    }
  }, [])

  const languages = [
    { id: "english", label: "English" },
    { id: "bengali", label: "Bengali" },
    { id: "arabic", label: "Arabic" },
    { id: "spanish", label: "Spanish" }
  ]

  const handleInputChange = (field, value) => {
    if (field === "restaurantName") {
      setFormData(prev => ({
        ...prev,
        restaurantName: {
          ...prev.restaurantName,
          [activeLanguage]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleImageUpload = (field, file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Max 5MB allowed.")
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: reader.result
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageClick = (type, ref, title) => {
    if (isFlutterBridgeAvailable()) {
      setActivePicker({ type, ref, title })
    } else {
      ref.current?.click()
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.restaurantName.english || !formData.address || !formData.phoneNumber) {
      alert("Please fill in all required fields (Restaurant Name, Address, Phone Number)")
      return
    }

    // Save restaurant data to localStorage
    try {
      updateRestaurantData(formData)
      // Navigate back to restaurant details page
      navigate("/restaurant/details")
    } catch (error) {
      debugError("Error saving restaurant data:", error)
      alert("Error saving restaurant data. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button 
            onClick={() => navigate("/restaurant/details")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Edit Restaurant</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Restaurant Name */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Restaurant Name</h2>
              
              {/* Language Tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {languages.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => setActiveLanguage(lang.id)}
                    className={`flex-shrink-0 px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeLanguage === lang.id
                        ? "text-[#ff8100] border-[#ff8100]"
                        : "text-gray-600 border-transparent hover:text-gray-900"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant Name ({languages.find(l => l.id === activeLanguage)?.label})
                </label>
                <input
                  type="text"
                  value={formData.restaurantName[activeLanguage]}
                  onChange={(e) => handleInputChange("restaurantName", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  placeholder="Enter restaurant name"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Contact</h2>
              
              {/* Phone Number */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-l-lg bg-gray-50">
                    <span className="text-lg">USA</span>
                    <span className="text-sm text-gray-700">+1</span>
                  </div>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-r-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                    placeholder="01747410000"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  placeholder="Enter address"
                />
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Logo */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                Restaurant Logo<span className="text-red-500">*</span>
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mb-4">
                JPG, JPEG, PNG Less Than 5MB (Ratio 1:1)
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[150px]">
                {formData.logo ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                    <img 
                      src={formData.logo} 
                      alt="Restaurant Logo" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo: null }))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mb-3">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div 
                      onClick={() => handleImageClick("logo", logoInputRef, "Upload Logo")}
                      className="cursor-pointer"
                    >
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => handleImageUpload("logo", e.target.files[0])}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 underline">Upload Logo</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Restaurant Cover */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                Restaurant Cover<span className="text-red-500">*</span>
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mb-4">
                JPG, JPEG, PNG Less Than 5MB (Ratio 2:1)
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[200px]">
                {formData.cover ? (
                  <div className="relative w-full rounded-lg overflow-hidden">
                    <img 
                      src={formData.cover} 
                      alt="Restaurant Cover" 
                      className="w-full h-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, cover: null }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <div 
                      onClick={() => handleImageClick("cover", coverInputRef, "Upload Cover")}
                      className="cursor-pointer"
                    >
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => handleImageUpload("cover", e.target.files[0])}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 underline">Upload Cover</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meta Data */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Meta Data</h2>
              
              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.metaTitle}
                  onChange={(e) => handleInputChange("metaTitle", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  placeholder="Enter meta title"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.metaDescription}
                  onChange={(e) => handleInputChange("metaDescription", e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none resize-none"
                  placeholder="Enter meta description"
                />
              </div>
            </CardContent>
          </Card>

          {/* Meta Image */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Meta Image</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 md:p-8 flex flex-col items-center justify-center min-h-[150px]">
                {formData.metaImage ? (
                  <div className="relative w-full rounded-lg overflow-hidden">
                    <img 
                      src={formData.metaImage} 
                      alt="Meta Image" 
                      className="w-full h-auto object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, metaImage: null }))}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-gray-400 mb-3" />
                    <div 
                      onClick={() => handleImageClick("metaImage", metaInputRef, "Upload Meta Image")}
                      className="cursor-pointer"
                    >
                      <input
                        ref={metaInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => handleImageUpload("metaImage", e.target.files[0])}
                        className="hidden"
                      />
                      <span className="text-sm text-gray-600 underline">Upload Meta Image</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Update Button */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-4 md:mx-0 md:border-0 md:p-0 md:mt-6">
            <Button
              type="submit"
              className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg text-base md:text-lg"
            >
              Update
            </Button>
          </div>
        </form>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />

      <ImageSourcePicker
        isOpen={!!activePicker}
        onClose={() => setActivePicker(null)}
        onFileSelect={(file) => handleImageUpload(activePicker?.type, file)}
        title={activePicker?.title}
        description={`Choose how to upload your ${activePicker?.type === 'logo' ? 'logo' : 'image'}`}
        fileNamePrefix={`restaurant-${activePicker?.type}`}
        galleryInputRef={activePicker?.ref}
      />
    </div>
  )
}
