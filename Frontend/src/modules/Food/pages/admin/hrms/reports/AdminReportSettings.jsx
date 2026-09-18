import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { Loader2, Save, Plus, X, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminReportSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        requireMetrics: true,
        requireAttachments: false,
        requireTomorrowPlan: true,
        maxAttachments: 5,
        maxUploadSizeMB: 5,
        categories: [],
        allowedFileTypes: []
    });
    
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axiosInstance.get('/hrms/daily-reports/settings');
                if (res.data?.data) {
                    setSettings(res.data.data);
                    setFormData({
                        requireMetrics: res.data.data.requireMetrics ?? true,
                        requireAttachments: res.data.data.requireAttachments ?? false,
                        requireTomorrowPlan: res.data.data.requireTomorrowPlan ?? true,
                        maxAttachments: res.data.data.maxAttachments || 5,
                        maxUploadSizeMB: res.data.data.maxUploadSizeMB || 5,
                        categories: res.data.data.categories || ['General', 'Meeting', 'Field Work', 'Development', 'Support'],
                        allowedFileTypes: res.data.data.allowedFileTypes || ['image/jpeg', 'image/png', 'application/pdf']
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

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await axiosInstance.put('/hrms/daily-reports/admin/settings', formData);
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const addCategory = () => {
        if (!newCategory.trim()) return;
        if (formData.categories.includes(newCategory.trim())) {
            toast.error('Category already exists');
            return;
        }
        handleChange('categories', [...formData.categories, newCategory.trim()]);
        setNewCategory('');
    };

    const removeCategory = (index) => {
        const newCats = [...formData.categories];
        newCats.splice(index, 1);
        handleChange('categories', newCats);
    };

    if (loading) return <div className="flex h-[500px] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" /></div>;

    const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7]";
    const labelClass = "block text-xs font-semibold text-slate-500 mb-1.5";

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Report Settings</h1>
                    <p className="text-sm text-slate-500 mt-1">Configure daily report requirements and constraints</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full sm:w-auto bg-[#6412c6] hover:bg-[#550fa8] text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg shadow-[#6412c6]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-8">
                {/* Toggles */}
                <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                        <Settings2 className="w-4 h-4" /> Requirement Toggles
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input type="checkbox" checked={formData.requireMetrics} onChange={e => handleChange('requireMetrics', e.target.checked)} className="w-4 h-4 text-[#6412c6] rounded border-slate-300 focus:ring-[#6412c6]" />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-800">Require Performance Metrics</span>
                                <span className="text-xs text-slate-500">Show numeric input fields for visits, calls, etc.</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input type="checkbox" checked={formData.requireTomorrowPlan} onChange={e => handleChange('requireTomorrowPlan', e.target.checked)} className="w-4 h-4 text-[#6412c6] rounded border-slate-300 focus:ring-[#6412c6]" />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-800">Require Tomorrow's Plan</span>
                                <span className="text-xs text-slate-500">Make the tomorrow plan field mandatory to submit.</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input type="checkbox" checked={formData.requireAttachments} onChange={e => handleChange('requireAttachments', e.target.checked)} className="w-4 h-4 text-[#6412c6] rounded border-slate-300 focus:ring-[#6412c6]" />
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-800">Require Attachments</span>
                                <span className="text-xs text-slate-500">Mandate at least one uploaded file/image.</span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Limits */}
                <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2">File Upload Constraints</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Max Attachments (Per Report / Comment)</label>
                            <input type="number" min="1" max="20" value={formData.maxAttachments} onChange={e => handleChange('maxAttachments', Number(e.target.value))} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Max File Size (MB)</label>
                            <input type="number" min="1" max="50" value={formData.maxUploadSizeMB} onChange={e => handleChange('maxUploadSizeMB', Number(e.target.value))} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* Categories */}
                <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2">Task Categories</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {formData.categories.map((cat, i) => (
                            <div key={i} className="flex items-center gap-1.5 bg-[#f7f3fc] border border-[#f0e7f9] text-[#460d8b] px-3 py-1.5 rounded-lg text-sm font-medium">
                                <span>{cat}</span>
                                <button type="button" onClick={() => removeCategory(i)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 max-w-sm">
                        <input 
                            type="text" 
                            placeholder="Add new category..." 
                            value={newCategory} 
                            onChange={e => setNewCategory(e.target.value)} 
                            className={inputClass}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); addCategory(); }
                            }}
                        />
                        <button type="button" onClick={addCategory} className="bg-slate-800 text-white px-3 py-2 rounded-xl hover:bg-slate-700 shrink-0">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
