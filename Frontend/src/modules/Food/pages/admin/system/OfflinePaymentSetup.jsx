import { useState, useMemo } from "react"
import { Briefcase, Search, Plus, Pencil, Trash2, Settings, Download, ChevronDown, FileText, FileSpreadsheet, Code, Check, Columns, ArrowUpDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportPaymentMethodsToCSV, exportPaymentMethodsToExcel, exportPaymentMethodsToPDF, exportPaymentMethodsToJSON } from "@food/components/admin/payment-methods/paymentMethodsExportUtils"

const paymentMethods = [
  {
    id: 1,
    name: "bkash",
    paymentInfo: "Account Number : 017**********",
    requiredInfo: "Name | Transaction Number",
    status: true
  }
]

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        enabled ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

export default function OfflinePaymentSetup() {
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [methods, setMethods] = useState(paymentMethods)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
    sl: true,
    name: true,
    paymentInfo: true,
    requiredInfo: true,
    status: true,
    actions: true,
  })

  const filteredMethods = useMemo(() => {
    let filtered = methods.filter(method => {
      if (activeTab === "active") return method.status
      if (activeTab === "inactive") return !method.status
      return true
    })
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(method =>
        method.name.toLowerCase().includes(query) ||
        method.paymentInfo.toLowerCase().includes(query) ||
        method.requiredInfo.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [methods, activeTab, searchQuery])

  const handleStatusToggle = (id) => {
    setMethods(prev => prev.map(method => 
      method.id === id ? { ...method, status: !method.status } : method
    ))
  }

  const handleDelete = (id) => {
    const method = methods.find(m => m.id === id)
    setSelectedMethod(method)
    setIsDeleteOpen(true)
  }

  const confirmDelete = () => {
    if (selectedMethod) {
      setMethods(prev => prev.filter(method => method.id !== selectedMethod.id))
      setIsDeleteOpen(false)
      setSelectedMethod(null)
    }
  }

  const handleExport = (format) => {
    if (filteredMethods.length === 0) {
      alert("No data to export")
      return
    }
    switch (format) {
      case "csv": exportPaymentMethodsToCSV(filteredMethods); break
      case "excel": exportPaymentMethodsToExcel(filteredMethods); break
      case "pdf": exportPaymentMethodsToPDF(filteredMethods); break
      case "json": exportPaymentMethodsToJSON(filteredMethods); break
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      sl: true,
      name: true,
      paymentInfo: true,
      requiredInfo: true,
      status: true,
      actions: true,
    })
  }

  const columnsConfig = {
    sl: "Serial Number",
    name: "Payment Method Name",
    paymentInfo: "Payment Info",
    requiredInfo: "Required Info From Customer",
    status: "Status",
    actions: "Actions",
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        {/* Page Title */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <Briefcase className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Offline Payment Method Setup</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
          <div className="flex gap-2">
            {["All", "Active", "Inactive"].map((tab) => (
              <button
                key={tab.toLowerCase()}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.toLowerCase()
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Actions Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="Search by name, payment info..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-1.5 w-full text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition-all">
                  <Download className="w-3.5 h-3.5" />
                  <span className="font-bold">Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
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
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Method</span>
            </button>
          </div>
        </div>

        {/* Payment Methods Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Payment Methods</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {filteredMethods.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.sl && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>SL</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.name && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Payment Method Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.paymentInfo && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Payment Info</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.requiredInfo && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Required Info From Customer</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.status && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.actions && (
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredMethods.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center">
                      <p className="text-xs text-slate-500">No payment methods found</p>
                    </td>
                  </tr>
                ) : (
                  filteredMethods.map((method, index) => (
                    <tr key={method.id} className="hover:bg-slate-50 transition-colors">
                      {visibleColumns.sl && (
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-700">{index + 1}</span>
                        </td>
                      )}
                      {visibleColumns.name && (
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-700">{method.name}</span>
                        </td>
                      )}
                      {visibleColumns.paymentInfo && (
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-700">{method.paymentInfo}</span>
                        </td>
                      )}
                      {visibleColumns.requiredInfo && (
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-slate-700">{method.requiredInfo}</span>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="px-3 py-2.5">
                          <ToggleSwitch
                            enabled={method.status}
                            onToggle={() => handleStatusToggle(method.id)}
                          />
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-3 py-2.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(method.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Delete Payment Method</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-xs text-slate-700">
              Are you sure you want to delete "{selectedMethod?.name}"? This action cannot be undone.
            </p>
          </div>
          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
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
                    <span className="text-xs text-slate-700">{label}</span>
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
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
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
