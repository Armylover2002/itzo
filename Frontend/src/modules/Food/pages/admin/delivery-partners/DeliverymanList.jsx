import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Eye, EyeOff, User, Star, ArrowUpDown, Settings, FileText, FileSpreadsheet, Loader2, Check, Columns, ExternalLink, Calendar, MapPin, CreditCard, Mail, Phone, Bike, FileCheck, Pencil, Save, X, Trash2 } from "lucide-react"
import { adminAPI } from "@food/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportDeliverymenToExcel, exportDeliverymenToPDF } from "@food/components/admin/deliveryman/deliverymanExportUtils"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
import ApprovalAuditCard from "@food/components/admin/ApprovalAuditCard"
const debugError = () => {}


const formatCurrency = (amount) => {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return "\u20B90.00"
  return `\u20B9${numericAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function DeliverymanList() {
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true

    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }

      const existingPermissions = extractAdminPermissions(currentUser)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }

      const roleId = extractAdminRoleId(currentUser)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }

      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }

    resolvePermissions()

    return () => {
      isMounted = false
    }
  }, [currentUser])

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::deliveryman_management::deliveryman::list", "edit")
  }, [currentUser, resolvedPermissions])

  const [searchQuery, setSearchQuery] = useState("")
  const [deliverymen, setDeliverymen] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [viewDetails, setViewDetails] = useState(null)
  const [editingDeliveryId, setEditingDeliveryId] = useState(null)
  const [editValues, setEditValues] = useState({ pocketBalance: "", cashInHand: "" })
  const [savingDeliveryId, setSavingDeliveryId] = useState(null)
  const [activeUpdatingId, setActiveUpdatingId] = useState(null)

  // Soft delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTargetPartner, setDeleteTargetPartner] = useState(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deletingPartner, setDeletingPartner] = useState(false)
  const [showDeletePassword, setShowDeletePassword] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    name: true,
    contact: true,
    zone: true,
    totalOrders: true,
    pocketBalance: true,
    cashInHand: true,
    remainingCashLimit: true,
    availabilityStatus: true,
    actions: true,
  })

  const fetchAllWalletRows = async (search = "") => {
    const walletLimit = 100
    let currentPage = 1
    let totalPages = 1
    const allRows = []

    do {
      const response = await adminAPI.getDeliveryBoyWallets({
        search: search || undefined,
        page: currentPage,
        limit: walletLimit,
      })

      if (!response?.data?.success) {
        break
      }

      const data = response.data.data || {}
      const rows = data.wallets || []
      allRows.push(...rows)
      totalPages = Number(data.pagination?.pages) || 1
      currentPage += 1
    } while (currentPage <= totalPages)

    return allRows
  }

  // Fetch delivery partners from API
  const fetchDeliverymen = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = {
        page: 1,
        limit: 1000, // Get all for now
      }

      // Add search to params if provided
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }

      const [partnersResponse, walletRowsResult] = await Promise.allSettled([
        adminAPI.getDeliveryPartners(params),
        fetchAllWalletRows(searchQuery.trim()),
      ])

      if (partnersResponse.status === "fulfilled" && partnersResponse.value?.data?.success) {
        const partners = partnersResponse.value.data.data.deliveryPartners || []
        const walletRows = walletRowsResult.status === "fulfilled" ? walletRowsResult.value || [] : []

        const walletMap = new Map(
          walletRows.map((wallet) => [String(wallet.deliveryId), wallet]),
        )

        const mergedPartners = partners.map((partner) => {
          const wallet = walletMap.get(String(partner._id))
          return {
            ...partner,
            walletSummary: wallet || null,
pocketBalance: wallet?.pocketBalance || 0,
cashInHand: wallet?.cashCollected || 0,
remainingCashLimit: wallet?.remainingCashLimit || 0,
totalEarning: wallet?.totalEarning || 0,
bonus: wallet?.bonus || 0,
totalWithdrawn: wallet?.totalWithdrawn || 0,
availableCashLimit: wallet?.availableCashLimit || 0,
          }
        })

        setDeliverymen(mergedPartners)
      } else {
        setError("Failed to fetch delivery partners")
        setDeliverymen([])
      }
    } catch (err) {
      debugError("Error fetching delivery partners:", err)
      
      // Better error handling
      let errorMessage = "Failed to fetch delivery partners. Please try again."
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = "Network error. Please check if backend server is running."
      } else if (err.response?.status === 401) {
        errorMessage = "Unauthorized. Please login again."
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. You don't have permission to view this."
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      setDeliverymen([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch on mount
  useEffect(() => {
    fetchDeliverymen()
  }, [])

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDeliverymen()
    }, 500) // Wait 500ms after user stops typing

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const filteredDeliverymen = useMemo(() => {
    // Backend already handles search, but we can do client-side filtering if needed
    return deliverymen
  }, [deliverymen])

  const handleView = async (deliveryman) => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryPartnerById(deliveryman._id)
      
      if (response.data && response.data.success) {
        setViewDetails({
          ...response.data.data.delivery,
          walletSummary: deliveryman.walletSummary || null,
pocketBalance: deliveryman.pocketBalance || 0,
cashInHand: deliveryman.cashInHand || 0,
remainingCashLimit: deliveryman.remainingCashLimit || 0,
totalEarning: deliveryman.totalEarning || 0,
bonus: deliveryman.bonus || 0,
totalWithdrawn: deliveryman.totalWithdrawn || 0,
availableCashLimit: deliveryman.availableCashLimit || 0,
        })
        setIsViewOpen(true)
      } else {
        alert("Failed to load details")
      }
    } catch (err) {
      debugError("Error fetching details:", err)
      alert(err.response?.data?.message || "Failed to load details")
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (filteredDeliverymen.length === 0) {
      alert("No data to export")
      return
    }
    exportDeliverymenToPDF(filteredDeliverymen)
  }

  const handleExportExcel = () => {
    if (filteredDeliverymen.length === 0) {
      alert("No data to export")
      return
    }
    exportDeliverymenToExcel(filteredDeliverymen)
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      name: true,
      contact: true,
      zone: true,
      totalOrders: true,
      pocketBalance: true,
      cashInHand: true,
      remainingCashLimit: true,
      availabilityStatus: true,
      actions: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    name: "Name",
    contact: "Contact",
    zone: "Zone",
    totalOrders: "Total Orders",
    pocketBalance: "Pocket Balance",
    cashInHand: "Cash In Hand",
    remainingCashLimit: "Remaining Cash Limit",
    availabilityStatus: "Availability Status",
    actions: "Actions",
  }

  const startEditingWallet = (deliveryman) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    setEditingDeliveryId(String(deliveryman._id))
    setEditValues({
      pocketBalance: String(Number(deliveryman.pocketBalance) || 0),
      cashInHand: String(Number(deliveryman.cashInHand) || 0),
    })
  }

  const cancelEditingWallet = () => {
    setEditingDeliveryId(null)
    setEditValues({ pocketBalance: "", cashInHand: "" })
  }

  const updateWalletFieldValue = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }))
  }

  const saveWalletChanges = async (deliveryman) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    const nextPocketBalance = Number(editValues.pocketBalance)
    const nextCashInHand = Number(editValues.cashInHand)

    if (!Number.isFinite(nextPocketBalance) || nextPocketBalance < 0) {
      toast.error("Pocket balance must be a valid non-negative number")
      return
    }

    if (!Number.isFinite(nextCashInHand) || nextCashInHand < 0) {
      toast.error("Cash in hand must be a valid non-negative number")
      return
    }

    try {
      setSavingDeliveryId(String(deliveryman._id))
      const response = await adminAPI.updateDeliveryBoyWallet({
        walletId: deliveryman.walletSummary?.walletId,
        deliveryId: deliveryman._id,
        pocketBalance: nextPocketBalance,
        cashInHand: nextCashInHand,
      })

      if (!response?.data?.success) {
        toast.error(response?.data?.message || "Failed to update wallet")
        return
      }

      const updatedWallet = response.data.data || {}
      setDeliverymen((prev) =>
        prev.map((item) =>
          String(item._id) === String(deliveryman._id)
            ? {
                ...item,
                pocketBalance: updatedWallet.pocketBalance ?? nextPocketBalance,
                cashInHand: updatedWallet.cashInHand ?? nextCashInHand,
                remainingCashLimit: updatedWallet.remainingCashLimit ?? item.remainingCashLimit,
                availableCashLimit: updatedWallet.availableCashLimit ?? item.availableCashLimit,
                walletSummary: {
                  ...(item.walletSummary || {}),
                  walletId: updatedWallet.walletId || item.walletSummary?.walletId,
                  pocketBalance: updatedWallet.pocketBalance ?? nextPocketBalance,
                  cashCollected: updatedWallet.cashInHand ?? nextCashInHand,
                  remainingCashLimit: updatedWallet.remainingCashLimit ?? item.remainingCashLimit,
                  availableCashLimit: updatedWallet.availableCashLimit ?? item.availableCashLimit,
                },
              }
            : item,
        ),
      )

      setViewDetails((prev) => {
        if (!prev || String(prev._id) !== String(deliveryman._id)) {
          return prev
        }

        return {
          ...prev,
          pocketBalance: updatedWallet.pocketBalance ?? nextPocketBalance,
          cashInHand: updatedWallet.cashInHand ?? nextCashInHand,
          remainingCashLimit: updatedWallet.remainingCashLimit ?? prev.remainingCashLimit,
          availableCashLimit: updatedWallet.availableCashLimit ?? prev.availableCashLimit,
          walletSummary: {
            ...(prev.walletSummary || {}),
            walletId: updatedWallet.walletId || prev.walletSummary?.walletId,
            pocketBalance: updatedWallet.pocketBalance ?? nextPocketBalance,
            cashCollected: updatedWallet.cashInHand ?? nextCashInHand,
            remainingCashLimit: updatedWallet.remainingCashLimit ?? prev.remainingCashLimit,
            availableCashLimit: updatedWallet.availableCashLimit ?? prev.availableCashLimit,
          },
        }
      })

      toast.success("Wallet updated")
      cancelEditingWallet()
    } catch (err) {
      debugError("Error updating delivery wallet:", err)
      toast.error(err.response?.data?.message || "Failed to update wallet")
    } finally {
      setSavingDeliveryId(null)
    }
  }

  const handleDeleteClick = (deliveryman) => {
    setDeleteTargetPartner(deliveryman)
    setDeletePassword("")
    setShowDeletePassword(false)
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletePassword.trim()) {
      toast.error("Please enter the password")
      return
    }
    const partnerId = String(deleteTargetPartner?._id || "")
    if (!partnerId) {
      toast.error("Delivery partner not found")
      return
    }

    try {
      setDeletingPartner(true)
      await adminAPI.softDeleteDeliveryPartner(partnerId, deletePassword)
      toast.success(`Delivery partner "${deleteTargetPartner?.name || ''}" deleted successfully`)
      setDeliverymen(prev => prev.filter(d => String(d._id) !== partnerId))
      setShowDeleteDialog(false)
      setDeleteTargetPartner(null)
      setDeletePassword("")
    } catch (error) {
      debugError('Error soft deleting delivery partner:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete delivery partner')
    } finally {
      setDeletingPartner(false)
    }
  }

  const handleToggleActiveStatus = async (deliveryman) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    const deliverymanId = String(deliveryman?._id || "")
    if (!deliverymanId) {
      toast.error("Delivery partner not found")
      return
    }

    const nextIsActive = deliveryman?.isActive !== false ? false : true
    const confirmed = window.confirm(
      `${nextIsActive ? "Activate" : "Deactivate"} ${deliveryman?.name || "this delivery partner"}?\n\n${nextIsActive ? "Partner will be able to login again." : "Partner will be logged out and login will be blocked until re-activated."}`,
    )

    if (!confirmed) {
      return
    }

    try {
      setActiveUpdatingId(deliverymanId)
      const response = await adminAPI.updateDeliveryPartnerActiveStatus(deliverymanId, nextIsActive)

      if (!response?.data?.success) {
        toast.error(response?.data?.message || "Failed to update delivery partner status")
        return
      }

      setDeliverymen((prev) =>
        prev.map((item) =>
          String(item._id) === deliverymanId
            ? { ...item, isActive: nextIsActive, availabilityStatus: nextIsActive ? item.availabilityStatus : "offline" }
            : item,
        ),
      )
      setViewDetails((prev) =>
        prev && String(prev._id) === deliverymanId ? { ...prev, isActive: nextIsActive } : prev,
      )
      toast.success(response?.data?.message || `Delivery partner ${nextIsActive ? "activated" : "deactivated"} successfully`)
    } catch (err) {
      debugError("Error updating delivery partner active status:", err)
      toast.error(err?.response?.data?.message || "Failed to update delivery partner status")
    } finally {
      setActiveUpdatingId(null)
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-slate-600" />
              <h1 className="text-2xl font-bold text-slate-900">Deliveryman List</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by name or restaur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <button
                onClick={handleExportPDF}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
                title="Export as PDF"
              >
                <FileText className="w-4 h-4" />
                <span className="text-black font-bold">PDF</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all"
                title="Export as Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-black font-bold">Excel</span>
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Deliveryman</span>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredDeliverymen.length}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchDeliverymen}
                className="mt-2 text-sm text-red-600 underline hover:text-red-800"
              >
                Retry
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-sm text-slate-600">Loading delivery partners...</span>
              </div>
            ) : (
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
                    {visibleColumns.name && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Name</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.contact && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Contact</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.zone && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Zone</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.totalOrders && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Total Orders</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.pocketBalance && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Pocket Balance</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.cashInHand && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Cash In Hand</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.remainingCashLimit && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Remaining Cash Limit</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.availabilityStatus && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Availability Status</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredDeliverymen.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                        {error ? "Error loading delivery partners" : "No delivery partners found"}
                      </td>
                    </tr>
                  ) : (
                    filteredDeliverymen.map((dm) => (
                      <tr key={dm._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{dm.sl}</span>
                          </td>
                        )}
                        {visibleColumns.name && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-all border border-slate-100"
                                onClick={() => handleView(dm)}
                              >
                                {(dm.profileImage?.url ?? dm.profilePhoto) ? (
                                  <img
                                    src={dm.profileImage?.url ?? dm.profilePhoto}
                                    alt={dm.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-sm font-medium text-slate-500">
                                    {dm.name?.trim() ? dm.name.slice(0, 2).toUpperCase() : "?"}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span 
                                  className="text-sm font-medium text-slate-900 cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => handleView(dm)}
                                >
                                  {dm.name}
                                </span>
                                {dm.rating > 0 && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                    <span className="text-xs text-slate-600">{dm.rating.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        )}
                        {visibleColumns.contact && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm text-slate-700">{dm.email}</span>
                              <span className="text-xs text-slate-500">{dm.phone}</span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.zone && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{dm.zone}</span>
                          </td>
                        )}
                        {visibleColumns.totalOrders && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{dm.totalOrders || 0}</span>
                          </td>
                        )}
                        {visibleColumns.pocketBalance && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingDeliveryId === String(dm._id) ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editValues.pocketBalance}
                                onChange={(e) => updateWalletFieldValue("pocketBalance", e.target.value)}
                                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                              />
                            ) : (
                              <span className="text-sm text-slate-700">{formatCurrency(dm.pocketBalance)}</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.cashInHand && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingDeliveryId === String(dm._id) ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editValues.cashInHand}
                                onChange={(e) => updateWalletFieldValue("cashInHand", e.target.value)}
                                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                              />
                            ) : (
                              <span className="text-sm text-slate-700">{formatCurrency(dm.cashInHand)}</span>
                            )}
                          </td>
                        )}
                        {visibleColumns.remainingCashLimit && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{formatCurrency(dm.remainingCashLimit)}</span>
                          </td>
                        )}
                        {visibleColumns.availabilityStatus && (
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs">
                                Account Status: <span className={`${dm.isDeleted ? 'text-red-700' : dm.isActive !== false ? 'text-emerald-700' : 'text-rose-700'} underline`}>{dm.isDeleted ? "deleted" : dm.isActive !== false ? "active" : "inactive"}</span>
                              </span>
                            </div>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              {canEdit && (
                                editingDeliveryId === String(dm._id) ? (
                                  <>
                                    <button
                                      onClick={() => saveWalletChanges(dm)}
                                      disabled={savingDeliveryId === String(dm._id)}
                                      className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                      title="Save Wallet"
                                    >
                                      {savingDeliveryId === String(dm._id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={cancelEditingWallet}
                                      disabled={savingDeliveryId === String(dm._id)}
                                      className="p-1.5 rounded bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-50"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => startEditingWallet(dm)}
                                    className="p-1.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                                    title="Edit Wallet"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                )
                              )}
                              <button 
                                onClick={() => handleView(dm)}
                                className="p-1.5 rounded bg-[#f7f3fc] text-primary hover:bg-[#f0e7f9] transition-colors" 
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canEdit && (
                                <button
                                  onClick={() => handleToggleActiveStatus(dm)}
                                  disabled={activeUpdatingId === String(dm._id)}
                                  className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors disabled:opacity-50 ${dm.isActive !== false ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                                  title={dm.isActive !== false ? "Deactivate Delivery Partner" : "Activate Delivery Partner"}
                                >
                                  {activeUpdatingId === String(dm._id) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    dm.isActive !== false ? "Deactivate" : "Activate"
                                  )}
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => handleDeleteClick(dm)}
                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                                  title="Delete Delivery Partner"
                                >
                                  <Trash2 className="w-4 h-4" />
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
            )}
          </div>
        </div>
      </div>

      {/* View Details Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100 max-h-[85vh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-xl font-bold text-slate-900">Delivery Partner Details</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            {viewDetails ? (
              <div className="space-y-6 mt-4">
                {/* Profile Image & Basic Info */}
                <div className="flex items-start gap-6 pb-6 border-b border-slate-200">
                  <div className="flex-shrink-0">
                    {viewDetails.profileImage?.url ? (
                      <img 
                        src={viewDetails.profileImage.url} 
                        alt={viewDetails.name}
                        className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-12 h-12 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Name
                      </label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{viewDetails.name || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Email
                      </label>
                      <p className="text-sm text-slate-900 mt-1">{viewDetails.email || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Phone
                      </label>
                      <p className="text-sm text-slate-900 mt-1">{viewDetails.phone || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Delivery ID</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">{viewDetails.deliveryId || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.status === 'pending' ? 'bg-[#f0e7f9] text-[#460d8b]' :
                        viewDetails.status === 'approved' || viewDetails.status === 'active' ? 'bg-green-100 text-green-700' :
                        viewDetails.status === 'blocked' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {viewDetails.status === 'blocked' ? 'Rejected' : (viewDetails.status?.charAt(0).toUpperCase() + viewDetails.status?.slice(1) || "N/A")}
                      </span>
                    </div>
                    {viewDetails.rejectionReason && (
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase text-red-600">Rejection Reason</label>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-1">
                          <p className="text-sm text-red-700 whitespace-pre-wrap">{viewDetails.rejectionReason}</p>
                        </div>
                      </div>
                    )}
                    {viewDetails.dateOfBirth && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Date of Birth
                        </label>
                        <p className="text-sm text-slate-900 mt-1">
                          {new Date(viewDetails.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                    {viewDetails.gender && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Gender</label>
                        <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.gender || "N/A"}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                {viewDetails.location && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Location Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.location.addressLine1 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 1</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine1}</p>
                        </div>
                      )}
                      {viewDetails.location.addressLine2 && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Address Line 2</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.addressLine2}</p>
                        </div>
                      )}
                      {viewDetails.location.area && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Area</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.area}</p>
                        </div>
                      )}
                      {viewDetails.location.city && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.city}</p>
                        </div>
                      )}
                      {viewDetails.location.state && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.state}</p>
                        </div>
                      )}
                      {viewDetails.location.zipCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Zip Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.location.zipCode}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vehicle Details */}
                {viewDetails.vehicle && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <Bike className="w-4 h-4" /> Vehicle Details
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                      {viewDetails.vehicle.brand && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Brand</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.brand}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.model && (
                        <div className="text-right col-span-1">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Model</label>
                          <p className="text-xs text-slate-900 mt-1">{viewDetails.vehicle.model}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.number && (
                        <div className="col-span-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.vehicle.number}</p>
                        </div>
                      )}
                      {viewDetails.vehicle.type && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle Type</label>
                          <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.vehicle.type}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pocket Details */}
                <div className="pb-6 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Pocket Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Pocket Balance</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(viewDetails.pocketBalance || viewDetails.walletSummary?.pocketBalance)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Cash In Hand</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(viewDetails.cashInHand || viewDetails.walletSummary?.cashCollected)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Remaining Cash Limit</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(viewDetails.remainingCashLimit || viewDetails.walletSummary?.remainingCashLimit)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Total Earning</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(viewDetails.totalEarning || viewDetails.walletSummary?.totalEarning)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Bonus</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(viewDetails.bonus || viewDetails.walletSummary?.bonus)}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Total Withdrawn</label>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {formatCurrency(viewDetails.totalWithdrawn || viewDetails.walletSummary?.totalWithdrawn)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                {viewDetails.documents && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <FileCheck className="w-4 h-4" /> Documents
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Aadhar */}
                      {viewDetails.documents.aadhar && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Aadhar Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.aadhar.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.aadhar.number}</p>
                            )}
                            {viewDetails.documents.aadhar.document && (
                              <a 
                                href={viewDetails.documents.aadhar.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PAN */}
                      {viewDetails.documents.pan && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">PAN Card</label>
                          <div className="mt-2">
                            {viewDetails.documents.pan.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.pan.number}</p>
                            )}
                            {viewDetails.documents.pan.document && (
                              <a 
                                href={viewDetails.documents.pan.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Driving License */}
                      {viewDetails.documents.drivingLicense && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Driving License</label>
                          <div className="mt-2">
                            {viewDetails.documents.drivingLicense.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.drivingLicense.number}</p>
                            )}
                            {viewDetails.documents.drivingLicense.expiryDate && (
                              <p className="text-xs text-slate-500 mb-1">
                                Expiry: {new Date(viewDetails.documents.drivingLicense.expiryDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                            {viewDetails.documents.drivingLicense.document && (
                              <a 
                                href={viewDetails.documents.drivingLicense.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Vehicle RC */}
                      {viewDetails.documents.vehicleRC && (viewDetails.documents.vehicleRC.number || viewDetails.documents.vehicleRC.document) && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Vehicle RC</label>
                          <div className="mt-2">
                            {viewDetails.documents.vehicleRC.number && (
                              <p className="text-sm text-slate-700 mb-1">Number: {viewDetails.documents.vehicleRC.number}</p>
                            )}
                            {viewDetails.documents.vehicleRC.document && (
                              <a 
                                href={viewDetails.documents.vehicleRC.document} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover"
                              >
                                <ExternalLink className="w-3 h-3" /> View Document
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                {viewDetails.documents?.bankDetails && (
                  <div className="pb-6 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Bank Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {viewDetails.documents.bankDetails.accountHolderName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Holder Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountHolderName}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.accountNumber && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Account Number</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.accountNumber}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.ifscCode && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">IFSC Code</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.ifscCode}</p>
                        </div>
                      )}
                      {viewDetails.documents.bankDetails.bankName && (
                        <div>
                          <label className="text-xs font-semibold text-slate-500 uppercase">Bank Name</label>
                          <p className="text-sm text-slate-900 mt-1">{viewDetails.documents.bankDetails.bankName}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4">
                  {viewDetails.signupMethod && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Signup Method</label>
                      <p className="text-sm text-slate-900 mt-1 capitalize">{viewDetails.signupMethod}</p>
                    </div>
                  )}
                  {viewDetails.phoneVerified !== undefined && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Phone Verified</label>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                        viewDetails.phoneVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {viewDetails.phoneVerified ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  )}
                  {viewDetails.createdAt && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Joined Date</label>
                      <p className="text-sm text-slate-900 mt-1">
                        {new Date(viewDetails.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
                <ApprovalAuditCard
                  className="pt-6 border-t border-slate-200"
                  approvedBy={viewDetails.approvedBy}
                  rejectedBy={viewDetails.rejectedBy}
                  rejectionReason={viewDetails.rejectionReason}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 border-t border-slate-200">
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Close
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
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
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
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteDialog(false)
          setDeleteTargetPartner(null)
          setDeletePassword("")
        }
      }}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Delete Delivery Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                Are you sure you want to delete <strong>{deleteTargetPartner?.name || "this delivery partner"}</strong>?
                This partner will no longer be visible to you and will be shown that their account was deleted by admin.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Enter Password to Confirm
              </label>
              <div className="relative">
                <input
                  type={showDeletePassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDelete() }}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 text-sm"
                  autoFocus
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword(!showDeletePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteDialog(false); setDeleteTargetPartner(null); setDeletePassword("") }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                disabled={deletingPartner}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingPartner || !deletePassword.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingPartner ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
