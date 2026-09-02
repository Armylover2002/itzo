import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { User, Loader2, Building2, Phone, Mail, MapPin, CreditCard, Heart, GraduationCap, Edit2, X, Check, AlertCircle, XCircle, Camera } from 'lucide-react';

const Section = ({ icon: Icon, title, children }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <div className="w-8 h-8 rounded-lg bg-[#f7f3fc] flex items-center justify-center"><Icon className="w-4 h-4 text-[#550fa8]" /></div>
            <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
    </div>
);

const Field = ({ label, value }) => (
    <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        <p className="text-sm font-medium text-slate-900 break-words break-all">{value || '—'}</p>
    </div>
);

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const fetchProfile = async () => {
        try {
            const res = await axiosInstance.get('/hrms/employees/me');
            setProfile(res.data?.data || null);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" /></div>;
    if (!profile?.employee) return <div className="p-8 text-center text-slate-500">Profile not found</div>;

    const emp = profile.employee;
    const admin = emp.adminId;
    const manager = emp.managerId;

    const startEdit = () => {
        setIsEditing(true);
        setEditForm({
            profilePhotoUrl: admin?.profileImage || emp.profilePhotoUrl || '',
            phone: admin?.phone || '',
            address: {
                street: emp.address?.street || '',
                city: emp.address?.city || '',
                state: emp.address?.state || '',
                pincode: emp.address?.pincode || ''
            },
            bankDetails: {
                accountHolderName: emp.bankDetails?.accountHolderName || '',
                accountNumber: emp.bankDetails?.accountNumber || '',
                bankName: emp.bankDetails?.bankName || '',
                ifscCode: emp.bankDetails?.ifscCode || '',
                upiId: emp.bankDetails?.upiId || ''
            },
            emergencyContact: {
                name: emp.emergencyContact?.name || '',
                relation: emp.emergencyContact?.relation || '',
                phone: emp.emergencyContact?.phone || ''
            },
            qualification: emp.qualification || '',
            experience: emp.experience || ''
        });
    };

    const submitEdit = async () => {
        setSubmitting(true);
        try {
            await axiosInstance.post('/hrms/employees/me/edit-request', editForm);
            toast.success("Profile edit request submitted for approval");
            setIsEditing(false);
            fetchProfile();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to submit edit request');
        } finally {
            setSubmitting(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data?.data?.url;
            if (url) {
                setEditForm(prev => ({ ...prev, profilePhotoUrl: url }));
            }
        } catch (err) {
            toast.error('Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    const inputClass = "w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6412c6] focus:ring-1 focus:ring-[#6412c6] transition-all";

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            
            {/* Status Banners */}
            {emp.profileEditStatus === 'Pending' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-amber-900 text-sm">Edit Request Pending</h4>
                        <p className="text-sm text-amber-700 mt-1">Your requested profile changes are currently under review by an administrator. You cannot make further edits until this is resolved.</p>
                    </div>
                </div>
            )}

            {emp.profileEditStatus === 'Rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-red-900 text-sm">Edit Request Rejected</h4>
                        <p className="text-sm text-red-700 mt-1">Reason: <span className="font-medium">{emp.profileEditRejectionReason}</span></p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-bold backdrop-blur-sm border border-slate-200 overflow-hidden">
                            {(isEditing && editForm.profilePhotoUrl) ? (
                                <img src={editForm.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (admin?.profileImage || emp?.profilePhotoUrl) ? (
                                <img src={admin.profileImage || emp.profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                admin?.name?.[0]?.toUpperCase() || 'E'
                            )}
                        </div>
                        {isEditing && (
                            <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#6412c6] hover:bg-[#550fa8] rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors border-2 border-slate-800">
                                {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Camera className="w-4 h-4 text-white" />}
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                            </label>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">{admin?.name || 'Employee'}</h1>
                        <p className="text-slate-300 mt-0.5">{emp.designation || 'Employee'} · {emp.department || 'General'}</p>
                        <p className="text-slate-400 text-sm mt-1 flex gap-4">
                            <span>ID: {emp.employeeId}</span>
                            <span>{emp.employmentType}</span>
                        </p>
                    </div>
                </div>
                {emp.profileEditStatus !== 'Pending' && (
                    <div>
                        {!isEditing ? (
                            <button onClick={startEdit} className="px-5 h-10 bg-white text-slate-900 hover:bg-slate-50 font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm">
                                <Edit2 className="w-4 h-4" /> Edit Profile
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-4 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-all flex items-center gap-2 backdrop-blur-sm border border-slate-200">
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                                <button onClick={submitEdit} disabled={submitting} className="px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm disabled:opacity-50">
                                    <Check className="w-4 h-4" /> {submitting ? 'Submitting...' : 'Submit for Approval'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Details */}
                <Section icon={User} title="Personal Details">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        <Field label="Full Name" value={admin?.name} />
                        <Field label="Employee ID" value={emp.employeeId} />
                        <Field label="Email" value={admin?.email} />
                        {isEditing ? (
                            <div>
                                <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                                <input type="text" className={inputClass} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                            </div>
                        ) : <Field label="Phone" value={admin?.phone} />}
                        <Field label="Role" value={emp.hrmsRole === 'Manager' ? 'Manager' : emp.employeeType ? `${emp.employeeType} Employee` : emp.hrmsRole} />
                        <Field label="Status" value={emp.status} />
                    </div>
                </Section>

                {/* Professional Details */}
                <Section icon={Building2} title="Professional Details">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        <Field label="Department" value={emp.department} />
                        <Field label="Designation" value={emp.designation} />
                        <Field label="Joining Date" value={emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '—'} />
                        <Field label="Manager" value={manager?.adminId?.name || '—'} />
                        <Field label="Office Location" value={emp.officeLocation} />
                        <Field label="CTC" value={emp.ctc ? `₹${emp.ctc.toLocaleString()}` : '—'} />
                        <div>
                            <p className="text-xs font-medium text-slate-500 mb-1">Employee Type</p>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                emp.employeeType === 'Field'
                                    ? 'bg-[#f7f3fc] text-[#460d8b]'
                                    : 'bg-emerald-50 text-emerald-700'
                            }`}>
                                {emp.employeeType === 'Field' ? '📍 Field Employee' : '🏢 Office Employee'}
                            </span>
                        </div>
                        <Field label="Employment Type" value={emp.employmentType} />
                    </div>
                </Section>

                {/* Address */}
                <Section icon={MapPin} title="Address">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        {isEditing ? (
                            <>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Street Address</label>
                                    <input type="text" className={inputClass} value={editForm.address.street} onChange={e => setEditForm({ ...editForm, address: { ...editForm.address, street: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">City</label>
                                    <input type="text" className={inputClass} value={editForm.address.city} onChange={e => setEditForm({ ...editForm, address: { ...editForm.address, city: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">State</label>
                                    <input type="text" className={inputClass} value={editForm.address.state} onChange={e => setEditForm({ ...editForm, address: { ...editForm.address, state: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Pincode</label>
                                    <input type="text" className={inputClass} value={editForm.address.pincode} onChange={e => setEditForm({ ...editForm, address: { ...editForm.address, pincode: e.target.value } })} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="col-span-2"><Field label="Street" value={emp.address?.street} /></div>
                                <Field label="City" value={emp.address?.city} />
                                <Field label="State" value={emp.address?.state} />
                                <Field label="Pincode" value={emp.address?.pincode} />
                            </>
                        )}
                    </div>
                </Section>

                {/* Bank Details */}
                <Section icon={CreditCard} title="Bank Details">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        {isEditing ? (
                            <>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Account Holder</label>
                                    <input type="text" className={inputClass} value={editForm.bankDetails.accountHolderName} onChange={e => setEditForm({ ...editForm, bankDetails: { ...editForm.bankDetails, accountHolderName: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Account Number</label>
                                    <input type="text" className={inputClass} value={editForm.bankDetails.accountNumber} onChange={e => setEditForm({ ...editForm, bankDetails: { ...editForm.bankDetails, accountNumber: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Bank Name</label>
                                    <input type="text" className={inputClass} value={editForm.bankDetails.bankName} onChange={e => setEditForm({ ...editForm, bankDetails: { ...editForm.bankDetails, bankName: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">IFSC Code</label>
                                    <input type="text" className={inputClass} value={editForm.bankDetails.ifscCode} onChange={e => setEditForm({ ...editForm, bankDetails: { ...editForm.bankDetails, ifscCode: e.target.value } })} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">UPI ID (Optional)</label>
                                    <input type="text" className={inputClass} value={editForm.bankDetails.upiId} onChange={e => setEditForm({ ...editForm, bankDetails: { ...editForm.bankDetails, upiId: e.target.value } })} />
                                </div>
                            </>
                        ) : (
                            <>
                                <Field label="Account Holder" value={emp.bankDetails?.accountHolderName} />
                                <Field label="Account Number" value={emp.bankDetails?.accountNumber} />
                                <Field label="Bank" value={emp.bankDetails?.bankName} />
                                <Field label="IFSC" value={emp.bankDetails?.ifscCode} />
                                <div className="col-span-2"><Field label="UPI ID" value={emp.bankDetails?.upiId} /></div>
                            </>
                        )}
                    </div>
                </Section>

                {/* Emergency Contact */}
                <Section icon={Heart} title="Emergency Contact">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        {isEditing ? (
                            <>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Name</label>
                                    <input type="text" className={inputClass} value={editForm.emergencyContact.name} onChange={e => setEditForm({ ...editForm, emergencyContact: { ...editForm.emergencyContact, name: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Relation</label>
                                    <input type="text" className={inputClass} value={editForm.emergencyContact.relation} onChange={e => setEditForm({ ...editForm, emergencyContact: { ...editForm.emergencyContact, relation: e.target.value } })} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Phone</label>
                                    <input type="text" className={inputClass} value={editForm.emergencyContact.phone} onChange={e => setEditForm({ ...editForm, emergencyContact: { ...editForm.emergencyContact, phone: e.target.value } })} />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="col-span-2"><Field label="Name" value={emp.emergencyContact?.name} /></div>
                                <Field label="Relation" value={emp.emergencyContact?.relation} />
                                <Field label="Phone" value={emp.emergencyContact?.phone} />
                            </>
                        )}
                    </div>
                </Section>

                {/* Qualifications */}
                <Section icon={GraduationCap} title="Qualifications & Experience">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        {isEditing ? (
                            <>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Qualification</label>
                                    <input type="text" className={inputClass} value={editForm.qualification} onChange={e => setEditForm({ ...editForm, qualification: e.target.value })} placeholder="e.g. B.Tech Computer Science" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Experience</label>
                                    <input type="text" className={inputClass} value={editForm.experience} onChange={e => setEditForm({ ...editForm, experience: e.target.value })} placeholder="e.g. 2 Years" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="col-span-2"><Field label="Qualification" value={emp.qualification} /></div>
                                <div className="col-span-2"><Field label="Experience" value={emp.experience} /></div>
                            </>
                        )}
                    </div>
                </Section>
            </div>
        </div>
    );
}
