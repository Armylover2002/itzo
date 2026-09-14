import { useState, useMemo, useEffect, useCallback } from "react"
import { Search, Download, ChevronDown, IndianRupee, Calendar, Filter, Loader2, FileText, FileSpreadsheet, Code } from "lucide-react"
import { adminAPI } from "@food/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { toast } from "sonner"
import {
  exportReportsToCSV,
  exportReportsToExcel,
  exportReportsToPDF,
  exportReportsToJSON,
} from "@food/components/admin/reports/reportsExportUtils"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


const formatCurrency = (amount) => {
  return `\u20B9${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function DeliveryEarnings() {
  const [searchQuery, setSearchQuery] = useState("")
  const [earnings, setEarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 })
  const [summary, setSummary] = useState({
    totalDeliveryPartners: 0,
    totalEarnings: 0,
    totalOrders: 0
  })
  const [filters, setFilters] = useState({
    period: 'all',
    deliveryPartnerId: '',
    fromDate: '',
    toDate: ''
  })
  const [deliveryPartners, setDeliveryPartners] = useState([])

  // Fetch delivery partners for filter dropdown
  const fetchDeliveryPartners = useCallback(async () => {
    try {
      const response = await adminAPI.getDeliveryPartners({ limit: 1000 })
      if (response.data?.success) {
        setDeliveryPartners(response.data.data.deliveryPartners || [])
      }
    } catch (err) {
      debugError("Error fetching delivery partners:", err)
    }
  }, [])

  // Fetch earnings from API
  const fetchEarnings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {
        page: pagination.page,
        limit: pagination.limit,
        period: filters.period,
        ...(filters.deliveryPartnerId && { deliveryPartnerId: filters.deliveryPartnerId }),
        ...(filters.fromDate && { fromDate: filters.fromDate }),
        ...(filters.toDate && { toDate: filters.toDate }),
        ...(searchQuery.trim() && { search: searchQuery.trim() })
      }

      const response = await adminAPI.getDeliveryEarnings(params)

      if (response.data?.success) {
        setEarnings(response.data.data.earnings || [])
        setSummary(response.data.data.summary || {})
        setPagination(response.data.data.pagination || pagination)
      } else {
        setError(response.data?.message || "Failed to fetch earnings")
        setEarnings([])
      }
    } catch (err) {
      debugError("Error fetching earnings:", err)
      const errorMessage = err.response?.data?.message || "Failed to fetch earnings. Please try again."
      setError(errorMessage)
      toast.error(errorMessage)
      setEarnings([])
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters, searchQuery])

  useEffect(() => {
    fetchDeliveryPartners()
  }, [fetchDeliveryPartners])

  useEffect(() => {
    fetchEarnings()
  }, [fetchEarnings])

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleExport = async (format) => {
    try {
      toast.info("Preparing export...")
      const allEarnings = []
      let currentPage = 1
      let totalPagesToFetch = 1
      const exportLimit = 200

      do {
        const params = {
          page: currentPage,
          limit: exportLimit,
          period: filters.period,
          ...(filters.deliveryPartnerId && { deliveryPartnerId: filters.deliveryPartnerId }),
          ...(filters.fromDate && { fromDate: filters.fromDate }),
          ...(filters.toDate && { toDate: filters.toDate }),
          ...(searchQuery.trim() && { search: searchQuery.trim() }),
        }
        const response = await adminAPI.getDeliveryEarnings(params)
        if (!response.data?.success) break
        const batch = response.data.data.earnings || []
        allEarnings.push(...batch)
        const paginationMeta = response.data.data.pagination || {}
        totalPagesToFetch = Number(paginationMeta.pages || paginationMeta.totalPages || 1)
        currentPage += 1
      } while (currentPage <= totalPagesToFetch && currentPage <= 50)

      if (allEarnings.length === 0) {
        toast.info("No data to export")
        return
      }

      const headers = [
        { key: "sl", label: "SI" },
        { key: "deliveryPartnerName", label: "Delivery Boy" },
        { key: "deliveryPartnerPhone", label: "Phone" },
        { key: "orderId", label: "Order ID" },
        { key: "restaurantName", label: "Restaurant" },
        { key: "amount", label: "Earning" },
        { key: "orderTotal", label: "Order Total" },
        { key: "deliveryFee", label: "Delivery Fee" },
        { key: "orderStatus", label: "Status" },
        { key: "createdAt", label: "Date" },
      ]

      const data = allEarnings.map((earning, index) => ({
        sl: index + 1,
        deliveryPartnerName: earning.deliveryPartnerName || "N/A",
        deliveryPartnerPhone: earning.deliveryPartnerPhone || "N/A",
        orderId: earning.orderId || "N/A",
        restaurantName: earning.restaurantName || "N/A",
        amount: formatCurrency(earning.amount),
        orderTotal: formatCurrency(earning.orderTotal),
        deliveryFee: formatCurrency(earning.deliveryFee),
        orderStatus: earning.orderStatus || "N/A",
        createdAt: formatDate(earning.createdAt),
      }))

      switch (format) {
        case "csv":
          exportReportsToCSV(data, headers, "delivery_earnings")
          toast.success(`CSV exported (${data.length} rows)`)
          break
        case "excel":
          exportReportsToExcel(data, headers, "delivery_earnings")
          toast.success(`Excel exported (${data.length} rows)`)
          break
        case "pdf":
          await exportReportsToPDF(data, headers, "delivery_earnings", "Delivery Earnings Report")
          toast.success(`PDF exported (${data.length} rows)`)
          break
        case "json":
          exportReportsToJSON(data, "delivery_earnings")
          toast.success(`JSON exported (${data.length} rows)`)
          break
        default:
          toast.error("Invalid export format")
      }
    } catch (error) {
      debugError("Export error:", error)
      toast.error("Failed to export earnings")
    }
  }

  if (loading && earnings.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading delivery earnings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-600 flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Delivery Earning</h1>
                <p className="text-sm text-slate-600">View all delivery boy earnings and details</p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Delivery Boys</p>
                <p className="text-2xl font-bold text-slate-900">{summary.totalDeliveryPartners || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalEarnings || 0)}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <IndianRupee className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-slate-900">{summary.totalOrders || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Period</label>
              <select
                value={filters.period}
                onChange={(e) => handleFilterChange('period', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Delivery Boy</label>
              <select
                value={filters.deliveryPartnerId}
                onChange={(e) => handleFilterChange('deliveryPartnerId', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Delivery Boys</option>
                {deliveryPartners.map(dp => (
                  <option key={dp._id} value={dp._id}>{dp.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">From Date</label>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">To Date</label>
              <input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleFilterChange('toDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Search and Export */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, phone, order ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")}>
                  <Code className="w-4 h-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Earnings Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">SI</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Delivery Boy</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Order ID</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Restaurant</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Earning</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Order Total</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {earnings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Earnings Found</p>
                        <p className="text-sm text-slate-500">No earnings match your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  earnings.map((earning, index) => (
                    <tr key={earning.transactionId || index} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {(pagination.page - 1) * pagination.limit + index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {earning.deliveryPartnerName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {earning.deliveryPartnerPhone || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-medium">
                        {earning.orderId || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {earning.restaurantName || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">
                        {formatCurrency(earning.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatCurrency(earning.orderTotal)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${earning.orderStatus === 'delivered'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                          }`}>
                          {earning.orderStatus || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatDate(earning.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} earnings
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, pagination.pages) }).map((_, idx) => {
                  const pageNum = pagination.page <= 3
                    ? idx + 1
                    : pagination.page >= pagination.pages - 2
                      ? pagination.pages - 4 + idx
                      : pagination.page - 2 + idx
                  if (pageNum < 1 || pageNum > pagination.pages) return null
                  return (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1 text-sm rounded border ${pagination.page === pageNum
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 text-sm rounded border border-slate-300 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


