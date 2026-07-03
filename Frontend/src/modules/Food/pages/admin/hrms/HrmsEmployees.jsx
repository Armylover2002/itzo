import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Users, Loader2, Search, Eye, Plus, ChevronLeft, ChevronRight, X, UserPlus, FileText, Upload, MapPin, Building2, Filter } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useHrmsSettings } from '../../../../hrms/context/HrmsSettingsContext';

export default function HrmsEmployees() {
    const [searchParams] = useSearchParams();
    const [employees, setEmployees] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [showOnboard, setShowOnboard] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [onboardLoading, setOnboardLoading] = useState(false);
    const [filterEmployeeType, setFilterEmployeeType] = useState('all');
    const [managers, setManagers] = useState([]);
    const { hrmsSettings } = useHrmsSettings();

    const [onboardForm, setOnboardForm] = useState({
        fullName: '', email: '', password: '', phone: '',
        dateOfBirth: '', gender: '',
        street: '', city: '', state: '', pincode: '',
        aadhaarNumber: '', aadhaarPhotoUrl: '', panNumber: '', panPhotoUrl: '',
        qualification: '', experience: '',
        department: '', designation: '',
        accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '',
        emergencyName: '', emergencyRelation: '', emergencyPhone: '',
        employmentType: 'Full-Time', joiningDate: new Date().toISOString().split('T')[0],
        shift: 'General', ctc: '', hrmsRole: 'Employee', officeLocation: '',
        employeeType: 'Office', assignedOfficeLocationId: ''
    });
    const [uploading, setUploading] = useState({ aadhaar: false, pan: false });

    const fetchEmployees = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20, status: 'Active' });
            if (search) params.append('search', search);
            if (filterEmployeeType !== 'all') params.append('employeeType', filterEmployeeType);
            const res = await axiosInstance.get(`/hrms/employees?${params}`);
            const data = res.data?.data || {};
            setEmployees(data.employees || []);
            setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [search, filterEmployeeType]);

    const fetchManagers = useCallback(async () => {
        try {
            const res = await axiosInstance.get('/hrms/employees/managers/active');
            setManagers(res.data?.data || []);
        } catch (e) { console.error('Failed to fetch managers', e); }
    }, []);

    useEffect(() => { 
        fetchEmployees(); 
        fetchManagers();
    }, [fetchEmployees, fetchManagers]);

    const handleOnboard = async () => {
        if (!onboardForm.fullName || !onboardForm.email || !onboardForm.password || !onboardForm.joiningDate) {
            return toast.error('Name, email, password, and joining date are required');
        }
        setOnboardLoading(true);
        try {
            const payload = {
                ...onboardForm,
                ctc: Number(onboardForm.ctc) || 0,
                assignedOfficeLocationId: onboardForm.assignedOfficeLocationId || null,
                managerId: onboardForm.managerId || null,
                address: {
                    street: onboardForm.street, city: onboardForm.city,
                    state: onboardForm.state, pincode: onboardForm.pincode
                },
                bankDetails: {
                    accountHolderName: onboardForm.accountHolderName,
                    accountNumber: onboardForm.accountNumber,
                    bankName: onboardForm.bankName,
                    ifscCode: onboardForm.ifscCode,
                    upiId: onboardForm.upiId
                },
                emergencyContact: {
                    name: onboardForm.emergencyName,
                    relation: onboardForm.emergencyRelation,
                    phone: onboardForm.emergencyPhone
                }
            };
            await axiosInstance.post('/hrms/employees', payload);
            toast.success('Employee onboarded successfully');
            setShowOnboard(false);
            setOnboardForm({
                fullName: '', email: '', password: '', phone: '', dateOfBirth: '', gender: '',
                street: '', city: '', state: '', pincode: '', aadhaarNumber: '', aadhaarPhotoUrl: '', panNumber: '', panPhotoUrl: '',
                qualification: '', experience: '', department: '', designation: '',
                accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '',
                emergencyName: '', emergencyRelation: '', emergencyPhone: '',
                employmentType: 'Full-Time', joiningDate: new Date().toISOString().split('T')[0],
                shift: 'General', ctc: '', hrmsRole: 'Employee', officeLocation: '',
                employeeType: 'Office', assignedOfficeLocationId: '', managerId: ''
            });
            fetchEmployees();
        } catch (e) { toast.error(e.response?.data?.message || 'Onboarding failed'); }
        finally { setOnboardLoading(false); }
    };

    const handleFileUpload = async (field, file) => {
        if (!file) return;
        setUploading(prev => ({ ...prev, [field]: true }));
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', `hrms/employees/${field}s`);
            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data?.url || res.data?.data?.url || res.data?.imageUrl;
            if (!url) throw new Error('No URL returned from server');
            setOnboardForm(prev => ({ ...prev, [`${field}PhotoUrl`]: url }));
            toast.success(`${field.toUpperCase()} uploaded successfully`);
        } catch (e) {
            toast.error(e.response?.data?.message || `Failed to upload ${field}`);
        } finally {
            setUploading(prev => ({ ...prev, [field]: false }));
        }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await axiosInstance.patch(`/hrms/employees/${id}/status`, { status });
            toast.success(`Employee ${status.toLowerCase()}`);
            fetchEmployees();
            setSelectedEmployee(null);
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    };

    const inputClass = "w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Employee Management</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your active workforce</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="/ecs/hrms/employee-docs" className="flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl shadow-sm transition-all text-sm">
                        <FileText className="w-4 h-4" /> Employee Docs
                    </a>
                    <button onClick={() => setShowOnboard(!showOnboard)}
                        className="flex items-center gap-2 px-4 h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl shadow-sm transition-all text-sm">
                        {showOnboard ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                        {showOnboard ? 'Cancel' : 'Direct Onboard'}
                    </button>
                </div>
            </div>

            {/* Direct Onboard Form */}
            {showOnboard && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
                    <h3 className="font-semibold text-slate-900 mb-6 text-lg">Direct Employee Onboarding</h3>
                    <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-8">
                        {/* 1. Personal Info */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide bg-slate-50 p-2 rounded">1. Personal Information</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Full Name *</label><input className={inputClass} value={onboardForm.fullName} onChange={e => setOnboardForm(p => ({ ...p, fullName: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Email *</label><input type="email" className={inputClass} value={onboardForm.email} onChange={e => setOnboardForm(p => ({ ...p, email: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Password *</label><input type="password" className={inputClass} value={onboardForm.password} onChange={e => setOnboardForm(p => ({ ...p, password: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Phone</label><input className={inputClass} value={onboardForm.phone} onChange={e => setOnboardForm(p => ({ ...p, phone: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Date of Birth</label><input type="date" className={inputClass} value={onboardForm.dateOfBirth} onChange={e => setOnboardForm(p => ({ ...p, dateOfBirth: e.target.value }))} /></div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Gender</label>
                                    <select className={inputClass} value={onboardForm.gender} onChange={e => setOnboardForm(p => ({ ...p, gender: e.target.value }))}>
                                        <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 2. Address & KYC */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide bg-slate-50 p-2 rounded">2. Address & KYC</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Street Address</label><input className={inputClass} value={onboardForm.street} onChange={e => setOnboardForm(p => ({ ...p, street: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">City</label><input className={inputClass} value={onboardForm.city} onChange={e => setOnboardForm(p => ({ ...p, city: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">State</label><input className={inputClass} value={onboardForm.state} onChange={e => setOnboardForm(p => ({ ...p, state: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Pincode</label><input className={inputClass} value={onboardForm.pincode} onChange={e => setOnboardForm(p => ({ ...p, pincode: e.target.value }))} maxLength={6} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Aadhaar Number</label><input className={inputClass} value={onboardForm.aadhaarNumber} onChange={e => setOnboardForm(p => ({ ...p, aadhaarNumber: e.target.value }))} maxLength={12} /></div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Upload Aadhaar</label>
                                    <div className="relative">
                                        <input type="file" id="admin-aadhaar-upload" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload('aadhaar', e.target.files?.[0])} />
                                        <label htmlFor="admin-aadhaar-upload" className={`flex items-center justify-center gap-2 w-full h-10 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${onboardForm.aadhaarPhotoUrl ? 'text-emerald-600 border-emerald-300' : 'text-slate-500'}`}>
                                            {uploading.aadhaar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            <span className="text-xs font-medium">{uploading.aadhaar ? 'Uploading...' : onboardForm.aadhaarPhotoUrl ? 'Uploaded' : 'Upload File'}</span>
                                        </label>
                                    </div>
                                </div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">PAN Number</label><input className={inputClass} value={onboardForm.panNumber} onChange={e => setOnboardForm(p => ({ ...p, panNumber: e.target.value.toUpperCase() }))} maxLength={10} /></div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Upload PAN</label>
                                    <div className="relative">
                                        <input type="file" id="admin-pan-upload" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload('pan', e.target.files?.[0])} />
                                        <label htmlFor="admin-pan-upload" className={`flex items-center justify-center gap-2 w-full h-10 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${onboardForm.panPhotoUrl ? 'text-emerald-600 border-emerald-300' : 'text-slate-500'}`}>
                                            {uploading.pan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            <span className="text-xs font-medium">{uploading.pan ? 'Uploading...' : onboardForm.panPhotoUrl ? 'Uploaded' : 'Upload File'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Role Details & Qualifications */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide bg-slate-50 p-2 rounded">3. Role Details & Qualifications</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Highest Qualification</label><input className={inputClass} value={onboardForm.qualification} onChange={e => setOnboardForm(p => ({ ...p, qualification: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Experience</label><input className={inputClass} value={onboardForm.experience} onChange={e => setOnboardForm(p => ({ ...p, experience: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Department</label><input className={inputClass} value={onboardForm.department} onChange={e => setOnboardForm(p => ({ ...p, department: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Designation</label><input className={inputClass} value={onboardForm.designation} onChange={e => setOnboardForm(p => ({ ...p, designation: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">CTC (Annual ₹)</label><input type="number" className={inputClass} value={onboardForm.ctc} onChange={e => setOnboardForm(p => ({ ...p, ctc: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Joining Date *</label><input type="date" className={inputClass} value={onboardForm.joiningDate} onChange={e => setOnboardForm(p => ({ ...p, joiningDate: e.target.value }))} /></div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">HRMS Role</label>
                                    <select className={inputClass} value={onboardForm.hrmsRole} onChange={e => setOnboardForm(p => ({ ...p, hrmsRole: e.target.value }))}>
                                        <option>Employee</option><option>Manager</option><option>HR</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Reporting Manager</label>
                                    <select className={inputClass} value={onboardForm.managerId} onChange={e => setOnboardForm(p => ({ ...p, managerId: e.target.value }))}>
                                        <option value="">-- No Manager --</option>
                                        {managers.map(m => (
                                            <option key={m._id} value={m._id}>{m.adminId?.name} ({m.employeeId})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Shift</label>
                                    <select className={inputClass} value={onboardForm.shift} onChange={e => setOnboardForm(p => ({ ...p, shift: e.target.value }))}>
                                        <option>General</option><option>Morning</option><option>Night</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Employment Type</label>
                                    <select className={inputClass} value={onboardForm.employmentType} onChange={e => setOnboardForm(p => ({ ...p, employmentType: e.target.value }))}>
                                        <option>Full-Time</option><option>Part-Time</option><option>Contract</option><option>Internship</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Employee Type</label>
                                    <select className={inputClass} value={onboardForm.employeeType} onChange={e => setOnboardForm(p => ({ ...p, employeeType: e.target.value }))}>
                                        <option value="Office">Office</option><option value="Field">Field</option>
                                    </select>
                                </div>
                                {onboardForm.employeeType === 'Office' && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Assigned Office Location</label>
                                        <select className={inputClass} value={onboardForm.assignedOfficeLocationId} onChange={e => setOnboardForm(p => ({ ...p, assignedOfficeLocationId: e.target.value }))}>
                                            <option value="">-- Select Office --</option>
                                            {hrmsSettings?.organization?.officeLocations?.filter(o => o.isActive !== false).map(loc => (
                                                <option key={loc._id} value={loc._id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Office Location Name (Legacy)</label><input className={inputClass} value={onboardForm.officeLocation} onChange={e => setOnboardForm(p => ({ ...p, officeLocation: e.target.value }))} /></div>
                            </div>
                        </div>

                        {/* 4. Bank & Emergency */}
                        <div>
                            <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide bg-slate-50 p-2 rounded">4. Bank & Emergency Contact</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Account Holder</label><input className={inputClass} value={onboardForm.accountHolderName} onChange={e => setOnboardForm(p => ({ ...p, accountHolderName: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Account Number</label><input className={inputClass} value={onboardForm.accountNumber} onChange={e => setOnboardForm(p => ({ ...p, accountNumber: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Bank Name</label><input className={inputClass} value={onboardForm.bankName} onChange={e => setOnboardForm(p => ({ ...p, bankName: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">IFSC Code</label><input className={inputClass} value={onboardForm.ifscCode} onChange={e => setOnboardForm(p => ({ ...p, ifscCode: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">UPI ID</label><input className={inputClass} value={onboardForm.upiId} onChange={e => setOnboardForm(p => ({ ...p, upiId: e.target.value }))} /></div>
                                
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Emergency Contact Name</label><input className={inputClass} value={onboardForm.emergencyName} onChange={e => setOnboardForm(p => ({ ...p, emergencyName: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Emergency Relation</label><input className={inputClass} value={onboardForm.emergencyRelation} onChange={e => setOnboardForm(p => ({ ...p, emergencyRelation: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Emergency Phone</label><input className={inputClass} value={onboardForm.emergencyPhone} onChange={e => setOnboardForm(p => ({ ...p, emergencyPhone: e.target.value }))} /></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
                        <button onClick={handleOnboard} disabled={onboardLoading}
                            className="px-8 h-10 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50">
                            {onboardLoading ? 'Processing...' : 'Complete Onboarding'}
                        </button>
                    </div>
                </div>
            )}

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, ID, department..."
                        className="w-full h-11 pl-11 pr-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white" />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select value={filterEmployeeType} onChange={e => setFilterEmployeeType(e.target.value)} 
                        className="w-full h-11 pl-11 pr-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white appearance-none cursor-pointer">
                        <option value="all">All Employee Types</option>
                        <option value="Office">Office Employees</option>
                        <option value="Field">Field Employees</option>
                    </select>
                </div>
            </div>

            {/* Employee Detail Modal */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">{selectedEmployee.adminId?.name || 'Unknown'}</h2>
                                <p className="text-sm text-slate-500">ID: {selectedEmployee.employeeId}</p>
                            </div>
                            <button onClick={() => setSelectedEmployee(null)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
                                {[
                                    { l: 'Email', v: selectedEmployee.adminId?.email },
                                    { l: 'Phone', v: selectedEmployee.adminId?.phone },
                                    { l: 'Department', v: selectedEmployee.department },
                                    { l: 'Designation', v: selectedEmployee.designation },
                                    { l: 'Employee Type', v: selectedEmployee.employeeType },
                                    { l: 'Assigned Office', v: selectedEmployee.assignedOfficeLocationId ? hrmsSettings?.organization?.officeLocations?.find(o => o._id === selectedEmployee.assignedOfficeLocationId)?.name || selectedEmployee.assignedOfficeLocationId : '—' },
                                    { l: 'HRMS Role', v: selectedEmployee.hrmsRole },
                                    { l: 'Employment', v: selectedEmployee.employmentType },
                                    { l: 'CTC', v: selectedEmployee.ctc ? `₹${Number(selectedEmployee.ctc).toLocaleString()}` : '—' },
                                    { l: 'Monthly Salary', v: selectedEmployee.monthlySalary ? `₹${Number(selectedEmployee.monthlySalary).toLocaleString()}` : '—' },
                                    { l: 'Joining Date', v: selectedEmployee.joiningDate ? new Date(selectedEmployee.joiningDate).toLocaleDateString('en-IN') : '—' },
                                    { l: 'Status', v: selectedEmployee.status },
                                    { l: 'Manager', v: selectedEmployee.managerId?.adminId?.name || '—' },
                                    { l: 'Shift', v: selectedEmployee.shift },
                                ].map((f, i) => (
                                    <div key={i} className="min-w-0">
                                        <p className="text-xs text-slate-500 mb-1">{f.l}</p>
                                        <p className="font-medium text-slate-900 truncate" title={f.v}>{f.v || '—'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 justify-between items-center rounded-b-2xl">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-700">Transfer Manager:</span>
                                <select 
                                    className="h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                    onChange={async (e) => {
                                        if(!e.target.value) return;
                                        try {
                                            const newManagerId = e.target.value === 'unassigned' ? null : e.target.value;
                                            await axiosInstance.put(`/hrms/employees/${selectedEmployee._id}/manager`, { newManagerId });
                                            toast.success('Employee transferred successfully');
                                            fetchEmployees(pagination.page);
                                            setSelectedEmployee(null);
                                        } catch(err) {
                                            toast.error(err.response?.data?.message || 'Transfer failed');
                                        }
                                    }}
                                    value=""
                                >
                                    <option value="">-- Select New Manager --</option>
                                    {managers.filter(m => String(m._id) !== String(selectedEmployee.managerId?._id)).map(m => (
                                        <option key={m._id} value={m._id}>{m.adminId?.name} ({m.employeeId})</option>
                                    ))}
                                    {selectedEmployee.managerId && <option value="unassigned">-- Remove Manager --</option>}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                {selectedEmployee.status === 'Active' && (
                                    <button onClick={() => handleStatusChange(selectedEmployee._id, 'Suspended')} className="px-5 h-10 bg-white border-2 border-orange-400 text-orange-500 hover:bg-orange-50 rounded-xl text-sm font-medium transition-all shadow-sm">Suspend Employee</button>
                                )}
                                {selectedEmployee.status === 'Suspended' && (
                                    <button onClick={() => handleStatusChange(selectedEmployee._id, 'Active')} className="px-5 h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm">Reactivate Employee</button>
                                )}
                                {selectedEmployee.status !== 'Terminated' && (
                                    <button onClick={() => handleStatusChange(selectedEmployee._id, 'Terminated')} className="px-5 h-10 bg-white border-2 border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl text-sm font-medium transition-all shadow-sm">Terminate Employee</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
                ) : employees.length === 0 ? (
                    <div className="text-center p-12">
                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No employees found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">ID</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Name</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Department</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Designation</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Type</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Role</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Status</th>
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Action</th>
                            </tr></thead>
                            <tbody>
                                {employees.map(emp => (
                                    <tr key={emp._id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                        <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{emp.employeeId}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                                    {emp.adminId?.profileImage ? (
                                                        <img src={emp.adminId.profileImage} alt="Profile" className="w-full h-full object-cover" />
                                                    ) : (
                                                        emp.adminId?.name?.[0]?.toUpperCase() || 'E'
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-900">{emp.adminId?.name}</p>
                                                    <p className="text-xs text-slate-500">{emp.adminId?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">{emp.department || '—'}</td>
                                        <td className="px-5 py-3.5 text-slate-600">{emp.designation || '—'}</td>
                                        <td className="px-5 py-3.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${emp.employeeType === 'Field' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>{emp.employeeType === 'Field' ? 'Field' : 'Office'}</span></td>
                                        <td className="px-5 py-3.5"><span className={`px-2 py-0.5 rounded text-xs font-medium ${emp.hrmsRole === 'Manager' ? 'bg-orange-50 text-orange-700' : emp.hrmsRole === 'HR' ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>{emp.hrmsRole}</span></td>
                                        <td className="px-5 py-3.5"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${emp.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{emp.status}</span></td>
                                        <td className="px-5 py-3.5">
                                            <button onClick={() => setSelectedEmployee(emp)} className="flex items-center gap-1.5 text-orange-600 hover:text-orange-700 font-medium text-xs">
                                                <Eye className="w-3.5 h-3.5" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                        <span className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages}</span>
                        <div className="flex gap-2">
                            <button onClick={() => fetchEmployees(pagination.page - 1)} disabled={pagination.page <= 1} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                            <button onClick={() => fetchEmployees(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
