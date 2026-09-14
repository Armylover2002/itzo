import { useState, useEffect, useMemo } from "react"
import { Search, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Settings, ArrowUpDown, Check, Columns, Package } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function EarningAddon() {
  const [searchQuery, setSearchQuery] = useState("")
  const [earningAddons, setEarningAddons] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedAddon, setSelectedAddon] = useState(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    title: true,
    requiredOrders: true,
    earningAmount: true,
    startDate: true,
    endDate: true,
    status: true,
    redemptions: true,
    actions: true,
  })

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    requiredOrders: "",
    earningAmount: "",
    startDate: "",
    endDate: "",
    maxRedemptions: "",
  })

  useEffect(() => {
    fetchEarningAddons()
  }, [])

  const fetchEarningAddons = async () => {
    try {
      setIsLoading(true)
      const response = await adminAPI.getEarningAddons()
      if (response.data.success) {
        const addons = response.data.data.earningAddons || []
        debugLog('?? Fetched earning addons:', addons)
        // Log redemption counts for debugging
        addons.forEach(addon => {
          debugLog(`?? Addon "${addon.title}":`, {
            currentRedemptions: addon.currentRedemptions,
            maxRedemptions: addon.maxRedemptions,
            display: `${addon.currentRedemptions || 0} / ${addon.maxRedemptions || '8'}`
          })
        })
        setEarningAddons(addons)
      } else {
        toast.error(response.data.message || "Failed to fetch earning addons")
      }
    } catch (error) {
      debugError("Error fetching earning addons:", error)
      debugError("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      })
      const errorMessage = error.response?.data?.message || error.message || "Failed to fetch earning addons"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAddons = useMemo(() => {
    if (!searchQuery.trim()) {
      return earningAddons
    }
    
    const query = searchQuery.toLowerCase().trim()
    return earningAddons.filter(addon =>
      addon.title?.toLowerCase().includes(query) ||
      addon.description?.toLowerCase().includes(query)
    )
  }, [earningAddons, searchQuery])

  const handleOpenDialog = (addon = null) => {
    if (addon) {
      setSelectedAddon(addon)
      setIsEditMode(true)
      setFormData({
        title: addon.title || "",
        requiredOrders: addon.requiredOrders?.toString() || "",
        earningAmount: addon.earningAmount?.toString() || "",
        startDate: addon.startDate ? new Date(addon.startDate).toISOString().split('T')[0] : "",
        endDate: addon.endDate ? new Date(addon.endDate).toISOString().split('T')[0] : "",
        maxRedemptions: addon.maxRedemptions?.toString() || "",
      })
    } else {
      setSelectedAddon(null)
      setIsEditMode(false)
      setFormData({
        title: "",
        requiredOrders: "",
        earningAmount: "",
        startDate: "",
        endDate: "",
        maxRedemptions: "",
      })
    }
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedAddon(null)
    setIsEditMode(false)
    setFormData({
      title: "",
      requiredOrders: "",
      earningAmount: "",
      startDate: "",
      endDate: "",
      maxRedemptions: "",
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!formData.title || !formData.title.trim()) {
      toast.error("Title is required")
      return
    }

    if (!formData.requiredOrders || parseInt(formData.requiredOrders) < 1) {
      toast.error("Required orders must be at least 1")
      return
    }

    if (!formData.earningAmount || parseFloat(formData.earningAmount) <= 0) {
      toast.error("Earning amount must be greater than 0")
      return
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error("Start date and end date are required")
      return
    }

    const startDate = new Date(formData.startDate)
    const endDate = new Date(formData.endDate)
    
    if (endDate <= startDate) {
      toast.error("End date must be after start date")
      return
    }

    try {
      const payload = {
        title: formData.title.trim(),
        requiredOrders: parseInt(formData.requiredOrders),
        earningAmount: parseFloat(formData.earningAmount),
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxRedemptions: formData.maxRedemptions && formData.maxRedemptions.trim() ? parseInt(formData.maxRedemptions) : null,
      }

      debugLog('Submitting earning addon:', { isEditMode, payload })

      if (isEditMode && selectedAddon) {
        const response = await adminAPI.updateEarningAddon(selectedAddon._id, payload)
        debugLog('Update response:', response.data)
        toast.success("Earning addon updated successfully")
      } else {
        const response = await adminAPI.createEarningAddon(payload)
        debugLog('Create response:', response.data)
        toast.success("Earning addon created successfully")
      }

      handleCloseDialog()
      fetchEarningAddons()
    } catch (error) {
      debugError("Error saving earning addon:", error)
      debugError("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      })
      
      // Show detailed error message
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || "Failed to save earning addon"
      
      toast.error(errorMessage)
      
      // If it's a validation error, show field-specific errors
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors
        Object.keys(errors).forEach(field => {
          toast.error(`${field}: ${errors[field]}`)
        })
      }
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this earning addon?")) {
      return
    }

    try {
      await adminAPI.deleteEarningAddon(id)
      toast.success("Earning addon deleted successfully")
      fetchEarningAddons()
    } catch (error) {
      debugError("Error deleting earning addon:", error)
      toast.error(error.response?.data?.message || "Failed to delete earning addon")
    }
  }

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      await adminAPI.toggleEarningAddonStatus(id, newStatus)
      toast.success(`Earning addon ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
      fetchEarningAddons()
    } catch (error) {
      debugError("Error toggling status:", error)
      toast.error(error.response?.data?.message || "Failed to update status")
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      title: true,
      requiredOrders: true,
      earningAmount: true,
      startDate: true,
      endDate: true,
      status: true,
      redemptions: true,
      actions: true,
    })
  }

  const columnsConfig = {
    title: "Title",
    requiredOrders: "Required Orders",
    earningAmount: "Earning Amount",
    startDate: "Start Date",
    endDate: "End Date",
    status: "Status",
    redemptions: "Redemptions",
    actions: "Actions",
  }

  const getStatusBadge = (status, isValid) => {
    const statusConfig = {
      active: { bg: "bg-green-100", text: "text-green-700", label: "Active" },
      upcoming: { bg: "bg-blue-100", text: "text-blue-700", label: "Upcoming" },
      inactive: { bg: "bg-gray-100", text: "text-gray-700", label: "Inactive" },
      expired: { bg: "bg-red-100", text: "text-red-700", label: "Expired" },
      completed: { bg: "bg-blue-100", text: "text-blue-700", label: "Completed" },
    }
    const config = statusConfig[status] || statusConfig.inactive
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label} {isValid && status === 'active' && "\u2713"}
      </span>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Earning Addon Offers</h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredAddons.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Ex: search offer title"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              <button
                onClick={() => handleOpenDialog()}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 flex items-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Offer</span>
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
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500">Loading...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.title && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Title</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.requiredOrders && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Required Orders</span>
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
                    {visibleColumns.startDate && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Start Date</span>
                        </div>
                      </th>
                    )}
                    {visibleColumns.endDate && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>End Date</span>
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
                    {visibleColumns.redemptions && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Redemptions</span>
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
                  {filteredAddons.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                        No earning addons found. Create your first offer!
                      </td>
                    </tr>
                  ) : (
                    filteredAddons.map((addon) => (
                      <tr key={addon._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.title && (
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{addon.title}</p>
                              {addon.description && (
                                <p className="text-xs text-slate-500 mt-1">{addon.description}</p>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColumns.requiredOrders && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-900">{addon.requiredOrders}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.earningAmount && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-emerald-500">₹</span>
                              <span className="text-sm font-medium text-slate-900">{addon.earningAmount?.toFixed(2)}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.startDate && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">
                              {new Date(addon.startDate).toLocaleDateString()}
                            </span>
                          </td>
                        )}
                        {visibleColumns.endDate && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">
                              {new Date(addon.endDate).toLocaleDateString()}
                            </span>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(addon.status, addon.isValid)}
                          </td>
                        )}
                        {visibleColumns.redemptions && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">
                              {addon.currentRedemptions || 0} / {addon.maxRedemptions || '8'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleStatus(addon._id, addon.status)}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                title={addon.status === 'active' ? 'Deactivate' : 'Activate'}
                              >
                                {addon.status === 'active' ? (
                                  <ToggleRight className="w-5 h-5 text-green-500" />
                                ) : (
                                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              <button
                                onClick={() => handleOpenDialog(addon)}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4 text-blue-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(addon._id)}
                                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
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
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-gradient-to-br from-slate-50 via-white to-slate-50 p-0 border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-4 rounded-t-2xl">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4" />
                {isEditMode ? "Edit Earning Addon" : "Create Earning Addon Offer"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <form onSubmit={handleSubmit} className="px-5 py-5 space-y-4">
            {/* Title Field */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                placeholder="e.g., Complete 50 orders and earn \u20B9500"
              />
            </div>

            {/* Orders and Earnings Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Required Orders <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.requiredOrders}
                    onChange={(e) => setFormData({ ...formData, requiredOrders: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                    placeholder="e.g., 50"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Earning Amount (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-500">₹</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.earningAmount}
                    onChange={(e) => setFormData({ ...formData, earningAmount: e.target.value })}
                    className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                    placeholder="e.g., 500.00"
                  />
                </div>
              </div>
            </div>

            {/* Date Range Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-slate-700">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                />
              </div>
            </div>

            {/* Max Redemptions Field */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Max Redemptions</label>
              <input
                type="number"
                min="1"
                value={formData.maxRedemptions}
                onChange={(e) => setFormData({ ...formData, maxRedemptions: e.target.value })}
                className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                placeholder="Leave empty for unlimited"
              />
              <p className="text-xs text-slate-500">Leave empty for unlimited redemptions</p>
            </div>

            {/* Footer Buttons */}
            <DialogFooter className="pt-3 border-t border-slate-200 mt-4">
              <button
                type="button"
                onClick={handleCloseDialog}
                className="px-5 py-2 text-sm font-semibold rounded-lg border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/30 transition-all"
              >
                {isEditMode ? "Update" : "Create"} Offer
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-slate-50 via-white to-slate-50 p-0 border-0 shadow-2xl">
          <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-5 rounded-t-2xl">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Table Settings
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Visible Columns
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-200"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-emerald-600" />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={resetColumns}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30 transition-all"
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

