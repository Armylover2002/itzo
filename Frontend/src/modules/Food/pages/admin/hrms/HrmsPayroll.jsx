import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Wallet, Loader2, Play, CheckCircle, DollarSign, Receipt } from 'lucide-react';

export default function HrmsPayroll() {
    const [tab, setTab] = useState('payroll');
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [genLoading, setGenLoading] = useState(false);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    
    // Payslip modal
    const [previewPdf, setPreviewPdf] = useState(null);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [selectedSalaryId, setSelectedSalaryId] = useState(null);
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                if (tab === 'payroll') {
                    const res = await axiosInstance.get(`/hrms/salaries?month=${month}&year=${year}`);
                    const data = res.data?.data || {};
                    setPayrollRecords(data.records || []);
                    setSummary(data.summary || null);
                } else {
                    const res = await axiosInstance.get('/hrms/expenses?status=Pending');
                    setExpenses(res.data?.data?.expenses || []);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [tab, month, year]);

    const handleGenerate = async () => {
        setGenLoading(true);
        try {
            await axiosInstance.post('/hrms/salaries/generate', { month, year });
            toast.success('Payroll generated');
            const res = await axiosInstance.get(`/hrms/salaries?month=${month}&year=${year}`);
            const data = res.data?.data || {};
            setPayrollRecords(data.records || []);
            setSummary(data.summary || null);
        } catch (e) { toast.error(e.response?.data?.message || 'Generation failed'); }
        finally { setGenLoading(false); }
    };

    const handleApprovePayroll = async () => {
        try {
            await axiosInstance.post('/hrms/salaries/approve', { month, year });
            toast.success('Payroll approved');
            const res = await axiosInstance.get(`/hrms/salaries?month=${month}&year=${year}`);
            setPayrollRecords(res.data?.data?.records || []);
        } catch (e) { toast.error(e.response?.data?.message || 'Approval failed'); }
    };

    const handleMarkPaid = async () => {
        try {
            await axiosInstance.post('/hrms/salaries/mark-paid', { month, year });
            toast.success('Payroll marked as paid');
            const res = await axiosInstance.get(`/hrms/salaries?month=${month}&year=${year}`);
            setPayrollRecords(res.data?.data?.records || []);
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    };

    const handleExpenseAction = async (id, action, approvedAmount) => {
        try {
            let rejectionReason = '';
            if (action === 'Rejected') {
                rejectionReason = window.prompt("Please provide a reason for rejection:");
                if (rejectionReason === null) return; // User cancelled
            }
            await axiosInstance.post(`/hrms/expenses/${id}/action`, { action, approvedAmount, rejectionReason });
            toast.success(`Expense ${action.toLowerCase()}`);
            setExpenses(prev => prev.filter(e => e._id !== id));
        } catch (e) { toast.error(e.response?.data?.message || 'Action failed'); }
    };

    const handleGeneratePayslipPdf = async (id) => {
        const toastId = toast.loading('Generating payslip PDF...');
        try {
            await axiosInstance.post(`/hrms/salaries/${id}/generate-payslip`);
            toast.success('Payslip generated successfully', { id: toastId });
            // Refresh table
            const res = await axiosInstance.get(`/hrms/salaries?month=${month}&year=${year}`);
            setPayrollRecords(res.data?.data?.records || []);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to generate payslip', { id: toastId });
        }
    };

    const handleUploadPayslip = async (e) => {
        e.preventDefault();
        if (!file || !selectedSalaryId) return;

        setUploading(true);
        try {
            // Upload image to Cloudinary via backend proxy
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'hrms/payslips');
            
            const uploadRes = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const imageUrl = uploadRes.data?.data?.url;
            
            if (!imageUrl) throw new Error('Failed to get image URL');

            // Save payslip URL to salary record
            await axiosInstance.post(`/hrms/salaries/${selectedSalaryId}/upload-payslip`, {
                payslipUrl: imageUrl
            });

            toast.success('Payslip uploaded successfully');
            setUploadModalOpen(false);
            setFile(null);
            setSelectedSalaryId(null);
            
            // Refresh table
            const res = await axiosInstance.get(`/hrms/salaries?month=${month}&year=${year}`);
            setPayrollRecords(res.data?.data?.records || []);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const hasDrafts = payrollRecords.some(r => r.status === 'Draft');
    const hasApproved = payrollRecords.some(r => r.status === 'Approved');

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Payroll & Expenses</h1>

            <div className="flex gap-2">
                <button onClick={() => setTab('payroll')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'payroll' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>Payroll</button>
                <button onClick={() => setTab('expenses')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'expenses' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>Pending Expenses</button>
            </div>

            {tab === 'payroll' && (
                <>
                    <div className="flex flex-wrap gap-3 items-center">
                        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white">
                            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white">
                            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <button onClick={handleGenerate} disabled={genLoading}
                            className="flex items-center gap-2 px-4 h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Play className="w-4 h-4" />{genLoading ? 'Generating...' : 'Generate Payroll'}
                        </button>
                        {hasDrafts && (
                            <button onClick={handleApprovePayroll} className="flex items-center gap-2 px-4 h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl text-sm">
                                <CheckCircle className="w-4 h-4" /> Approve All
                            </button>
                        )}
                        {hasApproved && (
                            <button onClick={handleMarkPaid} className="flex items-center gap-2 px-4 h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl text-sm">
                                <DollarSign className="w-4 h-4" /> Mark Paid
                            </button>
                        )}
                    </div>

                    {summary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <p className="text-xs text-slate-500">Employees</p><p className="text-2xl font-bold text-slate-900">{summary.count}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <p className="text-xs text-slate-500">Total Salary</p><p className="text-2xl font-bold text-slate-900">₹{summary.totalNetSalary?.toLocaleString()}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <p className="text-xs text-slate-500">Reimbursements</p><p className="text-2xl font-bold text-slate-900">₹{summary.totalReimbursements?.toLocaleString()}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <p className="text-xs text-slate-500">LOP Deductions</p><p className="text-2xl font-bold text-red-600">₹{summary.totalLopDeduction?.toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                </>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : tab === 'payroll' ? (
                    payrollRecords.length === 0 ? (
                        <div className="text-center p-12"><Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No payroll for this period. Click "Generate Payroll" to create.</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Employee</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Present</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">LOP</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Deductions</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reimb.</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Net Salary</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Payslip</th>
                                </tr></thead>
                                <tbody>
                                    {payrollRecords.map(r => (
                                        <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="px-5 py-3.5 font-medium text-slate-900">{r.employeeId?.adminId?.name || '—'}</td>
                                            <td className="px-5 py-3.5">{r.presentDays}/{r.totalWorkingDays}</td>
                                            <td className="px-5 py-3.5 text-red-600">{r.lopDays || 0}</td>
                                            <td className="px-5 py-3.5 text-red-600">₹{((r.shortHourDeduction || 0) + (r.lopDeduction || 0)).toLocaleString()}</td>
                                            <td className="px-5 py-3.5 text-slate-900">₹{r.reimbursements?.toLocaleString() || 0}</td>
                                            <td className="px-5 py-3.5 font-bold text-slate-900">₹{r.netSalary?.toLocaleString() || 0}</td>
                                            <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.status === 'Paid' ? 'bg-orange-50 text-orange-700' : r.status === 'Approved' ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span></td>
                                            <td className="px-5 py-3.5 text-right">
                                                {r.payslipUrl ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => setPreviewPdf(r.payslipUrl)} className="text-orange-600 hover:text-orange-700 text-xs font-medium" title="Preview Payslip">View</button>
                                                        <span className="text-slate-300">|</span>
                                                        <a href={r.payslipUrl} download target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-700 text-xs font-medium" title="Download Payslip">DL</a>
                                                        <span className="text-slate-300">|</span>
                                                        <button onClick={() => handleGeneratePayslipPdf(r._id)} className="text-orange-600 hover:text-orange-700 text-xs font-medium" title="Regenerate PDF">Regenerate</button>
                                                        <span className="text-slate-300">|</span>
                                                        <button onClick={() => { setSelectedSalaryId(r._id); setUploadModalOpen(true); }} className="text-orange-600 hover:text-orange-700 text-xs font-medium" title="Replace Manual Payslip">Replace</button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleGeneratePayslipPdf(r._id)} className="text-orange-600 hover:text-orange-700 text-xs font-medium" title="Generate PDF Payslip">Generate</button>
                                                        <span className="text-slate-300">|</span>
                                                        <button onClick={() => { setSelectedSalaryId(r._id); setUploadModalOpen(true); }} className="text-orange-600 hover:text-orange-700 text-xs font-medium" title="Upload Manual Payslip">Upload</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    expenses.length === 0 ? (
                        <div className="text-center p-12"><Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No pending expenses</p></div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {expenses.map(e => (
                                <div key={e._id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{e.employeeId?.adminId?.name || 'Employee'}</p>
                                        <p className="text-sm text-slate-500">{e.purpose} · {new Date(e.visitDate).toLocaleDateString('en-IN')}</p>
                                        <p className="text-xs text-slate-400">Travel: ₹{e.travelCost} | Hotel: ₹{e.hotelCost} | Food: ₹{e.foodCost} | Other: ₹{e.otherExpenses} | <strong>Total: ₹{e.totalAmount}</strong></p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleExpenseAction(e._id, 'Approved', e.totalAmount)} className="px-4 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium">Approve</button>
                                        <button onClick={() => handleExpenseAction(e._id, 'Rejected')} className="px-4 h-9 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl text-sm font-medium">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>

            {/* Payslip Preview Modal */}
            {previewPdf && (
                <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200 text-white">
                        <h3 className="font-medium text-lg">Payslip Preview</h3>
                        <div className="flex gap-4">
                            <a href={previewPdf} download target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors flex items-center gap-2">
                                Download
                            </a>
                            <button onClick={() => setPreviewPdf(null)} className="px-4 py-2 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg text-sm transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full p-4 flex items-center justify-center">
                        {previewPdf.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                            <img src={previewPdf} className="max-w-full max-h-full object-contain rounded-xl" alt="Payslip Preview" />
                        ) : (
                            <object data={previewPdf} type="application/pdf" className="w-full h-full rounded-xl bg-white">
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <p className="text-white font-medium">Unable to display PDF inline.</p>
                                    <a href={previewPdf} download target="_blank" rel="noopener noreferrer" className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">Download PDF</a>
                                </div>
                            </object>
                        )}
                    </div>
                </div>
            )}

            {/* Upload Payslip Modal */}
            {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-4">Upload Payslip</h3>
                            
                            <form onSubmit={handleUploadPayslip} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select File (Image or PDF)</label>
                                    <input type="file" required onChange={e => setFile(e.target.files[0])} accept="image/*,.pdf" 
                                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100" />
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button type="button" onClick={() => { setUploadModalOpen(false); setFile(null); setSelectedSalaryId(null); }} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploading || !file} className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                        {uploading ? 'Uploading...' : 'Upload Payslip'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
