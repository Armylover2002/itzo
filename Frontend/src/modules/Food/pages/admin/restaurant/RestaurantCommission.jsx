import { useState, useMemo, useEffect } from "react"
import { Search, Plus, Pencil, Trash2, ArrowUpDown, Loader2, UtensilsCrossed, Percent, Check, AlertTriangle, CheckSquare, Square } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import {
  DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE,
  resolveRestaurantCommissionPercentage,
  isCustomRestaurantCommission,
} from "@food/constants/commission"

const debugLog = (...args) => {}
const debugError = (...args) => {}

export default function RestaurantCommission() {
  const [restaurants, setRestaurants] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState("configured") // "configured" or "all"
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" })

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)

  // Selected restaurant for edit/delete
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [commissionInput, setCommissionInput] = useState("")
  
  // Multi-select state (only used in "all" tab)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkCommissionInput, setBulkCommissionInput] = useState("")

  // New commission form state
  const [newCommissionForm, setNewCommissionForm] = useState({
    restaurantId: "",
    commissionPercentage: ""
  })
  
  // Loading states for actions
  const [isSaving, setIsSaving] = useState(false)
  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [updatingStatusId, setUpdatingStatusId] = useState(null)

  // Fetch approved restaurants on load
  const fetchRestaurants = async () => {
    try {
      setIsLoading(true)
      const response = await adminAPI.getRestaurants({ limit: 1000, status: 'approved' })
      const body = response?.data
      const data = body?.data
      
      const rawList = Array.isArray(data?.restaurants)
        ? data.restaurants
        : Array.isArray(data)
          ? data
          : Array.isArray(body?.restaurants)
            ? body.restaurants
            : []

      // Normalize fields
      const mapped = rawList.map((res, index) => ({
        id: res._id || res.id || index + 1,
        _id: res._id,
        restaurantId: res.restaurantId || `REST${String(index + 1).padStart(5, "0")}`,
        name: res.name || res.restaurantName || "N/A",
        commissionPercentage: resolveRestaurantCommissionPercentage(res.commissionPercentage),
        isActive: res.isActive !== false,
      }))
      
      setRestaurants(mapped)
    } catch (err) {
      debugError("Failed to fetch restaurants for commission module:", err)
      toast.error(err?.response?.data?.message || "Failed to load restaurants")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRestaurants()
  }, [])

  // Reset selections when switching tabs
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filterMode])

  // Filter & Sort restaurants
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants]

    if (filterMode === "configured") {
      result = result.filter(res => isCustomRestaurantCommission(res.commissionPercentage))
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(res =>
        res.name.toLowerCase().includes(query) ||
        res.restaurantId.toLowerCase().includes(query) ||
        String(res.id).toLowerCase().includes(query)
      )
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key]
        let bVal = b[sortConfig.key]

        if (typeof aVal === "string") aVal = aVal.toLowerCase()
        if (typeof bVal === "string") bVal = bVal.toLowerCase()

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1
        return 0
      })
    }

    return result
  }, [restaurants, filterMode, searchQuery, sortConfig])

  // Count of configured commissions
  const configuredCount = useMemo(() => {
    return restaurants.filter(res => isCustomRestaurantCommission(res.commissionPercentage)).length
  }, [restaurants])

  // Dropdown list of restaurants still on the platform default commission
  const unconfiguredRestaurantsList = useMemo(() => {
    return restaurants.filter(res => !isCustomRestaurantCommission(res.commissionPercentage))
  }, [restaurants])

  // ----- Multi-select helpers -----
  const allVisibleIds = useMemo(() => filteredRestaurants.map(r => r.id), [filteredRestaurants])
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id))
  const isIndeterminate = !isAllSelected && allVisibleIds.some(id => selectedIds.has(id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allVisibleIds))
    }
  }

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSort = (key) => {
    let direction = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  // Handle Toggle Status
  const handleToggleStatus = async (restaurant) => {
    try {
      setUpdatingStatusId(restaurant.id)
      const newStatus = !restaurant.isActive
      
      await adminAPI.updateRestaurantStatus(restaurant._id || restaurant.id, newStatus)
      
      setRestaurants(prev =>
        prev.map(r => r.id === restaurant.id ? { ...r, isActive: newStatus } : r)
      )
      toast.success(`Restaurant status updated successfully`)
    } catch (err) {
      debugError("Failed to update status:", err)
      toast.error("Failed to update status")
    } finally {
      setUpdatingStatusId(null)
    }
  }

  // Handle Add Commission Submission
  const handleAddCommission = async (e) => {
    e.preventDefault()
    const { restaurantId, commissionPercentage } = newCommissionForm
    
    if (!restaurantId) {
      toast.error("Please select a restaurant")
      return
    }

    const pct = parseFloat(commissionPercentage)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Commission must be a percentage between 0 and 100")
      return
    }

    try {
      setIsSaving(true)
      const targetRestaurant = restaurants.find(r => r.id === restaurantId || r._id === restaurantId)
      if (!targetRestaurant) return

      await adminAPI.updateRestaurant(targetRestaurant._id || targetRestaurant.id, {
        commissionPercentage: pct
      })

      setRestaurants(prev =>
        prev.map(r => (r.id === targetRestaurant.id) ? { ...r, commissionPercentage: pct } : r)
      )

      toast.success(`Commission set to ${pct}% for ${targetRestaurant.name}`)
      setIsAddModalOpen(false)
      setNewCommissionForm({ restaurantId: "", commissionPercentage: "" })
    } catch (err) {
      debugError("Failed to add commission:", err)
      toast.error(err?.response?.data?.message || "Failed to set commission percentage")
    } finally {
      setIsSaving(false)
    }
  }

  // Open Edit Modal
  const openEditModal = (restaurant) => {
    setSelectedRestaurant(restaurant)
    setCommissionInput(String(restaurant.commissionPercentage))
    setIsEditModalOpen(true)
  }

  // Handle Edit Commission Submission
  const handleEditCommission = async (e) => {
    e.preventDefault()
    if (!selectedRestaurant) return

    const pct = parseFloat(commissionInput)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Commission must be a percentage between 0 and 100")
      return
    }

    try {
      setIsSaving(true)
      await adminAPI.updateRestaurant(selectedRestaurant._id || selectedRestaurant.id, {
        commissionPercentage: pct
      })

      setRestaurants(prev =>
        prev.map(r => r.id === selectedRestaurant.id ? { ...r, commissionPercentage: pct } : r)
      )

      toast.success(`Commission updated to ${pct}% for ${selectedRestaurant.name}`)
      setIsEditModalOpen(false)
      setSelectedRestaurant(null)
      setCommissionInput("")
    } catch (err) {
      debugError("Failed to edit commission:", err)
      toast.error(err?.response?.data?.message || "Failed to update commission percentage")
    } finally {
      setIsSaving(false)
    }
  }

  // Open Delete Confirm
  const openDeleteConfirm = (restaurant) => {
    setSelectedRestaurant(restaurant)
    setIsDeleteConfirmOpen(true)
  }

  // Handle Reset to default commission (Delete action)
  const handleDeleteCommission = async () => {
    if (!selectedRestaurant) return

    try {
      setIsSaving(true)
      await adminAPI.updateRestaurant(selectedRestaurant._id || selectedRestaurant.id, {
        commissionPercentage: DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE
      })

      setRestaurants(prev =>
        prev.map(r => r.id === selectedRestaurant.id ? { ...r, commissionPercentage: DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE } : r)
      )

      toast.success(`Commission reset to ${DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE}% for ${selectedRestaurant.name}`)
      setIsDeleteConfirmOpen(false)
      setSelectedRestaurant(null)
    } catch (err) {
      debugError("Failed to reset commission:", err)
      toast.error(err?.response?.data?.message || "Failed to reset commission percentage")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Bulk Commission Set
  const handleBulkCommission = async (e) => {
    e.preventDefault()
    const pct = parseFloat(bulkCommissionInput)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Commission must be a percentage between 0 and 100")
      return
    }

    const targets = restaurants.filter(r => selectedIds.has(r.id))
    if (targets.length === 0) {
      toast.error("No restaurants selected")
      return
    }

    try {
      setIsBulkSaving(true)
      const results = await Promise.allSettled(
        targets.map(r =>
          adminAPI.updateRestaurant(r._id || r.id, { commissionPercentage: pct })
        )
      )

      const successCount = results.filter(r => r.status === "fulfilled").length
      const failCount = results.length - successCount

      // Update local state for successful ones
      const successIds = new Set(
        targets
          .filter((_, i) => results[i].status === "fulfilled")
          .map(r => r.id)
      )
      setRestaurants(prev =>
        prev.map(r => successIds.has(r.id) ? { ...r, commissionPercentage: pct } : r)
      )

      if (successCount > 0) toast.success(`Commission set to ${pct}% for ${successCount} restaurant(s)`)
      if (failCount > 0) toast.error(`Failed to update ${failCount} restaurant(s)`)

      setIsBulkModalOpen(false)
      setBulkCommissionInput("")
      setSelectedIds(new Set())
    } catch (err) {
      debugError("Bulk commission error:", err)
      toast.error("Bulk update failed")
    } finally {
      setIsBulkSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Percent className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Restaurant Commission</h1>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                  {configuredCount}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Bulk Set Commission button — only visible in "all" tab with selection */}
              {filterMode === "all" && selectedIds.size > 0 && (
                <button
                  onClick={() => { setBulkCommissionInput(""); setIsBulkModalOpen(true) }}
                  className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-95 text-sm"
                >
                  <Percent className="w-4 h-4" />
                  Set Commission ({selectedIds.size})
                </button>
              )}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-95 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Commission
              </button>
            </div>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                onClick={() => setFilterMode("configured")}
                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-150 ${
                  filterMode === "configured"
                    ? "bg-white text-blue-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Custom Commissions ({configuredCount})
              </button>
              <button
                onClick={() => setFilterMode("all")}
                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-150 ${
                  filterMode === "all"
                    ? "bg-white text-blue-600 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Restaurants ({restaurants.length})
              </button>
            </div>

            <div className="relative flex-1 md:max-w-md">
              <input
                type="text"
                placeholder="Search by restaurant name or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Selection info bar — shown only in "all" tab */}
          {filterMode === "all" && selectedIds.size > 0 && (
            <div className="mb-4 flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
              <span className="text-sm font-medium text-red-700">
                {selectedIds.size} restaurant{selectedIds.size > 1 ? "s" : ""} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Table / List View */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-sm text-slate-500">Loading restaurants and commission policies...</p>
              </div>
            ) : filteredRestaurants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <UtensilsCrossed className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-lg font-bold text-slate-700 mb-1">No Restaurants Found</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  {filterMode === "configured"
                    ? "No restaurants have custom commissions configured yet. Click 'Add Commission' to set one up!"
                    : "No approved restaurants match your search query."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {/* Checkbox column — only in "all" tab */}
                    {filterMode === "all" && (
                      <th className="px-4 py-4 w-12">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center w-5 h-5 rounded text-blue-600 hover:text-blue-700 transition-colors"
                          title={isAllSelected ? "Deselect All" : "Select All"}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-5 h-5" />
                          ) : isIndeterminate ? (
                            <div className="w-5 h-5 rounded border-2 border-blue-500 bg-blue-100 flex items-center justify-center">
                              <div className="w-2.5 h-0.5 bg-blue-600 rounded" />
                            </div>
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>
                      </th>
                    )}
                    <th 
                      onClick={() => handleSort("id")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors w-20"
                    >
                      <div className="flex items-center gap-1.5">
                        S.NO <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("name")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        RESTAURANT NAME <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("restaurantId")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        RESTAURANT ID <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort("commissionPercentage")}
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        DEFAULT COMMISSION <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-6 py-4">STATUS</th>
                    <th className="px-6 py-4 text-center w-32">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRestaurants.map((res, index) => {
                    const isChecked = selectedIds.has(res.id)
                    return (
                      <tr
                        key={res.id}
                        className={`hover:bg-slate-50/50 transition-colors text-sm text-slate-800 ${
                          filterMode === "all" && isChecked ? "bg-red-50/40" : ""
                        }`}
                      >
                        {/* Checkbox — only in "all" tab */}
                        {filterMode === "all" && (
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleSelectOne(res.id)}
                              className="flex items-center justify-center w-5 h-5 rounded text-blue-600 hover:text-blue-700 transition-colors"
                            >
                              {isChecked
                                ? <CheckSquare className="w-5 h-5" />
                                : <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
                              }
                            </button>
                          </td>
                        )}
                        {/* Serial Number */}
                        <td className="px-6 py-4 font-medium text-slate-600">
                          {index + 1}
                        </td>
                        {/* Name */}
                        <td className="px-6 py-4">
                          <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
                            {res.name}
                          </span>
                        </td>
                        {/* Custom Restaurant ID — e.g. REST00001 */}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-semibold tracking-wide border border-slate-200">
                            {res.restaurantId}
                          </span>
                        </td>
                        {/* Commission */}
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {res.commissionPercentage}%
                        </td>
                        {/* Status */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(res)}
                            disabled={updatingStatusId === res.id}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                              res.isActive ? 'bg-blue-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                res.isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => openEditModal(res)}
                              title="Edit Commission"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(res)}
                              title={`Reset Commission to ${DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE}%`}
                              disabled={!isCustomRestaurantCommission(res.commissionPercentage)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded disabled:text-slate-300 disabled:hover:bg-transparent transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>
      </div>

      {/* Add Commission Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Add Commission</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">Set a custom commission for a restaurant</p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleAddCommission}>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Select Restaurant
                </label>
                <select
                  value={newCommissionForm.restaurantId}
                  onChange={(e) => setNewCommissionForm(prev => ({ ...prev, restaurantId: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  required
                >
                  <option value="">-- Choose a restaurant --</option>
                  {unconfiguredRestaurantsList.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} ({res.restaurantId})
                    </option>
                  ))}
                </select>
                {unconfiguredRestaurantsList.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">All approved restaurants already use the default {DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE}% commission.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Commission Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder={`e.g. ${DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE + 5}`}
                    value={newCommissionForm.commissionPercentage}
                    onChange={(e) => setNewCommissionForm(prev => ({ ...prev, commissionPercentage: e.target.value }))}
                    className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                    %
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !newCommissionForm.restaurantId}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Add Commission
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Commission Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Edit Commission</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">Modify individual restaurant commission policy</p>
              </div>
            </div>
          </DialogHeader>

          {selectedRestaurant && (
            <form onSubmit={handleEditCommission}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Restaurant
                  </label>
                  <div className="flex items-center justify-between bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-200">
                    <p className="text-sm font-semibold text-slate-800">{selectedRestaurant.name}</p>
                    <span className="font-mono text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                      {selectedRestaurant.restaurantId}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Commission Percentage (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder={`e.g. ${DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE + 5}`}
                      value={commissionInput}
                      onChange={(e) => setCommissionInput(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                      %
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete/Reset Confirmation Modal */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-red-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Reset Commission</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">Remove custom commission rule</p>
              </div>
            </div>
          </DialogHeader>

          {selectedRestaurant && (
            <div className="p-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to reset the custom commission percentage for{" "}
                <span className="font-bold text-slate-900">{selectedRestaurant.name}</span> back to{" "}
                <span className="font-bold text-slate-900">{DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE}%</span>?
              </p>
              <p className="text-xs text-slate-500 mt-2 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                Note: Resetting restores the platform default commission for this restaurant.
              </p>
            </div>
          )}

          <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteCommission}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Reset to {DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE}%
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Set Commission Modal */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="max-w-md bg-white p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-red-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Percent className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Bulk Set Commission</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">Apply commission to {selectedIds.size} selected restaurant{selectedIds.size > 1 ? "s" : ""}</p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleBulkCommission}>
            <div className="p-6 space-y-4">
              {/* Selected restaurants preview */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Selected Restaurants ({selectedIds.size})
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {restaurants
                    .filter(r => selectedIds.has(r.id))
                    .map(r => (
                      <div key={r.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-slate-700 font-medium truncate">{r.name}</span>
                        <span className="font-mono text-xs text-slate-500 ml-2 shrink-0 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {r.restaurantId}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Commission Percentage (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder={`e.g. ${DEFAULT_RESTAURANT_COMMISSION_PERCENTAGE + 5}`}
                    value={bulkCommissionInput}
                    onChange={(e) => setBulkCommissionInput(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    required
                    autoFocus
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                    %
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  This will overwrite the existing commission for all selected restaurants.
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-row items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isBulkSaving || !bulkCommissionInput}
                className="px-5 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isBulkSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Apply to {selectedIds.size} Restaurant{selectedIds.size > 1 ? "s" : ""}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
