import { useState, useEffect, useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import Lenis from "lenis"
import { 
  ArrowLeft,
  Home,
  ShoppingBag,
  Store,
  Wallet,
  Menu,
  X,
  Plus,
  Upload,
  Image as ImageIcon
} from "lucide-react"
import { Card, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"
import { restaurantAPI } from "@food/api"
import { findItemInSections, flattenMenuItems, getMenuFromResponse } from "@food/utils/menuItems"
import { useRef } from "react"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { toast } from "sonner"
import { compressImage } from "@/shared/utils/imageCompression"
import {
  canSelectNonVegFoodType,
  categoryAcceptsFoodType,
  filterCategoriesForRestaurant,
} from "@food/utils/categoryDietScope"

const defaultFormData = {
  name: "",
  nameArabic: "",
  image: "",
  price: 0.00,
  availabilityTimeStart: "12:01 AM",
  availabilityTimeEnd: "11:57 PM",
  description: "",
  category: "",
  foodType: "Non-Veg",
  discountType: "Percent",
  discountAmount: 0.0,
  discount: 0,
  isAvailable: true,
  isRecommended: false,
  variations: [],
  tags: [],
  nutrition: [],
  allergies: []
}

const fallbackCategoryOptions = [
  { id: "fallback-varieties", name: "Varieties", foodTypeScope: "Veg" },
  { id: "fallback-appetizers", name: "Appetizers", foodTypeScope: "Veg" },
  { id: "fallback-main-course", name: "Main Course", foodTypeScope: "Veg" },
  { id: "fallback-desserts", name: "Desserts", foodTypeScope: "Veg" },
  { id: "fallback-beverages", name: "Beverages", foodTypeScope: "Veg" },
]

const INACTIVE_CATEGORY_WARNING = "This category is currently inactive and is not available for use."

const isRealCategoryId = (value) => /^[a-f0-9]{24}$/i.test(String(value || "").trim())

export default function EditFoodPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isNewFood = id === "new" || !id
  const [showMenu, setShowMenu] = useState(false)
  const [menuSections, setMenuSections] = useState([])
  const [availableCategories, setAvailableCategories] = useState([])
  const [isPureVegRestaurant, setIsPureVegRestaurant] = useState(false)
  const [isCategoryInactive, setIsCategoryInactive] = useState(false)

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

  const [formData, setFormData] = useState(defaultFormData)

  // Reload food data from backend menu when id changes
  useEffect(() => {
    let isMounted = true

    const loadFromMenu = async () => {
      try {
        const response = await restaurantAPI.getMenu()
        const menu = getMenuFromResponse(response)
        const sections = Array.isArray(menu?.sections) ? menu.sections : []
        if (!isMounted) return

        setMenuSections(sections)

        if (isNewFood) {
          setFormData(defaultFormData)
          return
        }

        const items = flattenMenuItems(menu)
        const existingFood = items.find((item) => String(item.id) === String(id))
        if (existingFood) {
          setFormData({
            ...defaultFormData,
            ...existingFood,
            nameArabic: existingFood.nameArabic || "",
            availabilityTimeStart: existingFood.availabilityTimeStart || "12:01 AM",
            availabilityTimeEnd: existingFood.availabilityTimeEnd || "11:57 PM",
            description: existingFood.description || "",
            category: existingFood.categoryId || existingFood.category || "",
            discountType: existingFood.discountType || "Percent",
            discountAmount: existingFood.discountAmount || 0.0,
            variations: existingFood.variations || [],
            tags: existingFood.tags || [],
            nutrition: existingFood.nutrition || [],
            allergies: existingFood.allergies || [],
          })
        }
      } catch {
        if (isMounted) {
          setMenuSections([])
        }
      }
    }

    loadFromMenu()

    return () => {
      isMounted = false
    }
  }, [id, isNewFood])

  useEffect(() => {
    let isMounted = true

    const loadCategories = async () => {
      try {
        const response = await restaurantAPI.getCategories()
        const categories = response?.data?.data?.categories || []
        if (!isMounted) return

        const normalized = categories
          .map((category) => ({
            id: category?._id || category?.id,
            name: String(category?.name || "").trim(),
            foodTypeScope: category?.foodTypeScope || "Veg",
            isGlobal: Boolean(category?.isGlobal),
          }))
          .filter((category) => category.id && category.name)

        setAvailableCategories(normalized)

        if (isNewFood && normalized.length > 0) {
          setFormData((prev) => {
            const currentCategory = String(prev.category || "").trim()
            const matchedCategory = normalized.find(
              (category) =>
                String(category.id) === currentCategory ||
                String(category.name || "").trim() === currentCategory,
            )
            if (matchedCategory) {
              if (String(matchedCategory.id) === currentCategory) return prev
              return {
                ...prev,
                category: matchedCategory.id,
              }
            }
            return {
              ...prev,
              category: normalized[0].id,
            }
          })
        } else if (normalized.length > 0) {
          setFormData((prev) => {
            const currentCategory = String(prev.category || "").trim()
            if (!currentCategory) return prev
            const matchedCategory = normalized.find(
              (category) =>
                String(category.id) === currentCategory ||
                String(category.name || "").trim() === currentCategory,
            )
            if (!matchedCategory || String(matchedCategory.id) === currentCategory) return prev
            return {
              ...prev,
              category: matchedCategory.id,
            }
          })
        }
      } catch {
        if (isMounted) {
          setAvailableCategories([])
        }
      }
    }

    loadCategories()

    return () => {
      isMounted = false
    }
  }, [isNewFood])

  // Dynamically verify the selected category's live status so we can warn (and block)
  // when the admin has deactivated it. The status is always fetched fresh from the
  // backend so the warning clears automatically once the category is reactivated.
  useEffect(() => {
    let isMounted = true
    const categoryId = String(formData.category || "").trim()

    if (!isRealCategoryId(categoryId)) {
      setIsCategoryInactive(false)
      return () => {
        isMounted = false
      }
    }

    const checkCategoryStatus = async () => {
      try {
        const response = await restaurantAPI.getCategoryStatus(categoryId)
        const category = response?.data?.data?.category
        if (!isMounted) return
        setIsCategoryInactive(category ? category.isActive === false : false)
      } catch {
        if (isMounted) setIsCategoryInactive(false)
      }
    }

    checkCategoryStatus()

    return () => {
      isMounted = false
    }
  }, [formData.category])

  useEffect(() => {
    let isMounted = true

    const fetchRestaurantProfile = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const profile =
          response?.data?.data?.restaurant ||
          response?.data?.restaurant ||
          response?.data?.data ||
          null
        if (!isMounted) return
        const pureVeg = profile?.pureVegRestaurant === true
        setIsPureVegRestaurant(pureVeg)
        if (pureVeg) {
          setFormData((prev) => ({ ...prev, foodType: "Veg" }))
        }
      } catch {}
    }

    fetchRestaurantProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const [newTag, setNewTag] = useState("")
  const [newNutrition, setNewNutrition] = useState("")
  const [newAllergy, setNewAllergy] = useState("")

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleVariationChange = (id, field, value) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.map(v => 
        v.id === id ? { ...v, [field]: value } : v
      )
    }))
  }

  const handleAddVariation = () => {
    setFormData(prev => ({
      ...prev,
      variations: [...prev.variations, { id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: "", price: "" }]
    }))
  }

  const handleRemoveVariation = (id) => {
    setFormData(prev => ({
      ...prev,
      variations: prev.variations.filter(v => v.id !== id)
    }))
  }

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag("")
    }
  }

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const handleAddNutrition = () => {
    if (newNutrition.trim() && !formData.nutrition.includes(newNutrition.trim())) {
      setFormData(prev => ({
        ...prev,
        nutrition: [...prev.nutrition, newNutrition.trim()]
      }))
      setNewNutrition("")
    }
  }

  const handleRemoveNutrition = (item) => {
    setFormData(prev => ({
      ...prev,
      nutrition: prev.nutrition.filter(n => n !== item)
    }))
  }

  const handleAddAllergy = () => {
    if (newAllergy.trim() && !formData.allergies.includes(newAllergy.trim())) {
      setFormData(prev => ({
        ...prev,
        allergies: [...prev.allergies, newAllergy.trim()]
      }))
      setNewAllergy("")
    }
  }

  const handleRemoveAllergy = (allergy) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.filter(a => a !== allergy)
    }))
  }

  const fileInputRef = useRef(null)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const categoryOptions = (() => {
    const currentCategory = String(formData.category || "").trim()
    const source = availableCategories.length > 0 ? availableCategories : fallbackCategoryOptions
    const filteredSource = filterCategoriesForRestaurant(source, { pureVegRestaurant: isPureVegRestaurant })
    if (!currentCategory) return filteredSource

    const alreadyPresent = filteredSource.some(
      (category) => String(category?.id || "").trim() === currentCategory,
    )
    if (alreadyPresent) return filteredSource

    const matchedSection = Array.isArray(menuSections)
      ? menuSections.find((section) => String(section?.categoryId || section?.id || "") === currentCategory)
      : null

    return [
      {
        id: currentCategory,
        name: matchedSection?.name || currentCategory,
        foodTypeScope: "Veg",
      },
      ...filteredSource,
    ]
  })()

  const selectedCategoryOption = useMemo(
    () => categoryOptions.find(
      (category) => String(category?.id || "").trim() === String(formData.category || "").trim(),
    ),
    [categoryOptions, formData.category],
  )

  const showNonVegFoodType = canSelectNonVegFoodType({
    pureVegRestaurant: isPureVegRestaurant,
    categoryFoodTypeScope: selectedCategoryOption?.foodTypeScope,
  })

  useEffect(() => {
    if (!showNonVegFoodType && formData.foodType !== "Veg") {
      setFormData((prev) => ({ ...prev, foodType: "Veg" }))
    }
  }, [showNonVegFoodType, formData.foodType])

  const handleImageUpload = async (field, file) => {
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size too large. Max 5MB allowed.")
        return
      }
      
      const compressed = await compressImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: reader.result
        }))
      }
      reader.readAsDataURL(compressed)
    }
  }

  const handleImageClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const normalizedVariations = (Array.isArray(formData.variations) ? formData.variations : [])
      .map((variation) => ({
        id: String(variation?.id || variation?._id || "").trim(),
        name: String(variation?.name || "").trim(),
        price: Number(variation?.price),
      }))
      .filter((variation) => variation.name || variation.id || variation.price)

    const hasVariations = normalizedVariations.length > 0
    const parsedBasePrice = Number(formData.price)

    if (!formData.name || !formData.image) {
      alert("Please fill in all required fields (Name and Image)")
      return
    }

    if (normalizedVariations.some((variation) => !variation.name)) {
      alert("Each variant must have a name")
      return
    }

    if (normalizedVariations.some((variation) => !Number.isFinite(variation.price) || variation.price <= 0)) {
      alert("Each variant price must be greater than 0")
      return
    }

    if (!hasVariations && (!Number.isFinite(parsedBasePrice) || parsedBasePrice <= 0)) {
      alert("Please enter a valid base price")
      return
    }

    // Prepare food data for saving
    const foodDataToSave = {
      ...formData,
      price: hasVariations ? undefined : parsedBasePrice,
      variations: normalizedVariations.map((variation) => ({
        ...(variation.id && !variation.id.startsWith("variant-") ? { _id: variation.id } : {}),
        name: variation.name,
        price: variation.price,
      })),
      // Calculate discount display string if discount exists
      discount: formData.discountAmount > 0 
        ? (formData.discountType === "Percent" 
          ? `${formData.discountAmount}% OFF` 
          : formData.discountAmount)
        : null,
      // Calculate originalPrice if discount exists
      originalPrice: formData.discountAmount > 0 && formData.discountType === "Percent" && !hasVariations
        ? parsedBasePrice / (1 - formData.discountAmount / 100)
        : null
    }

    const matchedCategory = categoryOptions.find(
      (category) => String(category?.id || "").trim() === String(foodDataToSave.category || "").trim(),
    )

    if (!matchedCategory?.id) {
      toast.error("Please select a valid menu category first")
      navigate("/restaurant/menu-categories")
      return
    }

    if (isCategoryInactive) {
      toast.error(INACTIVE_CATEGORY_WARNING)
      return
    }

    if (!categoryAcceptsFoodType(matchedCategory?.foodTypeScope, foodDataToSave.foodType)) {
      toast.error(`This ${matchedCategory.foodTypeScope} category cannot accept ${foodDataToSave.foodType} food`)
      return
    }

    if (isNewFood) {
      try {
        const res = await restaurantAPI.createFood({
          ...foodDataToSave,
          categoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
        })
        const created = res?.data?.data?.food || res?.data?.food
        window.dispatchEvent(new CustomEvent("foodsChanged"))
        if (created) {
          window.dispatchEvent(new CustomEvent("foodAdded", { detail: { food: created } }))
          navigate(`/restaurant/food/${String(created._id || created.id)}`)
        } else {
          navigate(`/food/restaurant/inventory`)
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || "Error saving food. Please try again.")
      }
      return
    }

    try {
      const res = await restaurantAPI.updateFood(String(id), {
        ...foodDataToSave,
        categoryId: matchedCategory.id,
        categoryName: matchedCategory.name,
      })
      const updated = res?.data?.data?.food || res?.data?.food
      window.dispatchEvent(new CustomEvent("foodsChanged"))
      if (updated) {
        window.dispatchEvent(new CustomEvent("foodUpdated", { detail: { food: updated } }))
        navigate(`/restaurant/food/${String(updated._id || updated.id || id)}`)
      } else {
        navigate(`/restaurant/food/${String(id)}`)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Error saving food. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-4">
          <button 
            onClick={() => navigate(`/restaurant/food/${id}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Edit Food</h1>
        </div>
      </div>

      {/* Content - Scrollable */}
      <form id="edit-food-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pb-32 md:pb-6">
        <div className="px-4 py-6 space-y-4">
          {/* Food Image */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Food Image</h2>
              <div className="flex justify-center">
                <div className="relative">
                  <img 
                    src={formData.image}
                    alt={formData.name}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-lg object-cover"
                  />
                  <label 
                    onClick={handleImageClick}
                    className="absolute bottom-0 right-0 bg-[#ff8100] text-white p-2 rounded-full cursor-pointer hover:bg-[#e67300]"
                  >
                    <Upload className="w-4 h-4" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload("image", e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Name (English)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Name (Arabic)
                  </label>
                  <input
                    type="text"
                    value={formData.nameArabic}
                    onChange={(e) => handleInputChange("nameArabic", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* General Info */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">General Info</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const nextCategoryId = e.target.value
                      const nextCategory = categoryOptions.find(
                        (category) => String(category?.id || "").trim() === String(nextCategoryId || "").trim(),
                      )
                      setFormData((prev) => ({
                        ...prev,
                        category: nextCategoryId,
                        foodType: canSelectNonVegFoodType({
                          pureVegRestaurant: isPureVegRestaurant,
                          categoryFoodTypeScope: nextCategory?.foodTypeScope,
                        })
                          ? prev.foodType
                          : "Veg",
                      }))
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  >
                    {categoryOptions.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                        {category.foodTypeScope ? ` · ${category.foodTypeScope}` : ""}
                        {category.isGlobal ? " · Global" : " · Local"}
                      </option>
                    ))}
                  </select>
                  {availableCategories.length === 0 && (
                    <p className="mt-2 text-xs text-amber-700">
                      Add restaurant categories in Menu Categories before saving new dishes.
                    </p>
                  )}
                  {isCategoryInactive && (
                    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      {INACTIVE_CATEGORY_WARNING}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Food Type
                  </label>
                  <select
                    value={formData.foodType}
                    onChange={(e) => handleInputChange("foodType", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  >
                    <option value="Veg">Veg</option>
                    {showNonVegFoodType && <option value="Non-Veg">Non-Veg</option>}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Information */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Price Information</h2>
              
              <div className="space-y-4">
                {formData.variations.length === 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => handleInputChange("price", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                      required
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    This item uses variants. Customers will see the lowest variant price as "Starting from".
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => handleInputChange("discountType", e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  >
                    <option value="Percent">Percent</option>
                    <option value="Fixed">Fixed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.discountAmount}
                    onChange={(e) => handleInputChange("discountAmount", parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Availability</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm md:text-base font-medium text-gray-900">Available</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange("isAvailable", !formData.isAvailable)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isAvailable ? 'bg-[#ff8100]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isAvailable ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm md:text-base font-medium text-gray-900">Recommended</span>
                  <button
                    type="button"
                    onClick={() => handleInputChange("isRecommended", !formData.isRecommended)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isRecommended ? 'bg-[#ff8100]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isRecommended ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available From
                    </label>
                    <input
                      type="text"
                      value={formData.availabilityTimeStart}
                      onChange={(e) => handleInputChange("availabilityTimeStart", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                      placeholder="12:01 AM"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Available To
                    </label>
                    <input
                      type="text"
                      value={formData.availabilityTimeEnd}
                      onChange={(e) => handleInputChange("availabilityTimeEnd", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none"
                      placeholder="11:57 PM"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variations */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base md:text-lg font-semibold text-gray-900">Variants</h2>
                <button
                  type="button"
                  onClick={handleAddVariation}
                  className="text-[#ff8100] hover:text-[#e67300] flex items-center gap-1 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </button>
              </div>
              
              <div className="space-y-4">
                {formData.variations.map((variation) => (
                  <div key={variation.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Variant {index + 1}</span>
                      {formData.variations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariation(variation.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={variation.name}
                        onChange={(e) => handleVariationChange(variation.id, "name", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                      />
                    </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variation.price}
                          onChange={(e) => handleVariationChange(variation.id, "price", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {formData.variations.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No variants added. This item will use the single base price above.
                  </p>
                )}
              </CardContent>
            </Card>

          {/* Tags */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Tags</h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Add tag"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Nutrition */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Nutrition</h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.nutrition.map((item, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center gap-2"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => handleRemoveNutrition(item)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNutrition}
                  onChange={(e) => setNewNutrition(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddNutrition())}
                  placeholder="Add nutrition"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddNutrition}
                  className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card className="bg-white shadow-sm border-0">
            <CardContent className="p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Allergies</h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.allergies.map((allergy, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full flex items-center gap-2"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => handleRemoveAllergy(allergy)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllergy())}
                  placeholder="Add allergy"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ff8100] focus:border-transparent outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddAllergy}
                  className="px-4 py-2 bg-[#ff8100] text-white rounded-lg hover:bg-[#e67300] text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 md:relative md:border-0 md:shadow-none">
        <div className="px-4 py-3 md:max-w-4xl md:mx-auto">
          <Button
            type="submit"
            form="edit-food-form"
            className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-semibold py-3 rounded-lg text-base md:text-lg"
          >
            Update
          </Button>
        </div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={(file) => handleImageUpload("image", file)}
        title="Upload Dish Photo"
        description="Choose how to upload your dish image"
        fileNamePrefix="dish-photo"
        galleryInputRef={fileInputRef}
      />
    </div>
  )
}

