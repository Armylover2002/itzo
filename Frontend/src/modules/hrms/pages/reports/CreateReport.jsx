import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosInstance from '@core/api/axios';
import { Loader2, ArrowLeft, Plus, X, Upload, FileText, Save, Send, AlertCircle, Search, Store } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CreateReport() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');

    const [loading, setLoading] = useState(!!id);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    
    const [settings, setSettings] = useState(null);
    const fileInputRef = useRef(null);

    const [formData, setFormData] = useState({
        reportDate: new Date().toISOString().split('T')[0],
        tasks: [{ title: '', category: 'General', status: 'Completed' }],
        workSummary: '',
        metrics: { restaurantsVisited: 0, restaurantsVisitedNames: [], meetingsConducted: 0, callsMade: 0, leadsGenerated: 0, ordersCompleted: 0 },
        problemsFaced: '',
        achievements: '',
        pendingWork: '',
        tomorrowPlan: '',
        remarks: '',
        attachments: []
    });

    // Restaurant dropdown state
    const [restaurantQuery, setRestaurantQuery] = useState('');
    const [restaurantOptions, setRestaurantOptions] = useState([]);
    const [restaurantSearchLoading, setRestaurantSearchLoading] = useState(false);
    const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
    const restaurantDropdownRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const settingsRes = await axiosInstance.get('/hrms/daily-reports/settings');
                setSettings(settingsRes.data?.data);

                if (id) {
                    const reportRes = await axiosInstance.get(`/hrms/daily-reports/${id}`);
                    const r = reportRes.data?.data?.report;
                    if (r) {
                        setFormData({
                            reportDate: r.reportDate.split('T')[0],
                            tasks: r.tasks?.length > 0 ? r.tasks : [{ title: '', category: 'General', status: 'Completed' }],
                            workSummary: r.workSummary || '',
                            metrics: {
                                restaurantsVisited: r.metrics?.restaurantsVisited || 0,
                                restaurantsVisitedNames: r.metrics?.restaurantsVisitedNames || [],
                                meetingsConducted: r.metrics?.meetingsConducted || 0,
                                callsMade: r.metrics?.callsMade || 0,
                                leadsGenerated: r.metrics?.leadsGenerated || 0,
                                ordersCompleted: r.metrics?.ordersCompleted || 0
                            },
                            problemsFaced: r.problemsFaced || '',
                            achievements: r.achievements || '',
                            pendingWork: r.pendingWork || '',
                            tomorrowPlan: r.tomorrowPlan || '',
                            remarks: r.remarks || '',
                            attachments: r.attachments || []
                        });
                    }
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load form data');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [id]);

    // Close restaurant dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (restaurantDropdownRef.current && !restaurantDropdownRef.current.contains(event.target)) {
                setShowRestaurantDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced restaurant search
    const searchRestaurants = useCallback(async (query) => {
        if (!query || query.trim().length < 2) {
            setRestaurantOptions([]);
            return;
        }
        setRestaurantSearchLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/daily-reports/restaurants/search?q=${encodeURIComponent(query.trim())}`);
            setRestaurantOptions(res.data?.data?.restaurants || []);
        } catch (err) {
            console.error('Restaurant search failed:', err);
            setRestaurantOptions([]);
        } finally {
            setRestaurantSearchLoading(false);
        }
    }, []);

    const handleRestaurantQueryChange = (value) => {
        setRestaurantQuery(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => searchRestaurants(value), 300);
    };

    const addRestaurant = (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        // Avoid duplicates (case-insensitive)
        const exists = formData.metrics.restaurantsVisitedNames.some(
            n => n.toLowerCase() === trimmed.toLowerCase()
        );
        if (exists) {
            toast.error('Restaurant already added');
            return;
        }
        const newNames = [...formData.metrics.restaurantsVisitedNames, trimmed];
        setFormData({
            ...formData,
            metrics: {
                ...formData.metrics,
                restaurantsVisitedNames: newNames,
                restaurantsVisited: newNames.length
            }
        });
        setRestaurantQuery('');
        setRestaurantOptions([]);
    };

    const removeRestaurant = (index) => {
        const newNames = [...formData.metrics.restaurantsVisitedNames];
        newNames.splice(index, 1);
        setFormData({
            ...formData,
            metrics: {
                ...formData.metrics,
                restaurantsVisitedNames: newNames,
                restaurantsVisited: newNames.length
            }
        });
    };

    const handleRestaurantKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (restaurantQuery.trim()) {
                addRestaurant(restaurantQuery);
            }
        }
    };

    const handleTaskChange = (index, field, value) => {
        const newTasks = [...formData.tasks];
        newTasks[index][field] = value;
        setFormData({ ...formData, tasks: newTasks });
    };

    const addTask = () => setFormData({ ...formData, tasks: [...formData.tasks, { title: '', category: 'General', status: 'Completed' }] });
    const removeTask = (index) => {
        if (formData.tasks.length > 1) {
            const newTasks = [...formData.tasks];
            newTasks.splice(index, 1);
            setFormData({ ...formData, tasks: newTasks });
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const maxMB = settings?.maxUploadSizeMB || 5;
        const maxBytes = maxMB * 1024 * 1024;
        const validFiles = files.filter(f => f.size <= maxBytes);
        
        if (validFiles.length < files.length) toast.error(`Some files exceeded the ${maxMB}MB limit`);
        if (formData.attachments.length + validFiles.length > (settings?.maxAttachments || 5)) {
            toast.error(`Maximum ${settings?.maxAttachments || 5} attachments allowed`);
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            validFiles.forEach(f => formData.append('images', f));

            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const urls = res.data?.data || [];
            const newAttachments = (Array.isArray(urls) ? urls : [urls]).map((url, i) => ({
                url: typeof url === 'string' ? url : url?.url,
                name: validFiles[i]?.name || `file-${i}`,
                type: validFiles[i]?.type || '',
                size: validFiles[i]?.size || 0
            })).filter(f => f.url);

            setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload files');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index) => {
        const newAtt = [...formData.attachments];
        newAtt.splice(index, 1);
        setFormData({ ...formData, attachments: newAtt });
    };

    const handleSubmit = async (status) => {
        // Validation
        if (!formData.reportDate) return toast.error('Report Date is required');
        if (formData.tasks.some(t => !t.title.trim())) return toast.error('All tasks must have a title');
        if (status === 'Submitted' && settings?.requireTomorrowPlan && !formData.tomorrowPlan.trim()) return toast.error('Tomorrow\'s Plan is required');

        setSaving(true);
        try {
            const payload = { ...formData, status };
            if (id) payload._id = id;

            const res = await axiosInstance.post('/hrms/daily-reports', payload);
            toast.success(`Report ${status === 'Draft' ? 'saved as draft' : 'submitted'} successfully`);
            navigate('/hrms/reports/list');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save report');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-[500px] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" /></div>;

    const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7]";
    const labelClass = "block text-xs font-semibold text-slate-500 mb-1.5";

    // Metrics to render as simple number inputs (excluding restaurantsVisited which gets special treatment)
    const numericMetrics = ['meetingsConducted', 'callsMade', 'leadsGenerated', 'ordersCompleted'];

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{id ? 'Edit Daily Report' : 'New Daily Report'}</h1>
                    <p className="text-sm text-slate-500">Document your day's work</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Basic Info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2">Basic Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Report Date <span className="text-red-500">*</span></label>
                            <input type="date" value={formData.reportDate} onChange={e => setFormData({...formData, reportDate: e.target.value})} className={inputClass} />
                        </div>
                    </div>
                </div>

                {/* Tasks */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Today's Tasks <span className="text-red-500">*</span></h3>
                        <button onClick={addTask} className="text-xs font-bold text-[#550fa8] hover:text-[#460d8b] flex items-center gap-1"><Plus className="w-3.5 h-3.5"/> Add Task</button>
                    </div>
                    <div className="space-y-3">
                        {formData.tasks.map((task, i) => (
                            <div key={i} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <input type="text" placeholder="Task description..." value={task.title} onChange={e => handleTaskChange(i, 'title', e.target.value)} className={`${inputClass} flex-1`} />
                                <select value={task.category} onChange={e => handleTaskChange(i, 'category', e.target.value)} className={`${inputClass} sm:w-40 bg-white`}>
                                    {settings?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={task.status} onChange={e => handleTaskChange(i, 'status', e.target.value)} className={`${inputClass} sm:w-36 bg-white`}>
                                    <option value="Completed">Completed</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Pending">Pending</option>
                                </select>
                                <button onClick={() => removeTask(i)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4">
                        <label className={labelClass}>Work Summary</label>
                        <textarea placeholder="Briefly summarize your day..." value={formData.workSummary} onChange={e => setFormData({...formData, workSummary: e.target.value})} className={inputClass} rows={3} />
                    </div>
                </div>

                {/* Metrics */}
                {(settings?.requireMetrics !== false) && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2">Performance Metrics</h3>
                        
                        {/* Restaurant Visited — Multi-select dropdown */}
                        <div className="mb-5">
                            <label className={labelClass}>
                                <span className="flex items-center gap-1.5">
                                    <Store className="w-3.5 h-3.5 text-[#6412c6]" />
                                    Restaurants Visited ({formData.metrics.restaurantsVisitedNames.length})
                                </span>
                            </label>
                            
                            {/* Selected restaurant chips */}
                            {formData.metrics.restaurantsVisitedNames.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {formData.metrics.restaurantsVisitedNames.map((name, i) => (
                                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f7f3fc] border border-[#d8c4f1] rounded-lg text-sm font-medium text-[#460d8b]">
                                            <Store className="w-3 h-3" />
                                            {name}
                                            <button type="button" onClick={() => removeRestaurant(i)} className="text-[#9359d7] hover:text-red-500 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Search input with dropdown */}
                            <div className="relative" ref={restaurantDropdownRef}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search or type restaurant name & press Enter..."
                                        value={restaurantQuery}
                                        onChange={e => {
                                            handleRestaurantQueryChange(e.target.value);
                                            setShowRestaurantDropdown(true);
                                        }}
                                        onFocus={() => setShowRestaurantDropdown(true)}
                                        onKeyDown={handleRestaurantKeyDown}
                                        className={`${inputClass} pl-9 pr-10`}
                                    />
                                    {restaurantSearchLoading && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6412c6] animate-spin" />
                                    )}
                                </div>

                                {/* Dropdown results */}
                                {showRestaurantDropdown && (restaurantOptions.length > 0 || (restaurantQuery.trim().length >= 2 && !restaurantSearchLoading)) && (
                                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                                        {restaurantOptions.map((r, i) => {
                                            const alreadyAdded = formData.metrics.restaurantsVisitedNames.some(
                                                n => n.toLowerCase() === r.name.toLowerCase()
                                            );
                                            return (
                                                <button
                                                    key={r._id || i}
                                                    type="button"
                                                    disabled={alreadyAdded}
                                                    onClick={() => { addRestaurant(r.name); setShowRestaurantDropdown(false); }}
                                                    className={`w-full text-left px-4 py-2.5 hover:bg-[#f7f3fc] flex items-center justify-between text-sm transition-colors border-b border-slate-50 last:border-0 ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                >
                                                    <span className="flex flex-col">
                                                        <span className="font-medium text-slate-700">{r.name}</span>
                                                        {r.city && <span className="text-[11px] text-slate-400">{r.city}</span>}
                                                    </span>
                                                    {alreadyAdded && <span className="text-[10px] text-slate-400 font-bold">ADDED</span>}
                                                </button>
                                            );
                                        })}
                                        {/* Free-form option */}
                                        {restaurantQuery.trim().length >= 2 && !restaurantOptions.some(r => r.name.toLowerCase() === restaurantQuery.trim().toLowerCase()) && (
                                            <button
                                                type="button"
                                                onClick={() => { addRestaurant(restaurantQuery); setShowRestaurantDropdown(false); }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-center gap-2 text-sm font-medium text-emerald-700 border-t border-slate-100"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add "{restaurantQuery.trim()}" as custom entry
                                            </button>
                                        )}
                                        {restaurantOptions.length === 0 && restaurantQuery.trim().length >= 2 && !restaurantSearchLoading && (
                                            <div className="px-4 py-2 text-xs text-slate-400">No matching restaurants found. Press Enter or click above to add as custom entry.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Other numeric metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {numericMetrics.map((metric) => (
                                <div key={metric}>
                                    <label className={labelClass}>{metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</label>
                                    <input type="number" min="0" value={formData.metrics[metric]} onChange={e => setFormData({...formData, metrics: {...formData.metrics, [metric]: Number(e.target.value)}})} className={inputClass} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Additional Info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 border-b pb-2">Feedback & Planning</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Problems Faced</label>
                            <textarea value={formData.problemsFaced} onChange={e => setFormData({...formData, problemsFaced: e.target.value})} className={inputClass} rows={2} />
                        </div>
                        <div>
                            <label className={labelClass}>Achievements</label>
                            <textarea value={formData.achievements} onChange={e => setFormData({...formData, achievements: e.target.value})} className={inputClass} rows={2} />
                        </div>
                        <div>
                            <label className={labelClass}>Pending Work</label>
                            <textarea value={formData.pendingWork} onChange={e => setFormData({...formData, pendingWork: e.target.value})} className={inputClass} rows={2} />
                        </div>
                        <div>
                            <label className={labelClass}>Tomorrow's Plan {settings?.requireTomorrowPlan && <span className="text-red-500">*</span>}</label>
                            <textarea value={formData.tomorrowPlan} onChange={e => setFormData({...formData, tomorrowPlan: e.target.value})} className={inputClass} rows={2} />
                        </div>
                    </div>
                </div>

                {/* Attachments */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Attachments {settings?.requireAttachments && <span className="text-red-500">*</span>}</h3>
                        <span className="text-xs text-slate-400">Max {settings?.maxAttachments || 5} files, {settings?.maxUploadSizeMB || 5}MB each</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 mb-4">
                        {formData.attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-sm">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span className="truncate max-w-[150px] text-slate-700 font-medium">{att.name}</span>
                                <button type="button" onClick={() => removeAttachment(i)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>

                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || formData.attachments.length >= (settings?.maxAttachments || 5)} className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 hover:border-[#c1a0e8] transition-colors disabled:opacity-50">
                        {uploading ? <Loader2 className="w-6 h-6 text-[#6412c6] animate-spin" /> : <Upload className="w-6 h-6 text-slate-400" />}
                        <span className="text-sm font-medium text-slate-600">{uploading ? 'Uploading...' : 'Click to upload files'}</span>
                    </button>
                    <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileChange} accept={settings?.allowedFileTypes?.join(',')} />
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                    onClick={() => handleSubmit('Draft')}
                    disabled={saving || uploading}
                    className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" /> Save Draft
                </button>
                <button
                    onClick={() => handleSubmit('Submitted')}
                    disabled={saving || uploading}
                    className="px-6 py-2.5 rounded-xl bg-[#6412c6] text-white font-semibold hover:bg-[#550fa8] shadow-lg shadow-[#6412c6]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Report
                </button>
            </div>
        </div>
    );
}
