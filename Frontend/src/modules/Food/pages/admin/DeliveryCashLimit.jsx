import { useCallback, useEffect, useRef, useState } from "react"
import { IndianRupee, Loader2, Wallet, Building2, UploadCloud, CheckCircle2 } from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function DeliveryCashLimit() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingWithdrawal, setSavingWithdrawal] = useState(false)
  const [savingBankDetails, setSavingBankDetails] = useState(false)
  
  const [deliveryCashLimit, setDeliveryCashLimit] = useState("")
  const [deliveryWithdrawalLimit, setDeliveryWithdrawalLimit] = useState("")
  const [adminBankDetails, setAdminBankDetails] = useState({
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
    upiQrCode: ""
  })
  const [uploadingQr, setUploadingQr] = useState(false)
  
  const isMountedRef = useRef(true)

  const fetchLimit = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await adminAPI.getDeliveryCashLimit()
      const data = response?.data?.data || response?.data || {}
      const limit = data.deliveryCashLimit
      const wl = data.deliveryWithdrawalLimit ?? 100
      const bankDetails = data.adminBankDetails || {}
      
      if (!isMountedRef.current) return
      
      setDeliveryCashLimit(limit !== undefined && limit !== null ? String(limit) : "")
      setDeliveryWithdrawalLimit(wl !== undefined && wl !== null ? String(wl) : "100")
      setAdminBankDetails({
        bankName: bankDetails.bankName || "",
        accountHolderName: bankDetails.accountHolderName || "",
        accountNumber: bankDetails.accountNumber || "",
        ifscCode: bankDetails.ifscCode || "",
        upiId: bankDetails.upiId || "",
        upiQrCode: bankDetails.upiQrCode || ""
      })
    } catch (error) {
      debugError("Error fetching delivery cash limit:", error)
      if (!isMountedRef.current) return
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to load delivery cash limit")
      }
      setDeliveryCashLimit("")
      setDeliveryWithdrawalLimit("100")
    } finally {
      if (!silent && isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  const handleBankDetailChange = (e) => {
    const { name, value } = e.target
    setAdminBankDetails(prev => ({ ...prev, [name]: value }))
  }

  const handleQrUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploadingQr(true)
      const res = await uploadAPI.uploadMedia(file)
      if (res?.data?.success) {
        setAdminBankDetails(prev => ({ ...prev, upiQrCode: res.data.data.url }))
        toast.success("QR Code uploaded successfully")
      } else {
        toast.error("Failed to upload QR code")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Error uploading image")
    } finally {
      setUploadingQr(false)
    }
  }

  const saveBankDetails = async () => {
    try {
      setSavingBankDetails(true)
      const value = Number(deliveryCashLimit) || 0
      const withdrawalValue = Number(deliveryWithdrawalLimit) || 100
      
      await adminAPI.updateDeliveryCashLimit({
        deliveryCashLimit: value,
        deliveryWithdrawalLimit: withdrawalValue,
        adminBankDetails
      })
      toast.success("Admin Payment Details updated successfully")
      await fetchLimit({ silent: true })
    } catch (error) {
      debugError("Error saving admin bank details:", error)
      toast.error(error.response?.data?.message || "Failed to update admin bank details")
    } finally {
      setSavingBankDetails(false)
    }
  }

  const saveLimit = async () => {
    const value = Number(deliveryCashLimit)
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Cash limit must be a number (>= 0)")
      return
    }
    const withdrawalValue = Number(deliveryWithdrawalLimit) || 100

    try {
      setSaving(true)
      const response = await adminAPI.updateDeliveryCashLimit({
        deliveryCashLimit: value,
        deliveryWithdrawalLimit: withdrawalValue,
        adminBankDetails
      })
      const saved = response?.data?.data?.deliveryCashLimit ?? response?.data?.deliveryCashLimit ?? value
      setDeliveryCashLimit(String(saved))
      toast.success("Delivery cash limit updated successfully")
      await fetchLimit({ silent: true })
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update delivery cash limit")
    } finally {
      setSaving(false)
    }
  }

  const saveWithdrawalLimit = async () => {
    const value = Number(deliveryWithdrawalLimit)
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Withdrawal limit must be a number (>= 0)")
      return
    }
    const cashValue = Number(deliveryCashLimit) || 0

    try {
      setSavingWithdrawal(true)
      const response = await adminAPI.updateDeliveryCashLimit({
        deliveryCashLimit: cashValue,
        deliveryWithdrawalLimit: value,
        adminBankDetails
      })
      const saved = response?.data?.data?.deliveryWithdrawalLimit ?? response?.data?.deliveryWithdrawalLimit ?? value
      setDeliveryWithdrawalLimit(String(saved))
      toast.success("Withdrawal limit updated successfully")
      await fetchLimit({ silent: true })
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update withdrawal limit")
    } finally {
      setSavingWithdrawal(false)
    }
  }

  useEffect(() => {
    isMountedRef.current = true
    fetchLimit()

    return () => {
      isMountedRef.current = false
    }
  }, [fetchLimit])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Settings Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <IndianRupee className="w-5 h-5 text-slate-700" />
            <h1 className="text-2xl font-bold text-slate-900">Delivery Boy Settings</h1>
          </div>
          <p className="text-sm text-slate-600">
            Configure global limits and your payment details for manual deposit settlements.
          </p>
        </div>

        {/* Financial Limits */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Financial Limits</h2>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <IndianRupee className="w-5 h-5 text-emerald-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-emerald-900 mb-1">
                  Delivery Boy Available Cash Limit (Global)
                </div>
                <div className="text-sm text-emerald-800/80 mb-3">
                  When COD cash is collected, delivery partner&apos;s remaining limit will decrease automatically.
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryCashLimit}
                      onChange={(e) => setDeliveryCashLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm border-emerald-200"
                      placeholder={loading ? "Loading..." : "e.g., 2000"}
                      disabled={loading || saving}
                    />
                  </div>
                  <button
                    onClick={saveLimit}
                    disabled={loading || saving}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Wallet className="w-5 h-5 text-amber-700 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-amber-900 mb-1">
                  Minimum Withdrawal Amount (Global)
                </div>
                <div className="text-sm text-amber-800/80 mb-3">
                  Delivery boy can withdraw only when withdrawable amount is <strong>above</strong> this value.
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryWithdrawalLimit}
                      onChange={(e) => setDeliveryWithdrawalLimit(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm border-amber-200"
                      placeholder={loading ? "Loading..." : "e.g., 100"}
                      disabled={loading || savingWithdrawal}
                    />
                  </div>
                  <button
                    onClick={saveWithdrawalLimit}
                    disabled={loading || savingWithdrawal}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingWithdrawal && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Payment Details */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-bold text-slate-900">Admin Payment Details</h2>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            These details will be shown to delivery partners when they choose to manually deposit Cash in Hand.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                name="bankName"
                value={adminBankDetails.bankName}
                onChange={handleBankDetailChange}
                placeholder="e.g. State Bank of India"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account Holder Name</label>
              <input
                type="text"
                name="accountHolderName"
                value={adminBankDetails.accountHolderName}
                onChange={handleBankDetailChange}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                name="accountNumber"
                value={adminBankDetails.accountNumber}
                onChange={handleBankDetailChange}
                placeholder="Account Number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
              <input
                type="text"
                name="ifscCode"
                value={adminBankDetails.ifscCode}
                onChange={handleBankDetailChange}
                placeholder="IFSC Code"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">UPI ID</label>
              <input
                type="text"
                name="upiId"
                value={adminBankDetails.upiId}
                onChange={handleBankDetailChange}
                placeholder="e.g. admin@upi"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">UPI QR Code</label>
              <div className="flex items-center gap-4">
                {adminBankDetails.upiQrCode ? (
                  <div className="relative">
                    <img 
                      src={adminBankDetails.upiQrCode} 
                      alt="UPI QR" 
                      className="w-24 h-24 object-contain border rounded bg-slate-50"
                    />
                    <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-0.5 shadow">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50 text-slate-400">
                    No QR
                  </div>
                )}
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">
                    {uploadingQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                    {uploadingQr ? "Uploading..." : "Upload QR Image"}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleQrUpload}
                      disabled={uploadingQr}
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-2">Upload a clear square QR image (PNG/JPG).</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={saveBankDetails}
              disabled={loading || savingBankDetails}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingBankDetails && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Payment Details
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
