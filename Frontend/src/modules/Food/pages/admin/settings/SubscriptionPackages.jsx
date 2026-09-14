import { useState, useMemo } from "react";
import { Search, Download, Plus, Eye, Edit3, ChevronDown, Settings, ArrowUpDown, FileText, FileSpreadsheet, Code, Check, Columns } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const initialPackages = [
  { id: 1, name: "Pro", price: "$ 1,199.00", duration: "365 Days", subscribers: 0, active: true },
  { id: 2, name: "Standard", price: "$ 799.00", duration: "180 Days", subscribers: 0, active: true },
  { id: 3, name: "Basic", price: "$ 399.00", duration: "120 Days", subscribers: 0, active: true },
];

export default function SubscriptionPackages() {
  const [packages, setPackages] = useState(initialPackages);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    name: true,
    pricing: true,
    duration: true,
    subscribers: true,
    status: true,
    actions: true,
  });

  const filtered = useMemo(() => {
    return packages.filter((pkg) =>
      pkg.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [packages, searchQuery]);

  const handleExport = (format) => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }
    debugLog(`Exporting as ${format}`, filtered);
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      name: true,
      pricing: true,
      duration: true,
      subscribers: true,
      status: true,
      actions: true,
    });
  };

  const columnsConfig = {
    si: "Serial Number",
    name: "Package Name",
    pricing: "Pricing",
    duration: "Duration",
    subscribers: "Current Subscriber",
    status: "Status",
    actions: "Actions",
  };

  const toggleStatus = (id) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span role="img" aria-label="subscription">
            ??
          </span>
          <span>Subscription Package List</span>
          <span className="inline-flex items-center justify-center text-[11px] font-semibold rounded-full bg-slate-100 text-slate-700 px-2 py-0.5">
            3
          </span>
        </h1>
      </div>

      {/* Overview section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
            <p className="text-xs text-slate-500 mt-1">
              See overview of all the packages earnings
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {["All", "This Year", "This Month", "This Week"].map((label) => {
              const active = activeFilter === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActiveFilter(label)}
                  className={`px-3 py-1 rounded-full font-semibold border text-xs transition-all ${
                    active
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-4">
          <OverviewCard
            title="Basic"
            amount="$ 399.00"
            previous="$ 399.00"
            bgColor="bg-sky-50"
          />
          <OverviewCard
            title="Standard"
            amount="$ 1,598.00"
            previous="$ 1,598.00"
            bgColor="bg-amber-50"
          />
          <OverviewCard
            title="Pro"
            amount="$ 3,597.00"
            previous="$ 3,597.00"
            bgColor="bg-sky-50"
          />
        </div>
      </div>

      {/* Search + actions */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
        <div className="px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 md:flex-none">
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search by name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                  <Download className="w-4 h-4" />
                  <span className="text-black font-bold">Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
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
                <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                  <Code className="w-4 h-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md">
              <Plus className="w-4 h-4" />
              <span>Add Subscription Package</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {visibleColumns.si && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>SI</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.name && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Package Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.pricing && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Pricing</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.duration && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Duration</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.subscribers && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Current Subscriber</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.actions && (
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                    No subscription packages found
                  </td>
                </tr>
              ) : (
                filtered.map((pkg, index) => (
                  <tr key={pkg.id} className="hover:bg-slate-50 transition-colors">
                    {visibleColumns.si && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                      </td>
                    )}
                    {visibleColumns.name && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{pkg.name}</span>
                      </td>
                    )}
                    {visibleColumns.pricing && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{pkg.price}</span>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{pkg.duration}</span>
                      </td>
                    )}
                    {visibleColumns.subscribers && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{pkg.subscribers}</span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ToggleSwitch
                          enabled={pkg.active}
                          onToggle={() => toggleStatus(pkg.id)}
                        />
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Visible Columns
              </h3>
              <div className="space-y-2">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={resetColumns}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewCard({ title, amount, previous, bgColor }) {
  return (
    <div className={`${bgColor} rounded-xl px-6 py-5 flex flex-col items-center justify-between`}>
      <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-sm">
        <span role="img" aria-label={title} className="text-xl">
          ??
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-1">{title}</p>
      <p className="text-2xl font-bold text-sky-700 mb-1">{amount}</p>
      <p className="text-sm font-semibold line-through text-slate-400">
        {previous}
      </p>
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        enabled ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

