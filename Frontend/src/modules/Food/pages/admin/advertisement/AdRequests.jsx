import { useState, useMemo } from "react"
import { Search, Settings, MoreVertical, Building2, Download, ChevronDown, Filter, FileDown, FileSpreadsheet, FileText, Code, Eye, CheckCircle2, XCircle } from "lucide-react"
import { emptyAdRequests } from "@food/utils/adminFallbackData"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@food/components/ui/dialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { exportAdvertisementsToCSV, exportAdvertisementsToExcel, exportAdvertisementsToPDF, exportAdvertisementsToJSON } from "@food/components/admin/advertisements/advertisementsExportUtils"

export default function AdRequests() {
  const [activeTab, setActiveTab] = useState("new")
  const [searchQuery, setSearchQuery] = useState("")
  const [requests, setRequests] = useState(emptyAdRequests)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [filters, setFilters] = useState({
    adsType: "",
    restaurant: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    adsId: true,
    adsTitle: true,
    restaurantInfo: true,
    adsType: true,
    duration: true,
    actions: true,
  })

  const columnsConfig = {
    si: "Serial Number",
    adsId: "Ads ID",
    adsTitle: "Ads Title",
    restaurantInfo: "Restaurant Info",
    adsType: "Ads Type",
    duration: "Duration",
    actions: "Actions",
  }

  const filteredRequests = useMemo(() => {
    let result = [...requests]
    
    // Filter by tab
    if (activeTab === "new") {
      result = result.filter(r => r.status === "new" || !r.status)
    } else if (activeTab === "update") {
      result = result.filter(r => r.status === "update")
    } else if (activeTab === "denied") {
      result = result.filter(r => r.status === "denied")
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(request =>
        request.adsId?.toLowerCase().includes(query) ||
        request.restaurantName?.toLowerCase().includes(query) ||
        request.adsTitle?.toLowerCase().includes(query)
      )
    }
    
    // Filter by ads type
    if (filters.adsType) {
      result = result.filter(r => r.adsType === filters.adsType)
    }
    
    // Filter by restaurant
    if (filters.restaurant) {
      result = result.filter(r => r.restaurantName === filters.restaurant)
    }
    
    return result
  }, [requests, searchQuery, activeTab, filters])

  const activeFiltersCount = Object.values(filters).filter(v => v).length

  const handleExport = (format) => {
    const filename = `ad_requests_${activeTab}`
    switch (format) {
      case "csv":
        exportAdvertisementsToCSV(filteredRequests, filename)
        break
      case "excel":
        exportAdvertisementsToExcel(filteredRequests, filename)
        break
      case "pdf":
        exportAdvertisementsToPDF(filteredRequests, filename)
        break
      case "json":
        exportAdvertisementsToJSON(filteredRequests, filename)
        break
      default:
        break
    }
  }

  const handleViewRequest = (request) => {
    setSelectedRequest(request)
    setIsViewOpen(true)
  }

  const handleApprove = (sl) => {
    setRequests(requests.map(r => 
      r.sl === sl ? { ...r, status: "approved" } : r
    ))
  }

  const handleDeny = (sl) => {
    setRequests(requests.map(r => 
      r.sl === sl ? { ...r, status: "denied" } : r
    ))
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      adsId: true,
      adsTitle: true,
      restaurantInfo: true,
      adsType: true,
      duration: true,
      actions: true,
    })
  }

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      adsType: "",
      restaurant: "",
    })
  }

  const restaurants = [...new Set(requests.map(r => r.restaurantName))].filter(Boolean)
  const adsTypes = [...new Set(requests.map(r => r.adsType))].filter(Boolean)

  const tabs = [
    { key: "new", label: "New Request" },
    { key: "update", label: "Update Request" },
    { key: "denied", label: "Denied Requests" },
  ]

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Advertisement Requests</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredRequests.length}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Advertisement</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredRequests.length}
              </span>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by ads ID or restaurant"
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
                    <FileDown className="w-4 h-4 mr-2" />
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
                onClick={() => setIsFilterOpen(true)}
                className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all relative ${
                  activeFiltersCount > 0 ? "border-[#6412c6] bg-[#f0e7f9]" : ""
                }`}
              >
                <Filter className="w-4 h-4" />
                <span className="text-black font-bold">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#6412c6] text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {visibleColumns.si && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>}
                {visibleColumns.adsId && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Ads ID</th>}
                {visibleColumns.adsTitle && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Ads Title</th>}
                {visibleColumns.restaurantInfo && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Restaurant Info</th>}
                {visibleColumns.adsType && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Ads Type</th>}
                {visibleColumns.duration && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Duration</th>}
                {visibleColumns.actions && <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-20 text-center">
                    <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                    <p className="text-sm text-slate-500">No requests match your search</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr
                    key={request.sl}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {visibleColumns.si && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{request.sl}</span>
                      </td>
                    )}
                    {visibleColumns.adsId && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{request.adsId}</span>
                      </td>
                    )}
                    {visibleColumns.adsTitle && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">{request.adsTitle}</span>
                      </td>
                    )}
                    {visibleColumns.restaurantInfo && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#f0e7f9] flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-[#550fa8]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">{request.restaurantName}</span>
                            <span className="text-xs text-slate-500">{request.restaurantEmail}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.adsType && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{request.adsType}</span>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{request.duration}</span>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <DropdownMenuItem 
                              onClick={() => handleViewRequest(request)}
                              className="cursor-pointer"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {activeTab === "new" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleApprove(request.sl)}
                                  className="cursor-pointer text-emerald-600"
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeny(request.sl)}
                                  className="cursor-pointer text-red-600"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Deny
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Panel */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Requests
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Ads Type
              </label>
              <select
                value={filters.adsType}
                onChange={(e) => setFilters(prev => ({ ...prev, adsType: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">All Types</option>
                {adsTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Restaurant
              </label>
              <select
                value={filters.restaurant}
                onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">All Restaurants</option>
                {restaurants.map(restaurant => (
                  <option key={restaurant} value={restaurant}>{restaurant}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={columnsConfig}
      />

      {/* View Request Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Advertisement Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads ID</p>
                  <p className="text-sm text-slate-900">{selectedRequest.adsId}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads Title</p>
                  <p className="text-sm text-slate-900">{selectedRequest.adsTitle}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Restaurant Name</p>
                  <p className="text-sm text-slate-900">{selectedRequest.restaurantName}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Restaurant User Id</p>
                  <p className="text-sm text-slate-900">{selectedRequest.restaurantEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads Type</p>
                  <p className="text-sm text-slate-900">{selectedRequest.adsType}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Duration</p>
                  <p className="text-sm text-slate-900">{selectedRequest.duration}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
