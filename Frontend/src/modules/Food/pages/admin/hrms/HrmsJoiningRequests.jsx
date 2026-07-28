import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import {
    UserPlus, Loader2, Search, Eye, CheckCircle, XCircle,
    MessageSquare, ChevronLeft, ChevronRight, UserCog, X,
    FileText, ExternalLink, FileCheck, AlertTriangle, Award,
    Clock, Building, Phone, Mail, ShieldCheck, Download,
    Image as ImageIcon
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const statusStyles = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    Under_Review: 'bg-orange-50 text-orange-700 border-orange-200',
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
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Profile Edits State
    const [pendingEdits, setPendingEdits] = useState([]);

    const [approvalForm, setApprovalForm] = useState({
        department: '', designation: '', employmentType: 'Full-Time', joiningDate: new Date().toISOString().split('T')[0],
        shift: 'General', officeLocation: '', ctc: '', hrmsRole: 'Employee', managerId: '', employeeType: 'Office', assignedOfficeLocationId: '', assignedTeamMembers: []
    });
    const [rejectionReason, setRejectionReason] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [managers, setManagers] = useState([]);
    const [activeEmployees, setActiveEmployees] = useState([]);

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
            const [mgrRes, empRes] = await Promise.all([
                axiosInstance.get('/hrms/employees/managers/active').catch(() => ({ data: { data: [] } })),
                axiosInstance.get('/hrms/employees?status=Active&limit=200&excludeManagers=true').catch(() => ({ data: { data: { employees: [] } } }))
            ]);
            setManagers(mgrRes.data?.data || []);
            setActiveEmployees(empRes.data?.data?.employees || empRes.data?.data || []);
        } catch (e) { console.error('Failed to fetch managers and employees', e); }
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
                ...approvalForm,
                managerId: approvalForm.hrmsRole === 'Manager' ? null : (approvalForm.managerId || null),
                ctc: Number(approvalForm.ctc) || 0,
                assignedTeamMembers: approvalForm.assignedTeamMembers || []
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

    const handleSelectRequest = async (r) => {
        setSelectedRequest(r);
        setDetailLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/joining-requests/${r._id}`);
            if (res.data?.data) {
                const fullReq = res.data.data;
                setSelectedRequest(fullReq);
                setApprovalForm(prev => ({
                    ...prev,
                    department: fullReq.department || prev.department || '',
                    designation: fullReq.designation || prev.designation || '',
                    ctc: fullReq.ctc || prev.ctc || '',
                    hrmsRole: fullReq.hrmsRole || prev.hrmsRole || 'Employee',
                    managerId: fullReq.hrmsRole === 'Manager' ? '' : (prev.managerId || ''),
                    assignedTeamMembers: []
                }));
            }
        } catch (e) {
            console.error('Failed to fetch full request details:', e);
        } finally {
            setDetailLoading(false);
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
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 space-y-6 animate-in fade-in duration-200">
                            {/* Top Bar / Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                                <div className="flex items-center gap-4">
                                    {selectedRequest.profilePhotoUrl ? (
                                        <img src={selectedRequest.profilePhotoUrl} alt={selectedRequest.fullName} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl shadow-sm">
                                            {selectedRequest.fullName?.charAt(0) || 'U'}
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h2 className="text-xl font-bold text-slate-900">{selectedRequest.fullName}</h2>
                                            <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">{selectedRequest.requestId}</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[selectedRequest.status] || 'bg-slate-100 text-slate-600'}`}>
                                                {selectedRequest.status?.replace('_', ' ')}
                                            </span>
                                            {detailLoading && (
                                                <span className="flex items-center gap-1.5 text-xs text-orange-600 font-medium animate-pulse">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching complete documents...
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                            <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-slate-400" /> {selectedRequest.email}</span>
                                            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {selectedRequest.phone}</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> Applied on {new Date(selectedRequest.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors self-end sm:self-center">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Cards Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Card 1: Personal & Contact Information */}
                                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2.5">
                                        <UserPlus className="w-4 h-4 text-orange-500" /> Personal & Contact Information
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Gender</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.gender || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Date of Birth</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.dateOfBirth ? new Date(selectedRequest.dateOfBirth).toLocaleDateString('en-IN') : '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Employee Type</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.employeeType || 'Office'}</p>
                                        </div>
                                        <div className="col-span-2 sm:col-span-3">
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Full Residential Address</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">
                                                {selectedRequest.address ? (
                                                    [selectedRequest.address.street, selectedRequest.address.city, selectedRequest.address.state, selectedRequest.address.pincode, selectedRequest.address.country].filter(Boolean).join(', ') || '—'
                                                ) : '—'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-200/60">
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">Emergency Contact</p>
                                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                                                <span><span className="text-slate-500">Name:</span> <strong className="text-slate-800">{selectedRequest.emergencyContact?.name || '—'}</strong></span>
                                                <span><span className="text-slate-500">Relation:</span> <strong className="text-slate-800">{selectedRequest.emergencyContact?.relation || '—'}</strong></span>
                                                <span><span className="text-slate-500">Phone:</span> <strong className="text-slate-800 font-mono">{selectedRequest.emergencyContact?.phone || '—'}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Qualifications & Proposed Employment */}
                                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2.5">
                                        <Award className="w-4 h-4 text-orange-500" /> Qualifications & Role Preferences
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Qualification</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.qualification || '—'}</p>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Experience</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.experience || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pref. Department</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.preferredDepartment || selectedRequest.department || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pref. Designation</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.preferredDesignation || selectedRequest.designation || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Expected CTC</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.ctc ? `₹${selectedRequest.ctc.toLocaleString('en-IN')}` : '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pref. Joining Date</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.joiningDate ? new Date(selectedRequest.joiningDate).toLocaleDateString('en-IN') : '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Employment Type</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.employmentType || 'Full-Time'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pref. Shift / Office</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.shift || 'General'} · {selectedRequest.officeLocation || 'Any'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Bank Details */}
                                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2.5">
                                        <Building className="w-4 h-4 text-orange-500" /> Bank & Payout Information
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-sm">
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Bank Name</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.bankDetails?.bankName || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">A/C Holder Name</p>
                                            <p className="font-semibold text-slate-800 mt-0.5">{selectedRequest.bankDetails?.accountHolderName || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Account Number</p>
                                            <p className="font-semibold text-slate-800 font-mono mt-0.5">{selectedRequest.bankDetails?.accountNumber || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">IFSC Code</p>
                                            <p className="font-semibold text-slate-800 font-mono mt-0.5">{selectedRequest.bankDetails?.ifscCode || '—'}</p>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">UPI ID</p>
                                            <p className="font-semibold text-slate-800 font-mono mt-0.5">{selectedRequest.bankDetails?.upiId || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 4: KYC Documents & Photos Verification */}
                                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80 space-y-4">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2.5">
                                        <ShieldCheck className="w-4 h-4 text-orange-500" /> KYC Documents & Photos Verification
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                        {/* Aadhaar */}
                                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-sm">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                    <FileCheck className="w-3.5 h-3.5 text-emerald-500" /> Aadhaar Card
                                                </p>
                                                <p className="text-xs font-mono text-slate-500 mt-0.5">{selectedRequest.aadhaarNumber || 'Number Not Provided'}</p>
                                            </div>
                                            {selectedRequest.aadhaarPhotoUrl ? (
                                                <button onClick={() => window.open(selectedRequest.aadhaarPhotoUrl, '_blank')}
                                                    className="shrink-0 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors">
                                                    <ExternalLink className="w-3 h-3" /> View Photo
                                                </button>
                                            ) : (
                                                <span className="shrink-0 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-medium">Not Uploaded</span>
                                            )}
                                        </div>

                                        {/* PAN */}
                                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-sm">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                    <FileCheck className="w-3.5 h-3.5 text-orange-500" /> PAN Card
                                                </p>
                                                <p className="text-xs font-mono text-slate-500 mt-0.5">{selectedRequest.panNumber || 'Number Not Provided'}</p>
                                            </div>
                                            {selectedRequest.panPhotoUrl ? (
                                                <button onClick={() => window.open(selectedRequest.panPhotoUrl, '_blank')}
                                                    className="shrink-0 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors">
                                                    <ExternalLink className="w-3 h-3" /> View Photo
                                                </button>
                                            ) : (
                                                <span className="shrink-0 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-medium">Not Uploaded</span>
                                            )}
                                        </div>

                                        {/* Resume / CV */}
                                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-sm">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-amber-500" /> Resume / CV
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5 truncate">Applicant CV / Biodata</p>
                                            </div>
                                            {selectedRequest.resumeUrl ? (
                                                <button onClick={() => window.open(selectedRequest.resumeUrl, '_blank')}
                                                    className="shrink-0 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors">
                                                    <Download className="w-3 h-3" /> Open File
                                                </button>
                                            ) : (
                                                <span className="shrink-0 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-medium">Not Uploaded</span>
                                            )}
                                        </div>

                                        {/* Profile Photo Link */}
                                        <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-sm">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                    <ImageIcon className="w-3.5 h-3.5 text-purple-500" /> Profile Photo
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5 truncate">ID Card / Avatar Image</p>
                                            </div>
                                            {selectedRequest.profilePhotoUrl ? (
                                                <button onClick={() => window.open(selectedRequest.profilePhotoUrl, '_blank')}
                                                    className="shrink-0 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold rounded-lg text-xs flex items-center gap-1 transition-colors">
                                                    <ExternalLink className="w-3 h-3" /> View Photo
                                                </button>
                                            ) : (
                                                <span className="shrink-0 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[11px] font-medium">Not Uploaded</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Additional Documents List */}
                                    {Array.isArray(selectedRequest.documents) && selectedRequest.documents.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200/60">
                                            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Additional Uploaded Documents ({selectedRequest.documents.length})</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {selectedRequest.documents.map((doc, idx) => (
                                                    <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 shadow-sm">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-slate-800 truncate">{doc.name || `Document #${idx + 1}`}</p>
                                                            <span className="text-[10px] text-slate-400 uppercase font-medium">{doc.type || 'Certificate'}</span>
                                                        </div>
                                                        {doc.url && (
                                                            <button onClick={() => window.open(doc.url, '_blank')}
                                                                className="shrink-0 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors">
                                                                Open
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Online Assessment Results Card (If taken) */}
                            {selectedRequest.assessmentAttemptId && typeof selectedRequest.assessmentAttemptId === 'object' && (
                                <div className="bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-orange-50/80 rounded-2xl p-5 border border-orange-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-orange-200/80 pb-3">
                                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-orange-600" /> Online Assessment Verification Scorecard
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${selectedRequest.assessmentAttemptId.isPassed ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                                                {selectedRequest.assessmentAttemptId.isPassed ? 'Passed Assessment' : 'Did Not Pass'}
                                            </span>
                                            <span className="px-2.5 py-1 bg-white border border-orange-200 text-orange-800 rounded-lg text-xs font-semibold">
                                                Status: {selectedRequest.assessmentAttemptId.status?.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center bg-white/80 p-4 rounded-xl border border-orange-100 shadow-sm">
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Score</p>
                                            <p className="text-xl font-black text-slate-900 mt-0.5">{selectedRequest.assessmentAttemptId.percentage || selectedRequest.assessmentAttemptId.score || 0}%</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase">Correct Answers</p>
                                            <p className="text-xl font-black text-emerald-600 mt-0.5">{selectedRequest.assessmentAttemptId.correctCount || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase">Wrong Answers</p>
                                            <p className="text-xl font-black text-red-600 mt-0.5">{selectedRequest.assessmentAttemptId.wrongCount || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase">Skipped</p>
                                            <p className="text-xl font-black text-slate-600 mt-0.5">{selectedRequest.assessmentAttemptId.skippedCount || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 uppercase">Time Taken</p>
                                            <p className="text-xl font-black text-slate-800 mt-0.5">
                                                {selectedRequest.assessmentAttemptId.durationSeconds ? `${Math.floor(selectedRequest.assessmentAttemptId.durationSeconds / 60)}m ${selectedRequest.assessmentAttemptId.durationSeconds % 60}s` : '—'}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedRequest.assessmentAttemptId.retakeRequested && (
                                        <div className="p-3 bg-amber-100/90 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="font-bold">Applicant Requested Retake:</strong> &ldquo;{selectedRequest.assessmentAttemptId.retakeReason || 'No reason specified'}&rdquo;
                                                <span className="block text-[11px] text-amber-700 mt-0.5">Requested on: {selectedRequest.assessmentAttemptId.retakeRequestedAt ? new Date(selectedRequest.assessmentAttemptId.retakeRequestedAt).toLocaleDateString('en-IN') : '—'}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status History */}
                            {selectedRequest.statusHistory?.length > 0 && (
                                <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80">
                                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-orange-500" /> Status & Audit Timeline
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedRequest.statusHistory.map((h, i) => (
                                            <div key={i} className="flex items-center gap-3 text-sm bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-xs">
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusStyles[h.status] || 'bg-slate-100 text-slate-600'}`}>{h.status?.replace('_', ' ')}</span>
                                                <span className="text-slate-600 font-medium">{h.reason || 'Status updated'}</span>
                                                <span className="text-slate-400 text-xs ml-auto shrink-0 font-mono">{new Date(h.changedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Panels */}
                            {selectedRequest.status !== 'Approved' && selectedRequest.status !== 'Rejected' && (
                                <div className="space-y-4 pt-4 border-t border-slate-200">
                                    <details className="group">
                                        <summary className="flex items-center gap-2 cursor-pointer text-orange-600 font-bold text-sm hover:text-orange-700 transition-colors bg-orange-50/60 p-3.5 rounded-xl border border-orange-200/60 shadow-xs">
                                            <CheckCircle className="w-4 h-4 text-orange-600" /> Approve & Onboard as Active Employee
                                        </summary>
                                        <div className="mt-4 p-5 bg-slate-50/80 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Department *</label>
                                                <input className={inputClass} value={approvalForm.department} onChange={e => setApprovalForm(p => ({ ...p, department: e.target.value }))} placeholder="e.g., Engineering" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Designation *</label>
                                                <input className={inputClass} value={approvalForm.designation} onChange={e => setApprovalForm(p => ({ ...p, designation: e.target.value }))} placeholder="e.g., Associate" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">CTC (Annual ₹)</label>
                                                <input type="number" className={inputClass} value={approvalForm.ctc} onChange={e => setApprovalForm(p => ({ ...p, ctc: e.target.value }))} placeholder="e.g., 600000" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Joining Date *</label>
                                                <input type="date" className={inputClass} value={approvalForm.joiningDate} onChange={e => setApprovalForm(p => ({ ...p, joiningDate: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Shift</label>
                                                <input className={inputClass} value={approvalForm.shift} onChange={e => setApprovalForm(p => ({ ...p, shift: e.target.value }))} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">HRMS Role</label>
                                                <select className={inputClass} value={approvalForm.hrmsRole} onChange={e => setApprovalForm(p => ({ ...p, hrmsRole: e.target.value, managerId: e.target.value === 'Manager' ? '' : p.managerId }))}>
                                                    <option value="Employee">Employee</option>
                                                    <option value="Manager">Manager</option>
                                                    <option value="HR">HR</option>
                                                </select>
                                            </div>
                                            {approvalForm.hrmsRole === 'Manager' ? (
                                                <div className="sm:col-span-2 lg:col-span-3 bg-amber-50/90 border border-amber-300 p-3.5 rounded-xl flex items-center gap-3">
                                                    <div className="text-xs text-amber-900">
                                                        <span className="font-bold block text-sm mb-0.5">🚀 Manager Role Selected — No Reporting Manager Assigned</span>
                                                        As this person is onboarding as a Manager, they will not be assigned a reporting manager.
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="sm:col-span-2 lg:col-span-3">
                                                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Reporting Manager</label>
                                                    <select className={inputClass} value={approvalForm.managerId} onChange={e => setApprovalForm(p => ({ ...p, managerId: e.target.value }))}>
                                                        <option value="">-- No Manager Assigned --</option>
                                                        {managers.map(m => (
                                                            <option key={m._id} value={m._id}>{m.adminId?.name} ({m.employeeId})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {approvalForm.hrmsRole === 'Manager' && (
                                                <div className="sm:col-span-2 lg:col-span-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                                                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                                        <span>👥 Assign Team Members Under This Manager</span>
                                                        <span className="text-[11px] font-normal text-slate-500">Check employees to report to this manager</span>
                                                    </label>
                                                    <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1 bg-slate-50/50">
                                                        {(() => {
                                                            const selectableEmps = activeEmployees.filter(emp =>
                                                                ((approvalForm.assignedTeamMembers || []).includes(emp._id) || !emp.managerId) &&
                                                                emp.hrmsRole !== 'Manager' &&
                                                                emp.hrmsRole !== 'HR' &&
                                                                emp.status === 'Active'
                                                            );
                                                            if (selectableEmps.length === 0) {
                                                                return <p className="text-xs text-slate-400 p-3 text-center">No unassigned active employees available. Already assigned employees & managers are hidden to prevent duplicates.</p>;
                                                            }
                                                            return selectableEmps.map(emp => {
                                                                const isChecked = (approvalForm.assignedTeamMembers || []).includes(emp._id);
                                                                return (
                                                                    <label key={emp._id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs transition-colors ${isChecked ? 'bg-orange-50/90 border border-orange-200 text-orange-900 font-semibold' : 'hover:bg-slate-100/80 text-slate-700'}`}>
                                                                        <input type="checkbox" checked={isChecked} onChange={e => {
                                                                            const checked = e.target.checked;
                                                                            setApprovalForm(p => ({
                                                                                ...p,
                                                                                assignedTeamMembers: checked
                                                                                    ? [...(p.assignedTeamMembers || []), emp._id]
                                                                                    : (p.assignedTeamMembers || []).filter(id => id !== emp._id)
                                                                            }));
                                                                        }} className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4" />
                                                                        <span className="font-mono text-slate-500 text-[11px]">{emp.employeeId}</span>
                                                                        <span>{emp.adminId?.name || 'Unknown'}</span>
                                                                        <span className="text-slate-400 ml-auto">({emp.department || 'General'})</span>
                                                                    </label>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="sm:col-span-2 lg:col-span-3 pt-2">
                                                <button onClick={handleApprove} disabled={actionLoading}
                                                    className="px-6 h-11 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all text-sm disabled:opacity-50 shadow-md flex items-center justify-center gap-2">
                                                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                                    {actionLoading ? 'Processing Approval...' : 'Approve Application & Create Employee Record'}
                                                </button>
                                            </div>
                                        </div>
                                    </details>

                                    <details className="group">
                                        <summary className="flex items-center gap-2 cursor-pointer text-red-600 font-bold text-sm hover:text-red-700 transition-colors bg-red-50/60 p-3.5 rounded-xl border border-red-200/60 shadow-xs">
                                            <XCircle className="w-4 h-4 text-red-600" /> Reject Application
                                        </summary>
                                        <div className="mt-3 p-5 bg-red-50/40 rounded-2xl border border-red-200/80">
                                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Reason for Rejection *</label>
                                            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={3} placeholder="Please explain clearly why the application is being rejected..."
                                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none bg-white" />
                                            <button onClick={handleReject} disabled={actionLoading}
                                                className="mt-3 px-6 h-10 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50 shadow-sm flex items-center gap-2">
                                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                Confirm Rejection
                                            </button>
                                        </div>
                                    </details>

                                                     <summary className="flex items-center gap-2 cursor-pointer text-orange-600 font-bold text-sm hover:text-orange-700 transition-colors bg-orange-50/60 p-3.5 rounded-xl border border-orange-200/60 shadow-xs">
                                            <MessageSquare className="w-4 h-4 text-orange-600" /> Request More Information / Clarification
                                        </summary>
                                        <div className="mt-3 p-5 bg-orange-50/40 rounded-2xl border border-orange-200/80">
                                            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">Message to Applicant *</label>
                                            <textarea value={infoMessage} onChange={e => setInfoMessage(e.target.value)} rows={3} placeholder="Specify what documents or details need clarification..."
                                                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none bg-white" />
                                            <button onClick={handleRequestInfo} disabled={actionLoading}
                                                className="mt-3 px-6 h-10 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50 shadow-sm flex items-center gap-2">sabled:opacity-50 shadow-sm flex items-center gap-2">
                                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                                Send Information Request
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
                                                    <button onClick={() => handleSelectRequest(r)}
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
