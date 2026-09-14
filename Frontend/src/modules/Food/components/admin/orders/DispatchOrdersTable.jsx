import { useState, useEffect, useMemo } from "react"
import { Eye, Printer, ArrowUpDown } from "lucide-react"

export default function DispatchOrdersTable({ orders, visibleColumns, onViewOrder, onPrintOrder }) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(orders.length / itemsPerPage)
  
  useEffect(() => {
    setCurrentPage(1)
  }, [orders.length])
  
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return orders.slice(start, end)
  }, [orders, currentPage])

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-5xl text-red-500 font-bold">!</span>
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
          <p className="text-sm text-slate-500">There are no orders matching your criteria</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {visibleColumns.sl && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Sl</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.order && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.date && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.customer && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Customer</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.restaurant && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Restaurant</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.total && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Total Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.status && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.actions && (
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {paginatedOrders.map((order, index) => (
              <tr 
                key={order.id || order.orderId} 
                className="hover:bg-slate-50 transition-colors"
              >
                {visibleColumns.sl && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{order.sl || (currentPage - 1) * itemsPerPage + index + 1}</span>
                  </td>
                )}
                {visibleColumns.order && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-900">{order.id || order.orderId}</span>
                  </td>
                )}
                {visibleColumns.date && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-700">{order.date}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{order.time}</div>
                  </td>
                )}
                {visibleColumns.customer && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{order.customerName}</span>
                      <span className="text-xs text-slate-500 mt-0.5">{order.customerPhone}</span>
                    </div>
                  </td>
                )}
                {visibleColumns.restaurant && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{order.restaurant}</span>
                  </td>
                )}
                {visibleColumns.total && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{order.total || `$ ${order.totalAmount?.toFixed(2) || '0.00'}`}</div>
                    {order.paymentStatus && (
                      <div className={`text-xs mt-0.5 ${
                        order.paymentStatus === "Paid" ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {order.paymentStatus}
                      </div>
                    )}
                  </td>
                )}
                {visibleColumns.status && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      order.orderStatusColor || "bg-slate-100 text-slate-700"
                    }`}>
                      {order.orderStatus}
                    </span>
                    {order.deliveryType && (
                      <div className="text-xs text-slate-500 mt-1">{order.deliveryType}</div>
                    )}
                  </td>
                )}
                {visibleColumns.actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onViewOrder(order)}
                        className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onPrintOrder(order)}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Print Order"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-semibold">{Math.min(currentPage * itemsPerPage, orders.length)}</span> of{" "}
            <span className="font-semibold">{orders.length}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      currentPage === pageNum
                        ? "bg-emerald-500 text-white shadow-md"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

