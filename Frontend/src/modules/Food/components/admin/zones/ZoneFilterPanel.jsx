import { X } from "lucide-react"

export default function ZoneFilterPanel({ isOpen, onClose, filters, setFilters, onApply, onReset }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Filter Zones</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Status
            </label>
            <div className="flex flex-wrap gap-2">
              {["All", "Active", "Inactive"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilters(prev => ({ ...prev, status: status === "All" ? "" : status }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filters.status === status || (status === "All" && !filters.status)
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Default Status Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Default Status
            </label>
            <div className="flex flex-wrap gap-2">
              {["All", "Default", "Not Default"].map((defaultStatus) => (
                <button
                  key={defaultStatus}
                  onClick={() => setFilters(prev => ({ 
                    ...prev, 
                    isDefault: defaultStatus === "All" ? "" : defaultStatus === "Default" ? "yes" : "no"
                  }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    (filters.isDefault === (defaultStatus === "Default" ? "yes" : defaultStatus === "Not Default" ? "no" : "")) || 
                    (defaultStatus === "All" && !filters.isDefault)
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {defaultStatus}
                </button>
              ))}
            </div>
          </div>

          {/* Restaurants Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Min Restaurants
              </label>
              <input
                type="number"
                value={filters.minRestaurants || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, minRestaurants: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Max Restaurants
              </label>
              <input
                type="number"
                value={filters.maxRestaurants || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, maxRestaurants: e.target.value }))}
                placeholder="100"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Deliverymen Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Min Deliverymen
              </label>
              <input
                type="number"
                value={filters.minDeliverymen || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, minDeliverymen: e.target.value }))}
                placeholder="0"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Max Deliverymen
              </label>
              <input
                type="number"
                value={filters.maxDeliverymen || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, maxDeliverymen: e.target.value }))}
                placeholder="100"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
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

