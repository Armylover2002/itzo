import { useState, useEffect } from "react"
import { MessageSquare, Search, Clock, CheckCircle, XCircle, Loader2, Eye, Edit } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { Textarea } from "@food/components/ui/textarea"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliverySupportTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isResponseOpen, setIsResponseOpen] = useState(false)
  const [responseText, setResponseText] = useState("")
  const [updating, setUpdating] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const response = await adminAPI.getDeliverySupportTickets(params)
      
      if (response?.data?.success && response?.data?.data?.tickets) {
        setTickets(response.data.data.tickets)
      } else {
        setTickets([])
      }
    } catch (error) {
      debugError("Error fetching tickets:", error)
      toast.error("Failed to load tickets")
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await adminAPI.getDeliverySupportTicketStats()
      if (response?.data?.success && response?.data?.data) {
        setStats(response.data.data)
      }
    } catch (error) {
      debugError("Error fetching stats:", error)
    }
  }

  const handleSearch = () => {
    fetchTickets()
  }

  const handleViewTicket = (ticket) => {
    setSelectedTicket(ticket)
    setIsViewOpen(true)
  }

  const handleRespond = (ticket) => {
    setSelectedTicket(ticket)
    setResponseText(ticket.adminResponse || "")
    setIsResponseOpen(true)
  }

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return

    try {
      setUpdating(true)
      const response = await adminAPI.updateDeliverySupportTicket(selectedTicket._id, {
        adminResponse: responseText.trim(),
        status: selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status
      })

      if (response?.data?.success) {
        toast.success("Ticket updated successfully!")
        const updatedTicket =
          response?.data?.data?.ticket ||
          response?.data?.ticket ||
          {
            ...selectedTicket,
            adminResponse: responseText.trim(),
            respondedAt: new Date().toISOString(),
            status: selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status,
          }
        setSelectedTicket(updatedTicket)
        setIsResponseOpen(false)
        setResponseText("")
        await fetchTickets()
        await fetchStats()
      } else {
        toast.error(response?.data?.message || "Failed to update ticket")
      }
    } catch (error) {
      debugError("Error updating ticket:", error)
      toast.error(error?.response?.data?.message || "Failed to update ticket")
    } finally {
      setUpdating(false)
    }
  }

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      const response = await adminAPI.updateDeliverySupportTicket(ticketId, {
        status: newStatus
      })

      if (response?.data?.success) {
        toast.success("Ticket status updated!")
        await fetchTickets()
        await fetchStats()
      }
    } catch (error) {
      debugError("Error updating status:", error)
      toast.error("Failed to update status")
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "open":
        return <Clock className="w-5 h-5 text-red-500" />
      case "in_progress":
        return <Clock className="w-5 h-5 text-blue-500" />
      case "resolved":
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case "closed":
        return <XCircle className="w-5 h-5 text-gray-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "open":
        return "bg-red-100 text-red-700"
      case "in_progress":
        return "bg-blue-100 text-blue-700"
      case "resolved":
        return "bg-green-100 text-green-700"
      case "closed":
        return "bg-gray-100 text-gray-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-6 h-6 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Delivery Support Tickets</h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage and respond to support tickets from delivery partners
              </p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-600 mt-1">Total</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{stats.open}</p>
                <p className="text-xs text-red-600 mt-1">Open</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{stats.inProgress}</p>
                <p className="text-xs text-blue-600 mt-1">In Progress</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
                <p className="text-xs text-green-600 mt-1">Resolved</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-700">{stats.closed}</p>
                <p className="text-xs text-gray-600 mt-1">Closed</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by subject, description, ticket ID, or delivery partner..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Tickets List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.length === 0 ? (
                <div className="bg-slate-50 rounded-lg p-8 text-center">
                  <p className="text-gray-600">No tickets found</p>
                </div>
              ) : (
                tickets.map((ticket) => (
                  <div
                    key={ticket._id}
                    className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getStatusIcon(ticket.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {ticket.ticketId && (
                              <span className="text-xs font-mono font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                #{ticket.ticketId}
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {ticket.subject}
                            </span>
                            <span className="text-xs text-gray-600">
                              {ticket.deliveryPartner?.name || 'N/A'}
                            </span>
                            {ticket.deliveryPartner?._id && (
                              <span className="text-xs text-gray-500">
                                ID: DP-{String(ticket.deliveryPartner._id).slice(-8).toUpperCase()}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {formatDateTime(ticket.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleViewTicket(ticket)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleRespond(ticket)}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                          title={ticket.adminResponse ? "Edit Response" : "Send Response"}
                        >
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                        {ticket.status !== 'closed' && (
                          <select
                            value={ticket.status}
                            onChange={(e) => handleStatusChange(ticket._id, e.target.value)}
                            className="text-xs px-2 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* View Ticket Dialog - Full Details */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="flex w-[calc(100%-2rem)] max-w-[600px] max-h-[85vh] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
            <DialogTitle className="text-xl font-semibold text-gray-900">Ticket Details</DialogTitle>
            <p className="text-sm text-gray-600 mt-1">Complete information about the support ticket</p>
          </DialogHeader>
          {selectedTicket && (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-6">
              {/* Ticket Information Section */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-6 bg-blue-500 rounded"></div>
                  <h3 className="text-base font-semibold text-gray-900">Ticket Information</h3>
                </div>
                <div className="pl-4 space-y-4">
                  {/* Ticket ID */}
                  {selectedTicket.ticketId && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Ticket ID</p>
                      <div className="bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg inline-block">
                        <p className="text-base font-mono font-semibold">
                          #{selectedTicket.ticketId}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Subject */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Subject</p>
                    <p className="text-base text-gray-900 font-semibold">{selectedTicket.subject}</p>
                  </div>

                  {/* Description / Issue */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Description / Issue</p>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.description}
                      </p>
                    </div>
                  </div>

                  {/* Status, Priority, Category */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Status</p>
                      <span className={`inline-block px-4 py-2 rounded-full text-xs font-semibold ${getStatusColor(selectedTicket.status)}`}>
                        {selectedTicket.status.charAt(0).toUpperCase() + selectedTicket.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Priority</p>
                      <p className="text-sm text-gray-900 capitalize font-semibold">{selectedTicket.priority}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Category</p>
                      <p className="text-sm text-gray-900 capitalize font-semibold">{selectedTicket.category}</p>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Created</p>
                    <p className="text-sm text-gray-900">{formatDateTime(selectedTicket.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Partner Section */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-6 bg-red-500 rounded"></div>
                  <h3 className="text-base font-semibold text-gray-900">Delivery Partner</h3>
                </div>
                <div className="pl-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Name</p>
                    <p className="text-sm text-gray-900 font-semibold">{selectedTicket.deliveryPartner?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Phone Number</p>
                    <p className="text-sm text-gray-900">{selectedTicket.deliveryPartner?.phone || 'N/A'}</p>
                  </div>
                  {selectedTicket.deliveryPartner?._id && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">ID</p>
                      <p className="text-sm text-gray-900">DP-{String(selectedTicket.deliveryPartner._id).slice(-8).toUpperCase()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Response Section */}
              {selectedTicket.adminResponse && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-1 h-6 bg-green-500 rounded"></div>
                    <h3 className="text-base font-semibold text-gray-900">Admin Response</h3>
                  </div>
                  <div className="pl-4">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{selectedTicket.adminResponse}</p>
                      {selectedTicket.respondedAt && (
                        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-blue-200">
                          Responded on: {formatDateTime(selectedTicket.respondedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedTicket.status !== 'closed' && (
                <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-gray-200">
                  <button
                    onClick={() => handleRespond(selectedTicket)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                  >
                    {selectedTicket.adminResponse ? "Edit Response" : "Send Response"}
                  </button>
                  {selectedTicket.status === 'in_progress' && (
                    <button
                      onClick={() => {
                        handleStatusChange(selectedTicket._id, 'resolved')
                        setIsViewOpen(false)
                      }}
                      className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-sm"
                    >
                      Mark Resolved
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleStatusChange(selectedTicket._id, 'closed')
                      setIsViewOpen(false)
                    }}
                    className="px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors shadow-sm"
                  >
                    Close Ticket
                  </button>
                </div>
              )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Respond Dialog */}
      <Dialog open={isResponseOpen} onOpenChange={setIsResponseOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[560px] overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 pr-14">
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Respond to Ticket
            </DialogTitle>
            {selectedTicket && (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-slate-600">
                  {selectedTicket.ticketId ? `#${selectedTicket.ticketId}` : "Support Ticket"}
                </p>
                <p className="text-sm text-slate-500 line-clamp-2">
                  {selectedTicket.subject || "Send an update that the delivery partner can see."}
                </p>
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Response
              </label>
              <Textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Enter your response..."
                rows={6}
                className="min-h-[180px] resize-y rounded-xl border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm focus-visible:border-blue-500 focus-visible:ring-4 focus-visible:ring-blue-100"
              />
              <p className="mt-2 text-xs text-slate-500">
                This message will be visible to the delivery partner in their support ticket.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <button
              onClick={() => setIsResponseOpen(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateTicket}
              disabled={updating || !responseText.trim()}
              className="flex min-w-[140px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {updating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Ticket"
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
