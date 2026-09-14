import { X } from "lucide-react"

// Stable empty defaults — prevent new [] reference per render
const EMPTY_ARRAY = []

export default function FilterPanel({ 
  isOpen, 
  onClose, 
  filters, 
  setFilters, 
  onApply, 
  onReset, 
  restaurants = EMPTY_ARRAY, 
  statuses = EMPTY_ARRAY,
  hidePaymentStatus = false,
  hideDeliveryType = false
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Filter Orders</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Order Status Filter - Only shown if statuses are provided */}
          {statuses.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Order Status
              </label>
              <div className="flex flex-wrap gap-2">
                {["All", ...statuses].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilters(prev => ({ ...prev, status: status === "All" ? "" : status }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filters.status === status || (status === "All" && !filters.status)
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Payment Status Filter */}
          {!hidePaymentStatus && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Payment Status
              </label>
              <div className="flex flex-wrap gap-2">
                {["All", "Paid", "Pending", "Failed", "Refunded", "Processing"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilters(prev => ({ ...prev, paymentStatus: status === "All" ? "" : status }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.paymentStatus === status || (status === "All" && !filters.paymentStatus)
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery Type Filter */}
          {!hideDeliveryType && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Delivery Type
              </label>
              <div className="flex flex-wrap gap-2">
                {["All", "Home Delivery", "Take Away", "Dine In"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilters(prev => ({ ...prev, deliveryType: type === "All" ? "" : type }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filters.deliveryType === type || (type === "All" && !filters.deliveryType)
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Food Quick Delivery mode (deliveryMode) — distinct from QC orderType */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Food Delivery Mode
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "", label: "All" },
                { key: "basic", label: "Basic" },
                { key: "quick", label: "Quick" },
                { key: "sla_breached", label: "Quick SLA Breach" },
              ].map((opt) => (
                <button
                  key={opt.key || "all-mode"}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, deliveryMode: opt.key }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    (filters.deliveryMode || "") === opt.key
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Min Amount
              </label>
              <input
                type="number"
                value={filters.minAmount || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Max Amount
              </label>
              <input
                type="number"
                value={filters.maxAmount || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                placeholder="10000"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.fromDate || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.toDate || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Restaurant Filter */}
          {restaurants.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Restaurant
              </label>
              <select
                value={filters.restaurant || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Restaurants</option>
                {restaurants.map((rest) => (
                  <option key={rest} value={rest}>{rest}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
          >
            Reset
          </button>
          <button
            onClick={onApply}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  )
}
