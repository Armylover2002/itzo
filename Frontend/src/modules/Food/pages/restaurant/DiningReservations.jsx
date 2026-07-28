import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Calendar, Clock, Users, Search, MessageSquare, CheckCircle2, Clock4, UploadCloud, ImagePlus, ChevronDown, ChevronUp, Sparkles, MapPin, Phone, Info, X, ArrowLeft } from "lucide-react"
import { diningAPI, restaurantAPI } from "@food/api"
import Loader from "@food/components/Loader"
import { Badge } from "@food/components/ui/badge"
import { toast } from "sonner"
const debugError = (...args) => {}

const getRestaurantFromResponse = (response) =>
    response?.data?.data?.restaurant ||
    response?.data?.restaurant ||
    response?.data?.data ||
    null

const normalizeImageEntry = (entry) => {
    if (!entry) return null
    if (typeof entry === "string") {
        const url = entry.trim()
        return url ? { url, publicId: null } : null
    }
    const url = String(entry?.url || "").trim()
    if (!url) return null
    return {
        url,
        publicId: entry?.publicId || null,
    }
}

const getProfilePhotoUrl = (restaurant) => {
    const candidate = restaurant?.profileImage
    if (!candidate) return ""
    if (typeof candidate === "string") return candidate.trim()
    return String(candidate?.url || "").trim()
}

const getCoverImages = (restaurant) => {
    const base = Array.isArray(restaurant?.coverImages) ? restaurant.coverImages : []
    return base
        .map(normalizeImageEntry)
        .filter(Boolean)
}

const getMenuImages = (restaurant) => {
    const base = Array.isArray(restaurant?.menuImages) ? restaurant.menuImages : []

    return base
        .map(normalizeImageEntry)
        .filter(Boolean)
}

const getBookerName = (booking) =>
    String(
        booking?.user?.name ||
        booking?.customerName ||
        booking?.bookedBy?.name ||
        booking?.name ||
        "Guest"
    ).trim()

const getBookerPhone = (booking) =>
    String(
        booking?.user?.phone ||
        booking?.phone ||
        booking?.phoneNumber ||
        booking?.mobile ||
        booking?.bookedBy?.phone ||
        ""
    ).trim()


export default function DiningReservations() {
    const navigate = useNavigate()
    const [bookings, setBookings] = useState([])
    const [loading, setLoading] = useState(true)
    const [restaurant, setRestaurant] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [restaurantPhoto, setRestaurantPhoto] = useState("")
    const [restaurantPhotos, setRestaurantPhotos] = useState([])
    const [menuPhotos, setMenuPhotos] = useState([])
    const [uploadingRestaurantPhoto, setUploadingRestaurantPhoto] = useState(false)
    const [uploadingMenuPhotos, setUploadingMenuPhotos] = useState(false)
    const [removingRestaurantPhoto, setRemovingRestaurantPhoto] = useState(false)
    const [removingMenuPhoto, setRemovingMenuPhoto] = useState(false)
    const [uploadMessage, setUploadMessage] = useState("")
    const [uploadError, setUploadError] = useState("")
    const [activeSection, setActiveSection] = useState("reservations")
    const [activeView, setActiveView] = useState("priority")
    const [showMediaPanel, setShowMediaPanel] = useState(false)
    const [diningEnabled, setDiningEnabled] = useState(false)
    const [maxGuestsLimit, setMaxGuestsLimit] = useState(6)
    const [savingDiningSettings, setSavingDiningSettings] = useState(false)
    const [diningSettingsMessage, setDiningSettingsMessage] = useState("")
    const [diningSettingsError, setDiningSettingsError] = useState("")
    const [diningCategories, setDiningCategories] = useState([])
    const [selectedDiningCategoryIds, setSelectedDiningCategoryIds] = useState([])

    const activeDiningRequest = restaurant?.pendingDiningRequest || null
    const isDiningToggleOn = Boolean(diningEnabled)

    const syncRestaurantMediaState = (restaurantData) => {
        setRestaurant(restaurantData || null)
        const coverImages = getCoverImages(restaurantData)
        const profileImage = getProfilePhotoUrl(restaurantData)
        setRestaurantPhotos(coverImages)
        setRestaurantPhoto(coverImages[0]?.url || profileImage)
        setMenuPhotos(getMenuImages(restaurantData))
        const draftDiningState = restaurantData?.pendingDiningRequest || restaurantData?.diningSettings || {}
        setDiningEnabled(Boolean(draftDiningState?.isEnabled))
        setMaxGuestsLimit(
            draftDiningState?.isEnabled
                ? Math.max(1, parseInt(draftDiningState?.maxGuests, 10) || 6)
                : 0
        )
        setSelectedDiningCategoryIds(
            draftDiningState?.isEnabled && Array.isArray(draftDiningState?.categoryIds) && draftDiningState.categoryIds.length > 0
                ? draftDiningState.categoryIds.map((id) => String(id))
                : (Array.isArray(restaurantData?.diningCategoryIds) && restaurantData?.diningSettings?.isEnabled !== false)
                    ? restaurantData.diningCategoryIds.map((id) => String(id))
                    : []
        )
    }

    useEffect(() => {
        const fetchAll = async () => {
            try {
                // First get the current restaurant
                const [resResponse, categoriesResponse] = await Promise.all([
                    restaurantAPI.getCurrentRestaurant(),
                    diningAPI.getCategories().catch(() => null),
                ])

                if (categoriesResponse?.data?.success) {
                    setDiningCategories(Array.isArray(categoriesResponse.data.data) ? categoriesResponse.data.data : [])
                }

                if (resResponse.data.success) {
                    const resData = getRestaurantFromResponse(resResponse)

                    const restaurantId = resData?._id || resData?.id

                    if (restaurantId) {
                        syncRestaurantMediaState(resData)
                        // Then get its bookings
                        const bookingsResponse = await diningAPI.getRestaurantBookings(resData)
                        if (bookingsResponse.data.success) {
                            setBookings(Array.isArray(bookingsResponse.data.data) ? bookingsResponse.data.data : [])
                        }
                    } else {
                        debugError("Restaurant ID not found in response:", resData)
                    }
                }
            } catch (error) {
                debugError("Error fetching reservations:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchAll()
    }, [])

    const handleRestaurantPhotoUpload = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        setUploadError("")
        setUploadMessage("")
        setUploadingRestaurantPhoto(true)

        try {
            await restaurantAPI.uploadCoverImages(files)
            const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
            const refreshedRestaurant = getRestaurantFromResponse(refreshedResponse)
            syncRestaurantMediaState(refreshedRestaurant)
            setUploadMessage(`Uploaded ${files.length} restaurant photo(s) successfully.`)
        } catch (error) {
            debugError("Error uploading restaurant photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to upload restaurant photos.")
        } finally {
            setUploadingRestaurantPhoto(false)
            event.target.value = ""
        }
    }

    const handleMenuPhotosUpload = async (event) => {
        const files = Array.from(event.target.files || [])
        if (files.length === 0) return

        setUploadError("")
        setUploadMessage("")
        setUploadingMenuPhotos(true)

        try {
            await restaurantAPI.uploadMenuImages(files)
            const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
            syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            setUploadMessage(`Uploaded ${files.length} menu photo(s) successfully.`)
        } catch (error) {
            debugError("Error saving menu photos:", error)
            setUploadError(error?.response?.data?.message || "Failed to upload menu photos.")
        } finally {
            setUploadingMenuPhotos(false)
            event.target.value = ""
        }
    }

    const handleRemoveRestaurantPhoto = async (photoUrl) => {
        if (!photoUrl || removingRestaurantPhoto) return

        setUploadError("")
        setUploadMessage("")
        setRemovingRestaurantPhoto(true)

        try {
            const nextCoverImages = restaurantPhotos.filter((photo) => photo.url !== photoUrl)
            const currentProfileImage = getProfilePhotoUrl(restaurant)
            const nextPrimaryPhoto = nextCoverImages[0]?.url || ""
            const shouldClearProfileImage = !nextPrimaryPhoto && currentProfileImage === photoUrl

            const response = await restaurantAPI.updateProfile({
                coverImages: nextCoverImages.map((photo) => ({
                    url: photo.url,
                    ...(photo.publicId ? { publicId: photo.publicId } : {}),
                })),
                ...(shouldClearProfileImage ? { profileImage: "" } : {}),
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage("Restaurant photo removed successfully.")
        } catch (error) {
            debugError("Error removing restaurant photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to remove restaurant photo.")
        } finally {
            setRemovingRestaurantPhoto(false)
        }
    }

    const handleRemoveMenuPhoto = async (photoUrl) => {
        if (!photoUrl || removingMenuPhoto) return

        setUploadError("")
        setUploadMessage("")
        setRemovingMenuPhoto(true)

        try {
            const nextMenuPhotos = menuPhotos.filter((photo) => photo.url !== photoUrl)
            const response = await restaurantAPI.updateProfile({
                menuImages: nextMenuPhotos.map((photo) => ({
                    url: photo.url,
                    ...(photo.publicId ? { publicId: photo.publicId } : {}),
                })),
            })

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            } else {
                const refreshedResponse = await restaurantAPI.getCurrentRestaurant()
                syncRestaurantMediaState(getRestaurantFromResponse(refreshedResponse))
            }

            setUploadMessage("Menu photo removed successfully.")
        } catch (error) {
            debugError("Error removing menu photo:", error)
            setUploadError(error?.response?.data?.message || "Failed to remove menu photo.")
        } finally {
            setRemovingMenuPhoto(false)
        }
    }

    const handleSaveDiningSettings = async () => {
        if (!restaurant || savingDiningSettings) return
        if (isDiningToggleOn && selectedDiningCategoryIds.length === 0) {
            setDiningSettingsError("Select at least one dining category.")
            return
        }

        const nextMaxGuests = isDiningToggleOn ? Math.max(1, parseInt(maxGuestsLimit, 10) || 1) : 0
        const nextDiningSettings = {
            isEnabled: isDiningToggleOn,
            maxGuests: nextMaxGuests,
            categoryIds: isDiningToggleOn ? selectedDiningCategoryIds : [],
            primaryCategoryId: isDiningToggleOn ? selectedDiningCategoryIds[0] : null,
        }

        setDiningSettingsError("")
        setDiningSettingsMessage("")
        setSavingDiningSettings(true)

        try {
            const response = await restaurantAPI.updateDiningSettings(nextDiningSettings)

            const updatedRestaurant = getRestaurantFromResponse(response)
            if (updatedRestaurant) {
                syncRestaurantMediaState(updatedRestaurant)
            }

            setDiningSettingsMessage("Dining request sent to admin. Changes will apply after approval.")
            toast.success("Dining request sent for approval")
        } catch (error) {
            debugError("Error saving dining settings:", error)
            setDiningSettingsError(error?.response?.data?.message || "Failed to submit dining request.")
            toast.error(error?.response?.data?.message || "Failed to submit dining request")
        } finally {
            setSavingDiningSettings(false)
        }
    }

    const toggleDiningCategory = (categoryId) => {
        if (!isDiningToggleOn) return
        const nextCategoryId = String(categoryId || "").trim()
        if (!nextCategoryId) return

        setSelectedDiningCategoryIds((prev) =>
            prev.includes(nextCategoryId)
                ? prev.filter((id) => id !== nextCategoryId)
                : [...prev, nextCategoryId]
        )
    }

    const handleStatusUpdate = async (bookingId, newStatus) => {
        try {
            const response = await diningAPI.updateBookingStatusRestaurant(bookingId, newStatus)
            if (response.data.success) {
                // Update local state
                setBookings(prev => prev.map(b =>
                    b._id === bookingId ? { ...b, status: newStatus } : b
                ))
            }
        } catch (error) {
            debugError("Error updating status:", error)
        }
    }

    const getStatusPriority = (status) => {
        const key = String(status || "").toLowerCase()
        if (key === "confirmed") return 0
        if (key === "accepted") return 1
        if (key === "checked-in") return 2
        if (key === "completed") return 3
        if (key === "cancelled") return 4
        return 5
    }

    const getBookingTimestamp = (booking) => {
        const createdAtTs = new Date(booking?.createdAt || "").getTime()
        if (!Number.isNaN(createdAtTs)) return createdAtTs
        const dateTs = new Date(booking?.date || "").getTime()
        if (!Number.isNaN(dateTs)) return dateTs
        return 0
    }

    const isToday = (value) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return false
        return date.toDateString() === new Date().toDateString()
    }

    const isNewRequest = (booking) => {
        if (String(booking?.status || "").toLowerCase() !== "confirmed") return false
        const createdAt = new Date(booking?.createdAt || booking?.date || "").getTime()
        if (Number.isNaN(createdAt)) return true
        return Date.now() - createdAt <= 2 * 60 * 60 * 1000
    }

    const sortedBookings = useMemo(() => {
        return [...bookings].sort((a, b) => {
            const priorityDiff = getStatusPriority(a?.status) - getStatusPriority(b?.status)
            if (priorityDiff !== 0) return priorityDiff
            return getBookingTimestamp(b) - getBookingTimestamp(a)
        })
    }, [bookings])

    const filteredBookings = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        return sortedBookings
            .filter((booking) => {
                if (!term) return true
                return (
                    getBookerName(booking).toLowerCase().includes(term) ||
                    String(booking?.bookingId || "").toLowerCase().includes(term) ||
                    getBookerPhone(booking).toLowerCase().includes(term)
                )
            })
            .filter((booking) => {
                if (activeView === "today") return isToday(booking?.date)
                if (activeView === "new") return isNewRequest(booking)
                return true
            })
    }, [sortedBookings, searchTerm, activeView])

    const newRequestsCount = useMemo(
        () => bookings.filter((booking) => isNewRequest(booking)).length,
        [bookings]
    )

    if (loading) return <Loader />

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-xl sticky top-0 z-30 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4"
                    >
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Table Reservations
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </h1>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Live Queue Management</p>
                        </div>
                    </motion.div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                id="reservation-search"
                                name="reservation-search"
                                placeholder="Search guests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full sm:w-64 pl-11 pr-4 py-2.5 bg-slate-100/50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
                            <button
                                onClick={() => setActiveSection("reservations")}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeSection === "reservations" ? "bg-white text-slate-900 shadow-md shadow-slate-200/50 scale-[1.02]" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Queue
                            </button>
                            <button
                                onClick={() => setActiveSection("media")}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeSection === "media" ? "bg-white text-slate-900 shadow-md shadow-slate-200/50 scale-[1.02]" : "text-slate-400 hover:text-slate-600"}`}
                            >
                                Media
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="flex items-center gap-4 relative">
                            <div className="bg-primary p-3 rounded-xl text-white shadow-lg shadow-orange-200">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Total Bookings</p>
                                <p className="text-3xl font-black text-slate-900 leading-none mt-1">{bookings.length}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="flex items-center gap-4 relative">
                            <div className="bg-emerald-600 p-3 rounded-xl text-white shadow-lg shadow-emerald-200">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Active</p>
                                <p className="text-3xl font-black text-slate-900 leading-none mt-1">
                                    {bookings.filter(b => ['confirmed', 'accepted', 'checked-in'].includes(String(b.status || '').toLowerCase())).length}
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                        <div className="flex items-center gap-4 relative">
                            <div className="bg-orange-600 p-3 rounded-xl text-white shadow-lg shadow-orange-200">
                                <Clock4 className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Today's Bookings</p>
                                <p className="text-3xl font-black text-slate-900 leading-none mt-1">
                                    {bookings.filter(b => new Date(b.date).toDateString() === new Date().toDateString()).length}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="mb-6 md:hidden">
                    <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-1">
                        <button
                            onClick={() => setActiveSection("reservations")}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${activeSection === "reservations" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                        >
                            Reservations
                        </button>
                        <button
                            onClick={() => setActiveSection("media")}
                            className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${activeSection === "media" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                        >
                            Photos & Menu
                        </button>
                    </div>
                </div>

                {activeSection === "media" && (
                <div className="mb-8">
                    <button
                        onClick={() => setShowMediaPanel((prev) => !prev)}
                        className="w-full bg-white rounded-2xl border border-slate-200 px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                        <div>
                            <h2 className="text-left text-base font-bold text-slate-900">Photos & Menu Manager</h2>
                            <p className="text-left text-sm text-slate-500">Upload restaurant and menu images only when needed.</p>
                        </div>
                        {showMediaPanel ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </button>
                </div>
                )}

                {activeSection === "media" && showMediaPanel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Restaurant Photos</h2>
                                <p className="text-sm text-slate-500 mt-1">Add multiple restaurant photos. The first one will be used as the main preview.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer hover:bg-slate-800 transition-colors">
                                <UploadCloud className="w-4 h-4" />
                                {uploadingRestaurantPhoto ? "Uploading..." : "Add Photos"}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleRestaurantPhotoUpload}
                                    disabled={uploadingRestaurantPhoto || removingRestaurantPhoto}
                                />
                            </label>
                        </div>

                        <div className="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-56">
                            {restaurantPhoto ? (
                                <img
                                    src={restaurantPhoto}
                                    alt={restaurant?.restaurantName || restaurant?.name || "Restaurant"}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                    <ImagePlus className="w-8 h-8 mb-2" />
                                    <p className="text-sm font-medium">No restaurant photo added yet</p>
                                </div>
                            )}
                        </div>

                        {restaurantPhotos.length > 0 && (
                            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {restaurantPhotos.map((photo, index) => (
                                    <button
                                        key={`${photo.url}-${index}`}
                                        type="button"
                                        onClick={() => setRestaurantPhoto(photo.url)}
                                        className={`relative h-20 rounded-lg overflow-hidden border bg-slate-50 transition-all ${restaurantPhoto === photo.url ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200"}`}
                                    >
                                        <img
                                            src={photo.url}
                                            alt={`Restaurant photo ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1 py-0.5 text-[10px] font-semibold text-white">
                                            {restaurantPhoto === photo.url ? "Main" : `Photo ${index + 1}`}
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveRestaurantPhoto(photo.url)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    handleRemoveRestaurantPhoto(photo.url)
                                                }
                                            }}
                                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">Menu Photos</h2>
                                <p className="text-sm text-slate-500 mt-1">Add menu photos and view previously uploaded photos.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors">
                                <UploadCloud className="w-4 h-4" />
                                {uploadingMenuPhotos ? "Uploading..." : "Add Photos"}
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    multiple
                                    onChange={handleMenuPhotosUpload}
                                    disabled={uploadingMenuPhotos || removingMenuPhoto}
                                />
                            </label>
                        </div>

                        {menuPhotos.length > 0 ? (
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {menuPhotos.map((photo, index) => (
                                    <div key={`${photo.url}-${index}`} className="relative h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                        <img src={photo.url} alt={`Menu photo ${index + 1}`} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMenuPhoto(photo.url)}
                                            className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm"
                                            disabled={removingMenuPhoto}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="mt-4 h-28 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                                <ImagePlus className="w-7 h-7 mb-2" />
                                <p className="text-sm font-medium">No menu photos added yet</p>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {activeSection === "reservations" && (
                    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-xl">
                                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Dining Controls</p>
                                <h2 className="mt-1 text-lg font-black text-slate-900">Manage dining availability and booking limit</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Save your dining changes as an approval request. They will go live for customers only after admin approval.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${diningEnabled ? "bg-emerald-500" : "bg-rose-500"}`} />
                                    <span className="text-sm font-semibold text-slate-700">
                                        {diningEnabled ? "Dining enabled" : "Dining paused"}
                                    </span>
                                </div>

                                <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2">
                                    <span className="text-sm font-medium text-slate-700">Turn dining on/off</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDiningEnabled((prev) => {
                                                const nextValue = !prev
                                                if (!nextValue) {
                                                    setSelectedDiningCategoryIds([])
                                                    setMaxGuestsLimit(0)
                                                } else {
                                                    setMaxGuestsLimit((current) => Math.max(1, parseInt(current, 10) || 6))
                                                }
                                                return nextValue
                                            })
                                        }}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${diningEnabled ? "bg-emerald-600" : "bg-slate-300"}`}
                                        aria-pressed={diningEnabled}
                                    >
                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${diningEnabled ? "translate-x-6" : "translate-x-1"}`} />
                                    </button>
                                </div>

                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
                                    <span className="text-sm font-medium text-slate-700">Customer limit</span>
                                    <input
                                        type="number"
                                        min={isDiningToggleOn ? "1" : "0"}
                                        value={maxGuestsLimit}
                                        onChange={(e) => setMaxGuestsLimit(e.target.value)}
                                        disabled={!isDiningToggleOn}
                                        className="w-20 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-primary"
                                    />
                                </div>

                            </div>
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Dining categories</p>
                                    <p className="mt-1 text-xs text-slate-500">Choose one or multiple categories for this request.</p>
                                </div>
                                {activeDiningRequest?.requestedAt ? (
                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                                        Approval pending
                                    </span>
                                ) : null}
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {diningCategories.length === 0 ? (
                                    <p className="col-span-2 text-sm text-slate-500">No dining categories available right now.</p>
                                ) : (
                                    diningCategories.map((category) => {
                                        const isSelected = selectedDiningCategoryIds.includes(String(category?._id))
                                        return (
                                            <button
                                                key={category?._id}
                                                type="button"
                                                onClick={() => toggleDiningCategory(category?._id)}
                                                className={`overflow-hidden rounded-2xl border text-left transition-all ${isSelected
                                                    ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-300/40"
                                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:shadow-sm"
                                                    }`}
                                                disabled={!isDiningToggleOn}
                                            >
                                                <div className="relative h-24 w-full overflow-hidden">
                                                    {category?.imageUrl ? (
                                                        <img
                                                            src={category.imageUrl}
                                                            alt={category?.name || "Category"}
                                                            className={`h-full w-full object-cover transition-transform duration-300 ${isSelected ? "scale-105 opacity-80" : "hover:scale-105"}`}
                                                        />
                                                    ) : (
                                                        <div className={`flex h-full w-full items-center justify-center ${isSelected ? "bg-slate-800" : "bg-slate-100"}`}>
                                                            <span className={`text-2xl font-black ${isSelected ? "text-white/90" : "text-slate-400"}`}>
                                                                {String(category?.name || "C").charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className={`absolute inset-0 ${isSelected ? "bg-slate-900/35" : "bg-slate-900/10"}`} />

                                                    {isSelected ? (
                                                        <div className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-900">
                                                            Selected
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="p-3">
                                                    <p className={`text-sm font-bold ${isSelected ? "text-white" : "text-slate-900"}`}>
                                                        {category?.name || "Category"}
                                                    </p>
                                                    <p className={`mt-1 text-[11px] ${isSelected ? "text-white/75" : "text-slate-500"}`}>
                                                        {!isDiningToggleOn ? "Enable dining to select" : isSelected ? "Included in this request" : "Tap to include"}
                                                    </p>
                                                </div>
                                            </button>
                                        )
                                    })
                                )}
                            </div>

                            {activeDiningRequest?.requestedAt ? (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    Pending request: {activeDiningRequest?.isEnabled ? "Dining On" : "Dining Off"}, guest limit {Number(activeDiningRequest?.maxGuests ?? 0)}
                                    {Array.isArray(activeDiningRequest?.categories) && activeDiningRequest.categories.length > 0
                                        ? `, categories ${activeDiningRequest.categories.map((category) => category?.name).filter(Boolean).join(", ")}`
                                        : ""}
                                </div>
                            ) : null}

                            <button
                                type="button"
                                onClick={handleSaveDiningSettings}
                                disabled={savingDiningSettings}
                                className="mt-4 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingDiningSettings ? "Sending..." : "Save settings"}
                            </button>
                        </div>

                        {(diningSettingsMessage || diningSettingsError) && (
                            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${diningSettingsError
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}>
                                {diningSettingsError || diningSettingsMessage}
                            </div>
                        )}
                    </div>
                )}

                {(uploadMessage || uploadError) && (
                    <div className={`mb-6 rounded-xl px-4 py-3 text-sm font-medium border ${uploadError
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-green-50 text-green-700 border-green-200"
                        }`}>
                        {uploadError || uploadMessage}
                    </div>
                )}

                {/* Bookings List */}
                {activeSection === "reservations" && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-bold text-slate-800">Reservation Queue</h2>
                        <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 p-1">
                            <button
                                onClick={() => setActiveView("priority")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeView === "priority" ? "bg-slate-900 text-white" : "text-slate-500"}`}
                            >
                                Priority
                            </button>
                            <button
                                onClick={() => setActiveView("new")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeView === "new" ? "bg-slate-900 text-white" : "text-slate-500"}`}
                            >
                                New ({newRequestsCount})
                            </button>
                            <button
                                onClick={() => setActiveView("today")}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeView === "today" ? "bg-slate-900 text-white" : "text-slate-500"}`}
                            >
                                Today
                            </button>
                        </div>
                    </div>

                    {newRequestsCount > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm font-semibold flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {newRequestsCount} new reservation request{newRequestsCount > 1 ? "s" : ""} waiting for quick action.
                        </div>
                    )}

                    {filteredBookings.length > 0 ? (
                        <>
                            {/* Desktop View Table */}
                            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">ID</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Guest Details</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Schedule</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Guests</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <AnimatePresence mode="popLayout">
                                            {filteredBookings.map((booking) => (
                                                <motion.tr 
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    key={booking._id} 
                                                    className={`hover:bg-slate-50/50 transition-colors ${isNewRequest(booking) ? "bg-amber-50/20" : ""}`}
                                                >
                                                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-400 text-center">#{booking.bookingId}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                                                {getBookerName(booking).charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-900 leading-tight">{getBookerName(booking)}</p>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <Phone className="w-3 h-3 text-slate-400" />
                                                                    <p className="text-xs text-slate-500">{getBookerPhone(booking) || 'No phone'}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                <Calendar className="w-4 h-4 text-primary" />
                                                                {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                                <Clock className="w-4 h-4 text-primary" />
                                                                {booking.timeSlot}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="inline-flex items-center justify-center gap-1.5 font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full text-xs">
                                                            <Users className="w-3 h-3" />
                                                            {booking.guests}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                                String(booking.status || "").toLowerCase() === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                                                                String(booking.status || "").toLowerCase() === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                                String(booking.status || "").toLowerCase() === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                                                String(booking.status || "").toLowerCase() === 'completed' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-rose-100 text-rose-700'
                                                            }`}>
                                                                {booking.status}
                                                            </Badge>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'accepted')}
                                                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                                                >
                                                                    Accept
                                                                </button>
                                                            )}
                                                            {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                                    className="px-3 py-1.5 bg-white border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 transition-colors"
                                                                >
                                                                    Decline
                                                                </button>
                                                            )}
                                                            {String(booking.status || "").toLowerCase() === 'accepted' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                                    className="px-3 py-1.5 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm"
                                                                >
                                                                    Check-in
                                                                </button>
                                                            )}
                                                            {String(booking.status || "").toLowerCase() === 'checked-in' && (
                                                                <button
                                                                    onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                                    className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                                                                >
                                                                    Check-out
                                                                </button>
                                                            )}
                                                            {booking.specialRequest && (
                                                                <button
                                                                    title={booking.specialRequest}
                                                                    className="p-2 text-primary hover:bg-orange-50 rounded-lg transition-colors border border-orange-100 bg-orange-50/50"
                                                                >
                                                                    <MessageSquare className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            ))}
                                        </AnimatePresence>
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View Cards */}
                            <div className="md:hidden space-y-4">
                                <AnimatePresence mode="popLayout">
                                    {filteredBookings.map((booking) => (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            key={booking._id}
                                            className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-100 ${isNewRequest(booking) ? "ring-2 ring-amber-400 ring-inset" : ""}`}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-sm uppercase">
                                                        {getBookerName(booking).charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-black text-slate-900 leading-none">{getBookerName(booking)}</h3>
                                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">#{booking.bookingId}</p>
                                                    </div>
                                                </div>
                                                <Badge className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                    String(booking.status || "").toLowerCase() === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                                                    String(booking.status || "").toLowerCase() === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                                                    String(booking.status || "").toLowerCase() === 'checked-in' ? 'bg-orange-100 text-orange-700' :
                                                    String(booking.status || "").toLowerCase() === 'completed' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {booking.status}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-primary" />
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {new Date(booking.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-primary" />
                                                    <span className="text-xs font-bold text-slate-700">{booking.timeSlot}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-primary" />
                                                    <span className="text-xs font-bold text-slate-700">{booking.guests} Guests</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-primary" />
                                                    <span className="text-xs font-bold text-slate-700 truncate">{getBookerPhone(booking) || 'No phone'}</span>
                                                </div>
                                            </div>

                                            {booking.specialRequest && (
                                                <div className="flex items-start gap-2 p-3 bg-orange-50 text-orange-700 rounded-xl mb-4 text-xs font-medium border border-orange-100">
                                                    <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                                                    <p>{booking.specialRequest}</p>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2">
                                                {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'accepted')}
                                                        className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-black rounded-xl hover:bg-emerald-700 transition-colors uppercase tracking-widest"
                                                    >
                                                        Accept
                                                    </button>
                                                )}
                                                {String(booking.status || "").toLowerCase() === 'confirmed' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'cancelled')}
                                                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-200 transition-colors uppercase tracking-widest"
                                                    >
                                                        Decline
                                                    </button>
                                                )}
                                                {String(booking.status || "").toLowerCase() === 'accepted' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'checked-in')}
                                                        className="flex-1 py-2.5 bg-orange-600 text-white text-xs font-black rounded-xl hover:bg-orange-700 transition-colors uppercase tracking-widest"
                                                    >
                                                        Check-in
                                                    </button>
                                                )}
                                                {String(booking.status || "").toLowerCase() === 'checked-in' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(booking._id, 'completed')}
                                                        className="flex-1 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary/90 transition-colors uppercase tracking-widest"
                                                    >
                                                        Check-out
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </>
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm"
                        >
                            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Calendar className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800">No reservations found</h3>
                            <p className="text-slate-500 mt-2 max-w-xs mx-auto">When guests book a table, they will appear here in your live queue.</p>
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    </div>
    )
}

