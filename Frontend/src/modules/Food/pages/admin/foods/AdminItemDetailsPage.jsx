import { useState, useRef, useEffect, useMemo } from "react"
import { useNavigate, useParams, useLocation } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Trash2,
  Check,
  ChevronDown,
  Edit as EditIcon,
  Plus,
  X,
  Camera,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Globe,
} from "lucide-react"
import { Switch } from "@food/components/ui/switch"
// Removed getAllFoods and saveFood - now using menu API
import api from "@food/api"
import { adminAPI, uploadAPI, mediaAPI } from "@food/api"
import { toast } from "sonner"
import CreateCategoryModal from "@food/components/restaurant/CreateCategoryModal"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import ReusableImageLibraryModal from "@food/components/ReusableImageLibraryModal"
import Cropper from "react-easy-crop"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"
import { getFoodVariants } from "@food/utils/foodVariants"
import {
  FOOD_VARIANT_UNITS,
  DEFAULT_FOOD_VARIANT_UNIT,
  normalizeFoodVariantUnit,
} from "@food/constants/foodVariantUnits"
import {
  canSelectNonVegFoodType,
  categoryAcceptsFoodType,
  filterCategoriesForRestaurant,
} from "@food/utils/categoryDietScope"

const scopePillClass = (scope, selected = false) => {
  if (selected) return "border-white/30 bg-white/10 text-white"
  if (scope === "Veg") return "border-green-200 bg-green-50 text-green-700"
  if (scope === "Non-Veg") return "border-red-200 bg-red-50 text-red-700"
  return "border-slate-200 bg-slate-100 text-slate-700"
}

const scopePillLabel = (scope) => scope || "Veg"

const globalPillClass = (isGlobal, selected = false) => {
  if (selected) return "border-white/30 bg-white/10 text-white"
  return isGlobal
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-violet-200 bg-violet-50 text-violet-700"
}

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const INACTIVE_CATEGORY_WARNING = "This category is currently inactive and is not available for use."
const PENDING_CATEGORY_WARNING = "This category is awaiting admin approval. Please wait for approval before adding items."
const isRealCategoryId = (value) => /^[a-f0-9]{24}$/i.test(String(value || "").trim())

const INVENTORY_RECOMMENDED_KEY = "restaurant_inventory_recommended_map"


const getUploadErrorMessage = (error, fileName = "image") => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Please try again."
  return `Failed to upload ${fileName}: ${message}`
}

const createVariantDraft = (variant = {}) => ({
  localId: String(variant?.id || variant?._id || `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  persistedId: String(variant?.id || variant?._id || ""),
  name: String(variant?.name || ""),
  unit: normalizeFoodVariantUnit(variant?.unit),
  price: variant?.price != null ? String(variant.price) : "",
  otherPrice: variant?.otherPrice != null ? String(variant.otherPrice) : "",
})

export default function AdminItemDetailsPage() {
  const navigate = useNavigate()
  const goBack = () => navigate(-1)
  const { id } = useParams()
  const location = useLocation()

  const isNewItem = !id || id === "new" || location.pathname.endsWith("/new")
  const groupId = location.state?.groupId
  const defaultCategory = location.state?.category || "Select category"
  const defaultCategoryId = location.state?.categoryId || ""
  const fileInputRef = useRef(null)

  // Initialize state with empty values - will be populated from API
  const [itemData, setItemData] = useState(null) // Store the full item data for saving
  const [restaurantId, setRestaurantId] = useState("")
  const [restaurants, setRestaurants] = useState([])
  const [itemName, setItemName] = useState("")
  const [category, setCategory] = useState(defaultCategory)
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultCategoryId)
  const [subCategory, setSubCategory] = useState("")
  const [servesInfo, setServesInfo] = useState("")
  const [itemSizeQuantity, setItemSizeQuantity] = useState("")
  const [itemSizeUnit, setItemSizeUnit] = useState("piece")
  const [itemDescription, setItemDescription] = useState("")
  const [foodType, setFoodType] = useState("Veg")
  const [basePrice, setBasePrice] = useState("")
  const [otherPrice, setOtherPrice] = useState("")
  const [itemHasVariants, setItemHasVariants] = useState(false)
  const [variantChoiceMade, setVariantChoiceMade] = useState(id !== "new")
  const [variants, setVariants] = useState([])
  const [preparationTime, setPreparationTime] = useState("")
  const [itemSlotTimingId, setItemSlotTimingId] = useState("")
  const [slotTimings, setSlotTimings] = useState([])
  const [gst, setGst] = useState("5.0")
  const [isRecommended, setIsRecommended] = useState(false)
  const [isInStock, setIsInStock] = useState(true)
  const [weightPerServing, setWeightPerServing] = useState("")
  const [calorieCount, setCalorieCount] = useState("")
  const [proteinCount, setProteinCount] = useState("")
  const [carbohydrates, setCarbohydrates] = useState("")
  const [fatCount, setFatCount] = useState("")
  const [fibreCount, setFibreCount] = useState("")
  const [allergens, setAllergens] = useState("")
  const [showMoreNutrition, setShowMoreNutrition] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [images, setImages] = useState([])
  const [imageFiles, setImageFiles] = useState(new Map()) // Track File objects by preview URL
  const [uploadingImages, setUploadingImages] = useState(false)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageToCrop, setImageToCrop] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isCropping, setIsCropping] = useState(false)
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const [direction, setDirection] = useState(0)
  const carouselRef = useRef(null)
  const [isCategoryPopupOpen, setIsCategoryPopupOpen] = useState(false)
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false)
  const [categoriesRefreshKey, setCategoriesRefreshKey] = useState(0)
  const [isServesPopupOpen, setIsServesPopupOpen] = useState(false)
  const [isSlotTimingPopupOpen, setIsSlotTimingPopupOpen] = useState(false)

  useEffect(() => {
    let isMounted = true
    const fetchRestaurants = async () => {
      try {
        const response = await adminAPI.getRestaurants({ limit: 1000, status: "approved" })
        if (isMounted) {
          const fetchedRestaurants = response?.data?.data?.restaurants || response?.data?.restaurants || []
          setRestaurants(fetchedRestaurants)
        }
      } catch (error) {
        console.error("Error fetching restaurants", error)
      }
    }
    fetchRestaurants()
    return () => { isMounted = false }
  }, [])
  const [isGstPopupOpen, setIsGstPopupOpen] = useState(false)
  const [isTagsPopupOpen, setIsTagsPopupOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [loadingItem, setLoadingItem] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)
  const [isPureVegRestaurant, setIsPureVegRestaurant] = useState(false)
  const [categoryLiveStatus, setCategoryLiveStatus] = useState(null)

  const [suggestedImages, setSuggestedImages] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [errorSuggestions, setErrorSuggestions] = useState(false)
  const debounceTimerRef = useRef(null)
  const suggestionCacheRef = useRef({ queryKey: "", results: [] })

  const selectableCategories = useMemo(
    () => filterCategoriesForRestaurant(categories, { pureVegRestaurant: isPureVegRestaurant }),
    [categories, isPureVegRestaurant],
  )

  const selectedCategory = useMemo(
    () => selectableCategories.find((cat) => String(cat.id) === String(selectedCategoryId || "")),
    [selectableCategories, selectedCategoryId],
  )

  const selectedAvailabilitySlot = useMemo(
    () => slotTimings.find((slot) => String(slot.id) === String(itemSlotTimingId || "")) || null,
    [slotTimings, itemSlotTimingId],
  )

  const showNonVegFoodType = canSelectNonVegFoodType({
    pureVegRestaurant: isPureVegRestaurant,
    categoryFoodTypeScope: selectedCategory?.foodTypeScope,
  })

  const isCategoryInactive = categoryLiveStatus?.liveStatus === "INACTIVE" || selectedCategory?.liveStatus === "INACTIVE"
  const isCategoryPending = categoryLiveStatus?.liveStatus === "PENDING" || selectedCategory?.liveStatus === "PENDING"

  useEffect(() => {
    if (!showNonVegFoodType && foodType !== "Veg") {
      setFoodType("Veg")
    }
  }, [showNonVegFoodType, foodType])

  useEffect(() => {
    if (!isPureVegRestaurant || selectableCategories.length === 0) return
    const currentStillValid = selectableCategories.some(
      (cat) => String(cat.id) === String(selectedCategoryId || ""),
    )
    if (currentStillValid) return
    const nextCategory = selectableCategories[0]
    setSelectedCategoryId(nextCategory.id)
    setCategory(nextCategory.name)
    setFoodType("Veg")
  }, [isPureVegRestaurant, selectableCategories, selectedCategoryId])

  useEffect(() => {
    let isMounted = true
    const categoryId = String(selectedCategoryId || "").trim()

    if (!restaurantId || !isRealCategoryId(categoryId)) {
      setCategoryLiveStatus(null)
      return () => {
        isMounted = false
      }
    }

    const checkCategoryStatus = async () => {
      try {
        const response = await adminAPI.getRestaurantCategoryStatus(restaurantId, categoryId)
        const statusCategory = response?.data?.data?.category
        if (!isMounted) return
        if (statusCategory) {
          const approval = String(statusCategory.approvalStatus || "").toLowerCase()
          setCategoryLiveStatus({
            ...statusCategory,
            liveStatus:
              statusCategory.isActive === false
                ? "INACTIVE"
                : approval === "pending"
                  ? "PENDING"
                  : "ACTIVE",
          })
        } else {
          setCategoryLiveStatus(null)
        }
      } catch {
        if (isMounted) setCategoryLiveStatus(null)
      }
    }

    checkCategoryStatus()

    return () => {
      isMounted = false
    }
  }, [selectedCategoryId, categoriesRefreshKey, restaurantId])

  // Auto-suggestions query logic with 450ms debounce and deduplication/cache
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    const trimmedName = itemName.trim().toLowerCase()
    const validCategory = category && category !== "Select category" ? category.trim().toLowerCase() : ""

    // Rule 3: Show suggestions ONLY IF name length >= 3 OR valid category is selected
    if (trimmedName.length < 3 && !validCategory) {
      setSuggestedImages([])
      setLoadingSuggestions(false)
      return
    }

    const queryKey = `${trimmedName}||${validCategory}`

    // Rule 7: Prevent duplicate calls for same query & cache last successful query
    if (queryKey === suggestionCacheRef.current.queryKey) {
      setSuggestedImages(suggestionCacheRef.current.results)
      setLoadingSuggestions(false)
      setErrorSuggestions(false)
      return
    }

    setLoadingSuggestions(true)
    setErrorSuggestions(false)

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const params = { limit: 6 }
        if (trimmedName.length >= 3) {
          params.search = itemName.trim()
        } else if (validCategory) {
          params.category = category.trim()
        }

        const response = await mediaAPI.getSharedMedia(params)

        if (response?.data?.success && Array.isArray(response?.data?.data?.items)) {
          const items = response.data.data.items
          // Cache successful result
          suggestionCacheRef.current = {
            queryKey,
            results: items
          }
          setSuggestedImages(items)
        } else {
          setSuggestedImages([])
        }
      } catch (err) {
        debugError("Error fetching suggestions:", err)
        setErrorSuggestions(true)
        // Rule 8: Silently hide suggestions section on API failure
        setSuggestedImages([])
      } finally {
        setLoadingSuggestions(false)
      }
    }, 450)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [itemName, category])

  // Restore draft if exists
  useEffect(() => {
    const savedDraft = sessionStorage.getItem('item_form_draft')
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        if (draft.itemName) setItemName(draft.itemName)
        if (draft.category) setCategory(draft.category)
        if (draft.selectedCategoryId) setSelectedCategoryId(draft.selectedCategoryId)
        if (draft.itemDescription) setItemDescription(draft.itemDescription)
        if (draft.foodType) setFoodType(draft.foodType)
        if (draft.basePrice) setBasePrice(draft.basePrice)
        if (draft.itemHasVariants != null) setItemHasVariants(draft.itemHasVariants)
        if (draft.itemHasVariants != null) setVariantChoiceMade(true)
        if (draft.variants) setVariants(draft.variants)
        if (draft.preparationTime) setPreparationTime(draft.preparationTime)
        if (draft.images) setImages(draft.images)

        // Clear draft after restoring
        sessionStorage.removeItem('item_form_draft')
      } catch (e) {
        debugError('Error parsing item draft:', e)
      }
    }
  }, [])

  useEffect(() => {
    if (location.state?.focusCategory) {
      setIsCategoryPopupOpen(true)
    }
  }, [location.state?.focusCategory])

  const maxNameLength = 70
  const maxDescriptionLength = 1000
  const descriptionLength = itemDescription.length
  const minDescriptionLength = 5
  const nameLength = itemName.length
  const currentApprovalStatus = String(itemData?.approvalStatus || "").toLowerCase()
  const currentRejectionReason = String(itemData?.rejectionReason || "").trim()

  const populateFormFromItem = (item = {}) => {
    setItemData(item)

    const nextRestaurantId = String(item.restaurantId?._id || item.restaurantId || "").trim()
    if (nextRestaurantId) {
      setRestaurantId(nextRestaurantId)
    }

    setItemName(item.name || "")
    setCategory(item.category || item.categoryName || defaultCategory)
    setSelectedCategoryId(String(item.categoryId || "").trim())
    setSubCategory(item.subCategory || item.category || item.categoryName || "Starters")
    setServesInfo(item.servesInfo || "")
    setItemSizeQuantity(item.itemSizeQuantity || "")
    setItemSizeUnit(item.itemSizeUnit || "piece")
    setItemDescription(item.description || "")
    setFoodType(item.foodType === "Veg" ? "Veg" : "Non-Veg")
    const itemVariants = getFoodVariants(item)
    const hasExistingVariants = itemVariants.length > 0
    setItemHasVariants(hasExistingVariants)
    setVariantChoiceMade(true)
    setVariants(hasExistingVariants ? itemVariants.map(createVariantDraft) : [])
    setBasePrice(!hasExistingVariants ? item.price?.toString() || "" : "")
    setOtherPrice(!hasExistingVariants ? item.otherPrice?.toString() || "" : "")
    setPreparationTime(item.preparationTime || "")
    setItemSlotTimingId(String(item.itemSlotTimingId || item.itemSlotTiming?.id || ""))
    setGst(item.gst?.toString() || "5.0")
    setIsRecommended(item.isRecommended || false)
    setIsInStock(item.isAvailable !== false)
    setSelectedTags(item.tags || [])

    const existingImages = Array.isArray(item.images) && item.images.length > 0
      ? item.images.filter(Boolean)
      : (item.image ? [item.image] : [])
    setImages(existingImages)

    setWeightPerServing("")
    setCalorieCount("")
    setProteinCount("")
    setCarbohydrates("")
    setFatCount("")
    setFibreCount("")
    setAllergens("")

    if (item.nutrition && Array.isArray(item.nutrition)) {
      item.nutrition.forEach(nut => {
        if (typeof nut === 'string') {
          if (nut.includes('Weight per serving')) {
            const match = nut.match(/(\d+)\s*grams?/i)
            if (match) setWeightPerServing(match[1])
          } else if (nut.includes('Calorie count')) {
            const match = nut.match(/(\d+)\s*Kcal/i)
            if (match) setCalorieCount(match[1])
          } else if (nut.includes('Protein count')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setProteinCount(match[1])
          } else if (nut.includes('Carbohydrates')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setCarbohydrates(match[1])
          } else if (nut.includes('Fat count')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setFatCount(match[1])
          } else if (nut.includes('Fibre count')) {
            const match = nut.match(/(\d+)\s*mg/i)
            if (match) setFibreCount(match[1])
          }
        }
      })
    }

    if (item.allergies && Array.isArray(item.allergies) && item.allergies.length > 0) {
      setAllergens(item.allergies.join(", "))
    }
  }

  // Fetch food item by id when editing
  useEffect(() => {
    const fetchItemData = async () => {
      if (location.state?.item) {
        populateFormFromItem(location.state.item)
      }

      if (!isNewItem && id) {
        try {
          setLoadingItem(true)
          const response = await adminAPI.getFoodById(id)
          const foundItem =
            response?.data?.data?.food ||
            response?.data?.food ||
            null

          if (foundItem) {
            populateFormFromItem(foundItem)
          } else {
            toast.error("Item not found")
          }
        } catch (error) {
          debugError('Error fetching item data:', error)
          toast.error(error?.response?.data?.message || "Failed to load item data")
        } finally {
          setLoadingItem(false)
        }
      }
    }

    fetchItemData()
  }, [id, isNewItem, location.state, defaultCategory])

  // Fetch categories for the selected restaurant (same list as restaurant add-item flow)
  useEffect(() => {
    const fetchCategories = async () => {
      if (!restaurantId) {
        setCategories([])
        setLoadingCategories(false)
        return
      }

      try {
        setLoadingCategories(true)
        const response = await adminAPI.getRestaurantCategoriesForMenu(restaurantId)
        if (response.data.success && response.data.data.categories) {
          const formattedCategories = response.data.data.categories.map(cat => ({
            id: cat._id || cat.id,
            name: cat.name,
            foodTypeScope: cat.foodTypeScope || "Veg",
            isGlobal: Boolean(cat.isGlobal),
            liveStatus:
              cat.isActive === false
                ? "INACTIVE"
                : String(cat.approvalStatus || "").toLowerCase() === "pending"
                  ? "PENDING"
                  : "ACTIVE",
          }))

          debugLog('Formatted restaurant categories:', formattedCategories)
          setCategories(formattedCategories)
          if (!selectedCategoryId && formattedCategories.length > 0 && isNewItem) {
            const preferredName = String(category || defaultCategory || "").trim()
            const matchedByName = formattedCategories.find((cat) => cat.name === preferredName)
            const nextCategory = matchedByName || formattedCategories[0]
            if (nextCategory) {
              setSelectedCategoryId(nextCategory.id)
              setCategory(nextCategory.name)
            }
          }
        } else {
          setCategories([])
        }
      } catch (error) {
        debugError('Error fetching restaurant categories:', error)
        setCategories([])
      } finally {
        setLoadingCategories(false)
      }
    }

    fetchCategories()
  }, [defaultCategory, isNewItem, categoriesRefreshKey, restaurantId])

  useEffect(() => {
    const fetchSlotTimings = async () => {
      if (!restaurantId) {
        setSlotTimings([])
        setItemSlotTimingId("")
        return
      }

      try {
        const response = await adminAPI.getRestaurantItemSlotTimings(restaurantId)
        const slots = response?.data?.data?.slots || response?.data?.slots || []
        const normalized = Array.isArray(slots) ? slots : []
        setSlotTimings(normalized)
        setItemSlotTimingId((prev) => {
          if (!prev) return prev
          const stillValid = normalized.some((slot) => String(slot.id) === String(prev))
          return stillValid ? prev : ""
        })
      } catch {
        setSlotTimings([])
        setItemSlotTimingId("")
      }
    }
    fetchSlotTimings()
  }, [restaurantId])

  // Keep focused form fields visible above mobile keyboard
  useEffect(() => {
    const ensureFieldVisible = (target) => {
      if (!target) return
      const isFormField = target.matches?.('input, textarea, select, [contenteditable="true"]')
      if (!isFormField) return

      window.setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
      }, 120)
    }

    const handleFocusIn = (event) => {
      ensureFieldVisible(event.target)
    }

    document.addEventListener("focusin", handleFocusIn, true)
    return () => {
      document.removeEventListener("focusin", handleFocusIn, true)
    }
  }, [])

  // Fetch selected restaurant profile (pure veg, etc.)
  useEffect(() => {
    let isMounted = true
    const fetchRestaurantProfile = async () => {
      if (!restaurantId) {
        if (isMounted) setIsPureVegRestaurant(false)
        return
      }

      try {
        const response = await adminAPI.getRestaurantById(restaurantId)
        const profile =
          response?.data?.data?.restaurant ||
          response?.data?.restaurant ||
          response?.data?.data ||
          null
        if (!isMounted) return
        const pureVeg = profile?.pureVegRestaurant === true
        setIsPureVegRestaurant(pureVeg)
        if (pureVeg) {
          setFoodType("Veg")
        }
      } catch (error) {
        debugWarn("Failed to load restaurant profile:", error)
        if (isMounted) setIsPureVegRestaurant(false)
      }
    }

    fetchRestaurantProfile()
    return () => {
      isMounted = false
    }
  }, [restaurantId])

  // Track virtual keyboard height and push footer above keyboard
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const updateKeyboardInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 60 ? inset : 0)
    }

    viewport.addEventListener("resize", updateKeyboardInset)
    viewport.addEventListener("scroll", updateKeyboardInset)
    updateKeyboardInset()

    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset)
      viewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [])

  // Serves info options
  const servesOptions = [
    "Serves eg. 1-2 people",
    "Serves eg. 2-3 people",
    "Serves eg. 3-4 people",
    "Serves eg. 4-5 people",
    "Serves eg. 5-6 people",
  ]

  // Item size unit options
  const itemSizeUnits = [
    "slices",
    "kg",
    "litre",
    "ml",
    "serves",
    "cms",
    "piece"
  ]

  // Item tags organized by categories
  const itemTagsCategories = [
    {
      category: "Speciality",
      tags: ["Freshly Frosted", "Pre Frosted", "Chef's Special"]
    },
    {
      category: "Spice Level",
      tags: ["Medium Spicy", "Very Spicy"]
    },
    {
      category: "Miscellaneous",
      tags: ["Gluten Free", "Sugar Free", "Jain"]
    },
    {
      category: "Dietary Restrictions",
      tags: ["Vegan"]
    }
  ]

  const handleSelectLibraryImage = (selectedMedia) => {
    if (images.includes(selectedMedia.url)) {
      toast.error("This image is already added");
      setIsLibraryOpen(false);
      return;
    }
    setImages((prev) => [...prev, selectedMedia.url]);
    setIsLibraryOpen(false);
    toast.success("Image selected from library");
  };

  const handleSelectSuggestedImage = (url) => {
    if (images.includes(url)) {
      toast.error("This image is already added");
      return;
    }
    setImages((prev) => [...prev, url]);
    toast.success("Image selected from suggestions");
  };

  const handleImageAdd = (file) => {
    if (!file) return

    const reader = new FileReader()
    reader.addEventListener("load", () => {
      setImageToCrop(reader.result)
      setIsCropping(true)
    })
    reader.readAsDataURL(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleCropSave = async () => {
    try {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels)

      // Multiple-image mode: append the cropped preview URL
      const previewUrl = URL.createObjectURL(croppedImage)

      setImageFiles((prev) => {
        const next = new Map(prev)
        next.set(previewUrl, croppedImage)
        return next
      })

      setImages((prev) => {
        const next = [...prev, previewUrl]
        setCurrentImageIndex(next.length - 1)
        return next
      })

      setIsCropping(false)
      setImageToCrop(null)
    } catch (e) {
      debugError('Error cropping image:', e)
      toast.error('Failed to crop image')
    }
  }

  // Helper to create cropped image
  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = new Image()
    image.src = imageSrc
    await new Promise((resolve) => (image.onload = resolve))

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, "image/jpeg")
    })
  }

  const handleCameraClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleImageDelete = (index) => {
    if (index < 0 || index >= images.length) return

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return
    }

    const imageToDelete = images[index]
    const newImages = images.filter((_, i) => i !== index)
    const newImageFilesMap = new Map(imageFiles)

    // Remove the file mapping and revoke the blob URL if it's a preview (new upload)
    if (imageToDelete && imageToDelete.startsWith('blob:')) {
      newImageFilesMap.delete(imageToDelete)
      URL.revokeObjectURL(imageToDelete)
      debugLog('Deleted preview image (blob URL):', imageToDelete)
    } else if (imageToDelete && (imageToDelete.startsWith('http://') || imageToDelete.startsWith('https://'))) {
      // For already uploaded images, we need to remove from imageFiles map if it exists
      // Find and remove the file entry if it exists
      for (const [previewUrl, file] of newImageFilesMap.entries()) {
        // This shouldn't happen for HTTP URLs, but just in case
        if (previewUrl === imageToDelete) {
          newImageFilesMap.delete(previewUrl)
          URL.revokeObjectURL(previewUrl)
        }
      }
      debugLog('Deleted uploaded image (HTTP URL):', imageToDelete)
    }

    setImages(newImages)
    setImageFiles(newImageFilesMap)

    // Adjust current image index after deletion
    if (newImages.length === 0) {
      setCurrentImageIndex(0)
    } else if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(newImages.length - 1)
    } else if (currentImageIndex > index) {
      // If we deleted an image before the current one, no need to change index
      // If we deleted the current one or after, index stays the same (shows next image)
    }

    toast.success('Image deleted successfully')
    debugLog(`Image deleted. Remaining images: ${newImages.length}`)
  }

  // Swipe handlers
  const minSwipeDistance = 50

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe && images.length > 0) {
      setDirection(1)
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }
    if (isRightSwipe && images.length > 0) {
      setDirection(-1)
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
    }
  }

  const goToNext = () => {
    setDirection(1)
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const goToPrevious = () => {
    setDirection(-1)
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleRestaurantChange = (nextRestaurantId) => {
    setRestaurantId(nextRestaurantId)
    setSelectedCategoryId("")
    setCategory("Select category")
    setItemSlotTimingId("")
    setCategoryLiveStatus(null)
    setCategories([])
    setSlotTimings([])
  }

  const handleCategorySelect = (catId, subCat) => {
    const selectedCategory = selectableCategories.find(c => c.id === catId)
    setSelectedCategoryId(selectedCategory?.id || "")
    setCategory(selectedCategory?.name || "")
    setSubCategory(subCat)
    if (!canSelectNonVegFoodType({
      pureVegRestaurant: isPureVegRestaurant,
      categoryFoodTypeScope: selectedCategory?.foodTypeScope,
    })) {
      setFoodType("Veg")
    }
    setIsCategoryPopupOpen(false)
  }

  const handleServesSelect = (option) => {
    setServesInfo(option)
    setIsServesPopupOpen(false)
  }

  const handleItemSizeUnitSelect = (unit) => {
    setItemSizeUnit(unit)
    setIsItemSizePopupOpen(false)
  }

  const handleGstSelect = (gstValue) => {
    setGst(gstValue)
    setIsGstPopupOpen(false)
  }

  const handleTagToggle = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const validateItemFormBeforeUpload = () => {
    if (isNewItem && !variantChoiceMade) {
      return { message: "Please choose whether this item has variants" }
    }

    if (images.length === 0) {
      return { message: "Please add at least one image" }
    }

    if (!itemName.trim()) {
      return { message: "Please enter an item name" }
    }

    const matchedCategory =
      selectedCategory ||
      (categoryLiveStatus && String(categoryLiveStatus.id) === String(selectedCategoryId || "")
        ? {
          id: categoryLiveStatus.id,
          name: categoryLiveStatus.name,
          foodTypeScope: categoryLiveStatus.foodTypeScope || "Veg",
        }
        : null)
    const categoryId = String(selectedCategoryId || matchedCategory?.id || "").trim()
    if (!isRealCategoryId(categoryId)) {
      return { message: "Please select an approved category first", openCategoryPopup: true }
    }

    if (isCategoryInactive) {
      return { message: INACTIVE_CATEGORY_WARNING }
    }

    if (isCategoryPending) {
      return { message: PENDING_CATEGORY_WARNING }
    }

    if (!matchedCategory?.id) {
      return { message: "Please select an approved category first", openCategoryPopup: true }
    }

    if (!categoryAcceptsFoodType(matchedCategory?.foodTypeScope, foodType)) {
      return {
        message: `This ${matchedCategory.foodTypeScope} category cannot accept ${foodType} food`,
      }
    }

    const trimmedDescription = itemDescription.trim()
    if (trimmedDescription.length > 0 && trimmedDescription.length < minDescriptionLength) {
      return { message: "Item description must be at least 5 characters" }
    }

    const normalizedVariants = itemHasVariants
      ? variants
        .map((variant) => ({
          persistedId: String(variant.persistedId || "").trim(),
          name: String(variant.name || "").trim(),
          unit: normalizeFoodVariantUnit(variant.unit),
          price: Number(variant.price),
          otherPrice: Number(variant.otherPrice) || 0,
        }))
        .filter((variant) => variant.name || variant.persistedId || variant.price)
      : []

    if (itemHasVariants) {
      if (normalizedVariants.length === 0) {
        return { message: "Please add at least one variant" }
      }
      if (normalizedVariants.some((variant) => !variant.name)) {
        return { message: "Each variant must have a name" }
      }
      if (normalizedVariants.some((variant) => !Number.isFinite(variant.price) || variant.price <= 0)) {
        return { message: "Each variant price must be greater than 0" }
      }
    }

    const hasVariants = normalizedVariants.length > 0
    const parsedBasePrice = Number(basePrice)
    if (!itemHasVariants && (!Number.isFinite(parsedBasePrice) || parsedBasePrice <= 0)) {
      return { message: "Please enter a valid base price" }
    }

    return {
      matchedCategory,
      categoryId,
      normalizedVariants,
      hasVariants,
      parsedBasePrice,
    }
  }

  const handleSave = async () => {
    if (!restaurantId) {
      toast.error("Please select a restaurant")
      return
    }

    const validation = validateItemFormBeforeUpload()
    if (validation.message) {
      toast.error(validation.message)
      if (validation.openCategoryPopup) {
        setIsCategoryPopupOpen(true)
      }
      return
    }

    const {
      matchedCategory,
      categoryId,
      normalizedVariants,
      hasVariants,
      parsedBasePrice,
    } = validation
    const categoryName = matchedCategory?.name || category || ""
    const variantPayload = normalizedVariants.map((variant) => ({
      ...(variant.persistedId ? { _id: variant.persistedId } : {}),
      name: variant.name,
      unit: variant.unit,
      price: variant.price,
      otherPrice: Number(variant.otherPrice) || 0,
    }))

    try {
      setUploadingImages(true)

      // Upload new images to Cloudinary
      const uploadedImageUrls = []

      // Separate existing URLs (already uploaded) from new files (blob URLs)
      const existingImageUrls = images.filter(img =>
        typeof img === 'string' &&
        (img.startsWith('http://') || img.startsWith('https://')) &&
        !img.startsWith('blob:')
      )

      debugLog('Images state:', images)
      debugLog('Existing image URLs (already uploaded):', existingImageUrls)
      debugLog('Image files map:', imageFiles)

      // Upload new File objects to Cloudinary (files that are blob URLs)
      const filesToUpload = []
      images.forEach(img => {
        if (img && img.startsWith('blob:') && imageFiles.has(img)) {
          filesToUpload.push(imageFiles.get(img))
        }
      })
      debugLog('Files to upload:', filesToUpload.length, filesToUpload)

      if (filesToUpload.length > 0) {
        toast.info(`Uploading ${filesToUpload.length} image(s)...`)
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i]
          try {
            debugLog(`Uploading image ${i + 1}/${filesToUpload.length}:`, file.name)
            let uploadResponse
            try {
              uploadResponse = await uploadAPI.uploadMedia(file, {
                folder: 'appzeto/restaurant/menu-items'
              })
            } catch (folderUploadError) {
              // Fallback: retry without folder in case provider/account rejects custom folder.
              debugWarn(`Retrying upload without folder for ${file.name}:`, folderUploadError)
              uploadResponse = await uploadAPI.uploadMedia(file)
            }
            const imageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.url
            if (imageUrl) {
              uploadedImageUrls.push(imageUrl)
              debugLog(`Successfully uploaded image ${i + 1}:`, imageUrl)
            } else {
              debugError('Upload response:', uploadResponse)
              throw new Error("Failed to get uploaded image URL")
            }
          } catch (uploadError) {
            debugError(`Error uploading image ${i + 1} (${file.name}):`, uploadError)
            toast.error(getUploadErrorMessage(uploadError, file.name))
            setUploadingImages(false)
            return
          }
        }
      }

      // Multiple-image mode: keep all URLs
      const allImageUrls = [
        ...existingImageUrls,
        ...uploadedImageUrls
      ].filter((url, index, self) =>
        url &&
        typeof url === 'string' &&
        url.trim() !== '' &&
        self.indexOf(url) === index
      )

      // Debug: Log image URLs
      debugLog('=== IMAGE UPLOAD SUMMARY ===')
      debugLog('Existing image URLs:', existingImageUrls.length, existingImageUrls)
      debugLog('Newly uploaded URLs:', uploadedImageUrls.length, uploadedImageUrls)
      debugLog('Total image URLs to save:', allImageUrls.length, allImageUrls)
      debugLog('==========================')

      // Create/update FoodItem in DB (single call per explicit Save; no autosave spam)
      let itemId
      if (isNewItem) {
        const createRes = await adminAPI.createFood({
          restaurantId,
          name: itemName.trim(),
          description: itemDescription.trim(),
          price: hasVariants ? 0 : parsedBasePrice,
          otherPrice: hasVariants ? 0 : Number(otherPrice) || 0,
          variants: variantPayload,
          image: allImageUrls.length > 0 ? allImageUrls[0] : "",
          images: allImageUrls,
          foodType: foodType,
          isAvailable: isInStock,
          preparationTime: preparationTime || "",
          itemSlotTimingId: itemSlotTimingId || null,
          categoryId: categoryId || undefined,
          categoryName,
        })
        const created = createRes?.data?.data?.food || createRes?.data?.food
        itemId = String(created?._id || created?.id || "")
        if (!itemId) {
          throw new Error("Failed to create item in database")
        }
      } else {
        itemId = String(itemData?.id || id || "")
        if (!itemId) {
          throw new Error("Invalid item id")
        }
        await adminAPI.updateFood(itemId, {
          restaurantId,
          name: itemName.trim(),
          description: itemDescription.trim(),
          price: hasVariants ? 0 : parsedBasePrice,
          otherPrice: hasVariants ? 0 : Number(otherPrice) || 0,
          variants: variantPayload,
          image: allImageUrls.length > 0 ? allImageUrls[0] : "",
          images: allImageUrls,
          foodType: foodType,
          isAvailable: isInStock,
          preparationTime: preparationTime || "",
          itemSlotTimingId: itemSlotTimingId || null,
          categoryId: categoryId || undefined,
          categoryName,
        })
      }

      try {
        const nextRecommendedMap = (() => {
          if (typeof window === "undefined") return null
          const raw = window.localStorage.getItem(INVENTORY_RECOMMENDED_KEY)
          const parsed = raw ? JSON.parse(raw) : {}
          const safeMap = parsed && typeof parsed === "object" ? parsed : {}
          return {
            ...safeMap,
            [String(itemId)]: Boolean(isRecommended),
          }
        })()

        if (nextRecommendedMap && typeof window !== "undefined") {
          window.localStorage.setItem(
            INVENTORY_RECOMMENDED_KEY,
            JSON.stringify(nextRecommendedMap),
          )
        }
      } catch (recommendedError) {
        debugWarn("Failed to persist recommended state after save:", recommendedError)
      }

      const imageCount = allImageUrls.length
      toast.success(
        isNewItem
          ? `Item created successfully with ${imageCount} image(s)`
          : `Item updated and sent for approval again with ${imageCount} image(s)`
      )
      await new Promise((resolve) => setTimeout(resolve, 200))
      navigate("/ecs/food/foods", { replace: true })
      window.dispatchEvent(new CustomEvent('foodsChanged'))
    } catch (error) {
      debugError('Error saving menu:', error)
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network error. Please check if backend server is running and try again.')
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to save item. Please try again.")
      }
    } finally {
      setUploadingImages(false)
    }
  }

  const handleVariantChoice = (hasVariants) => {
    setVariantChoiceMade(true)
    setItemHasVariants(hasVariants)
    if (hasVariants) {
      setBasePrice("")
      setOtherPrice("")
      setVariants((prev) => (prev.length > 0 ? prev : [createVariantDraft()]))
    } else {
      setVariants([])
    }
  }

  const handleVariantChange = (localId, field, value) => {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.localId === localId ? { ...variant, [field]: value } : variant,
      ),
    )
  }

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, createVariantDraft()])
  }

  const handleRemoveVariant = (localId) => {
    setVariants((prev) => prev.filter((variant) => variant.localId !== localId))
  }

  const handleDelete = () => {
    // Delete logic here
    debugLog("Deleting item:", id)
    goBack()
  }

  const handleOpenCreateCategory = () => {
    setIsCreateCategoryModalOpen(true)
  }

  const handleCategoryCreated = (createdCategory) => {
    setCategoriesRefreshKey((key) => key + 1)
    const createdId = String(createdCategory?._id || createdCategory?.id || "").trim()
    const createdName = String(createdCategory?.name || "").trim()
    if (createdId && createdName) {
      setSelectedCategoryId(createdId)
      setCategory(createdName)
      setCategoryLiveStatus({
        id: createdId,
        name: createdName,
        isActive: createdCategory?.isActive !== false,
        approvalStatus: createdCategory?.approvalStatus || "pending",
        foodTypeScope: createdCategory?.foodTypeScope || "Veg",
      })
      if (String(createdCategory?.approvalStatus || "pending").toLowerCase() !== "approved") {
        toast.info(PENDING_CATEGORY_WARNING)
      }
      if (!canSelectNonVegFoodType({
        pureVegRestaurant: isPureVegRestaurant,
        categoryFoodTypeScope: createdCategory?.foodTypeScope,
      })) {
        setFoodType("Veg")
      }
    }
  }

  if (loadingItem) {
    return (
      <div className="h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-gray-950" />
        <p className="text-sm font-medium text-gray-500 mt-3 animate-pulse">Loading item details...</p>
      </div>
    )
  }

  const categoryPickerHeader = (
    <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 lg:px-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Select category</h2>
        <p className="mt-0.5 text-xs text-gray-500">Diet scope and whether the category is global or local</p>
      </div>
      <div className="flex items-center gap-2">

        <button
          onClick={() => setIsCategoryPopupOpen(false)}
          className="p-1 rounded-full hover:bg-gray-100"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  )

  const categoryPickerBody = (
    <div className="flex-1 overflow-y-auto p-2 lg:max-h-[50vh]">
      {loadingCategories ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
        </div>
      ) : selectableCategories.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-sm text-gray-500">No categories available</p>
          <button
            onClick={handleOpenCreateCategory}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Category
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-2">
          {selectableCategories.map((cat) => {
            const isSelected = String(selectedCategoryId || "") === String(cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id, cat.name)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${isSelected
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium truncate">{cat.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${scopePillClass(cat.foodTypeScope, isSelected)}`}>
                      {scopePillLabel(cat.foodTypeScope)}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${globalPillClass(cat.isGlobal, isSelected)}`}>
                      {cat.isGlobal ? (
                        <>
                          <Globe className="mr-1 h-3 w-3" />
                          Global
                        </>
                      ) : (
                        "Local"
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-white shrink-0" />}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden lg:bg-slate-50">
      <style>{`
        [data-slot="switch"][data-state="checked"] {
          background-color: #16a34a !important;
        }
        [data-slot="switch-thumb"][data-state="checked"] {
          background-color: #ffffff !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 flex-shrink-0 lg:border-slate-200">
        <div className="px-4 py-3 flex items-center gap-3 lg:max-w-6xl lg:mx-auto lg:px-6 lg:py-4">
          <button
            onClick={goBack}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 lg:text-2xl">
              {isNewItem ? "Add menu item" : "Edit menu item"}
            </h1>
            <p className="hidden lg:block text-sm text-slate-500 mt-0.5">
              Fill in item details, pricing, and availability
            </p>
          </div>
        </div>
      </div>


      {/* Content */}
      <div className="flex-1 overflow-y-auto lg:py-6" style={{ paddingBottom: `${96 + keyboardInset}px` }}>
        <div className="lg:max-w-6xl lg:mx-auto lg:px-6">
          {isNewItem && !variantChoiceMade ? (
            <div className="p-4 lg:p-0">
              <div className="lg:bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm lg:p-8">
                <div className="max-w-lg mx-auto py-8 lg:py-12 text-center">
                  <h2 className="text-xl font-bold text-gray-900 lg:text-2xl">
                    Does this item have variants?
                  </h2>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                    Choose Yes if this item comes in sizes or portions like Half, Full, Small, or Large.
                    Choose No for a single fixed price.
                  </p>
                  <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => handleVariantChoice(false)}
                      className="flex-1 sm:flex-none sm:min-w-[140px] px-6 py-3.5 rounded-xl text-sm font-semibold border-2 border-gray-200 bg-white text-gray-900 hover:border-gray-900 hover:bg-gray-50 transition-colors"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVariantChoice(true)}
                      className="flex-1 sm:flex-none sm:min-w-[140px] px-6 py-3.5 rounded-xl text-sm font-semibold border-2 border-[#FF0000] bg-[#FF0000] text-white hover:bg-[#E64D02] transition-colors"
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="lg:grid lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] lg:gap-8 lg:items-start">
              <div className="lg:sticky lg:top-24">
                {!isNewItem && currentApprovalStatus === "rejected" && currentRejectionReason ? (
                  <div className="px-4 pt-4 lg:px-0">
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-semibold text-red-700">Approval rejected</p>
                      <p className="mt-1 text-sm leading-5 text-red-600">Reason: {currentRejectionReason}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.18em] text-red-500">
                        Update the dish and save to send it for approval again
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Image Carousel */}
                <div className="relative bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm lg:overflow-hidden">
                  {images.length > 0 ? (
                    <div className="relative w-full h-80 lg:h-72 overflow-hidden bg-gray-100">
                      {/* Image container with swipe support */}
                      <div
                        ref={carouselRef}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        className="relative w-full h-full"
                      >
                        <AnimatePresence mode="wait" custom={direction}>
                          <motion.div
                            key={currentImageIndex}
                            custom={direction}
                            initial={{ opacity: 0, x: direction > 0 ? 300 : -300 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction > 0 ? -300 : 300 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="absolute inset-0"
                          >
                            {images[currentImageIndex] ? (
                              <img
                                src={images[currentImageIndex]}
                                alt={`${itemName} - Image ${currentImageIndex + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </motion.div>
                        </AnimatePresence>

                        {/* Navigation arrows */}
                        {images.length > 1 && (
                          <>
                            <button
                              onClick={goToPrevious}
                              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10"
                            >
                              <ChevronLeft className="w-5 h-5 text-gray-900" />
                            </button>
                            <button
                              onClick={goToNext}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10"
                            >
                              <ChevronRight className="w-5 h-5 text-gray-900" />
                            </button>
                          </>
                        )}

                        {/* Delete image button */}
                        <button
                          onClick={() => handleImageDelete(currentImageIndex)}
                          className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10"
                        >
                          <Trash2 className="w-5 h-5 text-gray-900" />
                        </button>

                        {/* Image counter */}
                        {images.length > 1 && (
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full z-10">
                            <span className="text-white text-xs font-medium">
                              {currentImageIndex + 1} / {images.length}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Carousel dots */}
                      {images.length > 1 && (
                        <div className="flex items-center justify-center gap-2 py-4 bg-white">
                          {images.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setDirection(index > currentImageIndex ? 1 : -1)
                                setCurrentImageIndex(index)
                              }}
                              className={`transition-all duration-300 rounded-full ${index === currentImageIndex
                                ? "w-8 h-2 bg-gray-900"
                                : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                                }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full h-80 lg:h-72 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <Camera className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">No images added yet</p>
                        <p className="text-xs text-gray-500 mt-1">Tap the button below to add images</p>
                      </div>
                    </div>
                  )}

                  {/* Add image button - redesigned */}
                  <div className="px-4 py-4 bg-white border-t border-gray-100 lg:px-5 lg:py-5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageAdd(e.target.files?.[0])}
                      className="hidden"
                    />
                    <button
                      onClick={handleCameraClick}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#FF0000] hover:bg-[#E64D02] text-white rounded-xl text-sm font-semibold cursor-pointer transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                      <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                      <span>Add Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLibraryOpen(true)}
                      className="w-full mt-3 flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-xl text-sm font-semibold cursor-pointer transition-all shadow-sm active:scale-95"
                    >
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-gray-600" />
                      </div>
                      <span>Choose from Library</span>
                    </button>
                  </div>
                </div>

                {/* Suggested Images Section */}
                {(loadingSuggestions || (suggestedImages && suggestedImages.length > 0)) && (
                  <div className="px-4 py-3 bg-white border-t border-b border-gray-100 flex flex-col gap-2 lg:mt-4 lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm lg:px-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Suggested Images
                      </span>
                      {loadingSuggestions && (
                        <span className="text-[11px] text-gray-400 animate-pulse">
                          Finding matching images...
                        </span>
                      )}
                    </div>
                    {!loadingSuggestions && suggestedImages && suggestedImages.length > 0 && (
                      <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                        {suggestedImages.slice(0, 6).map((item) => (
                          <button
                            key={item._id}
                            type="button"
                            onClick={() => handleSelectSuggestedImage(item.url)}
                            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-400 active:scale-95 transition-all focus:outline-none"
                          >
                            <img
                              src={item.thumbnailUrl || item.url}
                              alt="Suggested food template"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="p-4 space-y-3 lg:p-0 lg:space-y-5">
                <div className="lg:bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm lg:p-6 lg:space-y-5">
                  {/* Restaurant Selector */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
                    <label className="block text-sm font-medium text-gray-900 mb-2">Restaurant</label>
                    <select
                      value={restaurantId}
                      onChange={(e) => handleRestaurantChange(e.target.value)}
                      disabled={!isNewItem}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-transparent"
                    >
                      <option value="">Select a restaurant</option>
                      {restaurants.map((restaurant) => {
                        const val = String(restaurant._id || restaurant.id || restaurant.restaurantId || "");
                        return (
                          <option key={val} value={val}>
                            {restaurant.restaurantName || restaurant.name}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {/* Variant type (shown after choice; editable on edit) */}
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Item type</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {itemHasVariants
                            ? "This item has variants — pricing is set per variant only."
                            : "This item has a single price — no variants."}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleVariantChoice(false)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!itemHasVariants
                              ? "border-gray-900 border-2 text-gray-900 bg-white"
                              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                            }`}
                        >
                          {!itemHasVariants && <Check className="w-3.5 h-3.5" />}
                          <span>No variants</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVariantChoice(true)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${itemHasVariants
                              ? "border-gray-900 border-2 text-gray-900 bg-white"
                              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                            }`}
                        >
                          {itemHasVariants && <Check className="w-3.5 h-3.5" />}
                          <span>Has variants</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!restaurantId) {
                          toast.error("Please select a restaurant first")
                          return
                        }
                        setIsCategoryPopupOpen(true)
                      }}
                      disabled={!restaurantId}
                      className={`w-full px-4 py-3 border border-gray-300 rounded-xl text-left flex items-center justify-between gap-3 bg-white transition-colors ${restaurantId ? "hover:bg-gray-50" : "opacity-60 cursor-not-allowed"}`}
                    >
                      {(() => {
                        const selected = selectedCategory
                        if (!selected) {
                          return (
                            <>
                              <span className="text-sm text-gray-500">
                                {!restaurantId ? "Select restaurant first" : "Select category"}
                              </span>
                              <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                            </>
                          )
                        }
                        return (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 truncate">{selected.name}</span>
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${scopePillClass(selected.foodTypeScope)}`}>
                                  {scopePillLabel(selected.foodTypeScope)}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${globalPillClass(selected.isGlobal)}`}>
                                  {selected.isGlobal ? (
                                    <>
                                      <Globe className="mr-1 h-3 w-3" />
                                      Global
                                    </>
                                  ) : (
                                    "Local"
                                  )}
                                </span>
                              </div>
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                          </>
                        )
                      })()}
                    </button>
                    {isCategoryInactive && (
                      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        {INACTIVE_CATEGORY_WARNING}
                      </div>
                    )}
                    {!isCategoryInactive && isCategoryPending && (
                      <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        {PENDING_CATEGORY_WARNING}
                      </div>
                    )}
                  </div>

                  {/* Item Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Item name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        maxLength={maxNameLength}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter item name"
                      />
                      <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
                        <EditIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="text-right mt-1">
                      <span className="text-xs text-gray-500">
                        {nameLength} / {maxNameLength}
                      </span>
                    </div>
                  </div>


                  {/* Item Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Item description
                    </label>
                    <div className="relative">
                      <textarea
                        value={itemDescription}
                        onChange={(e) => setItemDescription(e.target.value)}
                        maxLength={maxDescriptionLength}
                        rows={4}
                        placeholder="Eg: Yummy veg paneer burger with a soft patty, veggies, cheese, and special sauce"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <button className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100">
                        <EditIcon className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-xs ${descriptionLength < minDescriptionLength ? "text-red-500" : "text-gray-500"}`}>
                        {descriptionLength < minDescriptionLength ? "Min 5 characters required" : ""}
                      </span>
                      <span className="text-xs text-gray-500">
                        {descriptionLength} / {maxDescriptionLength}
                      </span>
                    </div>
                    {/* Dietary Options */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setFoodType("Veg")}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Veg"
                          ? "border-green-600 border-2 text-green-600"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                      >
                        {foodType === "Veg" && <Check className="w-4 h-4" />}
                        <span>Veg</span>
                      </button>
                      {!showNonVegFoodType ? null : (
                        <button
                          onClick={() => setFoodType("Non-Veg")}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Non-Veg"
                            ? "border-red-600 border-2 text-red-600"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                          {foodType === "Non-Veg" && <Check className="w-4 h-4" />}
                          <span>Non-Veg</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      {itemHasVariants ? "Variants" : "Item price"}
                    </label>
                    <div className="space-y-3">
                      {!itemHasVariants ? (
                        <div className="space-y-3">
                          <div className="relative">
                            <label className="block text-xs text-gray-600 mb-1">Base price</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={basePrice}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[\u20B9\s,]/g, '').replace(/[^0-9.]/g, '')
                                  const parts = value.split('.')
                                  const cleanedValue = parts.length > 2
                                    ? parts[0] + '.' + parts.slice(1).join('')
                                    : value
                                  setBasePrice(cleanedValue)
                                }}
                                onFocus={(e) => {
                                  if (e.target.value.startsWith('\u20B9')) {
                                    e.target.value = e.target.value.replace(/[\u20B9\s]+/g, '')
                                  }
                                }}
                                placeholder="Enter price"
                                className="w-full pl-8 pr-12 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">{"\u20B9"}</span>
                              <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
                                <EditIcon className="w-4 h-4 text-gray-500" />
                              </button>
                            </div>
                          </div>

                          <div className="relative">
                            <label className="block text-xs text-gray-600 mb-1">Other platform price (Optional)</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={otherPrice}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[\u20B9\s,]/g, '').replace(/[^0-9.]/g, '')
                                  const parts = value.split('.')
                                  const cleanedValue = parts.length > 2
                                    ? parts[0] + '.' + parts.slice(1).join('')
                                    : value
                                  setOtherPrice(cleanedValue)
                                }}
                                placeholder="Enter other platform price"
                                className="w-full pl-8 pr-12 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">{"\u20B9"}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                            Customers will see the lowest variant price on the menu.
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">Variants</p>
                              <p className="text-xs text-gray-500">Add multiple names and prices like Half, Full, Small, Large.</p>
                            </div>
                            <button
                              type="button"
                              onClick={handleAddVariant}
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add variant
                            </button>
                          </div>

                          {variants.length > 0 ? (
                            <div className="space-y-3">
                              {variants.map((variant, index) => (
                                <div key={variant.localId} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 lg:bg-white">
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Variant name</label>
                                      <input
                                        type="text"
                                        value={variant.name}
                                        onChange={(e) => handleVariantChange(variant.localId, "name", e.target.value)}
                                        placeholder={index === 0 ? "Full" : "Half"}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Unit</label>
                                      <select
                                        value={variant.unit || DEFAULT_FOOD_VARIANT_UNIT}
                                        onChange={(e) => handleVariantChange(variant.localId, "unit", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      >
                                        {FOOD_VARIANT_UNITS.map((unit) => (
                                          <option key={unit.value} value={unit.value}>
                                            {unit.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Variant price</label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={variant.price}
                                          onChange={(e) => {
                                            const value = e.target.value.replace(/[\u20B9\s,]/g, '').replace(/[^0-9.]/g, '')
                                            const parts = value.split('.')
                                            const cleanedValue = parts.length > 2
                                              ? parts[0] + '.' + parts.slice(1).join('')
                                              : value
                                            handleVariantChange(variant.localId, "price", cleanedValue)
                                          }}
                                          placeholder="Price"
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">{"\u20B9"}</span>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-xs text-gray-600 mb-1">Other price</label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={variant.otherPrice}
                                          onChange={(e) => {
                                            const value = e.target.value.replace(/[\u20B9\s,]/g, '').replace(/[^0-9.]/g, '')
                                            const parts = value.split('.')
                                            const cleanedValue = parts.length > 2
                                              ? parts[0] + '.' + parts.slice(1).join('')
                                              : value
                                            handleVariantChange(variant.localId, "otherPrice", cleanedValue)
                                          }}
                                          placeholder="Other"
                                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">{"\u20B9"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveVariant(variant.localId)}
                                    className="self-start rounded-full p-2 text-gray-500 hover:bg-white hover:text-red-500"
                                    aria-label="Remove variant"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Add at least one variant with name and price.</p>
                          )}
                        </div>
                      )}

                      {/* Availability Slot */}
                      <div className="relative">
                        <label className="block text-xs text-gray-600 mb-1">Availability slot</label>
                        <div className="relative">
                          <select
                            value={itemSlotTimingId}
                            onChange={(e) => setItemSlotTimingId(e.target.value)}
                            className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                          >
                            <option value="">None (Always available)</option>
                            {slotTimings.map((slot) => (
                              <option key={slot.id} value={slot.id}>
                                {slot.name} ({slot.startTime} - {slot.endTime})
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                          {itemSlotTimingId ? (
                            <>
                              This item will only be visible to customers during the selected slot.
                              {selectedAvailabilitySlot ? (
                                <span className="block mt-0.5 font-medium text-gray-600">
                                  {selectedAvailabilitySlot.name} ({selectedAvailabilitySlot.startTime} -{" "}
                                  {selectedAvailabilitySlot.endTime})
                                </span>
                              ) : null}
                            </>
                          ) : (
                            "No slot selected — this item will be visible to customers all the time."
                          )}
                        </p>
                      </div>

                      {/* Preparation Time */}
                      <div className="relative">
                        <label className="block text-xs text-gray-600 mb-1">Preparation Time</label>
                        <div className="relative">
                          <select
                            value={preparationTime}
                            onChange={(e) => setPreparationTime(e.target.value)}
                            className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                          >
                            <option value="">Select timing</option>
                            <option value="10-20 mins">10-20 mins</option>
                            <option value="20-25 mins">20-25 mins</option>
                            <option value="25-35 mins">25-35 mins</option>
                            <option value="35-45 mins">35-45 mins</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
                        </div>
                      </div>
                      {/* <div>
                <label className="block text-xs text-gray-600 mb-1">GST</label>
                <button
                  onClick={() => setIsGstPopupOpen(true)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-900">GST {gst}%</span>
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                </button>
              </div> */}
                    </div>

                  </div>

                  {/* Recommend and In Stock */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-200">
                    <button
                      onClick={() => setIsRecommended(!isRecommended)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isRecommended
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>Recommend</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isInStock}
                        onCheckedChange={setIsInStock}
                        className="data-[state=unchecked]:bg-gray-300"
                      />
                      <span className="text-sm text-gray-700">In stock</span>
                    </div>
                  </div>


                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Category Selection Popup */}
      <AnimatePresence>
        {isCategoryPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            {/* Mobile bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col lg:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {categoryPickerHeader}
              {categoryPickerBody}
            </motion.div>
            {/* Desktop centered dialog */}
            <div className="fixed inset-0 z-50 hidden lg:flex items-center justify-center p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="pointer-events-auto w-full max-w-md max-h-[70vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {categoryPickerHeader}
                {categoryPickerBody}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>


      {/* GST Popup */}
      {/* <AnimatePresence>
        {isGstPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGstPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[60vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Select GST</h2>
                <button
                  onClick={() => setIsGstPopupOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-2">
                  {gstOptions.map((gstValue) => (
                    <button
                      key={gstValue}
                      onClick={() => handleGstSelect(gstValue)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        gst === gstValue
                          ? "bg-gray-900 text-white"
                          : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {gstValue}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence> */}


      {/* Bottom Sticky Buttons */}
      {(!isNewItem || variantChoiceMade) && (
        <div
          className="fixed left-0 right-0 bg-white border-t border-gray-200 z-40 lg:border-slate-200 lg:bg-white/95 lg:backdrop-blur"
          style={{ bottom: `${keyboardInset}px` }}
        >
          <div className={`flex gap-3 px-4 py-4 lg:max-w-6xl lg:mx-auto lg:px-6 ${isNewItem ? "justify-end" : ""}`}>
            {!isNewItem && (
              <button
                onClick={handleDelete}
                className="flex-1 py-3 px-4 border border-black rounded-lg text-sm font-semibold text-black bg-white hover:bg-gray-50 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={uploadingImages || (isNewItem && !variantChoiceMade)}
              className={`${isNewItem ? "w-full lg:w-auto lg:min-w-[220px]" : "flex-1 lg:flex-none lg:min-w-[220px]"} py-3 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${!uploadingImages && !(isNewItem && !variantChoiceMade)
                ? "bg-[#FF0000] text-white hover:bg-[#E64D02]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
            >
              {uploadingImages ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      )}
      {/* Photo Picker */}
      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleImageAdd}
        title="Item Image"
        description="Choose how to upload your item image"
        fileNamePrefix="item-photo"
        galleryInputRef={fileInputRef}
      />
      <ReusableImageLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelect={handleSelectLibraryImage}
        initialCategory={category}
      />

      <CreateCategoryModal
        isOpen={isCreateCategoryModalOpen}
        onClose={() => setIsCreateCategoryModalOpen(false)}
        onCreated={handleCategoryCreated}
        isPureVegRestaurant={isPureVegRestaurant}
      />

      {/* Crop Modal */}
      <AnimatePresence>
        {isCropping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-black"
          >
            <div className="flex items-center justify-between p-4 bg-black/50 text-white z-10">
              <button onClick={() => setIsCropping(false)} className="p-2">
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-lg font-bold">Crop Image</h2>
              <button onClick={handleCropSave} className="px-4 py-2 bg-white text-black rounded-lg font-bold">
                Done
              </button>
            </div>
            <div className="relative flex-1">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-6 bg-black/50 z-10">
              <div className="flex items-center gap-4">
                <span className="text-white text-sm">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(e.target.value)}
                  className="flex-1 accent-white"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

