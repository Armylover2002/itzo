import React, { useState, useEffect } from "react"
import { AlertCircle, RotateCcw, Search, Trash2, ShieldAlert } from "lucide-react"
import { adminAPI } from "@food/api"
import { toast } from "sonner"

export default function DeletedAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [actionLoading, setActionLoading] = useState(null) // ID of account currently being reactivated

  useEffect(() => {
    fetchDeletedAccounts()
  }, [])

  const fetchDeletedAccounts = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeletedAccounts()
      if (response?.data?.success && response?.data?.data) {
        setAccounts(response.data.data)
      }
    } catch (error) {
      toast.error("Failed to fetch deleted accounts")
    } finally {
      setLoading(false)
    }
  }

  const handleReactivate = async (account) => {
    const confirmMsg = `Are you sure you want to reactivate the ${account.role} account for "${account.name}"?`
    if (!window.confirm(confirmMsg)) return

    try {
      setActionLoading(account.id)
      const response = await adminAPI.reactivateAccount(account.id, account.role)
      if (response?.data?.success) {
        toast.success(`${account.role} account reactivated successfully`)
        fetchDeletedAccounts()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reactivate account")
    } finally {
      setActionLoading(null)
    }
  }

  // Filter accounts based on search query and role filter
  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = 
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.detail.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRole = roleFilter === "all" || acc.role === roleFilter

    return matchesSearch && matchesRole
  })

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case "User":
        return "bg-blue-50 text-blue-700 border-blue-100"
      case "Seller":
        return "bg-amber-50 text-amber-700 border-amber-100"
      case "Restaurant":
        return "bg-emerald-50 text-emerald-700 border-emerald-100"
      case "Delivery Boy":
        return "bg-purple-50 text-purple-700 border-purple-100"
      default:
        return "bg-slate-50 text-slate-700 border-slate-100"
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen font-['Outfit']">
      <div className="w-full mx-auto max-w-7xl">
        {/* Page Title */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Deleted Accounts Management</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Review soft-deleted profiles and reactivate them</p>
          </div>
          <button
            onClick={fetchDeletedAccounts}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl shadow-xs hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <RotateCcw size={14} /> Refresh List
          </button>
        </div>

        {/* Warning Information */}
        <div className="bg-red-50 border border-red-200/50 rounded-2xl p-4 mb-6 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black text-red-800 uppercase tracking-wider mb-1">Administrative Restorations</h4>
            <p className="text-xs text-red-700/80 font-medium leading-relaxed">
              Below is the consolidated history of deleted profiles from the system. Reactivating a profile will restore their access permission immediately, re-register their login credentials, and preserve all past transactions, ledger items, and order listings.
            </p>
          </div>
        </div>

        {/* Controls & Filters */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 mb-6 flex flex-col md:flex-row gap-4">
          {/* Search Box */}
          <div className="relative flex-1 group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="Search by name, phone, email, details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-slate-300 transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="flex gap-2">
            {["all", "User", "Seller", "Restaurant", "Delivery Boy"].map((roleOption) => (
              <button
                key={roleOption}
                onClick={() => setRoleFilter(roleOption)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  roleFilter === roleOption
                    ? "bg-slate-900 text-white border-slate-900 shadow-md"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {roleOption === "all" ? "All Roles" : roleOption}
              </button>
            ))}
          </div>
        </div>

        {/* Accounts Table Card */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
              <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Fetching records...</span>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 text-slate-400 border border-slate-100">
                <Trash2 size={28} />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wide">No Deleted Accounts Found</h3>
              <p className="text-xs text-slate-400 font-medium max-w-xs mt-2 leading-relaxed">
                {searchQuery || roleFilter !== "all" 
                  ? "No accounts match your current query or selected role filters." 
                  : "All accounts in the ecosystem are active. No deleted history registered."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role Type</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact details</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details / Metadata</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Deletion Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccounts.map((account) => (
                    <tr key={account.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Profile info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900 font-black text-sm border border-slate-200">
                            {account.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{account.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">ID: {account.id.slice(-8)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role type */}
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider inline-block ${getRoleBadgeStyle(account.role)}`}>
                          {account.role}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-700">{account.phone}</p>
                          <p className="text-xs text-slate-400 font-medium">{account.email}</p>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100/60 px-2.5 py-1 rounded-lg">
                          {account.detail}
                        </span>
                      </td>

                      {/* Deletion date */}
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-500">
                          {new Date(account.deletedAt).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleReactivate(account)}
                          disabled={actionLoading === account.id}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xs hover:shadow-md active:scale-95 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <RotateCcw size={12} className={actionLoading === account.id ? "animate-spin" : ""} />
                          {actionLoading === account.id ? "Activating..." : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
