import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Loader2, Plus, Trash2, Check, FileText, AlertCircle, Building2, User, Phone, Mail, MapPin } from 'lucide-react';
import { Dialog, DialogContent } from '@food/components/ui/dialog';
import api from '@food/api';
import { toast } from 'sonner';

const VENDOR_OPTIONS = [
    { id: 'partner', name: 'ItzoFood Legal Partner', desc: 'Direct corporate compliance partner' },
    { id: 'zolvit', name: 'Zolvit', desc: 'Fast-track corporate registration provider' },
    { id: 'plans4u', name: 'Plans4U', desc: 'Consultants for small & medium food businesses' },
    { id: 'auditzprime', name: 'AuditzPrime', desc: 'Chartered accountants and financial advisors' },
    { id: 'indiafilings', name: 'IndiaFilings', desc: 'India\'s leading tax & compliance platform' }
];

const LICENSE_OPTIONS = [
    'FSSAI License',
    'GST Registration',
    'Trademark Registration',
    'Trade License',
    'Shop & Establishment License',
    'Fire Safety NOC',
    'Pollution NOC',
    'Lease Agreement',
    'Vendor Agreement',
    'Franchise Agreement',
    'Other'
];

export default function LicensingSupportModal({ isOpen, onClose, preFillData }) {
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        vendor: '',
        restaurantName: '',
        ownerName: '',
        city: '',
        address: '',
        restaurantId: '',
        gstNumber: '',
        mobile: '',
        email: '',
        selectedLicenses: [],
        otherLicenseText: '',
        termsAccepted: false
    });

    useEffect(() => {
        if (isOpen && preFillData) {
            setFormData(prev => ({
                ...prev,
                ...preFillData,
                selectedLicenses: preFillData.selectedLicenses || prev.selectedLicenses
            }));
        }
    }, [isOpen, preFillData]);



    const [files, setFiles] = useState({
        aadhaar: null,
        pan: null,
        existingFssai: null,
        existingGst: null,
        shopImage: null,
        restaurantPhoto: null,
        otherDocs: []
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleLicenseToggle = (license) => {
        setFormData(prev => {
            const current = prev.selectedLicenses;
            const updated = current.includes(license)
                ? current.filter(l => l !== license)
                : [...current, license];
            
            if (errors.selectedLicenses) {
                setErrors(err => ({ ...err, selectedLicenses: null }));
            }
            return { ...prev, selectedLicenses: updated };
        });
    };

    const handleFileChange = (e, key) => {
        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        const validateFile = (file) => {
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                toast.error(`Invalid format for ${file.name}. Only PDF, JPG, JPEG, and PNG are allowed.`);
                return false;
            }
            if (file.size > 10 * 1024 * 1024) {
                toast.error(`File ${file.name} exceeds the 10 MB size limit.`);
                return false;
            }
            return true;
        };

        if (key === 'otherDocs') {
            const newFiles = Array.from(fileList).filter(validateFile);
            setFiles(prev => ({
                ...prev,
                otherDocs: [...prev.otherDocs, ...newFiles].slice(0, 5) // Cap at 5 files
            }));
        } else {
            const file = fileList[0];
            if (validateFile(file)) {
                setFiles(prev => ({ ...prev, [key]: file }));
            }
        }
    };

    const removeFile = (key, idx = null) => {
        if (key === 'otherDocs' && idx !== null) {
            setFiles(prev => ({
                ...prev,
                otherDocs: prev.otherDocs.filter((_, i) => i !== idx)
            }));
        } else {
            setFiles(prev => ({ ...prev, [key]: null }));
        }
    };

    const validateStep = (step) => {
        const tempErrors = {};
        if (step === 1) {
            if (!formData.vendor) tempErrors.vendor = 'Consultant selection is required.';
            if (!formData.restaurantName.trim()) tempErrors.restaurantName = 'Restaurant Name is required.';
            if (!formData.ownerName.trim()) tempErrors.ownerName = 'Owner Name is required.';
            if (!formData.city.trim()) tempErrors.city = 'City is required.';
        } else if (step === 2) {
            if (!formData.mobile.trim()) {
                tempErrors.mobile = 'Mobile Number is required.';
            } else if (!/^\+?\d{10,14}$/.test(formData.mobile.replace(/[\s-]/g, ''))) {
                tempErrors.mobile = 'Must be between 10 and 14 digits.';
            }
            if (!formData.email.trim()) {
                tempErrors.email = 'Email Address is required.';
            } else if (!/^[a-zA-Z0-9._%+-]+@(?!(gmail\\.comm|yahoo\\.con)$)[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/.test(formData.email)) {
                tempErrors.email = 'Invalid email format.';
            }
        } else if (step === 3) {
            if (formData.selectedLicenses.length === 0) {
                tempErrors.selectedLicenses = 'At least one license selection is required.';
            }
            if (formData.selectedLicenses.includes('Other') && !formData.otherLicenseText.trim()) {
                tempErrors.otherLicenseText = 'Please describe the other license required.';
            }
        } else if (step === 4) {
            if (!formData.termsAccepted) {
                tempErrors.termsAccepted = 'You must agree to the Terms & Conditions.';
            }
        }

        setErrors(tempErrors);
        return Object.keys(tempErrors).length === 0;
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => prev - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep(4)) return;

        setSubmitting(true);
        const dataToSend = new FormData();

        // Append text fields
        Object.keys(formData).forEach(key => {
            if (key === 'selectedLicenses') {
                dataToSend.append(key, JSON.stringify(formData[key]));
            } else {
                dataToSend.append(key, formData[key]);
            }
        });

        // Append files
        Object.keys(files).forEach(key => {
            if (key === 'otherDocs') {
                files[key].forEach(file => {
                    dataToSend.append('otherDocs', file);
                });
            } else if (files[key]) {
                dataToSend.append(key, files[key]);
            }
        });

        try {
            const res = await api.post('/licensing-request', dataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (res.data.success) {
                toast.success('Your request has been submitted successfully. Our licensing partner will contact you shortly.');
                onClose();
                // Reset form
                setFormData({
                    vendor: '',
                    restaurantName: '',
                    ownerName: '',
                    city: '',
                    address: '',
                    restaurantId: '',
                    gstNumber: '',
                    mobile: '',
                    email: '',
                    selectedLicenses: [],
                    otherLicenseText: '',
                    termsAccepted: false
                });
                setFiles({
                    aadhaar: null,
                    pan: null,
                    existingFssai: null,
                    existingGst: null,
                    shopImage: null,
                    restaurantPhoto: null,
                    otherDocs: []
                });
                setCurrentStep(1);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit licensing request. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl w-[95vw] rounded-3xl p-0 bg-white overflow-hidden shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="bg-slate-950 text-white p-6 relative flex-shrink-0">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="absolute right-5 top-5 p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="space-y-1">
                        <span className="text-[10px] bg-rose-500 text-white font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">Services</span>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight">Licensing Support @ItzoFood</h2>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                            ItzoFood has partnered with trusted licensing consultants to help restaurant partners obtain all required business licenses and registrations. Fill out the form below and our selected licensing partner will contact you to assist with the complete process.
                        </p>
                    </div>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 flex flex-col justify-between">
                    
                    {/* Highlighted Warning/Disclaimers Box */}
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs text-rose-800 leading-relaxed font-semibold">
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Pricing shown is indicative and may change. Final pricing depends on the selected consultant.</li>
                                <li>Taxes are extra wherever applicable.</li>
                                <li>Selected consultant will contact the restaurant after submission.</li>
                                <li>Filling this form does not guarantee approval of any government license.</li>
                                <li>ItzoFood only connects restaurant partners with consultants.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Step Tracker */}
                    <div className="flex items-center justify-between text-xs font-black text-slate-450 border-b border-slate-100 pb-3 uppercase tracking-wider">
                        <span>Step {currentStep} of 4</span>
                        <span className="text-slate-900 font-extrabold">
                            {currentStep === 1 && 'Vendor & Restaurant Info'}
                            {currentStep === 2 && 'Contact Details'}
                            {currentStep === 3 && 'Licenses & Documents'}
                            {currentStep === 4 && 'Terms & Submission'}
                        </span>
                    </div>

                    <div className="flex-1 py-2">
                        <AnimatePresence mode="wait">
                            {currentStep === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-5"
                                >
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select your preferred consultant *</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {VENDOR_OPTIONS.map(v => (
                                                <label 
                                                    key={v.id} 
                                                    className={`p-3.5 border rounded-2xl cursor-pointer flex flex-col justify-between transition-all ${
                                                        formData.vendor === v.name 
                                                            ? 'border-rose-500 bg-rose-50/20 ring-1 ring-rose-500' 
                                                            : 'border-slate-200 hover:border-slate-350 hover:bg-slate-50/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="radio" 
                                                            name="vendor" 
                                                            value={v.name} 
                                                            checked={formData.vendor === v.name}
                                                            onChange={handleChange}
                                                            className="accent-rose-500" 
                                                        />
                                                        <span className="text-sm font-extrabold text-slate-900">{v.name}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 pl-6 mt-1 font-medium">{v.desc}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {errors.vendor && <p className="text-red-500 text-xs">{errors.vendor}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                        <div className="space-y-1 md:col-span-2">
                                            <label className="text-xs font-bold text-slate-700 uppercase">Restaurant Name *</label>
                                            <div className="relative">
                                                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                                <input 
                                                    type="text" 
                                                    name="restaurantName" 
                                                    value={formData.restaurantName}
                                                    onChange={handleChange}
                                                    placeholder="Enter Restaurant Name"
                                                    className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                                />
                                            </div>
                                            {errors.restaurantName && <p className="text-red-500 text-xs">{errors.restaurantName}</p>}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 uppercase">City *</label>
                                            <div className="relative">
                                                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                                <input 
                                                    type="text" 
                                                    name="city" 
                                                    value={formData.city}
                                                    onChange={handleChange}
                                                    placeholder="e.g. Delhi"
                                                    className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                                />
                                            </div>
                                            {errors.city && <p className="text-red-500 text-xs">{errors.city}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 uppercase">Restaurant Owner Name *</label>
                                        <div className="relative">
                                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                            <input 
                                                type="text" 
                                                name="ownerName" 
                                                value={formData.ownerName}
                                                onChange={handleChange}
                                                placeholder="Full Name of Restaurant Owner"
                                                className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                            />
                                        </div>
                                        {errors.ownerName && <p className="text-red-500 text-xs">{errors.ownerName}</p>}
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-4"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 uppercase">Mobile Number *</label>
                                            <div className="relative">
                                                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                                <input 
                                                    type="tel" 
                                                    name="mobile" 
                                                    value={formData.mobile}
                                                    onChange={handleChange}
                                                    placeholder="10-14 digit number"
                                                    className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                                />
                                            </div>
                                            {errors.mobile && <p className="text-red-500 text-xs">{errors.mobile}</p>}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 uppercase">Email Address *</label>
                                            <div className="relative">
                                                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                                <input 
                                                    type="email" 
                                                    name="email" 
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    placeholder="owner@restaurant.com"
                                                    className="w-full pl-9 pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                                />
                                            </div>
                                            {errors.email && <p className="text-red-500 text-xs">{errors.email}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-700 uppercase font-sans">Restaurant Address</label>
                                        <textarea 
                                            name="address" 
                                            value={formData.address}
                                            onChange={handleChange}
                                            rows="2"
                                            placeholder="Complete street address (Optional)"
                                            className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50 resize-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 uppercase">Existing Restaurant ID</label>
                                            <input 
                                                type="text" 
                                                name="restaurantId" 
                                                value={formData.restaurantId}
                                                onChange={handleChange}
                                                placeholder="If registered on ItzoFood (Optional)"
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-700 uppercase">GST Number</label>
                                            <input 
                                                type="text" 
                                                name="gstNumber" 
                                                value={formData.gstNumber}
                                                onChange={handleChange}
                                                placeholder="15-character GSTIN (Optional)"
                                                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50 uppercase"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-5"
                                >
                                    {/* Licenses List Checkboxes */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Required Licenses * (Select all that apply)</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {LICENSE_OPTIONS.map(opt => (
                                                <label 
                                                    key={opt}
                                                    className={`flex items-center gap-2 p-2.5 border rounded-xl cursor-pointer transition-all ${
                                                        formData.selectedLicenses.includes(opt)
                                                            ? 'border-rose-350 bg-rose-50/10 ring-1 ring-rose-500/20 text-rose-800'
                                                            : 'border-slate-200 hover:bg-slate-50 text-slate-650'
                                                    }`}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={formData.selectedLicenses.includes(opt)}
                                                        onChange={() => handleLicenseToggle(opt)}
                                                        className="accent-rose-500 rounded"
                                                    />
                                                    <span className="text-xs font-extrabold truncate">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {errors.selectedLicenses && <p className="text-red-500 text-xs mt-1">{errors.selectedLicenses}</p>}
                                    </div>

                                    {formData.selectedLicenses.includes('Other') && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-1"
                                        >
                                            <label className="text-xs font-bold text-slate-700 uppercase">Describe Other Licensing Requirement *</label>
                                            <input 
                                                type="text" 
                                                name="otherLicenseText"
                                                value={formData.otherLicenseText}
                                                onChange={handleChange}
                                                placeholder="e.g. Liquor License, Music License"
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 text-sm bg-slate-50/50"
                                            />
                                            {errors.otherLicenseText && <p className="text-red-500 text-xs">{errors.otherLicenseText}</p>}
                                        </motion.div>
                                    )}

                                    {/* Upload Documents Checklist */}
                                    <div className="space-y-2 pt-2 border-t border-slate-100">
                                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block mb-1">Upload Documents (Optional, PDF/JPG/PNG up to 10MB)</label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {[
                                                { label: 'Aadhaar Card', key: 'aadhaar' },
                                                { label: 'PAN Card', key: 'pan' },
                                                { label: 'Existing FSSAI', key: 'existingFssai' },
                                                { label: 'Existing GST', key: 'existingGst' },
                                                { label: 'Shop Image', key: 'shopImage' },
                                                { label: 'Restaurant Photo', key: 'restaurantPhoto' }
                                            ].map(doc => (
                                                <div key={doc.key} className="p-3 border border-slate-200 border-dashed rounded-2xl flex flex-col justify-between items-center text-center bg-slate-50/30">
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase mb-2 truncate max-w-full">{doc.label}</span>
                                                    {files[doc.key] ? (
                                                        <div className="flex flex-col items-center">
                                                            <FileText className="w-8 h-8 text-rose-500 mb-1" />
                                                            <span className="text-[9px] font-black text-slate-600 truncate max-w-[100px]">{files[doc.key].name}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeFile(doc.key)}
                                                                className="text-slate-400 hover:text-red-500 mt-2 text-[9px] font-black uppercase flex items-center gap-0.5"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Remove
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="cursor-pointer hover:bg-slate-100 p-2.5 rounded-full transition-colors flex items-center justify-center">
                                                            <Upload className="w-4 h-4 text-slate-400" />
                                                            <input 
                                                                type="file" 
                                                                accept=".pdf,.jpg,.jpeg,.png"
                                                                onChange={(e) => handleFileChange(e, doc.key)}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Other Files list */}
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase">Other Documents (Capped at 5 files)</label>
                                                {files.otherDocs.length < 5 && (
                                                    <label className="text-rose-500 hover:text-rose-600 font-extrabold text-[10px] cursor-pointer flex items-center gap-1">
                                                        <Plus className="w-3.5 h-3.5" /> Add Document
                                                        <input 
                                                            type="file" 
                                                            multiple
                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                            onChange={(e) => handleFileChange(e, 'otherDocs')}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            {files.otherDocs.length > 0 && (
                                                <div className="space-y-1.5 mt-2">
                                                    {files.otherDocs.map((file, idx) => (
                                                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                                                            <span className="text-[11px] font-bold text-slate-650 truncate max-w-[80%]">{file.name}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeFile('otherDocs', idx)} 
                                                                className="text-slate-400 hover:text-red-500"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 4 && (
                                <motion.div
                                    key="step4"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="space-y-4"
                                >
                                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">Terms & Conditions</h3>
                                    
                                    {/* Swiggy-branded scrollable terms */}
                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-h-[160px] overflow-y-auto text-xs text-slate-550 space-y-2.5 font-medium leading-relaxed">
                                        <p>1. Restaurant partner explicitly agrees to share all submitted information, address details, and uploaded document files with the selected licensing consultant.</p>
                                        <p>2. ItzoFood acts solely as a facilitator/intermediary connecting restaurant partners with certified consultants. ItzoFood does not provide direct legal, tax, or licensing consultation.</p>
                                        <p>3. ItzoFood makes no representations, guarantees, or warranties regarding the approval, timeline, or issuance of any licenses by government authorities.</p>
                                        <p>4. Pricing for licensing assistance is determined at the sole discretion of the consultant. Indicative pricing shown is subject to change based on actual restaurant type or requirements.</p>
                                        <p>5. Government filing fees and stamp duties are separate and must be paid as extra, where applicable, according to state and central regulations.</p>
                                        <p>6. The selected consultant is solely responsible for carrying out the licensing activities. ItzoFood shall not be held liable for delays, errors, or disputes during execution.</p>
                                        <p>7. Any disputes regarding fees, service delivery, or license rejection must be resolved directly between the restaurant partner and the consultant.</p>
                                        <p>8. Submitting this request only indicates interest in consulting assistance and does not guarantee activation of services by the consultant.</p>
                                        <p>9. ItzoFood reserves the right to suspend or discontinue the licensing support facilitation program without any prior notice.</p>
                                        <p>10. The restaurant owner confirms that all information, documents, and identity cards uploaded are authentic, accurate, and valid.</p>
                                    </div>

                                    {/* Auto Review Summary */}
                                    <div className="bg-rose-500/[0.02] rounded-2xl p-3 border border-rose-500/10 grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-slate-400 block font-medium">Selected Vendor</span>
                                            <span className="text-slate-800 font-extrabold">{formData.vendor}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block font-medium">City</span>
                                            <span className="text-slate-800 font-extrabold">{formData.city}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block font-medium">Restaurant</span>
                                            <span className="text-slate-800 font-extrabold">{formData.restaurantName}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block font-medium font-sans">Licenses Required</span>
                                            <span className="text-rose-600 font-black truncate block max-w-full">
                                                {formData.selectedLicenses.join(', ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                name="termsAccepted"
                                                checked={formData.termsAccepted}
                                                onChange={handleChange}
                                                disabled={submitting}
                                                className="mt-1 accent-rose-500 h-4 w-4 rounded border-slate-350"
                                            />
                                            <span className="text-xs font-extrabold text-slate-600 select-none leading-normal">
                                                I agree to the Terms & Conditions and consent to share my details with the consultant. *
                                            </span>
                                        </label>
                                        {errors.termsAccepted && <p className="text-red-500 text-xs mt-1">{errors.termsAccepted}</p>}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Footer Controls */}
                    <div className="border-t border-slate-100 pt-6 flex items-center justify-between flex-shrink-0">
                        {currentStep > 1 ? (
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={prevStep}
                                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-extrabold text-xs transition-all active:scale-95 disabled:opacity-50"
                            >
                                Previous
                            </button>
                        ) : (
                            <div />
                        )}

                        {currentStep < 4 ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-extrabold text-xs transition-all active:scale-95 ml-auto"
                            >
                                Next
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-8 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-full font-extrabold text-xs transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50 ml-auto"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Submit Request
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
