import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Search, Download, ChevronDown, Calendar, Eye, EyeOff, FileDown, FileSpreadsheet, FileText, X, Mail, Phone, MapPin, Package, IndianRupee, Calendar as CalendarIcon, User, CheckCircle, XCircle, Trash2, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { exportCustomersToCSV, exportCustomersToExcel, exportCustomersToPDF } from "@food/components/admin/customers/customersExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([])
  const [bulkCodLoading, setBulkCodLoading] = useState(false)
  const [codUpdatingId, setCodUpdatingId] = useState(null)
  
  // User Contacts state
  const [userContacts, setUserContacts] = useState([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsSearchQuery, setContactsSearchQuery] = useState("")
  const [contactsViewPassword, setContactsViewPassword] = useState("")
  const [isContactsAuthorized, setIsContactsAuthorized] = useState(false)
  const [authorizingContacts, setAuthorizingContacts] = useState(false)

  // Soft delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [deletingCustomer, setDeletingCustomer] = useState(false)
  const [showDeletePassword, setShowDeletePassword] = useState(false)

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

  const filteredCustomers = useMemo(() => {
    let result = [...customers]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.includes(query)
      )
    }

    // Filter by order date when that field is available in the API payload.

    // Filter by joining date
    if (filters.joiningDate) {
      result = result.filter(customer => {
        // Parse joining date from format "17 Oct 2021"
        const customerDate = new Date(customer.joiningDate)
        const filterDate = new Date(filters.joiningDate)
        return customerDate.toDateString() === filterDate.toDateString()
      })
    }

    // Filter by status
    if (filters.status) {
      if (filters.status === "active") {
        result = result.filter(customer => customer.status === true)
      } else if (filters.status === "inactive") {
        result = result.filter(customer => customer.status === false)
      }
    }

    // Sort by options
    if (filters.sortBy) {
      if (filters.sortBy === "name-asc") {
        result.sort((a, b) => a.name.localeCompare(b.name))
      } else if (filters.sortBy === "name-desc") {
        result.sort((a, b) => b.name.localeCompare(a.name))
      } else if (filters.sortBy === "orders-asc") {
        result.sort((a, b) => a.totalOrder - b.totalOrder)
      } else if (filters.sortBy === "orders-desc") {
        result.sort((a, b) => b.totalOrder - a.totalOrder)
      }
    }

    // Limit results if "Choose First" is set
    if (filters.chooseFirst && parseInt(filters.chooseFirst) > 0) {
      result = result.slice(0, parseInt(filters.chooseFirst))
    }

    return result
  }, [customers, searchQuery, filters])

  const getCustomerId = (customer) => customer?._id || customer?.id || customer?.sl || null
  const selectedCustomersCount = selectedCustomerIds.length
  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((customer) => selectedCustomerIds.includes(getCustomerId(customer)))

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
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

  // Fetch customers from API
  useEffect(() => {
    let cancelled = false
    const fetchCustomers = async () => {
      try {
        setLoading(true)
        const params = {
          limit: 1000,
          page: 1,
          ...(searchQuery && { search: searchQuery }),
          ...(filters.status && { status: filters.status }),
          ...(filters.joiningDate && { joiningDate: filters.joiningDate }),
          ...(filters.sortBy && { sortBy: filters.sortBy }),
          ...(filters.chooseFirst && { chooseFirst: filters.chooseFirst }),
        }

        const response = await adminAPI.getCustomers(params)
        const data = response?.data?.data || response?.data?.data || response?.data

        const list = data?.customers || data?.users || []
        if (!cancelled && Array.isArray(list)) {
          setCustomers(list)
          setTotalCustomers(data?.total || list.length)
        } else {
          if (!cancelled) {
            setCustomers([])
            setTotalCustomers(0)
          }
        }
      } catch (error) {
        debugError('Error fetching customers:', error)
        toast.error('Failed to load customers')
        if (!cancelled) {
          setCustomers([])
          setTotalCustomers(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const t = setTimeout(fetchCustomers, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchQuery, filters.status, filters.joiningDate, filters.sortBy, filters.chooseFirst])

  const [searchParams] = useSearchParams()
  const userIdFromUrl = searchParams.get("userId")

  useEffect(() => {
    if (userIdFromUrl && customers.length > 0) {
      const customer = customers.find(c => c.id === userIdFromUrl || c._id === userIdFromUrl)
      if (customer) {
        handleViewDetails(customer.id || customer.sl || customer._id)
      }
    }
  }, [userIdFromUrl, customers])

  const handleToggleStatus = async (customerId) => {
    try {
      // Find customer
      const customer = customers.find(c => (c._id || c.id) === customerId)
      if (!customer) return

      const newStatus = !customer.status

      // Optimistically update UI
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: newStatus } : c
      ))

      // Call API to update user status
      await adminAPI.updateCustomerStatus(customerId, newStatus)
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      debugError('Error updating status:', error)
      toast.error('Failed to update status')
      // Revert optimistic update
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: !c.status } : c
      ))
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
      const visibleIds = filteredCustomers.map((customer) => getCustomerId(customer)).filter(Boolean)
      setSelectedCustomerIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
      return
    }
    const visibleIds = filteredCustomers.map((customer) => getCustomerId(customer)).filter(Boolean)
    setSelectedCustomerIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
  }

  const handleBulkCodAccess = async (isCodAllowed) => {
    if (!selectedCustomerIds.length) {
      toast.error("Please select at least one customer")
      return
    }
    try {
      setBulkCodLoading(true)
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
      setBulkCodLoading(false)
    }
  }

  const handleViewDetails = async (customerId) => {
    try {
      setLoadingDetails(true)
      setShowUserDetails(true)
      setSelectedCustomer(customerId)
      setUserContacts([])
      setContactsSearchQuery("")
      setContactsViewPassword("")
      setIsContactsAuthorized(false)
      
      const response = await adminAPI.getCustomerById(customerId)
      const data = response?.data?.data || response?.data

      if (data?.user) {
        setUserDetails(data.user)
      } else {
        toast.error('Failed to load user details')
        setShowUserDetails(false)
      }
    } catch (error) {
      debugError('Error fetching user details:', error)
      toast.error('Failed to load user details')
      setShowUserDetails(false)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleVerifyContactsPassword = async () => {
    if (!contactsViewPassword.trim()) {
      toast.error("Please enter the contacts view password");
      return;
    }
    
    try {
      setAuthorizingContacts(true);
      const contactsRes = await adminAPI.getCustomerContacts(selectedCustomer, { 
        limit: 500, 
        password: contactsViewPassword 
      });
      const contactsData = contactsRes?.data?.data?.contacts || contactsRes?.data?.contacts || [];
      setUserContacts(contactsData);
      setIsContactsAuthorized(true);
      toast.success("Access granted");
    } catch (error) {
      debugError('Error verifying contacts password:', error);
      toast.error(error?.response?.data?.message || 'Invalid Password');
      setIsContactsAuthorized(false);
    } finally {
      setAuthorizingContacts(false);
    }
  };

  const handleDeleteClick = (customer) => {
    setDeleteTargetCustomer(customer)
    setDeletePassword("")
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletePassword.trim()) {
      toast.error("Please enter the password")
      return
    }
    const customerId = getCustomerId(deleteTargetCustomer)
    if (!customerId) return

    try {
      setDeletingCustomer(true)
      await adminAPI.softDeleteCustomer(customerId, deletePassword)
      toast.success(`Customer "${deleteTargetCustomer?.name || ''}" deleted successfully`)
      setCustomers(prev => prev.filter(c => getCustomerId(c) !== customerId))
      setTotalCustomers(prev => Math.max(0, prev - 1))
      setShowDeleteDialog(false)
      setDeleteTargetCustomer(null)
      setDeletePassword("")
    } catch (error) {
      debugError('Error soft deleting customer:', error)
      toast.error(error?.response?.data?.message || 'Failed to delete customer')
    } finally {
      setDeletingCustomer(false)
    }
  }

  const handleDownloadContacts = () => {
    if (!userContacts || userContacts.length === 0) {
      toast.error("No contacts to download");
      return;
    }
    
    const csvContent = [
      ["Name", "Phone Number"],
      ...userContacts.map(c => [
        `"${(c.contactName || '').replace(/"/g, '""')}"`,
        `"=""${(c.contactNumber || '').replace(/"/g, '""')}"""`
      ])
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customer_contacts_${selectedCustomer}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (format) => {
    if (filteredCustomers.length === 0) {
      toast.error("No customers to export")
      return
    }

    const filename = "customers"
    try {
      switch (format) {
        case "csv":
          exportCustomersToCSV(filteredCustomers, filename)
          toast.success("CSV export started")
          break
        case "excel":
          exportCustomersToExcel(filteredCustomers, filename)
          toast.success("Excel export started")
          break
        case "pdf":
          exportCustomersToPDF(filteredCustomers, filename)
          toast.success("PDF download started")
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

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Order Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.orderDate}
                  onChange={(e) => handleFilterChange("orderDate", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Customer Joining Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.joiningDate}
                  onChange={(e) => handleFilterChange("joiningDate", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Customer status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">Select Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              >
                <option value="">Select Customer Sorting Order</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="orders-asc">Orders (Low to High)</option>
                <option value="orders-desc">Orders (High to Low)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Choose First
              </label>
              <input
                type="number"
                value={filters.chooseFirst}
                onChange={(e) => handleFilterChange("chooseFirst", e.target.value)}
                placeholder="Ex: 100"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Filters are applied automatically via useMemo
                }}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-all"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({
                    orderDate: "",
                    joiningDate: "",
                    status: "",
                    sortBy: "",
                    chooseFirst: "",
                  })
                }}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset Filters
              </button>
            </div>
            <div className="text-sm text-slate-600">
              {loading ? 'Loading...' : `Showing ${filteredCustomers.length} of ${totalCustomers} customers`}
            </div>
          </div>
        </div>

        {/* Customer List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Customer list</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredCustomers.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Search by name"
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
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                    <FileDown className="w-4 h-4 mr-2" />
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-600">
              {selectedCustomersCount > 0
                ? `${selectedCustomersCount} customer selected`
                : "Select customers for bulk COD action"}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkCodAccess(true)}
                disabled={bulkCodLoading || selectedCustomersCount === 0}
                className="px-3 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enable COD
              </button>
              <button
                onClick={() => handleBulkCodAccess(false)}
                disabled={bulkCodLoading || selectedCustomersCount === 0}
                className="px-3 py-2 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disable COD
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Sl</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Contact Information</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Order</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Order Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Joining Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">COD Access</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Active/Inactive</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center">
                      <div className="text-sm text-slate-500">Loading customers...</div>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center">
                      <div className="text-sm text-slate-500">No customers found</div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer, index) => (
                    <tr key={getCustomerId(customer) || index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(getCustomerId(customer))}
                          onChange={() => toggleCustomerSelection(getCustomerId(customer))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-all border border-slate-100"
                            onClick={() => handleViewDetails(customer._id || customer.id || customer.sl)}
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
                            className="text-sm font-medium text-slate-900 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleViewDetails(customer._id || customer.id || customer.sl)}
                          >
                            {customer.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{customer.email}</span>
                          <span className="text-xs text-slate-500">{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{customer.totalOrder || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{"\u20B9"} {(customer.totalOrderAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{formatDateTime(customer.joiningDate)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleCodAccess(getCustomerId(customer))}
                          disabled={codUpdatingId === getCustomerId(customer)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 ${customer.isCodAllowed !== false ? "bg-emerald-600" : "bg-slate-300"
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
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${customer.status ? "bg-primary" : "bg-slate-300"
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.status ? "translate-x-6" : "translate-x-1"
                              }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetails(customer._id || customer.id || customer.sl)}
                            className="p-1.5 rounded text-primary hover:bg-orange-50 transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(customer)}
                            className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto mx-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="pr-12 text-xl font-bold text-slate-900">User Details</DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="px-6 py-8 text-center">
              <div className="text-sm text-slate-500">Loading user details...</div>
            </div>
          ) : userDetails ? (
            <div className="space-y-4 px-6 py-5">
              {/* Profile Section */}
              <div className="bg-slate-50 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                    {userDetails.profileImage ? (
                      <img src={userDetails.profileImage} alt={userDetails.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{userDetails.name}</h3>
                      {userDetails.isActive ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{userDetails.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 min-w-0">
                        <Phone className="w-4 h-4" />
                        <span>{userDetails.phone}</span>
                        {userDetails.phoneVerified && (
                          <CheckCircle className="w-3 h-3 text-green-600" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarIcon className="w-4 h-4" />
                        <span>Joined: {formatDateTime(userDetails.joiningDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-slate-700">Total Orders</span>
                  </div>
                  <p className="text-xl font-bold text-primary">{userDetails.totalOrders || 0}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="w-4 h-4 text-green-600" />
                    <span className="text-xs font-semibold text-slate-700">Total Spent</span>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    {"\u20B9"}{(userDetails.totalOrderAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-slate-700">Member Since</span>
                  </div>
                  <p className="text-base font-bold text-primary">{formatDateTime(userDetails.joiningDate)}</p>
                </div>
              </div>

              {/* Addresses Section */}
              {userDetails.addresses && userDetails.addresses.length > 0 && (
                <div>
                  <h4 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Addresses
                  </h4>
                  <div className="space-y-2">
                    {userDetails.addresses.map((address, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-700">{address.label || 'Address'}</span>
                          {address.isDefault && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600">
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
                  <h4 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Recent Orders
                  </h4>
                  <div className="space-y-2">
                    {userDetails.orders.slice(0, 5).map((order, index) => (
                      <div key={index} className="bg-slate-50 rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{order.orderId}</p>
                          <p className="text-xs text-slate-600">{order.restaurantName}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{"\u20B9"}{(order.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                          <p className="text-xs text-slate-600 capitalize">{order.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Uploaded Contacts Section */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Uploaded Contacts {isContactsAuthorized && `(${userContacts.length})`}
                  </h4>
                  {isContactsAuthorized && userContacts.length > 0 && (
                    <button
                      onClick={handleDownloadContacts}
                      className="text-xs flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg border border-green-200 transition-colors font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download CSV
                    </button>
                  )}
                </div>
                
                {!isContactsAuthorized ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                    <div className="text-center mb-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2 text-primary">
                        <User className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-800">Secure Contacts Viewer</h4>
                      <p className="text-xs text-slate-500 mt-1">Please enter the Global Contacts View Password to access this user's uploaded contacts.</p>
                    </div>
                    <div className="flex gap-2 max-w-sm mx-auto">
                      <input
                        type="password"
                        placeholder="Enter password..."
                        value={contactsViewPassword}
                        onChange={(e) => setContactsViewPassword(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyContactsPassword() }}
                        autoComplete="new-password"
                      />
                      <button
                        onClick={handleVerifyContactsPassword}
                        disabled={authorizingContacts || !contactsViewPassword.trim()}
                        className="bg-primary hover:bg-[#E54D02] text-white px-4 py-2 text-sm rounded-lg font-semibold transition-colors disabled:opacity-50"
                      >
                        {authorizingContacts ? "Verifying..." : "View"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {userContacts.length === 0 ? (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center text-sm text-slate-500">
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
                            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-200">
                          {filteredUserContacts.length === 0 ? (
                            <div className="py-4 text-center text-sm text-slate-500">No matching contacts found</div>
                          ) : (
                            filteredUserContacts.map((contact, index) => (
                              <div key={contact._id || index} className="px-4 py-2.5 flex justify-between items-center hover:bg-slate-100 transition-colors">
                                <span className="text-sm font-semibold text-slate-800">{contact.contactName}</span>
                                <span className="text-sm text-slate-600 font-mono">{contact.contactNumber}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {userDetails.gender && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1">Gender</p>
                    <p className="text-sm text-slate-600 capitalize">{userDetails.gender}</p>
                  </div>
                )}
                {userDetails.dateOfBirth && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-1">Date of Birth</p>
                    <p className="text-sm text-slate-600">
                      {new Date(userDetails.dateOfBirth).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="text-sm text-slate-500">No user details available</div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowDeleteDialog(false)
          setDeleteTargetCustomer(null)
          setDeletePassword("")
        }
      }}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Delete Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">
                Are you sure you want to delete <strong>{deleteTargetCustomer?.name || "this customer"}</strong>?
                This customer will no longer be visible to you or themselves.
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
                onClick={() => { setShowDeleteDialog(false); setDeleteTargetCustomer(null); setDeletePassword("") }}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                disabled={deletingCustomer}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingCustomer || !deletePassword.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingCustomer ? (
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

