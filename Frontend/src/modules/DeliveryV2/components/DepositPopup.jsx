import { useState, useEffect } from "react"
import { 
  IndianRupee, 
  Loader2, 
  CreditCard, 
  Landmark, 
  QrCode, 
  MapPin, 
  Copy, 
  Upload, 
  Check, 
  ArrowLeft, 
  Wallet,
  ShieldCheck,
  Smartphone,
  Building,
  Info,
  Search,
  X
} from "lucide-react"
import { deliveryAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@common/utils/businessSettings"

export default function DepositPopup({ onSuccess, cashInHand = 0 }) {
  const [step, setStep] = useState(1) // 1: Amount Summary, 2: Payment Mode Selection, 3: Direct Admin details / Hub details
  const [paymentMode, setPaymentMode] = useState("") // "online" | "admin" | "hub"
  const [adminTab, setAdminTab] = useState("bank") // "bank" | "upi" | "qr"
  const [proofFile, setProofFile] = useState(null)
  const [proofFileName, setProofFileName] = useState("")
  const [copiedField, setCopiedField] = useState("")
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [wallet, setWallet] = useState(null)
  const [fetchingWallet, setFetchingWallet] = useState(true)
  const [settings, setSettings] = useState(null)


  useEffect(() => {
    const loadWalletAndSettings = async () => {
      try {
        setFetchingWallet(true)
        const [res, settingsRes] = await Promise.all([
          deliveryAPI.getWallet(),
          deliveryAPI.getDepositPaymentSettings()
        ])
        if (res?.data?.success) {
          setWallet(res.data.data.wallet)
        }
        if (settingsRes?.data?.success) {
          setSettings(settingsRes.data.data)
        }
      } catch (err) {
        console.error("Failed to load wallet/settings inside deposit popup:", err)
      } finally {
        setFetchingWallet(false)
      }
    }
    loadWalletAndSettings()
  }, [])

  const cashInHandNum = Number(cashInHand) || 0

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    toast.success(`${fieldName} copied to clipboard!`)
    setTimeout(() => setCopiedField(""), 2000)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size cannot exceed 5MB")
        return
      }
      setProofFile(file)
      setProofFileName(file.name)
      toast.success("Receipt image selected successfully")
    }
  }

  // razorpay online flow
  const handleOnlinePayment = async () => {
    try {
      setLoading(true)
      const orderRes = await deliveryAPI.createDepositOrder(cashInHandNum)
      const data = orderRes?.data?.data
      const rp = data?.razorpay
      if (!rp?.orderId || !rp?.key) {
        toast.error("Payment gateway not ready. Please try again.")
        setLoading(false)
        return
      }
      setLoading(false)

      let profile = {}
      try {
        const pr = await deliveryAPI.getProfile()
        profile = pr?.data?.data?.profile || pr?.data?.profile || {}
      } catch (_) {}

      const phone = (profile?.phone || "").replace(/\D/g, "").slice(-10)
      const email = profile?.email || ""
      const name = profile?.name || ""

      const companyName = await getCompanyNameAsync()
      setProcessing(true)
      await initRazorpayPayment({
        key: rp.key,
        amount: rp.amount,
        currency: rp.currency || "INR",
        order_id: rp.orderId,
        name: companyName,
        description: `Cash limit deposit - ₹${cashInHandNum.toFixed(2)}`,
        prefill: { name, email, contact: phone },
        handler: async (res) => {
          try {
            const verifyRes = await deliveryAPI.verifyDepositPayment({
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
              amount: cashInHandNum
            })
            if (verifyRes?.data?.success) {
              toast.success(`Deposit of ₹${cashInHandNum.toFixed(2)} successful. Available limit updated.`)
              window.dispatchEvent(new CustomEvent("deliveryWalletStateUpdated"))
              if (onSuccess) onSuccess()
            } else {
              toast.error(verifyRes?.data?.message || "Verification failed")
            }
          } catch (err) {
            toast.error(err?.response?.data?.message || "Verification failed. Contact support.")
          } finally {
            setProcessing(false)
          }
        },
        onError: (e) => {
          toast.error(e?.description || "Payment failed")
          setProcessing(false)
        },
        onClose: () => setProcessing(false)
      })
    } catch (err) {
      setLoading(false)
      setProcessing(false)
      toast.error(err?.response?.data?.message || "Failed to create payment")
    }
  }

  // manual upload / zone hub flow
  const handleManualSubmission = async (depositType) => {
    if (!proofFile) {
      toast.error("Please upload payment receipt image as proof")
      return
    }

    try {
      setLoading(true)
      const formData = new FormData()
      formData.append("amount", cashInHandNum.toString())
      formData.append("depositType", depositType)
      if (proofFile) {
        formData.append("paymentProof", proofFile)
      }

      const res = await deliveryAPI.submitManualDeposit(formData)
      if (res?.data?.success) {
        toast.success(
          "Deposit proof submitted successfully! Awaiting Admin approval."
        )
        window.dispatchEvent(new CustomEvent("deliveryWalletStateUpdated"))
        if (onSuccess) onSuccess()
      } else {
        toast.error(res?.data?.message || "Failed to submit request")
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to submit deposit request")
    } finally {
      setLoading(false)
    }
  }

  if (fetchingWallet) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF0000] mb-3" />
        <p className="text-xs text-slate-500 font-semibold animate-pulse">Loading wallet balance...</p>
      </div>
    )
  }

  if (wallet?.pendingManualDeposit) {
    const pd = wallet.pendingManualDeposit
    const dateFormatted = new Date(pd.createdAt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    const getMethodName = (type) => {
      switch (type) {
        case "admin_bank": return "Bank Transfer"
        case "admin_upi": return "UPI Payment"
        case "admin_qr": return "QR Code Scan"
        default: return type
      }
    }

    return (
      <div className="p-5 flex flex-col space-y-5 text-slate-900 bg-white">
        <div className="bg-amber-50/75 border border-amber-200/60 rounded-2xl p-5 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-20 h-20 bg-amber-500/5 rounded-full" />
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-3 animate-pulse">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-extrabold text-slate-900 text-base">Request Under Audit</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Status: Pending Approval</p>
          
          <div className="w-full border-t border-dashed border-slate-200/60 my-4" />
          
          <div className="w-full space-y-2.5 text-left text-xs font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Deposited Amount:</span>
              <span className="font-black text-slate-950">₹{Number(pd.amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Payment Mode:</span>
              <span className="font-bold text-slate-800">{getMethodName(pd.depositType)}</span>
            </div>
            <div className="flex justify-between">
              <span>Date Submitted:</span>
              <span className="font-bold text-slate-800">{dateFormatted}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs text-slate-500 font-medium leading-relaxed">
          💡 **Please Note**: You already have an active pending deposit request submitted. 
          Please wait while the admin verifies your screenshot proof and approves the settlement. 
          You will be able to make new deposits after this request is processed.
        </div>
      </div>
    )
  }

  if (cashInHandNum <= 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 text-base">No Outstanding Balance</h3>
        <p className="text-xs text-slate-500 max-w-[240px]">
          Your Cash in Hand is ₹0.00. No deposits are required at this moment.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-white overflow-hidden h-full w-full text-slate-900">
      
      {/* STEP 1: SUMMARY & CONFIRM AMOUNT */}
      {step === 1 && (
        <div className="p-5 flex flex-col space-y-5">
          <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-20 h-20 bg-emerald-500/5 rounded-full" />
            <div className="w-10 h-10 rounded-full bg-[#FF0000]/10 flex items-center justify-center text-[#FF0000] mb-3">
              <Wallet className="w-5 h-5" />
            </div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Amount to Deposit</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
              ₹{cashInHandNum.toFixed(2)}
            </p>
            
            <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-200/60 border border-slate-300/40 text-[10px] font-semibold text-slate-550">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF0000] animate-pulse" />
              Locked & Balanced
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-550 uppercase tracking-wider block">Unified Deposit amount</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
              <input
                type="text"
                disabled
                readOnly
                value={cashInHandNum.toFixed(2)}
                className="w-full pl-8 pr-3 py-3 border border-slate-200 bg-slate-50 rounded-xl text-slate-800 font-semibold text-sm cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 leading-normal pt-1">
              * The deposit amount matches exactly your total Cash in Hand. This amount cannot be changed by the delivery boy.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-3.5 bg-black text-white hover:bg-slate-900 active:scale-[0.98] font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
          >
            Proceed to Pay
          </button>
        </div>
      )}

      {/* STEP 2: CHOOSE PAYMENT MODE */}
      {step === 2 && (
        <div className="p-5 flex flex-col space-y-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setStep(1)} 
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-semibold text-slate-800">Select Settlement Mode</h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Mode 1: Online */}
            <button
              onClick={() => {
                setPaymentMode("online")
                handleOnlinePayment()
              }}
              disabled={loading || processing}
              className="flex items-center gap-4 p-4 border border-slate-200/80 hover:border-slate-400 rounded-2xl bg-white text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 leading-tight">Online Payment</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">Settle instantly using UPI, Credit/Debit cards, or Netbanking.</p>
              </div>
            </button>

            {/* Mode 2: Admin Details */}
            <button
              onClick={() => {
                setPaymentMode("admin")
                setStep(3)
              }}
              className="flex items-center gap-4 p-4 border border-slate-200/80 hover:border-slate-400 rounded-2xl bg-white text-left transition-all active:scale-[0.98]"
            >
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-slate-800 leading-tight">Admin Details</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">Bank Transfer, UPI ID or scan QR code and upload deposit proof.</p>
              </div>
            </button>

        </div>
        </div>
      )}

      {/* STEP 3: SUB-VIEWS (ADMIN DETAILS OR ZONE HUB) */}
      {step === 3 && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <button 
              onClick={() => setStep(2)} 
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-slate-900">
              Direct Admin Settlement
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            
            {/* SUB-VIEW 1: ADMIN DETAILS */}
            {paymentMode === "admin" && (
              <div className="space-y-4">
                
                {/* Switch Tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdminTab("bank")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      adminTab === "bank" ? "bg-white text-black shadow-sm" : "text-slate-500"
                    }`}
                  >
                    Bank Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("upi")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      adminTab === "upi" ? "bg-white text-black shadow-sm" : "text-slate-500"
                    }`}
                  >
                    UPI ID
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminTab("qr")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      adminTab === "qr" ? "bg-white text-black shadow-sm" : "text-slate-500"
                    }`}
                  >
                    QR Code
                  </button>
                </div>

                {/* Tab content 1: Bank Details */}
                {adminTab === "bank" && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</p>
                        <p className="text-xs font-bold text-slate-900">{settings?.bankName || "—"}</p>
                      </div>
                      <button 
                        onClick={() => handleCopy(settings?.bankName || "", "Bank Name")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "Bank Name" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Account Holder</p>
                        <p className="text-xs font-bold text-slate-900">{settings?.bankAccountHolder || "—"}</p>
                      </div>
                      <button 
                        onClick={() => handleCopy(settings?.bankAccountHolder || "", "Account Holder")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "Account Holder" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Account Number</p>
                        <p className="text-xs font-extrabold text-slate-900 font-mono">{settings?.bankAccountNumber || "—"}</p>
                      </div>
                      <button 
                        onClick={() => handleCopy(settings?.bankAccountNumber || "", "Account Number")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "Account Number" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</p>
                        <p className="text-xs font-extrabold text-slate-900 font-mono">{settings?.bankIfscCode || "—"}</p>
                      </div>
                      <button 
                        onClick={() => handleCopy(settings?.bankIfscCode || "", "IFSC Code")}
                        className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500"
                      >
                        {copiedField === "IFSC Code" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab content 2: UPI ID */}
                {adminTab === "upi" && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Admin UPI ID</p>
                      <p className="text-sm font-extrabold text-slate-950 mt-1 font-mono tracking-wide">{settings?.upiId || "—"}</p>
                    </div>
                    <button
                      onClick={() => handleCopy(settings?.upiId || "", "UPI ID")}
                      className="px-4 py-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-700 shadow-sm flex items-center gap-1.5 hover:bg-slate-50 active:scale-[0.98] transition-all"
                    >
                      {copiedField === "UPI ID" ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy UPI ID
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Tab content 3: QR Code */}
                {adminTab === "qr" && (
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
                    {/* Render dynamic QR Code from settings */}
                    {settings?.qrCodeUrl ? (
                      <div className="w-40 h-40 bg-white p-2 border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center">
                        <img 
                          src={settings.qrCodeUrl} 
                          alt="Admin QR Code" 
                          className="max-w-full max-h-full object-contain rounded-lg"
                        />
                      </div>
                    ) : (
                      <div className="w-40 h-40 bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                        <QrCode className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs font-medium">No QR Code</span>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 font-bold max-w-[200px] leading-snug">
                      Scan the QR code above with any UPI app (GPay, PhonePe, Paytm) to transfer the amount.
                    </p>
                  </div>
                )}

                {/* Upload proof block */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Upload Payment Receipt Proof <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="relative border-2 border-dashed border-slate-250 hover:border-slate-400 transition-colors rounded-2xl bg-slate-50 overflow-hidden">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div className="p-6 flex flex-col items-center justify-center text-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200/60 flex items-center justify-center text-slate-500">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800">
                          {proofFileName ? "Replace receipt image" : "Upload transaction screenshot"}
                        </p>
                        <p className="text-[10px] text-slate-400">JPG, PNG up to 5MB</p>
                      </div>
                    </div>
                  </div>

                  {proofFile && (
                    <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center h-48 group">
                      <img 
                        src={URL.createObjectURL(proofFile)} 
                        alt="Receipt Preview" 
                        className="max-w-full max-h-full object-contain"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setProofFile(null)
                          setProofFileName("")
                        }}
                        className="absolute top-2 right-2 bg-slate-900/70 hover:bg-red-500 text-white p-1.5 rounded-full shadow-md backdrop-blur-sm transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => handleManualSubmission(adminTab === 'bank' ? 'admin_bank' : adminTab === 'upi' ? 'admin_upi' : 'admin_qr')}
                  disabled={loading || !proofFile}
                  className="w-full mt-3 py-3.5 bg-black text-white hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading Proof…
                    </>
                  ) : "Submit Payment Proof"}
                </button>
              </div>
            )}


          </div>
        </div>
      )}

    </div>
  )
}
