import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Filter, Wallet, RefreshCw, Calendar, Plus, ArrowUpDown, Settings, FileText, FileSpreadsheet, Code, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

// Import icons from Dashboard-icons
import debitIcon from "@food/assets/Dashboard-icons/image2.png"
import creditIcon from "@food/assets/Dashboard-icons/image1.png"
import balanceIcon from "@food/assets/Dashboard-icons/image6.png"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function CustomerWalletReport() {
  const [searchQuery, setSearchQuery] = useState("")
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [walletStats, setWalletStats] = useState({
    debit: "? 0.00",
    credit: "? 0.00",
    balance: "? 0.00"
  })
  const [customers, setCustomers] = useState([])
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    all: "All",
    customer: "Select Customer",
  })
  const [isFilterOpen, setIsFilterOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Fetch customer wallet report data
  useEffect(() => {
    const fetchCustomerWalletReport = async () => {
      try {
        setLoading(true)
        
        const params = {
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
          all: filters.all !== "All" ? filters.all : undefined,
          customer: filters.customer !== "Select Customer" ? filters.customer : undefined,
          search: searchQuery || undefined
        }

        const response = await adminAPI.getCustomerWalletReport(params)

        if (response?.data?.success && response.data.data) {
          setTransactions(response.data.data.transactions || [])
          setWalletStats(response.data.data.stats || {
            debit: "? 0.00",
            credit: "? 0.00",
            balance: "? 0.00"
          })
          setCustomers(response.data.data.customers || [])
        } else {
          setTransactions([])
          if (response?.data?.message) {
            toast.error(response.data.message)
          }
        }
      } catch (error) {
        debugError("Error fetching customer wallet report:", error)
        toast.error("Failed to fetch customer wallet report")
        setTransactions([])
      } finally {
        setLoading(false)
      }
    }

    fetchCustomerWalletReport()
  }, [filters, searchQuery])

  const filteredTransactions = useMemo(() => {
    return transactions // Backend already filters, so just return transactions
  }, [transactions])

  const totalTransactions = filteredTransactions.length

  const handleReset = () => {
    setFilters({
      fromDate: "",
      toDate: "",
      all: "All",
      customer: "Select Customer",
    })
    setSearchQuery("")
  }

  const handleExport = (format) => {
    if (filteredTransactions.length === 0) {
      alert("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "transactionId", label: "Transaction ID" },
      { key: "customer", label: "Customer" },
      { key: "credit", label: "Credit" },
      { key: "debit", label: "Debit" },
      { key: "balance", label: "Balance" },
      { key: "transactionType", label: "Transaction Type" },
      { key: "reference", label: "Reference" },
      { key: "createdAt", label: "Created At" },
    ]
    switch (format) {
      case "csv": exportReportsToCSV(filteredTransactions, headers, "customer_wallet_report"); break
      case "excel": exportReportsToExcel(filteredTransactions, headers, "customer_wallet_report"); break
      case "pdf": exportReportsToPDF(filteredTransactions, headers, "customer_wallet_report", "Customer Wallet Report"); break
      case "json": exportReportsToJSON(filteredTransactions, "customer_wallet_report"); break
    }
  }

  const handleFilterApply = () => {
    // Filters are already applied via useMemo
  }

  const activeFiltersCount = (filters.fromDate ? 1 : 0) + (filters.toDate ? 1 : 0) + (filters.all !== "All" ? 1 : 0) + (filters.customer !== "Select Customer" ? 1 : 0)

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading customer wallet report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Customer Wallet Report</h1>
          </div>
        </div>

        {/* Filter Options Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center justify-between w-full mb-4"
          >
            <h3 className="text-sm font-semibold text-slate-700">Filter Options</h3>
            <ChevronDown
              className={`w-5 h-5 text-slate-600 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
            />
          </button>
          
          {isFilterOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="dd-mm-yyyy"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="dd-mm-yyyy"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    All
                  </label>
                  <select
                    value={filters.all}
                    onChange={(e) => setFilters(prev => ({ ...prev, all: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All</option>
                    <option value="Credit">Credit</option>
                    <option value="Debit">Debit</option>
                  </select>
                  <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Customer
                  </label>
                  <select
                    value={filters.customer}
                    onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Select Customer">Select Customer</option>
                    {customers.map(customer => (
                      <option key={customer} value={customer}>{customer}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-2.5 text-sm font-medium rounded-lg border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
                <button 
                  onClick={handleFilterApply}
                  className={`px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2 relative ${
                    activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Debit Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Debit</p>
                <p className="text-2xl font-bold text-slate-900">{walletStats.debit}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <img src={debitIcon} alt="Debit" className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Credit Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Credit</p>
                <p className="text-2xl font-bold text-slate-900">{walletStats.credit}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center">
                <img src={creditIcon} alt="Credit" className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Balance Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Balance</p>
                <p className="text-2xl font-bold text-slate-900">{walletStats.balance}</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <img src={balanceIcon} alt="Balance" className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Transactions</h2>
            </div>

            <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
              <Download className="w-4 h-4" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>SI</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Transaction Id</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Customer</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Credit</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Debit</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Balance</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Transaction Type</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Reference</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-1">
                      <span>Created At</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No transactions match your search</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{transaction.sl}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-700 font-mono break-all">{transaction.transactionId}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <a
                          href={`#customer-${transaction.customer}`}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {transaction.customer}
                        </a>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-900">{transaction.credit}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-900">{transaction.debit}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-slate-900">{transaction.balance}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          {transaction.transactionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-700">{transaction.reference}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-700">{transaction.createdAt}</span>
                      </td>
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
              Report Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Customer wallet report settings and preferences will be available here.
            </p>
          </div>
          <div className="px-6 pb-6 flex items-center justify-end">
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

