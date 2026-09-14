import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { Search, Download, ChevronDown, Eye, FileDown, FileSpreadsheet, FileText, Mail, Phone, MapPin, Package, IndianRupee, Calendar as CalendarIcon, User, CheckCircle, XCircle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { exportCustomersToCSV, exportCustomersToExcel, exportCustomersToPDF, exportCustomersToJSON } from "@food/components/admin/customers/customersExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { PAGE_SIZE as PAGINATION_PAGE_SIZE } from "@/shared/constants/pagination"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const PAGE_SIZE = PAGINATION_PAGE_SIZE.FIFTY

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = PAGE_SIZE
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([])
  /** null | 'enable' | 'disable' — only the clicked bulk COD button shows loading */
  const [bulkCodLoadingAction, setBulkCodLoadingAction] = useState(null)
  const [codUpdatingId, setCodUpdatingId] = useState(null)

  // User Contacts state
  const [userContacts, setUserContacts] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsSearchQuery, setContactsSearchQuery] = useState("")

  const filteredUserContacts = useMemo(() => {
    if (!contactsSearchQuery.trim()) return userContacts
    const query = contactsSearchQuery.toLowerCase().trim()
    return userContacts.filter(c =>
      (c.contactName || "").toLowerCase().includes(query) ||
      (c.contactNumber || "").includes(query)
    )
  }, [userContacts, contactsSearchQuery])

  const [filters, setFilters] = useState({
    orderDate: "",
    joiningDate: "",
    status: "",
    sortBy: "",
    chooseFirst: "",
  })

  // Server handles search/filter — do not re-filter client-side
  const displayCustomers = customers

  const getCustomerId = (customer) => customer?._id || customer?.id || null
  const selectedCustomersCount = selectedCustomerIds.length
  const allVisibleSelected =
    displayCustomers.length > 0 &&
    displayCustomers.every((customer) => selectedCustomerIds.includes(getCustomerId(customer)))

  const totalPages = Math.max(1, Math.ceil((totalCustomers || 0) / pageSize))

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const formatDateTime = (value) => {
    if (!value) return "-"
    try {
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return String(value)
      const day = String(d.getDate()).padStart(2, "0")
      const month = d.toLocaleString("en-GB", { month: "short" })
      const year = d.getFullYear()
      const time = d.toLocaleString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
      return `${day} ${month} ${year}, ${time}`
    } catch {
      return String(value)
    }
  }

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const params = {
        page,
        limit: pageSize,
        ...(searchQuery && { search: searchQuery }),
        ...(filters.status && { status: filters.status }),
        ...(filters.joiningDate && { joiningDate: filters.joiningDate }),
        ...(filters.orderDate && { orderDate: filters.orderDate }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.chooseFirst && { chooseFirst: filters.chooseFirst }),
      }

      const response = await adminAPI.getCustomers(params)
      const data = response?.data?.data || response?.data

      const list = data?.customers || data?.users || []
      if (Array.isArray(list)) {
        setCustomers(list)
        setTotalCustomers(data?.total ?? data?.pagination?.total ?? list.length)
      } else {
        setCustomers([])
        setTotalCustomers(0)
      }
    } catch (error) {
      debugError("Error fetching customers:", error)
      toast.error("Failed to load customers")
      setCustomers([])
      setTotalCustomers(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, searchQuery, filters])

  const loadCustomersRef = useRef(loadCustomers)
  loadCustomersRef.current = loadCustomers

  // Fetch customers from API (debounced)
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      if (!cancelled) loadCustomersRef.current()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [page, searchQuery, filters.status, filters.joiningDate, filters.orderDate, filters.sortBy, filters.chooseFirst])

  const [searchParams] = useSearchParams()
  const userIdFromUrl = searchParams.get("userId")

  useEffect(() => {
    if (userIdFromUrl && customers.length > 0) {
      const customer = customers.find((c) => c.id === userIdFromUrl || c._id === userIdFromUrl)
      if (customer) {
        handleViewDetails(getCustomerId(customer))
      }
    }
  }, [userIdFromUrl, customers])

  const handleToggleStatus = async (customerId) => {
    try {
      const customer = customers.find((c) => getCustomerId(c) === customerId)
      if (!customer) return

      const newStatus = !customer.status

      setCustomers((prev) =>
        prev.map((c) =>
          getCustomerId(c) === customerId ? { ...c, status: newStatus, isActive: newStatus } : c
        )
      )

      await adminAPI.updateCustomerStatus(customerId, newStatus)
      toast.success(`User ${newStatus ? "activated" : "deactivated"} successfully`)
    } catch (error) {
      debugError("Error updating status:", error)
      toast.error("Failed to update status")
      setCustomers((prev) =>
        prev.map((c) =>
          getCustomerId(c) === customerId ? { ...c, status: !c.status, isActive: !c.status } : c
        )
      )
    }
  }

  const handleToggleCodAccess = async (customerId) => {
    try {
      const customer = customers.find((c) => getCustomerId(c) === customerId)
      if (!customer) return
      const nextCodAccess = !(customer.isCodAllowed !== false)
      setCodUpdatingId(customerId)

      setCustomers((prev) =>
        prev.map((c) =>
          getCustomerId(c) === customerId ? { ...c, isCodAllowed: nextCodAccess } : c
        )
      )

      await adminAPI.updateCustomerCodAccess(customerId, nextCodAccess)
      toast.success(`COD ${nextCodAccess ? "enabled" : "disabled"} for user`)
    } catch (error) {
      debugError("Error updating COD access:", error)
      toast.error("Failed to update COD access")
      setCustomers((prev) =>
        prev.map((c) =>
          getCustomerId(c) === customerId ? { ...c, isCodAllowed: !(c.isCodAllowed !== false) } : c
        )
      )
    } finally {
      setCodUpdatingId(null)
    }
  }

  const toggleCustomerSelection = (customerId) => {
    if (!customerId) return
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    )
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = displayCustomers.map((customer) => getCustomerId(customer)).filter(Boolean)
      setSelectedCustomerIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
      return
    }
    const visibleIds = displayCustomers.map((customer) => getCustomerId(customer)).filter(Boolean)
    setSelectedCustomerIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleBulkCodAccess = async (isCodAllowed) => {
    if (!selectedCustomerIds.length) {
      toast.error("Please select at least one customer")
      return
    }
    if (bulkCodLoadingAction) return
    const action = isCodAllowed ? "enable" : "disable"
    try {
      setBulkCodLoadingAction(action)
      await adminAPI.bulkUpdateCustomerCodAccess(selectedCustomerIds, isCodAllowed)
      setCustomers((prev) =>
        prev.map((customer) =>
          selectedCustomerIds.includes(getCustomerId(customer))
            ? { ...customer, isCodAllowed: isCodAllowed !== false }
            : customer
        )
      )
      toast.success(`COD ${isCodAllowed ? "enabled" : "disabled"} for selected users`)
      setSelectedCustomerIds([])
    } catch (error) {
      debugError("Error in bulk COD update:", error)
      toast.error("Failed to update selected users")
    } finally {
      setBulkCodLoadingAction(null)
    }
  }

  const handleViewDetails = async (customerId) => {
    try {
      setLoadingDetails(true)
      setShowUserDetails(true)
      setSelectedCustomer(customerId)
      setUserContacts([])
      setContactsSearchQuery("")
      setLoadingContacts(true)

      const response = await adminAPI.getCustomerById(customerId)
      const data = response?.data?.data || response?.data

      if (data?.user) {
        const user = data.user
        const recentOrders = (user.recentOrders || data.recentOrders || user.orders || data.orders || []).map((o) => ({
          ...o,
          orderId: o.orderId || o._id,
          restaurantName: o.restaurantName || o.restaurant?.name || "",
          total: o.total ?? o.pricing?.total ?? 0,
          status: o.status || o.orderStatus || "",
        }))
        setUserDetails({
          ...user,
          phoneVerified: user.phoneVerified ?? user.isPhoneVerified ?? user.isVerified ?? false,
          addresses: user.addresses || data.addresses || [],
          orders: recentOrders,
          gender: user.gender || data.gender || "",
          dateOfBirth: user.dateOfBirth || data.dateOfBirth || null,
        })

        try {
          const contactsRes = await adminAPI.getCustomerContacts(customerId, { limit: 500 })
          const contactsData = contactsRes?.data?.data?.contacts || contactsRes?.data?.contacts || []
          setUserContacts(contactsData)
        } catch (contactsError) {
          debugError("Error fetching customer contacts:", contactsError)
          toast.error("Failed to load user contacts")
        } finally {
          setLoadingContacts(false)
        }
      } else {
        toast.error("Failed to load user details")
        setShowUserDetails(false)
      }
    } catch (error) {
      debugError("Error fetching user details:", error)
      toast.error("Failed to load user details")
      setShowUserDetails(false)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleExport = async (format) => {
    try {
      toast.info("Preparing export...")
      const allCustomers = []
      let currentPage = 1
      let totalPagesToFetch = 1
      const exportLimit = 200

      do {
        const params = {
          page: currentPage,
          limit: exportLimit,
          ...(searchQuery && { search: searchQuery }),
          ...(filters.status && { status: filters.status }),
          ...(filters.joiningDate && { joiningDate: filters.joiningDate }),
          ...(filters.orderDate && { orderDate: filters.orderDate }),
          ...(filters.sortBy && { sortBy: filters.sortBy }),
          ...(filters.chooseFirst && { chooseFirst: filters.chooseFirst }),
        }
        const response = await adminAPI.getCustomers(params)
        const data = response?.data?.data || response?.data
        const list = data?.customers || data?.users || []
        if (Array.isArray(list) && list.length) {
          allCustomers.push(...list)
        }
        const total = Number(data?.total ?? data?.pagination?.total ?? allCustomers.length)
        totalPagesToFetch = Math.max(1, Math.ceil(total / exportLimit))
        currentPage += 1
      } while (currentPage <= totalPagesToFetch && currentPage <= 50)

      if (allCustomers.length === 0) {
        toast.error("No customers to export")
        return
      }

      const exportRows = allCustomers.map((customer, index) => ({
        ...customer,
        sl: index + 1,
        name: customer.name || "N/A",
        email: customer.email || "N/A",
        phone: customer.phone || "N/A",
        totalOrder: Number(customer.totalOrder || 0),
        totalOrderAmount: Number(customer.totalOrderAmount || 0),
        joiningDate: formatDateTime(customer.joiningDate),
        isCodAllowed: customer.isCodAllowed !== false,
        status: Boolean(customer.status ?? customer.isActive),
      }))

      const filename = "customers"
      switch (format) {
        case "csv":
          exportCustomersToCSV(exportRows, filename)
          toast.success(`CSV exported (${exportRows.length} customers)`)
          break
        case "excel":
          exportCustomersToExcel(exportRows, filename)
          toast.success(`Excel exported (${exportRows.length} customers)`)
          break
        case "pdf":
          exportCustomersToPDF(exportRows, filename)
          toast.success(`PDF download started (${exportRows.length} customers)`)
          break
        case "json":
          exportCustomersToJSON(exportRows, filename)
          toast.success(`JSON exported (${exportRows.length} customers)`)
          break
        default:
          toast.error("Invalid export format")
          break
      }
    } catch (error) {
      debugError("Export error:", error)
      toast.error("Failed to export customers")
    }
  }

  const getInitials = (name) => {
    if (!name) return "NA"
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "NA"
  }

  const handleResetFilters = () => {
    setSearchQuery("")
    setFilters({
      orderDate: "",
      joiningDate: "",
      status: "",
      sortBy: "",
      chooseFirst: "",
    })
    setPage(1)
  }

  return (
    <div className="p-4 lg:p-6 bg-[#ffffffcc]">
      <div className="max-w-7xl mx-auto">
        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-[#EDE8E0] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#5C5247] mb-2">
                Order Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.orderDate}
                  onChange={(e) => handleFilterChange("orderDate", e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#EDE8E0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#5C5247] mb-2">
                Customer Joining Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.joiningDate}
                  onChange={(e) => handleFilterChange("joiningDate", e.target.value)}
                  className="w-full px-4 py-2.5 border border-[#EDE8E0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#5C5247] mb-2">
                Customer status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#EDE8E0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] text-sm"
              >
                <option value="">Select Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#5C5247] mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                className="w-full px-4 py-2.5 border border-[#EDE8E0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] text-sm"
              >
                <option value="">Select Customer Sorting Order</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="orders-asc">Orders (Low to High)</option>
                <option value="orders-desc">Orders (High to Low)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#5C5247] mb-2">
                Choose First
              </label>
              <input
                type="number"
                value={filters.chooseFirst}
                onChange={(e) => handleFilterChange("chooseFirst", e.target.value)}
                placeholder="Ex: 100"
                className="w-full px-4 py-2.5 border border-[#EDE8E0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000] text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => loadCustomers()}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#FF0000] text-white hover:bg-[#CC0000] transition-all"
              >
                Apply Filters
              </button>
              <button
                onClick={handleResetFilters}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-[#EDE8E0] bg-white text-[#5C5247] hover:bg-[#FFEDED] hover:text-[#FF0000] transition-all"
              >
                Reset Filters
              </button>
            </div>
            <div className="text-sm text-[#5C5247]">
              {loading
                ? "Loading..."
                : `Showing ${displayCustomers.length} of ${totalCustomers} customers (page ${page} of ${totalPages})`}
            </div>
          </div>
        </div>

        {/* Customer List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-[#EDE8E0] p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#1A1A1A]">Customer list</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-[#FFEDED] text-[#FF0000]">
                {totalCustomers}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Search by name"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(1)
                  }}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-[#EDE8E0] bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000]"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E8F7E]" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-[#EDE8E0] bg-white hover:bg-[#FFEDED] hover:text-[#FF0000] text-[#5C5247] flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="font-bold">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-[#EDE8E0] rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel className="text-[#1A1A1A]">Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#EDE8E0]" />
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer hover:bg-[#FFEDED] hover:text-[#FF0000] focus:bg-[#FFEDED] focus:text-[#FF0000]">
                    <FileDown className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer hover:bg-[#FFEDED] hover:text-[#FF0000] focus:bg-[#FFEDED] focus:text-[#FF0000]">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer hover:bg-[#FFEDED] hover:text-[#FF0000] focus:bg-[#FFEDED] focus:text-[#FF0000]">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer hover:bg-[#FFEDED] hover:text-[#FF0000] focus:bg-[#FFEDED] focus:text-[#FF0000]">
                    <FileDown className="w-4 h-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EDE8E0] bg-[#FAF7F2] px-4 py-3">
            <p className="text-sm text-[#5C5247]">
              {selectedCustomersCount > 0
                ? `${selectedCustomersCount} customer selected`
                : "Select customers for bulk COD action"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkCodAccess(true)}
                disabled={selectedCustomersCount === 0 || bulkCodLoadingAction !== null}
                className={`px-3 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed ${
                  selectedCustomersCount === 0 || bulkCodLoadingAction === "enable" ? "opacity-50" : ""
                }`}
              >
                {bulkCodLoadingAction === "enable" ? "Enabling..." : "Enable COD"}
              </button>
              <button
                type="button"
                onClick={() => handleBulkCodAccess(false)}
                disabled={selectedCustomersCount === 0 || bulkCodLoadingAction !== null}
                className={`px-3 py-2 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:cursor-not-allowed ${
                  selectedCustomersCount === 0 || bulkCodLoadingAction === "disable" ? "opacity-50" : ""
                }`}
              >
                {bulkCodLoadingAction === "disable" ? "Disabling..." : "Disable COD"}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead className="bg-[#FAF7F2] border-b border-[#EDE8E0]">
                <tr>
                  <th className="px-4 py-4 text-center text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-[#EDE8E0] text-[#FF0000] focus:ring-[#FF0000]"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Contact Information</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Total Order</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Total Order Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Joining Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">COD Access</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Active/Inactive</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-[#5C5247] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-[#EDE8E0]/70">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center">
                      <div className="text-sm text-[#9E8F7E]">Loading customers...</div>
                    </td>
                  </tr>
                ) : displayCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center">
                      <div className="text-sm text-[#9E8F7E]">No customers found</div>
                    </td>
                  </tr>
                ) : (
                  displayCustomers.map((customer, index) => (
                    <tr key={getCustomerId(customer) || index} className="hover:bg-[#FAF7F2]/55 transition-colors">
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(getCustomerId(customer))}
                          onChange={() => toggleCustomerSelection(getCustomerId(customer))}
                          className="h-4 w-4 rounded border-[#EDE8E0] text-[#FF0000] focus:ring-[#FF0000]"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full bg-[#FAF7F2] text-[#5C5247] flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-all border border-[#EDE8E0]"
                            onClick={() => handleViewDetails(getCustomerId(customer))}
                          >
                            {customer.profileImage ? (
                              <img
                                src={customer.profileImage}
                                alt={customer.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
                              />
                            ) : (
                              <span className="text-xs font-semibold">{getInitials(customer.name)}</span>
                            )}
                          </div>
                          <span
                            className="text-sm font-medium text-[#1A1A1A] cursor-pointer hover:text-[#FF0000] transition-colors"
                            onClick={() => handleViewDetails(getCustomerId(customer))}
                          >
                            {customer.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-[#5C5247]">{customer.email}</span>
                          <span className="text-xs text-[#9E8F7E]">{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#5C5247]">{customer.totalOrder || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-[#1A1A1A]">{"\u20B9"} {(customer.totalOrderAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-[#5C5247]">{formatDateTime(customer.joiningDate)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleCodAccess(getCustomerId(customer))}
                          disabled={codUpdatingId === getCustomerId(customer)}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 ${customer.isCodAllowed !== false ? "bg-emerald-600" : "bg-slate-300"
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.isCodAllowed !== false ? "translate-x-6" : "translate-x-1"
                              }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(getCustomerId(customer))}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${customer.status ? "bg-red-500" : "bg-slate-300"
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.status ? "translate-x-6" : "translate-x-1"
                              }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewDetails(getCustomerId(customer))}
                          className="p-1.5 rounded text-[#FF0000] hover:bg-[#FFEDED] transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[#5C5247]">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#EDE8E0] bg-white text-[#5C5247] hover:bg-[#FFEDED] hover:text-[#FF0000] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-[#EDE8E0] bg-white text-[#5C5247] hover:bg-[#FFEDED] hover:text-[#FF0000] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto mx-auto p-0 gap-0 bg-[#FAF7F2] border-[#EDE8E0]">
          <DialogHeader className="px-6 pt-6 pb-4 bg-white border-b border-[#EDE8E0]">
            <DialogTitle className="pr-12 text-xl font-bold text-[#1A1A1A]">User Details</DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="px-6 py-8 text-center bg-white">
              <div className="text-sm text-[#9E8F7E]">Loading user details...</div>
            </div>
          ) : userDetails ? (
            <div className="space-y-4 px-6 py-5">
              {/* Profile Section */}
              <div className="bg-white border border-[#EDE8E0] rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-[#FAF7F2] border border-[#EDE8E0] flex items-center justify-center flex-shrink-0">
                    {userDetails.profileImage ? (
                      <img src={userDetails.profileImage} alt={userDetails.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-[#9E8F7E]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-[#1A1A1A]">{userDetails.name}</h3>
                      {userDetails.isActive ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#EAF4EA] text-[#2E7D32] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center gap-2 text-sm text-[#5C5247] min-w-0">
                        <Mail className="w-4 h-4 text-[#9E8F7E]" />
                        <span className="truncate">{userDetails.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5C5247] min-w-0">
                        <Phone className="w-4 h-4 text-[#9E8F7E]" />
                        <span>{userDetails.phone}</span>
                        {userDetails.phoneVerified && (
                          <CheckCircle className="w-3 h-3 text-[#2E7D32]" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#5C5247]">
                        <CalendarIcon className="w-4 h-4 text-[#9E8F7E]" />
                        <span>Joined: {formatDateTime(userDetails.joiningDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[#FFEDED] border border-[#EDE8E0] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-[#FF0000]" />
                    <span className="text-xs font-semibold text-[#5C5247]">Total Orders</span>
                  </div>
                  <p className="text-xl font-bold text-[#FF0000]">{userDetails.totalOrders || 0}</p>
                </div>
                <div className="bg-[#EAF4EA] border border-[#EDE8E0] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4 text-[#2E7D32]" />
                    <span className="text-xs font-semibold text-[#5C5247]">Total Spent</span>
                  </div>
                  <p className="text-xl font-bold text-[#2E7D32]">
                    {"\u20B9"}{(userDetails.totalOrderAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white border border-[#EDE8E0] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-4 h-4 text-[#9E8F7E]" />
                    <span className="text-xs font-semibold text-[#5C5247]">Member Since</span>
                  </div>
                  <p className="text-base font-bold text-[#1A1A1A]">{formatDateTime(userDetails.joiningDate)}</p>
                </div>
              </div>

              {/* Addresses Section */}
              {userDetails.addresses && userDetails.addresses.length > 0 && (
                <div>
                  <h4 className="text-base font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#FF0000]" />
                    Addresses
                  </h4>
                  <div className="space-y-2">
                    {userDetails.addresses.map((address, index) => (
                      <div key={index} className="bg-white rounded-xl p-3 border border-[#EDE8E0]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-[#1A1A1A]">{address.label || "Address"}</span>
                          {address.isDefault && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#FFEDED] text-[#FF0000] border border-[#EDE8E0]">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#5C5247]">
                          {address.street}
                          {address.additionalDetails && `, ${address.additionalDetails}`}
                          {address.city && `, ${address.city}`}
                          {address.state && `, ${address.state}`}
                          {address.zipCode && ` - ${address.zipCode}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Orders Section */}
              {userDetails.orders && userDetails.orders.length > 0 && (
                <div>
                  <h4 className="text-base font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4 text-[#FF0000]" />
                    Recent Orders
                  </h4>
                  <div className="space-y-2">
                    {userDetails.orders.slice(0, 5).map((order, index) => (
                      <div key={index} className="bg-white rounded-xl p-3 border border-[#EDE8E0] flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{order.orderId}</p>
                          <p className="text-xs text-[#5C5247]">{order.restaurantName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{"\u20B9"}{(order.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-[#5C5247] capitalize">{order.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uploaded Contacts Section */}
              <div className="mt-4 border-t border-[#EDE8E0] pt-4">
                <h4 className="text-base font-bold text-[#1A1A1A] mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#FF0000]" />
                  Uploaded Contacts ({userContacts.length})
                </h4>
                {loadingContacts ? (
                  <div className="py-4 text-center text-sm text-[#5C5247]">Loading contacts...</div>
                ) : userContacts.length === 0 ? (
                  <div className="bg-white rounded-xl p-4 border border-[#EDE8E0] text-center text-sm text-[#5C5247]">
                    No contacts uploaded by this user.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search contacts by name or phone..."
                        value={contactsSearchQuery}
                        onChange={(e) => setContactsSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[#EDE8E0] bg-white focus:outline-none focus:ring-2 focus:ring-[#FF0000] focus:border-[#FF0000]"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9E8F7E]" />
                    </div>

                    <div className="bg-white border border-[#EDE8E0] rounded-xl max-h-48 overflow-y-auto divide-y divide-[#EDE8E0]">
                      {filteredUserContacts.length === 0 ? (
                        <div className="py-4 text-center text-sm text-[#5C5247]">No matching contacts found</div>
                      ) : (
                        filteredUserContacts.map((contact, index) => (
                          <div key={contact._id || index} className="px-4 py-2.5 flex justify-between items-center hover:bg-[#FAF7F2] transition-colors">
                            <span className="text-sm font-semibold text-[#1A1A1A]">{contact.contactName}</span>
                            <span className="text-sm text-[#5C5247] font-mono">{contact.contactNumber}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userDetails.gender && (
                  <div className="bg-white rounded-xl p-3 border border-[#EDE8E0]">
                    <p className="text-xs font-semibold text-[#5C5247] mb-1">Gender</p>
                    <p className="text-sm text-[#1A1A1A] capitalize">{userDetails.gender}</p>
                  </div>
                )}
                {userDetails.dateOfBirth && (
                  <div className="bg-white rounded-xl p-3 border border-[#EDE8E0]">
                    <p className="text-xs font-semibold text-[#5C5247] mb-1">Date of Birth</p>
                    <p className="text-sm text-[#1A1A1A]">
                      {new Date(userDetails.dateOfBirth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center bg-white">
              <div className="text-sm text-[#9E8F7E]">No user details available</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
