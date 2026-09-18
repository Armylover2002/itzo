import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { Loader2, Save, Plus, X, Phone, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportSettings() {
    const [settings, setSettings] = useState({
        hrContact: {
            name: '', email: '', mobile: '', companySupportEmail: '', companySupportNumber: '', officeAddress: '', workingDays: '', workingHours: ''
        },
        ticketConfig: {
            categories: [], priorities: [], defaultStatus: 'Open', autoReplyMessage: '', maxAttachmentSizeMB: 5
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axiosInstance.get('/hrms/support/settings');
                if (res.data?.data) {
                    setSettings({
                        hrContact: { ...settings.hrContact, ...res.data.data.hrContact },
                        ticketConfig: { ...settings.ticketConfig, ...res.data.data.ticketConfig }
                    });
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleChange = (section, field, value) => {
        setSettings(prev => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
    };

    const handleArrayChange = (field, index, value) => {
        const newArr = [...settings.ticketConfig[field]];
        newArr[index] = value;
        handleChange('ticketConfig', field, newArr);
    };

    const addArrayItem = (field) => {
        handleChange('ticketConfig', field, [...settings.ticketConfig[field], 'New Option']);
    };

    const removeArrayItem = (field, index) => {
        const newArr = settings.ticketConfig[field].filter((_, i) => i !== index);
        handleChange('ticketConfig', field, newArr);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axiosInstance.put('/hrms/support/admin/settings', settings);
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Support Settings</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage HR contact details and support center configurations</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#6412c6] text-white px-6 py-2.5 rounded-xl font-medium hover:bg-[#550fa8] transition-colors shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* HR Contact Info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Phone className="w-5 h-5 text-[#6412c6]" />
                        HR Contact Information
                    </h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">HR Name</label>
                                <input type="text" value={settings.hrContact.name} onChange={e => handleChange('hrContact', 'name', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">HR Email</label>
                                <input type="email" value={settings.hrContact.email} onChange={e => handleChange('hrContact', 'email', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">HR Mobile</label>
                                <input type="text" value={settings.hrContact.mobile} onChange={e => handleChange('hrContact', 'mobile', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Company Support Email</label>
                                <input type="email" value={settings.hrContact.companySupportEmail} onChange={e => handleChange('hrContact', 'companySupportEmail', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Company Support Number</label>
                            <input type="text" value={settings.hrContact.companySupportNumber} onChange={e => handleChange('hrContact', 'companySupportNumber', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Office Address</label>
                            <input type="text" value={settings.hrContact.officeAddress} onChange={e => handleChange('hrContact', 'officeAddress', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Working Days</label>
                                <input type="text" value={settings.hrContact.workingDays} onChange={e => handleChange('hrContact', 'workingDays', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" placeholder="e.g. Monday to Friday" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Working Hours</label>
                                <input type="text" value={settings.hrContact.workingHours} onChange={e => handleChange('hrContact', 'workingHours', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" placeholder="e.g. 10:00 AM - 06:00 PM" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Ticket Config */}
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-[#6412c6]" />
                            Ticket Configuration
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Auto Reply Message</label>
                                <textarea value={settings.ticketConfig.autoReplyMessage} onChange={e => handleChange('ticketConfig', 'autoReplyMessage', e.target.value)} rows={3} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none resize-none" placeholder="Message sent automatically when ticket is created..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Default Status</label>
                                    <input type="text" value={settings.ticketConfig.defaultStatus} onChange={e => handleChange('ticketConfig', 'defaultStatus', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 block mb-1.5">Max Attachment Size (MB)</label>
                                    <input type="number" value={settings.ticketConfig.maxAttachmentSizeMB} onChange={e => handleChange('ticketConfig', 'maxAttachmentSizeMB', e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-[#6412c6] outline-none" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Categories</h2>
                            <button onClick={() => addArrayItem('categories')} className="text-xs font-bold text-[#6412c6] flex items-center gap-1 hover:text-[#550fa8]"><Plus className="w-3 h-3" /> Add Category</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {settings.ticketConfig.categories.map((cat, i) => (
                                <div key={i} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                                    <input type="text" value={cat} onChange={e => handleArrayChange('categories', i, e.target.value)} className="bg-transparent text-sm w-28 focus:outline-none" />
                                    <button onClick={() => removeArrayItem('categories', i)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between mb-4 mt-6">
                            <h2 className="text-lg font-bold text-slate-800">Priorities</h2>
                            <button onClick={() => addArrayItem('priorities')} className="text-xs font-bold text-[#6412c6] flex items-center gap-1 hover:text-[#550fa8]"><Plus className="w-3 h-3" /> Add Priority</button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {settings.ticketConfig.priorities.map((pri, i) => (
                                <div key={i} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                                    <input type="text" value={pri} onChange={e => handleArrayChange('priorities', i, e.target.value)} className="bg-transparent text-sm w-24 focus:outline-none" />
                                    <button onClick={() => removeArrayItem('priorities', i)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
