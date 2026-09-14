import { useState, useMemo } from "react";
import {
  Briefcase,
  ChevronDown,
  Filter,
  ShoppingBag,
  RefreshCw,
  Truck,
  AlertTriangle,
  Coins,
  X,
  Search,
  Download,
  Eye,
  Printer,
  Settings,
  FileText,
  FileSpreadsheet,
  Code,
} from "lucide-react";
import { emptyCampaignOrderReports, emptyCampaignOrderStats } from "@food/utils/adminFallbackData";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"

export default function CampaignOrderReport() {
  const [filters, setFilters] = useState({
    campaign: "All Campaignes",
    restaurant: "All restaurants",
    customer: "All customers",
    time: "All Time",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [orders] = useState(emptyCampaignOrderReports)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const filteredOrders = useMemo(() => {
    let result = [...orders]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(order =>
        order.orderId.toLowerCase().includes(query) ||
        order.restaurant.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query)
      )
    }

    if (filters.campaign !== "All Campaignes") {
      // Filter by campaign if needed
    }

    if (filters.restaurant !== "All restaurants") {
      result = result.filter(o => o.restaurant === filters.restaurant)
    }

    if (filters.customer !== "All customers") {
      result = result.filter(o => o.customerName === filters.customer)
    }

    return result
  }, [orders, searchQuery, filters])

  const handleExport = (format) => {
    if (filteredOrders.length === 0) {
      alert("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "orderId", label: "Order ID" },
      { key: "restaurant", label: "Restaurant" },
      { key: "customerName", label: "Customer Name" },
      { key: "orderAmount", label: "Order Amount" },
      { key: "paymentMethod", label: "Payment Method" },
      { key: "orderStatus", label: "Order Status" },
    ]
    switch (format) {
      case "csv": exportReportsToCSV(filteredOrders, headers, "campaign_order_report"); break
      case "excel": exportReportsToExcel(filteredOrders, headers, "campaign_order_report"); break
      case "pdf": exportReportsToPDF(filteredOrders, headers, "campaign_order_report", "Campaign Order Report"); break
      case "json": exportReportsToJSON(filteredOrders, "campaign_order_report"); break
    }
  }

  const handleFilterApply = () => {
    // Filters are already applied via useMemo
  }

  const handleResetFilters = () => {
    setFilters({
      campaign: "All Campaignes",
      restaurant: "All restaurants",
      customer: "All customers",
      time: "All Time",
    })
  }

  const activeFiltersCount = (filters.campaign !== "All Campaignes" ? 1 : 0) + (filters.restaurant !== "All restaurants" ? 1 : 0) + (filters.customer !== "All customers" ? 1 : 0) + (filters.time !== "All Time" ? 1 : 0)

  const getStatusBadge = (status) => {
    const statusColors = {
      Delivered: "bg-green-100 text-green-800",
      Pending: "bg-blue-100 text-blue-800",
      Canceled: "bg-red-100 text-red-800",
      "In Progress": "bg-yellow-100 text-yellow-800",
      Failed: "bg-red-100 text-red-800",
    }
    return statusColors[status] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen overflow-x-hidden w-full max-w-full">
      <div className="w-full max-w-full overflow-x-hidden overflow-y-visible">
        {/* Page Header - compact */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 mb-4 w-full overflow-x-hidden">
          <div className="flex items-center gap-2 w-full">
            <Briefcase className="w-5 h-5 text-slate-700" />
            <h1 className="text-lg font-bold text-slate-900">Camapign Order Report</h1>
          </div>
        </div>

        {/* Filter Section - compact */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 mb-4 w-full overflow-x-hidden">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 w-full">
            <div className="flex flex-wrap gap-3 flex-1 w-full min-w-0">
              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Campaign
                </label>
                <select
                  value={filters.campaign}
                  onChange={(e) => setFilters(prev => ({ ...prev, campaign: e.target.value }))}
                  className="w-full px-3 py-2 pr-8 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Campaignes">All Campaignes</option>
                  <option value="Campaign 1">Campaign 1</option>
                  <option value="Campaign 2">Campaign 2</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Restaurant
                </label>
                <select
                  value={filters.restaurant}
                  onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                  className="w-full px-3 py-2 pr-8 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All restaurants">All restaurants</option>
                  <option value="Hungry Puppets">Hungry Puppets</option>
                  <option value="Caf� Monarch">Caf� Monarch</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer
                </label>
                <select
                  value={filters.customer}
                  onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}
                  className="w-full px-3 py-2 pr-8 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All customers">All customers</option>
                  <option value="John Doe">John Doe</option>
                  <option value="V H">V H</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time
                </label>
                <select
                  value={filters.time}
                  onChange={(e) => setFilters(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 pr-8 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All Time">All Time</option>
                  <option value="Today">Today</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                </select>
                <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-end gap-2 pt-1">
              <button 
                onClick={handleResetFilters}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button 
                onClick={handleFilterApply}
                className={`px-4 py-2 text-xs font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2 relative ${
                  activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards - compact */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4 w-full overflow-x-hidden">
          {/* Total orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center mb-2">
                <ShoppingBag className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.totalOrders}</p>
              <p className="text-[11px] text-slate-600">Total orders</p>
            </div>
          </div>

          {/* In progress orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                <RefreshCw className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.inProgressOrders}</p>
              <p className="text-[11px] text-slate-600">In progress orders</p>
            </div>
          </div>

          {/* On the way */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.onTheWay}</p>
              <p className="text-[11px] text-slate-600">On the way</p>
            </div>
          </div>

          {/* Delivered Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-2">
                <ShoppingBag className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.deliveredOrders}</p>
              <p className="text-[11px] text-slate-600">Delivered Orders</p>
            </div>
          </div>

          {/* Failed orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center mb-2">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.failedOrders}</p>
              <p className="text-[11px] text-slate-600">Failed orders</p>
            </div>
          </div>

          {/* Refunded orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mb-2">
                <Coins className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.refundedOrders}</p>
              <p className="text-[11px] text-slate-600">Refunded orders</p>
            </div>
          </div>

          {/* Canceled orders */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 py-3">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center mb-2">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-lg font-bold text-slate-900 mb-0.5">{emptyCampaignOrderStats.canceledOrders}</p>
              <p className="text-[11px] text-slate-600">Canceled orders</p>
            </div>
          </div>
        </div>

        {/* Orders Table - only this card scrolls */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 w-full overflow-x-hidden max-h-[500px] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 w-full">
            <h2 className="text-lg font-bold text-slate-900">
              Total Orders {filteredOrders.length}
            </h2>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[220px]">
                <input
                  type="text"
                  placeholder="Search by Order ID, Restaurant, Customer"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-3 pr-9 py-2 w-full text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-all">
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
                className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Only this area scrolls */}
          <div className="overflow-y-auto overflow-x-auto w-full flex-1">
            <table className="w-full" style={{ minWidth: "1000px" }}>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    SI
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Order Id
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Restaurant
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Customer Name
                  </th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Order Amount
                  </th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Payment Method
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Order Status
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <tr key={order.sl} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-700">{order.sl}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs font-medium text-slate-700">{order.orderId}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-slate-700">{order.restaurant}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`text-xs ${order.customerNameError ? "text-red-600 font-medium" : "text-slate-700"}`}>
                        {order.customerName}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-medium text-slate-900">{order.orderAmount}</span>
                        <span className={`text-[10px] ${order.orderAmountStatus === "Paid" ? "text-green-600" : "text-red-600"}`}>
                          ({order.orderAmountStatus})
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-xs text-slate-700">{order.paymentMethod}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadge(order.orderStatus)}`}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1 text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded transition-colors">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              Campaign order report settings and preferences will be available here.
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

