import { useState, useMemo } from "react";
import { Search, Download, ChevronDown, Settings, ArrowUpDown, FileText, FileSpreadsheet, Code, Check, Columns, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";

import burgerIcon from "@food/assets/Dashboard-icons/image13.png";
import leafIcon from "@food/assets/Dashboard-icons/image14.png";
import chefIcon from "@food/assets/Dashboard-icons/image16.png";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const statsCards = [
  { id: 1, label: "Total Subscribed User", value: 3, bg: "bg-sky-50" },
  { id: 2, label: "Active Subscriptions", value: 0, bg: "bg-emerald-50" },
  { id: 3, label: "Expired Subscription", value: 3, bg: "bg-rose-50" },
  { id: 4, label: "Expiring Soon", value: 0, bg: "bg-amber-50" },
];

const restaurantRows = [
  {
    id: 1,
    name: "Tasty Lunch",
    icon: leafIcon,
    packageName: "Standard",
    price: "$ 799.00",
    expDate: "23 May 2023",
    subscriptionUsed: 1,
    isTrial: "No",
    isCancel: "No",
    status: "Expired",
  },
  {
    id: 2,
    name: "Cheese Burger",
    icon: burgerIcon,
    packageName: "Pro",
    price: "$ 1,199.00",
    expDate: "19 Oct 2025",
    subscriptionUsed: 2,
    isTrial: "No",
    isCancel: "No",
    status: "Expired",
  },
  {
    id: 3,
    name: "Cheesy Restaurant",
    icon: chefIcon,
    packageName: "Pro",
    price: "$ 1,199.00",
    expDate: "19 Oct 2025",
    subscriptionUsed: 1,
    isTrial: "No",
    isCancel: "No",
    status: "Expired",
  },
];

export default function SubscriberList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [zoneFilter] = useState("All Zones");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    restaurantInfo: true,
    packageName: true,
    price: true,
    expDate: true,
    subscriptionUsed: true,
    isTrial: true,
    isCancel: true,
    status: true,
    actions: true,
  });

  const filteredRows = useMemo(() => {
    return restaurantRows.filter((row) =>
      row.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [searchQuery]);

  const handleExport = (format) => {
    if (filteredRows.length === 0) {
      alert("No data to export");
      return;
    }
    debugLog(`Exporting as ${format}`, filteredRows);
  };

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      restaurantInfo: true,
      packageName: true,
      price: true,
      expDate: true,
      subscriptionUsed: true,
      isTrial: true,
      isCancel: true,
      status: true,
      actions: true,
    });
  };

  const columnsConfig = {
    si: "Serial Number",
    restaurantInfo: "Restaurant Info",
    packageName: "Current Package Name",
    price: "Package Price",
    expDate: "Exp Date",
    subscriptionUsed: "Total Subscription Used",
    isTrial: "Is Trial",
    isCancel: "Is Cancel",
    status: "Status",
    actions: "Actions",
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span role="img" aria-label="subscribed">
            ??
          </span>
          <span>Subscribed Restaurant List</span>
        </h1>

        <div className="relative">
          <select className="pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none">
            <option value="all-zones">{zoneFilter}</option>
          </select>
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
            ?
          </span>
        </div>
      </div>

      {/* Top stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        {statsCards.map((card) => (
          <div
            key={card.id}
            className={`${card.bg} rounded-lg px-5 py-4 flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-600">
                {card.label}
              </p>
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                <span className="text-lg">??</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Summary strip */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-4">
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
          <div className="flex-1 px-5 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-50 text-sky-600 text-lg">
                ?
              </span>
              <div>
                <p className="font-semibold">TOTAL TRANSACTIONS</p>
                <p className="text-[11px] text-slate-500">5</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-5 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 text-lg">
                ??
              </span>
              <div>
                <p className="font-semibold">TOTAL EARNING</p>
                <p className="text-[11px] text-emerald-600 font-semibold">
                  $ 4,795.00
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-5 py-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-600 text-lg">
                ??
              </span>
              <div>
                <p className="font-semibold">EARNED THIS MONTH</p>
                <p className="text-[11px] text-slate-500">$ 0.00</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant list card */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Restaurant List
            </h2>
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
              3
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="relative">
              <select className="pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none">
                <option>All</option>
              </select>
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                ?
              </span>
            </div>

            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Ex: Search by name & pack"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>

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
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
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
                {visibleColumns.restaurantInfo && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Restaurant Info</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.packageName && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Current Package Name</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.price && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Package Price</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.expDate && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Exp Date</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.subscriptionUsed && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Total Subscription Used</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.isTrial && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Is Trial</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                  </th>
                )}
                {visibleColumns.isCancel && (
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <span>Is Cancel</span>
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
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                    No subscribers found
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    {visibleColumns.si && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                      </td>
                    )}
                    {visibleColumns.restaurantInfo && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-200">
                            <img
                              src={row.icon}
                              alt={row.name}
                              className="w-8 h-8 object-contain"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold">
                              {row.name}
                            </span>
                            <span className="text-xs text-amber-500">
                              ? 0
                            </span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.packageName && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{row.packageName}</span>
                      </td>
                    )}
                    {visibleColumns.price && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{row.price}</span>
                      </td>
                    )}
                    {visibleColumns.expDate && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{row.expDate}</span>
                      </td>
                    )}
                    {visibleColumns.subscriptionUsed && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{row.subscriptionUsed}</span>
                      </td>
                    )}
                    {visibleColumns.isTrial && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill label={row.isTrial} variant="neutral" />
                      </td>
                    )}
                    {visibleColumns.isCancel && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill label={row.isCancel} variant="neutral" />
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusPill label={row.status} variant="danger" />
                      </td>
                    )}
                    {visibleColumns.actions && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
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

function StatusPill({ label, variant }) {
  if (variant === "danger") {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-rose-50 text-rose-500 text-[11px] font-semibold">
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-semibold">
      {label}
    </span>
  );
}

