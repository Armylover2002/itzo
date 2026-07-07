import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, FolderTree, RefreshCw, Layers, X } from 'lucide-react';

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                        <FolderTree className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Categories</h2>
                        <p className="text-sm text-slate-500">Organize KPIs into groups for easier management.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchCategories}
                        className="p-2.5 bg-white hover:bg-slate-50 text-slate-500 rounded-xl border border-slate-200 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
                    </button>
                    <button
                        onClick={() => {
                            setEditId(null);
                            setFormData({ name: '', description: '', isActive: true });
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add Category
                    </button>
                </div>
            </div>

            {/* Categories Grid */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <RefreshCw className="w-7 h-7 text-orange-500 animate-spin" />
                </div>
            ) : categories.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-semibold">No categories yet</p>
                    <p className="text-sm text-slate-400 mt-1">Click "Add Category" to create your first KPI category.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((cat) => (
                        <div
                            key={cat._id}
                            className="bg-white border border-slate-200 hover:border-orange-200 rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-base">
                                            {cat.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-900 text-base group-hover:text-orange-600 transition-colors">
                                                {cat.name}
                                            </h3>
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 ${
                                                cat.isActive
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'bg-red-50 text-red-600'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cat.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {cat.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(cat)}
                                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-orange-600 rounded-lg transition-colors"
                                            title="Edit Category"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat._id)}
                                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                            title="Delete Category"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                                    {cat.description || 'No description provided.'}
                                </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                                Created {new Date(cat.createdAt).toLocaleDateString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <FolderTree className="w-5 h-5 text-orange-500" />
                                {editId ? 'Edit Category' : 'New Category'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Restaurant Onboarding"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="What metrics belong in this category..."
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-2.5">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700 cursor-pointer">
                                    Active (available for new KPIs)
                                </label>
                            </div>
                            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium border border-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors"
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
