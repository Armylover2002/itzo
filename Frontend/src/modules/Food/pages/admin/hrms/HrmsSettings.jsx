import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Settings, Loader2, Save, Plus, X, Clock, CalendarDays, Wallet, Building2, MapPin, Upload, Image, Navigation } from 'lucide-react';

export default function HrmsSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const logoInputRef = useRef(null);
    const [activeSection, setActiveSection] = useState('companyInfo');

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await axiosInstance.get('/hrms/settings');
                setSettings(res.data?.data || null);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const saveSection = async (section, data) => {
        setSaving(true);
        try {
            await axiosInstance.patch(`/hrms/settings/${section}`, data);
            toast.success(`${section} updated successfully`);
        } catch (e) { toast.error(e.response?.data?.message || 'Save failed'); }
        finally { setSaving(false); }
    };

    const handleLogoUpload = async (file) => {
        if (!file) return;
        // Validate type
        const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
        if (!allowed.includes(file.type)) {
            toast.error('Only PNG, JPG, SVG or WebP images are allowed');
            return;
        }
        // Validate size (2 MB max)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo must be smaller than 2 MB');
            return;
        }
        setLogoUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'hrms/company-logo');
            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const url = res.data?.data?.url;
            if (!url) throw new Error('No URL returned from upload');
            // Update local state
            const updated = JSON.parse(JSON.stringify(settings));
            updated.companyInfo.companyLogoUrl = url;
            setSettings(updated);
            // Auto-save so the logo is immediately live everywhere
            await axiosInstance.patch('/hrms/settings/companyInfo', updated.companyInfo);
            toast.success('Company logo updated!');
        } catch (e) {
            toast.error(e.response?.data?.message || 'Logo upload failed');
        } finally {
            setLogoUploading(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const updateNested = (path, value) => {
        setSettings(prev => {
            const updated = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let current = updated;
            for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
            current[keys[keys.length - 1]] = value;
            return updated;
        });
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
    if (!settings) return <div className="text-center p-12 text-slate-500">Failed to load settings</div>;

    const sections = [
        { key: 'companyInfo', label: 'Company Branding', icon: Building2 },
        { key: 'workingHours', label: 'Working Hours', icon: Clock },
        { key: 'leavePolicies', label: 'Leave Policies', icon: CalendarDays },
        { key: 'payrollRules', label: 'Payroll Rules', icon: Wallet },
        { key: 'organization', label: 'Organization', icon: Building2 },
        { key: 'trackingSettings', label: 'Tracking Settings', icon: Navigation },
        { key: 'shifts', label: 'Shifts', icon: Clock },
        { key: 'holidayCalendar', label: 'Holiday Calendar', icon: CalendarDays },
    ];

    const inputClass = "w-full h-10 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30";
    const labelClass = "text-xs font-medium text-slate-600 mb-1 block";

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">HRMS Settings</h1>

            <div className="flex flex-wrap gap-2">
                {sections.map(s => (
                    <button key={s.key} onClick={() => setActiveSection(s.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeSection === s.key ? 'bg-[#6412c6] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                        <s.icon className="w-4 h-4" /> {s.label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                {activeSection === 'companyInfo' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Company Branding & Details</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Company Name</label>
                                <input type="text" className={inputClass} value={settings.companyInfo?.companyName || ''}
                                    onChange={e => updateNested('companyInfo.companyName', e.target.value)} placeholder="e.g. ItzoFood" /></div>
                            {/* ── Company Logo Upload ── */}
                            <div>
                                <label className={labelClass}>Company Logo</label>
                                <div className="flex items-center gap-4">
                                    {/* Preview */}
                                    <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                        {settings.companyInfo?.companyLogoUrl ? (
                                            <img
                                                src={settings.companyInfo.companyLogoUrl}
                                                alt="Company Logo"
                                                className="w-full h-full object-contain p-1"
                                                onError={e => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <Image className="w-6 h-6 text-slate-300" />
                                        )}
                                    </div>
                                    {/* Upload Button */}
                                    <div className="flex flex-col gap-1.5">
                                        <input
                                            ref={logoInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                                            className="hidden"
                                            onChange={e => handleLogoUpload(e.target.files?.[0])}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => logoInputRef.current?.click()}
                                            disabled={logoUploading}
                                            className="flex items-center gap-2 px-4 h-9 bg-[#6412c6] hover:bg-[#550fa8] disabled:opacity-50 text-slate-900 text-sm font-medium rounded-xl transition-colors"
                                        >
                                            {logoUploading
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                                                : <><Upload className="w-4 h-4" /> Upload Logo</>}
                                        </button>
                                        <p className="text-[11px] text-slate-400">PNG, JPG, SVG or WebP · max 2 MB</p>
                                        {settings.companyInfo?.companyLogoUrl && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const updated = JSON.parse(JSON.stringify(settings));
                                                    updated.companyInfo.companyLogoUrl = '';
                                                    setSettings(updated);
                                                    await axiosInstance.patch('/hrms/settings/companyInfo', updated.companyInfo);
                                                    toast.success('Logo removed');
                                                }}
                                                className="text-[11px] text-red-400 hover:text-red-600 text-left"
                                            >
                                                Remove logo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div><label className={labelClass}>Support Email</label>
                                <input type="email" className={inputClass} value={settings.companyInfo?.supportEmail || ''}
                                    onChange={e => updateNested('companyInfo.supportEmail', e.target.value)} placeholder="support@itzofood.com" /></div>
                            <div><label className={labelClass}>Support Phone</label>
                                <input type="text" className={inputClass} value={settings.companyInfo?.supportPhone || ''}
                                    onChange={e => updateNested('companyInfo.supportPhone', e.target.value)} placeholder="+91..." /></div>
                            <div className="sm:col-span-2"><label className={labelClass}>Company Address</label>
                                <textarea className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6412c6]/30" rows={3} value={settings.companyInfo?.companyAddress || ''}
                                    onChange={e => updateNested('companyInfo.companyAddress', e.target.value)} placeholder="123 Tech Park..."></textarea></div>
                            <div><label className={labelClass}>Currency Code</label>
                                <input type="text" className={inputClass} value={settings.companyInfo?.currency || 'INR'}
                                    onChange={e => updateNested('companyInfo.currency', e.target.value)} placeholder="INR" /></div>
                            <div><label className={labelClass}>Currency Symbol</label>
                                <input type="text" className={inputClass} value={settings.companyInfo?.currencySymbol || '₹'}
                                    onChange={e => updateNested('companyInfo.currencySymbol', e.target.value)} placeholder="₹" /></div>
                        </div>
                        <button onClick={() => saveSection('companyInfo', settings.companyInfo)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50 mt-4">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}

                {activeSection === 'workingHours' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Working Hours Configuration</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Minimum Working Hours</label>
                                <input type="number" className={inputClass} value={settings.workingHours?.minimumWorkingHours || 8}
                                    onChange={e => updateNested('workingHours.minimumWorkingHours', Number(e.target.value))} /></div>
                            <div><label className={labelClass}>Grace Period (minutes)</label>
                                <input type="number" className={inputClass} value={settings.workingHours?.gracePeriodMinutes || 15}
                                    onChange={e => updateNested('workingHours.gracePeriodMinutes', Number(e.target.value))} /></div>
                            <div><label className={labelClass}>Short Hour Deduction Rate</label>
                                <input type="number" step="0.1" className={inputClass} value={settings.workingHours?.shortHourDeductionRate || 1}
                                    onChange={e => updateNested('workingHours.shortHourDeductionRate', Number(e.target.value))} /></div>
                            <div><label className={labelClass}>Overtime Rate</label>
                                <input type="number" step="0.1" className={inputClass} value={settings.workingHours?.overtimeRate || 1.5}
                                    onChange={e => updateNested('workingHours.overtimeRate', Number(e.target.value))} /></div>
                        </div>
                        <button onClick={() => saveSection('workingHours', settings.workingHours)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}

                {activeSection === 'leavePolicies' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Leave Policies</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Paid Leaves Per Month</label>
                                <input type="number" className={inputClass} value={settings.leavePolicies?.paidLeavesPerMonth || 4}
                                    onChange={e => updateNested('leavePolicies.paidLeavesPerMonth', Number(e.target.value))} /></div>
                            <div><label className={labelClass}>Max Accumulated Leaves</label>
                                <input type="number" className={inputClass} value={settings.leavePolicies?.maxAccumulatedLeaves || 48}
                                    onChange={e => updateNested('leavePolicies.maxAccumulatedLeaves', Number(e.target.value))} /></div>
                        </div>
                        <button onClick={() => saveSection('leavePolicies', settings.leavePolicies)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}

                {activeSection === 'payrollRules' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Payroll Rules</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div><label className={labelClass}>Salary Calculation Type</label>
                                <select className={inputClass} value={settings.payrollRules?.salaryCalculationType || 'Attendance_Based'}
                                    onChange={e => updateNested('payrollRules.salaryCalculationType', e.target.value)}>
                                    <option value="Attendance_Based">Attendance Based</option><option value="Fixed">Fixed</option>
                                </select></div>
                            <div><label className={labelClass}>Pay Period</label>
                                <select className={inputClass} value={settings.payrollRules?.payPeriod || 'Monthly'}
                                    onChange={e => updateNested('payrollRules.payPeriod', e.target.value)}>
                                    <option>Monthly</option><option>Bi-Weekly</option>
                                </select></div>
                        </div>
                        <button onClick={() => saveSection('payrollRules', settings.payrollRules)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                )}

                {activeSection === 'organization' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-3">Departments</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(settings.organization?.departments || []).map((d, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm flex items-center gap-2">
                                        {d.name}
                                        <button onClick={() => {
                                            const depts = [...settings.organization.departments];
                                            depts.splice(i, 1);
                                            updateNested('organization.departments', depts);
                                        }}><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input id="newDept" className={inputClass} placeholder="New department name" style={{ maxWidth: '250px' }} />
                                <button onClick={() => {
                                    const input = document.getElementById('newDept');
                                    let val = input.value.trim();
                                    if (val) {
                                        // Title Case (capitalize first letter of each word)
                                        val = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                                        const depts = settings.organization?.departments || [];
                                        if (!depts.find(d => d.name.toLowerCase() === val.toLowerCase())) {
                                            updateNested('organization.departments', [...depts, { name: val }]);
                                        } else {
                                            toast.error('Department already exists');
                                        }
                                        input.value = '';
                                    }
                                }} className="px-4 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-3">Designations</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(settings.organization?.designations || []).map((d, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm flex items-center gap-2">
                                        {d}
                                        <button onClick={() => {
                                            const desigs = [...settings.organization.designations];
                                            desigs.splice(i, 1);
                                            updateNested('organization.designations', desigs);
                                        }}><X className="w-3 h-3 text-slate-400 hover:text-red-500" /></button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input id="newDesig" className={inputClass} placeholder="New designation" style={{ maxWidth: '250px' }} />
                                <button onClick={() => {
                                    const input = document.getElementById('newDesig');
                                    let val = input.value.trim();
                                    if (val) {
                                        val = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                                        const desigs = settings.organization?.designations || [];
                                        if (!desigs.find(d => d.toLowerCase() === val.toLowerCase())) {
                                            updateNested('organization.designations', [...desigs, val]);
                                        } else {
                                            toast.error('Designation already exists');
                                        }
                                        input.value = '';
                                    }
                                }} className="px-4 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white rounded-xl text-sm font-medium"><Plus className="w-4 h-4" /></button>
                            </div>
                        </div>

                        {/* Office Locations */}
                        <div>
                            <h3 className="font-semibold text-slate-900 mb-3">Office Locations</h3>
                            <div className="space-y-3 mb-4">
                                {(settings.organization?.officeLocations || []).map((loc, i) => (
                                    <div key={i} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50 relative">
                                        <button onClick={() => {
                                            const locs = [...settings.organization.officeLocations];
                                            locs.splice(i, 1);
                                            updateNested('organization.officeLocations', locs);
                                        }} className="absolute top-4 right-4"><X className="w-4 h-4 text-slate-400 hover:text-red-500" /></button>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className={labelClass}>Office Name</label>
                                                <input className={inputClass} value={loc.name} onChange={e => {
                                                    const locs = [...settings.organization.officeLocations];
                                                    locs[i].name = e.target.value; updateNested('organization.officeLocations', locs);
                                                }} placeholder="e.g. HQ Mumbai" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Latitude</label>
                                                <input type="number" step="any" className={inputClass} value={loc.latitude || ''} onChange={e => {
                                                    const locs = [...settings.organization.officeLocations];
                                                    locs[i].latitude = Number(e.target.value); updateNested('organization.officeLocations', locs);
                                                }} placeholder="19.0760" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Longitude</label>
                                                <input type="number" step="any" className={inputClass} value={loc.longitude || ''} onChange={e => {
                                                    const locs = [...settings.organization.officeLocations];
                                                    locs[i].longitude = Number(e.target.value); updateNested('organization.officeLocations', locs);
                                                }} placeholder="72.8777" />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Radius (Meters)</label>
                                                <input type="number" className={inputClass} value={loc.radiusMeters || 200} onChange={e => {
                                                    const locs = [...settings.organization.officeLocations];
                                                    locs[i].radiusMeters = Number(e.target.value); updateNested('organization.officeLocations', locs);
                                                }} placeholder="200" />
                                            </div>
                                            <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 mb-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if ('geolocation' in navigator) {
                                                            const toastId = toast.loading('Fetching location...');
                                                            navigator.geolocation.getCurrentPosition(
                                                                async (position) => {
                                                                    const lat = Number(position.coords.latitude.toFixed(6));
                                                                    const lon = Number(position.coords.longitude.toFixed(6));
                                                                    const locs = [...settings.organization.officeLocations];
                                                                    locs[i].latitude = lat;
                                                                    locs[i].longitude = lon;
                                                                    
                                                                    try {
                                                                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                                                                        const data = await res.json();
                                                                        if (data && data.display_name) {
                                                                            locs[i].address = data.display_name;
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Reverse geocoding failed:', err);
                                                                    }

                                                                    updateNested('organization.officeLocations', locs);
                                                                    toast.success('Live location and address fetched successfully!', { id: toastId });
                                                                },
                                                                (error) => {
                                                                    toast.error('Error fetching location: ' + error.message, { id: toastId });
                                                                },
                                                                { enableHighAccuracy: true }
                                                            );
                                                        } else {
                                                            toast.error('Geolocation is not supported by your browser.');
                                                        }
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f7f3fc] text-[#550fa8] hover:bg-[#f0e7f9] rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    <MapPin className="w-3.5 h-3.5" /> Fetch Live Location
                                                </button>
                                            </div>
                                            <div className="sm:col-span-2 lg:col-span-4 flex gap-4 items-center">
                                                <div className="flex-1">
                                                    <label className={labelClass}>Address</label>
                                                    <input className={inputClass} value={loc.address || ''} onChange={e => {
                                                        const locs = [...settings.organization.officeLocations];
                                                        locs[i].address = e.target.value; updateNested('organization.officeLocations', locs);
                                                    }} placeholder="Full Address" />
                                                </div>
                                                <label className="flex items-center gap-2 mt-4 text-sm font-medium text-slate-700 cursor-pointer">
                                                    <input type="checkbox" checked={loc.isActive !== false} onChange={e => {
                                                        const locs = [...settings.organization.officeLocations];
                                                        locs[i].isActive = e.target.checked; updateNested('organization.officeLocations', locs);
                                                    }} className="accent-[#6412c6] w-4 h-4 rounded border-slate-300" />
                                                    Active
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => {
                                const locs = settings.organization?.officeLocations || [];
                                updateNested('organization.officeLocations', [...locs, { name: '', address: '', latitude: 0, longitude: 0, radiusMeters: 200, isActive: true }]);
                            }} className="flex items-center gap-2 text-sm text-[#550fa8] font-medium"><Plus className="w-4 h-4" /> Add Office Location</button>
                        </div>
                        
                        <button onClick={() => saveSection('organization', settings.organization)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Organization'}
                        </button>
                    </div>
                )}

                {activeSection === 'trackingSettings' && (
                    <div className="space-y-6">
                        <h3 className="font-semibold text-slate-900 mb-4">Live Tracking Settings (Field Employees)</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className={labelClass}>Enable Live Tracking</label>
                                <select className={inputClass} value={settings.trackingSettings?.enableLiveTracking ? 'true' : 'false'}
                                    onChange={e => updateNested('trackingSettings.enableLiveTracking', e.target.value === 'true')}>
                                    <option value="true">Enabled</option>
                                    <option value="false">Disabled</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">If enabled, field employees' locations will be tracked after check-in.</p>
                            </div>
                            <div>
                                <label className={labelClass}>Tracking Interval (Seconds)</label>
                                <input type="number" className={inputClass} value={settings.trackingSettings?.trackingIntervalSeconds || 60}
                                    onChange={e => updateNested('trackingSettings.trackingIntervalSeconds', Number(e.target.value))} />
                                <p className="text-xs text-slate-500 mt-1">How often the app sends GPS points to the server.</p>
                            </div>
                            <div>
                                <label className={labelClass}>GPS Accuracy Threshold (Meters)</label>
                                <input type="number" className={inputClass} value={settings.trackingSettings?.gpsAccuracyThreshold || 50}
                                    onChange={e => updateNested('trackingSettings.gpsAccuracyThreshold', Number(e.target.value))} />
                                <p className="text-xs text-slate-500 mt-1">Points with worse accuracy will be rejected.</p>
                            </div>
                            <div>
                                <label className={labelClass}>Location Retention (Days)</label>
                                <input type="number" className={inputClass} value={settings.trackingSettings?.locationRetentionDays || 30}
                                    onChange={e => updateNested('trackingSettings.locationRetentionDays', Number(e.target.value))} />
                                <p className="text-xs text-slate-500 mt-1">Number of days to keep location history (requires TTL index update).</p>
                            </div>
                        </div>
                        <button onClick={() => saveSection('trackingSettings', settings.trackingSettings)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50 mt-4">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Tracking Settings'}
                        </button>
                    </div>
                )}

                {activeSection === 'shifts' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Shift Configuration</h3>
                        {(settings.shifts || []).map((shift, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                <input className="h-10 px-3 border border-slate-200 rounded-xl text-sm flex-1" value={shift.name}
                                    onChange={e => { const s = [...settings.shifts]; s[i].name = e.target.value; updateNested('shifts', s); }} />
                                <input type="time" className="h-10 px-3 border border-slate-200 rounded-xl text-sm" value={shift.startTime}
                                    onChange={e => { const s = [...settings.shifts]; s[i].startTime = e.target.value; updateNested('shifts', s); }} />
                                <span className="text-slate-400">to</span>
                                <input type="time" className="h-10 px-3 border border-slate-200 rounded-xl text-sm" value={shift.endTime}
                                    onChange={e => { const s = [...settings.shifts]; s[i].endTime = e.target.value; updateNested('shifts', s); }} />
                                <button onClick={() => { const s = [...settings.shifts]; s.splice(i, 1); updateNested('shifts', s); }}>
                                    <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                        <button onClick={() => updateNested('shifts', [...(settings.shifts || []), { name: '', startTime: '09:00', endTime: '18:00' }])}
                            className="flex items-center gap-2 text-sm text-[#550fa8] font-medium"><Plus className="w-4 h-4" /> Add Shift</button>
                        <button onClick={() => saveSection('shifts', settings.shifts)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Shifts'}
                        </button>
                    </div>
                )}

                {activeSection === 'holidayCalendar' && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-slate-900 mb-4">Holiday Calendar</h3>
                        {(settings.holidayCalendar || []).map((h, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                                <input type="date" className="h-10 px-3 border border-slate-200 rounded-xl text-sm" value={h.date ? h.date.split('T')[0] : ''}
                                    onChange={e => { const hc = [...settings.holidayCalendar]; hc[i].date = e.target.value; updateNested('holidayCalendar', hc); }} />
                                <input className="h-10 px-3 border border-slate-200 rounded-xl text-sm flex-1" value={h.name} placeholder="Holiday name"
                                    onChange={e => { const hc = [...settings.holidayCalendar]; hc[i].name = e.target.value; updateNested('holidayCalendar', hc); }} />
                                <label className="flex items-center gap-1 text-xs text-slate-500">
                                    <input type="checkbox" checked={h.isOptional} onChange={e => { const hc = [...settings.holidayCalendar]; hc[i].isOptional = e.target.checked; updateNested('holidayCalendar', hc); }} className="accent-[#6412c6]" /> Optional
                                </label>
                                <button onClick={() => { const hc = [...settings.holidayCalendar]; hc.splice(i, 1); updateNested('holidayCalendar', hc); }}>
                                    <X className="w-4 h-4 text-slate-400 hover:text-red-500" />
                                </button>
                            </div>
                        ))}
                        <button onClick={() => updateNested('holidayCalendar', [...(settings.holidayCalendar || []), { date: '', name: '', isOptional: false }])}
                            className="flex items-center gap-2 text-sm text-[#550fa8] font-medium"><Plus className="w-4 h-4" /> Add Holiday</button>
                        <button onClick={() => saveSection('holidayCalendar', settings.holidayCalendar)} disabled={saving}
                            className="flex items-center gap-2 px-5 h-10 bg-[#6412c6] hover:bg-[#550fa8] text-white font-medium rounded-xl text-sm disabled:opacity-50">
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Holidays'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
