import { useMemo, useState } from "react"
import { Package, Calendar, CheckCircle } from "lucide-react"
import { emptySubscriptionOrders } from "@food/utils/adminFallbackData"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import SubscriptionOrdersTable from "@food/components/admin/orders/SubscriptionOrdersTable"
import SubscriptionFilterPanel from "@food/components/admin/orders/SubscriptionFilterPanel"
import ViewSubscriptionDialog from "@food/components/admin/orders/ViewSubscriptionDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"

export default function SubscriptionOrders() {
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    subscriptionId: true,
    orderType: true,
    duration: true,
    restaurant: true,
    customer: true,
    status: true,
    actions: true,
  })

  const {
    searchQuery,
    setSearchQuery,
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
    emptySubscriptionOrders,
    "Subscription Orders",
    ["subscriptionId", "customerName", "restaurant", "customerPhone"]
  )

  const restaurants = useMemo(() => {
    return [...new Set(emptySubscriptionOrders.map(o => o.restaurant))]
  }, [])

  // Statistics
  const stats = useMemo(() => {
    const total = emptySubscriptionOrders.length
    const expired = emptySubscriptionOrders.filter(o => o.status === "Expired").length
    const active = emptySubscriptionOrders.filter(o => o.status === "Active").length
    const totalDelivered = emptySubscriptionOrders.reduce((sum, o) => sum + o.delivered, 0)
    return { total, expired, active, totalDelivered }
  }, [])

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      subscriptionId: true,
      orderType: true,
      duration: true,
      restaurant: true,
      customer: true,
      status: true,
      actions: true,
    })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar 
        title="Subscription Orders" 
        count={count} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Subscriptions</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Active</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Expired</p>
              <p className="text-2xl font-bold text-blue-600">{stats.expired}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Delivered</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalDelivered}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <Package className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <SubscriptionFilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={restaurants}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          si: "Serial Number",
          subscriptionId: "Subscription ID",
          orderType: "Order Type",
          duration: "Duration",
          restaurant: "Restaurant",
          customer: "Customer",
          status: "Status",
          actions: "Actions",
        }}
      />
      <ViewSubscriptionDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      <SubscriptionOrdersTable 
        orders={filteredData} 
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
      />
    </div>
  )
}
