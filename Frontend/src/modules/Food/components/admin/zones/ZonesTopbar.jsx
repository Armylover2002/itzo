import { Search, Filter, Download, ChevronDown, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"
import { FileSpreadsheet, FileDown, FileText, Code } from "lucide-react"

export default function ZonesTopbar({
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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            {title}
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {count}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-initial min-w-[180px]">
            <input
              type="text"
              placeholder="Search by name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1.5 w-full text-[11px] rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100">
              <Search className="w-3 h-3 text-slate-400" />
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 transition-all">
                <Download className="w-3 h-3" />
                <span>Export</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExport("csv")} className="cursor-pointer">
                <FileDown className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("excel")} className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("pdf")} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("json")} className="cursor-pointer">
                <Code className="w-4 h-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button 
            onClick={onFilterClick}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition-all relative ${
              activeFiltersCount > 0 ? "border-emerald-500 bg-emerald-50" : ""
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button 
            onClick={onSettingsClick}
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

