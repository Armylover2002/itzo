import { useState, useMemo } from "react"
import { UserCog, ChevronDown, ArrowUpDown, Trash2, Search, Download, Edit, Settings, FileText, FileSpreadsheet, Code, Check, Columns } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const modulePermissions = [
  // Column 1
  { id: "collectCash", label: "Collect cash" },
  { id: "category", label: "Category" },
  { id: "deliveryman", label: "Deliveryman" },
  { id: "pushNotification", label: "Push notification" },
  { id: "businessSettings", label: "Business settings" },
  { id: "contactMessages", label: "Contact messages" },
  { id: "chat", label: "Chat" },
  // Column 2
  { id: "addon", label: "Addon" },
  { id: "coupon", label: "Coupon" },
  { id: "deliverymenEarning", label: "Deliverymen earning provide" },
  { id: "order", label: "Order" },
  { id: "restaurantWithdraws", label: "Restaurant withdraws" },
  { id: "disbursement", label: "Disbursement" },
  // Column 3
  { id: "banner", label: "Banner" },
  { id: "customersSection", label: "Customers section" },
  { id: "employee", label: "Employee" },
  { id: "restaurants", label: "Restaurants" },
  { id: "posSystem", label: "Pos system" },
  { id: "advertisement", label: "Advertisement" },
  // Column 4
  { id: "campaign", label: "Campaign" },
  { id: "customerWallet", label: "Customer Wallet" },
  { id: "food", label: "Food" },
  { id: "report", label: "Report" },
  { id: "zone", label: "Zone" },
  { id: "cashback", label: "Cashback" },
]

const initialEmployeeRoles = [
  {
    id: 1,
    roleName: "Manager",
    modules: ["Addon", "Banner", "Campaign", "Category", "Coupon", "Custom Role", "CustomerList", "Deliveryman", "Employee", "Food", "Notification", "Order", "Report", "Settings", "Pos", "Contact Message"],
    createdAt: "07 Feb 2023",
  },
  {
    id: 2,
    roleName: "Customer Care Executive",
    modules: ["CustomerList", "Deliveryman", "Order", "Restaurant"],
    createdAt: "22 Aug 2021",
  },
]

export default function EmployeeRole() {
  const [activeLanguage, setActiveLanguage] = useState("default")
  const [roleName, setRoleName] = useState("")
  const [permissions, setPermissions] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [roles, setRoles] = useState(initialEmployeeRoles)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    roleName: true,
    modules: true,
    createdAt: true,
    actions: true,
  })

  const languageTabs = [
    { key: "default", label: "Default" },
    { key: "en", label: "English(EN)" },
    { key: "bn", label: "Bengali - বাংলা(BN)" },
    { key: "ar", label: "Arabic - العربية(AR)" },
    { key: "es", label: "Spanish - espa�ol(ES)" },
  ]

  const handlePermissionChange = (permissionId, checked) => {
    setPermissions(prev => ({
      ...prev,
      [permissionId]: checked
    }))
  }

  const handleSelectAll = (checked) => {
    const allPermissions = {}
    modulePermissions.forEach(permission => {
      allPermissions[permission.id] = checked
    })
    setPermissions(allPermissions)
  }

  const allSelected = useMemo(() => {
    return modulePermissions.every(permission => permissions[permission.id])
  }, [permissions])

  const handleSubmit = (e) => {
    e.preventDefault()
    debugLog("Form submitted:", { roleName, permissions })
    alert("Employee role created successfully!")
  }

  const handleReset = () => {
    setRoleName("")
    setPermissions({})
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this role?")) {
      setRoles(roles.filter(role => role.id !== id))
    }
  }

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles
    const query = searchQuery.toLowerCase().trim()
    return roles.filter(role =>
      role.roleName.toLowerCase().includes(query)
    )
  }, [roles, searchQuery])

  const handleExport = (format) => {
    if (filteredRoles.length === 0) {
      alert("No data to export")
      return
    }
    debugLog(`Exporting as ${format}`, filteredRoles)
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      roleName: true,
      modules: true,
      createdAt: true,
      actions: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    roleName: "Role Name",
    modules: "Modules",
    createdAt: "Created At",
    actions: "Actions",
  }

  // Split permissions into 4 columns
  const column1 = modulePermissions.slice(0, 7)
  const column2 = modulePermissions.slice(7, 13)
  const column3 = modulePermissions.slice(13, 19)
  const column4 = modulePermissions.slice(19, 26)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Employee Role</h1>
          </div>

          {/* Language Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            {languageTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveLanguage(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeLanguage === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Role Name Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Role Name ({activeLanguage === "default" ? "Default" : languageTabs.find(t => t.key === activeLanguage)?.label})
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="Role name example"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Module Permission Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-4">
                Module Permission :
              </label>
              <div className="flex items-center mb-6">
                <input
                  type="checkbox"
                  id="selectAll"
                  checked={allSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="selectAll" className="ml-2 text-sm font-semibold text-slate-700">
                  Select All
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Column 1 */}
              <div className="space-y-3">
                {column1.map((permission) => (
                  <div key={permission.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={permission.id}
                      checked={permissions[permission.id] || false}
                      onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={permission.id} className="ml-2 text-sm text-slate-700">
                      {permission.label}
                    </label>
                  </div>
                ))}
              </div>

              {/* Column 2 */}
              <div className="space-y-3">
                {column2.map((permission) => (
                  <div key={permission.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={permission.id}
                      checked={permissions[permission.id] || false}
                      onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={permission.id} className="ml-2 text-sm text-slate-700">
                      {permission.label}
                    </label>
                  </div>
                ))}
              </div>

              {/* Column 3 */}
              <div className="space-y-3">
                {column3.map((permission) => (
                  <div key={permission.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={permission.id}
                      checked={permissions[permission.id] || false}
                      onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={permission.id} className="ml-2 text-sm text-slate-700">
                      {permission.label}
                    </label>
                  </div>
                ))}
              </div>

              {/* Column 4 */}
              <div className="space-y-3">
                {column4.map((permission) => (
                  <div key={permission.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={permission.id}
                      checked={permissions[permission.id] || false}
                      onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={permission.id} className="ml-2 text-sm text-slate-700">
                      {permission.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 mb-6">
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Reset
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md"
            >
              Submit
            </button>
          </div>
        </form>

        {/* Employee Role Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Employee Role Table</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredRoles.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by Name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
            <table className="w-full">
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
                  {visibleColumns.roleName && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Role Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.modules && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Modules</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.createdAt && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Created At</span>
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
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                      No roles found
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role, index) => (
                    <tr
                      key={role.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {visibleColumns.si && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                        </td>
                      )}
                      {visibleColumns.roleName && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-900">{role.roleName}</span>
                        </td>
                      )}
                      {visibleColumns.modules && (
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {role.modules.map((module, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                              >
                                {module}
                              </span>
                            ))}
                          </div>
                        </td>
                      )}
                      {visibleColumns.createdAt && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{role.createdAt}</span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(role.id)}
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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
  )
}

