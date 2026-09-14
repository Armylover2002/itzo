import { useState, useEffect, useMemo } from "react"
import { onboardingFeeAPI } from "@/services/api"
import { Search, Receipt, ArrowUpDown, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import toast from "react-hot-toast"

export default function OnboardingPayments() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRole, setFilterRole] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1
  })

  useEffect(() => {
    fetchPayments()
  }, [pagination.page, filterRole, filterStatus])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        role: filterRole || undefined,
        status: filterStatus || undefined,
        search: searchQuery.trim() || undefined
      }
      const res = await onboardingFeeAPI.getPayments(params)
      if (res?.data?.success) {
        const data = res.data.data || {}
        setPayments(data.items || [])
        setPagination(prev => ({
          ...prev,
          total: data.total ?? 0,
          totalPages: data.totalPages ?? 1
        }))
      } else {
        toast.error("Failed to load onboarding payments log")
      }
    } catch (err) {
      console.error(err)
      toast.error("Error connecting to payment server")
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchPayments()
  }

  const getStatusBadge = (status) => {
    const s = String(status).toLowerCase()
    if (s === 'success') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          Success
        </span>
      )
    }
    if (s === 'failed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          Failed
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        Pending
      </span>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#FFEDED] rounded-lg text-[#FF0000]">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Onboarding Payments Log</h1>
                <p className="text-sm text-slate-500 mt-1">Audit trail of registration payments made by partners.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Role Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterRole}
                  onChange={(e) => {
                    setFilterRole(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="text-xs font-medium bg-transparent focus:outline-none text-slate-700 cursor-pointer"
                >
                  <option value="">All Roles</option>
                  <option value="RESTAURANT">Restaurant</option>
                  <option value="SELLER">Seller</option>
                  <option value="DELIVERY_PARTNER">Delivery Boy</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value)
                    setPagination(prev => ({ ...prev, page: 1 }))
                  }}
                  className="text-xs font-medium bg-transparent focus:outline-none text-slate-700 cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 mb-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search Name, Phone, Email, Order ID, Payment ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000]/30 focus:border-[#FF0000]"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#FF0000] hover:bg-[#d85418] text-white transition-all shadow-sm"
            >
              Search
            </button>
          </form>
        </div>

        {/* Table List */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">User Details</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">Razorpay IDs</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="w-6 h-6 border-2 border-[#FF0000] border-t-transparent rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500 text-sm">
                      No onboarding transactions found.
                    </td>
                  </tr>
                ) : (
                  payments.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {new Date(log.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-800">{log.userDetails?.name}</div>
                        <div className="text-xs text-slate-500">{log.userDetails?.phone}</div>
                        {log.userDetails?.email && (
                          <div className="text-xs text-slate-400">{log.userDetails?.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">
                        {String(log.role).replace("_", " ")}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>
                          <span className="font-semibold text-slate-500 text-xs">Order:</span>{" "}
                          <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{log.razorpayOrderId}</code>
                        </div>
                        {log.razorpayPaymentId && (
                          <div className="mt-1">
                            <span className="font-semibold text-slate-500 text-xs">Payment:</span>{" "}
                            <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{log.razorpayPaymentId}</code>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                        ₹{log.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(log.status)}
                        {log.errorDetails && (
                          <div className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={log.errorDetails}>
                            {log.errorDetails}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {payments.length} of {pagination.total} transactions
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 transition-all cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
