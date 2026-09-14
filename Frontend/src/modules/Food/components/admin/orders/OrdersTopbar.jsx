import { Search, Filter, Download, ChevronDown, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
import { FileSpreadsheet, FileText } from "lucide-react"

export default function OrdersTopbar({
  title,
  count,
  searchQuery,
  setSearchQuery,
  onFilterClick,
  activeFiltersCount,
  onExport,
  onSettingsClick,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            {title}
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {count}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search your order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-4 pr-12 py-2.5 w-full sm:w-80 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400 transition-all"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-slate-100">
              <Search className="w-4 h-4 text-slate-500" />
            </button>
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
              <DropdownMenuItem onClick={() => onExport("excel")} className="cursor-pointer">
                <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center mr-3">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                </div>
                <span>Excel</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("pdf")} className="cursor-pointer">
                <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center mr-3">
                  <FileText className="w-4 h-4 text-red-600" />
                </div>
                <span>PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button 
            onClick={onFilterClick}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all relative ${
              activeFiltersCount > 0 ? "border-emerald-500 bg-emerald-50" : ""
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-black font-bold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button 
            onClick={onSettingsClick}
            className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

