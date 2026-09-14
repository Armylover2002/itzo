import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Filter, UtensilsCrossed, Eye, ArrowUpDown, Info, Settings, FileText, FileSpreadsheet, Code, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

// Import icons from Transaction-report-icons
import pendingIcon from "@food/assets/Transaction-report-icons/trx1.png"
import completedIcon from "@food/assets/Transaction-report-icons/trx3.png"
import canceledIcon from "@food/assets/Transaction-report-icons/trx5.png"

// Withdrawal status (pending/approved/rejected) mapped to disbursement display labels.
const STATUS_DISPLAY = { pending: "Pending", approved: "Completed", rejected: "Cancelled" }

const isInTimeRange = (rawDate, time) => {
  if (time === "All Time") return true
  if (!rawDate) return false
  const d = new Date(rawDate)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  switch (time) {
    case "Today":
      return d.toDateString() === now.toDateString()
    case "This Week": {
      const start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      start.setHours(0, 0, 0, 0)
      return d >= start
    }
    case "This Month":
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    case "This Year":
      return d.getFullYear() === now.getFullYear()
    default:
      return true
  }
}

export default function DisbursementReportRestaurants() {
  const [searchQuery, setSearchQuery] = useState("")
  const [disbursements, setDisbursements] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    zone: "All Zones",
    restaurant: "All restaurants",
    paymentMethod: "All Payment Method",
    status: "All status",
    time: "All Time",
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    let active = true
    const fetchDisbursements = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getWithdrawals({ limit: 500 })
        if (!active) return
        if (response?.data?.success && response.data.data) {
          const raw = response.data.data.requests || []
          const mapped = raw.map((w, index) => ({
            sl: index + 1,
            id: String(w.transactionId || w.restaurantIdString || w._id || ""),
            restaurantName: w.restaurantName || "N/A",
            createdAt: w.createdAt ? new Date(w.createdAt).toLocaleString("en-IN") : "",
            createdAtRaw: w.createdAt || null,
            disburseAmount: `\u20B9${Number(w.amount || 0).toLocaleString("en-IN")}`,
            paymentMethod: w.paymentMethod || "N/A",
            status: STATUS_DISPLAY[String(w.status || "").toLowerCase()] || w.status || "",
          }))
          setDisbursements(mapped)
        } else {
          setDisbursements([])
          if (response?.data?.message) toast.error(response.data.message)
        }
      } catch (error) {
        if (!active) return
        toast.error("Failed to fetch disbursement report")
        setDisbursements([])
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchDisbursements()
    return () => { active = false }
  }, [])

  const stats = useMemo(() => {
    const s = { pending: 0, completed: 0, canceled: 0 }
    disbursements.forEach((d) => {
      const st = String(d.status).toLowerCase()
      if (st === "pending") s.pending += 1
      else if (st === "completed") s.completed += 1
      else if (st === "canceled") s.canceled += 1
    })
    return s
  }, [disbursements])

  const restaurantOptions = useMemo(() => {
    const names = new Set(disbursements.map((d) => d.restaurantName).filter((n) => n && n !== "N/A"))
    return Array.from(names)
  }, [disbursements])

  const filteredDisbursements = useMemo(() => {
    let result = [...disbursements]
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(disbursement =>
        disbursement.id.toLowerCase().includes(query) ||
        disbursement.restaurantName.toLowerCase().includes(query)
      )
    }

    if (filters.zone !== "All Zones") {
      // Filter by zone if needed
    }

    if (filters.restaurant !== "All restaurants") {
      result = result.filter(d => d.restaurantName === filters.restaurant)
    }

    if (filters.paymentMethod !== "All Payment Method") {
      result = result.filter(d => d.paymentMethod === filters.paymentMethod)
    }

    if (filters.status !== "All status") {
      result = result.filter(d => d.status.toLowerCase() === filters.status.toLowerCase())
    }

    if (filters.time !== "All Time") {
      result = result.filter(d => isInTimeRange(d.createdAtRaw, filters.time))
    }

    return result
  }, [disbursements, searchQuery, filters])

  const totalDisbursements = filteredDisbursements.length

  const handleExport = (format) => {
    if (filteredDisbursements.length === 0) {
      alert("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "id", label: "ID" },
      { key: "restaurantName", label: "Restaurant Info" },
      { key: "createdAt", label: "Created At" },
      { key: "disburseAmount", label: "Disburse Amount" },
      { key: "paymentMethod", label: "Payment Method" },
      { key: "status", label: "Status" },
    ]
    switch (format) {
      case "csv": exportReportsToCSV(filteredDisbursements, headers, "disbursement_report_restaurants"); break
      case "excel": exportReportsToExcel(filteredDisbursements, headers, "disbursement_report_restaurants"); break
      case "pdf": exportReportsToPDF(filteredDisbursements, headers, "disbursement_report_restaurants", "Restaurant Disbursement Report"); break
      case "json": exportReportsToJSON(filteredDisbursements, "disbursement_report_restaurants"); break
    }
  }

  const handleFilterApply = () => {
    // Filters are already applied via useMemo
  }

  const handleResetFilters = () => {
    setFilters({
      zone: "All Zones",
      restaurant: "All restaurants",
      paymentMethod: "All Payment Method",
      status: "All status",
      time: "All Time",
    })
  }

  const activeFiltersCount = (filters.zone !== "All Zones" ? 1 : 0) + (filters.restaurant !== "All restaurants" ? 1 : 0) + (filters.paymentMethod !== "All Payment Method" ? 1 : 0) + (filters.status !== "All status" ? 1 : 0) + (filters.time !== "All Time" ? 1 : 0)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Restaurant Disbursement Report</h1>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Pending Disbursements */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
            <div className="absolute top-4 right-4">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                <Info className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mb-4 relative">
                <img src={pendingIcon} alt="Pending" className="w-10 h-10" />
              </div>
              <p className="text-2xl font-bold text-green-600 mb-1">{stats.pending}</p>
              <p className="text-sm text-slate-600">Pending Disbursements</p>
            </div>
          </div>

          {/* Completed Disbursements */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
            <div className="absolute top-4 right-4">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <Info className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4">
                <img src={completedIcon} alt="Completed" className="w-10 h-10" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-1">{stats.completed}</p>
              <p className="text-sm text-slate-600">Completed Disbursements</p>
            </div>
          </div>

          {/* Canceled Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
            <div className="absolute top-4 right-4">
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <Info className="w-3 h-3 text-white" />
              </div>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mb-4 relative">
                <img src={canceledIcon} alt="Cancelled" className="w-10 h-10" />
              </div>
              <p className="text-2xl font-bold text-red-600 mb-1">{stats.canceled}</p>
              <p className="text-sm text-slate-600">Cancelled Transactions</p>
            </div>
          </div>
        </div>

        {/* Search Data Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Search Data</h3>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Zone
                </label>
                <select
                  value={filters.zone}
                  onChange={(e) => setFilters(prev => ({ ...prev, zone: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Zones">All Zones</option>
                  <option value="Zone 1">Zone 1</option>
                  <option value="Zone 2">Zone 2</option>
                  <option value="Zone 3">Zone 3</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Restaurant
                </label>
                <select
                  value={filters.restaurant}
                  onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All restaurants">All restaurants</option>
                  <option value="Caf� Monarch">Caf� Monarch</option>
                  {restaurantOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Payment Method">All Payment Method</option>
                  <option value="6cash">6cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All status">All status</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Time
                </label>
                <select
                  value={filters.time}
                  onChange={(e) => setFilters(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full sm:w-48 px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Time">All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                  <option value="This Year">This Year</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="flex items-end gap-2">
                <button 
                  onClick={handleResetFilters}
                  className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Reset
                </button>
                <button 
                  onClick={handleFilterApply}
                  className={`px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2 relative ${
                    activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Total Disbursements Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Total Disbursements {totalDisbursements}</h2>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by id"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-4 pr-10 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="text-black font-bold">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>SI</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Id</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Restaurant Info</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Created At</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Disburse Amount</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Payment Method</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                        <p className="text-sm text-slate-500">Loading disbursements...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredDisbursements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No disbursements match your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDisbursements.map((disbursement) => (
                    <tr key={disbursement.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{disbursement.sl}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{disbursement.id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{disbursement.restaurantName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{disbursement.createdAt}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{disbursement.disburseAmount}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{disbursement.paymentMethod}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {disbursement.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Report Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Restaurant disbursement report settings and preferences will be available here.
            </p>
          </div>
          <div className="px-6 pb-6 flex items-center justify-end">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
