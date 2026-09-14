import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Wallet } from "lucide-react"
import BottomNavOrders from "@food/components/restaurant/BottomNavOrders"
import { restaurantAPI } from "@food/api"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function WithdrawalHistoryPage() {
  const navigate = useNavigate()
  const [withdrawalHistoryTab, setWithdrawalHistoryTab] = useState('pending')
  const [withdrawalRequests, setWithdrawalRequests] = useState([])
  const [loadingWithdrawalRequests, setLoadingWithdrawalRequests] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  const fetchWithdrawalRequests = async () => {
    try {
      setLoadingWithdrawalRequests(true)
      // Server-side filter by tab; keep a sensible page size.
      const statusByTab = {
        pending: "pending,processing",
        successful: "approved",
        rejected: "rejected,cancelled",
      }
      const response = await restaurantAPI.getWithdrawalHistory({
        page: 1,
        limit: 50,
        status: statusByTab[withdrawalHistoryTab] || undefined,
      })
      const payload = response?.data?.data
      const history = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.withdrawals)
          ? payload.withdrawals
          : []

      const mapped = history.map(h => ({
        id: h._id,
        amount: h.amount,
        status:
          h.status === 'approved'
            ? 'Approved'
            : h.status === 'rejected'
              ? 'Rejected'
              : h.status === 'cancelled'
                ? 'Cancelled'
                : h.status === 'processing'
                  ? 'Pending'
                  : 'Pending',
        rejectionReason: h.rejectionReason,
        requestedAt: h.createdAt,
        processedAt: h.processedAt
      }))

      setWithdrawalRequests(mapped)
    } catch (error) {
      if (error.response?.status !== 401) {
        debugError('Error fetching withdrawal requests:', error)
      }
    } finally {
      setLoadingWithdrawalRequests(false)
    }
  }

  useEffect(() => {
    fetchWithdrawalRequests()
  }, [withdrawalHistoryTab])

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this pending withdrawal request?')) return
    try {
      setCancellingId(id)
      await restaurantAPI.cancelWithdrawalRequest(id)
      await fetchWithdrawalRequests()
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to cancel withdrawal')
    } finally {
      setCancellingId(null)
    }
  }

  const tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'successful', label: 'Successful' },
    { key: 'rejected', label: 'Rejected' },
  ]

  // Server already filtered by tab; keep list as returned.
  const filtered = withdrawalRequests

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/restaurant/hub-finance")}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Withdrawal History</h1>
          </div>
        </div>
      </div>

      <div className="bg-white px-4 pt-4 border-b border-gray-200">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setWithdrawalHistoryTab(tab.key)}
              className={`flex-1 px-3 py-3 rounded-lg font-medium text-sm transition-colors ${
                withdrawalHistoryTab === tab.key
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loadingWithdrawalRequests ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">
              {withdrawalHistoryTab === 'pending'
                ? 'No pending withdrawal requests'
                : withdrawalHistoryTab === 'successful'
                  ? 'No successful withdrawals'
                  : 'No rejected or cancelled withdrawals'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((request) => (
              <div
                key={request.id}
                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="text-lg font-bold text-gray-900 mb-2">
                      ₹{request.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-600">
                      Requested: {request.requestedAt ? new Date(request.requestedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'N/A'}
                    </p>
                    {request.processedAt && request.status !== 'Pending' && (
                      <p className="text-xs text-gray-600 mt-1">
                        Processed: {new Date(request.processedAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                    {(request.status === 'Rejected' || request.status === 'Cancelled') && request.rejectionReason && (
                      <p className="text-xs text-red-600 mt-2">{request.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        request.status === 'Pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : request.status === 'Approved' || request.status === 'Processed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {request.status}
                    </span>
                    {request.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(request.id)}
                        disabled={cancellingId === request.id}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        {cancellingId === request.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNavOrders />
    </div>
  )
}
