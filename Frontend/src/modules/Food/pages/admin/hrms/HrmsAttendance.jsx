import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Clock, Loader2, CheckCircle, XCircle, CalendarDays } from 'lucide-react';

export default function HrmsAttendance({ defaultTab = 'attendance' }) {
    const [tab, setTab] = useState(defaultTab);
    const [records, setRecords] = useState([]);
    const [pendingRegs, setPendingRegs] = useState([]);
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                if (tab === 'attendance') {
                    const res = await axiosInstance.get(`/hrms/attendance?month=${month}&year=${year}`);
                    setRecords(res.data?.data?.records || []);
                } else if (tab === 'regularizations') {
                    const res = await axiosInstance.get('/hrms/attendance/pending-regularizations');
                    setPendingRegs(res.data?.data || []);
                } else if (tab === 'leaves') {
                    const res = await axiosInstance.get('/hrms/leaves/pending');
                    setPendingLeaves(res.data?.data || []);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, [tab, month, year]);

    const handleRegAction = async (id, action) => {
        try {
            let rejectionReason = '';
            if (action === 'Rejected') {
                rejectionReason = window.prompt("Please provide a reason for rejection:");
                if (rejectionReason === null) return;
            }
            await axiosInstance.post(`/hrms/attendance/regularize/${id}/action`, { action, rejectionReason });
            toast.success(`Regularization ${action.toLowerCase()}`);
            setPendingRegs(prev => prev.filter(r => r._id !== id));
        } catch (e) { toast.error(e.response?.data?.message || 'Action failed'); }
    };

    const handleLeaveAction = async (id, action) => {
        try {
            let rejectionReason = '';
            if (action === 'Rejected') {
                rejectionReason = window.prompt("Please provide a reason for rejection:");
                if (rejectionReason === null) return;
            }
            await axiosInstance.post(`/hrms/leaves/${id}/action`, { action, rejectionReason });
            toast.success(`Leave ${action.toLowerCase()}`);
            setPendingLeaves(prev => prev.filter(l => l._id !== id));
        } catch (e) { toast.error(e.response?.data?.message || 'Action failed'); }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Attendance & Leaves</h1>

            {/* Tabs */}
            <div className="flex gap-2">
                {[
                    { key: 'attendance', label: 'All Attendance' },
                    { key: 'regularizations', label: 'Pending Regularizations', count: pendingRegs.length },
                    { key: 'leaves', label: 'Pending Leaves', count: pendingLeaves.length },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'attendance' && (
                <div className="flex gap-3 items-center">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white">
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="h-10 px-3 border border-slate-200 rounded-xl text-sm bg-white">
                        {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : tab === 'attendance' ? (
                    records.length === 0 ? (
                        <div className="text-center p-12"><Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No attendance records</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Employee</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Date</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Check In</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Check Out</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Location</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Hours</th>
                                </tr></thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                            <td className="px-5 py-3.5 font-medium text-slate-900">{r.employeeId?.adminId?.name || '—'}</td>
                                            <td className="px-5 py-3.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${r.employeeType === 'Field' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>{r.employeeType === 'Field' ? 'Field' : 'Office'}</span></td>
                                            <td className="px-5 py-3.5 text-slate-600">{new Date(r.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}</td>
                                            <td className="px-5 py-3.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{r.status}</span></td>
                                            <td className="px-5 py-3.5 text-slate-600">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                                            <td className="px-5 py-3.5 text-slate-600">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="text-xs space-y-1 max-w-[200px]">
                                                    {r.employeeType === 'Office' && r.locationValidation?.officeName && (
                                                        <span className="text-emerald-600 font-medium block">🏢 {r.locationValidation.officeName}</span>
                                                    )}
                                                    {r.employeeType === 'Field' && r.routeDistance > 0 && (
                                                        <span className="text-blue-600 font-medium block">📍 {(r.routeDistance / 1000).toFixed(1)} km travelled</span>
                                                    )}
                                                    {r.checkInLocation?.address && (
                                                        <div className="text-slate-500 flex items-start gap-1" title={r.checkInLocation.address}>
                                                            <span className="text-[10px] font-bold text-emerald-600 uppercase shrink-0 mt-0.5">In:</span>
                                                            <span className="truncate">{r.checkInLocation.address}</span>
                                                        </div>
                                                    )}
                                                    {r.checkOutLocation?.address && (
                                                        <div className="text-slate-500 flex items-start gap-1" title={r.checkOutLocation.address}>
                                                            <span className="text-[10px] font-bold text-red-600 uppercase shrink-0 mt-0.5">Out:</span>
                                                            <span className="truncate">{r.checkOutLocation.address}</span>
                                                        </div>
                                                    )}
                                                    {r.employeeType === 'Field' && r.checkInTime && (
                                                        <a href={window.location.pathname.startsWith('/hrms') ? `/hrms/team/live-tracking?employeeId=${r.employeeId?._id}&date=${r.date.split('T')[0]}` : `/ecs/hrms/live-tracking?employeeId=${r.employeeId?._id}&date=${r.date.split('T')[0]}`} className="text-orange-500 hover:underline block mt-1 font-medium">View Route Map</a>
                                                    )}
                                                    {!r.checkInLocation?.address && !r.checkOutLocation?.address && !r.locationValidation?.officeName && (
                                                        <span className="text-slate-400">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold">{r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : tab === 'regularizations' ? (
                    pendingRegs.length === 0 ? (
                        <div className="text-center p-12"><CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No pending regularizations</p></div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingRegs.map(r => (
                                <div key={r._id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{r.employeeId?.adminId?.name}</p>
                                        <p className="text-sm text-slate-500">{new Date(r.date).toLocaleDateString('en-IN')} — {r.regularization?.reason}</p>
                                        <p className="text-xs text-slate-400">Requested: {r.regularization?.requestedCheckInTime ? new Date(r.regularization.requestedCheckInTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''} - {r.regularization?.requestedCheckOutTime ? new Date(r.regularization.requestedCheckOutTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleRegAction(r._id, 'Approved')} className="px-4 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium">Approve</button>
                                        <button onClick={() => handleRegAction(r._id, 'Rejected')} className="px-4 h-9 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl text-sm font-medium">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    pendingLeaves.length === 0 ? (
                        <div className="text-center p-12"><CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No pending leaves</p></div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingLeaves.map(l => (
                                <div key={l._id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div>
                                        <p className="font-medium text-slate-900">{l.employeeId?.adminId?.name}</p>
                                        <p className="text-sm text-slate-500">{l.leaveType} · {new Date(l.startDate).toLocaleDateString('en-IN')} to {new Date(l.endDate).toLocaleDateString('en-IN')} · {l.totalDays} day(s)</p>
                                        <p className="text-xs text-slate-400">Reason: {l.reason}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleLeaveAction(l._id, 'Approved')} className="px-4 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium">Approve</button>
                                        <button onClick={() => handleLeaveAction(l._id, 'Rejected')} className="px-4 h-9 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl text-sm font-medium">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
