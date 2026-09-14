import { useState, useMemo } from "react"
import { Search, Download, ChevronDown, ArrowUpDown, Plus, Edit, Trash2, Megaphone, Filter, Settings, FileSpreadsheet, FileDown, FileText, Code } from "lucide-react"
import { emptyBasicCampaigns } from "@food/utils/adminFallbackData"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { exportCampaignsToCSV, exportCampaignsToExcel, exportCampaignsToPDF, exportCampaignsToJSON } from "@food/components/admin/campaigns/campaignsExportUtils"
import AddEditBasicCampaignDialog from "@food/components/admin/campaigns/AddEditBasicCampaignDialog"
import DeleteCampaignDialog from "@food/components/admin/campaigns/DeleteCampaignDialog"
import CampaignFilterPanel from "@food/components/admin/campaigns/CampaignFilterPanel"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"

export default function BasicCampaign() {
  const [searchQuery, setSearchQuery] = useState("")
  const [campaigns, setCampaigns] = useState(emptyBasicCampaigns)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [filters, setFilters] = useState({
    status: "",
    fromDate: "",
    toDate: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    title: true,
    dateDuration: true,
    timeDuration: true,
    status: true,
    actions: true,
  })

  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns]
    
    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(campaign =>
        campaign.title.toLowerCase().includes(query) ||
        campaign.dateStart.toLowerCase().includes(query) ||
        campaign.dateEnd.toLowerCase().includes(query)
      )
    }

    // Apply filters
    if (filters.status) {
      result = result.filter(campaign => {
        if (filters.status === "Active") return campaign.status === true
        if (filters.status === "Inactive") return campaign.status === false
        return true
      })
    }

    if (filters.fromDate) {
      result = result.filter(campaign => {
        const campaignStart = new Date(campaign.dateStart)
        const filterStart = new Date(filters.fromDate)
        return campaignStart >= filterStart
      })
    }

    if (filters.toDate) {
      result = result.filter(campaign => {
        const campaignEnd = new Date(campaign.dateEnd)
        const filterEnd = new Date(filters.toDate)
        return campaignEnd <= filterEnd
      })
    }

    return result
  }, [campaigns, searchQuery, filters])

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "" && value !== null && value !== undefined).length
  }, [filters])

  const handleToggleStatus = (sl) => {
    setCampaigns(campaigns.map(campaign =>
      campaign.sl === sl ? { ...campaign, status: !campaign.status } : campaign
    ))
  }

  const handleDelete = (sl) => {
    setCampaigns(campaigns.filter(campaign => campaign.sl !== sl))
  }

  const handleEdit = (campaign) => {
    setSelectedCampaign(campaign)
    setIsAddEditOpen(true)
  }

  const handleAdd = () => {
    setSelectedCampaign(null)
    setIsAddEditOpen(true)
  }

  const handleSave = (formData) => {
    if (selectedCampaign) {
      // Edit existing
      setCampaigns(campaigns.map(campaign =>
        campaign.sl === selectedCampaign.sl ? { ...campaign, ...formData } : campaign
      ))
    } else {
      // Add new
      const newCampaign = {
        sl: campaigns.length > 0 ? Math.max(...campaigns.map(c => c.sl)) + 1 : 1,
        ...formData,
        status: true,
      }
      setCampaigns([...campaigns, newCampaign])
    }
  }

  const handleDeleteClick = (campaign) => {
    setSelectedCampaign(campaign)
    setIsDeleteOpen(true)
  }

  const handleExport = (format) => {
    const filename = "basic_campaigns"
    switch (format) {
      case "csv":
        exportCampaignsToCSV(filteredCampaigns, filename, false)
        break
      case "excel":
        exportCampaignsToExcel(filteredCampaigns, filename, false)
        break
      case "pdf":
        exportCampaignsToPDF(filteredCampaigns, filename, false)
        break
      case "json":
        exportCampaignsToJSON(filteredCampaigns, filename)
        break
      default:
        break
    }
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      title: true,
      dateDuration: true,
      timeDuration: true,
      status: true,
      actions: true,
    })
  }

  const columnConfig = {
    si: "Serial Number",
    title: "Title",
    dateDuration: "Date Duration",
    timeDuration: "Time Duration",
    status: "Status",
    actions: "Actions",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Basic Campaign</h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredCampaigns.length}
              </span>
            </div>
          </div>

          <button 
            onClick={handleAdd}
            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            Add New Campaign
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="relative flex-1 sm:flex-initial min-w-[200px]">
            <input
              type="text"
              placeholder="Ex: Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                <span>Export</span>
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
              activeFiltersCount > 0 ? "border-emerald-500 bg-emerald-50" : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
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
                {visibleColumns.si && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>SI</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.title && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Title</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.dateDuration && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Date Duration</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.timeDuration && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Time Duration</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.actions && (
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-20 text-center">
                    <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                    <p className="text-sm text-slate-500">No campaigns match your search</p>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((campaign) => (
                  <tr
                    key={campaign.sl}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {visibleColumns.si && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{campaign.sl}</span>
                      </td>
                    )}
                    {visibleColumns.title && (
                      <td className="px-6 py-4">
                        <a href="#" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {campaign.title}
                        </a>
                      </td>
                    )}
                    {visibleColumns.dateDuration && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{campaign.dateStart} - {campaign.dateEnd}</span>
                      </td>
                    )}
                    {visibleColumns.timeDuration && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{campaign.timeStart} - {campaign.timeEnd}</span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(campaign.sl)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            campaign.status ? "bg-blue-600" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              campaign.status ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(campaign)}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(campaign)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <AddEditBasicCampaignDialog
        isOpen={isAddEditOpen}
        onOpenChange={setIsAddEditOpen}
        campaign={selectedCampaign}
        onSave={handleSave}
      />

      {/* Delete Dialog */}
      <DeleteCampaignDialog
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        campaign={selectedCampaign}
        onConfirm={handleDelete}
      />

      {/* Filter Panel */}
      <CampaignFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={() => setIsFilterOpen(false)}
        onReset={() => setFilters({ status: "", fromDate: "", toDate: "" })}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={columnConfig}
      />
    </div>
  )
}
