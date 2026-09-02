import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Plus, X, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function Leave() {
    const [leaves, setLeaves] = useState([]);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [form, setForm] = useState({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '', isHalfDay: false });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [leavesRes, balanceRes] = await Promise.all([
                axiosInstance.get('/hrms/leaves/me'),
                axiosInstance.get('/hrms/leaves/balance')
            ]);
            setLeaves(leavesRes.data?.data || []);
            setBalance(balanceRes.data?.data || null);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSubmit = async () => {
        if (!form.startDate || !form.endDate || !form.reason?.trim()) return toast.error('All fields are required');
        setSubmitLoading(true);
        try {
            await axiosInstance.post('/hrms/leaves', form);
            toast.success('Leave applied successfully');
            setShowForm(false);
            setForm({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '', isHalfDay: false });
            fetchData();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed to apply leave'); }
        finally { setSubmitLoading(false); }
    };

    const statusBadge = (status) => {
        const styles = {
            Pending: 'bg-amber-50 text-amber-700 border-amber-200',
            Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            Rejected: 'bg-red-50 text-red-700 border-red-200',
            Cancelled: 'bg-slate-100 text-slate-600 border-slate-200'
        };
        return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.Pending}`}>{status}</span>;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Apply and track your leaves</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl shadow-sm transition-all text-sm">
                    {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showForm ? 'Cancel' : 'Apply Leave'}
                </button>
            </div>

            {/* Balance Cards */}
            {balance && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: 'Monthly Allowed', value: balance.monthly?.allowed || 0, color: 'text-[#550fa8] bg-[#f7f3fc]' },
                        { label: 'Used This Month', value: balance.monthly?.used || 0, color: 'text-[#550fa8] bg-[#f7f3fc]' },
                        { label: 'Remaining', value: balance.monthly?.remaining || 0, color: 'text-emerald-600 bg-emerald-50' },
                        { label: 'LOP This Month', value: balance.monthly?.lopDays || 0, color: 'text-red-600 bg-red-50' },
                    ].map((item, i) => (
                        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                            <p className="text-xs font-medium text-slate-500 mb-1">{item.label}</p>
                            <p className={`text-2xl font-bold ${item.color.split(' ')[0]}`}>{item.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Apply Leave Form */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Apply for Leave</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Leave Type</label>
                            <select value={form.leaveType} onChange={e => setForm(p => ({ ...p, leaveType: e.target.value }))}
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30 bg-white">
                                <option>Casual Leave</option>
                                <option>Sick Leave</option>
                                <option>Personal Leave</option>
                                <option>Loss of Pay</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={form.isHalfDay} onChange={e => setForm(p => ({ ...p, isHalfDay: e.target.checked }))} className="accent-[#6412c6] w-4 h-4" />
                                <span className="text-sm text-slate-700 font-medium">Half Day</span>
                            </label>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
                            <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">End Date</label>
                            <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Reason</label>
                            <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} placeholder="Reason for leave"
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30 resize-none" />
                        </div>
                    </div>
                    <button onClick={handleSubmit} disabled={submitLoading}
                        className="mt-4 px-6 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl transition-all text-sm disabled:opacity-50">
                        {submitLoading ? 'Submitting...' : 'Submit Leave'}
                    </button>
                </div>
            )}

            {/* Leave History */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Leave History</h3>
                </div>
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : leaves.length === 0 ? (
                    <div className="text-center p-12">
                        <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No leave records found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Type</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">From</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">To</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Days</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">LOP</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Status</th>
                            </tr></thead>
                            <tbody>
                                {leaves.map(l => (
                                    <tr key={l._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">{l.leaveType}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{new Date(l.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{new Date(l.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                                        <td className="px-5 py-3.5 font-semibold">{l.totalDays}{l.isHalfDay ? ' (Half)' : ''}</td>
                                        <td className="px-5 py-3.5">{l.lopDays > 0 ? <span className="text-red-600 font-semibold">{l.lopDays}</span> : <span className="text-slate-400">0</span>}</td>
                                        <td className="px-5 py-3.5">
                                            {statusBadge(l.status)}
                                            {l.status === 'Rejected' && l.rejectionReason && (
                                                <p className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={l.rejectionReason}>Reason: {l.rejectionReason}</p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
