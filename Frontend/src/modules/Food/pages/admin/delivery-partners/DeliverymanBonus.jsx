import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Search, Wallet, Settings, Folder, Download, ChevronDown, FileText, FileSpreadsheet, Code, Check, Columns, Loader2, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportBonusToCSV, exportBonusToExcel, exportBonusToPDF, exportBonusToJSON } from "@food/components/admin/deliveryman/deliverymanExportUtils"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

const debugError = (...args) => {}

const MAX_BONUS_AMOUNT = 100000
const PAGE_SIZE = 20

const formatBonusAmount = (transaction) => {
  if (transaction.amount !== undefined && transaction.amount !== null) {
    return `₹${parseFloat(transaction.amount).toFixed(2)}`
  }
  return "₹0.00"
}

const formatCreatedAt = (value) => {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `bonus-${crypto.randomUUID()}`
  }
  return `bonus-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function DeliverymanBonus() {
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

  const canCreate = useMemo(() => {
    return canPerformAdminPermissionAction(
      currentUser,
      resolvedPermissions,
      "food::deliveryman_management::deliveryman::bonus",
      "create",
    )
  }, [currentUser, resolvedPermissions])

  const [formData, setFormData] = useState({
    deliveryPartnerId: "",
    amount: "",
    reference: "",
  })
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  })
  const [transactions, setTransactions] = useState([])
  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [lastBonusData, setLastBonusData] = useState(null)
  const submitLockRef = useRef(false)
  const idempotencyKeyRef = useRef(null)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    transactionId: true,
    deliveryBoyId: true,
    deliveryPartner: true,
    bonus: true,
    reference: true,
    previousBalance: true,
    updatedBalance: true,
    createdBy: true,
    createdAt: true,
  })

  useEffect(() => {
    const fetchDeliveryPartners = async () => {
      try {
        const response = await adminAPI.getDeliveryPartners({ status: "approved", limit: 1000 })
        if (response.data?.data?.deliveryPartners) {
          setDeliveryPartners(response.data.data.deliveryPartners)
        }
      } catch (err) {
        debugError("Error fetching delivery partners:", err)
      }
    }
    fetchDeliveryPartners()
  }, [])

  // Debounce search → server query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchTransactions = useCallback(async (pageNum = page, search = searchQuery) => {
    setLoading(true)
    setError("")
    try {
      const response = await adminAPI.getDeliveryPartnerBonusTransactions({
        page: pageNum,
        limit: PAGE_SIZE,
        search: search || undefined,
      })
      const data = response.data?.data
      const list = data?.transactions || []
      setTransactions(
        list.map((t) => ({
          ...t,
          createdAtDisplay: formatCreatedAt(t.createdAt),
        })),
      )
      if (data?.pagination) {
        setPagination({
          page: data.pagination.page || pageNum,
          limit: data.pagination.limit || PAGE_SIZE,
          total: data.pagination.total || 0,
          pages: data.pagination.pages || 1,
          hasNextPage: Boolean(data.pagination.hasNextPage),
          hasPreviousPage: Boolean(data.pagination.hasPreviousPage),
        })
      }
    } catch (err) {
      debugError("Error fetching bonus transactions:", err)
      setError("Failed to load transactions. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    fetchTransactions(page, searchQuery)
  }, [page, searchQuery, fetchTransactions])

  const selectedPartnerInfo = useMemo(() => {
    if (!formData.deliveryPartnerId) return null
    return deliveryPartners.find((p) => p._id === formData.deliveryPartnerId)
  }, [deliveryPartners, formData.deliveryPartnerId])

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.deliveryPartnerId || !formData.deliveryPartnerId.trim()) {
      errors.deliveryPartnerId = "Delivery Partner is required"
    }
    const amountValue = Number(formData.amount)
    if (
      !formData.amount ||
      !Number.isInteger(amountValue) ||
      amountValue < 1 ||
      amountValue > MAX_BONUS_AMOUNT
    ) {
      errors.amount = `Amount must be a whole number between 1 and ${MAX_BONUS_AMOUNT.toLocaleString()}`
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canCreate) {
      setError("Permission denied")
      return
    }
    if (submitting || submitLockRef.current) return
    if (!validateForm()) return
    idempotencyKeyRef.current = createIdempotencyKey()
    setShowConfirmDialog(true)
  }

  const confirmAndSubmit = async () => {
    if (submitting || submitLockRef.current) return
    submitLockRef.current = true
    setShowConfirmDialog(false)
    setSubmitting(true)
    setError("")

    const key = idempotencyKeyRef.current || createIdempotencyKey()
    idempotencyKeyRef.current = key

    try {
      const response = await adminAPI.addDeliveryPartnerBonus(
        formData.deliveryPartnerId,
        Number(formData.amount),
        formData.reference,
        key,
      )

      if (response?.data?.success || response?.data?.data) {
        const result = response.data.data
        setLastBonusData({
          partner: selectedPartnerInfo,
          amount: formData.amount,
          previous: result.previousWalletBalance,
          updated: result.updatedWalletBalance,
        })

        setFormData({ deliveryPartnerId: "", amount: "", reference: "" })
        setShowSuccessDialog(true)
        setPage(1)
        await fetchTransactions(1, searchQuery)
      } else {
        setError("Unexpected response format. Please try again.")
      }
    } catch (err) {
      let errorMessage = "Failed to add bonus. Please try again."
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.response?.status === 401) {
        errorMessage = "Unauthorized. Please log in again."
      } else if (err.response?.status === 403) {
        errorMessage = "Forbidden. You don't have permission to perform this action."
      } else if (err.response?.status === 404) {
        errorMessage = `Endpoint not found. Please check if backend server is running on ${API_BASE_URL.replace("/api", "")}`
      } else if (err.request) {
        errorMessage = `No response from server. Please check if backend server is running on ${API_BASE_URL.replace("/api", "")}`
      } else if (err.message) {
        errorMessage = err.message
      }
      setError(errorMessage)
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
      idempotencyKeyRef.current = null
    }
  }

  const handleReset = () => {
    setFormData({ deliveryPartnerId: "", amount: "", reference: "" })
    setFormErrors({})
    setError("")
  }

  /** Export ALL filtered rows (not just current page). */
  const fetchAllFilteredForExport = async () => {
    const all = []
    let currentPage = 1
    let pages = 1
    do {
      const response = await adminAPI.getDeliveryPartnerBonusTransactions({
        page: currentPage,
        limit: 100,
        search: searchQuery || undefined,
      })
      const data = response.data?.data
      const batch = data?.transactions || []
      all.push(
        ...batch.map((t) => ({
          ...t,
          createdAt: formatCreatedAt(t.createdAt),
        })),
      )
      pages = data?.pagination?.pages || 1
      currentPage += 1
    } while (currentPage <= pages)
    return all
  }

  const handleExport = async (format) => {
    if (exporting) return
    setExporting(true)
    try {
      const rows = await fetchAllFilteredForExport()
      if (!rows.length) {
        alert("No data to export")
        return
      }
      switch (format) {
        case "csv":
          exportBonusToCSV(rows)
          break
        case "excel":
          exportBonusToExcel(rows)
          break
        case "pdf":
          exportBonusToPDF(rows)
          break
        case "json":
          exportBonusToJSON(rows)
          break
        default:
          break
      }
    } catch (err) {
      debugError("Export failed:", err)
      alert("Failed to export. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      transactionId: true,
      deliveryBoyId: true,
      deliveryPartner: true,
      bonus: true,
      reference: true,
      previousBalance: true,
      updatedBalance: true,
      createdBy: true,
      createdAt: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    transactionId: "Transaction ID",
    deliveryBoyId: "Delivery Boy ID",
    deliveryPartner: "Delivery Partner",
    bonus: "Bonus",
    reference: "Reference",
    previousBalance: "Previous Balance",
    updatedBalance: "Updated Balance",
    createdBy: "Created By",
    createdAt: "Created At",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-6 right-6 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-600" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Bonus</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Delivery Partner <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.deliveryPartnerId}
                  onChange={(e) => handleInputChange("deliveryPartnerId", e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    formErrors.deliveryPartnerId ? "border-red-500" : "border-slate-300"
                  }`}
                  disabled={submitting || !canCreate}
                >
                  <option value="">Select Delivery Partner</option>
                  {deliveryPartners.map((partner) => (
                    <option key={partner._id} value={partner._id}>
                      {partner.name} ({partner.deliveryId})
                    </option>
                  ))}
                </select>
                {formErrors.deliveryPartnerId && (
                  <p className="text-xs text-red-500 mt-1">{formErrors.deliveryPartnerId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  max={MAX_BONUS_AMOUNT}
                  value={formData.amount}
                  onChange={(e) => handleInputChange("amount", e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    formErrors.amount ? "border-red-500" : "border-slate-300"
                  }`}
                  disabled={submitting || !canCreate}
                />
                {formErrors.amount && <p className="text-xs text-red-500 mt-1">{formErrors.amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reference <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={formData.reference}
                  onChange={(e) => handleInputChange("reference", e.target.value)}
                  placeholder="e.g., Festival Bonus, Performance Bonus"
                  className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm border-slate-300"
                  disabled={submitting || !canCreate}
                />
              </div>

              {error && (
                <div className="md:col-span-3">
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting || !canCreate}
              >
                Reset
              </button>
              {canCreate && (
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Add Bonus"}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Transactions</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {pagination.total}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search ID, partner, delivery ID, reference, created by..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={exporting}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span className="text-black font-bold">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel>Export Format (filtered)</DropdownMenuLabel>
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
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-sm text-slate-600">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative">
                <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
                  <Folder className="w-12 h-12 text-slate-400" />
                </div>
              </div>
              <p className="text-lg font-semibold text-slate-700">No Data Found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {visibleColumns.si && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                      )}
                      {visibleColumns.transactionId && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Transaction ID</th>
                      )}
                      {visibleColumns.deliveryBoyId && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Delivery Boy ID</th>
                      )}
                      {visibleColumns.deliveryPartner && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Delivery Partner</th>
                      )}
                      {visibleColumns.bonus && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus</th>
                      )}
                      {visibleColumns.reference && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Reference</th>
                      )}
                      {visibleColumns.previousBalance && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Previous Balance</th>
                      )}
                      {visibleColumns.updatedBalance && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Updated Balance</th>
                      )}
                      {visibleColumns.createdBy && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Created By</th>
                      )}
                      {visibleColumns.createdAt && (
                        <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Created At</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {transactions.map((transaction) => (
                      <tr key={transaction.transactionId} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{transaction.sl}</span>
                          </td>
                        )}
                        {visibleColumns.transactionId && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700 font-mono">{transaction.transactionId}</span>
                          </td>
                        )}
                        {visibleColumns.deliveryBoyId && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700 font-medium">{transaction.deliveryId || "N/A"}</span>
                          </td>
                        )}
                        {visibleColumns.deliveryPartner && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{transaction.deliveryPartner}</span>
                          </td>
                        )}
                        {visibleColumns.bonus && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-emerald-600">{formatBonusAmount(transaction)}</span>
                          </td>
                        )}
                        {visibleColumns.reference && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-600">{transaction.reference || "—"}</span>
                          </td>
                        )}
                        {visibleColumns.previousBalance && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-600">
                              {transaction.previousBalance !== undefined
                                ? `₹${parseFloat(transaction.previousBalance).toFixed(2)}`
                                : "—"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.updatedBalance && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm font-semibold text-slate-700">
                              {transaction.updatedBalance !== undefined
                                ? `₹${parseFloat(transaction.updatedBalance).toFixed(2)}`
                                : "—"}
                            </span>
                          </td>
                        )}
                        {visibleColumns.createdBy && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-600">{transaction.createdBy || "Admin"}</span>
                          </td>
                        )}
                        {visibleColumns.createdAt && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{transaction.createdAtDisplay}</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Page {pagination.page} of {pagination.pages} · {pagination.total} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!pagination.hasPreviousPage || loading}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white disabled:opacity-50 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasNextPage || loading}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white disabled:opacity-50 flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={(open) => !submitting && setShowConfirmDialog(open)}>
        <DialogContent className="max-w-lg bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-xl font-bold text-slate-800">Confirm Bonus</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Delivery Partner:</span>
                <span className="text-sm font-semibold text-slate-900">{selectedPartnerInfo?.name || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Delivery ID:</span>
                <span className="text-sm font-semibold text-slate-900">{selectedPartnerInfo?.deliveryId || "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-600">Bonus Amount:</span>
                <span className="text-sm font-bold text-emerald-600">
                  ₹{parseFloat(formData.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              {formData.reference && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-sm font-medium text-slate-600">Reference:</span>
                  <span className="text-sm font-semibold text-slate-700">{formData.reference}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndSubmit}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Processing..." : "Confirm & Add Bonus"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              Success!
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-base text-slate-700 mb-2">
              {lastBonusData?.partner ? (
                <>
                  <strong>
                    ₹{parseFloat(lastBonusData.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </strong>{" "}
                  bonus has been credited to <strong>{lastBonusData.partner.name}</strong>.
                </>
              ) : (
                "Bonus added successfully!"
              )}
            </p>
            {lastBonusData && (
              <p className="text-sm text-slate-500">
                Wallet: ₹{Number(lastBonusData.previous).toFixed(2)} → ₹{Number(lastBonusData.updated).toFixed(2)}
              </p>
            )}
          </div>
          <div className="px-6 pb-6 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowSuccessDialog(false)}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              Done
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0">
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
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                    {visibleColumns[key] && <Check className="w-4 h-4 text-emerald-600 ml-auto" />}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={resetColumns}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600"
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
