import { useState, useEffect } from "react"
import { BarChart3, ChevronDown, Settings, FileText, FileSpreadsheet, Code, Loader2 } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
import { PAGE_SIZE as PAGINATION_PAGE_SIZE } from "@/shared/constants/pagination"
import searchIcon from "@food/assets/Dashboard-icons/image8.png"
import exportIcon from "@food/assets/Dashboard-icons/image9.png"
import scheduledIcon from "@food/assets/Dashboard-icons/image24.png"
import pendingIcon from "@food/assets/Dashboard-icons/image25.png"
import acceptedIcon from "@food/assets/Dashboard-icons/image26.png"
import processingIcon from "@food/assets/Dashboard-icons/image27.png"
// Reuse existing icons since image28+ do not exist in assets
import onTheWayIcon from "@food/assets/Dashboard-icons/image24.png"
import deliveredIcon from "@food/assets/Dashboard-icons/image25.png"
import canceledIcon from "@food/assets/Dashboard-icons/image26.png"
import paymentFailedIcon from "@food/assets/Dashboard-icons/image27.png"
import refundedIcon from "@food/assets/Dashboard-icons/image25.png"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const statusMeta = {
  Scheduled: { label: "Scheduled Orders", color: "text-amber-600", bg: "bg-amber-50", icon: scheduledIcon },
  Pending: { label: "Pending Orders", color: "text-blue-600", bg: "bg-blue-50", icon: pendingIcon },
  Accepted: { label: "Accepted Orders", color: "text-sky-600", bg: "bg-sky-50", icon: acceptedIcon },
  Processing: { label: "Processing Orders", color: "text-indigo-600", bg: "bg-indigo-50", icon: processingIcon },
  "Food On The Way": { label: "Food On The Way", color: "text-cyan-600", bg: "bg-cyan-50", icon: onTheWayIcon },
  Delivered: { label: "Delivered", color: "text-emerald-600", bg: "bg-emerald-50", icon: deliveredIcon },
  Cancelled: { label: "Cancelled", color: "text-red-600", bg: "bg-red-50", icon: canceledIcon },
  "Payment Failed": { label: "Payment Failed", color: "text-red-600", bg: "bg-red-50", icon: paymentFailedIcon },
  Refunded: { label: "Refunded", color: "text-teal-600", bg: "bg-teal-50", icon: refundedIcon },
}

const PAGE_SIZE = PAGINATION_PAGE_SIZE.THIRTY

const EMPTY_STATUS_COUNTS = {
  total: 0,
  Scheduled: 0,
  Pending: 0,
  Accepted: 0,
  Processing: 0,
  "Food On The Way": 0,
  Delivered: 0,
  Cancelled: 0,
  "Payment Failed": 0,
  Refunded: 0,
}

const transformOrderForReport = (order) => {
  const pricing = order.pricing || {}
  const items = Array.isArray(order.items) ? order.items : []

  const itemsSubtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity || 1)
    const price = Number(item.price || 0)
    return sum + qty * price
  }, 0)

  const subtotal = itemsSubtotal > 0 ? itemsSubtotal : Number(pricing.subtotal || 0)
  const packagingFee = Number(pricing.packagingFee || 0)
  const deliveryCharge = Number(pricing.deliveryFee || 0)
  const quickDeliveryFee = Number(pricing.quickDeliveryFee || 0)
  const platformFee = Number(pricing.platformFee || 0)
  const vatTax = Number(pricing.tax || 0)
  const totalDiscount = Math.max(0, Number(pricing.discount || 0))
  // Correctly resolve coupon discount vs item discount
  const rawCouponDiscount = Number(pricing.couponDiscount || 0)
  const appliedCouponDiscount = Number(pricing.appliedCoupon?.discount || 0)
  const referralDiscount = Number(pricing.referralDiscount || 0)
  const hasCouponCode = Boolean(pricing.couponCode || pricing.appliedCoupon?.code)
  let couponDiscount = rawCouponDiscount || 0
  if (couponDiscount <= 0) {
    if (appliedCouponDiscount > 0) {
      couponDiscount = Math.min(totalDiscount, appliedCouponDiscount)
    } else if (hasCouponCode && totalDiscount > 0) {
      couponDiscount = Math.max(0, totalDiscount - referralDiscount)
    }
  }

  const computedTotal =
    subtotal + packagingFee + deliveryCharge + quickDeliveryFee + platformFee + vatTax - totalDiscount
  const totalAmount = pricing.total != null ? Number(pricing.total) : computedTotal

  const restaurantName = order.restaurantId?.restaurantName || order.restaurantName || ""
  const customerName = order.userId?.name || order.customerName || "N/A"

  const backendStatus = String(order.orderStatus || "").toLowerCase()
  let displayStatus = order.orderStatus
  if (!backendStatus || backendStatus === "created" || backendStatus === "confirmed") {
    displayStatus = "Pending"
  } else if (backendStatus === "preparing" || backendStatus === "ready_for_pickup") {
    displayStatus = "Processing"
  } else if (backendStatus === "picked_up") {
    displayStatus = "Food On The Way"
  } else if (backendStatus === "delivered") {
    displayStatus = "Delivered"
  } else if (
    backendStatus === "cancelled_by_restaurant" ||
    backendStatus === "cancelled_by_user" ||
    backendStatus === "cancelled_by_admin" ||
    backendStatus === "cancelled_by_system"
  ) {
    displayStatus = "Cancelled"
  }

  return {
    orderId: order.orderId,
    restaurant: restaurantName,
    customerName,
    totalItemAmount: subtotal,
    couponDiscount,
    vatTax,
    deliveryCharge,
    quickDeliveryFee,
    deliveryMode: order.deliveryMode || "basic",
    slaBreached: Boolean(order?.sla?.breached),
    platformFee,
    packagingFee,
    totalAmount,
    orderStatus: displayStatus,
  }
}

export default function RegularOrderReport() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false)
  const [error, setError] = useState(null)
  const [zones, setZones] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [customers, setCustomers] = useState([])
  
  const [filters, setFilters] = useState({
    zone: "All Zones",
    restaurant: "All restaurants",
    customer: "All customers",
    time: "All Time",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  })
  const [statusCounts, setStatusCounts] = useState(EMPTY_STATUS_COUNTS)

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Fetch zones, restaurants, and customers for filter dropdowns
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        // Fetch zones
        const zonesRes = await adminAPI.getZones({ limit: 100, isActive: true, view: "summary" })
        if (zonesRes.data?.success) {
          setZones(zonesRes.data.data.zones || [])
        }

        // Fetch restaurants
        const restaurantsRes = await adminAPI.getRestaurants({ limit: 100 })
        if (restaurantsRes.data?.success) {
          setRestaurants(restaurantsRes.data.data.restaurants || [])
        }

        // Fetch customers (users) via existing customers API
        const customersRes = await adminAPI.getCustomers({ limit: 100 })
        if (customersRes.data?.success) {
          setCustomers(customersRes.data.data.customers || [])
        }
      } catch (err) {
        debugError("Error fetching filter data:", err)
      }
    }

    fetchFilterData()
  }, [])

  // Calculate date range based on time filter
  const getDateRange = () => {
    const now = new Date()
    let fromDate = null
    let toDate = null

    switch (filters.time) {
      case "Today":
        fromDate = new Date(now.setHours(0, 0, 0, 0))
        toDate = new Date(now.setHours(23, 59, 59, 999))
        break
      case "This Week":
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        weekStart.setHours(0, 0, 0, 0)
        fromDate = weekStart
        toDate = new Date(now.setHours(23, 59, 59, 999))
        break
      case "This Month":
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        break
      default:
        // All Time - no date filter
        break
    }

    return { fromDate, toDate }
  }

  // Reset to first page when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filters])

  // Fetch orders from backend
  useEffect(() => {
    const fetchOrders = async () => {
      if (isInitialLoading) {
        setLoading(true)
      } else {
        setIsFiltering(true)
      }
      setError(null)
      try {
        const { fromDate, toDate } = getDateRange()
        const params = {
          page: currentPage,
          limit: PAGE_SIZE,
          includeStatusSummary: true,
          search: searchQuery || undefined,
          zoneId: filters.zone !== "All Zones" ? filters.zone : undefined,
          restaurantId: filters.restaurant !== "All restaurants" ? filters.restaurant : undefined,
          userId: filters.customer !== "All customers" ? filters.customer : undefined,
          startDate: fromDate ? fromDate.toISOString().split('T')[0] : undefined,
          endDate: toDate ? toDate.toISOString().split('T')[0] : undefined,
        }

        const response = await adminAPI.getOrders(params)
        
        if (response.data?.success) {
          const rawOrders = response.data.data.orders || []
          setOrders(rawOrders.map(transformOrderForReport))
          setStatusCounts(response.data.data.statusSummary || EMPTY_STATUS_COUNTS)
          setPagination(response.data.data.meta || {
            total: rawOrders.length,
            page: currentPage,
            limit: PAGE_SIZE,
            totalPages: 1,
          })
        } else {
          setError(response.data?.message || "Failed to fetch orders")
          toast.error(response.data?.message || "Failed to fetch orders")
        }
      } catch (err) {
        debugError("Error fetching orders:", err)
        setError(err.response?.data?.message || "Failed to fetch orders")
        toast.error(err.response?.data?.message || "Failed to fetch orders")
      } finally {
        setLoading(false)
        setIsInitialLoading(false)
        setIsFiltering(false)
      }
    }

    fetchOrders()
  }, [filters, searchQuery, currentPage])

  const buildReportParams = (page = currentPage, limit = PAGE_SIZE) => {
    const { fromDate, toDate } = getDateRange()
    return {
      page,
      limit,
      includeStatusSummary: page === 1,
      search: searchQuery || undefined,
      zoneId: filters.zone !== "All Zones" ? filters.zone : undefined,
      restaurantId: filters.restaurant !== "All restaurants" ? filters.restaurant : undefined,
      userId: filters.customer !== "All customers" ? filters.customer : undefined,
      startDate: fromDate ? fromDate.toISOString().split("T")[0] : undefined,
      endDate: toDate ? toDate.toISOString().split("T")[0] : undefined,
    }
  }

  const handleExport = async (format) => {
    const headers = [
      { key: "sl", label: "SI" },
      { key: "orderId", label: "Order ID" },
      { key: "restaurant", label: "Restaurant" },
      { key: "customerName", label: "Customer Name" },
      { key: "totalItemAmount", label: "Total Item Amount" },
      { key: "couponDiscount", label: "Coupon Discount" },
      { key: "vatTax", label: "VAT/Tax" },
      { key: "deliveryCharge", label: "Delivery Charge" },
      { key: "quickDeliveryFee", label: "Quick Charge" },
      { key: "deliveryMode", label: "Delivery Mode" },
      { key: "platformFee", label: "Platform Fee" },
      { key: "packagingFee", label: "Packaging Fee" },
      { key: "totalAmount", label: "Order Amount" },
      { key: "orderStatus", label: "Status" },
    ]

    const money = (amount) =>
      `\u20B9${Number(amount || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`

    try {
      toast.info("Preparing export...")
      // Fetch all matching pages (cap at 2000 rows for safe browser export)
      const allRows = []
      let page = 1
      let totalPages = 1
      const limit = 200
      do {
        const response = await adminAPI.getOrders(buildReportParams(page, limit))
        const batch = (response?.data?.data?.orders || []).map(transformOrderForReport)
        allRows.push(...batch)
        const meta = response?.data?.data?.meta || response?.data?.data?.pagination || {}
        totalPages = Number(meta.totalPages || meta.pages || 1)
        page += 1
      } while (page <= totalPages && page <= 20)

      if (allRows.length === 0) {
        alert("No data to export")
        return
      }

      const exportRows = allRows.map((order, index) => ({
        sl: index + 1,
        orderId: order.orderId || "N/A",
        restaurant: order.restaurant || "N/A",
        customerName: order.customerName || "N/A",
        totalItemAmount: money(order.totalItemAmount),
        couponDiscount: money(order.couponDiscount),
        vatTax: money(order.vatTax),
        deliveryCharge: money(order.deliveryCharge),
        quickDeliveryFee: money(order.quickDeliveryFee),
        deliveryMode:
          String(order.deliveryMode || "basic").toLowerCase() === "quick"
            ? order.slaBreached
              ? "Quick·SLA"
              : "Quick"
            : "Basic",
        platformFee: money(order.platformFee),
        packagingFee: money(order.packagingFee),
        totalAmount: money(order.totalAmount),
        orderStatus: order.orderStatus || "N/A",
      }))

      switch (format) {
        case "csv":
          exportReportsToCSV(exportRows, headers, "regular_order_report")
          break
        case "excel":
          exportReportsToExcel(exportRows, headers, "regular_order_report")
          break
        case "pdf":
          await exportReportsToPDF(exportRows, headers, "regular_order_report", "Regular Order Report")
          break
        case "json":
          exportReportsToJSON(exportRows, "regular_order_report")
          break
      }
      toast.success(`Exported ${exportRows.length} orders`)
    } catch (err) {
      debugError("Error exporting order report:", err)
      toast.error("Failed to export order report")
    }
  }

  const handleFilterApply = () => {
    // Filters are already applied via useMemo
  }

  const handleResetFilters = () => {
    setFilters({
      zone: "All Zones",
      restaurant: "All restaurants",
      customer: "All customers",
      time: "All Time",
    })
  }

  const activeFiltersCount = (filters.zone !== "All Zones" ? 1 : 0) + (filters.restaurant !== "All restaurants" ? 1 : 0) + (filters.customer !== "All customers" ? 1 : 0) + (filters.time !== "All Time" ? 1 : 0)

  const totalPages = Math.max(1, pagination.totalPages || 1)

  const formatAmount = (amount) =>
    `₹${Number(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
  }

  const renderStatusRow = (statusKey) => {
    const meta = statusMeta[statusKey]
    if (!meta) return null
    return (
      <div
        key={statusKey}
        className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-3 py-2 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center overflow-hidden`}>
            <img src={meta.icon} alt={meta.label} className="w-5 h-5 object-contain" />
          </div>
          <span className="text-[11px] font-medium text-slate-800">{meta.label}</span>
        </div>
          <span className={`text-xs font-semibold ${meta.color}`}>{statusCounts[statusKey] || 0}</span>
      </div>
    )
  }

  if (isInitialLoading && loading) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-2 lg:p-3 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Order Report</h1>
          </div>
        </div>

        {/* Search Data Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <select
                value={filters.zone}
                onChange={(e) => handleFilterChange("zone", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All Zones">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone._id} value={zone._id}>
                    {zone.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={filters.restaurant}
                onChange={(e) => handleFilterChange("restaurant", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All restaurants">All restaurants</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant._id} value={restaurant._id}>
                    {restaurant.restaurantName || restaurant.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={filters.customer}
                onChange={(e) => handleFilterChange("customer", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option value="All customers">All customers</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-0">
              <select
                value={filters.time}
                onChange={(e) => handleFilterChange("time", e.target.value)}
                className="w-full px-2.5 py-1.5 pr-5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs appearance-none cursor-pointer"
              >
                <option key="all-time" value="All Time">All Time</option>
                <option key="today" value="Today">Today</option>
                <option key="this-week" value="This Week">This Week</option>
                <option key="this-month" value="This Month">This Month</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            <button 
              onClick={handleResetFilters}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all whitespace-nowrap"
            >
              Reset
            </button>
            <button 
              onClick={handleFilterApply}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all whitespace-nowrap relative ${
                activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
              }`}
            >
              Filter
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mb-3">
          {renderStatusRow("Scheduled")}
          {renderStatusRow("Pending")}
          {renderStatusRow("Processing")}
          {renderStatusRow("Food On The Way")}
          {renderStatusRow("Accepted")}
          {renderStatusRow("Delivered")}
          {renderStatusRow("Cancelled")}
          {renderStatusRow("Payment Failed")}
          {renderStatusRow("Refunded")}
        </div>

        {/* Total Orders & Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Total Orders <span className="text-blue-600">{statusCounts.total}</span>
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-initial min-w-[180px]">
                <input
                  type="text"
                  placeholder="Search by Order ID"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-7 pr-2 py-1.5 w-full text-[11px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <img src={searchIcon} alt="Search" className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 transition-all">
                    <img src={exportIcon} alt="Export" className="w-3 h-3" />
                    <span>Export</span>
                    <ChevronDown className="w-2.5 h-2.5" />
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
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full" style={{ tableLayout: "fixed", width: "100%" }}>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "3%" }}>
                    SI
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>
                    Order Id
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "12%" }}>
                    Restaurant
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "12%" }}>
                    Customer Name
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>
                    Total Item Amount
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>
                    Coupon Discount
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "6%" }}>
                    Vat/Tax
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "7%" }}>
                    Delivery Charge
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "6%" }}>
                    Quick Charge
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "5%" }}>
                    Mode
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "6%" }}>
                    Platform Fee
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "6%" }}>
                    Packaging Fee
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "8%" }}>
                    Order Amount
                  </th>
                  <th className="px-1.5 py-1 text-left text-[8px] font-bold text-slate-700 uppercase tracking-wider" style={{ width: "5%" }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className={`bg-white divide-y divide-slate-100 transition-opacity duration-200 ${isFiltering ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                        <p className="text-sm text-slate-500">No orders match your filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  orders.map((order, index) => (
                    <tr key={order.orderId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] font-medium text-slate-700">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-blue-600 hover:underline cursor-pointer">{order.orderId}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700 truncate block">{order.restaurant}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700 truncate block">{order.customerName}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.totalItemAmount)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.couponDiscount)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.vatTax)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.deliveryCharge)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.quickDeliveryFee)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">
                          {String(order.deliveryMode || "basic").toLowerCase() === "quick"
                            ? (order.slaBreached ? "Quick·SLA" : "Quick")
                            : "Basic"}
                        </span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.platformFee)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] text-slate-700">{formatAmount(order.packagingFee || 0)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="text-[10px] font-medium text-slate-900">{formatAmount(order.totalAmount || order.totalItemAmount)}</span>
                      </td>
                      <td className="px-1.5 py-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-700">
                          {order.orderStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {orders.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} -{" "}
                {(currentPage - 1) * PAGE_SIZE + orders.length}
              </span>{" "}
              of <span className="font-semibold text-slate-700">{pagination.total}</span> orders
            </p>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-[10px] rounded border border-slate-300 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={() => handlePageChange(idx + 1)}
                  className={`w-6 h-6 text-[10px] rounded border ${
                    currentPage === idx + 1
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-[10px] rounded border border-slate-300 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
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
              Regular order report settings and preferences will be available here.
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



