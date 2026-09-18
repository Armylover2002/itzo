import React, { useState, useEffect, useRef } from 'react';
import axiosInstance from '@core/api/axios';
import { useNavigate } from 'react-router-dom';
import { Loader2, UploadCloud, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupportCreate() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(true);

    const [form, setForm] = useState({
        subject: '',
        category: '',
        priority: 'Medium',
        description: ''
    });

    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axiosInstance.get('/hrms/support/settings');
                setSettings(res.data?.data);
                if (res.data?.data?.ticketConfig?.categories?.length > 0) {
                    setForm(f => ({ ...f, category: res.data.data.ticketConfig.categories[0] }));
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to load support settings');
            } finally {
                setSettingsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const maxMB = settings?.ticketConfig?.maxAttachmentSizeMB || 5;
        const maxBytes = maxMB * 1024 * 1024;

        const validFiles = files.filter(f => f.size <= maxBytes);
        if (validFiles.length < files.length) {
            toast.error(`Some files exceeded the ${maxMB}MB limit`);
        }

        if (validFiles.length === 0) return;

        setUploading(true);
        try {
            const formData = new FormData();
            validFiles.forEach(f => formData.append('images', f)); // using the image upload endpoint since it's the standard multipart array upload in this system

            const res = await axiosInstance.post('/uploads/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const urls = res.data?.data || [];
            const newAttachments = urls.map((url, i) => ({
                url,
                name: validFiles[i].name,
                type: validFiles[i].type,
                size: validFiles[i].size
            }));

            setAttachments(prev => [...prev, ...newAttachments]);
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload attachments');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.subject || !form.category || !form.description) {
            return toast.error('Please fill in all required fields');
        }

        setLoading(true);
        try {
            const payload = {
                ...form,
                attachments
            };
            const res = await axiosInstance.post('/hrms/support/tickets', payload);
            toast.success('Support request raised successfully');
            navigate(`/hrms/support/${res.data.data._id}`);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to raise request');
        } finally {
            setLoading(false);
        }
    };

    if (settingsLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    const categories = settings?.ticketConfig?.categories || [];
    const priorities = settings?.ticketConfig?.priorities || ['Low', 'Medium', 'High', 'Urgent'];

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Raise Support Request</h1>
                <p className="text-sm text-slate-500 mt-1">Submit a new ticket to the HR team</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Subject <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Brief summary of the issue"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] outline-none transition-all"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Category <span className="text-red-500">*</span></label>
                        <select
                            value={form.category}
                            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] outline-none transition-all"
                            required
                        >
                            <option value="" disabled>Select category</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700">Priority <span className="text-red-500">*</span></label>
                        <select
                            value={form.priority}
                            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] outline-none transition-all"
                            required
                        >
                            {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Description <span className="text-red-500">*</span></label>
                    <textarea
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="Provide detailed information about your request..."
                        rows={6}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#f0e7f9] focus:border-[#9359d7] outline-none transition-all resize-y"
                        required
                    />
                </div>

                {/* Attachments */}
                <div className="space-y-3">
                    <label className="text-sm font-semibold text-slate-700">Attachments (Optional)</label>
                    
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                            {uploading ? 'Uploading...' : 'Upload Files'}
                        </button>
                        <span className="text-xs text-slate-400">Max size: {settings?.ticketConfig?.maxAttachmentSizeMB || 5}MB per file</span>
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*,.pdf,.doc,.docx"
                        />
                    </div>

                    {attachments.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-3">
                            {attachments.map((att, i) => (
                                <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                                    <span className="text-xs text-slate-600 truncate max-w-[150px]">{att.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(i)}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/hrms/support/list')}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 bg-[#6412c6] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#550fa8] transition-colors shadow-sm shadow-[#6412c6]/20 disabled:opacity-70"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Submit Request
                    </button>
                </div>
            </form>
        </div>
    );
}
