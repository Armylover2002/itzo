import { useState, useEffect, useMemo } from "react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
import { Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, FileText, Edit } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@food/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@food/components/ui/dialog"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

const COMPLAINT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'missing_item', label: 'Missing Item' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
]

export default function RestaurantComplaints() {
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
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::restaurant_management::restaurants::complaints", "edit")
  }, [currentUser, resolvedPermissions])

  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0
  })
  const [filters, setFilters] = useState({
    status: 'all',
    complaintType: 'all',
    search: '',
    page: 1,
    limit: 50
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  })
  const [editingComplaint, setEditingComplaint] = useState(null)
  const [updateData, setUpdateData] = useState({ status: '', adminResponse: '' })

  useEffect(() => {
    fetchComplaints()
  }, [filters])

  const fetchComplaints = async () => {
    try {
      setLoading(true)
      const params = {
        page: filters.page,
        limit: filters.limit,
      }
      if (filters.status && filters.status !== 'all') params.status = filters.status
      if (filters.complaintType && filters.complaintType !== 'all') params.complaintType = filters.complaintType
      if (filters.search) params.search = filters.search

      const response = await adminAPI.getRestaurantComplaints(params)
      if (response?.data?.success) {
        setComplaints(response.data.data.complaints || [])
        setStats(response.data.data.stats || stats)
        setPagination({
          page: response.data.data.page || 1,
          limit: response.data.data.limit || 50,
          total: response.data.data.total || 0,
          pages: Math.ceil((response.data.data.total || 0) / (response.data.data.limit || 50))
        })
      }
    } catch (error) {
      debugError('Error fetching complaints:', error)
      toast.error('Failed to fetch complaints')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (complaint) => {
    if (!canEdit) {
      toast.error('Permission denied')
      return
    }
    setEditingComplaint(complaint)
    setUpdateData({ status: complaint.status, adminResponse: complaint.adminResponse || '' })
  }

  const handleUpdateComplaint = async () => {
    if (!canEdit) {
      toast.error('Permission denied')
      return
    }
    if (!editingComplaint) return
    try {
      const response = await adminAPI.updateRestaurantComplaint(editingComplaint._id, updateData)
      if (response?.data?.success) {
        toast.success('Complaint updated')
        setEditingComplaint(null)
        fetchComplaints() // Refresh list
      }
    } catch (error) {
      debugError('Error updating complaint:', error)
      toast.error('Failed to update complaint')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Complaints</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and track customer complaints</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by order, customer, restaurant..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value.replace(/\s/g, ''), page: 1 })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 min-w-fit">
            <Select value={filters.status || 'all'} onValueChange={(value) => setFilters({ ...filters, status: value, page: 1 })}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.complaintType || 'all'} onValueChange={(value) => setFilters({ ...filters, complaintType: value, page: 1 })}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {COMPLAINT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Complaints List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {complaints.map((complaint) => (
              <div key={complaint._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(complaint.status)}
                      <h3 className="font-semibold text-gray-900">{complaint.subject || complaint.issueType?.replace('_', ' ')}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs text-gray-500">Order</p>
                        <p className="font-medium">#{complaint.orderId?.orderId || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium">{complaint.userId?.name || 'Customer'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Restaurant</p>
                        <p className="font-medium">{complaint.restaurantId?.restaurantName || 'Restaurant'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <p className="font-medium capitalize">{(complaint.issueType || 'other').replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => handleOpenModal(complaint)} className="p-2 rounded-md hover:bg-gray-200">
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-3">{complaint.description}</p>
                {complaint.restaurantResponse && (
                  <div className="bg-blue-50 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Restaurant Response:</p>
                    <p className="text-sm text-blue-800">{complaint.restaurantResponse}</p>
                  </div>
                )}
                {complaint.adminResponse && (
                  <div className="bg-green-50 rounded p-3 mb-3">
                    <p className="text-xs font-semibold text-green-700 mb-1">Admin Response:</p>
                    <p className="text-sm text-green-800">{complaint.adminResponse}</p>
                  </div>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} complaints
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= pagination.pages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Update Modal */}
      <Dialog open={!!editingComplaint} onOpenChange={(open) => !open && setEditingComplaint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Complaint</DialogTitle>
            <DialogDescription>
              Update the status and provide a response for this complaint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={updateData.status}
                onValueChange={(val) => {
                  if (!canEdit) return
                  setUpdateData({ ...updateData, status: val })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Response</label>
              <textarea
                className="w-full min-h-[100px] p-3 border rounded-md"
                placeholder="Type your response here..."
                value={updateData.adminResponse}
                onChange={(e) => setUpdateData({ ...updateData, adminResponse: e.target.value })}
                disabled={!canEdit}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEditingComplaint(null)} className="px-4 py-2 border rounded-md">Cancel</button>
            <button
              onClick={handleUpdateComplaint}
              disabled={!canEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

