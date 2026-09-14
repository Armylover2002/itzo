import { useState, useEffect } from "react"
import { Download, ChevronDown, FileText, IndianRupee, Settings, FileSpreadsheet, Code, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


export default function TaxReport() {
  const [filters, setFilters] = useState({
    dateRangeType: "All Time",
    calculateTax: "Percentage",
    taxRate: "Select Tax Rate",
  })
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState({
    totalIncome: "₹0.00",
    totalTax: "₹0.00"
  })
  const [loading, setLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reportDetail, setReportDetail] = useState(null)

  const fetchTaxReport = async (overrideFilters = null) => {
    try {
      setLoading(true)
      const activeFilters = overrideFilters || filters

      let fromDate = null
      let toDate = null
      const now = new Date()

      if (activeFilters.dateRangeType === "Today") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      } else if (activeFilters.dateRangeType === "This Week") {
        const dayOfWeek = now.getDay()
        const diff = now.getDate() - dayOfWeek
        fromDate = new Date(now.getFullYear(), now.getMonth(), diff)
        toDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59)
      } else if (activeFilters.dateRangeType === "This Month") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      } else if (activeFilters.dateRangeType === "This Year") {
        fromDate = new Date(now.getFullYear(), 0, 1)
        toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
      }

      const params = {
        fromDate: fromDate ? fromDate.toISOString() : undefined,
        toDate: toDate ? toDate.toISOString() : undefined,
        limit: 1000,
        calculateTax: activeFilters.calculateTax || undefined,
        taxRate:
          activeFilters.taxRate && activeFilters.taxRate !== "Select Tax Rate"
            ? activeFilters.taxRate
            : undefined,
      }

      const response = await adminAPI.getTaxReport(params)

      if (response?.data?.success && response.data.data) {
        setReports(response.data.data.reports || [])
        setStats(response.data.data.stats || {
          totalIncome: "₹0.00",
          totalTax: "₹0.00"
        })
      } else {
        setReports([])
        if (response?.data?.message) {
          toast.error(response.data.message)
        }
      }
    } catch (error) {
      debugError("Error fetching tax report:", error)
      toast.error("Failed to fetch tax report")
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTaxReport()
  }, [filters.dateRangeType])

  const handleReset = () => {
    const defaults = {
      dateRangeType: "All Time",
      calculateTax: "Percentage",
      taxRate: "Select Tax Rate",
    }
    setFilters(defaults)
    fetchTaxReport(defaults)
  }

  const handleSubmit = () => {
    fetchTaxReport()
  }

  const handleViewDetails = async (report) => {
    setSelectedReport(report)
    setDetailLoading(true)
    try {
      let fromDate = null
      let toDate = null
      const now = new Date()

      if (filters.dateRangeType === "Today") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
      } else if (filters.dateRangeType === "This Week") {
        const dayOfWeek = now.getDay()
        const diff = now.getDate() - dayOfWeek
        fromDate = new Date(now.getFullYear(), now.getMonth(), diff)
        toDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59)
      } else if (filters.dateRangeType === "This Month") {
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      } else if (filters.dateRangeType === "This Year") {
        fromDate = new Date(now.getFullYear(), 0, 1)
        toDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
      }

      const params = {
        fromDate: fromDate ? fromDate.toISOString() : undefined,
        toDate: toDate ? toDate.toISOString() : undefined,
        calculateTax: filters.calculateTax || undefined,
        taxRate:
          filters.taxRate && filters.taxRate !== "Select Tax Rate"
            ? filters.taxRate
            : undefined,
      }

      const response = await adminAPI.getTaxReportDetail(report.id, params)
      if (response?.data?.success) {
        setReportDetail(response.data.data)
      } else {
        toast.error(response?.data?.message || "Failed to fetch details")
      }
    } catch (error) {
      debugError("Error fetching tax detail:", error)
      toast.error("An error occurred while fetching details")
    } finally {
      setDetailLoading(false)
    }
  }

  const handleExport = async (format) => {
    if (reports.length === 0) {
      alert("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "incomeSource", label: "Income Source" },
      { key: "totalIncome", label: "Total Income" },
      { key: "totalTax", label: "Total Tax" },
    ]
    const exportRows = reports.map((report, index) => ({
      sl: report.sl || index + 1,
      incomeSource: report.incomeSource || "N/A",
      totalIncome: report.totalIncome || "\u20B90.00",
      totalTax: report.totalTax || "\u20B90.00",
    }))
    switch (format) {
      case "csv": exportReportsToCSV(exportRows, headers, "tax_report"); break
      case "excel": exportReportsToExcel(exportRows, headers, "tax_report"); break
      case "pdf": await exportReportsToPDF(exportRows, headers, "tax_report", "Tax Report"); break
      case "json": exportReportsToJSON(exportRows, "tax_report"); break
    }
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading tax report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Generate Tax Report</h1>
        </div>

        {/* Admin Tax Report Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Admin Tax Report</h2>
          <p className="text-sm text-slate-600 mb-6">
            To generate you tax report please select & input following field and submit for the result.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Date Range Type
              </label>
              <select
                value={filters.dateRangeType}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRangeType: e.target.value }))}
                className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All Time">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="This Year">This Year</option>
              </select>
              <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select How to calculate tax
              </label>
              <select
                value={filters.calculateTax}
                onChange={(e) => setFilters(prev => ({ ...prev, calculateTax: e.target.value }))}
                className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Percentage">Percentage</option>
                <option value="Fixed Amount">Fixed Amount</option>
                <option value="Tiered">Tiered</option>
              </select>
              <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Select Tax Rates
              </label>
              <select
                value={filters.taxRate}
                onChange={(e) => setFilters(prev => ({ ...prev, taxRate: e.target.value }))}
                className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Select Tax Rate">Select Tax Rate</option>
                <option value="5%">5%</option>
                <option value="10%">10%</option>
                <option value="15%">15%</option>
                <option value="18%">18%</option>
                <option value="20%">20%</option>
              </select>
              <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Reset
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
            >
              Submit
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Total Income Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Income</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalIncome}</p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-yellow-100 flex items-center justify-center">
                <IndianRupee className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          {/* Total Tax Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Total Tax</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalTax}</p>
              </div>
              <div className="w-14 h-14 rounded-lg bg-pink-100 flex items-center justify-center">
                <FileText className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Tax Report List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Tax Report List ({reports.length})</h2>

            <div className="flex items-center gap-3">
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
          {reports.length === 0 ? (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                  <FileText className="w-12 h-12 text-purple-600" />
                </div>
                <p className="text-lg font-semibold text-slate-700 mb-2">No Tax Report Generated</p>
                <p className="text-sm text-slate-500 max-w-md">
                  To generate your tax report please select & input above field and submit for the result
                </p>
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
                      Income Source
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Total Income
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Total Tax
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {reports.map((report) => (
                    <tr key={report.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{report.sl}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{report.incomeSource}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.totalIncome}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{report.totalTax}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleViewDetails(report)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
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
              Tax report settings and preferences will be available here.
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

      {/* View Details Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
        <DialogContent className="max-w-2xl bg-white p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Tax Details: {selectedReport?.incomeSource}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 max-h-[70vh] overflow-y-auto">
            {detailLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-600">Fetching order details...</p>
              </div>
            ) : reportDetail?.orders?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Order ID</th>
                      <th className="px-4 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">Taxable Amount</th>
                      <th className="px-4 py-2 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportDetail.orders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{order.orderId}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{new Date(order.date).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-700">{order.totalAmount}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">{order.taxAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">No detailed orders found for this period.</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-slate-500">Total Tax: </span>
              <span className="font-bold text-red-600">{selectedReport?.totalTax}</span>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

