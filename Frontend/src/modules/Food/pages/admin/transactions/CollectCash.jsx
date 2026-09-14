import { useState, useMemo } from "react"
import { Search, Download, ChevronDown, Eye, Settings, Wallet, ArrowUpDown, FileText, FileSpreadsheet, Code, Check, Columns } from "lucide-react"
import { emptyCollectCashTransactions } from "@food/utils/adminFallbackData"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter as DialogFooterComponent } from "@food/components/ui/dialog"
import { exportTransactionsToCSV, exportTransactionsToExcel, exportTransactionsToPDF, exportTransactionsToJSON } from "@food/components/admin/transactions/transactionsExportUtils"

export default function CollectCash() {
  const [formData, setFormData] = useState({
    type: "Deliveryman",
    method: "",
    restaurant: "",
    deliveryman: "",
    amount: "",
    reference: "",
  })
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [transactions, setTransactions] = useState(emptyCollectCashTransactions)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    collectedFrom: true,
    userType: true,
    collectedAt: true,
    collectedAmount: true,
    paymentMethod: true,
    reference: true,
    actions: true,
  })

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) {
      return transactions
    }
    
    const query = searchQuery.toLowerCase().trim()
    return transactions.filter(transaction =>
      transaction.collectedFrom?.toLowerCase().includes(query) ||
      transaction.reference?.toLowerCase().includes(query) ||
      transaction.paymentMethod?.toLowerCase().includes(query)
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
    if (!formData.method) errors.method = "Payment method is required."
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = "Amount is required and must be greater than 0."
    if (formData.type === "Restaurant" && !formData.restaurant) errors.restaurant = "Restaurant is required."
    if (formData.type === "Deliveryman" && !formData.deliveryman) errors.deliveryman = "Deliveryman is required."
    return errors
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setIsSubmitting(true)
    // Simulate API call
    setTimeout(() => {
      const newTransaction = {
        sl: transactions.length + 1,
        collectedFrom: formData.type === "Restaurant" ? "Hungry Puppets" : formData.deliveryman === "jhon-doe" ? "Jhon Doe" : "Leslie Alexander",
        userType: formData.type,
        collectedAt: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }),
        collectedAmount: parseFloat(formData.amount),
        paymentMethod: formData.method,
        reference: formData.reference || "N/A",
      }
      setTransactions([newTransaction, ...transactions])
      setIsSubmitting(false)
      setShowSuccessDialog(true)
      handleReset()
    }, 500)
  }

  const handleReset = () => {
    setFormData({
      type: "Deliveryman",
      method: "",
      restaurant: "",
      deliveryman: "",
      amount: "",
      reference: "",
    })
    setFormErrors({})
  }

  const handleViewTransaction = (transaction) => {
    setSelectedTransaction(transaction)
    setIsViewOpen(true)
  }

  const handleExport = (format) => {
    if (filteredTransactions.length === 0) {
      alert("No data to export.")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "collectedFrom", label: "Collected From" },
      { key: "userType", label: "User Type" },
      { key: "collectedAt", label: "Collected At" },
      { key: "collectedAmount", label: "Collected Amount" },
      { key: "paymentMethod", label: "Payment Method" },
      { key: "reference", label: "Reference" },
    ]
    switch (format) {
      case "csv": exportTransactionsToCSV(filteredTransactions, headers, "collect_cash"); break
      case "excel": exportTransactionsToExcel(filteredTransactions, headers, "collect_cash"); break
      case "pdf": exportTransactionsToPDF(filteredTransactions, headers, "collect_cash", "Collect Cash Report"); break
      case "json": exportTransactionsToJSON(filteredTransactions, "collect_cash"); break
      default: break
    }
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      collectedFrom: true,
      userType: true,
      collectedAt: true,        
      collectedAmount: true,
      paymentMethod: true,
      reference: true,
      actions: true,
    })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Cash Collection Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Cash Collection</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange("type", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="Deliveryman">Deliveryman</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Method <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.method}
                  onChange={(e) => handleInputChange("method", e.target.value)}
                  placeholder="Ex: Cash"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    formErrors.method ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {formErrors.method && <p className="text-red-500 text-xs mt-1">{formErrors.method}</p>}
              </div>

              {formData.type === "Restaurant" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Restaurant <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.restaurant}
                    onChange={(e) => handleInputChange("restaurant", e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      formErrors.restaurant ? "border-red-500" : "border-slate-300"
                    }`}
                  >
                    <option value="">Select Restaurant</option>
                    <option value="hungry-puppets">Hungry Puppets</option>
                  </select>
                  {formErrors.restaurant && <p className="text-red-500 text-xs mt-1">{formErrors.restaurant}</p>}
                </div>
              )}

              {formData.type === "Deliveryman" && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Deliveryman <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.deliveryman}
                    onChange={(e) => handleInputChange("deliveryman", e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      formErrors.deliveryman ? "border-red-500" : "border-slate-300"
                    }`}
                  >
                    <option value="">Select Deliveryman</option>
                    <option value="jhon-doe">Jhon Doe</option>
                    <option value="leslie-alexander">Leslie Alexander</option>
                  </select>
                  {formErrors.deliveryman && <p className="text-red-500 text-xs mt-1">{formErrors.deliveryman}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange("amount", e.target.value)}
                  placeholder="Ex: 100"
                  className={`w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    formErrors.amount ? "border-red-500" : "border-slate-300"
                  }`}
                />
                {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Reference
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => handleInputChange("reference", e.target.value)}
                  placeholder="Ex: Collect Cash"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Collecting..." : "Collect Cash"}
              </button>
            </div>
          </form>
        </div>

        {/* Transaction Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Transaction Table</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredTransactions.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by Reference"
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
          <div className="overflow-x-auto">
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
                  {visibleColumns.collectedFrom && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Collected From</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.userType && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>User Type</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.collectedAt && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Collected At</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.collectedAmount && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Collected Amount</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.paymentMethod && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Payment Method</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.reference && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Reference</span>
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
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.sl} className="hover:bg-slate-50 transition-colors">
                      {visibleColumns.si && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{transaction.sl}</span>
                        </td>
                      )}
                      {visibleColumns.collectedFrom && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">
                            {transaction.collectedFrom}
                          </span>
                        </td>
                      )}
                      {visibleColumns.userType && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{transaction.userType}</span>
                        </td>
                      )}
                      {visibleColumns.collectedAt && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{transaction.collectedAt}</span>
                        </td>
                      )}
                      {visibleColumns.collectedAmount && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">
                            $ {transaction.collectedAmount.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                      )}
                      {visibleColumns.paymentMethod && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{transaction.paymentMethod}</span>
                        </td>
                      )}
                      {visibleColumns.reference && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{transaction.reference}</span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleViewTransaction(transaction)}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            <Eye className="w-4 h-4 text-red-600" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(visibleColumns).map(([key, isVisible]) => (
                  <div key={key} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`toggle-${key}`}
                      checked={isVisible}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`toggle-${key}`} className="ml-2 text-sm text-slate-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                  </div>
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
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-sm bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Success
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">Cash collected successfully!</p>
          </div>
          <DialogFooterComponent className="px-6 pb-6">
            <button
              onClick={() => setShowSuccessDialog(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              OK
            </button>
          </DialogFooterComponent>
        </DialogContent>
      </Dialog>

      {/* View Transaction Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="px-6 pb-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Collected From</label>
                <p className="text-sm font-medium text-slate-900 mt-1">{selectedTransaction.collectedFrom}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">User Type</label>
                <p className="text-sm font-medium text-slate-900 mt-1">{selectedTransaction.userType}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Collected At</label>
                <p className="text-sm font-medium text-slate-900 mt-1">{selectedTransaction.collectedAt}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Collected Amount</label>
                <p className="text-sm font-medium text-slate-900 mt-1">
                  $ {selectedTransaction.collectedAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Payment Method</label>
                <p className="text-sm font-medium text-slate-900 mt-1">{selectedTransaction.paymentMethod}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Reference</label>
                <p className="text-sm font-medium text-slate-900 mt-1">{selectedTransaction.reference}</p>
              </div>
            </div>
          )}
          <DialogFooterComponent className="px-6 pb-6">
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
            >
              Close
            </button>
          </DialogFooterComponent>
        </DialogContent>
      </Dialog>
    </div>
  )
}

