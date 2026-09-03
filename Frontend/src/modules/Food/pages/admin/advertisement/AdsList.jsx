import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Download, ChevronDown, Plus, MoreVertical, Building2, Settings, Filter, FileDown, FileSpreadsheet, FileText, Code, Eye, Edit, Trash2 } from "lucide-react"
import { emptyAds } from "@food/utils/adminFallbackData"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@food/components/ui/dialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { exportAdvertisementsToCSV, exportAdvertisementsToExcel, exportAdvertisementsToPDF, exportAdvertisementsToJSON } from "@food/components/admin/advertisements/advertisementsExportUtils"

export default function AdsList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [adsType, setAdsType] = useState("all")
  const [ads, setAds] = useState(emptyAds)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [filters, setFilters] = useState({
    status: "",
    restaurant: "",
    priority: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    adsId: true,
    adsTitle: true,
    restaurantInfo: true,
    adsType: true,
    duration: true,
    status: true,
    priority: true,
    actions: true,
  })

  const columnsConfig = {
    si: "Serial Number",
    adsId: "Ads ID",
    adsTitle: "Ads Title",
    restaurantInfo: "Restaurant Info",
    adsType: "Ads Type",
    duration: "Duration",
    status: "Status",
    priority: "Priority",
    actions: "Actions",
  }

  const filteredAds = useMemo(() => {
    let result = [...ads]
    
    if (adsType !== "all") {
      result = result.filter(ad => ad.adsType === adsType)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(ad =>
        ad.adsId?.toLowerCase().includes(query) ||
        ad.restaurantName?.toLowerCase().includes(query) ||
        ad.adsTitle?.toLowerCase().includes(query)
      )
    }

    if (filters.status) {
      result = result.filter(ad => ad.status === filters.status)
    }

    if (filters.restaurant) {
      result = result.filter(ad => ad.restaurantName === filters.restaurant)
    }

    if (filters.priority) {
      result = result.filter(ad => ad.priority === filters.priority)
    }

    return result
  }, [ads, searchQuery, adsType, filters])

  const activeFiltersCount = Object.values(filters).filter(v => v).length

  const handleExport = (format) => {
    const filename = "ads_list"
    switch (format) {
      case "csv":
        exportAdvertisementsToCSV(filteredAds, filename)
        break
      case "excel":
        exportAdvertisementsToExcel(filteredAds, filename)
        break
      case "pdf":
        exportAdvertisementsToPDF(filteredAds, filename)
        break
      case "json":
        exportAdvertisementsToJSON(filteredAds, filename)
        break
      default:
        break
    }
  }

  const handlePriorityChange = (sl, newPriority) => {
    setAds(ads.map(ad =>
      ad.sl === sl ? { ...ad, priority: newPriority } : ad
    ))
  }

  const handleViewAd = (ad) => {
    setSelectedAd(ad)
    setIsViewOpen(true)
  }

  const handleEditAd = (ad) => {
    navigate("/ecs/new-advertisement", { state: { editAd: ad } })
  }

  const handleDeleteClick = (ad) => {
    setSelectedAd(ad)
    setIsDeleteOpen(true)
  }

  const handleDelete = () => {
    if (selectedAd) {
      setAds(ads.filter(ad => ad.sl !== selectedAd.sl))
      setIsDeleteOpen(false)
      setSelectedAd(null)
    }
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
      status: true,
      priority: true,
      actions: true,
    })
  }

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      status: "",
      restaurant: "",
      priority: "",
    })
  }

  const restaurants = [...new Set(ads.map(ad => ad.restaurantName))].filter(Boolean)
  const statuses = [...new Set(ads.map(ad => ad.status))].filter(Boolean)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Ads List</h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredAds.length}
              </span>
            </div>
          </div>

          <button 
            onClick={() => navigate("/ecs/new-advertisement")}
            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Advertisement
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={adsType}
            onChange={(e) => setAdsType(e.target.value)}
            className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="all">All Ads</option>
            <option value="Restaurant Promotion">Restaurant Promotion</option>
            <option value="Video promotion">Video promotion</option>
          </select>

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
                {visibleColumns.status && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>}
                {visibleColumns.priority && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Priority</th>}
                {visibleColumns.actions && <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredAds.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-20 text-center">
                    <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                    <p className="text-sm text-slate-500">No ads match your search</p>
                  </td>
                </tr>
              ) : (
                filteredAds.map((ad) => (
                  <tr
                    key={ad.sl}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {visibleColumns.si && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{ad.sl}</span>
                      </td>
                    )}
                    {visibleColumns.adsId && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button 
                          onClick={() => handleViewAd(ad)}
                          className="text-sm font-medium text-primary hover:text-primary-hover"
                        >
                          {ad.adsId}
                        </button>
                      </td>
                    )}
                    {visibleColumns.adsTitle && (
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-900">{ad.adsTitle}</span>
                      </td>
                    )}
                    {visibleColumns.restaurantInfo && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#f0e7f9] flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-[#550fa8]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">{ad.restaurantName}</span>
                            <span className="text-xs text-slate-500">{ad.restaurantEmail}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.adsType && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{ad.adsType}</span>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{ad.duration}</span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f0e7f9] text-[#460d8b]">
                          {ad.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.priority && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={ad.priority || ""}
                          onChange={(e) => handlePriorityChange(ad.sl, e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="">N/A</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
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
                              onClick={() => handleViewAd(ad)}
                              className="cursor-pointer"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEditAd(ad)}
                              className="cursor-pointer"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(ad)}
                              className="cursor-pointer text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
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
              Filter Ads
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
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
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Priority
              </label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">All Priorities</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
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

      {/* View Ad Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Advertisement Details</DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads ID</p>
                  <p className="text-sm text-slate-900">{selectedAd.adsId}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads Title</p>
                  <p className="text-sm text-slate-900">{selectedAd.adsTitle}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Restaurant Name</p>
                  <p className="text-sm text-slate-900">{selectedAd.restaurantName}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Restaurant User Id</p>
                  <p className="text-sm text-slate-900">{selectedAd.restaurantEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads Type</p>
                  <p className="text-sm text-slate-900">{selectedAd.adsType}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Duration</p>
                  <p className="text-sm text-slate-900">{selectedAd.duration}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Status</p>
                  <p className="text-sm text-slate-900">{selectedAd.status}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Priority</p>
                  <p className="text-sm text-slate-900">{selectedAd.priority || "N/A"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Delete Advertisement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this advertisement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
