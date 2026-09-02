import { useState, useMemo, useEffect } from "react"
import { Search, Filter, Eye, Check, X, Package, ArrowUpDown, FileText, FileSpreadsheet, Loader2, Download, ExternalLink, Calendar, MapPin, CreditCard, User, Mail, Phone, Bike, FileCheck, RotateCw, Sparkles } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportJoinRequestsToExcel, exportJoinRequestsToPDF } from "@food/components/admin/deliveryman/joinRequestExportUtils"
import ApprovalAuditCard from "@food/components/admin/ApprovalAuditCard"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function JoinRequest() {
  const [activeTab, setActiveTab] = useState("pending")
  const [applicationTypeTab, setApplicationTypeTab] = useState("all") // "all" | "new" | "reapplied"
  const [searchQuery, setSearchQuery] = useState("")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isApproveOpen, setIsApproveOpen] = useState(false)
  const [isDenyOpen, setIsDenyOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [viewDetails, setViewDetails] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [filters, setFilters] = useState({
    zone: "",
    jobType: "",
    vehicleType: "",
    applicationType: "",
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [allZones, setAllZones] = useState([])

  // Fetch all zones for the filter dropdown
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await adminAPI.getZones({ limit: 1000 })
        if (response.data && response.data.success) {
          setAllZones(response.data.data.zones || [])
        }
      } catch (err) {
        debugError("Error fetching zones:", err)
      }
    }
    fetchZones()
  }, [])

  // Debounce search so we don't fetch on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch join requests from API (single source of truth for when to fetch)
  const fetchJoinRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {
        status: activeTab === "pending" ? "pending" : "denied",
        page: 1,
        limit: 1000,
      }

      if (activeTab === "pending" && applicationTypeTab !== "all") {
        params.applicationType = applicationTypeTab
      }

      if (filters.applicationType) {
        params.applicationType = filters.applicationType
      }

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim()
      }
      if (filters.zone) {
        params.zone = filters.zone
      }
      if (filters.vehicleType) {
        params.vehicleType = filters.vehicleType.toLowerCase()
      }

      const response = await adminAPI.getDeliveryPartnerJoinRequests(params)
      
      if (response.data && response.data.success) {
        setRequests(response.data.data.requests || [])
      } else {
        setError("Failed to fetch join requests")
        setRequests([])
      }
    } catch (err) {
      debugError("Error fetching join requests:", err)
      
      // Better error handling
      let errorMessage = "Failed to fetch join requests. Please try again."
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = "Network error. Please check if backend server is running."
      } else if (err.response?.status === 401) {
        errorMessage = "Unauthorized. Please login again."
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to view this."
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  // Single effect: fetch only when tab, sub-tab, debounced search, filters, or filter dialog state change
  useEffect(() => {
    if (!isFilterOpen) {
      fetchJoinRequests()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, applicationTypeTab, debouncedSearch, filters, isFilterOpen])

  const filteredRequests = useMemo(() => {
    let result = [...requests]
    
    // Client-side filtering for additional filters not supported by backend
    if (filters.jobType) {
      result = result.filter(request => request.jobType === filters.jobType)
    }

    return result
  }, [requests, filters])

  const handleApprove = (request) => {
    setSelectedRequest(request)
    setIsApproveOpen(true)
  }

  const confirmApprove = async () => {
    if (!selectedRequest) return

    try {
      setProcessing(true)
      await adminAPI.approveDeliveryPartner(selectedRequest._id)
      
      // Refresh the list
      await fetchJoinRequests()
      
      setIsApproveOpen(false)
      setSelectedRequest(null)
      
      toast.success(`Successfully approved ${selectedRequest.name}'s join request!`)
    } catch (err) {
      debugError("Error approving request:", err)
      const msg = err.response?.data?.message ?? err.response?.data?.error ?? err?.message
      toast.error(msg || "Failed to approve request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleDeny = (request) => {
    setSelectedRequest(request)
    setRejectionReason("")
    setIsDenyOpen(true)
  }

  const confirmDeny = async () => {
    if (!selectedRequest) return

    // Validate rejection reason
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection")
      return
    }

    try {
      setProcessing(true)
      await adminAPI.rejectDeliveryPartner(selectedRequest._id, rejectionReason.trim())
      
      // Refresh the list
      await fetchJoinRequests()
      
      setIsDenyOpen(false)
      setSelectedRequest(null)
      setRejectionReason("")
      
      toast.success(`Successfully rejected ${selectedRequest.name}'s join request.`)
    } catch (err) {
      debugError("Error rejecting request:", err)
      const msg = err.response?.data?.message ?? err.response?.data?.error ?? err?.message
      toast.error(msg || "Failed to reject request. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleView = async (request) => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryPartnerById(request._id)
      
      if (response.data && response.data.success) {
        setViewDetails(response.data.data.delivery)
        setIsViewOpen(true)
      } else {
        toast.error("Failed to load details")
      }
    } catch (err) {
      debugError("Error fetching details:", err)
      toast.error(err.response?.data?.message || "Failed to load details")
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (filteredRequests.length === 0) {
      toast.error("No data to export")
      return
    }
    exportJoinRequestsToPDF(filteredRequests)
  }

  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      toast.error("No data to export")
      return
    }
    exportJoinRequestsToExcel(filteredRequests)
  }

  const handleResetFilters = () => {
    setFilters({ zone: "", jobType: "", vehicleType: "", applicationType: "" })
    setApplicationTypeTab("all")
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setApplicationTypeTab("all")
    setSearchQuery("") // Reset search when changing tabs
    setFilters({ zone: "", jobType: "", vehicleType: "", applicationType: "" }) // Reset filters
  }

  const activeFiltersCount = Object.values(filters).filter(v => v).length
  const vehicleTypes = [...new Set(requests.map(r => r.vehicleType))].filter(Boolean)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">New Joining Request</h1>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
            <button
              onClick={() => handleTabChange("pending")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "pending"
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Pending Delivery Man
            </button>
            <button
              onClick={() => handleTabChange("denied")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "denied"
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Denied Deliveryman
            </button>
          </div>

          {/* Sub-tabs for Pending Applications */}
          {activeTab === "pending" && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <button
                onClick={() => setApplicationTypeTab("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  applicationTypeTab === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Pending ({requests.length})
              </button>
              <button
                onClick={() => setApplicationTypeTab("new")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  applicationTypeTab === "new"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                <Sparkles className="w-3 h-3" />
                New Apply
              </button>
              <button
                onClick={() => setApplicationTypeTab("reapplied")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  applicationTypeTab === "reapplied"
                    ? "bg-purple-600 text-white shadow-sm shadow-purple-600/20"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                }`}
              >
                <RotateCw className="w-3 h-3" />
                Re-applied
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsFilterOpen(true)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all relative ${
                  activeFiltersCount > 0 ? "border-emerald-500 bg-emerald-50" : ""
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-black font-bold">Filter</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
                title="Export as PDF"
              >
                <FileText className="w-4 h-4" />
                <span className="text-black font-bold">PDF</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
                title="Export as Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-black font-bold">Excel</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchJoinRequests}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-sm text-slate-600">Loading requests...</span>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>SI</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Contact</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Type</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Zone</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>City</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Vehicle Type</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center">
                        <p className="text-sm text-slate-500">
                          {error ? "Error loading requests" : "No requests found"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((request) => (
                      <tr key={request._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{request.sl}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-all border border-slate-100"
                              onClick={() => handleView(request)}
                            >
                              {(request.profileImage?.url || request.profilePhoto) ? (
                                <img
                                  src={request.profileImage?.url || request.profilePhoto}
                                  alt={request.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-medium text-slate-500">
                                  {request.name?.trim() ? request.name.slice(0, 2).toUpperCase() : "?"}
                                </span>
                              )}
                            </div>
                            <span 
                              className="text-sm font-medium text-slate-900 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleView(request)}
                            >
                              {request.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-700">{request.email}</span>
                            <span className="text-xs text-slate-500">{request.phone}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {request.applicationType === "reapplied" ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200"
                              title={request.reappliedAt ? `Re-applied: ${new Date(request.reappliedAt).toLocaleString()}` : "Re-applied"}
                            >
                              <RotateCw className="w-3 h-3" /> Re-applied
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <Sparkles className="w-3 h-3" /> New Apply
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{request.zone}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{request.city || 'N/A'}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{request.vehicleType}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block w-fit ${
                              request.status === "Pending" || request.status === "pending"
                                ? "bg-orange-100 text-orange-700"
                                : request.status === "Denied" || request.status === "denied" || request.status === "blocked"
                                ? "bg-red-100 text-red-700"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {request.status === "blocked" || request.status === "Blocked" || request.status === "Denied" || request.status === "denied" ? "Rejected" : request.status}
                            </span>
                            {request.rejectionReason && (
                              <span className="text-xs text-red-600 italic max-w-[200px] truncate" title={request.rejectionReason}>
                                {request.rejectionReason}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleView(request)}
                              className="p-1.5 rounded bg-orange-50 text-primary hover:bg-orange-100 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {activeTab === "pending" && (
                              <>
                                <button
                                  onClick={() => handleApprove(request)}
                                  disabled={processing}
                                  className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeny(request)}
                                  disabled={processing}
                                  className="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Deny"
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
            )}
          </div>
        </div>
      </div>

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Approve Request</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Are you sure you want to approve "{selectedRequest?.name}"'s join request?
            </p>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => setIsApproveOpen(false)}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmApprove}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Approve
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Confirmation Dialog */}
      <Dialog open={isDenyOpen} onOpenChange={setIsDenyOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Deny Request</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-slate-700">
              Are you sure you want to deny "{selectedRequest?.name}"'s join request?
            </p>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide specific reasons for rejection (e.g., Invalid documents, Incomplete information, etc.)"
                rows={5}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                disabled={processing}
              />
              <p className="text-xs text-slate-500 mt-1">
                This reason will be shown to the delivery partner
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => {
                setIsDenyOpen(false)
                setRejectionReason("")
              }}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeny}
              disabled={processing || !rejectionReason.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              Deny
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-xl font-bold text-slate-900">Delivery Partner Details</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {viewDetails ? (
              <div className="space-y-6 mt-4">
                {/* Profile Image & Basic Info */}
                <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                  <div className="flex-shrink-0">
                    {viewDetails.profileImage?.url ? (
                      <img 
                        src={viewDetails.profileImage.url} 
                        alt={viewDetails.name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Name
                      </label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{viewDetails.name || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </label>
                      <p className="text-sm text-slate-900 mt-1">{viewDetails.email || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </label>
                      <p className="text-sm text-slate-900 mt-1">{viewDetails.phone || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Delivery ID</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{viewDetails.deliveryId || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Application Type</label>
                      <div className="mt-1">
                        {viewDetails.applicationType === "reapplied" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <RotateCw className="w-3 h-3" /> Re-applied Application
                            {viewDetails.reapplicationCount > 0 && ` (Attempt #${viewDetails.reapplicationCount})`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Sparkles className="w-3 h-3" /> New Application
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                        viewDetails.status === 'approved' || viewDetails.status === 'active' ? 'bg-green-100 text-green-700' :
                        viewDetails.status === 'blocked' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {viewDetails.status === 'blocked' ? 'Rejected' : (viewDetails.status?.charAt(0).toUpperCase() + viewDetails.status?.slice(1) || "N/A")}
                      </span>
                    </div>
                    {viewDetails.reappliedAt && (
                      <div className="col-span-2 p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-800">Latest Re-application Submitted</p>
                        <p className="text-xs text-purple-900 mt-0.5">{new Date(viewDetails.reappliedAt).toLocaleString()}</p>
                      </div>
                    )}
                    {viewDetails.previousRejectionReason && (
                      <div className="col-span-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs font-semibold text-amber-800">Previous Rejection Reason (Before Re-apply)</p>
                        <p className="text-xs text-amber-900 mt-0.5 italic">"{viewDetails.previousRejectionReason}"</p>
                      </div>
                    )}
                    {viewDetails.rejectionReason && (
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase text-red-600">Rejection Reason</label>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                          <p className="text-sm text-red-700 whitespace-pre-wrap">{viewDetails.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                    {viewDetails.approvedBy && (
                      <div className="col-span-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <p className="text-xs font-semibold text-emerald-700 mb-1">Approved By</p>
                        <p className="text-sm text-emerald-900 font-medium">{viewDetails.approvedBy.name}</p>
                        {viewDetails.approvedBy.email && <p className="text-xs text-emerald-600">{viewDetails.approvedBy.email}</p>}
                        {viewDetails.approvedBy.roleName && <p className="text-xs text-emerald-600">Role: {viewDetails.approvedBy.roleName}</p>}
                        {viewDetails.approvedBy.actionAt && <p className="text-xs text-emerald-500 mt-1">{new Date(viewDetails.approvedBy.actionAt).toLocaleString()}</p>}
                      </div>
                    )}
                    {viewDetails.rejectedBy && (
                      <div className="col-span-2 p-3 bg-rose-50 rounded-lg border border-rose-200">
                        <p className="text-xs font-semibold text-rose-700 mb-1">Rejected By</p>
                        <p className="text-sm text-rose-900 font-medium">{viewDetails.rejectedBy.name}</p>
                        {viewDetails.rejectedBy.email && <p className="text-xs text-rose-600">{viewDetails.rejectedBy.email}</p>}
                        {viewDetails.rejectedBy.roleName && <p className="text-xs text-rose-600">Role: {viewDetails.rejectedBy.roleName}</p>}
                        {viewDetails.rejectedBy.actionAt && <p className="text-xs text-rose-500 mt-1">{new Date(viewDetails.rejectedBy.actionAt).toLocaleString()}</p>}
                      </div>
                    )}
                    {viewDetails.dateOfBirth && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date of Birth
                        </label>
                        <p className="text-sm text-slate-900 mt-1">
                          {new Date(viewDetails.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {viewDetails.gender && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Gender</label>
                        <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.gender || "N/A"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                {viewDetails.location && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.location.addressLine1 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 1</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine1}</p>
                        </div>
                      )}
                      {viewDetails.location.addressLine2 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 2</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine2}</p>
                        </div>
                      )}
                      {viewDetails.location.area && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Area</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.area}</p>
                        </div>
                      )}
                      {viewDetails.detectedZone && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Detected Zone</label>
                          <p className="text-sm text-slate-900 mt-1 font-medium">{viewDetails.detectedZone}</p>
                        </div>
                      )}
                      {viewDetails.location.city && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.city}</p>
                        </div>
                      )}
                      {viewDetails.location.state && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.state}</p>
                        </div>
                      )}
                      {viewDetails.location.zipCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Zip Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.zipCode}</p>
                        </div>
                      )}
                      {(viewDetails.location.latitude && viewDetails.location.longitude) && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Coordinates</label>
                          <p className="text-sm text-slate-900 mt-1">
                            {viewDetails.location.latitude}, {viewDetails.location.longitude}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vehicle Details */}
                {viewDetails.vehicle && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Bike className="w-4 h-4" /> Vehicle Details
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      {viewDetails.vehicle.brand && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Brand</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.brand}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.model && (
                        <div className="text-right col-span-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Model</label>
                          <p className="text-xs text-slate-900 mt-1">{viewDetails.vehicle.model}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.number && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.number}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.type && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Type</label>
                          <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.vehicle.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents */}
                {viewDetails.documents && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <FileCheck className="w-4 h-4" /> Documents
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Aadhar */}
                      {viewDetails.documents.aadhar && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Aadhar Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.aadhar.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.aadhar.number}</p>
                            )}
                            {viewDetails.documents.aadhar.document && (
                              <a 
                                href={viewDetails.documents.aadhar.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PAN */}
                      {viewDetails.documents.pan && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">PAN Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.pan.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.pan.number}</p>
                            )}
                            {viewDetails.documents.pan.document && (
                              <a 
                                href={viewDetails.documents.pan.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Driving License */}
                      {viewDetails.documents.drivingLicense && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Driving License</label>
                          <div className="mt-2">
                            {viewDetails.documents.drivingLicense.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.drivingLicense.number}</p>
                            )}
                            {viewDetails.documents.drivingLicense.expiryDate && (
                              <p className="text-xs text-slate-500 mb-1">
                                Expiry: {new Date(viewDetails.documents.drivingLicense.expiryDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                            {viewDetails.documents.drivingLicense.document && (
                              <a 
                                href={viewDetails.documents.drivingLicense.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vehicle RC */}
                      {viewDetails.documents.vehicleRC && (viewDetails.documents.vehicleRC.number || viewDetails.documents.vehicleRC.document) && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle RC</label>
                          <div className="mt-2">
                            {viewDetails.documents.vehicleRC.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.vehicleRC.number}</p>
                            )}
                            {viewDetails.documents.vehicleRC.document && (
                              <a 
                                href={viewDetails.documents.vehicleRC.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                {viewDetails.documents?.bankDetails && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Bank Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.documents.bankDetails.accountHolderName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Holder Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountHolderName}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.accountNumber && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountNumber}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.ifscCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">IFSC Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.ifscCode}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.bankName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Bank Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.bankName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4">
                  {viewDetails.signupMethod && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Signup Method</label>
                      <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.signupMethod}</p>
                    </div>
                  )}
                  {viewDetails.phoneVerified !== undefined && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Phone Verified</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.phoneVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {viewDetails.phoneVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  )}
                  {viewDetails.createdAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Joined Date</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {new Date(viewDetails.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {viewDetails.verifiedAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Verified At</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {new Date(viewDetails.verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
                <ApprovalAuditCard
                  className="pt-6 border-t border-slate-200"
                  approvedBy={viewDetails.approvedBy}
                  rejectedBy={viewDetails.rejectedBy}
                  rejectionReason={viewDetails.rejectionReason}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 border-t border-slate-200">
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter Panel */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Options
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Zone</label>
              <select
                value={filters.zone}
                onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Zones</option>
                {allZones.map(zone => (
                  <option key={zone._id} value={zone.name}>{zone.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Application Type</label>
              <select
                value={filters.applicationType}
                onChange={(e) => setFilters({ ...filters, applicationType: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Application Types</option>
                <option value="new">New Applications</option>
                <option value="reapplied">Re-applied Applications</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Vehicle Type</label>
              <select
                value={filters.vehicleType}
                onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">All Vehicle Types</option>
                {vehicleTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Reset
            </button>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-all shadow-md"
            >
              Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

