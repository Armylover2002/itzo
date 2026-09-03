import { useState, useMemo, useEffect } from "react"
import { Users, ChevronDown, Search, Settings, Edit, Trash2, ArrowUpDown, Download, FileText, FileSpreadsheet, Code, Check, Columns, Plus, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import axiosInstance from "@food/api"
import { toast } from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

export default function EmployeeList() {
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [searchQuery, setSearchQuery] = useState("")
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [resolvedPermissions, setResolvedPermissions] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    name: true,
    phone: true,
    email: true,
    createdAt: true,
    actions: true,
  })

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees
    const query = searchQuery.toLowerCase().trim()
    return employees.filter(employee =>
      employee.name.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query)
    )
  }, [employees, searchQuery])

  const maskPhone = (phone) => {
    if (!phone) return ""
    if (phone.length > 2) {
      return phone.slice(0, 2) + "*".repeat(phone.length - 2)
    }
    return phone
  }

  const maskEmail = (email) => {
    if (!email) return ""
    const [localPart, domain] = email.split("@")
    if (localPart.length > 1) {
      const masked = localPart[0] + "*".repeat(localPart.length - 1)
      return `${masked}@${domain}`
    }
    return email
  }

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const res = await axiosInstance.get("/food/admin/employees")
      if (res.data.success) {
        setEmployees(res.data.data || [])
      }
    } catch (error) {
      toast.error("Failed to fetch employees")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

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

  const employeePermissionKey = "food::staff_management::list"
  const canCreateEmployee = canPerformAdminPermissionAction(currentUser, resolvedPermissions, employeePermissionKey, "create")
  const canEditEmployee = canPerformAdminPermissionAction(currentUser, resolvedPermissions, employeePermissionKey, "edit")
  const canDeleteEmployee = canPerformAdminPermissionAction(currentUser, resolvedPermissions, employeePermissionKey, "delete")

  const toggleStatus = async (id) => {
    if (!canEditEmployee) {
      toast.error("You do not have permission to update employee status")
      return
    }
    try {
      const res = await axiosInstance.patch(`/food/admin/employees/${id}/status`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchEmployees();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change status");
    }
  }

  const handleDelete = async (id) => {
    if (!canDeleteEmployee) {
      toast.error("You do not have permission to delete employees")
      return
    }
    if (window.confirm("Are you sure you want to delete this employee?")) {
      try {
        const res = await axiosInstance.delete(`/food/admin/employees/${id}`)
        if (res.data.success) {
          toast.success(res.data.message)
          fetchEmployees()
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to delete employee")
      }
    }
  }

  const handleExport = (format) => {
    if (filteredEmployees.length === 0) {
      alert("No data to export")
      return
    }
    debugLog(`Exporting as ${format}`, filteredEmployees)
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      name: true,
      phone: true,
      email: true,
      createdAt: true,
      actions: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    name: "Employee Name",
    phone: "Phone",
    email: "User Id",
    createdAt: "Created At",
    actions: "Actions",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#6412c6] flex items-center justify-center shadow-lg shadow-[#6412c6]/20">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Employee List</h1>
                <p className="text-xs text-slate-500 mt-0.5">Manage your administrative staff and roles.</p>
              </div>
            </div>
            {canCreateEmployee && (
              <button
                onClick={() => navigate("/ecs/food/employees/add")}
                className="flex items-center gap-2 bg-[#6412c6] hover:bg-[#550fa8] text-white px-6 py-2.5 rounded-lg font-semibold shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                ADD NEW EMPLOYEE
              </button>
            )}
          </div>
        </div>

        {/* Employee List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-slate-600" />
              <h2 className="text-xl font-bold text-slate-900">Employee List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredEmployees.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search by name or email"
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
                  {visibleColumns.name && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Employee Name</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.phone && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Phone</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.email && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>User Id</span>
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
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  {visibleColumns.actions && (
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                      No employees found
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <tr
                      key={employee._id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {visibleColumns.si && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                        </td>
                      )}
                      {visibleColumns.name && (
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-slate-900">{employee.name}</span>
                        </td>
                      )}
                      {visibleColumns.phone && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{maskPhone(employee.phone)}</span>
                        </td>
                      )}
                      {visibleColumns.email && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{maskEmail(employee.email)}</span>
                        </td>
                      )}
                      {visibleColumns.createdAt && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-700">
                            {new Date(employee.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleStatus(employee._id)}
                          disabled={!canEditEmployee}
                          className={`w-10 h-5 rounded-full relative transition-colors ${employee.isActive ? 'bg-[#6412c6]' : 'bg-slate-300'}`}
                          title={employee.isActive ? "Active" : "Inactive"}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${employee.isActive ? 'translate-x-5' : ''}`} />
                        </button>
                      </td>
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedEmployee(employee)
                                setIsViewModalOpen(true)
                              }}
                              className="p-1.5 rounded text-[#6412c6] hover:bg-[#f7f3fc] transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEditEmployee && (
                              <button
                                onClick={() => navigate(`/ecs/food/employees/edit/${employee._id}`, { state: { employee } })}
                                className="p-1.5 rounded text-[#6412c6] hover:bg-[#f7f3fc] transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteEmployee && (
                              <button
                                onClick={() => handleDelete(employee._id)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#6412c6]" />
              Employee Details
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            {selectedEmployee && (
              <>
                <div className="flex items-center justify-center mb-6">
                  {selectedEmployee.profileImage ? (
                    <img src={selectedEmployee.profileImage} alt={selectedEmployee.name} className="w-24 h-24 rounded-full object-cover border-4 border-slate-50" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-[#f0e7f9] flex items-center justify-center border-4 border-white shadow-sm">
                      <span className="text-3xl font-bold text-[#6412c6]">
                        {selectedEmployee.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-slate-500 font-medium">Name:</div>
                  <div className="text-slate-900 font-semibold">{selectedEmployee.name}</div>
                  
                  <div className="text-slate-500 font-medium">User Id:</div>
                  <div className="text-slate-900">{selectedEmployee.email}</div>
                  
                  <div className="text-slate-500 font-medium">Phone:</div>
                  <div className="text-slate-900">{selectedEmployee.phone}</div>
                  
                  <div className="text-slate-500 font-medium">Role:</div>
                  <div className="text-slate-900 capitalize bg-[#f7f3fc] text-[#550fa8] px-2 py-0.5 rounded inline-block w-max">
                    {selectedEmployee.adminRoleId?.roleName || selectedEmployee.role}
                  </div>
                  
                  <div className="text-slate-500 font-medium">Zone:</div>
                  <div className="text-slate-900">{selectedEmployee.zoneId?.name || "Global / All Zones"}</div>
                  
                  <div className="text-slate-500 font-medium">Status:</div>
                  <div className={`font-semibold ${selectedEmployee.isActive ? 'text-[#6412c6]' : 'text-red-500'}`}>
                    {selectedEmployee.isActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end">
            <button 
              onClick={() => setIsViewModalOpen(false)}
              className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
                      className="w-4 h-4 text-[#6412c6] border-slate-300 rounded focus:ring-[#6412c6]"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-[#6412c6] ml-auto" />
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
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md"
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

