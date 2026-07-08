import React, { useState, useEffect } from 'react';
import axios from 'axios';
import axiosInstance from '@core/api/axios';
import { Wallet, Loader2, Download, Eye, Printer, FileText } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// Payslip PDF Helpers (Foolproof: uses Backend Proxy via raw axios)
// ──────────────────────────────────────────────────────────────────────────────
// IMPORTANT: We use raw `axios` (NOT axiosInstance) for proxy requests because:
// 1. The proxy endpoint is PUBLIC (no auth needed)
// 2. axiosInstance's 401 interceptor treats /hrms/* URLs as unknown module,
//    causing any error to wipe auth tokens and redirect to login
// The backend proxy auto-detects format (PDF vs legacy image) from the URL.
// Frontend always treats payslips as PDF — the proxy handles edge cases.
// ──────────────────────────────────────────────────────────────────────────────
const PROXY_BASE = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'}/hrms/salaries/proxy-document`;

// Programmatic download: fetches document via backend proxy as blob, then triggers browser save dialog
const handleProxyDownload = async (url) => {
    if (!url) return;
    try {
        const res = await axios.get(PROXY_BASE, {
            params: { url, mode: 'download' },
            responseType: 'blob',
            withCredentials: false
        });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Payslip_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch (e) {
        console.error('Download failed:', e);
        window.open(url, '_blank');
    }
};

// Programmatic open-in-new-tab: fetches document via backend proxy as blob, then opens blob URL
const handleProxyOpen = async (url) => {
    if (!url) return;
    try {
        const res = await axios.get(PROXY_BASE, {
            params: { url, mode: 'view' },
            responseType: 'blob',
            withCredentials: false
        });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (e) {
        console.error('Open failed:', e);
        window.open(url, '_blank');
    }
};

// Programmatic print: fetches document via backend proxy as blob, opens in hidden iframe and triggers print
const handleProxyPrint = async (url) => {
    if (!url) return;
    try {
        const res = await axios.get(PROXY_BASE, {
            params: { url, mode: 'view' },
            responseType: 'blob',
            withCredentials: false
        });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow?.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(blobUrl);
            }, 60000);
        };
    } catch (e) {
        console.error('Print failed:', e);
    }
};

// Generate preview blob URL for iframe display within the modal
const fetchPreviewBlobUrl = async (url) => {
    try {
        const res = await axios.get(PROXY_BASE, {
            params: { url, mode: 'view' },
            responseType: 'blob',
            withCredentials: false
        });
        const blob = new Blob([res.data], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
    } catch (e) {
        console.error('Preview fetch failed:', e);
        return null;
    }
};

export default function Salary() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [tab, setTab] = useState('overview');
    const [selectedPayslip, setSelectedPayslip] = useState(null);
    const [previewPdf, setPreviewPdf] = useState(null);
    const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);


    // When previewPdf URL changes, fetch blob from backend proxy for reliable inline display
    useEffect(() => {
        if (!previewPdf) {
            if (previewBlobUrl) {
                URL.revokeObjectURL(previewBlobUrl);
                setPreviewBlobUrl(null);
            }
            return;
        }
        let cancelled = false;
        setPreviewLoading(true);
        fetchPreviewBlobUrl(previewPdf).then(blobUrl => {
            if (!cancelled) {
                setPreviewBlobUrl(blobUrl);
                setPreviewLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [previewPdf]);

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
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <button onClick={() => setPreviewPdf(r.payslipUrl)} className="text-orange-600 hover:text-orange-700 text-xs font-semibold flex items-center gap-1 bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded-lg transition-colors" title="View Payslip">
                                                            <Eye className="w-3.5 h-3.5" /> View
                                                        </button>
                                                        <button onClick={() => handleProxyDownload(r.payslipUrl)} className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors" title="Download Payslip">
                                                            <Download className="w-3.5 h-3.5" /> Download
                                                        </button>
                                                        <button onClick={() => handleProxyPrint(r.payslipUrl)} className="text-blue-600 hover:text-blue-700 text-xs font-semibold flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors" title="Print Payslip">
                                                            <Printer className="w-3.5 h-3.5" /> Print
                                                        </button>
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

            {/* Payslip Preview Modal — Supports both PDF and legacy PNG */}
            {previewPdf && (
                <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md">
                    <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="font-bold text-base text-white">Payslip PDF Viewer</h3>
                                <p className="text-xs text-slate-400">Official HRMS Generated Record</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <button
                                onClick={() => handleProxyOpen(previewPdf)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
                                title="Open in New Tab"
                            >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" /> Open in Tab
                            </button>
                            <button
                                onClick={() => handleProxyDownload(previewPdf)}
                                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 transform hover:scale-105"
                                title="Download Payslip"
                            >
                                <Download className="w-3.5 h-3.5" /> Download PDF
                            </button>
                            <button
                                onClick={() => handleProxyPrint(previewPdf)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-slate-700"
                                title="Print Payslip"
                            >
                                <Printer className="w-3.5 h-3.5 text-blue-400" /> Print
                            </button>
                            <button
                                onClick={() => setPreviewPdf(null)}
                                className="ml-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all border border-red-500/20"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full p-6 flex items-center justify-center overflow-hidden bg-slate-950/50">
                        {previewLoading ? (
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-orange-400" />
                                <p className="text-slate-400 text-sm">Loading payslip...</p>
                            </div>
                        ) : previewBlobUrl ? (
                            <iframe src={previewBlobUrl} className="w-full h-full rounded-xl shadow-2xl bg-white" title="Payslip PDF Preview" />
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-center">
                                <FileText className="w-12 h-12 text-slate-500" />
                                <p className="text-slate-400 text-sm">Could not load payslip.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => handleProxyOpen(previewPdf)} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold">
                                        Open in Tab
                                    </button>
                                    <button onClick={() => handleProxyDownload(previewPdf)} className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-bold">
                                        Download
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
