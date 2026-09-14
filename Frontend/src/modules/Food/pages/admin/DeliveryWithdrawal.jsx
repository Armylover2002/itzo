import { useState, useEffect, useMemo } from "react"
import { Search, Wallet, Eye, CheckCircle, XCircle, Loader2, Package, QrCode } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@food/components/ui/dialog"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const TABS = [
  { key: "All", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Approved", label: "Approved" },
  { key: "Rejected", label: "Rejected" },
]

export default function DeliveryWithdrawal() {
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
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::deliveryman_management::withdrawal", "edit")
  }, [currentUser, resolvedPermissions])
  const [activeTab, setActiveTab] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [processingAction, setProcessingAction] = useState(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [requestToApprove, setRequestToApprove] = useState(null)

  useEffect(() => {
    fetchRequests()
  }, [activeTab])

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryWithdrawals({
        status: activeTab,
        page: 1,
        limit: 200,
        search: searchQuery.trim() || undefined,
      })
      if (response?.data?.success) {
        setRequests(response.data.data?.requests || [])
      } else {
        toast.error(response?.data?.message || "Failed to fetch delivery withdrawal requests")
        setRequests([])
      }
    } catch (error) {
      debugError("Error fetching delivery withdrawal requests:", error)
      toast.error(error.response?.data?.message || "Failed to fetch delivery withdrawal requests")
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) fetchRequests()
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return requests
    const q = searchQuery.toLowerCase().trim()
    return requests.filter(
      (r) =>
        r.deliveryName?.toLowerCase().includes(q) ||
        r.deliveryIdString?.toLowerCase().includes(q) ||
        r.deliveryPhone?.toLowerCase().includes(q) ||
        r.amount?.toString().includes(q)
    )
  }, [requests, searchQuery])

  const getStatusBadge = (status) => {
    if (status === "Approved" || status === "Processed") return "bg-green-100 text-green-700"
    if (status === "Pending") return "bg-amber-100 text-amber-700"
    if (status === "Rejected") return "bg-red-100 text-red-700"
    return "bg-slate-100 text-slate-700"
  }

  const handleView = (req) => {
    setSelectedRequest(req)
    setIsViewOpen(true)
  }

  const handleApprove = (id) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    setRequestToApprove(id)
    setShowApproveModal(true)
  }

  const confirmApprove = async () => {
    if (!requestToApprove) return
    const id = requestToApprove
    try {
      setProcessingAction(id)
      const response = await adminAPI.updateDeliveryWithdrawalStatus(id, { status: "Approved" })
      if (response?.data?.success) {
        toast.success("Withdrawal request approved successfully")
        setShowApproveModal(false)
        setRequestToApprove(null)
        fetchRequests()
      } else {
        toast.error(response?.data?.message || "Failed to approve")
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Failed to approve withdrawal request"
      debugError("Error approving delivery withdrawal:", error?.response?.data || error, msg)
      toast.error(msg)
    } finally {
      setProcessingAction(null)
    }
  }

  const handleReject = async (id) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    try {
      setProcessingAction(id)
      const response = await adminAPI.updateDeliveryWithdrawalStatus(id, {
        status: "Rejected",
        rejectionReason: rejectionReason,
      })
      if (response?.data?.success) {
        toast.success("Withdrawal request rejected successfully")
        setShowRejectModal(false)
        setRejectionReason("")
        setSelectedRequest(null)
        fetchRequests()
      }
 else {
        toast.error(response?.data?.message || "Failed to reject")
      }
    } catch (error) {
      debugError("Error rejecting delivery withdrawal:", error)
      toast.error(error.response?.data?.message || "Failed to reject withdrawal request")
    } finally {
      setProcessingAction(null)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    } catch {
      return String(dateString)
    }
  }

  const formatCurrency = (amount) => {
    if (amount == null) return "\u20B90.00"
    return `\u20B9${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">Delivery Withdrawal</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            View and manage delivery boy withdrawal requests. Pending requests can be approved or rejected.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex gap-2 border-b border-slate-200">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Withdrawal Requests</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredRequests.length}
              </span>
            </div>
            <div className="relative flex-1 sm:flex-initial min-w-[200px] max-w-xs">
              <input
                type="text"
                placeholder="Search by delivery name, phone"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading withdrawal requests…</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Delivery Boy</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Request Time</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <Package className="w-16 h-16 text-slate-400 mb-4" />
                          <p className="text-lg font-semibold text-slate-700">No requests</p>
                          <p className="text-sm text-slate-500">
                            No {activeTab.toLowerCase()} withdrawal requests.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req, index) => (
                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatCurrency(req.amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{req.deliveryName || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{req.deliveryIdString || "N/A"}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{formatDate(req.requestedAt || req.createdAt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(req.status)}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleView(req)}
                              className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-amber-600" />
                            </button>
                            {req.status === "Pending" && canEdit && (
                              <>
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  disabled={processingAction === req.id}
                                  className="p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Approve"
                                >
                                  {processingAction === req.id ? (
                                    <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req)
                                    setShowRejectModal(true)
                                  }}
                                  disabled={processingAction === req.id}
                                  className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4 text-red-600" />
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
          )}
        </div>

        {/* View details dialog */}
        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Withdrawal request details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Amount</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">{formatCurrency(selectedRequest.amount)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Delivery boy</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.deliveryName || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Partner Phone</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.deliveryIdString || "N/A"}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Phone</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.deliveryPhone || "N/A"}</p>
                </div>
                {selectedRequest.upiId && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <QrCode className="w-4 h-4 text-emerald-600" />
                      <label className="text-xs font-bold text-emerald-800 uppercase">UPI Information</label>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{selectedRequest.upiId}</p>
                      {selectedRequest.upiQrCode && (
                        <button 
                          onClick={() => window.open(selectedRequest.upiQrCode, '_blank')}
                          className="text-[10px] bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View QR
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Bank Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.bankDetails?.bankName || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Account Number</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.bankDetails?.accountNumber || "N/A"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">IFSC Code</label>
                    <p className="text-sm font-medium text-slate-900 mt-1 uppercase text-emerald-600">{selectedRequest.bankDetails?.ifscCode || "N/A"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Holder Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.bankDetails?.accountHolderName || "N/A"}</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Request time</label>
                  <p className="text-sm font-medium text-slate-900 mt-1">{formatDate(selectedRequest.requestedAt || selectedRequest.createdAt)}</p>
                </div>
                {(selectedRequest.status === "Approved" || selectedRequest.status === "Processed") && selectedRequest.processedAt && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Processed at</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{formatDate(selectedRequest.processedAt)}</p>
                  </div>
                )}
                {selectedRequest.status === "Rejected" && selectedRequest.processedAt && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Rejected at</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{formatDate(selectedRequest.processedAt)}</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                  <p className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(selectedRequest.status)}`}>
                      {selectedRequest.status}
                    </span>
                  </p>
                </div>
                {selectedRequest.rejectionReason && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase">Rejection reason</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedRequest.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="px-6 pb-6">
              <button
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
              >
                Close
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve modal */}
        <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Approve withdrawal request</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to approve this withdrawal request?
              </p>
            </div>
            <DialogFooter className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => {
                  setShowApproveModal(false)
                  setRequestToApprove(null)
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={processingAction === requestToApprove || !canEdit}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingAction === requestToApprove ? "Approving…" : "Approve"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject modal */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent className="max-w-md bg-white p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>Reject withdrawal request</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Rejection reason (optional)
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
            <DialogFooter className="px-6 pb-6 flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectionReason("")
                  setSelectedRequest(null)
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedRequest && handleReject(selectedRequest.id)}
                disabled={processingAction === selectedRequest?.id || !canEdit}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingAction === selectedRequest?.id ? "Rejecting…" : "Reject"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

