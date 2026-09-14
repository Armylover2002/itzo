import { useState, useMemo, useEffect } from "react"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import DispatchOrdersTable from "@food/components/admin/orders/DispatchOrdersTable"
import DispatchFilterPanel from "@food/components/admin/orders/DispatchFilterPanel"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function OngoingOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [visibleColumns, setVisibleColumns] = useState({
    sl: true,
    order: true,
    date: true,
    customer: true,
    restaurant: true,
    total: true,
    status: true,
    actions: true,
  })

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getOngoingOrders({
          search: debouncedSearchQuery || undefined,
          limit: 1000 // Get all orders
        })

        if (response?.data?.success && response.data.data?.orders) {
          setOrders(response.data.data.orders)
        } else {
          setOrders([])
          if (response?.data?.message) {
            toast.error(response.data.message)
          }
        }
      } catch (error) {
        debugError("Error fetching ongoing orders:", error)
        debugError("Error details:", {
          message: error.message,
          code: error.code,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          } : null,
          request: error.request ? {
            url: error.config?.url,
            method: error.config?.method,
            baseURL: error.config?.baseURL
          } : null
        })
        
        if (error.response) {
          const status = error.response.status
          const errorData = error.response.data
          
          if (status === 401) {
            toast.error('Authentication required. Please login again.')
          } else if (status === 403) {
            toast.error('Access denied. You do not have permission.')
          } else if (status === 404) {
            toast.error('Endpoint not found. Please check backend server.')
          } else if (status >= 500) {
            toast.error('Server error. Please try again later.')
          } else {
            toast.error(errorData?.message || `Error ${status}: Failed to fetch orders`)
          }
        } else if (error.request) {
          toast.error('Cannot connect to server. Please check if backend is running.')
        } else {
          toast.error(error.message || 'Failed to fetch orders')
        }
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [debouncedSearchQuery])

  const {
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    filteredData,
    count,
    activeFiltersCount,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
  } = useGenericTableManagement(
    orders,
    "On Going Orders",
    ["id", "customerName", "restaurant", "customerPhone"]
  )

  const resetColumns = () => {
    setVisibleColumns({
      sl: true,
      order: true,
      date: true,
      customer: true,
      restaurant: true,
      total: true,
      status: true,
      actions: true,
    })
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar 
        title="On Going Orders" 
        count={count} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <DispatchFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          sl: "Serial Number",
          order: "Order",
          date: "Date",
          customer: "Customer",
          restaurant: "Restaurant",
          total: "Total Amount",
          status: "Order Status",
          actions: "Actions",
        }}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      <DispatchOrdersTable 
        orders={filteredData} 
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
      />
    </div>
  )
}

