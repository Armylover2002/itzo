import { Download, RefreshCw, FileSpreadsheet } from "lucide-react"

export default function RestaurantsBulkExport() {
  const handleExport = () => {
    // Handle export logic here
    alert("Exporting all restaurant data...")
  }

  const handleReset = () => {
    // Reset logic if needed
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <Download className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Export Restaurants</h1>
            <p className="text-sm text-slate-500 mt-1">
              Export restaurant data in bulk using filters
            </p>
          </div>
        </div>
      </div>

      {/* Export Info */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
            1
          </div>
          <h2 className="text-xl font-bold text-slate-900">Export All Restaurant Data</h2>
        </div>
        <div className="ml-14">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>All restaurant data will be exported in Excel (.xlsx) format</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={handleReset}
          className="px-6 py-2.5 text-sm font-medium rounded-lg bg-slate-600 text-white hover:bg-slate-700 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reset
        </button>
        <button
          onClick={handleExport}
          className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2 shadow-md"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
    </div>
  )
}
