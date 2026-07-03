import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Target, Settings, Save, X, Activity } from 'lucide-react';

export default function HrmsKpiSettings() {
    const [kpis, setKpis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        metricKey: 'REST_ONBOARDED_COUNT',
        description: '',
        weightage: 10,
        target: 10,
        targetType: 'Numeric',
        frequency: 'Monthly',
        department: 'All',
        role: 'All',
        isActive: true
    });
    const [editId, setEditId] = useState(null);

    const fetchKpis = async () => {
        try {
            const res = await axiosInstance.get('/hrms/performance/kpi');
            setKpis(res.data?.data || []);
        } catch (error) {
            toast.error('Failed to load KPIs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKpis();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                await axiosInstance.put(`/hrms/performance/kpi/${editId}`, formData);
                toast.success('KPI Updated Successfully');
            } else {
                await axiosInstance.post('/hrms/performance/kpi', formData);
                toast.success('KPI Created Successfully');
            }
            setIsModalOpen(false);
            setEditId(null);
            fetchKpis();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving KPI');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this KPI?')) return;
        try {
            await axiosInstance.delete(`/hrms/performance/kpi/${id}`);
            toast.success('KPI Deleted');
            fetchKpis();
        } catch (error) {
            toast.error('Error deleting KPI');
        }
    };

    const openEdit = (kpi) => {
        setEditId(kpi._id);
        setFormData(kpi);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-orange-500" />
                        KPI Settings Engine
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Dynamically configure evaluation parameters for Employee Performance.</p>
                </div>
                <button 
                    onClick={() => {
                        setEditId(null);
                        setFormData({
                            name: '', metricKey: 'REST_ONBOARDED_COUNT', description: '', weightage: 10,
                            target: 10, targetType: 'Numeric', frequency: 'Monthly', department: 'All', role: 'All', isActive: true
                        });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" /> Add KPI
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                    <div className="col-span-full text-center py-12">Loading KPIs...</div>
                ) : kpis.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500">No KPIs configured.</div>
                ) : (
                    kpis.map(kpi => (
                        <div key={kpi._id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:border-orange-200 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-semibold text-slate-800">{kpi.name}</h3>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${kpi.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {kpi.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(kpi)} className="text-slate-400 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(kpi._id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            
                            <div className="space-y-2 mt-4 text-sm text-slate-600">
                                <div className="flex justify-between"><span className="text-slate-400">Metric Key:</span> <span className="font-medium text-slate-800">{kpi.metricKey}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Target:</span> <span className="font-medium text-slate-800">{kpi.target} {kpi.targetType === 'Percentage' ? '%' : ''}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Weightage:</span> <span className="font-medium text-slate-800">{kpi.weightage}%</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Department:</span> <span>{kpi.department}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400">Role:</span> <span>{kpi.role}</span></div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <h2 className="text-lg font-bold text-slate-800">{editId ? 'Edit KPI' : 'Create KPI'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">KPI Name</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Metric Provider Key</label>
                                <select value={formData.metricKey} onChange={e => setFormData({...formData, metricKey: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500">
                                    <option value="REST_ONBOARDED_COUNT">Restaurants Onboarded</option>
                                    <option value="REST_ASSIGNED_COUNT">Restaurants Assigned</option>
                                    <option value="REST_APPROVED_COUNT">Restaurants Approved</option>
                                    <option value="REST_ACTIVE_COUNT">Active Restaurants (Live + Orders)</option>
                                    <option value="ORDERS_TOTAL">Total Delivered Orders</option>
                                    <option value="REVENUE_GENERATED">Revenue Generated</option>
                                    <option value="ATTENDANCE_SCORE">Attendance Score (%)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
                                    <input required type="number" value={formData.target} onChange={e => setFormData({...formData, target: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Type</label>
                                    <select value={formData.targetType} onChange={e => setFormData({...formData, targetType: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500">
                                        <option value="Numeric">Numeric Count</option>
                                        <option value="Currency">Currency (₹)</option>
                                        <option value="Percentage">Percentage (%)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Weightage (%) - Overall contribution</label>
                                <input required type="number" min="0" max="100" value={formData.weightage} onChange={e => setFormData({...formData, weightage: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                                    <input type="text" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} placeholder="e.g. Sales, All" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                                    <input type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} placeholder="e.g. Employee, All" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500" />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mt-4">
                                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500" />
                                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">KPI is Active</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
                                    <Save className="w-4 h-4" /> Save KPI
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
