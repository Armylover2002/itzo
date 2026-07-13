import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Users, Loader2, Search, Eye, Plus, ChevronLeft, ChevronRight, X, UserPlus, FileText, Upload, MapPin, Building2, Filter, UserCog, ArrowRight, Edit2, Save } from 'lucide-react';
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
    const [filterAssignmentStatus, setFilterAssignmentStatus] = useState('all');
    const [filterDepartment, setFilterDepartment] = useState('all');
    const [filterManagerId, setFilterManagerId] = useState('all');
    const [managers, setManagers] = useState([]);
    const [transferConfirm, setTransferConfirm] = useState(null); // { employeeId, employeeName, currentManager, newManagerId, newManagerName }
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);
    const { hrmsSettings } = useHrmsSettings();

    const [onboardForm, setOnboardForm] = useState({
        fullName: '', email: '', password: '', phone: '',
        dateOfBirth: '', gender: '',
        street: '', city: '', state: '', pincode: '',
        aadhaarNumber: '', aadhaarPhotoUrl: '', panNumber: '', panPhotoUrl: '', profilePhotoUrl: '', resumeUrl: '',
        qualification: '', experience: '',
        department: '', designation: '',
        accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '',
        emergencyName: '', emergencyRelation: '', emergencyPhone: '',
        employmentType: 'Full-Time', joiningDate: new Date().toISOString().split('T')[0],
        shift: 'General', ctc: '', hrmsRole: 'Employee', officeLocation: '',
        employeeType: 'Office', assignedOfficeLocationId: '', managerId: '', assignedTeamMembers: []
    });
    const [uploading, setUploading] = useState({ aadhaar: false, pan: false, profilePhoto: false, resume: false });

    const fetchEmployees = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20, status: 'Active' });
            if (search) params.append('search', search);
            if (filterEmployeeType !== 'all') params.append('employeeType', filterEmployeeType);
            if (filterAssignmentStatus !== 'all') params.append('assignmentStatus', filterAssignmentStatus);
            if (filterDepartment !== 'all') params.append('department', filterDepartment);
            if (filterManagerId !== 'all') params.append('currentManagerId', filterManagerId);
            const res = await axiosInstance.get(`/hrms/employees?${params}`);
            const data = res.data?.data || {};
            setEmployees(data.employees || []);
            setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [search, filterEmployeeType, filterAssignmentStatus, filterDepartment, filterManagerId]);

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
        const nameTrimmed = onboardForm.fullName?.trim() || '';
        if (!nameTrimmed) return toast.error('Full name is required');
        if (!/^[A-Za-z\s.-]{2,50}$/.test(nameTrimmed)) return toast.error('Name must be 2-50 characters (letters, spaces, dots, hyphens only)');

        const emailTrimmed = onboardForm.email?.trim() || '';
        if (!emailTrimmed) return toast.error('Email is required');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrimmed)) return toast.error('Please enter a valid RFC-compliant email address');

        const phoneDigits = onboardForm.phone?.replace(/\D/g, '') || '';
        if (!phoneDigits) return toast.error('Mobile number is required');
        if (!/^[1-9]\d{9}$/.test(phoneDigits)) return toast.error('Mobile number must be exactly 10 numeric digits and cannot start with 0');

        if (!onboardForm.password || onboardForm.password.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }

        if (!onboardForm.joiningDate || isNaN(new Date(onboardForm.joiningDate).getTime())) {
            return toast.error('Please select a valid joining date');
        }

        if (onboardForm.aadhaarNumber && !/^\d{12}$/.test(onboardForm.aadhaarNumber.replace(/\D/g, ''))) {
            return toast.error('Aadhaar number must be exactly 12 numeric digits');
        }

        if (onboardForm.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(onboardForm.panNumber.trim())) {
            return toast.error('PAN must be in standard format (e.g. ABCDE1234F)');
        }

        if (onboardForm.accountNumber && !/^\d{9,18}$/.test(onboardForm.accountNumber.trim())) {
            return toast.error('Bank account number must be numeric (9 to 18 digits)');
        }

        if (onboardForm.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(onboardForm.ifscCode.trim())) {
            return toast.error('Please enter a valid IFSC code (e.g. SBIN0001234)');
        }

        if (onboardForm.pincode && !/^\d{6}$/.test(onboardForm.pincode.trim())) {
            return toast.error('PIN code must be exactly 6 numeric digits');
        }

        if (onboardForm.ctc !== '' && onboardForm.ctc !== null && onboardForm.ctc !== undefined && Number(onboardForm.ctc) < 0) {
            return toast.error('Salary / CTC cannot be negative');
        }

        setOnboardLoading(true);
        try {
            const payload = {
                ...onboardForm,
                fullName: nameTrimmed.replace(/\s+/g, ' '),
                email: emailTrimmed.toLowerCase(),
                phone: phoneDigits,
                aadhaarNumber: onboardForm.aadhaarNumber ? onboardForm.aadhaarNumber.replace(/\D/g, '') : '',
                panNumber: onboardForm.panNumber ? onboardForm.panNumber.trim().toUpperCase() : '',
                ctc: Number(onboardForm.ctc) || 0,
                assignedOfficeLocationId: onboardForm.assignedOfficeLocationId || null,
                managerId: onboardForm.hrmsRole === 'Manager' ? null : (onboardForm.managerId || null),
                assignedTeamMembers: onboardForm.assignedTeamMembers || [],
                profilePhotoUrl: onboardForm.profilePhotoUrl || '',
                resumeUrl: onboardForm.resumeUrl || '',
                address: {
                    street: onboardForm.street, city: onboardForm.city,
                    state: onboardForm.state, pincode: onboardForm.pincode
                },
                bankDetails: {
                    accountHolderName: onboardForm.accountHolderName,
                    accountNumber: onboardForm.accountNumber,
                    bankName: onboardForm.bankName,
                    ifscCode: onboardForm.ifscCode ? onboardForm.ifscCode.trim().toUpperCase() : '',
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
                street: '', city: '', state: '', pincode: '', aadhaarNumber: '', aadhaarPhotoUrl: '', panNumber: '', panPhotoUrl: '', profilePhotoUrl: '', resumeUrl: '',
                qualification: '', experience: '', department: '', designation: '',
                accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '',
                emergencyName: '', emergencyRelation: '', emergencyPhone: '',
                employmentType: 'Full-Time', joiningDate: new Date().toISOString().split('T')[0],
                shift: 'General', ctc: '', hrmsRole: 'Employee', officeLocation: '',
                employeeType: 'Office', assignedOfficeLocationId: '', managerId: '', assignedTeamMembers: []
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
            const endpoint = field === 'resume' || file.name?.toLowerCase().endsWith('.pdf') || file.name?.toLowerCase().endsWith('.doc') || file.name?.toLowerCase().endsWith('.docx') ? '/uploads/file' : '/uploads/image';
            const res = await axiosInstance.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data?.url || res.data?.data?.url || res.data?.imageUrl;
            if (!url) throw new Error('No URL returned from server');
            if (field === 'profilePhoto') {
                setOnboardForm(prev => ({ ...prev, profilePhotoUrl: url }));
            } else if (field === 'resume') {
                setOnboardForm(prev => ({ ...prev, resumeUrl: url }));
            } else {
                setOnboardForm(prev => ({ ...prev, [`${field}PhotoUrl`]: url }));
            }
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
            fetchEmployees(pagination.page);
            setSelectedEmployee(null);
        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    };

    const startEditEmployee = (emp) => {
        setEditForm({
            department: emp.department || '',
            designation: emp.designation || '',
            hrmsRole: emp.hrmsRole || 'Employee',
            employmentType: emp.employmentType || 'Full-Time',
            employeeType: emp.employeeType || 'Office',
            shift: emp.shift || 'General',
            ctc: emp.ctc || '',
            officeLocation: emp.officeLocation || '',
            assignedOfficeLocationId: emp.assignedOfficeLocationId || '',
        });
        setEditMode(true);
    };

    const handleEditSave = async () => {
        if (!selectedEmployee) return;
        setEditSaving(true);
        try {
            await axiosInstance.put(`/hrms/employees/${selectedEmployee._id}`, editForm);
            toast.success('Employee updated successfully');
            setEditMode(false);
            fetchEmployees(pagination.page);
            // Refresh selected employee data
            try {
                const res = await axiosInstance.get(`/hrms/employees/${selectedEmployee._id}`);
                setSelectedEmployee(res.data?.data || selectedEmployee);
            } catch(e) {
                setSelectedEmployee(null);
            }
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to update employee');
        } finally {
            setEditSaving(false);
        }
    };

    const handleTransferConfirm = async () => {
        if (!transferConfirm) return;
        try {
            const newManagerId = transferConfirm.newManagerId === 'unassigned' ? null : transferConfirm.newManagerId;
            await axiosInstance.put(`/hrms/employees/${transferConfirm.employeeId}/manager`, { newManagerId });
            toast.success(newManagerId ? 'Employee transferred successfully' : 'Manager assignment removed');
            fetchEmployees(pagination.page);
            setSelectedEmployee(null);
            setTransferConfirm(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Transfer failed');
        }
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
                    <a href={window.location.pathname.startsWith('/hrms') ? "/hrms/team/employee-docs" : "/ecs/hrms/employee-docs"} className="flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl shadow-sm transition-all text-sm">
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
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Upload Profile Photo</label>
                                    <div className="relative">
                                        <input type="file" id="admin-profile-upload" className="hidden" accept="image/*" onChange={e => handleFileUpload('profilePhoto', e.target.files?.[0])} />
                                        <label htmlFor="admin-profile-upload" className={`flex items-center justify-center gap-2 w-full h-10 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${onboardForm.profilePhotoUrl ? 'text-emerald-600 border-emerald-300' : 'text-slate-500'}`}>
                                            {uploading.profilePhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            <span className="text-xs font-medium">{uploading.profilePhoto ? 'Uploading...' : onboardForm.profilePhotoUrl ? 'Uploaded' : 'Upload Photo'}</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Upload Resume / CV</label>
                                    <div className="relative">
                                        <input type="file" id="admin-resume-upload" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={e => handleFileUpload('resume', e.target.files?.[0])} />
                                        <label htmlFor="admin-resume-upload" className={`flex items-center justify-center gap-2 w-full h-10 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${onboardForm.resumeUrl ? 'text-emerald-600 border-emerald-300' : 'text-slate-500'}`}>
                                            {uploading.resume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                            <span className="text-xs font-medium">{uploading.resume ? 'Uploading...' : onboardForm.resumeUrl ? 'Uploaded' : 'Upload Resume'}</span>
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
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Department *</label>
                                    <select className={inputClass} value={onboardForm.department} onChange={e => setOnboardForm(p => ({ ...p, department: e.target.value }))}>
                                        <option value="">-- Select Department --</option>
                                        {(() => {
                                            const depts = hrmsSettings?.organization?.departments || [];
                                            if (depts.length === 0) {
                                                return <option value="" disabled>No departments available.</option>;
                                            }
                                            return depts.map((d, idx) => (
                                                <option key={d._id || idx} value={d.name}>{d.name}</option>
                                            ));
                                        })()}
                                    </select>
                                </div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Designation</label><input className={inputClass} value={onboardForm.designation} onChange={e => setOnboardForm(p => ({ ...p, designation: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">CTC (Annual ₹)</label><input type="number" className={inputClass} value={onboardForm.ctc} onChange={e => setOnboardForm(p => ({ ...p, ctc: e.target.value }))} /></div>
                                <div><label className="text-xs font-medium text-slate-600 mb-1 block">Joining Date *</label><input type="date" className={inputClass} value={onboardForm.joiningDate} onChange={e => setOnboardForm(p => ({ ...p, joiningDate: e.target.value }))} /></div>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 mb-1 block">Role *</label>
                                    <select className={inputClass} value={onboardForm.hrmsRole === 'Manager' ? 'Manager' : onboardForm.employeeType === 'Field' ? 'Field Employee' : 'Office Employee'} onChange={e => {
                                        const role = e.target.value;
                                        setOnboardForm(p => ({
                                            ...p,
                                            hrmsRole: role === 'Manager' ? 'Manager' : 'Employee',
                                            employeeType: role === 'Field Employee' ? 'Field' : 'Office',
                                            managerId: role === 'Manager' ? '' : p.managerId
                                        }));
                                    }}>
                                        <option value="Manager">Manager</option>
                                        <option value="Office Employee">Office Employee</option>
                                        <option value="Field Employee">Field Employee</option>
                                    </select>
                                </div>
                                {onboardForm.hrmsRole === 'Manager' ? (
                                    <div className="sm:col-span-2 lg:col-span-3 bg-amber-50/90 border border-amber-300 p-3.5 rounded-xl flex items-center gap-3">
                                        <div className="text-xs text-amber-900">
                                            <span className="font-bold block text-sm mb-0.5">🚀 Manager Role Selected — No Reporting Manager Assigned</span>
                                            As this person is onboarding as a Manager, they will not be assigned a reporting manager above them.
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Reporting Manager</label>
                                        <select className={inputClass} value={onboardForm.managerId} onChange={e => setOnboardForm(p => ({ ...p, managerId: e.target.value }))}>
                                            <option value="">-- No Manager --</option>
                                            {managers.map(m => (
                                                <option key={m._id} value={m._id}>{m.adminId?.name} ({m.employeeId})</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {onboardForm.hrmsRole === 'Manager' && (
                                    <div className="sm:col-span-2 lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                                        <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                                            <span>👥 Assign Team Members Under This Manager</span>
                                            <span className="text-[11px] font-normal text-slate-500">Check active employees to report directly to this manager</span>
                                        </label>
                                        <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1 bg-slate-50/50 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                            {(() => {
                                                const selectableEmps = employees.filter(emp =>
                                                    ((onboardForm.assignedTeamMembers || []).includes(emp._id) || !emp.managerId) &&
                                                    emp.hrmsRole !== 'Manager' &&
                                                    emp.hrmsRole !== 'HR' &&
                                                    emp.status === 'Active'
                                                );
                                                if (selectableEmps.length === 0) {
                                                    return <p className="text-xs text-slate-400 p-2 text-center col-span-2">No unassigned active employees found. Already assigned employees & managers are hidden to prevent duplicates.</p>;
                                                }
                                                return selectableEmps.map(emp => {
                                                    const isChecked = (onboardForm.assignedTeamMembers || []).includes(emp._id);
                                                    return (
                                                        <label key={emp._id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs transition-colors ${isChecked ? 'bg-orange-50/90 border border-orange-200 text-orange-900 font-semibold' : 'hover:bg-slate-100/80 text-slate-700'}`}>
                                                            <input type="checkbox" checked={isChecked} onChange={e => {
                                                                const checked = e.target.checked;
                                                                setOnboardForm(p => ({
                                                                    ...p,
                                                                    assignedTeamMembers: checked
                                                                        ? [...(p.assignedTeamMembers || []), emp._id]
                                                                        : (p.assignedTeamMembers || []).filter(id => id !== emp._id)
                                                                }));
                                                            }} className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4" />
                                                            <span className="font-mono text-slate-500 text-[11px]">{emp.employeeId}</span>
                                                            <span className="truncate">{emp.adminId?.name || 'Unknown'}</span>
                                                            <span className="text-slate-400 ml-auto shrink-0">({emp.department || 'General'})</span>
                                                        </label>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
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
                                {onboardForm.employeeType === 'Office' && (
                                    <div className="sm:col-span-2">
                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Assigned Office Location *</label>
                                        <select className={inputClass} value={onboardForm.assignedOfficeLocationId} onChange={e => {
                                            const locId = e.target.value;
                                            const selectedLoc = (hrmsSettings?.organization?.officeLocations || []).find(o => String(o._id) === String(locId));
                                            setOnboardForm(p => ({
                                                ...p,
                                                assignedOfficeLocationId: locId,
                                                officeLocation: selectedLoc ? selectedLoc.name : ''
                                            }));
                                        }}>
                                            <option value="">-- Select Office Location --</option>
                                            {(() => {
                                                const activeLocs = (hrmsSettings?.organization?.officeLocations || []).filter(o => o.isActive !== false);
                                                if (activeLocs.length === 0) {
                                                    return <option value="" disabled>No office locations available.</option>;
                                                }
                                                return activeLocs.map(loc => (
                                                    <option key={loc._id} value={loc._id}>
                                                        {loc.name}{loc.city ? ` (${loc.city}${loc.state ? `, ${loc.state}` : ''})` : ''}
                                                    </option>
                                                ));
                                            })()}
                                        </select>
                                    </div>
                                )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, ID, dept..."
                        className="w-full h-10 pl-10 pr-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white" />
                </div>
                <div className="relative">
                    <select value={filterAssignmentStatus} onChange={e => setFilterAssignmentStatus(e.target.value)} 
                        className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white cursor-pointer">
                        <option value="all">Assignment: All Status</option>
                        <option value="Available">Available Employees (Unassigned)</option>
                        <option value="Assigned">Assigned Employees</option>
                    </select>
                </div>
                <div className="relative">
                    <select value={filterManagerId} onChange={e => setFilterManagerId(e.target.value)} 
                        className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white cursor-pointer">
                        <option value="all">Filter by Manager: All</option>
                        <option value="unassigned">No Manager Assigned</option>
                        {managers.map(m => (
                            <option key={m._id} value={m._id}>{m.adminId?.name || m.employeeId}</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <select value={filterEmployeeType} onChange={e => setFilterEmployeeType(e.target.value)} 
                        className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 bg-white cursor-pointer">
                        <option value="all">Type: All Types</option>
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
                            <div className="flex items-center gap-2">
                                {!editMode ? (
                                    <button onClick={() => startEditEmployee(selectedEmployee)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 font-medium rounded-lg text-xs transition-colors border border-orange-200">
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => setEditMode(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg text-xs transition-colors border border-slate-200">
                                            <X className="w-3.5 h-3.5" /> Cancel
                                        </button>
                                        <button onClick={handleEditSave} disabled={editSaving} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg text-xs transition-colors disabled:opacity-50">
                                            <Save className="w-3.5 h-3.5" /> {editSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </>
                                )}
                                <button onClick={() => { setSelectedEmployee(null); setEditMode(false); }} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {editMode ? (
                                <div className="space-y-5">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Edit Employee Details</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Department</label>
                                            <input className={inputClass} value={editForm.department} onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Designation</label>
                                            <input className={inputClass} value={editForm.designation} onChange={e => setEditForm(p => ({ ...p, designation: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Role & Type</label>
                                            <select className={inputClass} 
                                                value={editForm.hrmsRole === 'Manager' ? 'Manager' : editForm.employeeType === 'Field' ? 'Field Employee' : 'Office Employee'} 
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === 'Manager') {
                                                        setEditForm(p => ({ ...p, hrmsRole: 'Manager', employeeType: 'Office' }));
                                                    } else if (val === 'Field Employee') {
                                                        setEditForm(p => ({ ...p, hrmsRole: 'Employee', employeeType: 'Field' }));
                                                    } else {
                                                        setEditForm(p => ({ ...p, hrmsRole: 'Employee', employeeType: 'Office' }));
                                                    }
                                                }}>
                                                <option value="Manager">Manager</option>
                                                <option value="Office Employee">Office Employee</option>
                                                <option value="Field Employee">Field Employee</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Employment Type</label>
                                            <select className={inputClass} value={editForm.employmentType} onChange={e => setEditForm(p => ({ ...p, employmentType: e.target.value }))}>
                                                <option>Full-Time</option><option>Part-Time</option><option>Contract</option><option>Internship</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Shift</label>
                                            <select className={inputClass} value={editForm.shift} onChange={e => setEditForm(p => ({ ...p, shift: e.target.value }))}>
                                                <option>General</option><option>Morning</option><option>Night</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">CTC (Annual)</label>
                                            <input type="number" className={inputClass} value={editForm.ctc} onChange={e => setEditForm(p => ({ ...p, ctc: e.target.value }))} placeholder="e.g. 500000" />
                                        </div>
                                        {editForm.employeeType === 'Office' && (
                                            <div className="sm:col-span-2">
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Assigned Office Location</label>
                                                <select className={inputClass} value={editForm.assignedOfficeLocationId} onChange={e => {
                                                    const locId = e.target.value;
                                                    const selectedLoc = (hrmsSettings?.organization?.officeLocations || []).find(o => String(o._id) === String(locId));
                                                    setEditForm(p => ({ ...p, assignedOfficeLocationId: locId, officeLocation: selectedLoc ? selectedLoc.name : '' }));
                                                }}>
                                                    <option value="">-- Select Office Location --</option>
                                                    {(hrmsSettings?.organization?.officeLocations || []).filter(o => o.isActive !== false).map(loc => (
                                                        <option key={loc._id} value={loc._id}>{loc.name}{loc.city ? ` (${loc.city}${loc.state ? `, ${loc.state}` : ''})` : ''}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
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
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col gap-4 justify-between rounded-b-2xl">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Current Manager:</span>
                                    {selectedEmployee.managerId?.adminId?.name ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
                                            <UserCog className="w-3.5 h-3.5" />
                                            Reporting To: {selectedEmployee.managerId.adminId.name}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            Available — Unassigned
                                        </span>
                                    )}
                                </div>
                                {selectedEmployee.managerId && (
                                    <button
                                        onClick={() => setTransferConfirm({
                                            employeeId: selectedEmployee._id,
                                            employeeName: selectedEmployee.adminId?.name || 'Unknown',
                                            currentManager: selectedEmployee.managerId?.adminId?.name || 'Unassigned',
                                            newManagerId: 'unassigned',
                                            newManagerName: 'Unassigned'
                                        })}
                                        className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 border border-red-200 shadow-2xs"
                                    >
                                        Remove From Team
                                    </button>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                                        {selectedEmployee.managerId ? 'Transfer To Manager:' : 'Assign Manager:'}
                                    </span>
                                    <select 
                                        className="h-10 px-3 border border-slate-200 rounded-xl text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-full sm:w-64"
                                        onChange={(e) => {
                                            if (!e.target.value) return;
                                            const newManagerId = e.target.value;
                                            const newManagerName = newManagerId === 'unassigned' 
                                                ? null 
                                                : managers.find(m => String(m._id) === String(newManagerId))?.adminId?.name || 'Unknown';
                                            setTransferConfirm({
                                                employeeId: selectedEmployee._id,
                                                employeeName: selectedEmployee.adminId?.name || 'Unknown',
                                                currentManager: selectedEmployee.managerId?.adminId?.name || 'Unassigned',
                                                newManagerId,
                                                newManagerName: newManagerName || 'Unassigned'
                                            });
                                        }}
                                        value=""
                                    >
                                        <option value="">-- Select New Manager --</option>
                                        {managers.filter(m => String(m._id) !== String(selectedEmployee.managerId?._id) && String(m._id) !== String(selectedEmployee._id)).map(m => (
                                            <option key={m._id} value={m._id}>{m.adminId?.name} ({m.employeeId})</option>
                                        ))}
                                        {selectedEmployee.managerId && <option value="unassigned">-- Remove From Team --</option>}
                                    </select>
                                </div>
                            <div className="flex flex-wrap gap-3">
                                {selectedEmployee.employeeType === 'Field' && (
                                    <a href={window.location.pathname.startsWith('/hrms') ? `/hrms/team/live-tracking?employeeId=${selectedEmployee._id}` : `/ecs/hrms/live-tracking?employeeId=${selectedEmployee._id}`} className="px-5 h-10 bg-white border-2 border-indigo-500 text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 rounded-xl text-sm font-medium transition-all shadow-sm">
                                        <MapPin className="w-4 h-4" /> View Live Track
                                    </a>
                                )}
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
                                <th className="px-5 py-3 text-left font-semibold text-slate-600 text-xs uppercase">Manager</th>
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
                                        <td className="px-5 py-3.5">
                                            {emp.status !== 'Active' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                                    Inactive
                                                </span>
                                            ) : emp.managerId?.adminId?.name ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200" title={`Already Assigned to ${emp.managerId.adminId.name}`}>
                                                    <UserCog className="w-3 h-3" />
                                                    {emp.managerId.adminId.name}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    Available
                                                </span>
                                            )}
                                        </td>
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

            {/* Transfer Confirmation Dialog */}
            {transferConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900">Confirm Manager Transfer</h3>
                            <p className="text-sm text-slate-500 mt-1">You are about to change the reporting manager for this employee.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-sm">
                                <p className="text-slate-500 mb-1">Employee</p>
                                <p className="font-semibold text-slate-900">{transferConfirm.employeeName}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex-1 p-3 bg-slate-50 rounded-xl">
                                    <p className="text-xs text-slate-500 mb-1">Current Manager</p>
                                    <p className="font-semibold text-slate-700 text-sm">{transferConfirm.currentManager}</p>
                                </div>
                                <ArrowRight className="w-5 h-5 text-orange-500 shrink-0" />
                                <div className="flex-1 p-3 bg-orange-50 rounded-xl border border-orange-200">
                                    <p className="text-xs text-orange-600 mb-1">New Manager</p>
                                    <p className="font-semibold text-orange-800 text-sm">{transferConfirm.newManagerName || 'Unassigned'}</p>
                                </div>
                            </div>
                            {transferConfirm.newManagerId === 'unassigned' && (
                                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">This employee will be removed from their current team and will appear as Unassigned.</p>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setTransferConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleTransferConfirm} className="px-5 py-2 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors shadow-sm">
                                Confirm Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
