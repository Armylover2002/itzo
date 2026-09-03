import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Search, CheckCircle2, XCircle, Eye, Clock, Loader2 } from "lucide-react"
import { Card } from "@food/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function FoodApproval() {
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
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::food_management::food_approval", "edit")
  }, [currentUser, resolvedPermissions])

  const [foodRequests, setFoodRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const isMountedRef = useRef(true)

  // Fetch pending food approval requests
  const fetchFoodRequests = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await adminAPI.getPendingFoodApprovals()
      const data = response?.data?.data?.requests || response?.data?.requests || []
      if (!isMountedRef.current) return
      setFoodRequests(data)
    } catch (error) {
      debugError('Error fetching food approval requests:', error)
      if (!isMountedRef.current) return
      if (!silent) {
        toast.error('Failed to load food approval requests')
      }
      setFoodRequests([])
    } finally {
      if (!silent && isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    fetchFoodRequests()

    const onFocus = () => fetchFoodRequests({ silent: true })
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchFoodRequests({ silent: true })
      }
    }
    const onPageShow = () => fetchFoodRequests({ silent: true })

    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFoodRequests({ silent: true })
      }
    }, 30000)

    window.addEventListener("focus", onFocus)
    window.addEventListener("pageshow", onPageShow)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      isMountedRef.current = false
      clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("pageshow", onPageShow)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [fetchFoodRequests])

  // Filter requests based on search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) {
      return foodRequests
    }
    const query = searchQuery.toLowerCase().trim()
    return foodRequests.filter((request) =>
      request.itemName?.toLowerCase().includes(query) ||
      request.category?.toLowerCase().includes(query) ||
      request.restaurantName?.toLowerCase().includes(query) ||
      request.restaurantId?.toLowerCase().includes(query) ||
      request.approvalStatus?.toLowerCase().includes(query) ||
      request.entityType?.toLowerCase().includes(query)
    )
  }, [foodRequests, searchQuery])

  const totalRequests = filteredRequests.length

  // Handle approve food item or addon
  const handleApprove = async (request) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!request?.isActionable) return
    try {
      setProcessing(true)
      const id = request._id || request.id
      
      if (request.entityType === 'addon') {
        await adminAPI.approveRestaurantAddon(id)
        toast.success('Add-on approved successfully')
      } else {
        await adminAPI.approveFoodItem(id)
        toast.success('Food item approved successfully')
      }
      
      await fetchFoodRequests()
      setShowDetailModal(false)
      setSelectedRequest(null)
    } catch (error) {
      debugError('Error approving item:', error)
      toast.error(error?.response?.data?.message || 'Failed to approve item')
    } finally {
      setProcessing(false)
    }
  }

  // Handle reject food item or addon
  const handleReject = async () => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!selectedRequest?.isActionable) {
      setShowRejectModal(false)
      return
    }
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    try {
      setProcessing(true)
      const id = selectedRequest._id || selectedRequest.id
      
      if (selectedRequest.entityType === 'addon') {
        await adminAPI.rejectRestaurantAddon(id, rejectReason)
        toast.success('Add-on rejected')
      } else {
        await adminAPI.rejectFoodItem(id, rejectReason)
        toast.success('Food item rejected')
      }
      
      await fetchFoodRequests()
      setShowRejectModal(false)
      setShowDetailModal(false)
      setSelectedRequest(null)
      setRejectReason("")
    } catch (error) {
      debugError('Error rejecting item:', error)
      toast.error(error?.response?.data?.message || 'Failed to reject item')
    } finally {
      setProcessing(false)
    }
  }

  // View food item details
  const handleViewDetails = (request) => {
    setSelectedRequest(request)
    setShowDetailModal(true)
  }

  // Open reject modal
  const handleRejectClick = (request) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!request?.isActionable) return
    setSelectedRequest(request)
    setShowRejectModal(true)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Food Approval
          </h1>
        </div>
      </div>

      {/* Food Approval List Section */}
      <Card className="border border-gray-200 shadow-sm">
        <div className="p-4">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-900">Pending Food & Add-on Approvals</h2>
              <span className="inline-flex items-center rounded-full bg-[#f0e7f9] px-3 py-1 text-xs font-medium text-[#550fa8]">
                {totalRequests}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search by name, category, restaurant or status"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:border-[#006fbd] focus:ring-1 focus:ring-[#006fbd]"
              />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#006fbd]" />
            </div>
          ) : (
            <div className="border-t border-gray-200">
              <div className="w-full overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead style={{ backgroundColor: "rgba(0, 111, 189, 0.1)" }}>
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        S.No
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Restaurant
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Requested Date
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-3 py-8 text-center text-sm text-gray-500">
                          {loading ? "Loading..." : "No food or add-on records found."}
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((request, index) => (
                        <tr key={request._id || request.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 font-semibold">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="text-sm">
                              <div className="font-semibold text-gray-900">{request.restaurantName || '-'}</div>
                              <div className="text-gray-500 text-xs">{request.restaurantId || '-'}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                            {request.category || '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 font-semibold">
                            {request.itemName || '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 capitalize text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${request.entityType === 'addon' ? 'bg-[#f0e7f9] text-[#460d8b]' : 'bg-[#f0e7f9] text-[#460d8b]'}`}>
                                {request.entityType || 'food'}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                              request.isActionable
                                ? 'bg-amber-100 text-amber-700'
                                : String(request.approvalStatus || '').toLowerCase() === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                            }`}>
                              {request.approvalStatus || (request.isActionable ? 'pending' : 'active')}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 font-semibold">
                            {request.price !== null && request.price !== undefined ? `Rs ${request.price}` : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                            {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleViewDetails(request)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white transition-colors"
                                style={{ backgroundColor: "#006fbd" }}
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    onClick={() => handleApprove(request)}
                                    disabled={processing || !request.isActionable}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Approve"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleRejectClick(request)}
                                    disabled={processing || !request.isActionable}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
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
          )}
        </div>
      </Card>

      {/* Item Details Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 bg-white shadow-2xl rounded-2xl border-none">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-slate-50/50">
            <DialogTitle className="text-xl font-bold text-gray-900">
              {selectedRequest?.entityType === 'addon' ? 'Add-on Details' : 'Food Item Details'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              Review the submitted details before approval.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="p-6 space-y-6">
              {/* Restaurant Info */}
              <div className="p-4 bg-[#f7f3fc]/50 rounded-xl border border-[#f0e7f9]/50 flex items-center justify-between">
                <div>
                   <h3 className="font-bold text-xs text-[#460d8b] uppercase tracking-wider mb-1">Restaurant</h3>
                   <p className="text-sm font-semibold text-gray-900">{selectedRequest.restaurantName || '-'}</p>
                   <p className="text-xs text-gray-500">ID: {selectedRequest.restaurantId || '-'}</p>
                </div>
                <div className="px-3 py-1 bg-white rounded-full border border-[#f0e7f9] text-[10px] font-bold text-primary">
                    {selectedRequest.entityType?.toUpperCase()}
                </div>
              </div>

              {/* Item Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Item Name</label>
                        <p className="text-sm font-semibold text-gray-900">{selectedRequest.itemName || '-'}</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</label>
                        <p className="text-sm text-gray-700">{selectedRequest.category || '-'}</p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Price</label>
                        <p className="text-sm font-bold text-green-600">
                          ₹{selectedRequest.price !== null && selectedRequest.price !== undefined ? selectedRequest.price : '-'}
                          {selectedRequest.otherPrice > 0 && (
                            <span className="ml-2 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                              Other: ₹{selectedRequest.otherPrice}
                            </span>
                          )}
                        </p>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                        <p className="text-sm text-gray-700 capitalize font-medium">{selectedRequest.approvalStatus || 'pending'}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedRequest.foodType && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Food Type</label>
                            <p className="text-sm text-gray-700">{selectedRequest.foodType}</p>
                        </div>
                    )}
                    {selectedRequest.requestedAt && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Requested On</label>
                            <p className="text-sm text-gray-700">{new Date(selectedRequest.requestedAt).toLocaleString()}</p>
                        </div>
                    )}
                </div>

                {selectedRequest.description && (
                  <div className="col-span-full">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</label>
                    <p className="text-sm text-gray-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedRequest.description}</p>
                  </div>
                )}

                {/* Variants */}
                {selectedRequest.variants && selectedRequest.variants.length > 0 && (
                  <div className="col-span-full">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Variants / Sizes</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedRequest.variants.map((variant, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-sm font-medium text-gray-900">{variant.name || variant.variantName || '-'}</span>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="text-sm font-bold text-green-600">₹{variant.price || 0}</span>
                            {variant.otherPrice > 0 && (
                              <span className="text-[9px] font-medium text-gray-500 bg-gray-100 px-1 py-0.5 rounded border border-gray-200">
                                Other: ₹{variant.otherPrice}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Images */}
                {(() => {
                  const allImages = (selectedRequest.images || []).filter(img => img && typeof img === 'string');
                  if (selectedRequest.image && !allImages.includes(selectedRequest.image)) {
                      allImages.unshift(selectedRequest.image);
                  }
                  
                  return allImages.length > 0 ? (
                    <div className="col-span-full">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Images ({allImages.length})
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {allImages.map((img, idx) => (
                            <img 
                              key={idx}
                              src={img} 
                              alt="Item preview"
                              className="w-24 h-24 object-cover rounded-xl border border-gray-100 shadow-sm hover:scale-105 transition-transform cursor-zoom-in"
                              onClick={() => window.open(img, '_blank')}
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
          <DialogFooter className="p-6 pt-4 border-t border-gray-100 bg-slate-50/50 flex gap-2">
            <button
              type="button"
              onClick={() => setShowDetailModal(false)}
              className="px-6 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {selectedRequest?.isActionable && canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => handleRejectClick(selectedRequest)}
                  disabled={processing || !canEdit}
                  className="px-6 py-2 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={processing}
                  className="px-6 py-2 text-sm font-semibold text-white bg-green-500 rounded-xl hover:bg-green-600 shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Approve Item"}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md p-0 bg-white rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-red-50/30">
            <DialogTitle className="text-xl font-bold text-red-700 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Reject Item
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              Please provide a clear reason for rejecting this {selectedRequest?.entityType || 'item'}.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="rejectReason" className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Tell the restaurant why this item was rejected..."
                  required
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                  disabled={processing || !canEdit}
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={processing || !rejectReason.trim() || !canEdit}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95 disabled:opacity-50"
              >
                {processing ? "Processing..." : "Confirm Rejection"}
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
