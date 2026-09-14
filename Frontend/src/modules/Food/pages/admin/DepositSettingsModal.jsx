import { useState, useEffect } from "react";
import { X, Loader2, UploadCloud } from "lucide-react";
import { adminAPI } from "@food/api";
import { toast } from "sonner";

export default function DepositSettingsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");
  
  const [qrCodeFile, setQrCodeFile] = useState(null);
  const [existingQrUrl, setExistingQrUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setBankName("");
    setAccountHolderName("");
    setAccountNumber("");
    setIfscCode("");
    setUpiId("");
    setQrCodeFile(null);
    setExistingQrUrl("");
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDepositPaymentSettings();
      if (res?.data?.success) {
        const data = res.data.data;
        setBankName(data?.bankName || "");
        setAccountHolderName(data?.bankAccountHolder || "");
        setAccountNumber(data?.bankAccountNumber || "");
        setIfscCode(data?.bankIfscCode || "");
        setUpiId(data?.upiId || "");
        setExistingQrUrl(data?.qrCodeUrl || "");
      }
    } catch (err) {
      toast.error("Failed to load deposit settings");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const nameRegex = /^[A-Za-z\s]+$/;
    const accountRegex = /^\d{9,18}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

    if (!nameRegex.test(bankName)) {
      toast.error("Bank Name should only contain alphabets and spaces");
      return false;
    }
    if (!nameRegex.test(accountHolderName)) {
      toast.error("Account Holder Name should only contain alphabets and spaces");
      return false;
    }
    if (!accountRegex.test(accountNumber)) {
      toast.error("Account Number should be 9 to 18 digits");
      return false;
    }
    if (!ifscRegex.test(ifscCode)) {
      toast.error("Invalid IFSC Code format (e.g. HDFC0000124)");
      return false;
    }
    if (!upiRegex.test(upiId)) {
      toast.error("Invalid UPI ID format");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bankName || !accountHolderName || !accountNumber || !ifscCode || !upiId) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!validateForm()) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("bankName", bankName);
      formData.append("bankAccountHolder", accountHolderName);
      formData.append("bankAccountNumber", accountNumber);
      formData.append("bankIfscCode", ifscCode);
      formData.append("upiId", upiId);
      
      if (qrCodeFile) {
        formData.append("qrCodeImage", qrCodeFile);
      }

      const res = await adminAPI.updateDepositPaymentSettings(formData);
      if (res?.data?.success) {
        toast.success("Deposit settings updated successfully");
        onClose();
      } else {
        toast.error(res?.data?.message || "Failed to update settings");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setQrCodeFile(e.target.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Deposit Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="text-slate-600">Loading settings...</p>
            </div>
          ) : (
            <form id="settings-form" onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800">Bank Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
                    <input type="text" required value={bankName} onChange={e => {
                      const val = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(val) && val.length <= 50) setBankName(val);
                    }} placeholder="e.g. HDFC Bank" maxLength={50} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Holder Name</label>
                    <input type="text" required value={accountHolderName} onChange={e => {
                      const val = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(val) && val.length <= 50) setAccountHolderName(val);
                    }} placeholder="e.g. Enter Name" maxLength={50} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
                    <input type="text" required value={accountNumber} onChange={e => {
                      const val = e.target.value;
                      if (/^\d*$/.test(val) && val.length <= 18) setAccountNumber(val);
                    }} placeholder="e.g. 50200..." maxLength={18} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
                    <input type="text" required value={ifscCode} onChange={e => {
                      const val = e.target.value.toUpperCase();
                      if (/^[A-Z0-9]*$/.test(val) && val.length <= 11) setIfscCode(val);
                    }} placeholder="e.g. HDFC0000124" maxLength={11} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800">UPI Details</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">UPI ID</label>
                  <input type="text" required value={upiId} onChange={e => {
                    const val = e.target.value;
                    if (/^[a-zA-Z0-9.\-_@]*$/.test(val) && val.length <= 50) setUpiId(val.toLowerCase());
                  }} placeholder="e.g. merchant@upi" maxLength={50} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-slate-800">QR Code Image</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Upload Payment QR Code</label>
                  <div className="flex items-center gap-4">
                    {(qrCodeFile || existingQrUrl) && (
                      <div className="w-24 h-24 border border-slate-200 rounded-lg overflow-hidden flex-shrink-0 bg-slate-50 flex items-center justify-center">
                        {qrCodeFile ? (
                          <img src={URL.createObjectURL(qrCodeFile)} alt="QR Preview" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <img src={existingQrUrl} alt="Existing QR" className="max-w-full max-h-full object-contain" />
                        )}
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-500 hover:bg-emerald-50 transition-colors">
                        <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <span className="text-sm font-medium text-slate-700 block">Click to upload new QR Code</span>
                        <span className="text-xs text-slate-500 block mt-1">JPG, PNG up to 5MB</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <button type="button" onClick={onClose} disabled={saving || loading} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="settings-form" disabled={saving || loading} className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
