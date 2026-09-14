import { useState, useEffect, useMemo } from "react"
import {
  Search,
  Settings,
  ArrowUpDown,
  Download,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Code,
  Check,
  Columns,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  RefreshCw,
  User,
  Package,
  Wallet
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
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


export default function EarningAddonHistory() {
  const [searchQuery, setSearchQuery] = useState("")
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [creditNotes, setCreditNotes] = useState("")
  const [isCheckingCompletions, setIsCheckingCompletions] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    deliveryman: true,
    offerTitle: true,
    ordersCompleted: true,
    earningAmount: true,
    date: true,
    status: true,
    actions: true,
  })

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      setIsLoading(true)
      debugLog('?? Fetching earning addon history...')
      const response = await adminAPI.getEarningAddonHistory()
      debugLog('?? API Response:', {
        success: response.data.success,
        message: response.data.message,
        dataKeys: response.data.data ? Object.keys(response.data.data) : [],
        historyCount: response.data.data?.history?.length || 0,
        pagination: response.data.data?.pagination
      })

      if (response.data.success) {
        const historyData = response.data.data.history || []
        debugLog('? Earning Addon History fetched:', historyData.length, 'records')

        // Log sample data for debugging
        if (historyData.length > 0) {
          debugLog('?? Sample history record:', {
            deliveryman: historyData[0].deliveryman,
            offerTitle: historyData[0].offerTitle,
            status: historyData[0].status,
            ordersCompleted: historyData[0].ordersCompleted,
            earningAmount: historyData[0].earningAmount
          })
        }

        setHistory(historyData)
        if (historyData.length === 0) {
          debugLog('?? No history records found in database')
          toast.info("No earning addon history found. History will appear when delivery boys complete offers.")
        } else {
          debugLog(`? Successfully loaded ${historyData.length} history records`)
        }
      } else {
        debugError('? API returned unsuccessful response:', response.data)
        toast.error(response.data.message || "Failed to fetch earning addon history")
      }
    } catch (error) {
      debugError("? Error fetching earning addon history:", error)
      debugError("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      })
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch earning addon history"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return dateString
    }
  }

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) {
      return history
    }

    const query = searchQuery.toLowerCase().trim()
    return history.filter(item =>
      item.deliveryman?.toLowerCase().includes(query) ||
      item.deliveryId?.toLowerCase().includes(query) ||
      item.offerTitle?.toLowerCase().includes(query)
    )
  }, [history, searchQuery])

  const handleCredit = async () => {
    if (!selectedHistory) return

    try {
      await adminAPI.creditEarningToWallet(selectedHistory._id, creditNotes)
      toast.success("Earning credited to wallet successfully")
      setIsCreditDialogOpen(false)
      setSelectedHistory(null)
      setCreditNotes("")
      fetchHistory()
    } catch (error) {
      debugError("Error crediting earning:", error)
      toast.error(error.response?.data?.message || "Failed to credit earning")
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this earning?")) {
      return
    }

    try {
      await adminAPI.cancelEarningAddonHistory(id, "Cancelled by admin")
      toast.success("Earning cancelled successfully")
      fetchHistory()
    } catch (error) {
      debugError("Error cancelling earning:", error)
      toast.error(error.response?.data?.message || "Failed to cancel earning")
    }
  }

  const handleOpenCreditDialog = (item) => {
    setSelectedHistory(item)
    setCreditNotes("")
    setIsCreditDialogOpen(true)
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      deliveryman: true,
      offerTitle: true,
      ordersCompleted: true,
      earningAmount: true,
      date: true,
      status: true,
      actions: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    deliveryman: "Deliveryman",
    offerTitle: "Offer Title",
    ordersCompleted: "Orders Completed",
    earningAmount: "Earning Amount",
    date: "Date",
    status: "Status",
    actions: "Actions",
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: "bg-blue-100", text: "text-blue-700", label: "Pending", icon: Clock },
      credited: { bg: "bg-green-100", text: "text-green-700", label: "Credited", icon: CheckCircle },
      failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed", icon: XCircle },
      cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled", icon: XCircle },
    }
    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const handleExport = async (format) => {
    if (filteredHistory.length === 0) {
      toast.error("No data to export")
      return
    }

    const headers = [
      { key: "sl", label: "SI" },
      { key: "deliveryman", label: "Deliveryman" },
      { key: "offerTitle", label: "Offer Title" },
      { key: "ordersCompleted", label: "Orders Completed" },
      { key: "earningAmount", label: "Earning Amount" },
      { key: "date", label: "Date" },
      { key: "status", label: "Status" },
    ]

    const rows = filteredHistory.map((item, index) => ({
      sl: index + 1,
      deliveryman:
        item.deliveryman?.name ||
        item.deliverymanName ||
        item.deliveryPartnerName ||
        "N/A",
      offerTitle: item.offerTitle || item.offer?.title || "N/A",
      ordersCompleted: item.ordersCompleted ?? item.completedOrders ?? 0,
      earningAmount: `\u20B9${Number(item.earningAmount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      date: (item.date || item.createdAt)
        ? new Date(item.date || item.createdAt).toLocaleString("en-IN")
        : "N/A",
      status: item.status || "N/A",
    }))

    try {
      switch (format) {
        case "csv":
          exportReportsToCSV(rows, headers, "earning_addon_history")
          toast.success("CSV exported successfully")
          break
        case "excel":
          exportReportsToExcel(rows, headers, "earning_addon_history")
          toast.success("Excel exported successfully")
          break
        case "pdf":
          await exportReportsToPDF(
            rows,
            headers,
            "earning_addon_history",
            "Earning Addon History",
          )
          toast.success("PDF exported successfully")
          break
        case "json":
          exportReportsToJSON(rows, "earning_addon_history")
          toast.success("JSON exported successfully")
          break
        default:
          toast.error("Invalid export format")
      }
    } catch (error) {
      debugError("Export error:", error)
      toast.error("Failed to export history")
    }
  }

  const handleCheckAllCompletions = async () => {
    try {
      setIsCheckingCompletions(true)
      debugLog('?? Checking completions for all delivery partners...')

      const res = await adminAPI.checkEarningAddonCompletions("all", true)

      if (res.data.success) {
        const found = res.data.data.completionsFound || 0
        if (found > 0) {
          toast.success(`Check complete! Found ${found} new eligible completions.`)
          await fetchHistory()
        } else {
          toast.info("Check complete. No new eligible completions found.")
        }
      }
    } catch (error) {
      debugError("Error checking all completions:", error)
      toast.error("Failed to check completions")
    } finally {
      setIsCheckingCompletions(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Earning Addon History</h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredHistory.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCheckAllCompletions}
                disabled={isCheckingCompletions}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                title="Check all delivery partners for completed offers"
              >
                <RefreshCw className={`w-4 h-4 ${isCheckingCompletions ? 'animate-spin' : ''}`} />
                <span>{isCheckingCompletions ? 'Checking...' : 'Check Completions'}</span>
              </button>
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Ex: search delivery man or offer"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="text-black font-bold">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                    <Code className="w-4 h-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mb-4"></div>
              <div className="text-slate-500">Loading earning addon history...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>SI</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.deliveryman && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Deliveryman</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.offerTitle && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Offer Title</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.ordersCompleted && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Orders</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.earningAmount && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Earning Amount</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.date && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Date</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Status</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-slate-400 text-4xl mb-2">??</div>
                          <p className="text-slate-500 font-medium">No earning addon history found</p>
                          <p className="text-sm text-slate-400 mt-1">
                            {searchQuery ? 'Try adjusting your search query' : 'History will appear when delivery boys complete earning addon offers'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{item.sl}</span>
                          </td>
                        )}
                        {visibleColumns.deliveryman && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-blue-600">
                                {item.deliveryman || 'Unknown'}
                              </span>
                              {item.deliveryId && (
                                <span className="text-xs text-slate-500 mt-0.5">ID: {item.deliveryId}</span>
                              )}
                              {item.deliveryPhone && item.deliveryPhone !== 'N/A' && (
                                <span className="text-xs text-slate-400 mt-0.5">{item.deliveryPhone}</span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.offerTitle && (
                          <td className="px-6 py-4">
                            <span className="text-sm text-slate-700">{item.offerTitle}</span>
                          </td>
                        )}
                        {visibleColumns.ordersCompleted && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-900">
                                {item.ordersCompleted || 0} / {item.ordersRequired || 0}
                              </span>
                              {item.ordersRequired > 0 && (
                                <span className="text-xs text-slate-500 mt-0.5">
                                  {Math.round(((item.ordersCompleted || 0) / item.ordersRequired) * 100)}% Complete
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.earningAmount && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <IndianRupee className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm font-medium text-slate-900">{"\u20B9"}{item.totalEarning?.toFixed(2) || item.earningAmount?.toFixed(2) || '0.00'}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.date && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-700">{formatDate(item.date || item.completedAt)}</span>
                              {item.completedAt && (
                                <span className="text-xs text-slate-400 mt-0.5">
                                  {new Date(item.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(item.status)}
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {item.status === 'pending' && (
                                <button
                                  onClick={() => handleOpenCreditDialog(item)}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all"
                                  title="Credit to Wallet"
                                >
                                  Credit
                                </button>
                              )}
                              {item.status === 'pending' && (
                                <button
                                  onClick={() => handleCancel(item._id)}
                                  className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                  title="Cancel"
                                >
                                  <XCircle className="w-4 h-4 text-red-500" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Credit Dialog */}
      <Dialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen}>
        <DialogContent className="max-w-lg bg-gradient-to-br from-white via-slate-50 to-white p-0 border-0 shadow-2xl">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-5 rounded-t-lg">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Credit Earning to Wallet
              </DialogTitle>
            </DialogHeader>
          </div>

          {selectedHistory && (
            <div className="px-6 py-6 space-y-6">
              {/* Information Cards */}
              <div className="space-y-3">
                {/* Deliveryman Info */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Deliveryman</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{selectedHistory.deliveryman || 'N/A'}</p>
                    {selectedHistory.deliveryId && (
                      <p className="text-xs text-slate-500 mt-0.5">ID: {selectedHistory.deliveryId}</p>
                    )}
                  </div>
                </div>

                {/* Offer Info */}
                <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Offer</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedHistory.offerTitle || 'N/A'}</p>
                    {selectedHistory.ordersCompleted && selectedHistory.ordersRequired && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedHistory.ordersCompleted} / {selectedHistory.ordersRequired} orders completed
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount Info - Highlighted */}
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border-2 border-emerald-200">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <IndianRupee className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-emerald-700 uppercase tracking-wide mb-1">Amount to Credit</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {"\u20B9"}{selectedHistory.totalEarning?.toFixed(2) || selectedHistory.earningAmount?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  Notes <span className="text-xs font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none text-sm text-slate-700 placeholder:text-slate-400"
                  rows={4}
                  placeholder="Add any notes about this credit transaction..."
                />
                <p className="text-xs text-slate-400">This note will be saved with the transaction record.</p>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    setIsCreditDialogOpen(false)
                    setSelectedHistory(null)
                    setCreditNotes("")
                  }}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCredit}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Credit to Wallet
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Visible Columns
              </h3>
              <div className="space-y-2">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={resetColumns}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}


