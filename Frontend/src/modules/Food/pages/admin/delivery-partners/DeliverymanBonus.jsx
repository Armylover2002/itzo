import { useState, useMemo, useEffect } from "react"
import { Search, Wallet, Settings, Folder, Download, ChevronDown, FileText, FileSpreadsheet, Check, Columns, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportBonusToExcel, exportBonusToPDF } from "@food/components/admin/deliveryman/deliverymanExportUtils"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Helper function to format bonus amount properly
const formatBonusAmount = (transaction) => {
  // Use raw amount if available, otherwise clean the bonus string
  if (transaction.amount !== undefined && transaction.amount !== null) {
    return `\u20B9${parseFloat(transaction.amount).toFixed(2)}`
  }
  
  if (!transaction.bonus) return '\u20B90.00'
  
  // Clean the bonus string - remove superscript characters
  let cleaned = transaction.bonus.toString()
    .replace(/¹/g, '') // Remove superscript 1
    .replace(/[\u2070-\u207F\u2080-\u208F]/g, '') // Remove all superscript characters
    .trim()
  
  // Extract numeric value
  const numericMatch = cleaned.match(/[\d.]+/)
  if (numericMatch) {
    const amount = parseFloat(numericMatch[0])
    return `\u20B9${amount.toFixed(2)}`
  }
  
  return '\u20B90.00'
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
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::deliveryman_management::deliveryman::bonus", "create")
  }, [currentUser, resolvedPermissions])

  const [formData, setFormData] = useState({
    deliveryPartnerId: "",
    amount: "",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [transactions, setTransactions] = useState([])
  const [deliveryPartners, setDeliveryPartners] = useState([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    transactionId: true,
    deliveryBoyId: true,
    deliveryman: true,
    bonus: true,
    createdAt: true,
  })

  // Fetch delivery partners on mount
  useEffect(() => {
    const fetchDeliveryPartners = async () => {
      try {
        const response = await adminAPI.getDeliveryPartners({ status: 'approved', limit: 1000 })
        if (response.data?.data?.deliveryPartners) {
          setDeliveryPartners(response.data.data.deliveryPartners)
        }
      } catch (error) {
        debugError("Error fetching delivery partners:", error)
      }
    }

    fetchDeliveryPartners()
  }, [])

  // Fetch transactions on mount
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true)
      setError("")
      try {
        const response = await adminAPI.getDeliveryPartnerBonusTransactions({ limit: 1000 })
        if (response.data?.data?.transactions) {
          // Format transactions for display
          const formatted = response.data.data.transactions.map((t, index) => ({
            ...t,
            createdAt: new Date(t.createdAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          }))
          setTransactions(formatted)
        }
      } catch (error) {
        debugError("Error fetching bonus transactions:", error)
        setError("Failed to load transactions. Please refresh the page.")
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [])

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) {
      return transactions
    }
    
    const query = searchQuery.toLowerCase().trim()
    return transactions.filter(transaction =>
      transaction.deliveryman?.toLowerCase().includes(query) ||
      transaction.transactionId?.toLowerCase().includes(query) ||
      transaction.deliveryId?.toLowerCase().includes(query)
    )
  }, [transactions, searchQuery])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.deliveryPartnerId || !formData.deliveryPartnerId.trim()) {
      errors.deliveryPartnerId = "Deliveryman is required"
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = "Valid amount is required"
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
    if (!validateForm()) return
    
    setSubmitting(true)
    setError("")
    
    // Log request details
    debugLog("Submitting bonus with data:", {
      deliveryPartnerId: formData.deliveryPartnerId,
      amount: formData.amount
    })
    
    try {
      const response = await adminAPI.addDeliveryPartnerBonus(
        formData.deliveryPartnerId,
        formData.amount,
        '' // No reference
      )
      
      debugLog("Bonus response:", response)
      debugLog("Response data:", response.data)
      debugLog("Response status:", response.status)
      
      if (response?.data?.success || response?.data?.data) {
        // Refresh transactions
        const transactionsResponse = await adminAPI.getDeliveryPartnerBonusTransactions({ limit: 1000 })
        if (transactionsResponse?.data?.data?.transactions) {
          const formatted = transactionsResponse.data.data.transactions.map((t, index) => ({
            ...t,
            createdAt: new Date(t.createdAt).toLocaleString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
          }))
          setTransactions(formatted)
        }
        
        setFormData({ deliveryPartnerId: "", amount: "" })
        setShowSuccessDialog(true)
      } else {
        setError("Unexpected response format. Please check console for details.")
      }
    } catch (error) {
      debugError("=== ERROR ADDING BONUS ===")
      debugError("Error object:", error)
      debugError("Error name:", error.name)
      debugError("Error message:", error.message)
      debugError("Error code:", error.code)
      debugError("Error response:", error.response)
      debugError("Error response status:", error.response?.status)
      debugError("Error response data:", error.response?.data)
      debugError("Error request URL:", error.config?.url)
      debugError("Error request method:", error.config?.method)
      debugError("Error request data:", error.config?.data)
      debugError("==========================")
      
      // Extract error message
      let errorMessage = "Failed to add bonus. Please try again."
      
      if (error.response) {
        // Server responded with error status
        if (error.response.data?.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error
        } else if (error.response.status === 401) {
          errorMessage = "Unauthorized. Please log in again."
        } else if (error.response.status === 403) {
          errorMessage = "Forbidden. You don't have permission to perform this action."
        } else if (error.response.status === 404) {
          errorMessage = "Endpoint not found. Please check if backend server is running."
        } else if (error.response.status === 500) {
          errorMessage = "Server error. Please try again later."
        } else {
          errorMessage = `Error ${error.response.status}: ${error.message}`
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = `No response from server. Please check if backend server is running on ${API_BASE_URL.replace('/api', '')}`
      } else {
        // Error setting up the request
        errorMessage = error.message || "Failed to add bonus. Please try again."
      }
      
      setError(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setFormData({
      deliveryPartnerId: "",
      amount: "",
    })
    setFormErrors({})
    setError("")
  }

  const handleExport = (format) => {
    if (filteredTransactions.length === 0) {
      alert("No data to export")
      return
    }
    switch (format) {
      case "excel": exportBonusToExcel(filteredTransactions); break
      case "pdf": exportBonusToPDF(filteredTransactions); break
      default: break
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      transactionId: true,
      deliveryBoyId: true,
      deliveryman: true,
      bonus: true,
      createdAt: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    transactionId: "Transaction ID",
    deliveryBoyId: "Delivery Boy ID",
    deliveryman: "Deliveryman",
    bonus: "Bonus",
    createdAt: "Created At",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Bonus Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 relative">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="absolute top-6 right-6 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-600" />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <Wallet className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900">Bonus</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  DeliveryMan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.deliveryPartnerId}
                  onChange={(e) => handleInputChange("deliveryPartnerId", e.target.value)}
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary text-sm ${
                    formErrors.deliveryPartnerId ? "border-red-500" : "border-slate-300"
                  }`}
                  disabled={submitting || !canCreate}
                >
                  <option value="">Select Delivery Man</option>
                  {deliveryPartners.map((partner) => (
                    <option key={partner._id} value={partner._id}>
                      {partner.name} ({partner.deliveryId})
                    </option>
                  ))}
                </select>
                {formErrors.deliveryPartnerId && <p className="text-xs text-red-500 mt-1">{formErrors.deliveryPartnerId}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange("amount", e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary text-sm ${
                    formErrors.amount ? "border-red-500" : "border-slate-300"
                  }`}
                  disabled={submitting || !canCreate}
                />
                {formErrors.amount && <p className="text-xs text-red-500 mt-1">{formErrors.amount}</p>}
              </div>

              {error && (
                <div className="md:col-span-2">
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
                  className="px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Transactions List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Transactions</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredTransactions.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by name or transac"
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
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-sm text-slate-600">Loading transactions...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner relative">
                <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
                  <div className="relative">
                    <Folder className="w-12 h-12 text-slate-400" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#6412c6] rounded-full flex items-center justify-center z-10">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-lg font-semibold text-slate-700">No Data Found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>}
                    {visibleColumns.transactionId && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Transaction Id</th>}
                    {visibleColumns.deliveryBoyId && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Delivery Boy ID</th>}
                    {visibleColumns.deliveryman && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">DeliveryMan</th>}
                    {visibleColumns.bonus && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus</th>}
                    {visibleColumns.reference && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Reference</th>}
                    {visibleColumns.createdAt && <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Created At</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.sl} className="hover:bg-slate-50 transition-colors">
                      {visibleColumns.si && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{transaction.sl}</span>
                        </td>
                      )}
                      {visibleColumns.transactionId && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{transaction.transactionId}</span>
                        </td>
                      )}
                      {visibleColumns.deliveryBoyId && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700 font-medium">{transaction.deliveryId || 'N/A'}</span>
                        </td>
                      )}
                      {visibleColumns.deliveryman && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{transaction.deliveryman}</span>
                        </td>
                      )}
                      {visibleColumns.bonus && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-900">{formatBonusAmount(transaction)}</span>
                        </td>
                      )}
                      {visibleColumns.createdAt && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{transaction.createdAt}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-green-600">Success!</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Bonus added successfully!
            </p>
          </div>
          <div className="px-6 pb-6 flex items-center justify-end">
            <button
              onClick={() => setShowSuccessDialog(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md"
            >
              OK
            </button>
          </div>
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
    </div>
  )
}

