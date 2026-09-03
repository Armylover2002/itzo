import { useState, useMemo, useEffect } from "react"
import { 
  Search, Plus, Edit, Trash2, ArrowUpDown, 
  DollarSign, Percent, Loader2, X, Building2, IndianRupee, AlertTriangle
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminApi } from "../services/adminApi"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function SellerCommission() {
  const [searchQuery, setSearchQuery] = useState("")
  const [commissions, setCommissions] = useState([])
  const [approvedSellers, setApprovedSellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isSellerSelectOpen, setIsSellerSelectOpen] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState(null)
  const [selectedSeller, setSelectedSeller] = useState(null)
  const [formData, setFormData] = useState({
    sellerId: "",
    defaultCommission: {
      type: "percentage",
      value: "10"
    },
    notes: ""
  })
  const [formErrors, setFormErrors] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    seller: true,
    sellerId: true,
    defaultCommission: true,
    status: true,
    actions: true,
  })

  const filteredCommissions = useMemo(() => {
    if (!searchQuery.trim()) return commissions
    const query = searchQuery.toLowerCase().trim()
    return commissions.filter(commission =>
      commission.sellerName?.toLowerCase().includes(query) ||
      commission.sellerId?.toLowerCase().includes(query)
    )
  }, [commissions, searchQuery])

  const filteredSellers = useMemo(() => {
    if (!searchQuery.trim()) return approvedSellers
    const query = searchQuery.toLowerCase().trim()
    return approvedSellers.filter(seller =>
      seller.name?.toLowerCase().includes(query) ||
      seller.shopName?.toLowerCase().includes(query) ||
      String(seller._id).toLowerCase().includes(query)
    )
  }, [approvedSellers, searchQuery])

  useEffect(() => {
    fetchBootstrap()
  }, [])

  const fetchBootstrap = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getSellerCommissionBootstrap()
      const data = response?.data?.data
      setCommissions(Array.isArray(data?.commissions) ? data.commissions : [])
      setApprovedSellers(Array.isArray(data?.sellers) ? data.sellers : [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch commissions')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (commission) => {
    try {
      await adminApi.toggleSellerCommissionStatus(commission._id)
      await fetchBootstrap()
      toast.success('Commission status updated successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update status')
    }
  }

  const handleAdd = () => {
    setSelectedCommission(null)
    setSelectedSeller(null)
    setFormData({
      sellerId: "",
      defaultCommission: {
        type: "percentage",
        value: "10"
      },
      notes: ""
    })
    setFormErrors({})
    setIsSellerSelectOpen(true)
  }

  const handleSelectSeller = (seller) => {
    setSelectedSeller(seller)
    setFormData(prev => ({
      ...prev,
      sellerId: seller._id
    }))
    setIsSellerSelectOpen(false)
    setIsAddEditOpen(true)
  }

  const handleEdit = async (commission) => {
    try {
      setLoading(true)
      const response = await adminApi.getSellerCommissionById(commission._id)
      const commissionData = response?.data?.data?.commission
      if (commissionData) {
        setSelectedCommission(commissionData)
        setSelectedSeller(commissionData.seller)
        setFormData({
          sellerId: commissionData.sellerId || commissionData.seller?._id || "",
          defaultCommission: {
            type: commissionData.defaultCommission?.type || "percentage",
            value: commissionData.defaultCommission?.value?.toString() || "10"
          },
          notes: commissionData.notes || ""
        })
        setFormErrors({})
        setIsAddEditOpen(true)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load commission')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (commission) => {
    setSelectedCommission(commission)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCommission) return
    try {
      setDeleting(true)
      await adminApi.deleteSellerCommission(selectedCommission._id)
      await fetchBootstrap()
      toast.success('Commission deleted successfully')
      setIsDeleteOpen(false)
      setSelectedCommission(null)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete commission')
    } finally {
      setDeleting(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.sellerId) errors.sellerId = "Seller is required"
    if (!formData.defaultCommission.value || parseFloat(formData.defaultCommission.value) < 0) {
      errors.defaultCommission = "Default commission value is required"
    }
    if (formData.defaultCommission.type === "percentage" && 
        (parseFloat(formData.defaultCommission.value) < 0 || parseFloat(formData.defaultCommission.value) > 100)) {
      errors.defaultCommission = "Percentage must be between 0-100"
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    try {
      setSaving(true)
      const payload = {
        sellerId: formData.sellerId,
        defaultCommission: {
          type: formData.defaultCommission.type,
          value: parseFloat(formData.defaultCommission.value)
        },
        notes: formData.notes
      }

      if (selectedCommission) {
        await adminApi.updateSellerCommission(selectedCommission._id, payload)
        toast.success('Commission updated successfully')
      } else {
        await adminApi.createSellerCommission(payload)
        toast.success('Commission created successfully')
      }

      await fetchBootstrap()
      setIsAddEditOpen(false)
      setSelectedCommission(null)
      setSelectedSeller(null)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save commission')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="max-w-full mx-auto">
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-slate-100 p-5 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h1 className="ds-h1">Seller Commission</h1>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-[#6412C6]/10 text-[#6412C6]">
                {filteredCommissions.length}
              </span>
            </div>
            <button 
              onClick={handleAdd}
              className="px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-[#6412C6] text-white hover:bg-[#6412C6]/90 flex items-center gap-2 transition-all shadow-xl shadow-[#6412C6]/20 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Add Commission
            </button>
          </div>

          <div className="mb-5 flex items-center gap-3">
            <div className="relative flex-1 sm:flex-initial min-w-[300px] group">
              <input
                type="text"
                placeholder="Search by seller name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-3 w-full text-sm rounded-2xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20 outline-none transition-all placeholder:text-slate-300 font-semibold"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#6412C6] transition-colors" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#6412C6]" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl ring-1 ring-slate-100">
              <table className="w-full">
                <thead className="bg-slate-50/70 border-b border-slate-100">
                  <tr>
                    <th className="ds-table-header-cell w-16 pl-8">S.No</th>
                    <th className="ds-table-header-cell">Seller Name</th>
                    <th className="ds-table-header-cell">Seller ID</th>
                    <th className="ds-table-header-cell">Default Commission</th>
                    <th className="ds-table-header-cell">Status</th>
                    <th className="ds-table-header-cell text-center pr-8">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-50">
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="p-4 bg-slate-50 rounded-full mb-4">
                            <Percent className="h-8 w-8 text-slate-200" />
                          </div>
                          <p className="text-slate-400 font-bold text-sm">No commissions found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((commission) => (
                      <tr key={commission._id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-5 pl-8 whitespace-nowrap text-sm font-semibold text-slate-600">{commission.sl}</td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-black text-[#6412C6] group-hover:text-[#6412C6]/80 transition-colors">{commission.sellerName}</span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm font-bold text-slate-500">{commission.sellerIdDisplay}</td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="text-sm font-black text-slate-900">
                            {commission.defaultCommission?.type === 'percentage' ? `${commission.defaultCommission.value}%` : `\u20B9${commission.defaultCommission.value}`}
                          </span>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(commission)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${commission.status ? "bg-[#6412C6]" : "bg-slate-300"}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${commission.status ? "translate-x-6" : "translate-x-1"}`} />
                          </button>
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-center pr-8">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleEdit(commission)} className="p-2 rounded-xl bg-[#6412C6]/10 text-[#6412C6] hover:bg-[#6412C6] hover:text-white transition-all active:scale-90"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(commission)} className="p-2 rounded-xl bg-[#6412C6]/10 text-[#6412C6] hover:bg-[#6412C6] hover:text-white transition-all active:scale-90"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isSellerSelectOpen} onOpenChange={setIsSellerSelectOpen}>
        <DialogContent className="max-w-xl bg-white p-0 rounded-2xl ring-1 ring-slate-100 border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-black text-slate-900">Select Seller</DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Search approved sellers..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-3 w-full text-sm rounded-2xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20 outline-none transition-all placeholder:text-slate-300 font-semibold"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#6412C6] transition-colors" />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredSellers.filter(s => !s.hasCommissionSetup).map((seller) => (
                <button key={seller._id} onClick={() => handleSelectSeller(seller)} className="w-full p-4 text-left rounded-2xl ring-1 ring-slate-100 hover:bg-[#6412C6]/5 hover:ring-[#6412C6]/30 transition-all group">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-sm text-slate-900 group-hover:text-[#6412C6] transition-colors">{seller.shopName || seller.name}</p>
                      <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wider">{String(seller._id).slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-[#6412C6]/10 transition-all">
                      <Building2 className="w-4 h-4 text-slate-400 group-hover:text-[#6412C6] transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
              {filteredSellers.filter(s => !s.hasCommissionSetup).length === 0 && (
                <div className="flex flex-col items-center py-8">
                  <div className="p-3 bg-slate-50 rounded-full mb-3">
                    <Building2 className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-center text-sm font-semibold text-slate-500">No sellers available for new setup</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-2xl bg-white p-0 rounded-2xl ring-1 ring-slate-100 border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-black text-slate-900">{selectedCommission ? "Edit Seller Commission" : "Add Seller Commission"}</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            {selectedSeller && (
              <div className="p-4 bg-[#6412C6]/5 rounded-2xl ring-1 ring-[#6412C6]/20 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm text-[#6412C6]">{selectedSeller.shopName || selectedSeller.name}</p>
                  <p className="text-xs font-bold text-[#6412C6]/70 uppercase tracking-wider mt-0.5">{selectedSeller._id}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white ring-1 ring-[#6412C6]/20">
                  <Building2 className="w-5 h-5 text-[#6412C6]" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 block">Commission Type</label>
                <select 
                  value={formData.defaultCommission.type} 
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultCommission: { ...prev.defaultCommission, type: e.target.value } }))}
                  className="w-full px-4 py-3.5 text-sm rounded-2xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20 outline-none transition-all font-bold appearance-none"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="amount">Fixed Amount (\u20B9)</option>
                </select>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 block">Value</label>
                <input 
                  type="number" 
                  value={formData.defaultCommission.value} 
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultCommission: { ...prev.defaultCommission, value: e.target.value } }))}
                  className={cn(
                    "w-full px-4 py-3.5 text-sm rounded-2xl bg-white ring-1 outline-none transition-all font-bold placeholder:text-slate-200",
                    formErrors.defaultCommission ? "ring-rose-300 focus:ring-2 focus:ring-rose-200" : "ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20"
                  )}
                  placeholder="e.g., 10"
                />
                {formErrors.defaultCommission && <p className="text-[10px] font-black text-rose-600 uppercase tracking-wider ml-1">{formErrors.defaultCommission}</p>}
              </div>
            </div>
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1 block">Notes (Optional)</label>
              <textarea 
                value={formData.notes} 
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 text-sm rounded-2xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20 outline-none transition-all resize-none font-semibold placeholder:text-slate-200" 
                rows="3" 
                placeholder="Commission details or remarks..."
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button onClick={() => setIsAddEditOpen(false)} className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-2xl ring-1 ring-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-2xl bg-[#6412C6] text-white hover:bg-[#6412C6]/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-[#6412C6]/20 transition-all active:scale-[0.98]"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedCommission ? "Update Commission" : "Create Commission"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0 rounded-2xl ring-1 ring-slate-100 border-none shadow-2xl">
          <DialogHeader className="px-6 pt-6 pb-3 border-b-0">
            <DialogTitle className="text-xl font-black text-slate-900">Delete Seller Commission</DialogTitle>
          </DialogHeader>
          <div className="px-6 pt-2 pb-5 space-y-5">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-rose-50/60 ring-1 ring-rose-100">
              <div className="h-12 w-12 shrink-0 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-black text-slate-900">
                  Delete commission for&nbsp;<span className="text-rose-600">"{selectedCommission?.sellerName}"</span>?
                </p>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  This action <span className="font-black uppercase">cannot be undone</span>. Seller will revert to the default platform commission rates immediately.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            <button onClick={() => setIsDeleteOpen(false)} className="px-5 py-3 text-xs font-black uppercase tracking-widest rounded-2xl ring-1 ring-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
            <button 
              onClick={confirmDelete} 
              disabled={deleting} 
              className="px-6 py-3 text-xs font-black uppercase tracking-widest rounded-2xl bg-[#6412C6] text-white hover:bg-[#6412C6]/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-[#6412C6]/20 transition-all active:scale-[0.98]"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {deleting ? "DELETING..." : "DELETE"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
