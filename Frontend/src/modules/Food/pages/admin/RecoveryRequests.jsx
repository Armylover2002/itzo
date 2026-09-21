import { useState, useEffect } from "react"
import { Search, Loader2, CheckCircle, XCircle } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Button } from "@food/components/ui/button"

export default function RecoveryRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalRequests, setTotalRequests] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const fetchRequests = async (search = "") => {
    try {
      setLoading(true)
      const res = await adminAPI.getRecoveryRequests({ search, limit: 100 })
      if (res?.data?.success) {
        setRequests(res.data.data.items || [])
        setTotalRequests(res.data.data.total || 0)
      } else {
        setRequests([])
        setTotalRequests(0)
      }
    } catch (error) {
      console.error("Error fetching recovery requests:", error)
      toast.error("Failed to fetch recovery requests")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const handleSearch = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    // Debounce can be implemented here if needed
    fetchRequests(value)
  }

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id)
      const res = await adminAPI.approveRecoveryRequest(id)
      if (res?.data?.success) {
        toast.success("Account recovery approved successfully")
        setRequests((prev) => prev.filter((r) => r._id !== id))
        setTotalRequests((prev) => prev - 1)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve request")
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleReject = async (id) => {
    try {
      setActionLoadingId(id)
      const res = await adminAPI.rejectRecoveryRequest(id)
      if (res?.data?.success) {
        toast.success("Account recovery rejected successfully")
        setRequests((prev) => prev.filter((r) => r._id !== id))
        setTotalRequests((prev) => prev - 1)
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject request")
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Account Recovery Requests</h1>
          <p className="text-gray-500 mt-1">Review and approve account recovery requests from deleted users.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff4a4a] focus:border-transparent transition-all placeholder:text-gray-400"
            />
          </div>
          <div className="text-sm text-gray-500 font-medium">
            Total Requests: <span className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full ml-1">{totalRequests}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">User Details</th>
                <th className="px-6 py-4 font-medium">Contact</th>
                <th className="px-6 py-4 font-medium">Requested At</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#ff4a4a]" />
                    <p>Loading requests...</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Search className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-base font-medium text-gray-900 mb-1">No requests found</p>
                    <p>There are no pending account recovery requests.</p>
                  </td>
                </tr>
              ) : (
                requests.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold uppercase shrink-0 border border-red-100">
                          {user.name?.charAt(0) || user.phone?.charAt(0) || "U"}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 truncate max-w-[200px]">
                            {user.name || "N/A"}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Deleted User
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 font-medium font-mono text-sm">{user.countryCode || "+91"} {user.phone}</div>
                      {user.email && <div className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]">{user.email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900">
                        {user.deletionRequest?.recoveryRequestedAt ? new Date(user.deletionRequest.recoveryRequestedAt).toLocaleDateString() : 'N/A'}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {user.deletionRequest?.recoveryRequestedAt ? new Date(user.deletionRequest.recoveryRequestedAt).toLocaleTimeString() : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(user._id)}
                          disabled={actionLoadingId === user._id}
                          className="bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border-red-200"
                        >
                          {actionLoadingId === user._id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-1" />
                          )}
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(user._id)}
                          disabled={actionLoadingId === user._id}
                          className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                        >
                          {actionLoadingId === user._id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-1" />
                          )}
                          Approve
                        </Button>
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
  )
}
