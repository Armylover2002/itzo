import { useState, useMemo, useEffect } from "react"
import { Search, Wallet, Info, Calendar, Edit, Trash2 } from "lucide-react"
import { emptyWalletBonuses } from "@food/utils/adminFallbackData"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function Bonus() {
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

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

  const canCreate = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::customer_management::wallet_updates", "create")
  }, [currentUser, resolvedPermissions])

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::customer_management::wallet_updates", "edit")
  }, [currentUser, resolvedPermissions])

  const canDelete = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::customer_management::wallet_updates", "delete")
  }, [currentUser, resolvedPermissions])
  const [activeLanguage, setActiveLanguage] = useState("default")
  const [searchQuery, setSearchQuery] = useState("")
  const [bonuses, setBonuses] = useState(emptyWalletBonuses)
  const [formData, setFormData] = useState({
    bonusTitle: "",
    shortDescription: "",
    bonusType: "Percentage (%)",
    bonusAmount: "",
    minAddMoney: "",
    maxBonus: "",
    startDate: "",
    expireDate: "",
  })

  const languageTabs = [
    { key: "default", label: "Default" },
    { key: "en", label: "English(EN)" },
    { key: "bn", label: "Bengali - à¦¬à¦¾à¦à¦²à¦¾(BN)" },
    { key: "ar", label: "Arabic - Ø§ÙØ¹Ø±Ø¨ÙØ© (AR)" },
    { key: "es", label: "Spanish - español(ES)" },
  ]

  const filteredBonuses = useMemo(() => {
    if (!searchQuery.trim()) {
      return bonuses
    }
    
    const query = searchQuery.toLowerCase().trim()
    return bonuses.filter(bonus =>
      bonus.bonusTitle.toLowerCase().includes(query)
    )
  }, [bonuses, searchQuery])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canCreate) {
      toast.error("Permission denied")
      return
    }
    debugLog("Form submitted:", formData)
    alert("Bonus setup saved successfully!")
  }

  const handleReset = () => {
    setFormData({
      bonusTitle: "",
      shortDescription: "",
      bonusType: "Percentage (%)",
      bonusAmount: "",
      minAddMoney: "",
      maxBonus: "",
      startDate: "",
      expireDate: "",
    })
  }

  const handleToggleStatus = (sl) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    setBonuses(bonuses.map(bonus =>
      bonus.sl === sl ? { ...bonus, status: !bonus.status } : bonus
    ))
  }

  const handleDelete = (sl) => {
    if (!canDelete) {
      toast.error("Permission denied")
      return
    }
    if (window.confirm("Are you sure you want to delete this bonus?")) {
      setBonuses(bonuses.filter(bonus => bonus.sl !== sl))
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Bonus Setup Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Wallet Bonus Setup</h1>
          </div>

          {/* Language Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
            {languageTabs.map((tab) => (
              <button
                key={tab.key}
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

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Bonus Title ({activeLanguage === "default" ? "Default" : languageTabs.find(t => t.key === activeLanguage)?.label})
                </label>
                <input
                  type="text"
                  value={formData.bonusTitle}
                  onChange={(e) => handleInputChange("bonusTitle", e.target.value)}
                  placeholder="Ex: EID Dhamaka"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Short Description ({activeLanguage === "default" ? "Default" : languageTabs.find(t => t.key === activeLanguage)?.label})
                </label>
                <input
                  type="text"
                  value={formData.shortDescription}
                  onChange={(e) => handleInputChange("shortDescription", e.target.value)}
                  placeholder="Ex: EID Dhamaka"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Bonus Type
                </label>
                <select
                  value={formData.bonusType}
                  onChange={(e) => handleInputChange("bonusType", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="Percentage (%)">Percentage (%)</option>
                  <option value="Amount ($)">Amount ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <span>Bonus Amount ({formData.bonusType === "Percentage (%)" ? "%" : "$"})</span>
                    <Info className="w-4 h-4 text-slate-400" />
                  </div>
                </label>
                <input
                  type="number"
                  value={formData.bonusAmount}
                  onChange={(e) => handleInputChange("bonusAmount", e.target.value)}
                  placeholder="Ex: 100"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <span>Minimum Add Money Amount ($)</span>
                    <Info className="w-4 h-4 text-slate-400" />
                  </div>
                </label>
                <input
                  type="number"
                  value={formData.minAddMoney}
                  onChange={(e) => handleInputChange("minAddMoney", e.target.value)}
                  placeholder="Ex: 10"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <div className="flex items-center gap-2">
                    <span>Maximum Bonus ($)</span>
                    <Info className="w-4 h-4 text-slate-400" />
                  </div>
                </label>
                <input
                  type="number"
                  value={formData.maxBonus}
                  onChange={(e) => handleInputChange("maxBonus", e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Start Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleInputChange("startDate", e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Expire Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={formData.expireDate}
                    onChange={(e) => handleInputChange("expireDate", e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 mt-6">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!canCreate}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          </form>
        </div>

        {/* Bonus List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Bonus List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredBonuses.length}
              </span>
            </div>

            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <input
                type="text"
                placeholder="Ex: Search by bonus title"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus Title</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus Info</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Bonus Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Started On</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Expires On</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredBonuses.map((bonus) => (
                  <tr key={bonus.sl} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{bonus.sl}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{bonus.bonusTitle}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">{bonus.bonusInfo}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">{bonus.bonusAmount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{bonus.startedOn}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{bonus.expiresOn}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(bonus.sl)}
                        disabled={!canEdit}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          bonus.status ? "bg-blue-600" : "bg-slate-300"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            bonus.status ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canEdit && (
                          <button
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(bonus.sl)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

