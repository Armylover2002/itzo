import { useState, useMemo, useEffect } from "react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import OrdersTable from "@food/components/admin/orders/OrdersTable"
import FilterPanel from "@food/components/admin/orders/FilterPanel"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import { useGenericTableManagement } from "@food/components/admin/orders/useGenericTableManagement"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function NewRefundRequests() {
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

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::transaction_management::refunds", "edit")
  }, [currentUser, resolvedPermissions])
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [processingRefund, setProcessingRefund] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    orderDate: true,
    customer: true,
    restaurant: true,
    totalAmount: true,
    orderStatus: true,
    actions: true,
  })

  // Fetch refund requests from backend
  useEffect(() => {
    const fetchRefundRequests = async () => {
      try {
        setIsLoading(true)
        const params = {
          page: 1,
          limit: 1000,
        }
        
        const response = await adminAPI.getRefundRequests(params)
        
        if (response.data?.success && response.data?.data?.orders) {
          setOrders(response.data.data.orders)
          setTotalCount(response.data.data.pagination?.total || response.data.data.orders.length)
        } else {
          debugError("Failed to fetch refund requests:", response.data)
          toast.error("Failed to fetch refund requests")
          setOrders([])
        }
      } catch (error) {
        debugError("Error fetching refund requests:", error)
        debugError("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText
        })
        toast.error(error.response?.data?.message || error.message || "Failed to fetch refund requests")
        setOrders([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchRefundRequests()
  }, [])

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
    orders,
    "New Refund Requests",
    ["orderId", "customerName", "restaurant", "customerPhone"]
  )

  const restaurants = useMemo(() => {
    return [...new Set(orders.map(o => o.restaurant))]
  }, [orders])

  // Handle refund processing
  const handleProcessRefund = async (order) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!confirm(`Are you sure you want to process refund for order ${order.orderId}?`)) {
      return
    }

    try {
      setProcessingRefund(order.id)
      const response = await adminAPI.processRefund(order.id, {})
      
      if (response.data?.success) {
        toast.success(`Refund processed successfully for order ${order.orderId}`)
        // Refresh the list
        const params = { page: 1, limit: 1000 }
        const refreshResponse = await adminAPI.getRefundRequests(params)
        if (refreshResponse.data?.success && refreshResponse.data?.data?.orders) {
          setOrders(refreshResponse.data.data.orders)
          setTotalCount(refreshResponse.data.data.pagination?.total || refreshResponse.data.data.orders.length)
        }
      } else {
        toast.error(response.data?.message || "Failed to process refund")
      }
    } catch (error) {
      debugError("Error processing refund:", error)
      toast.error(error.response?.data?.message || "Failed to process refund")
    } finally {
      setProcessingRefund(null)
    }
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      orderDate: true,
      customer: true,
      restaurant: true,
      totalAmount: true,
      orderStatus: true,
      actions: true,
    })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <OrdersTopbar 
        title="Requested Orders" 
        count={count} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      <FilterPanel
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
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-20">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-500 mb-4" />
            <p className="text-sm text-slate-600">Loading refund requests...</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Order ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Order Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Customer</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Restaurant</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 uppercase">Total Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Cancellation Reason</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase">Refund Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center">
                      <p className="text-sm text-slate-500">No refund requests found</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((order, index) => (
                    <tr key={order.orderId} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">{order.orderId}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{order.date}, {order.time}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{order.customerName}</span>
                          <span className="text-xs text-slate-500 mt-0.5">{order.customerPhone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{order.restaurant}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-slate-900">
                          {"\u20B9"}{order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-emerald-600 mt-0.5">{order.paymentStatus}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-red-600 max-w-xs">
                          {order.cancellationReason || "Rejected by restaurant"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          order.refundStatus === 'processed' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {order.refundStatus === 'processed' ? 'Processed' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleViewOrder(order)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="View Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          {order.refundStatus !== 'processed' && canEdit && (
                            <button 
                              onClick={() => handleProcessRefund(order)}
                              disabled={processingRefund === order.id}
                              className="p-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                              title="Process Refund"
                            >
                              {processingRefund === order.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <span className="text-sm">?</span>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

