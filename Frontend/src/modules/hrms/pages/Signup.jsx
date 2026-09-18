import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { useHrmsSettings } from '../context/HrmsSettingsContext';
import { getAppLogo, getCompanyName } from '@/modules/common/utils/businessSettings';
import AssessmentRunner from '../components/AssessmentRunner';
import {
    Building2, User, Mail, Phone, Lock, MapPin, FileText,
    GraduationCap, CreditCard, Heart, ChevronLeft,
    ChevronRight, Check, AlertCircle, Eye, EyeOff, Upload, Loader2
} from 'lucide-react';

const STEPS = [
    { title: 'Personal Info', icon: User },
    { title: 'Address & KYC', icon: MapPin },
    { title: 'Qualifications', icon: GraduationCap },
    { title: 'Bank & Emergency', icon: CreditCard },
    { title: 'Assessment', icon: FileText },
];

const DEFAULT_FORM = {
    fullName: '', email: '', phone: '', password: '',
    dateOfBirth: '', gender: '',
    street: '', city: '', state: '', pincode: '',
    aadhaarNumber: '', aadhaarPhotoUrl: '', panNumber: '', panPhotoUrl: '', profilePhotoUrl: '', resumeUrl: '',
    qualification: '', experience: '',
    department: '', designation: '',
    accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '',
    emergencyName: '', emergencyRelation: '', emergencyPhone: '',
    ctc: '', joiningDate: '', hrmsRole: 'Employee', shift: 'General',
    employmentType: 'Full-Time', officeLocation: '',
    assignedOfficeLocationId: '', employeeType: 'Office'
};

// localStorage helpers — isolated per applicant (email+phone)
const getStorageKey = (email, phone) => {
    if (!email && !phone) return null;
    const cleanEmail = (email || '').toLowerCase().trim();
    const cleanPhone = (phone || '').replace(/\D/g, '');
    return `hrms_signup_${cleanEmail}_${cleanPhone}`;
};

const loadSavedForm = () => {
    try {
        // First try to load from any existing key if fields match or recent
        const keys = Object.keys(localStorage).filter(k => k.startsWith('hrms_signup_'));
        if (keys.length > 0) {
            const raw = localStorage.getItem(keys[keys.length - 1]);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { form: { ...DEFAULT_FORM, ...parsed.form }, step: parsed.step || 0 };
            }
        }
    } catch { /* ignore corrupted storage */ }
    return { form: { ...DEFAULT_FORM }, step: 0 };
};

const saveFormToStorage = (form, step) => {
    try {
        const key = getStorageKey(form.email, form.phone);
        if (!key) return;
        // Don't store the password in localStorage for security
        const { password, ...safeForm } = form;
        localStorage.setItem(key, JSON.stringify({ form: safeForm, step }));
    } catch { /* quota exceeded or private mode — silently ignore */ }
};

const clearFormStorage = (email, phone) => {
    try {
        const key = getStorageKey(email, phone);
        if (key) localStorage.removeItem(key);
        // Also clean up any orphaned keys for this user
        Object.keys(localStorage)
            .filter(k => k.startsWith('hrms_signup_'))
            .forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
};

export default function Signup() {
    const navigate = useNavigate();
    const { hrmsSettings } = useHrmsSettings();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Load saved form data from localStorage on mount
    const saved = loadSavedForm();
    const [currentStep, setCurrentStep] = useState(saved.step);
    const [form, setForm] = useState({ ...saved.form, password: '' });
    const [uploading, setUploading] = useState({ aadhaar: false, pan: false, profilePhoto: false, resume: false });

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    // Save form to localStorage whenever step changes
    useEffect(() => {
        saveFormToStorage(form, currentStep);
    }, [currentStep]);

    /* ── strict validators ── */
    const isValidName = (v) => /^[A-Za-z\s.-]{2,50}$/.test((v || '').trim());
    const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim());
    const isValidPhone = (v) => /^[1-9]\d{9}$/.test((v || '').replace(/\D/g, ''));
    const isValidAadhaar = (v) => !v || /^\d{12}$/.test(v.replace(/\D/g, ''));
    const isValidPan = (v) => !v || /^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase());
    const isValidPincode = (v) => !v || /^\d{6}$/.test(v.trim());

    const handleFileUpload = async (field, file) => {
        if (!file) return;
        setUploading(prev => ({ ...prev, [field]: true }));
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', `hrms/joining-requests/${field}s`);
            const res = await axiosInstance.post('/uploads/file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data?.url || res.data?.data?.url || res.data?.fileUrl || res.data?.imageUrl;
            if (!url) throw new Error('No URL returned from server');
            if (field === 'profilePhoto') updateField('profilePhotoUrl', url);
            else if (field === 'resume') updateField('resumeUrl', url);
            else updateField(`${field}PhotoUrl`, url);
            toast.success(`${field.toUpperCase()} uploaded successfully`);
        } catch (e) {
            toast.error(e.response?.data?.message || `Failed to upload ${field}`);
        } finally {
            setUploading(prev => ({ ...prev, [field]: false }));
        }
    };

    const validateStep = () => {
        switch (currentStep) {
            case 0:
                if (!form.fullName?.trim()) { toast.error('Full name is required'); return false; }
                if (!isValidName(form.fullName)) { toast.error('Name must be 2-50 characters (letters, spaces, dots, hyphens only)'); return false; }
                if (!form.email?.trim()) { toast.error('Email is required'); return false; }
                if (!isValidEmail(form.email)) { toast.error('Please enter a valid email address'); return false; }
                if (!form.phone?.trim()) { toast.error('Phone number is required'); return false; }
                if (!isValidPhone(form.phone)) { toast.error('Enter a valid 10-digit mobile number across digits'); return false; }
                if (!form.password || form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
                return true;
            case 1:
                if (form.aadhaarNumber && !isValidAadhaar(form.aadhaarNumber)) { toast.error('Aadhaar must be exactly 12 numeric digits'); return false; }
                if (form.panNumber && !isValidPan(form.panNumber)) { toast.error('PAN must be in standard format (e.g. ABCDE1234F)'); return false; }
                if (form.pincode && !isValidPincode(form.pincode)) { toast.error('Pincode must be exactly 6 digits'); return false; }
                return true;
            case 2:
                if (!form.department) { toast.error('Department is required'); return false; }
                if (!form.joiningDate || isNaN(new Date(form.joiningDate).getTime())) { toast.error('Please select a valid joining date'); return false; }
                if (form.ctc !== '' && form.ctc !== null && form.ctc !== undefined && Number(form.ctc) < 0) {
                    toast.error('Expected CTC / Salary cannot be negative'); return false;
                }
                if (form.employeeType === 'Office' && !form.assignedOfficeLocationId) {
                    toast.error('Please select an Assigned Office Location'); return false;
                }
                return true;
            case 3:
                if (form.accountNumber && !/^\d{9,18}$/.test(form.accountNumber.trim())) {
                    toast.error('Bank account number must be numeric (9 to 18 digits)'); return false;
                }
                if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(form.ifscCode.trim())) {
                    toast.error('Please enter a valid IFSC code (e.g. SBIN0001234)'); return false;
                }
                if (form.emergencyPhone && !isValidPhone(form.emergencyPhone)) {
                    toast.error('Emergency phone must be a valid 10-digit mobile number'); return false;
                }
                return true;
            default: return true;
        }
    };

    const nextStep = () => {
        if (validateStep()) {
            setCurrentStep(prev => {
                const next = Math.min(prev + 1, STEPS.length - 1);
                saveFormToStorage(form, next);
                return next;
            });
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => {
            const next = Math.max(prev - 1, 0);
            saveFormToStorage(form, next);
            return next;
        });
    };

    const handleFinalSubmit = async (assessmentResult) => {
        setLoading(true);
        try {
            const payload = {
                fullName: form.fullName.trim().replace(/\s+/g, ' '),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.replace(/\D/g, ''),
                password: form.password,
                dateOfBirth: form.dateOfBirth || undefined,
                gender: form.gender || undefined,
                address: {
                    street: form.street, city: form.city,
                    state: form.state, pincode: form.pincode
                },
                aadhaarNumber: form.aadhaarNumber ? form.aadhaarNumber.replace(/\D/g, '') : undefined,
                aadhaarPhotoUrl: form.aadhaarPhotoUrl || undefined,
                panNumber: form.panNumber ? form.panNumber.trim().toUpperCase() : undefined,
                panPhotoUrl: form.panPhotoUrl || undefined,
                profilePhotoUrl: form.profilePhotoUrl || undefined,
                resumeUrl: form.resumeUrl || undefined,
                qualification: form.qualification || undefined,
                experience: form.experience || undefined,
                department: form.department || undefined,
                designation: form.designation || undefined,
                ctc: form.ctc ? Number(form.ctc) : undefined,
                joiningDate: form.joiningDate || undefined,
                hrmsRole: form.hrmsRole || undefined,
                shift: form.shift || undefined,
                employmentType: form.employmentType || undefined,
                officeLocation: form.officeLocation || undefined,
                assignedOfficeLocationId: form.assignedOfficeLocationId || undefined,
                employeeType: form.employeeType || 'Office',
                bankDetails: {
                    accountHolderName: form.accountHolderName,
                    accountNumber: form.accountNumber,
                    bankName: form.bankName,
                    ifscCode: form.ifscCode ? form.ifscCode.trim().toUpperCase() : undefined,
                    upiId: form.upiId
                },
                emergencyContact: {
                    name: form.emergencyName,
                    relation: form.emergencyRelation,
                    phone: form.emergencyPhone
                },
                assessmentAttemptId: assessmentResult?.attemptId
            };

            await axiosInstance.post('/hrms/joining-requests/register', payload);
            setSubmitted(true);
            // Clear saved form data from localStorage on successful submission
            clearFormStorage(form.email, form.phone);
            localStorage.removeItem('hrms_assessment_token');
            toast.success('Application submitted successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Submission failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="h-1.5 bg-[#6412c6] hover:bg-[#550fa8]" />
                    <div className="p-10 text-center">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Check className="w-10 h-10 text-emerald-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">Application Submitted!</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-8">
                            Your joining request has been received along with your assessment result. Our team will review your application and you'll be notified once it's approved. You cannot login until approved.
                        </p>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                                <p className="text-sm text-amber-300/80 text-left">
                                    Status: <span className="font-semibold text-amber-300">Pending Approval</span>. You will receive access once an admin approves your application.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/hrms/login')}
                            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-900 font-medium rounded-xl transition-all text-sm border border-slate-200"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const inputClass = "w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30 focus:border-[#6412c6] transition-all text-sm";
    const labelClass = "text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block";

    return (
        <div className="min-h-screen bg-slate-50 p-4 py-8">
            <div className="w-full max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#6412c6] to-[#550fa8] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#6412c6]/20 overflow-hidden">
                        {(hrmsSettings?.companyLogoUrl || getAppLogo('admin')) ? (
                            <img 
                                src={hrmsSettings?.companyLogoUrl || getAppLogo('admin')} 
                                alt="Logo" 
                                className="w-full h-full object-cover bg-white"
                                onError={(e) => { e.target.src = '/itzo-logo-transparent.png'; }}
                            />
                        ) : (
                            <Building2 className="w-7 h-7 text-white" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Join {hrmsSettings?.companyName || getCompanyName() || 'ItzoFood'}</h1>
                    <p className="text-sm text-slate-500 mt-1">Submit your joining request</p>
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                i < currentStep ? 'bg-emerald-500 text-white'
                                : i === currentStep ? 'bg-[#6412c6] text-white shadow-lg shadow-[#6412c6]/30'
                                : 'bg-slate-200 text-slate-500'
                            }`}>
                                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
                            </div>
                            <span className={`hidden sm:block text-xs font-medium ${i === currentStep ? 'text-slate-900' : 'text-slate-500'}`}>
                                {step.title}
                            </span>
                            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                        </div>
                    ))}
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-[#6412c6] via-amber-500 to-[#550fa8]" />
                    <div className="p-6 sm:p-8">
                        {/* Step 1: Personal Info */}
                        {currentStep === 0 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Personal Information</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Full Name *</label>
                                        <input className={inputClass} value={form.fullName} onChange={e => updateField('fullName', e.target.value)} placeholder="Enter full name" required />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Email *</label>
                                        <input type="email" className={inputClass} value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="your@email.com" required />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Phone * <span className="text-[10px] font-normal text-slate-500 normal-case tracking-normal">(10 digits)</span></label>
                                        <input type="tel" className={inputClass} value={form.phone} onChange={e => updateField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" maxLength={10} required />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Password *</label>
                                        <div className="relative">
                                            <input type={showPassword ? 'text' : 'password'} className={`${inputClass} pr-10`} value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="Min 6 characters" required />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Date of Birth</label>
                                        <input type="date" className={inputClass} value={form.dateOfBirth} onChange={e => updateField('dateOfBirth', e.target.value)} />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Gender</label>
                                        <div className="flex gap-4">
                                            {['Male', 'Female', 'Other'].map(g => (
                                                <label key={g} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={e => updateField('gender', e.target.value)} className="accent-[#6412c6]" />
                                                    <span className="text-sm text-slate-300">{g}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Employee Type</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[{ value: 'Office', label: 'Office Employee', desc: 'Works from office location', icon: Building2 },
                                              { value: 'Field', label: 'Field Employee', desc: 'Works on field / mobile', icon: MapPin }].map(opt => (
                                                <label key={opt.value}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                        form.employeeType === opt.value
                                                            ? 'border-[#6412c6] bg-[#f7f3fc]'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                    }`}>
                                                    <input type="radio" name="employeeType" value={opt.value}
                                                        checked={form.employeeType === opt.value}
                                                        onChange={e => updateField('employeeType', e.target.value)}
                                                        className="hidden" />
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                        form.employeeType === opt.value ? 'bg-[#6412c6] text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        <opt.icon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-semibold ${form.employeeType === opt.value ? 'text-[#550fa8]' : 'text-slate-700'}`}>{opt.label}</p>
                                                        <p className="text-[10px] text-slate-400">{opt.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Address & KYC */}
                        {currentStep === 1 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Address & KYC Documents</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Street Address</label>
                                        <input className={inputClass} value={form.street} onChange={e => updateField('street', e.target.value)} placeholder="Street / House No." />
                                    </div>
                                    <div>
                                        <label className={labelClass}>City</label>
                                        <input className={inputClass} value={form.city} onChange={e => updateField('city', e.target.value)} placeholder="City" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>State</label>
                                        <input className={inputClass} value={form.state} onChange={e => updateField('state', e.target.value)} placeholder="State" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Pincode <span className="text-[10px] font-normal text-slate-500 normal-case tracking-normal">(6 digits)</span></label>
                                        <input className={inputClass} value={form.pincode} onChange={e => updateField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="560001" maxLength={6} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Aadhaar Number <span className="text-[10px] font-normal text-slate-500 normal-case tracking-normal">(12 digits)</span></label>
                                        <input className={inputClass} value={form.aadhaarNumber} onChange={e => updateField('aadhaarNumber', e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="123456789012" maxLength={12} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Upload Aadhaar</label>
                                        <div className="relative">
                                            <input type="file" id="aadhaar-upload" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload('aadhaar', e.target.files?.[0])} />
                                            <label htmlFor="aadhaar-upload" className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${form.aadhaarPhotoUrl ? 'text-[#6412c6] border-[#c1a0e8]' : 'text-slate-400'}`}>
                                                {uploading.aadhaar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span className="text-sm font-medium">{uploading.aadhaar ? 'Uploading...' : form.aadhaarPhotoUrl ? 'Uploaded' : 'Upload File'}</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>PAN Number <span className="text-[10px] font-normal text-slate-500 normal-case tracking-normal">(e.g. ABCDE1234F)</span></label>
                                        <input className={inputClass} value={form.panNumber} onChange={e => updateField('panNumber', e.target.value.toUpperCase().slice(0, 10))} placeholder="ABCDE1234F" maxLength={10} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Upload PAN</label>
                                        <div className="relative">
                                            <input type="file" id="pan-upload" className="hidden" accept="image/*,.pdf" onChange={e => handleFileUpload('pan', e.target.files?.[0])} />
                                            <label htmlFor="pan-upload" className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${form.panPhotoUrl ? 'text-[#6412c6] border-[#c1a0e8]' : 'text-slate-400'}`}>
                                                {uploading.pan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span className="text-sm font-medium">{uploading.pan ? 'Uploading...' : form.panPhotoUrl ? 'Uploaded' : 'Upload File'}</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Upload Profile Photo</label>
                                        <div className="relative">
                                            <input type="file" id="profile-upload" className="hidden" accept="image/*" onChange={e => handleFileUpload('profilePhoto', e.target.files?.[0])} />
                                            <label htmlFor="profile-upload" className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${form.profilePhotoUrl ? 'text-[#6412c6] border-[#c1a0e8]' : 'text-slate-400'}`}>
                                                {uploading.profilePhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span className="text-sm font-medium">{uploading.profilePhoto ? 'Uploading...' : form.profilePhotoUrl ? 'Uploaded' : 'Upload Photo'}</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Upload Resume / CV</label>
                                        <div className="relative">
                                            <input type="file" id="resume-upload" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={e => handleFileUpload('resume', e.target.files?.[0])} />
                                            <label htmlFor="resume-upload" className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${form.resumeUrl ? 'text-[#6412c6] border-[#c1a0e8]' : 'text-slate-400'}`}>
                                                {uploading.resume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span className="text-sm font-medium">{uploading.resume ? 'Uploading...' : form.resumeUrl ? 'Uploaded' : 'Upload Resume'}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Qualifications */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Role Details & Qualifications</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Highest Qualification</label>
                                        <input className={inputClass} value={form.qualification} onChange={e => updateField('qualification', e.target.value)} placeholder="e.g., B.Tech, MBA, 12th Pass" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelClass}>Experience</label>
                                        <input className={inputClass} value={form.experience} onChange={e => updateField('experience', e.target.value)} placeholder="e.g., 3 years in Sales" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Department *</label>
                                        <select className={inputClass} value={form.department} onChange={e => updateField('department', e.target.value)}>
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
                                    <div>
                                        <label className={labelClass}>Designation</label>
                                        <input className={inputClass} value={form.designation} onChange={e => updateField('designation', e.target.value)} placeholder="e.g., Associate, Manager" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Expected CTC (Annual ₹)</label>
                                        <input type="number" className={inputClass} value={form.ctc} onChange={e => updateField('ctc', e.target.value)} placeholder="e.g. 500000" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Joining Date *</label>
                                        <input type="date" className={inputClass} value={form.joiningDate} onChange={e => updateField('joiningDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Role *</label>
                                        <select className={inputClass} value={form.roleSelection || (form.hrmsRole === 'Manager' ? 'Manager' : form.employeeType === 'Field' ? 'Field Employee' : 'Office Employee')} onChange={e => {
                                            const role = e.target.value;
                                            setForm(p => ({
                                                ...p,
                                                roleSelection: role,
                                                hrmsRole: role === 'Manager' ? 'Manager' : 'Employee',
                                                employeeType: role === 'Field Employee' ? 'Field' : 'Office'
                                            }));
                                        }}>
                                            <option value="Manager">Manager</option>
                                            <option value="Office Employee">Office Employee</option>
                                            <option value="Field Employee">Field Employee</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Shift</label>
                                        <select className={inputClass} value={form.shift} onChange={e => updateField('shift', e.target.value)}>
                                            <option value="General">General</option>
                                            <option value="Morning">Morning</option>
                                            <option value="Night">Night</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Employment Type</label>
                                        <select className={inputClass} value={form.employmentType} onChange={e => updateField('employmentType', e.target.value)}>
                                            <option value="Full-Time">Full-Time</option>
                                            <option value="Part-Time">Part-Time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Internship">Internship</option>
                                        </select>
                                    </div>
                                    {form.employeeType === 'Office' && (
                                        <div className="sm:col-span-2">
                                            <label className={labelClass}>Assigned Office Location *</label>
                                            <select className={inputClass} value={form.assignedOfficeLocationId} onChange={e => {
                                                const locId = e.target.value;
                                                const selectedLoc = (hrmsSettings?.organization?.officeLocations || []).find(o => String(o._id) === String(locId));
                                                setForm(p => ({
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
                                    <div>
                                        <label className={labelClass}>Office Location Name (Legacy)</label>
                                        <input className={inputClass} value={form.officeLocation} onChange={e => updateField('officeLocation', e.target.value)} placeholder="e.g., HQ, Remote" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Bank & Emergency */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Bank Details</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Account Holder Name</label>
                                            <input className={inputClass} value={form.accountHolderName} onChange={e => updateField('accountHolderName', e.target.value)} placeholder="Name as per bank" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Account Number</label>
                                            <input className={inputClass} value={form.accountNumber} onChange={e => updateField('accountNumber', e.target.value)} placeholder="Account number" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Bank Name</label>
                                            <input className={inputClass} value={form.bankName} onChange={e => updateField('bankName', e.target.value)} placeholder="Bank name" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>IFSC Code</label>
                                            <input className={inputClass} value={form.ifscCode} onChange={e => updateField('ifscCode', e.target.value)} placeholder="IFSC code" />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={labelClass}>UPI ID (Optional)</label>
                                            <input className={inputClass} value={form.upiId} onChange={e => updateField('upiId', e.target.value)} placeholder="name@upi" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Emergency Contact</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelClass}>Name</label>
                                            <input className={inputClass} value={form.emergencyName} onChange={e => updateField('emergencyName', e.target.value)} placeholder="Contact name" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Relation</label>
                                            <input className={inputClass} value={form.emergencyRelation} onChange={e => updateField('emergencyRelation', e.target.value)} placeholder="e.g., Father" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Phone <span className="text-[10px] font-normal text-slate-500 normal-case tracking-normal">(10 digits)</span></label>
                                            <input type="tel" className={inputClass} value={form.emergencyPhone} onChange={e => updateField('emergencyPhone', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" maxLength={10} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 5: Assessment */}
                        {currentStep === 4 && (
                            <div className="-m-6 sm:-m-8">
                                <AssessmentRunner 
                                    applicantInfo={{
                                        fullName: form.fullName.trim(),
                                        email: form.email.trim(),
                                        phone: form.phone.trim()
                                    }} 
                                    onComplete={(result) => handleFinalSubmit(result)} 
                                    onBack={prevStep} 
                                />
                            </div>
                        )}

                        {/* Navigation Buttons (Hide during assessment) */}
                        {currentStep < 4 && (
                            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                                <button
                                    onClick={currentStep === 0 ? () => navigate('/hrms/login') : prevStep}
                                    className="flex items-center gap-2 px-5 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all text-sm border border-slate-200"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    {currentStep === 0 ? 'Login' : 'Previous'}
                                </button>

                                <button
                                    onClick={nextStep}
                                    className="flex items-center gap-2 px-5 h-11 bg-gradient-to-r from-[#6412c6] to-[#550fa8] hover:from-[#550fa8] hover:to-[#460d8b] text-white font-semibold rounded-xl shadow-lg shadow-[#6412c6]/25 transition-all text-sm"
                                >
                                    {currentStep === 3 ? 'Start Assessment' : 'Next'}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
