import { useState, useMemo } from "react"
import { Settings, Building, ShoppingBag, Download, ChevronDown, FileText, FileSpreadsheet, Code, Filter, Search, RefreshCw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportDisbursementsToCSV, exportDisbursementsToExcel, exportDisbursementsToPDF, exportDisbursementsToJSON } from "./disbursementExportUtils"

export default function DisbursementPage({ 
  title, 
  icon: Icon, 
  tabs, 
  disbursements, 
  count,
  loading,
  onRefresh,
  onAction
}) {
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [filters, setFilters] = useState({
    status: "",
    dateRange: { start: "", end: "" },
    amountRange: { min: "", max: "" },
  })
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  const filteredDisbursements = useMemo(() => {
    let result = [...disbursements]
    
    if (activeTab !== "all") {
      result = result.filter(disbursement => 
        disbursement.status.toLowerCase() === activeTab.toLowerCase()
      )
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(disbursement =>
        disbursement.id.toLowerCase().includes(query) ||
        disbursement.status.toLowerCase().includes(query)
      )
    }

    if (filters.status) {
      result = result.filter(d => d.status.toLowerCase() === filters.status.toLowerCase())
    }

    if (filters.dateRange.start) {
      result = result.filter(d => {
        const dDate = new Date(d.createdAt)
        const startDate = new Date(filters.dateRange.start)
        return dDate >= startDate
      })
    }

    if (filters.dateRange.end) {
      result = result.filter(d => {
        const dDate = new Date(d.createdAt)
        const endDate = new Date(filters.dateRange.end)
        endDate.setHours(23, 59, 59, 999)
        return dDate <= endDate
      })
    }

    if (filters.amountRange.min) {
      result = result.filter(d => d.totalAmount >= parseFloat(filters.amountRange.min))
    }

    if (filters.amountRange.max) {
      result = result.filter(d => d.totalAmount <= parseFloat(filters.amountRange.max))
    }

    return result
  }, [disbursements, activeTab, searchQuery, filters])

  const handleExport = (format) => {
    if (filteredDisbursements.length === 0) {
      alert("No data to export")
      return
    }
    switch (format) {
      case "csv": exportDisbursementsToCSV(filteredDisbursements, title.toLowerCase().replace(/\s+/g, "_")); break
      case "excel": exportDisbursementsToExcel(filteredDisbursements, title.toLowerCase().replace(/\s+/g, "_")); break
      case "pdf": exportDisbursementsToPDF(filteredDisbursements, title.toLowerCase().replace(/\s+/g, "_")); break
      case "json": exportDisbursementsToJSON(filteredDisbursements, title.toLowerCase().replace(/\s+/g, "_")); break
    }
  }

  const handleResetFilters = () => {
    setFilters({
      status: "",
      dateRange: { start: "", end: "" },
      amountRange: { min: "", max: "" },
    })
  }

  const activeFiltersCount = (filters.status ? 1 : 0) + (filters.dateRange.start ? 1 : 0) + (filters.dateRange.end ? 1 : 0) + (filters.amountRange.min ? 1 : 0) + (filters.amountRange.max ? 1 : 0)

  const getStatusColor = (status) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "pending") {
      return "bg-blue-100 text-blue-700"
    }
    if (statusLower === "processing") {
      return "bg-yellow-100 text-yellow-700"
    }
    if (statusLower === "completed") {
      return "bg-green-100 text-green-700"
    }
    if (statusLower === "partially completed") {
      return "bg-red-100 text-red-700"
    }
    if (statusLower === "canceled") {
      return "bg-red-100 text-red-700"
    }
    return "bg-slate-100 text-slate-700"
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 relative">
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
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
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <Settings className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            {Icon && <Icon className="w-5 h-5 text-blue-600" />}
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredDisbursements.length}
            </span>
            {onRefresh && (
              <button 
                onClick={onRefresh}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors ml-auto"
                disabled={loading}
              >
                <div className={loading ? "animate-spin" : ""}>
                  <RefreshCw className="w-4 h-4 text-slate-600" />
                </div>
              </button>
            )}
          </div>

          {/* Search and Filter */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="Search by ID or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <button 
              onClick={() => setIsFilterOpen(true)}
              className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all relative ${
                activeFiltersCount > 0 ? "border-emerald-500 bg-emerald-50" : ""
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-black font-bold">Filter</span>
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === tab.toLowerCase()
                    ? "text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab}
                {activeTab === tab.toLowerCase() && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Disbursement Cards */}
        <div className="space-y-4">
          {loading ? (
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">Loading data...</p>
             </div>
          ) : filteredDisbursements.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No disbursements found</p>
            </div>
          ) : (
            filteredDisbursements.map((disbursement) => (
              <div
                key={disbursement.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Left Side */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {disbursement.restaurantName || "Disbursement"} # {disbursement.id.slice(-6).toUpperCase()}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          disbursement.status
                        )}`}
                      >
                        {disbursement.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      Created at {disbursement.createdAt}
                    </p>
                  </div>

                  {/* Right Side */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-500 mb-1">Total amount</p>
                      <p className="text-lg font-bold text-slate-900">
                        ₹ {disbursement.totalAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       {disbursement.status.toLowerCase() === 'pending' && onAction && (
                         <>
                           <button 
                             onClick={() => onAction(disbursement.id, 'approve')}
                             className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                           >
                              Approve
                           </button>
                           <button 
                             onClick={() => onAction(disbursement.id, 'reject')}
                             className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors shadow-sm"
                           >
                              Reject
                           </button>
                         </>
                       )}
                       <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
                        Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Filter Dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Options
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="partially completed">Partially Completed</option>
                <option value="canceled">Canceled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, start: e.target.value } })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => setFilters({ ...filters, dateRange: { ...filters.dateRange, end: e.target.value } })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Min Amount ($)</label>
              <input
                type="number"
                value={filters.amountRange.min}
                onChange={(e) => setFilters({ ...filters, amountRange: { ...filters.amountRange, min: e.target.value } })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Max Amount ($)</label>
              <input
                type="number"
                value={filters.amountRange.max}
                onChange={(e) => setFilters({ ...filters, amountRange: { ...filters.amountRange, max: e.target.value } })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Reset
            </button>
            <button
              onClick={() => setIsFilterOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
            >
              Apply
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Disbursement settings and preferences will be available here.
            </p>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


