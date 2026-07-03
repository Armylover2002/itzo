import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { Wallet, Loader2, Download, Eye } from 'lucide-react';

export default function Salary() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [tab, setTab] = useState('overview');
    const [selectedPayslip, setSelectedPayslip] = useState(null);
    const [previewPdf, setPreviewPdf] = useState(null);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const res = await axiosInstance.get(`/hrms/salaries/me?year=${selectedYear}`);
                setRecords(res.data?.data || []);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [selectedYear]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const statusColor = { Draft: 'bg-slate-100 text-slate-600', Approved: 'bg-orange-50 text-orange-700', Paid: 'bg-emerald-50 text-emerald-700' };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Salary & Payslips</h1>
                    <p className="text-sm text-slate-500 mt-1">View your salary history and download payslips</p>
                </div>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                    className="h-10 px-4 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'overview' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>Salary Overview</button>
                <button onClick={() => setTab('payslips')} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === 'payslips' ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200'}`}>Payslips</button>
            </div>

            {/* Payslip Detail Modal */}
            {selectedPayslip && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-bold text-slate-900 text-lg">Payslip — {monthNames[selectedPayslip.month - 1]} {selectedPayslip.year}</h3>
                                <button onClick={() => setSelectedPayslip(null)} className="text-slate-400 hover:text-slate-600 text-sm font-medium">Close</button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {[
                                    { label: 'Base Salary', value: `₹${selectedPayslip.baseSalary?.toLocaleString() || 0}` },
                                    { label: 'Working Days', value: selectedPayslip.totalWorkingDays || 0 },
                                    { label: 'Present Days', value: selectedPayslip.presentDays || 0 },
                                    { label: 'Paid Leave Days', value: selectedPayslip.paidLeaveDays || 0 },
                                    { label: 'LOP Days', value: selectedPayslip.lopDays || 0, danger: true },
                                    { label: 'Absent Days', value: selectedPayslip.absentDays || 0, danger: true },
                                    { label: 'Short Hour Deduction', value: `₹${selectedPayslip.shortHourDeduction?.toLocaleString() || 0}`, danger: true },
                                    { label: 'Overtime Bonus', value: `₹${selectedPayslip.overtimeBonus?.toLocaleString() || 0}`, success: true },
                                    { label: 'Reimbursements', value: `₹${selectedPayslip.reimbursements?.toLocaleString() || 0}`, success: true },
                                    { label: 'LOP Deduction', value: `₹${selectedPayslip.lopDeduction?.toLocaleString() || 0}`, danger: true },
                                ].map((item, i) => (
                                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                                        <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                                        <p className={`font-bold text-lg ${item.danger ? 'text-red-600' : item.success ? 'text-emerald-600' : 'text-slate-900'}`}>{item.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-lg font-bold text-slate-900">Net Salary</span>
                                <span className="text-2xl font-bold text-emerald-600">₹{selectedPayslip.netSalary?.toLocaleString() || 0}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Salary Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : records.length === 0 ? (
                    <div className="text-center p-12">
                        <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No salary records for {selectedYear}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Month</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Base</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Deductions</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Net Salary</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Status</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Action</th>
                            </tr></thead>
                            <tbody>
                                {records.map(r => (
                                    <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">{monthNames[r.month - 1]} {r.year}</td>
                                        <td className="px-5 py-3.5 text-slate-600">₹{r.baseSalary?.toLocaleString() || 0}</td>
                                        <td className="px-5 py-3.5 text-red-600 font-medium">₹{((r.shortHourDeduction || 0) + (r.lopDeduction || 0)).toLocaleString()}</td>
                                        <td className="px-5 py-3.5 font-bold text-emerald-600">₹{r.netSalary?.toLocaleString() || 0}</td>
                                        <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor[r.status] || ''}`}>{r.status}</span></td>
                                        <td className="px-5 py-3.5">
                                            {tab === 'overview' ? (
                                                <button onClick={() => setSelectedPayslip(r)} className="flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-medium text-xs">
                                                    <Eye className="w-3.5 h-3.5" /> View Breakdown
                                                </button>
                                            ) : (
                                                r.payslipUrl ? (
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => setPreviewPdf(r.payslipUrl)} className="text-orange-500 hover:text-orange-600 text-xs font-medium flex items-center gap-1">
                                                            <Eye className="w-3.5 h-3.5" /> Preview Payslip
                                                        </button>
                                                        <span className="text-slate-300">|</span>
                                                        <a href={r.payslipUrl} download target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-700 text-xs font-medium flex items-center gap-1">
                                                            <Download className="w-3.5 h-3.5" /> Download Payslip
                                                        </a>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Not uploaded yet</span>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* PDF Preview Modal */}
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
        </div>
    );
}
