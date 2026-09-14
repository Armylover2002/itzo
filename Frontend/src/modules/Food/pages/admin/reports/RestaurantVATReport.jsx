import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Filter, Calendar, ClipboardList, IndianRupee, FileText, AlertCircle, Settings, FileSpreadsheet, Code, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const EMPTY_VAT_STATS = { totalOrders: 0, totalOrderAmount: "\u20B90.00", totalTaxAmount: "\u20B90.00" }

const parseDateRange = (value) => {
  if (!value || typeof value !== "string") return { fromDate: undefined, toDate: undefined }
  const parts = value.split("-").map((p) => p.trim())
  if (parts.length !== 2) return { fromDate: undefined, toDate: undefined }
  const from = new Date(parts[0])
  const to = new Date(parts[1])
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { fromDate: undefined, toDate: undefined }
  }
  to.setHours(23, 59, 59, 999)
  return { fromDate: from.toISOString(), toDate: to.toISOString() }
}

export default function RestaurantVATReport() {
  const [searchQuery, setSearchQuery] = useState("")
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState(EMPTY_VAT_STATS)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    dateRange: "",
    restaurant: "All Restaurants",
  })

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    let active = true
    const fetchVATReport = async () => {
      try {
        setLoading(true)
        const { fromDate, toDate } = parseDateRange(filters.dateRange)
        const response = await adminAPI.getTaxReport({ fromDate, toDate, limit: 1000 })
        if (!active) return
        if (response?.data?.success && response.data.data) {
          const rawReports = response.data.data.reports || []
          const mapped = rawReports.map((r, index) => ({
            sl: index + 1,
            id: r.id,
            restaurantName: r.incomeSource,
            totalOrder: r.orderCount,
            totalOrderAmount: r.totalIncome,
            taxAmount: r.totalTax,
          }))
          setReports(mapped)
          const totalOrders = rawReports.reduce((sum, r) => sum + Number(r.orderCount || 0), 0)
          setStats({
            totalOrders,
            totalOrderAmount: response.data.data.stats?.totalIncome || EMPTY_VAT_STATS.totalOrderAmount,
            totalTaxAmount: response.data.data.stats?.totalTax || EMPTY_VAT_STATS.totalTaxAmount,
          })
        } else {
          setReports([])
          setStats(EMPTY_VAT_STATS)
          if (response?.data?.message) toast.error(response.data.message)
        }
      } catch (error) {
        if (!active) return
        toast.error("Failed to fetch VAT report")
        setReports([])
        setStats(EMPTY_VAT_STATS)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchVATReport()
    return () => { active = false }
  }, [filters.dateRange])

  const restaurantOptions = useMemo(() => {
    const names = new Set(reports.map((r) => r.restaurantName).filter(Boolean))
    return Array.from(names)
  }, [reports])

  const filteredReports = useMemo(() => {
    let result = [...reports]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(report =>
        report.restaurantName?.toLowerCase().includes(query)
      )
    }

    if (filters.restaurant !== "All Restaurants") {
      result = result.filter(r => r.restaurantName === filters.restaurant)
    }

    return result
  }, [reports, searchQuery, filters])

  const totalReports = filteredReports.length

  const handleExport = (format) => {
    if (filteredReports.length === 0) {
      alert("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "restaurantName", label: "Restaurant Info" },
      { key: "totalOrder", label: "Total Order" },
      { key: "totalOrderAmount", label: "Total Order Amount" },
      { key: "taxAmount", label: "Tax Amount" },
    ]
    switch (format) {
      case "csv": exportReportsToCSV(filteredReports, headers, "restaurant_vat_report"); break
      case "excel": exportReportsToExcel(filteredReports, headers, "restaurant_vat_report"); break
      case "pdf": exportReportsToPDF(filteredReports, headers, "restaurant_vat_report", "Restaurant VAT Report"); break
      case "json": exportReportsToJSON(filteredReports, "restaurant_vat_report"); break
    }
  }

  const handleFilterApply = () => {
    // Filters are already applied via useMemo
  }

  const handleResetFilters = () => {
    setFilters({
      dateRange: "",
      restaurant: "All Restaurants",
    })
  }

  const activeFiltersCount = (filters.dateRange ? 1 : 0) + (filters.restaurant !== "All Restaurants" ? 1 : 0)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Restaurant Tax Report</h1>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex flex-wrap gap-4 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Date Range
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    placeholder="11/27/2025 - 12/03/2025"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="relative flex-1 min-w-[200px]">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Restaurant
                </label>
                <select
                  value={filters.restaurant}
                  onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                  className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Restaurants">All Restaurants</option>
                  <option value="Caf� Monarch">Caf� Monarch</option>
                  {restaurantOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
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
                className={`px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2 relative ${activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Orders Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 mb-1">Total Orders</p>
                <p className="text-xs text-slate-600 mb-2">Total Orders</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalOrders}</p>
                <p className="text-lg font-semibold text-blue-600 mt-1">{stats.totalOrders}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-7 h-7 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Total Order Amount Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 mb-1">Total Order Amount</p>
                <p className="text-xs text-slate-600 mb-2">Total Order Amount</p>
                <p className="text-3xl font-bold text-green-600">{stats.totalOrderAmount}</p>
                <p className="text-lg font-semibold text-green-600 mt-1">{stats.totalOrderAmount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                <IndianRupee className="w-7 h-7 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Total Tax Amount Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900 mb-1">Total Tax Amount</p>
                <p className="text-xs text-slate-600 mb-2">Total Tax Amount</p>
                <p className="text-3xl font-bold text-red-600">{stats.totalTaxAmount}</p>
                <p className="text-lg font-semibold text-red-600 mt-1">{stats.totalTaxAmount}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-7 h-7 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* All Restaurant Taxes Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">All Restaurant Taxes</h2>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Name"
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

          {/* Table or Empty State */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-slate-500">Loading VAT report...</p>
              </div>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-lg bg-slate-200 flex items-center justify-center mb-4">
                  <AlertCircle className="w-12 h-12 text-slate-500" />
                </div>
                <p className="text-lg font-semibold text-slate-700 mb-2">No Data Found</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      SI
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Restaurant Info
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Total Order
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Total Order Amount
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Tax Amount
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredReports.map((report) => (
                    <tr key={report.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{report.sl}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {report.icon && (
                            <img src={report.icon} alt={report.restaurantName} className="w-8 h-8 rounded" />
                          )}
                          <span className="text-sm text-slate-700">{report.restaurantName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.totalOrder}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.totalOrderAmount}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.taxAmount}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              Restaurant VAT report settings and preferences will be available here.
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
