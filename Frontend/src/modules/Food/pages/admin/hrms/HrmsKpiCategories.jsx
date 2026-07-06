import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, FolderTree, CheckCircle, XCircle, RefreshCw, Layers } from 'lucide-react';

export default function HrmsKpiCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '', isActive: true });
    const [editId, setEditId] = useState(null);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/hrms/performance/categories');
            setCategories(res.data?.data || []);
        } catch (error) {
            toast.error('Failed to load KPI categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await axiosInstance.put(`/hrms/performance/categories/${editId}`, formData);
                toast.success('Category Updated Successfully');
            } else {
                await axiosInstance.post('/hrms/performance/categories', formData);
                toast.success('Category Created Successfully');
            }
            setIsModalOpen(false);
            setEditId(null);
            setFormData({ name: '', description: '', isActive: true });
            fetchCategories();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving category');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return;
        try {
            await axiosInstance.delete(`/hrms/performance/categories/${id}`);
            toast.success('Category Deleted');
            fetchCategories();
        } catch (error) {
            toast.error('Error deleting category');
        }
    };

    const openEdit = (cat) => {
        setEditId(cat._id);
        setFormData({
            name: cat.name,
            description: cat.description || '',
            isActive: cat.isActive !== false
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header & Add Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl border border-slate-700/50 shadow-xl">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400">
                        <FolderTree className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">KPI Categories Engine</h2>
                        <p className="text-sm text-slate-400">Organize and group performance metrics by operational domain.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchCategories}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => {
                            setEditId(null);
                            setFormData({ name: '', description: '', isActive: true });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/20 font-semibold text-sm transition-all transform hover:scale-105"
                    >
                        <Plus className="w-4 h-4" /> New Category
                    </button>
                </div>
            </div>

            {/* Categories Grid */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                </div>
            ) : categories.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
                    <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No KPI categories defined yet.</p>
                    <p className="text-xs text-slate-500 mt-1">Click New Category to start organizing your performance metrics.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {categories.map((cat) => (
                        <div
                            key={cat._id}
                            className="bg-slate-900/60 backdrop-blur-md border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all duration-300 flex flex-col justify-between group hover:shadow-orange-500/5"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-base">
                                            {cat.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-100 text-base group-hover:text-orange-400 transition-colors">
                                                {cat.name}
                                            </h3>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                                                cat.isActive
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                            }`}>
                                                {cat.isActive ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                                                {cat.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(cat)}
                                            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-orange-400 rounded-lg transition-colors"
                                            title="Edit Category"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat._id)}
                                            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                                            title="Delete Category"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                                    {cat.description || 'No description provided.'}
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                                <span>Created: {new Date(cat.createdAt).toLocaleDateString()}</span>
                                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300">ID: {cat._id.slice(-6)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <FolderTree className="w-5 h-5 text-orange-500" />
                            {editId ? 'Edit KPI Category' : 'Create KPI Category'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Category Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Restaurant Onboarding"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Explain what metrics belong in this category..."
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-800"
                                />
                                <label htmlFor="isActive" className="text-xs font-medium text-slate-300 cursor-pointer">
                                    Active (Available for new KPIs)
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-semibold shadow-lg shadow-orange-500/20 transition-all"
                                >
                                    {editId ? 'Update Category' : 'Create Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
