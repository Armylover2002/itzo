import { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  Image as ImageIcon, 
  Grid3x3,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Edit,
  Plus,
  Utensils,
  X,
  Menu,
  Camera,
  SlidersHorizontal,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Loader2
} from "lucide-react"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
// Removed foodManagement - now using backend API directly
import { useNavigate } from "react-router-dom"
import { restaurantAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const getUploadErrorMessage = (error, fileName = "image") => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Please try again."
  return `Failed to upload ${fileName}: ${message}`
}

const serializeMenuSections = (sections) =>
  JSON.stringify(Array.isArray(sections) ? sections : [])

export default function HubMenu() {
  const navigate = useNavigate()
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem("restaurant_hub_menu_active_tab")
      if (saved === "all" || saved === "add-ons") {
        return saved
      }
    } catch (error) {
      debugWarn("Failed to load hub menu active tab:", error)
    }
    return "all"
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAvailabilityPopupOpen, setIsAvailabilityPopupOpen] = useState(false)
  const [isCategoryOptionsOpen, setIsCategoryOptionsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(null) // { id, name }
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false)
  const [editCategoryName, setEditCategoryName] = useState("")
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const hasInitializedExpandedGroups = useRef(false)
  const [selectedFilter, setSelectedFilter] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // Active filter for filtering menu
  const [availabilityReason, setAvailabilityReason] = useState(null)
  const [switchingOffTarget, setSwitchingOffTarget] = useState(null) // { type: 'item' | 'group', id: string, groupId?: string }
  const [customDateTime, setCustomDateTime] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)
  const [menuData, setMenuData] = useState([]) // Store menu groups with state
  const menuDataRef = useRef([])
  const lastSyncedMenuRef = useRef(serializeMenuSections([]))
  const hasFetchedMenuRef = useRef(false)
  const scrollContainerRef = useRef(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const mainScrollRef = useRef(null)
  const [isAddSubCategoryOpen, setIsAddSubCategoryOpen] = useState(false)
  const [subCategoryName, setSubCategoryName] = useState("")
  const [selectedGroupForSubCategory, setSelectedGroupForSubCategory] = useState(null) // { id, name }
  const [isAddCategoryPopupOpen, setIsAddCategoryPopupOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [restaurantData, setRestaurantData] = useState(null)
  const [isAddAddonModalOpen, setIsAddAddonModalOpen] = useState(false)
  const [addons, setAddons] = useState([])
  const [loadingAddons, setLoadingAddons] = useState(false)
  
  // Add-on form state
  const [addonName, setAddonName] = useState("")
  const [addonDescription, setAddonDescription] = useState("")
  const [addonPrice, setAddonPrice] = useState("")
  const [addonImages, setAddonImages] = useState([])
  const [addonImageFiles, setAddonImageFiles] = useState(new Map())
  const [uploadingAddonImages, setUploadingAddonImages] = useState(false)
  const [editingAddon, setEditingAddon] = useState(null) // Store addon being edited
  const addonFileInputRef = useRef(null)

  // Restaurant info - fetch from backend
  const restaurantName = restaurantData?.name || ""
  const restaurantExpertise = restaurantData?.cuisines?.length > 0 
    ? restaurantData.cuisines.join(", ") 
    : ""

  // Handle scroll to change title
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY || document.documentElement.scrollTop
      // Change title when scrolled more than 80px for smoother transition
      setIsScrolled(scrollPosition > 80)
    }

    // Initial check
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate filter counts from menu data
  const calculateFilterCounts = useMemo(() => {
    // Get all items from menuData (including subsections)
    const allItems = []
    menuData.forEach(section => {
      if (section.items && Array.isArray(section.items)) {
        allItems.push(...section.items)
      }
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach(subsection => {
          if (subsection.items && Array.isArray(subsection.items)) {
            allItems.push(...subsection.items)
          }
        })
      }
    })

    // Calculate counts for each filter (matching the filtering logic exactly)
    const counts = {
      recommended: allItems.filter(item => item.isRecommended === true).length,
      "out-of-stock": allItems.filter(item => !item.isAvailable).length,
      "no-photos": allItems.filter(item => !item.image || item.photoCount === 0).length,
      "without-description": allItems.filter(item => !item.description || item.description.trim() === "").length,
      "without-serving-info": allItems.filter(item => !item.variations || item.variations.length === 0).length,
      "item-not-live": allItems.filter(item => !item.isAvailable).length,
      "photos-rejected": 0, // This would need a status field in the item model
      "under-review": 0, // This would need a status field in the item model
      goods: 0, // This would need a category type field
      services: 0, // This would need a category type field
    }

    return counts
  }, [menuData])

  // Filter options with dynamic counts
  const filterOptions = useMemo(() => [
    { id: "recommended", label: "Recommended", count: calculateFilterCounts.recommended },
    { id: "out-of-stock", label: "Out of stock", count: calculateFilterCounts["out-of-stock"] },
    { id: "goods", label: "Goods", count: calculateFilterCounts.goods },
    { id: "services", label: "Services", count: calculateFilterCounts.services },
    { id: "item-not-live", label: "Item not live", count: calculateFilterCounts["item-not-live"] },
    { id: "photos-rejected", label: "Photos rejected", count: calculateFilterCounts["photos-rejected"] },
    { id: "no-photos", label: "No photos", count: calculateFilterCounts["no-photos"] },
    { id: "under-review", label: "Under review", count: calculateFilterCounts["under-review"] },
    { id: "without-description", label: "Without description", count: calculateFilterCounts["without-description"] },
    { id: "without-serving-info", label: "Without serving info", count: calculateFilterCounts["without-serving-info"] },
  ], [calculateFilterCounts])

  // Quick filter buttons (horizontally scrollable) - only show filters with count > 0
  const quickFilters = useMemo(() => {
    const filters = [
      { id: "out-of-stock", label: "Out of stock", count: calculateFilterCounts["out-of-stock"] },
      { id: "no-photos", label: "No photos", count: calculateFilterCounts["no-photos"] },
      { id: "recommended", label: "Recommended", count: calculateFilterCounts.recommended },
      { id: "services", label: "Services", count: calculateFilterCounts.services },
      { id: "photos-rejected", label: "Photos Rejected", count: calculateFilterCounts["photos-rejected"] },
    ]
    // Only return filters with count > 0
    return filters.filter(f => f.count > 0)
  }, [calculateFilterCounts])

  // Menu groups are now directly from menuData (fetched from backend)

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const data = response?.data?.data?.restaurant || response?.data?.restaurant
        if (data) {
          setRestaurantData(data)
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
        debugError('Error fetching restaurant data:', error)
        }
        // Continue with default values if fetch fails
      }
    }
    
    fetchRestaurantData()
  }, [])

  useEffect(() => {
    menuDataRef.current = menuData
  }, [menuData])

  // Fetch menu from API - reusable function
  const fetchMenu = async (showLoading = true) => {
    try {
      const currentSerializedMenu = serializeMenuSections(menuDataRef.current)
      const hasUnsavedLocalChanges =
        hasFetchedMenuRef.current && currentSerializedMenu !== lastSyncedMenuRef.current

      // Never let silent/background refresh replace local edits that are not yet synced.
      if (!showLoading && hasUnsavedLocalChanges) {
        debugLog('Skipping background menu refresh because local menu changes are not synced yet')
        return
      }

      if (showLoading) {
        setLoadingMenu(true)
      }
      const response = await restaurantAPI.getMenu()
      
      if (response.data && response.data.success && response.data.data && response.data.data.menu) {
        const menuSections = response.data.data.menu.sections || []
        lastSyncedMenuRef.current = serializeMenuSections(menuSections)
        hasFetchedMenuRef.current = true
        setMenuData(menuSections)
        
        // Menu data is now directly from backend, no need to transform
      } else {
        // Empty menu - start fresh
        lastSyncedMenuRef.current = serializeMenuSections([])
        hasFetchedMenuRef.current = true
        setMenuData([])
      }
    } catch (error) {
      // Only log and show toast if it's not a network/timeout error
      if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
      debugError('Error fetching menu:', error)
        toast.error('Failed to load menu')
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Silently handle network errors - backend is not running
        // The axios interceptor already handles these with proper error messages
      }
    } finally {
      if (showLoading) {
        setLoadingMenu(false)
      }
    }
  }

  // Fetch menu from API on mount
  useEffect(() => {
    fetchMenu()
  }, [])

  // Refresh menu when page comes into focus (e.g., when user switches from admin panel)
  useEffect(() => {
    const handleFocus = () => {
      debugLog('Page focused - refreshing menu to check for approval updates')
      fetchMenu(false) // Refresh without showing loading spinner
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debugLog('Page visible - refreshing menu to check for approval updates')
        fetchMenu(false) // Refresh without showing loading spinner
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Periodic refresh to check for approval updates (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if page is visible and not loading
      if (document.visibilityState === 'visible' && !loadingMenu) {
        debugLog('Periodic refresh - checking for approval updates')
        fetchMenu(false) // Refresh without showing loading spinner
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [loadingMenu])

  // Save menu to API whenever menuData changes (debounced)
  useEffect(() => {
    if (!loadingMenu && hasFetchedMenuRef.current) {
      const serializedCurrentMenu = serializeMenuSections(menuData)
      if (serializedCurrentMenu === lastSyncedMenuRef.current) {
        return
      }

      const timeoutId = setTimeout(async () => {
        try {
          // Normalize menuData before saving to ensure proper structure matching backend schema
          const normalizedSections = menuData.map((section, index) => ({
            id: section.id || `section-${index}`,
            name: section.name || "Unnamed Section",
            items: Array.isArray(section.items) ? section.items.map(item => ({
              id: String(item.id || Date.now() + Math.random()),
              name: item.name || "Unnamed Item",
              nameArabic: item.nameArabic || "",
              image: item.image || "",
              category: item.category || section.name,
              rating: item.rating || 0.0,
              reviews: item.reviews || 0,
              price: item.price || 0,
              stock: item.stock || "Unlimited",
              discount: item.discount || null,
              originalPrice: item.originalPrice || null,
              foodType: item.foodType || "Non-Veg",
              availabilityTimeStart: item.availabilityTimeStart || "12:01 AM",
              availabilityTimeEnd: item.availabilityTimeEnd || "11:57 PM",
              description: item.description || "",
              discountType: item.discountType || "Percent",
              discountAmount: item.discountAmount || 0.0,
              isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
              isRecommended: item.isRecommended || false,
              variations: Array.isArray(item.variations) ? item.variations.map(v => ({
                id: String(v.id || Date.now() + Math.random()),
                name: v.name || "",
                price: v.price || 0,
                stock: v.stock || "Unlimited",
              })) : [],
              tags: Array.isArray(item.tags) ? item.tags : [],
              nutrition: Array.isArray(item.nutrition) ? item.nutrition : [],
              allergies: Array.isArray(item.allergies) ? item.allergies : [],
              photoCount: item.photoCount || 1,
              // Approval status fields
              approvalStatus: item.approvalStatus || 'pending',
              rejectionReason: item.rejectionReason || '',
              requestedAt: item.requestedAt,
              approvedAt: item.approvedAt,
            })) : [],
            subsections: Array.isArray(section.subsections) ? section.subsections.map(subsection => ({
              id: subsection.id || `subsection-${Date.now()}`,
              name: subsection.name || "Unnamed Subsection",
              items: Array.isArray(subsection.items) ? subsection.items.map(item => ({
                id: String(item.id || Date.now() + Math.random()),
                name: item.name || "Unnamed Item",
                nameArabic: item.nameArabic || "",
                image: item.image || "",
                category: item.category || section.name,
                rating: item.rating || 0.0,
                reviews: item.reviews || 0,
                price: item.price || 0,
                stock: item.stock || "Unlimited",
                discount: item.discount || null,
                originalPrice: item.originalPrice || null,
                foodType: item.foodType || "Non-Veg",
                availabilityTimeStart: item.availabilityTimeStart || "12:01 AM",
                availabilityTimeEnd: item.availabilityTimeEnd || "11:57 PM",
                description: item.description || "",
                discountType: item.discountType || "Percent",
                discountAmount: item.discountAmount || 0.0,
                isAvailable: item.isAvailable !== undefined ? item.isAvailable : true,
                isRecommended: item.isRecommended || false,
                variations: Array.isArray(item.variations) ? item.variations.map(v => ({
                  id: String(v.id || Date.now() + Math.random()),
                  name: v.name || "",
                  price: v.price || 0,
                  stock: v.stock || "Unlimited",
                })) : [],
                tags: Array.isArray(item.tags) ? item.tags : [],
                nutrition: Array.isArray(item.nutrition) ? item.nutrition : [],
                allergies: Array.isArray(item.allergies) ? item.allergies : [],
                photoCount: item.photoCount || 1,
                // Approval status fields
                approvalStatus: item.approvalStatus || 'pending',
                rejectionReason: item.rejectionReason || '',
                requestedAt: item.requestedAt,
                approvedAt: item.approvedAt,
              })) : [],
            })) : [],
            isEnabled: section.isEnabled !== undefined ? section.isEnabled : true,
            order: section.order !== undefined ? section.order : index,
          }))
          
          // Option A (single source of truth): menu snapshot saving is disabled.
          // Keep UI state locally; menu is generated from food_items.
          lastSyncedMenuRef.current = serializeMenuSections(normalizedSections)
          debugLog('Menu snapshot saving disabled (food_items is source of truth).')
        } catch (error) {
          debugError('Error saving menu:', error)
          // Check if it's a network error (backend not running)
          if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
            debugWarn('Backend server may not be running. Menu changes will be saved when connection is restored.')
            // Don't show error toast for network errors during auto-save to avoid spam
            // The user will see the error when they manually try to save
          } else {
            // Snapshot saving disabled; no toast needed.
          }
        }
      }, 1000) // Debounce: save 1 second after last change
      
      return () => clearTimeout(timeoutId)
    }
  }, [menuData, loadingMenu])

  // Fetch add-ons when add-ons tab is active
  const fetchAddons = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingAddons(true)
      const response = await restaurantAPI.getAddons()
      const data = response?.data?.data?.addons || response?.data?.addons || []
      const getAddonCreatedMs = (addon = {}) => {
        const candidates = [addon.requestedAt, addon.createdAt, addon.updatedAt]
          .map((v) => new Date(v).getTime())
          .find((ms) => Number.isFinite(ms) && ms > 0)
        if (candidates) return candidates
        const rawId = String(addon.id || "")
        const match = rawId.match(/\d{10,}/)
        if (!match) return 0
        const fromId = Number(match[0])
        return Number.isFinite(fromId) ? fromId : 0
      }
      const sortedAddons = [...data].sort((a, b) => getAddonCreatedMs(b) - getAddonCreatedMs(a))
      setAddons(sortedAddons)
    } catch (error) {
      debugError('Error fetching add-ons:', error)
      toast.error('Failed to load add-ons')
      setAddons([])
    } finally {
      if (showLoading) setLoadingAddons(false)
    }
  }

  useEffect(() => {
    if (activeTab === "add-ons") {
      fetchAddons(true)
    }
  }, [activeTab])

  useEffect(() => {
    try {
      localStorage.setItem("restaurant_hub_menu_active_tab", activeTab)
    } catch (error) {
      debugWarn("Failed to persist hub menu active tab:", error)
    }
  }, [activeTab])

  // Handle add-on image add
  const handleAddonImageAdd = (e) => {
    const files = Array.from(e.target.files)
    
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"]
    const validFiles = files.filter(file => {
      const ext = file.name ? file.name.split('.').pop().toLowerCase() : ''
      const allowedExts = ["png", "jpeg", "jpg", "webp", "heic", "heif"]
      
      const isValidType = allowedTypes.includes(file.type)
      const isValidExt = allowedExts.includes(ext)
      
      if (!isValidType && !isValidExt) {
        toast.error(`${file.name}: Invalid file type. Please upload PNG, JPG, JPEG, WEBP, HEIC, or HEIF.`)
        return false
      }
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        toast.error(`${file.name}: File size exceeds 5MB limit.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    const newImagePreviews = []
    const newImageFilesMap = new Map(addonImageFiles)
    
    validFiles.forEach(file => {
      const previewUrl = URL.createObjectURL(file)
      newImagePreviews.push(previewUrl)
      newImageFilesMap.set(previewUrl, file)
    })
    
    setAddonImages([...addonImages, ...newImagePreviews])
    setAddonImageFiles(newImageFilesMap)
    
    if (addonFileInputRef.current) {
      addonFileInputRef.current.value = ""
    }
  }

  // Handle add-on image delete
  const handleAddonImageDelete = (index) => {
    if (index < 0 || index >= addonImages.length) return
    
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return
    }
    
    const imageToDelete = addonImages[index]
    const newImages = addonImages.filter((_, i) => i !== index)
    setAddonImages(newImages)
    
    // Revoke blob URL if it's a preview
    if (imageToDelete.startsWith('blob:')) {
      URL.revokeObjectURL(imageToDelete)
      addonImageFiles.delete(imageToDelete)
      setAddonImageFiles(new Map(addonImageFiles))
    }
    
    toast.success('Image removed')
  }

  // Handle add-on save
  const handleSaveAddon = async () => {
    if (!addonName.trim()) {
      toast.error("Please enter add-on name")
      return
    }
    if (!addonPrice || parseFloat(addonPrice) < 0) {
      toast.error("Please enter a valid price")
      return
    }

    try {
      setUploadingAddonImages(true)

      // Upload new images to Cloudinary
      const uploadedImageUrls = []
      
      const existingImageUrls = addonImages.filter(img => 
        typeof img === 'string' && 
        (img.startsWith('http://') || img.startsWith('https://')) && 
        !img.startsWith('blob:')
      )
      
      const filesToUpload = Array.from(addonImageFiles.values())
      
      if (filesToUpload.length > 0) {
        toast.info(`Uploading ${filesToUpload.length} image(s)...`)
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i]
          try {
            let uploadResponse
            try {
              uploadResponse = await uploadAPI.uploadMedia(file, {
                folder: 'appzeto/restaurant/addons'
              })
            } catch (folderUploadError) {
              // Fallback: retry without folder in case provider/account rejects custom folder.
              debugWarn(`Retrying upload without folder for ${file.name}:`, folderUploadError)
              uploadResponse = await uploadAPI.uploadMedia(file)
            }
            const imageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.url
            if (imageUrl) {
              uploadedImageUrls.push(imageUrl)
            }
          } catch (uploadError) {
            debugError(`Error uploading image ${i + 1}:`, uploadError)
            toast.error(getUploadErrorMessage(uploadError, file.name))
            setUploadingAddonImages(false)
            return
          }
        }
      }

      const allImageUrls = [
        ...existingImageUrls,
        ...uploadedImageUrls
      ].filter((url, index, self) => 
        url && 
        typeof url === 'string' && 
        url.trim() !== '' && 
        self.indexOf(url) === index
      )

      const addonData = {
        name: addonName.trim(),
        description: addonDescription.trim(),
        price: parseFloat(addonPrice) || 0,
        image: allImageUrls.length > 0 ? allImageUrls[0] : '',
        images: allImageUrls
      }

      if (editingAddon) {
        // Update existing add-on
        await restaurantAPI.updateAddon(editingAddon.id, { draft: addonData })
        toast.success('Add-on updated successfully! Pending admin approval.')
      } else {
        // Create new add-on
        await restaurantAPI.addAddon(addonData)
        toast.success('Add-on added successfully! Pending admin approval.')
      }
      
      // Reset form
      setAddonName("")
      setAddonDescription("")
      setAddonPrice("")
      setAddonImages([])
      setAddonImageFiles(new Map())
      setEditingAddon(null)
      setIsAddAddonModalOpen(false)
      
      // Refresh add-ons list
      fetchAddons(true)
    } catch (error) {
      debugError('Error saving add-on:', error)
      toast.error(error?.response?.data?.message || (editingAddon ? 'Failed to update add-on' : 'Failed to add add-on'))
    } finally {
      setUploadingAddonImages(false)
    }
  }

  // Handle edit add-on
  const handleEditAddon = (addon) => {
    // Edits create a new pending draft while keeping old published version visible (if any).
    setEditingAddon(addon)
    setAddonName(addon.name || "")
    setAddonDescription(addon.description || "")
    setAddonPrice(addon.price?.toString() || "")
    setAddonImages(addon.images && addon.images.length > 0 ? addon.images : (addon.image ? [addon.image] : []))
    setAddonImageFiles(new Map())
    setIsAddAddonModalOpen(true)
  }

  // Handle delete add-on
  const handleDeleteAddon = async (addon) => {
    if (!window.confirm(`Are you sure you want to delete "${addon.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await restaurantAPI.deleteAddon(addon.id)
      toast.success('Add-on deleted successfully')
      fetchAddons(true)
    } catch (error) {
      debugError('Error deleting add-on:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete add-on')
    }
  }

  // Reset add-on form when modal closes
  useEffect(() => {
    if (!isAddAddonModalOpen) {
      setAddonName("")
      setAddonDescription("")
      setAddonPrice("")
      setAddonImages([])
      setAddonImageFiles(new Map())
      setEditingAddon(null)
      // Revoke blob URLs
      addonImages.forEach(img => {
        if (img.startsWith('blob:')) {
          URL.revokeObjectURL(img)
        }
      })
    }
  }, [isAddAddonModalOpen])

  // Initialize menuData from menuGroups if empty (for backward compatibility)
  // This is now handled in the fetchMenu useEffect, so we don't need this anymore
  // Keeping it commented out in case we need it for migration
  // useEffect(() => {
  //   if (menuData.length === 0 && menuGroups.length > 0 && !loadingMenu) {
  //     setMenuData(menuGroups)
  //   }
  // }, [menuGroups, loadingMenu])

  // Expand all categories initially, then preserve manual open/close state.
  // Also auto-expand only newly added categories.
  useEffect(() => {
    const groupIds = menuData.map((group) => group.id).filter(Boolean)

    if (groupIds.length === 0) {
      setExpandedGroups(new Set())
      hasInitializedExpandedGroups.current = false
      return
    }

    setExpandedGroups((prev) => {
      const validIds = new Set(groupIds)
      const next = new Set([...prev].filter((id) => validIds.has(id)))

      if (!hasInitializedExpandedGroups.current) {
        hasInitializedExpandedGroups.current = true
        return new Set(groupIds)
      }

      let changed = next.size !== prev.size
      groupIds.forEach((id) => {
        if (!prev.has(id)) {
          next.add(id)
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [menuData])

  // Prevent body scroll when popups are open
  useEffect(() => {
    if (isFilterOpen || isAddPopupOpen || isMenuOpen || isAvailabilityPopupOpen || 
        isCategoryOptionsOpen || isEditCategoryOpen || isAddSubCategoryOpen || isAddCategoryPopupOpen || isSearchOpen || isAddAddonModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isFilterOpen, isAddPopupOpen, isMenuOpen, isAvailabilityPopupOpen, 
      isCategoryOptionsOpen, isEditCategoryOpen, isAddSubCategoryOpen, isAddCategoryPopupOpen, isSearchOpen, isAddAddonModalOpen])

  // Filter menu based on active filter and search query
  const getItemCreatedMs = (item = {}) => {
    const direct = [item.requestedAt, item.createdAt, item.addedAt, item.updatedAt]
      .map((value) => new Date(value).getTime())
      .find((ms) => Number.isFinite(ms) && ms > 0)
    if (direct) return direct

    const rawId = String(item.id || "")
    const match = rawId.match(/\d{10,}/)
    if (!match) return 0
    const fromId = Number(match[0])
    return Number.isFinite(fromId) ? fromId : 0
  }

  const isPendingApproval = (status) =>
    String(status || 'pending').toLowerCase() === 'pending'

  const isRejectedApproval = (status) =>
    String(status || '').toLowerCase() === 'rejected'

  const filteredMenuGroups = useMemo(() => {
    let filtered = menuData

    // Apply filter-based filtering
    if (activeFilter) {
      filtered = filtered.map(group => {
        const filteredItems = group.items.filter(item => {
          switch (activeFilter) {
            case "recommended":
              return item.isRecommended
            case "out-of-stock":
              return !item.isAvailable
            case "no-photos":
              return !item.image || item.photoCount === 0
            case "without-description":
              return !item.description || item.description.trim() === ""
            case "without-serving-info":
              return !item.variations || item.variations.length === 0
            default:
              return true
          }
        })
        return { ...group, items: filteredItems }
      }).filter(group => group.items.length > 0)
    }

    // Apply search query filtering
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.map(group => {
        const filteredItems = group.items.filter(item => {
          return item.name.toLowerCase().includes(query) ||
                 item.category.toLowerCase().includes(query) ||
                 (item.description && item.description.toLowerCase().includes(query))
        })
        return { ...group, items: filteredItems }
      }).filter(group => group.items.length > 0)
    }

    // Always show newest items first
    return filtered.map((group) => ({
      ...group,
      items: [...(group.items || [])].sort(
        (a, b) => getItemCreatedMs(b) - getItemCreatedMs(a)
      ),
      subsections: Array.isArray(group.subsections)
        ? group.subsections.map((subsection) => ({
            ...subsection,
            items: [...(subsection.items || [])].sort(
              (a, b) => getItemCreatedMs(b) - getItemCreatedMs(a)
            ),
          }))
        : [],
    }))
  }, [menuData, activeFilter, searchQuery])

  // Toggle group expansion
  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  // Toggle item stock status - opens popup
  const toggleItemStock = (itemId, groupId) => {
    const group = menuData.find(g => g.id === groupId)
    const item = group?.items.find(i => i.id === itemId)
    if (item && item.isAvailable) {
      // Opening popup to switch off
      setSwitchingOffTarget({ type: 'item', id: itemId, groupId })
      setIsAvailabilityPopupOpen(true)
      setAvailabilityReason(null)
    } else {
      // Directly turn on (no popup needed)
      setMenuData(prev => prev.map(g => ({
        ...g,
        items: g.items.map(i => 
          i.id === itemId ? { ...i, isAvailable: true } : i
        )
      })))
    }
  }


  // Handle availability popup confirm
  const handleAvailabilityConfirm = async () => {
    if (!availabilityReason || !switchingOffTarget) return

    // Validate custom date/time if selected
    if (availabilityReason === 'custom' && !customDateTime) {
      toast.error('Please select a date and time for custom schedule')
      return
    }

    try {
      setIsScheduling(true)

      if (switchingOffTarget.type === 'item') {
        // Schedule item availability via API
        const scheduleData = {
          sectionId: switchingOffTarget.groupId,
          itemId: switchingOffTarget.id,
          scheduleType: availabilityReason,
          ...(availabilityReason === 'custom' && { customDateTime }),
        }

        const response = await restaurantAPI.scheduleItemAvailability(scheduleData)

        if (response.data && response.data.success) {
          // Update local menu data with response
          if (response.data.data && response.data.data.menu) {
            setMenuData(response.data.data.menu.sections || [])
          } else {
            // Fallback: update locally
            setMenuData(prev => prev.map(g => ({
              ...g,
              items: g.items.map(i => 
                i.id === switchingOffTarget.id ? { ...i, isAvailable: false } : i
              ),
              subsections: g.subsections?.map(sub => ({
                ...sub,
                items: sub.items.map(i => 
                  i.id === switchingOffTarget.id ? { ...i, isAvailable: false } : i
                )
              }))
            })))
          }

          toast.success(
            availabilityReason === 'manual'
              ? 'Item availability updated'
              : 'Item availability scheduled successfully'
          )
        } else {
          throw new Error(response.data?.message || 'Failed to schedule availability')
        }
      } else if (switchingOffTarget.type === 'group') {
        // For groups, just update locally (no API support yet)
        setMenuData(prev => prev.map(g => 
          g.id === switchingOffTarget.id ? { ...g, isEnabled: false } : g
        ))
        toast.success('Category availability updated')
      }

      setIsAvailabilityPopupOpen(false)
      setAvailabilityReason(null)
      setCustomDateTime('')
      setSwitchingOffTarget(null)
    } catch (error) {
      debugError('Error scheduling item availability:', error)
      toast.error(error.response?.data?.message || 'Failed to schedule item availability')
    } finally {
      setIsScheduling(false)
    }
  }

  // Handle filter selection
  const handleFilterSelect = (filterId) => {
    setSelectedFilter(filterId)
    setActiveFilter(filterId)
    setIsFilterOpen(false)
  }

  // Category options handlers
  const handleOpenCategoryOptions = (group) => {
    setSelectedCategory({ id: group.id, name: group.name })
    setIsCategoryOptionsOpen(true)
  }

  const handleEditCategory = () => {
    if (!selectedCategory) return
    setEditCategoryName(selectedCategory.name)
    setIsEditCategoryOpen(true)
    setIsCategoryOptionsOpen(false)
  }

  const handleSaveCategoryName = () => {
    if (!editCategoryName.trim() || !selectedCategory) return
    
    const newCategoryName = editCategoryName.trim()
    if (newCategoryName === selectedCategory.name) {
      setIsEditCategoryOpen(false)
      setSelectedCategory(null)
      return
    }

    // Update all foods in this category
    const allFoods = getAllFoods()
    const updatedFoods = allFoods.map(food => {
      if (food.category === selectedCategory.name) {
        return { ...food, category: newCategoryName }
      }
      return food
    })

    // Save updated foods
    try {
      localStorage.setItem('restaurant_foods', JSON.stringify(updatedFoods))
      window.dispatchEvent(new CustomEvent('foodsChanged'))
      window.dispatchEvent(new Event('storage'))
    } catch (error) {
      debugError('Error updating category:', error)
      alert('Error updating category name')
      return
    }

    setIsEditCategoryOpen(false)
    setSelectedCategory(null)
    setEditCategoryName("")
  }

  // Sub-category handlers
  const handleOpenAddSubCategory = (group) => {
    setSelectedGroupForSubCategory({ id: group.id, name: group.name })
    setSubCategoryName("")
    setIsAddSubCategoryOpen(true)
  }

  const handleContinueSubCategory = () => {
    if (!subCategoryName.trim() || !selectedGroupForSubCategory) return
    
    // Navigate to new item page with sub-category info
    navigate('/restaurant/hub-menu/item/new', {
      state: {
        groupId: selectedGroupForSubCategory.id,
        category: selectedGroupForSubCategory.name,
        subCategory: subCategoryName.trim()
      }
    })
    
    // Close popup and reset
    setIsAddSubCategoryOpen(false)
    setSubCategoryName("")
    setSelectedGroupForSubCategory(null)
  }

  // Add category handlers
  const handleOpenAddCategory = () => {
    setNewCategoryName("")
    setIsAddCategoryPopupOpen(true)
    setIsAddPopupOpen(false) // Close the main add popup
  }

  const handleContinueAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name')
      return
    }
    
    toast.message('Finish category setup on Menu Categories so you can choose veg, non-veg, or both before admin approval.')
    navigate('/restaurant/menu-categories', {
      state: {
        draftCategoryName: newCategoryName.trim(),
      }
    })

    setIsAddCategoryPopupOpen(false)
    setNewCategoryName("")
  }

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return
    
    if (!window.confirm(`Are you sure you want to delete the category "${selectedCategory.name}"? This will delete all items in this category.`)) {
      return
    }

    try {
      // Menu editing is disabled on the backend. The menu is generated from food_items.
      // Category deletion must be done via the Menu Categories page and can only happen when it has no items.
      toast.error('Delete categories from Menu Categories (and only when empty).')
      navigate('/restaurant/menu-categories')
    } catch (error) {
      debugError('Error deleting category:', error)
      toast.error('Failed to delete category')
      return
    }

    setIsCategoryOptionsOpen(false)
    setSelectedCategory(null)
  }

  // Scroll to category
  const scrollToCategory = (categoryId) => {
    setExpandedGroups((prev) => {
      if (prev.has(categoryId)) return prev
      const next = new Set(prev)
      next.add(categoryId)
      return next
    })

    const element = document.getElementById(`group-${categoryId}`)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white ">
        <div className="">
          {/* Top bar with Menu title and icons */}
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="relative h-8 flex items-center flex-1 min-w-0 pr-3">
              <AnimatePresence mode="wait">
                {!isScrolled ? (
                  <motion.h1
                    key="menu"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="text-2xl font-bold text-gray-900 absolute"
                  >
                    Menu
                  </motion.h1>
                ) : (
                  <motion.h1
                    key="restaurant"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="text-lg font-bold text-gray-900 absolute truncate max-w-full"
                    title={restaurantName}
                  >
                    {restaurantName.length > 25 ? `${restaurantName.substring(0, 25)}...` : restaurantName}
                  </motion.h1>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => {
                  fetchMenu(true)
                  toast.success('Menu refreshed')
                }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Refresh menu"
              >
                <RefreshCw className="w-5 h-5 text-gray-700" />
              </button>
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <Search className="w-5 h-5 text-gray-700" />
              </button>
              <button
              className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => navigate("/restaurant/explore")}
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            </div>
          </div>

          {/* Restaurant name and expertise */}
          <AnimatePresence>
            {!isScrolled && (
              <motion.div
                initial={{ opacity: 1, height: "auto" }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="mb-3 px-4 py-1 overflow-hidden"
              >
                <h2 className="text-lg font-bold text-gray-900">{restaurantName}</h2>
                <p className="text-sm text-gray-600">{restaurantExpertise}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Horizontally scrollable filters */}
          <div className="flex px-4 relative items-center gap-2 overflow-x-auto pb-2 scrollbar-hide" ref={scrollContainerRef} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <style>{`
              .scrollbar-hide::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            {activeFilter && (
              <button
                onClick={() => {
                  setActiveFilter(null)
                  setSelectedFilter(null)
                }}
                className="flex items-center gap-2 px-2 py-1 text-semibold border-2 border-gray-300 rounded-md text-sm font-medium whitespace-nowrap shrink-0 bg-white text-gray-900"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleFilterSelect(filter.id)}
                className={`flex items-center gap-2 px-2 py-1 text-semibold border-2 rounded-md text-sm font-medium whitespace-nowrap shrink-0 ${
                  activeFilter === filter.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <span>{filter.label}</span>
                <span className="bg-red-100 border-2 border-red-400 text-red-400 text-xs  font-bold p-0.5 py-0.25 rounded-sm">
                  {filter.count}
                </span>
              </button>

            ))}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="z-10 shrink-0 bg-black text-white border-2 border-black flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filter</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
      </div>

        <div className="flex items-center gap-2 p-0.5 mt-2 w-auto mx-4 bg-gray-200 rounded-md">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-white text-black"
                : " text-gray-600"
            }`}
          >
            All items
          </button>
          <button
            onClick={() => setActiveTab("add-ons")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "add-ons"
                ? "bg-white text-black"
                : " text-gray-600"
            }`}
          >
            Add-ons
          </button>
        </div>
      {/* Content */}
      <div className="flex-1 space-y-4 pt-8 pb-24 overflow-y-auto">
        {activeTab === "add-ons" ? (
          <div className="px-4">
            {/* Add Add-on Button */}
            <div className="mb-6">
              <button
                onClick={() => setIsAddAddonModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Add-on</span>
              </button>
            </div>

            {/* Add-ons List */}
            {loadingAddons ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : addons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4">
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-500">No add-ons available</p>
                  <p className="text-sm text-gray-400 mt-2">Add-ons will appear here when you create them</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className="bg-white rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-base font-semibold text-gray-900">{addon.name}</h3>
                          {addon.approvalStatus === 'pending' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>
                          )}
                          {addon.approvalStatus === 'approved' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">Approved</span>
                          )}
                          {addon.approvalStatus === 'rejected' && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">Rejected</span>
                          )}
                          {addon.isAvailable === false && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">Unavailable</span>
                          )}
                        </div>
                        {addon.description && (
                          <p className="text-sm text-gray-600 mb-2">{addon.description}</p>
                        )}
                        <p className="text-base font-bold text-gray-900">₹{addon.price}</p>
                        {isRejectedApproval(addon.approvalStatus) && addon.rejectionReason && (
                          <p className="text-xs text-red-600 mt-1">Reason: {addon.rejectionReason}</p>
                        )}
                        {isPendingApproval(addon.approvalStatus) && addon.published && (
                          <p className="text-xs text-gray-500 mt-1">
                            User app is still showing the last approved version until this draft is approved.
                          </p>
                        )}
                      </div>
                      <div className="flex items-start gap-2">
                        {addon.images && addon.images.length > 0 && addon.images[0] && (
                          <img
                            src={addon.images[0]}
                            alt={addon.name}
                            className="w-20 h-20 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        )}
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleEditAddon(addon)}
                            className="p-2 bg-[#e7eaef] text-primary rounded-lg hover:bg-[#c3ccd6] transition-colors"
                            title="Edit add-on"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await restaurantAPI.updateAddon(addon.id, { isAvailable: addon.isAvailable === false })
                                toast.success(addon.isAvailable === false ? "Add-on enabled" : "Add-on disabled")
                                fetchAddons(false)
                              } catch (error) {
                                debugError("Error toggling add-on availability:", error)
                                toast.error(error?.response?.data?.message || "Failed to update availability")
                              }
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                              addon.isAvailable === false
                                ? "bg-green-600 text-white hover:bg-green-700"
                                : "bg-gray-900 text-white hover:bg-gray-800"
                            }`}
                            title="Toggle availability"
                          >
                            {addon.isAvailable === false ? "Enable" : "Disable"}
                          </button>
                          <button
                            onClick={() => handleDeleteAddon(addon)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            title="Delete add-on"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 space-y-4">
            {filteredMenuGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id)
              const itemCount = group.items.length
              const enabledItems = group.items.filter(item => item.isAvailable).length

            return (
              <div
                key={group.id}
                id={`group-${group.id}`}
                className="bg-white rounded-lg overflow-hidden"
              >
              {/* Group Header */}
              <div className="py-3 flex items-center justify-between px-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-1 h-6 bg-red-500 rounded-r-full" />
                  <h3 className="text-base font-bold text-gray-900">
                    {group.name} ({enabledItems})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleGroup(group.id)
                    }}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors z-10 relative"
                    aria-label={isExpanded ? "Collapse section" : "Expand section"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleOpenCategoryOptions(group)
                    }}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors z-10 relative"
                    aria-label="Category options"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 space-y-2">
                  {/* Items */}
                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <div key={item.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start gap-3">
                          {/* Left: Veg/Non-veg icon, name, price */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className={`w-4 h-4 rounded-sm border-2 shrink-0 flex items-center justify-center ${
                                  item.foodType === "Veg"
                                    ? "bg-green-50 border-green-600"
                                    : "bg-red-50 border-red-600"
                                }`}
                              >
                                <div className={`w-2 h-2 rounded-full ${
                                  item.foodType === "Veg"
                                    ? "bg-green-600"
                                    : "bg-red-600"
                                }`} />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="text-base font-bold text-gray-900">{item.name}</h5>
                              {/* Approval Status Tag */}
                              {item.approvalStatus && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    item.approvalStatus === 'approved'
                                      ? 'bg-green-100 text-green-700 border border-green-300'
                                      : item.approvalStatus === 'rejected'
                                      ? 'bg-red-100 text-red-700 border border-red-300'
                                      : 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                  }`}
                                >
                                  {item.approvalStatus === 'approved'
                                    ? 'Approved'
                                    : item.approvalStatus === 'rejected'
                                    ? 'Rejected'
                                    : 'Pending'}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-700 mb-3">₹{item.price}</p>
                            {isRejectedApproval(item.approvalStatus) && item.rejectionReason && (
                              <p className="text-xs text-red-600 -mt-2 mb-3">Reason: {item.rejectionReason}</p>
                            )}
                          </div>

                          {/* Right: Image */}
                          <div className="relative">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-20 h-20 rounded-lg object-cover"
                            />
                            <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-1">
                              <div className="flex items-center gap-1">
                                <Camera className="w-3 h-3 text-white" />
                                <span className="text-white text-xs font-semibold">{item.photoCount}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons - below image */}
                        {isPendingApproval(item.approvalStatus) && (
                          <div className="flex items-center justify-center gap-3 mt-4">
                            <button
                              onClick={() => navigate(`/restaurant/hub-menu/item/${item.id}`, { state: { item, groupId: group.id } })}
                              className="flex items-center gap-1.5 bg-transparent text-gray-700 text-sm font-medium"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              )}
              </div>
            )
          })}
          </div>
        )}
      </div>

      {/* Filter Popup */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Filters</h2>
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-1">
                  {filterOptions.map((filter, index) => (
                    <label
                      key={filter.id}
                      className="flex items-center justify-between py-3 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {filter.label} ({filter.count})
                      </span>
                      <input
                        type="radio"
                        name="filter"
                        value={filter.id}
                        checked={activeFilter === filter.id}
                        onChange={() => handleFilterSelect(filter.id)}
                        className="w-5 h-5 text-black border-gray-400 focus:ring-black"
                        style={{ accentColor: "#000000" }}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <div className="px-4 py-4 border-t border-gray-200 space-y-2">
                {activeFilter && (
                  <button
                    onClick={() => {
                      setActiveFilter(null)
                      setSelectedFilter(null)
                      setIsFilterOpen(false)
                    }}
                    className="w-full py-2 rounded-lg font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
                <button
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full py-3 rounded-lg font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Popup */}
      <AnimatePresence>
        {isAddPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 text-center">Add item</h2>
              </div>
              <div className="px-4 py-4 space-y-2">
                <button
                  onClick={() => {
                    navigate(`/restaurant/hub-menu/item/new`)
                  }}
                  className="w-full py-3 px-4 text-left rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">Add item</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Availability Popup */}
      <div>
        {isAvailabilityPopupOpen && (
          <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white z-[9999]"
            >
              {/* Header */}
              <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsAvailabilityPopupOpen(false)
                    setAvailabilityReason(null)
                    setCustomDateTime('')
                    setSwitchingOffTarget(null)
                  }}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <h2 className="text-xl font-bold text-gray-900">When will this be available?</h2>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-6">
                {/* Auto turn-on after section */}
                <div className="mb-6">
                  <h3 className="text-base font-bold text-gray-900 mb-4">Auto turn-on after</h3>
                  <div className="space-y-4">
                    {[
                      { id: "2-hours", label: "2 Hours" },
                      { id: "4-hours", label: "4 Hours" },
                      { id: "next-business-day", label: "Next business day" },
                      { id: "custom", label: "Custom date & time (upto 7 days)" },
                    ].map((option) => (
                      <div key={option.id}>
                        <label
                          className="flex items-center gap-3 cursor-pointer py-2"
                        >
                          <input
                            type="radio"
                            name="availability"
                            value={option.id}
                            checked={availabilityReason === option.id}
                            onChange={() => setAvailabilityReason(option.id)}
                            className="w-5 h-5 text-black border-gray-400 focus:ring-black"
                            style={{ accentColor: "#000000" }}
                          />
                          <span className="text-sm font-medium text-gray-900">{option.label}</span>
                        </label>
                        {option.id === "custom" && availabilityReason === "custom" && (
                          <div className="ml-8 mt-2 mb-4">
                            <input
                              type="datetime-local"
                              value={customDateTime}
                              onChange={(e) => setCustomDateTime(e.target.value)}
                              min={new Date().toISOString().slice(0, 16)}
                              max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black"
                              required
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6" />

                {/* Manually turn on section */}
                <div>
                  <h3 className="text-base font-bold text-gray-900 mb-4">Manually turn on</h3>
                  <div className="space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer py-2">
                      <input
                        type="radio"
                        name="availability"
                        value="manual"
                        checked={availabilityReason === "manual"}
                        onChange={() => setAvailabilityReason("manual")}
                        className="w-5 h-5 text-black border-gray-400 focus:ring-black"
                        style={{ accentColor: "#000000" }}
                      />
                      <span className="text-sm font-medium text-gray-900">I will turn it on myself</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-8">
                      This item will not be visible to customers on the Zomato app till you switch it on.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-4 border-t border-gray-200">
                <button
                  onClick={handleAvailabilityConfirm}
                  disabled={!availabilityReason || isScheduling || (availabilityReason === 'custom' && !customDateTime)}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors ${
                    availabilityReason && !isScheduling && (availabilityReason !== 'custom' || customDateTime)
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isScheduling ? 'Scheduling...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </div>

      {/* Sticky Bottom Right Buttons */}
      <div className="fixed right-4 bottom-24 z-30 flex flex-col gap-1">
        {/* ADD Button */}

        {activeTab !== "add-ons" && (
          <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setIsAddPopupOpen(true)}
          className="px-4 py-2 border bg-black text-white border-gray-800 rounded-lg text-sm font-bold"
        >
          + ADD
        </motion.button>)}

        {/* Menu Button */}
        {activeTab !== "add-ons" && (
          <>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-800 bg-white text-sm font-medium shadow-sm"
            >
              <span className="w-5 h-5 flex items-center justify-center">
                {isMenuOpen ? (
                  <X className="w-4 h-4 text-gray-900" />
                ) : (
                  <Utensils className="w-4 h-4 text-gray-900" />
                )}
              </span>
              <span>{isMenuOpen ? "Close" : "Menu"}</span>
            </motion.button>

            <AnimatePresence>
              {isMenuOpen && (
                <>
                  <motion.div
                    className="fixed inset-0 bg-black/40 z-30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.2 }}
                    className="fixed right-4 bottom-36 z-30 w-[60vw] max-w-sm h-[45vh] bg-white rounded-3xl shadow-lg overflow-hidden"
                  >
                    <div className="h-full flex flex-col">
                      <div className="px-4 pt-4 pb-2">
                        <p className="text-sm font-semibold text-gray-900">Menu</p>
                      </div>
                      <div className="h-px bg-gray-200 mx-4" />
                      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
                        {menuData.map((category, index) => {
                          const itemCount = category.items.filter(item => item.isAvailable).length
                          const isLast = index === menuData.length - 1

                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => {
                                setIsMenuOpen(false)
                                setTimeout(() => scrollToCategory(category.id), 200)
                              }}
                              className="w-full text-left py-3 focus:outline-none"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-900">
                                  {category.name}
                                </span>
                                <span className="min-w-[28px] h-7 rounded-full border border-gray-300 flex items-center justify-center text-xs text-gray-800">
                                  {itemCount}
                                </span>
                              </div>
                              {!isLast && (
                                <div className="mt-3 border-t border-dashed border-gray-200" />
                              )}
                            </button>
                          )
                        })}
                      </div>
        </div>
      </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Category Options Popup */}
      <AnimatePresence>
        {isCategoryOptionsOpen && selectedCategory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCategoryOptionsOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[50vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">{selectedCategory.name}</h2>
                <button
                  onClick={() => setIsCategoryOptionsOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-2">
                  <button
                    onClick={handleEditCategory}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <Edit className="w-5 h-5 text-gray-600" />
                    <span>Edit category name</span>
                  </button>
                  <button
                    onClick={handleDeleteCategory}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium text-red-600 bg-gray-50 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <span>Delete category</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Category Name Popup */}
      <AnimatePresence>
        {isEditCategoryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditCategoryOpen(false)
                setEditCategoryName("")
                setSelectedCategory(null)
              }}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[40vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Edit category name</h2>
                <button
                  onClick={() => {
                    setIsEditCategoryOpen(false)
                    setEditCategoryName("")
                    setSelectedCategory(null)
                  }}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Category name
                    </label>
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={(e) => setEditCategoryName(e.target.value)}
                      placeholder="Enter category name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsEditCategoryOpen(false)
                        setEditCategoryName("")
                        setSelectedCategory(null)
                      }}
                      className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveCategoryName}
                      disabled={!editCategoryName.trim()}
                      className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition-colors ${
                        editCategoryName.trim()
                          ? "bg-black text-white hover:bg-gray-800"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Sub-Category Popup */}
      <AnimatePresence>
        {isAddSubCategoryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddSubCategoryOpen(false)
                setSubCategoryName("")
                setSelectedGroupForSubCategory(null)
              }}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[40vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Add sub-category</h2>
                <button
                  onClick={() => {
                    setIsAddSubCategoryOpen(false)
                    setSubCategoryName("")
                    setSelectedGroupForSubCategory(null)
                  }}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Sub-category name
                    </label>
                    <input
                      type="text"
                      value={subCategoryName}
                      onChange={(e) => setSubCategoryName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && subCategoryName.trim()) {
                          handleContinueSubCategory()
                        }
                      }}
                      placeholder="Enter sub-category name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      autoFocus
                    />
                    {selectedGroupForSubCategory && (
                      <p className="text-xs text-gray-500 mt-2">
                        Category: <span className="font-medium">{selectedGroupForSubCategory.name}</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={handleContinueSubCategory}
                    disabled={!subCategoryName.trim()}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors ${
                      subCategoryName.trim()
                        ? "bg-black text-white hover:bg-gray-800"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Category Popup */}
      <AnimatePresence>
        {isAddCategoryPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddCategoryPopupOpen(false)
                setNewCategoryName("")
              }}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[40vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Add category</h2>
                <button
                  onClick={() => {
                    setIsAddCategoryPopupOpen(false)
                    setNewCategoryName("")
                  }}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Category name
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newCategoryName.trim()) {
                          handleContinueAddCategory()
                        }
                      }}
                      placeholder="Enter category name"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={handleContinueAddCategory}
                    disabled={!newCategoryName.trim()}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors ${
                      newCategoryName.trim()
                        ? "bg-black text-white hover:bg-gray-800"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Popup */}
      <AnimatePresence>
        {isSearchOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSearchOpen(false)
                setSearchQuery("")
              }}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Search Menu</h2>
                <button
                  onClick={() => {
                    setIsSearchOpen(false)
                    setSearchQuery("")
                  }}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="px-4 py-4 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for food items..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {searchQuery.trim() ? (
                  filteredMenuGroups.length > 0 ? (
                    <div className="space-y-4">
                      {filteredMenuGroups.map((group) => (
                        <div key={group.id} className="space-y-3">
                          <h3 className="text-sm font-bold text-gray-900 uppercase">
                            {group.name} ({group.items.length})
                          </h3>
                          <div className="space-y-3">
                            {group.items.map((item) => (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (!isPendingApproval(item.approvalStatus)) {
                                    toast.error("Approved or rejected items cannot be edited")
                                    return
                                  }
                                  setIsSearchOpen(false)
                                  navigate(`/restaurant/hub-menu/item/${item.id}`, { 
                                    state: { item, groupId: group.id } 
                                  })
                                }}
                                className={`flex items-start gap-3 p-3 rounded-lg border border-gray-200 transition-colors ${
                                  isPendingApproval(item.approvalStatus)
                                    ? "hover:bg-gray-50 cursor-pointer"
                                    : "bg-gray-50/60 cursor-not-allowed"
                                }`}
                              >
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div
                                      className={`w-4 h-4 rounded-sm border-2 shrink-0 flex items-center justify-center ${
                                        item.foodType === "Veg"
                                          ? "bg-green-50 border-green-600"
                                          : "bg-red-50 border-red-600"
                                      }`}
                                    >
                                      <div className={`w-2 h-2 rounded-full ${
                                        item.foodType === "Veg"
                                          ? "bg-green-600"
                                          : "bg-red-600"
                                      }`} />
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-900 truncate">
                                      {item.name}
                                    </h4>
                                  </div>
                                  <p className="text-sm font-medium text-gray-700">₹{item.price}</p>
                                  {isRejectedApproval(item.approvalStatus) && item.rejectionReason && (
                                    <p className="text-xs text-red-600 mt-1">Reason: {item.rejectionReason}</p>
                                  )}
                                  {!item.isAvailable && (
                                    <span className="text-xs text-red-600 font-medium">Out of stock</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4">
                      <div className="text-center">
                        <p className="text-lg font-medium text-gray-500">No items found</p>
                        <p className="text-sm text-gray-400 mt-2">
                          Try searching with different keywords
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 px-4">
                    <div className="text-center">
                      <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-lg font-medium text-gray-500">Start searching</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Type to search for food items by name or category
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {searchQuery.trim() && filteredMenuGroups.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200">
                  <button
                    onClick={() => setIsSearchOpen(false)}
                    className="w-full py-3 rounded-lg font-semibold text-sm bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                  >
                    View Results ({filteredMenuGroups.reduce((acc, group) => acc + group.items.length, 0)} items)
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Add-on Modal */}
      <AnimatePresence>
        {isAddAddonModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsAddAddonModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingAddon ? 'Edit Add-on' : 'Add New Add-on'}
                </h2>
                <button
                  onClick={() => setIsAddAddonModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add-on Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addonName}
                    onChange={(e) => setAddonName(e.target.value)}
                    placeholder="e.g., Coke, Chips, Sauce"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Description Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={addonDescription}
                    onChange={(e) => setAddonDescription(e.target.value)}
                    placeholder="Describe the add-on..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Price Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={addonPrice}
                    onChange={(e) => setAddonPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* Images Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Images
                  </label>
                  
                  {/* Image Preview Grid */}
                  {addonImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {addonImages.map((img, index) => (
                        <div key={index} className="relative group">
                          {img && (
                            <img
                              src={img}
                              alt={`Add-on ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          )}
                          <button
                            onClick={() => handleAddonImageDelete(index)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Image Button */}
                  <input
                    ref={addonFileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleAddonImageAdd}
                    className="hidden"
                    id="addon-image-upload"
                  />
                  <label
                    htmlFor="addon-image-upload"
                    className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                  >
                    <Camera className="h-5 w-5 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Add Images</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Add multiple images (PNG, JPG, WEBP - max 5MB each)</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3">
                <button
                  onClick={() => setIsAddAddonModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAddon}
                  disabled={!addonName.trim() || !addonPrice || uploadingAddonImages}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {uploadingAddonImages ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>{editingAddon ? 'Update Add-on' : 'Add Add-on'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNavOrders />
    </div>
  )
}

