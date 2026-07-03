import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { useHrmsSettings } from '../context/HrmsSettingsContext';
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

export default function Signup() {
    const navigate = useNavigate();
    const { hrmsSettings } = useHrmsSettings();
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [form, setForm] = useState({
        fullName: '', email: '', phone: '', password: '',
        dateOfBirth: '', gender: '',
        street: '', city: '', state: '', pincode: '',
        aadhaarNumber: '', aadhaarPhotoUrl: '', panNumber: '', panPhotoUrl: '',
        qualification: '', experience: '',
        department: '', designation: '',
        accountHolderName: '', accountNumber: '', bankName: '', ifscCode: '', upiId: '',
        emergencyName: '', emergencyRelation: '', emergencyPhone: '',
        ctc: '', joiningDate: '', hrmsRole: 'Employee', shift: 'General',
        employmentType: 'Full-Time', officeLocation: '',
        employeeType: 'Office'
    });
    const [uploading, setUploading] = useState({ aadhaar: false, pan: false });

    const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    /* ── strict validators ── */
    const isValidName = (v) => /^[A-Za-z\s]{2,50}$/.test(v.trim());
    const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    const isValidPhone = (v) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, ''));
    const isValidAadhaar = (v) => !v || /^\d{12}$/.test(v.replace(/\s/g, ''));
    const isValidPan = (v) => !v || /^[A-Z]{5}\d{4}[A-Z]$/.test(v.trim().toUpperCase());
    const isValidPincode = (v) => !v || /^\d{6}$/.test(v.trim());

    const handleFileUpload = async (field, file) => {
        if (!file) return;
        setUploading(prev => ({ ...prev, [field]: true }));
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', `hrms/joining-requests/${field}s`);
            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data?.url || res.data?.data?.url || res.data?.imageUrl;
            if (!url) throw new Error('No URL returned from server');
            updateField(`${field}PhotoUrl`, url);
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
                if (!form.fullName.trim()) { toast.error('Full name is required'); return false; }
                if (!isValidName(form.fullName)) { toast.error('Name must be 2-50 characters (letters & spaces only)'); return false; }
                if (!form.email.trim()) { toast.error('Email is required'); return false; }
                if (!isValidEmail(form.email)) { toast.error('Please enter a valid email address'); return false; }
                if (!form.phone.trim()) { toast.error('Phone number is required'); return false; }
                if (!isValidPhone(form.phone)) { toast.error('Enter a valid 10-digit mobile number'); return false; }
                if (!form.password || form.password.length < 6) { toast.error('Password must be at least 6 characters'); return false; }
                return true;
            case 1:
                if (form.aadhaarNumber && !isValidAadhaar(form.aadhaarNumber)) { toast.error('Aadhaar must be exactly 12 digits'); return false; }
                if (form.panNumber && !isValidPan(form.panNumber)) { toast.error('PAN must be in format ABCDE1234F'); return false; }
                if (form.pincode && !isValidPincode(form.pincode)) { toast.error('Pincode must be exactly 6 digits'); return false; }
                return true;
            case 2: return true;
            case 3:
                if (form.emergencyPhone && !isValidPhone(form.emergencyPhone)) { toast.error('Emergency phone must be a valid 10-digit mobile number'); return false; }
                return true;
            default: return true;
        }
    };

    const nextStep = () => {
        if (validateStep()) setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

    const handleFinalSubmit = async (assessmentResult) => {
        setLoading(true);
        try {
            const payload = {
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                password: form.password,
                dateOfBirth: form.dateOfBirth || undefined,
                gender: form.gender || undefined,
                address: {
                    street: form.street, city: form.city,
                    state: form.state, pincode: form.pincode
                },
                aadhaarNumber: form.aadhaarNumber || undefined,
                aadhaarPhotoUrl: form.aadhaarPhotoUrl || undefined,
                panNumber: form.panNumber || undefined,
                panPhotoUrl: form.panPhotoUrl || undefined,
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
                employeeType: form.employeeType || 'Office',
                bankDetails: {
                    accountHolderName: form.accountHolderName,
                    accountNumber: form.accountNumber,
                    bankName: form.bankName,
                    ifscCode: form.ifscCode,
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
                    <div className="h-1.5 bg-orange-500 hover:bg-orange-600" />
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

    const inputClass = "w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-sm";
    const labelClass = "text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block";

    return (
        <div className="min-h-screen bg-slate-50 p-4 py-8">
            <div className="w-full max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-orange-500/20 overflow-hidden">
                        {hrmsSettings?.companyLogoUrl ? (
                            <img src={hrmsSettings.companyLogoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
                        ) : (
                            <Building2 className="w-7 h-7 text-white" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Join {hrmsSettings?.companyName || 'ItzoFood'}</h1>
                    <p className="text-sm text-slate-500 mt-1">Submit your joining request</p>
                </div>

                {/* Stepper */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEPS.map((step, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                i < currentStep ? 'bg-emerald-500 text-white'
                                : i === currentStep ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
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
                    <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />
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
                                                    <input type="radio" name="gender" value={g} checked={form.gender === g} onChange={e => updateField('gender', e.target.value)} className="accent-orange-500" />
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
                                                            ? 'border-orange-500 bg-orange-50'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                    }`}>
                                                    <input type="radio" name="employeeType" value={opt.value}
                                                        checked={form.employeeType === opt.value}
                                                        onChange={e => updateField('employeeType', e.target.value)}
                                                        className="hidden" />
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                        form.employeeType === opt.value ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                                                    }`}>
                                                        <opt.icon className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-semibold ${form.employeeType === opt.value ? 'text-orange-600' : 'text-slate-700'}`}>{opt.label}</p>
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
                                            <label htmlFor="aadhaar-upload" className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${form.aadhaarPhotoUrl ? 'text-orange-500 border-orange-300' : 'text-slate-400'}`}>
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
                                            <label htmlFor="pan-upload" className={`flex items-center justify-center gap-2 w-full h-11 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${form.panPhotoUrl ? 'text-orange-500 border-orange-300' : 'text-slate-400'}`}>
                                                {uploading.pan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                <span className="text-sm font-medium">{uploading.pan ? 'Uploading...' : form.panPhotoUrl ? 'Uploaded' : 'Upload File'}</span>
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
                                        <label className={labelClass}>Department</label>
                                        <input className={inputClass} value={form.department} onChange={e => updateField('department', e.target.value)} placeholder="e.g., Engineering, Sales" />
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
                                        <label className={labelClass}>Joining Date</label>
                                        <input type="date" className={inputClass} value={form.joiningDate} onChange={e => updateField('joiningDate', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>HRMS Role</label>
                                        <select className={inputClass} value={form.hrmsRole} onChange={e => updateField('hrmsRole', e.target.value)}>
                                            <option value="Employee">Employee</option>
                                            <option value="Manager">Manager</option>
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
                                    <div>
                                        <label className={labelClass}>Office Location</label>
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
                                    className="flex items-center gap-2 px-5 h-11 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all text-sm"
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
