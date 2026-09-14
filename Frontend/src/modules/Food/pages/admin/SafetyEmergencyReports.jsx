import { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown, Settings, Folder, ChevronDown, Eye, Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function SafetyEmergencyReports() {
  const [searchQuery, setSearchQuery] = useState("")
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchReports()
  }, [statusFilter, priorityFilter, currentPage, searchQuery])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: 10,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        priority: priorityFilter !== 'all' ? priorityFilter : undefined,
        search: searchQuery.trim() || undefined
      }
      
      // Remove undefined params
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key])
      
      const response = await adminAPI.getSafetyEmergencyReports(params)
      
      if (response.data && response.data.success) {
        setReports(response.data.data?.safetyEmergencies || [])
        setTotalPages(response.data.data?.pagination?.pages || 1)
      } else {
        setReports([])
        setTotalPages(1)
      }
    } catch (error) {
      debugError('Error fetching safety emergency reports:', error)
      debugError('Error response:', error.response)
      setReports([])
      setTotalPages(1)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to load safety emergency reports. Please check your connection and try again.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = (report) => {
    setSelectedReport(report)
    setIsViewDialogOpen(true)
  }

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      const response = await adminAPI.updateSafetyEmergencyStatus(id, newStatus)
      
      if (response.data.success) {
        toast.success('Status updated successfully')
        fetchReports()
      }
    } catch (error) {
      debugError('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleUpdatePriority = async (id, newPriority) => {
    try {
      const response = await adminAPI.updateSafetyEmergencyPriority(id, newPriority)
      
      if (response.data.success) {
        toast.success('Priority updated successfully')
        fetchReports()
      }
    } catch (error) {
      debugError('Error updating priority:', error)
      toast.error('Failed to update priority')
    }
  }

  const handleDelete = async (id) => {
    try {
      const response = await adminAPI.deleteSafetyEmergencyReport(id)
      
      if (response.data.success) {
        toast.success('Safety emergency report deleted successfully')
        fetchReports()
      }
    } catch (error) {
      debugError('Error deleting report:', error)
      toast.error('Failed to delete safety emergency report')
    }
  }

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) {
      return reports
    }
    
    const query = searchQuery.toLowerCase().trim()
    return reports.filter(report =>
      report.userName?.toLowerCase().includes(query) ||
      report.userEmail?.toLowerCase().includes(query) ||
      report.message?.toLowerCase().includes(query)
    )
  }, [reports, searchQuery])

  const getStatusBadge = (status) => {
    const statusConfig = {
      unread: { label: 'Unread', className: 'bg-blue-100 text-blue-700' },
      read: { label: 'Read', className: 'bg-slate-100 text-slate-700' },
      resolved: { label: 'Resolved', className: 'bg-green-100 text-green-700' },
      urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' }
    }
    
    const config = statusConfig[status] || statusConfig.unread
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  const getPriorityBadge = (priority) => {
    const priorityConfig = {
      low: { label: 'Low', className: 'bg-gray-100 text-gray-700' },
      medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-700' },
      high: { label: 'High', className: 'bg-red-100 text-red-700' },
      critical: { label: 'Critical', className: 'bg-red-100 text-red-700 font-bold' }
    }
    
    const config = priorityConfig[priority] || priorityConfig.medium
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  if (loading && reports.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-red-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading safety emergency reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h1 className="text-2xl font-bold text-slate-900">Safety Emergency Reports</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {reports.length}
            </span>
          </div>

          <div className="flex gap-3">
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="urgent">Urgent</option>
              <option value="resolved">Resolved</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 sm:flex-initial min-w-[250px]">
              <input
                type="text"
                placeholder="Ex: Search by name or email"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>SI</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
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
                    <span>Email</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span>Action</span>
                    <Settings className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20">
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative mb-6">
                        <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center shadow-inner">
                          <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md relative overflow-visible">
                            <Folder className="w-12 h-12 text-slate-400" />
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-red-500 rounded-t-md z-10"></div>
                            <div className="absolute top-3 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-slate-700">No Safety Emergency Reports Found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredReports.map((report, index) => (
                  <tr
                    key={report._id}
                    className={`hover:bg-slate-50 transition-colors ${
                      report.priority === 'critical' ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">
                        {(currentPage - 1) * 10 + index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{report.userName}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{report.userEmail || "NA"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getPriorityBadge(report.priority)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                            <Settings className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          side="bottom"
                          sideOffset={8}
                          collisionPadding={12}
                          className="max-h-[70vh] overflow-y-auto"
                        >
                          <DropdownMenuItem onClick={() => handleViewReport(report)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              Update status
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent
                              sideOffset={8}
                              collisionPadding={12}
                              className="max-h-[60vh] overflow-y-auto"
                            >
                              {["unread", "read", "urgent", "resolved"].map((status) => (
                                <DropdownMenuItem
                                  key={`status-${status}`}
                                  onClick={() => handleUpdateStatus(report._id, status)}
                                  className={report.status === status ? "font-semibold" : undefined}
                                >
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              Update priority
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent
                              sideOffset={8}
                              collisionPadding={12}
                              className="max-h-[60vh] overflow-y-auto"
                            >
                              {["low", "medium", "high", "critical"].map((priority) => (
                                <DropdownMenuItem
                                  key={`priority-${priority}`}
                                  onClick={() => handleUpdatePriority(report._id, priority)}
                                  className={report.priority === priority ? "font-semibold" : undefined}
                                >
                                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(report._id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Report Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              Safety Emergency Report Details
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Complete information about the safety emergency report
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="px-6 py-6 space-y-6">
              {/* User Information Section */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                  User Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User Name</label>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{selectedReport.userName || 'NA'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                    <p className="text-base font-semibold text-slate-900 dark:text-white break-all">{selectedReport.userEmail || 'NA'}</p>
                  </div>
                  {selectedReport.userId?.phone && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone Number</label>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">{selectedReport.userId.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Report Section */}
              <div className="bg-gradient-to-br from-red-50 to-red-50 dark:from-red-900/20 dark:to-red-900/20 rounded-xl p-5 border border-red-200 dark:border-red-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                  Safety Emergency Report
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedReport.message}
                  </p>
                </div>
              </div>

              {/* Priority and Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Priority</label>
                  <div>{getPriorityBadge(selectedReport.priority)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Status</label>
                  <div>{getStatusBadge(selectedReport.status)}</div>
                </div>
              </div>

              {/* Metadata Section */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Reported At</label>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {new Date(selectedReport.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {/* Admin Response Section */}
              {selectedReport.adminResponse && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 border border-green-200 dark:border-green-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                    <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full"></div>
                    Admin Response
                  </h3>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedReport.adminResponse}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                    {selectedReport.respondedAt && (
                      <span>
                        Responded on: {new Date(selectedReport.respondedAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                    {selectedReport.respondedBy?.name && (
                      <span>
                        Responded by: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedReport.respondedBy.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                  className="min-w-[100px]"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}


