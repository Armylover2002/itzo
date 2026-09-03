import { useState, useMemo, useEffect, useRef } from "react"
import { toast } from "react-hot-toast"
import { 
  Search, Filter, Eye, Check, X, UtensilsCrossed, ArrowUpDown, Loader2,
  FileText, Image as ImageIcon, ExternalLink, CreditCard, Calendar, Star, Building2, User, Phone, Mail, MapPin, Clock
} from "lucide-react"
import { adminAPI, restaurantAPI } from "@food/api"
import ApprovalAuditCard from "@food/components/admin/ApprovalAuditCard"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const getZoneLabel = (request) =>
  request?.zone ||
  request?.zoneName ||
  request?.zoneId?.name ||
  request?.zoneId?.zoneName ||
  request?.zoneId?.serviceLocation ||
  "—"

const normalizeRequestRecord = (request) => ({
  ...request,
  zone: getZoneLabel(request),
  fullData: request?.fullData || request,
})

const formatTime12Hour = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return "--:-- --"
  const [h, m] = timeStr.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return timeStr
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`
}

const formatRestaurantId = (restaurant) => {
  if (restaurant?.restaurantId) return `#${restaurant.restaurantId}`
  
  const id = restaurant?._id || restaurant?.id
  if (!id) return "REST000000"

  const idString = String(id)
  const parts = idString.split(/[-.]/)
  let lastDigits = ""

  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1]
    const digits = lastPart.match(/\d+/g)
    if (digits && digits.length > 0) {
      const allDigits = digits.join("")
      lastDigits = allDigits.slice(-6).padStart(6, "0")
    } else {
      const allParts = parts.join("")
      const allDigits = allParts.match(/\d+/g)
      if (allDigits && allDigits.length > 0) {
        const combinedDigits = allDigits.join("")
        lastDigits = combinedDigits.slice(-6).padStart(6, "0")
      }
    }
  }

  if (!lastDigits) {
    const hash = idString.split("").reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0) | 0
    }, 0)
    lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
  }

  return `REST${lastDigits}`
}


export default function JoiningRequest() {
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(currentUser)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(currentUser)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()

    return () => {
      isMounted = false
    }
  }, [currentUser])

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::restaurant_management::restaurants::joining_request", "edit")
  }, [currentUser, resolvedPermissions])

  const [activeTab, setActiveTab] = useState("pending")
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingRequests, setPendingRequests] = useState([])
  const [rejectedRequests, setRejectedRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [restaurantDetails, setRestaurantDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showFilterDialog, setShowFilterDialog] = useState(false)
  const [allZones, setAllZones] = useState([])
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" })
  const [filters, setFilters] = useState({
    zone: "",
    dateFrom: "",
    dateTo: ""
  })

  // Track first render to avoid duplicate fetch in React StrictMode
  const hasFetchedOnceRef = useRef(false)

  // Fetch all zones from DB for filter dropdown
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await adminAPI.getZones()
        let list = []
        if (Array.isArray(res?.data?.data)) {
          list = res.data.data
        } else if (Array.isArray(res?.data?.zones)) {
          list = res.data.zones
        } else if (Array.isArray(res?.data)) {
          list = res.data
        } else if (res?.data?.data?.zones && Array.isArray(res.data.data.zones)) {
          list = res.data.data.zones
        }
        setAllZones(list)
      } catch (err) {
        debugError("Error fetching zones:", err)
      }
    }
    fetchZones()
  }, [])

  const handleSort = (key) => {
    let direction = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  // Fetch restaurant join requests
  useEffect(() => {
    // On first render, fetch once for initial tab (usually "pending")
    if (!hasFetchedOnceRef.current) {
      hasFetchedOnceRef.current = true
      fetchRequests()
      return
    }

    // On subsequent tab changes, refetch only when switching away from "pending"
    if (activeTab !== "pending") {
      fetchRequests()
    }
  }, [activeTab])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await adminAPI.getPendingRestaurants()
      const list = (response?.data?.data || []).map((request) =>
        normalizeRequestRecord(request),
      )
      if (activeTab === "pending") {
        setPendingRequests(list.filter((r) => r.status === "pending"))
      } else {
        setRejectedRequests(list.filter((r) => r.status === "rejected"))
      }
    } catch (err) {
      debugError("Error fetching restaurant requests:", err)
      setError(err.message || "Failed to fetch restaurant requests")
      if (activeTab === "pending") {
        setPendingRequests([])
      } else {
        setRejectedRequests([])
      }
    } finally {
      setLoading(false)
    }
  }

  const currentRequests = activeTab === "pending" ? pendingRequests : rejectedRequests

  // Get unique zones (from DB) for filter options
  const filterOptions = useMemo(() => {
    const zonesList = Array.isArray(allZones) ? allZones : []
    const zones = zonesList.map(z => ({
      id: z?._id || z?.id,
      name: z?.name || z?.zoneName || z?.serviceLocation || z?._id || "Unknown Zone"
    }))
    return { zones }
  }, [allZones, currentRequests])

  const filteredRequests = useMemo(() => {
    let filtered = currentRequests

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(request =>
        request.restaurantName?.toLowerCase().includes(query) ||
        request.ownerName?.toLowerCase().includes(query) ||
        request.ownerPhone?.includes(query)
      )
    }

    // Apply zone filter
    if (filters.zone) {
      filtered = filtered.filter(request => request.zone === filters.zone)
    }

    // Apply date range filter
    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter(request => {
        if (!request.createdAt) return false
        const requestDate = new Date(request.createdAt).setHours(0, 0, 0, 0)
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom).setHours(0, 0, 0, 0)
          if (requestDate < fromDate) return false
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo).setHours(23, 59, 59, 999)
          if (requestDate > toDate) return false
        }
        return true
      })
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        let aValue, bValue

        switch (sortConfig.key) {
          case "restaurantName":
            aValue = (a.restaurantName || "").toLowerCase()
            bValue = (b.restaurantName || "").toLowerCase()
            break
          case "ownerName":
            aValue = (a.ownerName || "").toLowerCase()
            bValue = (b.ownerName || "").toLowerCase()
            break
          case "zone":
            aValue = (a.zone || "").toLowerCase()
            bValue = (b.zone || "").toLowerCase()
            break
          case "status":
            aValue = (a.status || "").toLowerCase()
            bValue = (b.status || "").toLowerCase()
            break
          case "createdAt":
            aValue = new Date(a.createdAt || 0).getTime()
            bValue = new Date(b.createdAt || 0).getTime()
            break
          default:
            aValue = a[sortConfig.key]
            bValue = b[sortConfig.key]
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [currentRequests, searchQuery, filters, sortConfig])

  const clearFilters = () => {
    setFilters({
      zone: "",
      dateFrom: "",
      dateTo: ""
    })
  }

  const hasActiveFilters = filters.zone || filters.dateFrom || filters.dateTo

  const handleApprove = async (request) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    try {
      setProcessing(true)
      await adminAPI.approveRestaurant(request._id)
      
      // Refresh the list
      await fetchRequests()
      
      toast.success(`Successfully approved ${request.restaurantName}'s join request!`)
    } catch (err) {
      debugError("Error approving request:", err)
      toast.error(err.response?.data?.message || "Failed to approve request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = (request) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    setSelectedRequest(request)
    setRejectionReason("")
    setShowRejectDialog(true)
  }

  const confirmReject = async () => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!selectedRequest || !rejectionReason.trim()) {
      alert("Please provide a rejection reason")
      return
    }

    try {
      setProcessing(true)
      await adminAPI.rejectRestaurant(selectedRequest._id, rejectionReason)
      
      // Refresh the list
      await fetchRequests()
      
      setShowRejectDialog(false)
      setSelectedRequest(null)
      setRejectionReason("")
      
      alert(`Successfully rejected ${selectedRequest.restaurantName}'s join request!`)
    } catch (err) {
      debugError("Error rejecting request:", err)
      alert(err.response?.data?.message || "Failed to reject request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const formatPhone = (phone) => {
    if (!phone) return "N/A"
    return phone
  }

  // Handle view restaurant details
  const handleViewDetails = async (request) => {
    setSelectedRequest(request)
    setShowDetailsModal(true)
    setLoadingDetails(true)
    setRestaurantDetails(null)
    
    try {
      // First, use fullData if available (has all details from API)
      if (request.fullData) {
        debugLog("Using fullData from request:", request.fullData)
        setRestaurantDetails(request.fullData)
        setLoadingDetails(false)
        return
      }
      
      // Try to fetch full restaurant details from API
      const restaurantId = request._id || request.id
      let response = null
      
      if (restaurantId) {
        try {
          // Try admin API first
          if (adminAPI.getRestaurantById) {
            response = await adminAPI.getRestaurantById(restaurantId)
          }
        } catch (err) {
          debugLog("Admin API failed, trying restaurant API:", err)
        }
        
        // Fallback to regular restaurant API
        if (!response || !response?.data?.success) {
          try {
            response = await restaurantAPI.getRestaurantById(restaurantId)
          } catch (err) {
            debugLog("Restaurant API also failed:", err)
          }
        }
      }
      
      // Check response structure
      if (response?.data?.success) {
        const data = response.data.data
        if (data?.restaurant) {
          setRestaurantDetails(data.restaurant)
        } else if (data) {
          setRestaurantDetails(data)
        } else {
          setRestaurantDetails(request)
        }
      } else {
        // Use the request data we already have
        setRestaurantDetails(request)
      }
    } catch (err) {
      debugError("Error fetching restaurant details:", err)
      // Use the request data we already have
      setRestaurantDetails(request)
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeDetailsModal = () => {
    setShowDetailsModal(false)
    setSelectedRequest(null)
    setRestaurantDetails(null)
  }

  const getNormalizedImageUrl = (image) => {
    if (!image) return ""
    if (typeof image === "string") return image
    return image?.url || ""
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">New Restaurant Join Request</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pending"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending Requests
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "rejected"
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Rejected Request
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by restaurant name, owner name or phone"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowFilterDialog(true)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border transition-all flex items-center gap-2 ${
                  hasActiveFilters 
                    ? "border-primary bg-[#f7f3fc] text-[#460d8b] hover:bg-[#f0e7f9]" 
                    : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                }`}
              >
                <Filter className="w-4 h-4" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-primary text-white text-xs rounded-full">
                    {[filters.zone, filters.dateFrom, filters.dateTo].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider"
                  >
                    SL
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("restaurantName")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Restaurant Info</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "restaurantName" ? "text-primary" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("ownerName")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Owner Info</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "ownerName" ? "text-primary" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("zone")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Zone</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "zone" ? "text-primary" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "status" ? "text-primary" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                      <p className="text-lg font-semibold text-slate-700">Loading restaurant requests...</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <p className="text-lg font-semibold text-red-600 mb-1">Error: {error}</p>
                      <p className="text-sm text-slate-500">Failed to load restaurant requests. Please try again.</p>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No restaurant requests match your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request, index) => (
                    <tr key={request._id || request.id || `${request.restaurantName}-${index}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer hover:opacity-80 transition-all"
                            onClick={() => handleViewDetails(request)}
                          >
                            <img
                              src={
                                getNormalizedImageUrl(request?.coverImages?.[0]) ||
                                (typeof request.profileImage === "string"
                                  ? request.profileImage
                                  : (request.profileImage?.url || request.profileImageUrl?.url || request.restaurantImage)) ||
                                "https://via.placeholder.com/40?text=" + (request.restaurantName?.slice(0, 2) || "R").toUpperCase()
                              }
                              alt={request.restaurantName || "Restaurant"}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = "https://via.placeholder.com/40?text=" + (request.restaurantName?.slice(0, 2) || "R").toUpperCase()
                              }}
                            />
                          </div>
                          <span 
                            className="text-sm font-medium text-slate-900 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleViewDetails(request)}
                          >
                            {request.restaurantName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-900">{request.ownerName}</span>
                          <span className="text-xs text-slate-500">{formatPhone(request.ownerPhone)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{request.zone || "—"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          request.status === "Pending" || request.status === "pending"
                            ? (request?.reVerification?.isZoneUpdate || request?.reVerification?.reVerificationReason === 'FSSAI License Update' ? "bg-[#f0e7f9] text-[#460d8b]" : "bg-[#f0e7f9] text-[#460d8b]")
                            : "bg-red-100 text-red-700"
                        }`}>
                          {request?.reVerification?.isZoneUpdate || request?.reVerification?.reVerificationReason === 'FSSAI License Update' ? "Re-verification" : request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetails(request)}
                            className="p-1.5 rounded-full bg-[#f7f3fc] text-primary hover:bg-[#f0e7f9] transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {activeTab === "pending" && canEdit && (
                            <>
                              <button
                                onClick={() => handleApprove(request)}
                                disabled={processing}
                                className="p-1.5 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(request)}
                                disabled={processing}
                                className="p-1.5 rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Filter Dialog */}
      {showFilterDialog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFilterDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#f0e7f9] flex items-center justify-center">
                    <Filter className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Filter Requests</h3>
                    <p className="text-xs text-slate-500">Apply filters to refine your search</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Zone Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Zone
                  </label>
                  <select
                    value={filters.zone}
                    onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">All Zones</option>
                    {filterOptions.zones.map((z) => (
                      <option key={z.id} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date Range Filters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                      min={filters.dateFrom}
                      className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setShowFilterDialog(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowRejectDialog(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Reject Restaurant Request</h3>
                  <p className="text-sm text-slate-600">{selectedRequest.restaurantName}</p>
                </div>
              </div>
              
              <p className="text-sm text-slate-700 mb-4">
                Are you sure you want to reject this restaurant request? Please provide a reason for rejection.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={4}
                  disabled={processing || !canEdit}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowRejectDialog(false)
                    setSelectedRequest(null)
                    setRejectionReason("")
                  }}
                  disabled={processing}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReject}
                  disabled={processing || !rejectionReason.trim() || !canEdit}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </span>
                  ) : (
                    "Reject Request"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Details Side Panel */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm transition-opacity" onClick={closeDetailsModal} />
          
          <div 
            className="relative w-full max-w-4xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#f7f3fc] flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Restaurant Details - {selectedRequest.restaurantName || "N/A"}</h2>
              </div>
              <button
                onClick={closeDetailsModal}
                className="p-2 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600 border border-transparent hover:border-slate-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {loadingDetails && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="ml-3 text-slate-600">Loading details...</span>
                </div>
              )}
              {!loadingDetails && (restaurantDetails || selectedRequest) && (() => {
                const r = restaurantDetails || selectedRequest
                const restaurantPhotoList = Array.isArray(r?.coverImages) ? r.coverImages.filter(Boolean) : []
                const profileImgUrl =
                  getNormalizedImageUrl(restaurantPhotoList[0]) ||
                  (typeof r?.profileImage === "string" ? r.profileImage : (r?.profileImage?.url || r?.profileImageUrl?.url || r?.restaurantImage))
                const addressParts = [
                  r?.addressLine1,
                  r?.addressLine2,
                  r?.area,
                  r?.city,
                  r?.landmark,
                  r?.location?.addressLine1,
                  r?.location?.addressLine2,
                  r?.location?.area,
                  r?.location?.city,
                  r?.onboarding?.step1?.location?.addressLine1,
                  r?.onboarding?.step1?.location?.area,
                  r?.onboarding?.step1?.location?.city
                ].filter(Boolean)
                const hasAddress = addressParts.length > 0 || r?.location || r?.onboarding?.step1?.location
                const openingTime = r?.openingTime || r?.deliveryTimings?.openingTime || r?.onboarding?.step2?.deliveryTimings?.openingTime
                const closingTime = r?.closingTime || r?.deliveryTimings?.closingTime || r?.onboarding?.step2?.deliveryTimings?.closingTime
                const approvalStatus = r?.status || (r?.isActive !== false ? "approved" : "pending")
                const hasFlatDocs = r?.panNumber || r?.panImage || r?.fssaiNumber || r?.accountNumber
                const menuImgList = Array.isArray(r?.menuImages) ? r.menuImages : (r?.onboarding?.step2?.menuImageUrls || [])
                return (
                <div className="space-y-6">
                  {/* Restaurant Basic Info */}
                  <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <img
                        src={profileImgUrl || "https://via.placeholder.com/96"}
                        alt={r?.restaurantName || r?.name || "Restaurant"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/96"
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {r?.restaurantName || r?.name || "N/A"}
                      </h3>
                      <div className="flex items-center gap-4 flex-wrap">
                        {r?.rating != null && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium text-slate-700">
                              {Number(r.rating).toFixed(1)} ({(r.totalRatings || 0)} reviews)
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-slate-600">
                          <Building2 className="w-4 h-4" />
                          <span className="text-sm">{formatRestaurantId(r)}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          approvalStatus === "approved" ? "bg-green-100 text-green-700" : (approvalStatus === "rejected" || approvalStatus === "Rejected") ? "bg-red-100 text-red-700" : (r?.reVerification?.isZoneUpdate || r?.reVerification?.reVerificationReason === 'FSSAI License Update' ? "bg-[#f0e7f9] text-[#460d8b]" : "bg-amber-100 text-amber-700")
                        }`}>
                          {approvalStatus === "approved" ? "Approved" : (approvalStatus === "rejected" || approvalStatus === "Rejected") ? "Rejected" : (r?.reVerification?.isZoneUpdate || r?.reVerification?.reVerificationReason === 'FSSAI License Update' ? "Re-verification" : "Pending Approval")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Owner Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Owner Information</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <User className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Owner Name</p>
                            <p className="text-sm font-medium text-slate-900">{r?.ownerName || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-5 h-5 text-slate-400" />
                          <div>
                            <p className="text-xs text-slate-500">Phone</p>
                            <p className="text-sm font-medium text-slate-900">{r?.ownerPhone || r?.phone || "N/A"}</p>
                          </div>
                        </div>
                        {(r?.ownerEmail || r?.email) && (
                          <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">User Id</p>
                              <p className="text-sm font-medium text-slate-900">{r.ownerEmail || r.email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Zone Update Warning (if applicable) */}
                    {r?.reVerification?.isZoneUpdate && (
                      <div className="md:col-span-2">
                        <div className="bg-[#f7f3fc] border border-[#d8c4f1] rounded-lg p-4 mb-2">
                          <h4 className="text-sm font-bold text-[#28074f] mb-1 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Region/Zone Edit Request
                          </h4>
                          <p className="text-xs text-[#370a6d]">
                            The restaurant has updated their business location. Please review the changes below before approval.
                          </p>
                          {r.reVerification.reVerificationReason && (
                            <div className="mt-2 pt-2 border-t border-[#d8c4f1]">
                              <p className="text-xs font-bold text-[#28074f]">Reason for Re-verification:</p>
                              <p className="text-xs text-[#370a6d]">{r.reVerification.reVerificationReason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* FSSAI Update Warning (if applicable) */}
                    {!r?.reVerification?.isZoneUpdate && r?.reVerification?.reVerificationReason === 'FSSAI License Update' && (
                      <div className="md:col-span-2">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-2">
                          <h4 className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            FSSAI License Update Request
                          </h4>
                          <p className="text-xs text-amber-800">
                            The restaurant has updated their FSSAI license details. Please review the new license number, expiry, and document before approval.
                          </p>
                          <div className="mt-2 pt-2 border-t border-amber-200">
                            <p className="text-xs font-bold text-amber-900">Reason for Re-verification:</p>
                            <p className="text-xs text-amber-800">FSSAI License Update</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Location & Contact */}
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Location & Contact</h4>
                      <div className="space-y-3">
                        {(hasAddress || r?.zone || r?.reVerification) && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              {r?.reVerification?.isZoneUpdate ? (
                                <div className="space-y-4">
                                  <div>
                                    <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Updated Address</p>
                                    <p className="text-sm font-medium text-slate-900 bg-[#f7f3fc] p-2 rounded border border-[#f0e7f9]">
                                      {r.location?.formattedAddress || "N/A"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Previous Address</p>
                                    <p className="text-sm text-slate-600 line-through opacity-70">
                                      {r.reVerification.previousAddress || "N/A"}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                    <div>
                                      <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Updated Zone</p>
                                      <p className="text-sm font-medium text-slate-900">
                                        {r.reVerification.updatedZone || r.zone || "N/A"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Previous Zone</p>
                                      <p className="text-sm text-slate-500 line-through opacity-70">
                                        {r.reVerification.previousZone || "N/A"}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs text-slate-500">Address</p>
                                  <p className="text-sm font-medium text-slate-900">
                                    {r?.formattedAddress || 
                                     [r?.addressLine1, r?.addressLine2, r?.area, r?.city, r?.landmark].filter(Boolean).join(", ") ||
                                     [r?.location?.addressLine1, r?.location?.addressLine2, r?.location?.area, r?.location?.city].filter(Boolean).join(", ") ||
                                     [r?.onboarding?.step1?.location?.addressLine1, r?.onboarding?.step1?.location?.addressLine2, r?.onboarding?.step1?.location?.area, r?.onboarding?.step1?.location?.city].filter(Boolean).join(", ") ||
                                     r?.zone || "—"}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                        {(r?.primaryContactNumber || r?.phone) && (
                          <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Primary Contact</p>
                              <p className="text-sm font-medium text-slate-900">{r.primaryContactNumber || r.phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cuisine & Timings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Cuisine & Details</h4>
                      <div className="space-y-3">

                        {typeof r?.pureVegRestaurant === "boolean" && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Food Type</p>
                            <p className="text-sm font-medium text-slate-900">
                              {r.pureVegRestaurant ? "Pure Veg" : "Mixed"}
                            </p>
                          </div>
                        )}
                        {r?.offer && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Current Offer</p>
                            <p className="text-sm font-medium text-green-600">{r.offer}</p>
                          </div>
                        )}
                        {r?.featuredDish && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Featured Dish</p>
                            <p className="text-sm font-medium text-slate-900">{r.featuredDish}</p>
                            {r.featuredPrice != null && <p className="text-xs text-green-600 mt-1">₹{r.featuredPrice}</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Timings & Status</h4>
                      <div className="space-y-3">
                        {(openingTime || closingTime) && (
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500">Opening / Closing</p>
                              <p className="text-sm font-medium text-slate-900">
                                {formatTime12Hour(openingTime)} – {formatTime12Hour(closingTime)}
                              </p>
                            </div>
                          </div>
                        )}
                        {r?.estimatedDeliveryTime && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Estimated Delivery Time</p>
                            <p className="text-sm font-medium text-slate-900">{r.estimatedDeliveryTime}</p>
                          </div>
                        )}
                        {r?.openDays && Array.isArray(r.openDays) && r.openDays.length > 0 && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Open Days</p>
                            <div className="flex flex-wrap gap-2">
                              {r.openDays.map((day, idx) => (
                                <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium capitalize">
                                  {day}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Approval Status</p>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            approvalStatus === "approved" ? "bg-green-100 text-green-700" : approvalStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {approvalStatus === "approved" ? "Approved" : approvalStatus === "rejected" ? "Rejected" : "Pending"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registration Documents – flat schema (PAN, GST, FSSAI, Bank) */}
                  {restaurantPhotoList.length > 0 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Restaurant Photos</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {restaurantPhotoList.map((restaurantImg, idx) => {
                          const imgUrl = getNormalizedImageUrl(restaurantImg)
                          return imgUrl ? (
                            <a
                              key={idx}
                              href={imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-200 hover:border-primary transition-colors"
                            >
                              <img
                                src={imgUrl}
                                alt={`Restaurant ${idx + 1}`}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/200"
                                }}
                              />
                            </a>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  {(hasFlatDocs || r?.onboarding?.step3) && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration Documents</h4>
                      <div className="space-y-6">
                        {/* PAN – flat: panNumber, nameOnPan, panImage */}
                        {(r.panNumber || r.panImage || r?.onboarding?.step3?.pan) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              PAN Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(r.panNumber || r?.onboarding?.step3?.pan?.panNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">PAN Number</p>
                                  <p className="font-medium text-slate-900">{r.panNumber || r.onboarding?.step3?.pan?.panNumber}</p>
                                </div>
                              )}
                              {(r.nameOnPan || r?.onboarding?.step3?.pan?.nameOnPan) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Name on PAN</p>
                                  <p className="font-medium text-slate-900">{r.nameOnPan || r.onboarding?.step3?.pan?.nameOnPan}</p>
                                </div>
                              )}
                              {(typeof r.panImage === "string" ? r.panImage : r?.panImage?.url || r?.onboarding?.step3?.pan?.image?.url) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">PAN Document</p>
                                  <a
                                    href={typeof r.panImage === "string" ? r.panImage : (r.panImage?.url || r.onboarding?.step3?.pan?.image?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-primary hover:text-primary-hover"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View PAN Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* GST – flat: gstRegistered, gstNumber, gstLegalName, gstAddress, gstImage */}
                        {(r.gstRegistered != null || r.gstNumber || r?.onboarding?.step3?.gst) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              GST Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-xs text-slate-500 mb-1">GST Registered</p>
                                <p className="font-medium text-slate-900">
                                  {r.gstRegistered != null ? (r.gstRegistered ? "Yes" : "No") : (r?.onboarding?.step3?.gst?.isRegistered ? "Yes" : "No")}
                                </p>
                              </div>
                              {(r.gstNumber || r?.onboarding?.step3?.gst?.gstNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">GST Number</p>
                                  <p className="font-medium text-slate-900">{r.gstNumber || r.onboarding?.step3?.gst?.gstNumber}</p>
                                </div>
                              )}
                              {(r.gstLegalName || r?.onboarding?.step3?.gst?.legalName) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Legal Name</p>
                                  <p className="font-medium text-slate-900">{r.gstLegalName || r.onboarding?.step3?.gst?.legalName}</p>
                                </div>
                              )}
                              {(r.gstAddress || r?.onboarding?.step3?.gst?.address) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-1">GST Address</p>
                                  <p className="font-medium text-slate-900">{r.gstAddress || r.onboarding?.step3?.gst?.address}</p>
                                </div>
                              )}
                              {(typeof r.gstImage === "string" ? r.gstImage : r?.gstImage?.url || r?.onboarding?.step3?.gst?.image?.url) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">GST Document</p>
                                  <a
                                    href={typeof r.gstImage === "string" ? r.gstImage : (r.gstImage?.url || r.onboarding?.step3?.gst?.image?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-primary hover:text-primary-hover"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View GST Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* FSSAI – flat: fssaiNumber, fssaiExpiry, fssaiImage */}
                        {(r.fssaiNumber || r.fssaiExpiry || r?.onboarding?.step3?.fssai) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              FSSAI Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(r.fssaiNumber || r?.onboarding?.step3?.fssai?.registrationNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Registration Number</p>
                                  <p className="font-medium text-slate-900">{r.fssaiNumber || r.onboarding?.step3?.fssai?.registrationNumber}</p>
                                </div>
                              )}
                              {(r.fssaiExpiry || r?.onboarding?.step3?.fssai?.expiryDate) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">FSSAI Expiry Date</p>
                                  <p className="font-medium text-slate-900">
                                    {new Date(r.fssaiExpiry || r.onboarding?.step3?.fssai?.expiryDate).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              )}
                              {(typeof r.fssaiImage === "string" ? r.fssaiImage : r?.fssaiImage?.url || r?.onboarding?.step3?.fssai?.image?.url) && (
                                <div className="md:col-span-2">
                                  <p className="text-xs text-slate-500 mb-2">FSSAI Document</p>
                                  <a
                                    href={typeof r.fssaiImage === "string" ? r.fssaiImage : (r.fssaiImage?.url || r.onboarding?.step3?.fssai?.image?.url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-primary hover:text-primary-hover"
                                  >
                                    <ImageIcon className="w-4 h-4" />
                                    <span>View FSSAI Document</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Bank – flat: accountNumber, ifscCode, accountHolderName, accountType */}
                        {(r.accountNumber || r.ifscCode || r?.onboarding?.step3?.bank) && (
                          <div className="bg-slate-50 rounded-lg p-4">
                            <h5 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                              <CreditCard className="w-4 h-4" />
                              Bank Details
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {(r.accountNumber || r?.onboarding?.step3?.bank?.accountNumber) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Number</p>
                                  <p className="font-medium text-slate-900">{r.accountNumber || r.onboarding?.step3?.bank?.accountNumber}</p>
                                </div>
                              )}
                              {(r.ifscCode || r?.onboarding?.step3?.bank?.ifscCode) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">IFSC Code</p>
                                  <p className="font-medium text-slate-900">{r.ifscCode || r.onboarding?.step3?.bank?.ifscCode}</p>
                                </div>
                              )}
                              {(r.accountHolderName || r?.onboarding?.step3?.bank?.accountHolderName) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Holder Name</p>
                                  <p className="font-medium text-slate-900">{r.accountHolderName || r.onboarding?.step3?.bank?.accountHolderName}</p>
                                </div>
                              )}
                              {(r.accountType || r?.onboarding?.step3?.bank?.accountType) && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Account Type</p>
                                  <p className="font-medium text-slate-900 capitalize">{r.accountType || r.onboarding?.step3?.bank?.accountType}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Menu Images */}
                  {menuImgList.length > 0 && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Menu Images</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {menuImgList.map((menuImg, idx) => {
                          const imgUrl = typeof menuImg === "string" ? menuImg : (menuImg?.url || menuImg)
                          return imgUrl ? (
                            <a
                              key={idx}
                              href={imgUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg overflow-hidden border border-slate-200 hover:border-primary transition-colors"
                            >
                              <img
                                src={imgUrl}
                                alt={`Menu ${idx + 1}`}
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  e.target.src = "https://via.placeholder.com/200"
                                }}
                              />
                            </a>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}

                  {/* Registration & approval info */}
                  {(r?.createdAt || r?.restaurantId || r?.approvedAt != null) && (
                    <div className="pt-6 border-t border-slate-200">
                      <h4 className="text-lg font-semibold text-slate-900 mb-4">Registration & Approval</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {r.createdAt && (
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-slate-400" />
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Registration Date & Time</p>
                              <p className="font-medium text-slate-900">
                                {new Date(r.createdAt).toLocaleString('en-IN', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        )}
                        {(r.restaurantId || r._id) && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Restaurant ID</p>
                            <p className="font-medium text-slate-900">{formatRestaurantId(r)}</p>
                          </div>
                        )}
                        {r.approvedAt != null && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Approved At</p>
                            <p className="font-medium text-slate-900">{new Date(r.approvedAt).toLocaleString('en-IN')}</p>
                          </div>
                        )}
                        {r.phoneVerified !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Phone Verified</p>
                            <p className="font-medium text-slate-900">{r.phoneVerified ? "Yes" : "No"}</p>
                          </div>
                        )}
                        {r.signupMethod && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Signup Method</p>
                            <p className="font-medium text-slate-900 capitalize">{r.signupMethod}</p>
                          </div>
                        )}
                        {r?.onboarding?.completedSteps != null && (
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Onboarding Steps Completed</p>
                            <p className="font-medium text-slate-900">{r.onboarding.completedSteps} / 4</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rejection Reason (if rejected) */}
                  {r?.rejectionReason && (
                    <div className="pt-6 border-t border-slate-200">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-lg font-semibold text-red-900 mb-2">Rejection Reason</h4>
                        <p className="text-sm text-red-800">{r.rejectionReason}</p>
                        {r.rejectedAt && (
                          <p className="text-xs text-red-600 mt-2">
                            Rejected on: {new Date(r.rejectedAt).toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <ApprovalAuditCard
                    className="pt-6 border-t border-slate-200"
                    approvedBy={r?.approvedBy || null}
                    rejectedBy={r?.rejectedBy || null}
                    rejectionReason={r?.rejectionReason || ""}
                  />
                </div>
                )
              })()}
              {!loadingDetails && !restaurantDetails && !selectedRequest && (
                <div className="flex flex-col items-center justify-center py-20">
                  <p className="text-lg font-semibold text-slate-700 mb-2">No Details Available</p>
                  <p className="text-sm text-slate-500">Unable to load restaurant details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


