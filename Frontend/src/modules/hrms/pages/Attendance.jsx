import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Clock, Loader2, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Attendance() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [showRegForm, setShowRegForm] = useState(false);
    const [regForm, setRegForm] = useState({ date: '', requestedCheckInTime: '', requestedCheckOutTime: '', reason: '' });
    const [regLoading, setRegLoading] = useState(false);

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/attendance/me?month=${month}&year=${year}`);
            setRecords(res.data?.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchAttendance(); }, [month, year]);

    const prevMonth = () => {
        if (month === 1) { setMonth(12); setYear(y => y - 1); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setMonth(1); setYear(y => y + 1); }
        else setMonth(m => m + 1);
    };

    const submitRegularization = async () => {
        if (!regForm.date || !regForm.requestedCheckInTime || !regForm.requestedCheckOutTime || !regForm.reason) {
            return toast.error('All fields are required');
        }
        setRegLoading(true);
        try {
            await axiosInstance.post('/hrms/attendance/regularize', {
                date: regForm.date,
                requestedCheckInTime: `${regForm.date}T${regForm.requestedCheckInTime}:00`,
                requestedCheckOutTime: `${regForm.date}T${regForm.requestedCheckOutTime}:00`,
                reason: regForm.reason
            });
            toast.success('Regularization request submitted');
            setShowRegForm(false);
            setRegForm({ date: '', requestedCheckInTime: '', requestedCheckOutTime: '', reason: '' });
            fetchAttendance();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed to submit'); }
        finally { setRegLoading(false); }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const statusIcon = (status) => {
        if (status === 'Present') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        if (status === 'Absent') return <XCircle className="w-4 h-4 text-red-500" />;
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
                    <p className="text-sm text-slate-500 mt-1">Track your daily attendance and request regularizations</p>
                </div>
                <button onClick={() => setShowRegForm(!showRegForm)}
                    className="px-4 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl shadow-sm transition-all text-sm">
                    {showRegForm ? 'Cancel' : 'Request Regularization'}
                </button>
            </div>

            {/* Regularization Form */}
            {showRegForm && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Regularization Request</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Date</label>
                            <input type="date" value={regForm.date} onChange={e => setRegForm(p => ({ ...p, date: e.target.value }))}
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Reason</label>
                            <input value={regForm.reason} onChange={e => setRegForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g., Forgot to check in"
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Check-in Time</label>
                            <input type="time" value={regForm.requestedCheckInTime} onChange={e => setRegForm(p => ({ ...p, requestedCheckInTime: e.target.value }))}
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Check-out Time</label>
                            <input type="time" value={regForm.requestedCheckOutTime} onChange={e => setRegForm(p => ({ ...p, requestedCheckOutTime: e.target.value }))}
                                className="w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" />
                        </div>
                    </div>
                    <button onClick={submitRegularization} disabled={regLoading}
                        className="mt-4 px-6 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl transition-all text-sm disabled:opacity-50">
                        {regLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            )}

            {/* Month Navigator */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-4">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                <h2 className="font-bold text-slate-900 text-lg">{monthNames[month - 1]} {year}</h2>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>

            {/* Records Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : records.length === 0 ? (
                    <div className="text-center p-12">
                        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No attendance records for this month</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Date</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Status</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Check In</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Check Out</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Hours</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Location</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Regularization</th>
                            </tr></thead>
                            <tbody>
                                {records.map(r => (
                                    <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-5 py-3.5 font-medium text-slate-900">{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                                        <td className="px-5 py-3.5"><span className="flex items-center gap-1.5">{statusIcon(r.status)} {r.status}</span></td>
                                        <td className="px-5 py-3.5 text-slate-600">{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`font-semibold ${r.workingHours >= 8 ? 'text-emerald-600' : r.workingHours > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                {r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="text-xs space-y-1 max-w-[200px]">
                                                {r.employeeType === 'Office' && r.locationValidation?.officeName && (
                                                    <span className="text-emerald-600 font-medium block">🏢 {r.locationValidation.officeName}</span>
                                                )}
                                                {r.employeeType === 'Field' && r.routeDistance > 0 && (
                                                    <span className="text-[#550fa8] font-medium block">📍 {(r.routeDistance / 1000).toFixed(1)} km travelled</span>
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
                                                {!r.checkInLocation?.address && !r.checkOutLocation?.address && !r.locationValidation?.officeName && (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {r.regularization?.isRequested ? (
                                                <div className="flex flex-col">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium self-start ${
                                                        r.regularization.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' :
                                                        r.regularization.status === 'Rejected' ? 'bg-red-50 text-red-700' :
                                                        'bg-amber-50 text-amber-700'
                                                    }`}>{r.regularization.status}</span>
                                                    {r.regularization.status === 'Rejected' && r.regularization.rejectionReason && (
                                                        <p className="text-[10px] text-red-500 mt-1 max-w-[150px] truncate" title={r.regularization.rejectionReason}>Reason: {r.regularization.rejectionReason}</p>
                                                    )}
                                                </div>
                                            ) : <span className="text-slate-400">—</span>}
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
