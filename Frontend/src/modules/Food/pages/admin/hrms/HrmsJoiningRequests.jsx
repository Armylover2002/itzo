import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import {
    UserPlus, Loader2, Search, Eye, CheckCircle, XCircle,
    MessageSquare, ChevronLeft, ChevronRight, UserCog, X
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const statusStyles = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Under_Review: 'bg-orange-50 text-blue-700 border-blue-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-red-50 text-red-700 border-red-200',
    Info_Requested: 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function HrmsJoiningRequests() {
    const [searchParams] = useSearchParams();
    const [mainTab, setMainTab] = useState(searchParams.get('tab') || 'joining'); // 'joining' or 'edits'
    
    // Joining Requests State
    const [requests, setRequests] = useState([]);
    const [counts, setCounts] = useState({});
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'Pending');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Profile Edits State
    const [pendingEdits, setPendingEdits] = useState([]);

    const [approvalForm, setApprovalForm] = useState({
        department: '', designation: '', employmentType: 'Full-Time', joiningDate: new Date().toISOString().split('T')[0],
        shift: 'General', officeLocation: '', ctc: '', hrmsRole: 'Employee', managerId: '', employeeType: 'Office', assignedOfficeLocationId: ''
    });
    const [rejectionReason, setRejectionReason] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [managers, setManagers] = useState([]);

    const fetchRequests = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            if (mainTab === 'joining') {
                const params = new URLSearchParams({ page, limit: 15, status: statusFilter });
                if (search) params.append('search', search);
                const res = await axiosInstance.get(`/hrms/joining-requests?${params}`);
                const data = res.data?.data || {};
                setRequests(data.requests || []);
                setCounts(data.counts || {});
                setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
            } else {
                const res = await axiosInstance.get('/hrms/employees/pending-edits');
                setPendingEdits(res.data?.data || []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [statusFilter, search, mainTab]);

    const fetchManagers = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/hrms/employees/managers/active');
            setManagers(res.data?.data || []);
        } catch (e) { console.error('Failed to fetch managers', e); }
    }, []);

    useEffect(() => { 
        fetchRequests(); 
        if (mainTab === 'joining') fetchManagers();
    }, [fetchRequests, fetchManagers, mainTab]);

    const handleApprove = async () => {
        if (!approvalForm.department || !approvalForm.designation || !approvalForm.joiningDate) {
            return toast.error('Department, designation, and joining date are required');
        }
        setActionLoading(true);
        try {
            await axiosInstance.post(`/hrms/joining-requests/${selectedRequest._id}/approve`, {
                ...approvalForm, ctc: Number(approvalForm.ctc) || 0
            });
            toast.success('Request approved! Employee can now login.');
            setSelectedRequest(null);
            fetchRequests();
        } catch (e) { toast.error(e.response?.data?.message || 'Approval failed'); }
        finally { setActionLoading(false); }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) return toast.error('Rejection reason is required');
        setActionLoading(true);
        try {
            await axiosInstance.post(`/hrms/joining-requests/${selectedRequest._id}/reject`, { rejectionReason });
            toast.success('Request rejected');
            setSelectedRequest(null);
            setRejectionReason('');
            fetchRequests();
        } catch (e) { toast.error(e.response?.data?.message || 'Rejection failed'); }
        finally { setActionLoading(false); }
    };

    const handleRequestInfo = async () => {
        if (!infoMessage.trim()) return toast.error('Message is required');
        setActionLoading(true);
        try {
            await axiosInstance.post(`/hrms/joining-requests/${selectedRequest._id}/request-info`, { message: infoMessage });
            toast.success('Information request sent');
            setSelectedRequest(null);
            setInfoMessage('');
            fetchRequests();
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
        finally { setActionLoading(false); }
    };

    const handleEditAction = async (id, action) => {
        try {
            let reason = '';
            if (action === 'Rejected') {
                reason = window.prompt("Please provide a reason for rejecting this profile edit:");
                if (reason === null) return;
            }
            await axiosInstance.post(`/hrms/employees/${id}/edit-request/action`, { action, rejectionReason: reason });
            toast.success(`Profile edit ${action.toLowerCase()}`);
            fetchRequests();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Action failed');
        }
    };

    const inputClass = "w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Joining & Approvals</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage new applications and employee profile edits</p>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => setMainTab('joining')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        mainTab === 'joining'
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}>
                    New Joining Requests
                </button>
                <button onClick={() => setMainTab('edits')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        mainTab === 'edits'
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}>
                    Edited Profile Approvals
                    {pendingEdits.length > 0 && <span className="ml-2 px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs">{pendingEdits.length}</span>}
                </button>
            </div>

            {mainTab === 'joining' ? (
                <>
                    {/* Status Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'Pending', label: 'Pending', count: counts.pending },
                            { key: 'all', label: 'All', count: counts.total },
                            { key: 'Approved', label: 'Approved', count: counts.approved },
                            { key: 'Rejected', label: 'Rejected', count: counts.rejected },
                            { key: 'Info_Requested', label: 'Info Requested', count: counts.infoRequested },
                        ].map(tab => (
                            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    statusFilter === tab.key
                                        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                }`}>
                                {tab.label} {tab.count !== undefined && <span className="ml-1.5 text-xs opacity-80">({tab.count})</span>}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, phone, or request ID..."
                            className="w-full h-11 pl-11 pr-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white" />
                    </div>

                    {/* Detail View */}
                    {selectedRequest && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-slate-900">
                                    {selectedRequest.fullName}
                                    <span className="text-sm font-normal text-slate-400 ml-2">{selectedRequest.requestId}</span>
                                </h2>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                                {[
                                    { l: 'Email', v: selectedRequest.email },
                                    { l: 'Phone', v: selectedRequest.phone },
                                    { l: 'Gender', v: selectedRequest.gender },
                                    { l: 'DOB', v: selectedRequest.dateOfBirth ? new Date(selectedRequest.dateOfBirth).toLocaleDateString('en-IN') : '—' },
                                    { l: 'Aadhaar', v: selectedRequest.aadhaarNumber },
                                    { l: 'PAN', v: selectedRequest.panNumber },
                                    { l: 'Qualification', v: selectedRequest.qualification },
                                    { l: 'Experience', v: selectedRequest.experience },
                                    { l: 'Preferred Dept', v: selectedRequest.preferredDepartment },
                                    { l: 'Preferred Designation', v: selectedRequest.preferredDesignation },
                                    { l: 'City', v: selectedRequest.address?.city },
                                    { l: 'State', v: selectedRequest.address?.state },
                                    { l: 'Bank', v: selectedRequest.bankDetails?.bankName },
                                    { l: 'A/C Holder', v: selectedRequest.bankDetails?.accountHolderName },
                                    { l: 'Emergency', v: selectedRequest.emergencyContact?.name ? `${selectedRequest.emergencyContact.name} (${selectedRequest.emergencyContact.relation})` : '—' },
                                    { l: 'Applied On', v: new Date(selectedRequest.createdAt).toLocaleDateString('en-IN') },
                                ].map((f, i) => (
                                    <div key={i} className="min-w-0">
                                        <p className="text-xs text-slate-500">{f.l}</p>
                                        <p className="font-medium text-slate-900 truncate" title={f.v}>{f.v || '—'}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Status History */}
                            {selectedRequest.statusHistory?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Status History</h4>
                                    <div className="space-y-1.5">
                                        {selectedRequest.statusHistory.map((h, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyles[h.status] || 'bg-slate-100 text-slate-600'}`}>{h.status?.replace('_', ' ')}</span>
                                                <span className="text-slate-500">{new Date(h.changedAt).toLocaleDateString('en-IN')} — {h.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Panels */}
                            {selectedRequest.status !== 'Approved' && selectedRequest.status !== 'Rejected' && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <details className="group">
                                        <summary className="flex items-center gap-2 cursor-pointer text-orange-600 font-semibold text-sm">
                                            <CheckCircle className="w-4 h-4" /> Approve & Onboard
                                        </summary>
                                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Department *</label>
                                                <input className={inputClass} value={approvalForm.department} onChange={e => setApprovalForm(p => ({ ...p, department: e.target.value }))} placeholder="e.g., Engineering" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Designation *</label>
                                                <input className={inputClass} value={approvalForm.designation} onChange={e => setApprovalForm(p => ({ ...p, designation: e.target.value }))} placeholder="e.g., Associate" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">CTC (Annual ₹)</label>
                                                <input type="number" className={inputClass} value={approvalForm.ctc} onChange={e => setApprovalForm(p => ({ ...p, ctc: e.target.value }))} placeholder="e.g., 600000" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Joining Date *</label>
                                                <input type="date" className={inputClass} value={approvalForm.joiningDate} onChange={e => setApprovalForm(p => ({ ...p, joiningDate: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Shift</label>
                                                <input className={inputClass} value={approvalForm.shift} onChange={e => setApprovalForm(p => ({ ...p, shift: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">HRMS Role</label>
                                                <select className={inputClass} value={approvalForm.hrmsRole} onChange={e => setApprovalForm(p => ({ ...p, hrmsRole: e.target.value }))}>
                                                    <option>Employee</option>
                                                    <option>Manager</option>
                                                    <option>HR</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Reporting Manager</label>
                                                <select className={inputClass} value={approvalForm.managerId} onChange={e => setApprovalForm(p => ({ ...p, managerId: e.target.value }))}>
                                                    <option value="">-- No Manager --</option>
                                                    {managers.map(m => (
                                                        <option key={m._id} value={m._id}>{m.adminId?.name} ({m.employeeId})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <button onClick={handleApprove} disabled={actionLoading}
                                            className="mt-4 px-6 h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50 shadow-sm">
                                            {actionLoading ? 'Processing...' : 'Approve & Create Employee'}
                                        </button>
                                    </details>

                                    <details className="group">
                                        <summary className="flex items-center gap-2 cursor-pointer text-red-600 font-semibold text-sm">
                                            <XCircle className="w-4 h-4" /> Reject Application
                                        </summary>
                                        <div className="mt-4">
                                            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2} placeholder="Reason for rejection (required)"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none" />
                                            <button onClick={handleReject} disabled={actionLoading}
                                                className="mt-2 px-6 h-10 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl transition-all text-sm disabled:opacity-50">
                                                {actionLoading ? 'Processing...' : 'Reject'}
                                            </button>
                                        </div>
                                    </details>

                                    <details className="group">
                                        <summary className="flex items-center gap-2 cursor-pointer text-orange-600 font-semibold text-sm">
                                            <MessageSquare className="w-4 h-4" /> Request More Information
                                        </summary>
                                        <div className="mt-4">
                                            <textarea value={infoMessage} onChange={e => setInfoMessage(e.target.value)} rows={2} placeholder="What information do you need?"
                                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none" />
                                            <button onClick={handleRequestInfo} disabled={actionLoading}
                                                className="mt-2 px-6 h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50">
                                                {actionLoading ? 'Sending...' : 'Send Request'}
                                            </button>
                                        </div>
                                    </details>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Requests Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                        ) : requests.length === 0 ? (
                            <div className="text-center p-12">
                                <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No joining requests found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Request ID</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Name</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Email</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Phone</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Applied</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Status</th>
                                        <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Action</th>
                                    </tr></thead>
                                    <tbody>
                                        {requests.map(r => (
                                            <tr key={r._id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                                <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{r.requestId}</td>
                                                <td className="px-5 py-3.5 font-medium text-slate-900">{r.fullName}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{r.email}</td>
                                                <td className="px-5 py-3.5 text-slate-600">{r.phone}</td>
                                                <td className="px-5 py-3.5 text-slate-500 text-xs">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyles[r.status] || ''}`}>
                                                        {r.status?.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <button onClick={() => setSelectedRequest(r)}
                                                        className="flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-medium text-xs">
                                                        <Eye className="w-3.5 h-3.5" /> View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                                <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} results</span>
                                <div className="flex gap-2">
                                    <button onClick={() => fetchRequests(pagination.page - 1)} disabled={pagination.page <= 1}
                                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                                    <button onClick={() => fetchRequests(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
                                        className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                    ) : pendingEdits.length === 0 ? (
                        <div className="text-center p-12">
                            <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-medium">No pending profile edits</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {pendingEdits.map(edit => (
                                <div key={edit._id} className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-semibold text-slate-900">{edit.adminId?.name || 'Employee'}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">ID: {edit.employeeId} · Dept: {edit.department}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEditAction(edit._id, 'Approved')} className="px-4 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm">
                                                Approve
                                            </button>
                                            <button onClick={() => handleEditAction(edit._id, 'Rejected')} className="px-4 h-9 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl text-sm font-medium transition-all shadow-sm">
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Requested Changes</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.entries(edit.pendingProfileEdit || {}).map(([key, val]) => {
                                                if (typeof val === 'object' && val !== null) {
                                                    return Object.entries(val).map(([subKey, subVal]) => (
                                                        <div key={`${key}.${subKey}`}>
                                                            <p className="text-[10px] text-slate-400 uppercase">{key} &rsaquo; {subKey}</p>
                                                            <p className="text-sm font-medium text-slate-900 break-words">{subVal || '—'}</p>
                                                        </div>
                                                    ));
                                                }
                                                return (
                                                    <div key={key}>
                                                        <p className="text-[10px] text-slate-400 uppercase">{key}</p>
                                                        <p className="text-sm font-medium text-slate-900 break-words">{val || '—'}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
