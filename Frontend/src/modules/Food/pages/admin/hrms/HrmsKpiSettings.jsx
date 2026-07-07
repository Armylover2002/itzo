import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Target, Save, X, Activity, FolderTree, RefreshCw, Filter, CheckCircle2 } from 'lucide-react';
import HrmsKpiCategories from './HrmsKpiCategories';
import HrmsKpiRuleBuilder from './HrmsKpiRuleBuilder';

export default function HrmsKpiSettings() {
    const [activeMainTab, setActiveMainTab] = useState('kpis'); // kpis | categories
    const [kpis, setKpis] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        metricKey: 'REST_ONBOARDED_COUNT',
        categoryId: '',
        description: '',
        weightage: 10,
        target: 100,
        targetType: 'Numeric',
        frequency: 'Monthly',
        department: 'All',
        role: 'All',
        isActive: true,
        formulaExpression: '',
        ruleConfig: {
            appliesToRole: ['All'],
            appliesToDepartment: ['All'],
            minOrdersThreshold: 1,
            activeRestaurantRules: {
                requireApproved: true,
                requireMenuAvailable: true,
                requireAcceptingOrders: true,
                requireNotSuspended: true,
                minOrders: 1
            }
        },
        performanceLevels: [
            { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets.' },
            { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
            { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
            { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus.' },
            { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
        ]
    });
    const [editId, setEditId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [kpisRes, catsRes] = await Promise.all([
                axiosInstance.get('/hrms/performance/kpi'),
                axiosInstance.get('/hrms/performance/categories')
            ]);
            setKpis(kpisRes.data?.data || []);
            setCategories(catsRes.data?.data || []);
        } catch (error) {
            toast.error('Failed to load KPI data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            if (!payload.categoryId) delete payload.categoryId;

            if (editId) {
                await axiosInstance.put(`/hrms/performance/kpi/${editId}`, payload);
                toast.success('KPI Updated Successfully');
            } else {
                await axiosInstance.post('/hrms/performance/kpi', payload);
                toast.success('KPI Created Successfully');
            }
            setIsModalOpen(false);
            setEditId(null);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving KPI');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this KPI?')) return;
        try {
            await axiosInstance.delete(`/hrms/performance/kpi/${id}`);
            toast.success('KPI Deleted');
            fetchData();
        } catch (error) {
            toast.error('Error deleting KPI');
        }
    };

    const openEdit = (kpi) => {
        setEditId(kpi._id);
        setFormData({
            name: kpi.name || '',
            metricKey: kpi.metricKey || 'REST_ONBOARDED_COUNT',
            categoryId: kpi.categoryId?._id || kpi.categoryId || '',
            description: kpi.description || '',
            weightage: kpi.weightage || 10,
            target: kpi.target || 100,
            targetType: kpi.targetType || 'Numeric',
            frequency: kpi.frequency || 'Monthly',
            department: kpi.department || 'All',
            role: kpi.role || 'All',
            isActive: kpi.isActive !== false,
            formulaExpression: kpi.formulaExpression || '',
            ruleConfig: kpi.ruleConfig || {
                appliesToRole: ['All'],
                appliesToDepartment: ['All'],
                minOrdersThreshold: 1,
                activeRestaurantRules: {
                    requireApproved: true,
                    requireMenuAvailable: true,
                    requireAcceptingOrders: true,
                    requireNotSuspended: true,
                    minOrders: 1
                }
            },
            performanceLevels: kpi.performanceLevels && kpi.performanceLevels.length > 0 ? kpi.performanceLevels : [
                { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets.' },
                { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
                { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
                { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus.' },
                { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
            ]
        });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditId(null);
        setFormData({
            name: '', metricKey: 'REST_ONBOARDED_COUNT', categoryId: categories[0]?._id || '', description: '',
            weightage: 10, target: 100, targetType: 'Numeric', frequency: 'Monthly', department: 'All', role: 'All',
            isActive: true, formulaExpression: '',
            ruleConfig: {
                appliesToRole: ['All'], appliesToDepartment: ['All'], minOrdersThreshold: 1,
                activeRestaurantRules: { requireApproved: true, requireMenuAvailable: true, requireAcceptingOrders: true, requireNotSuspended: true, minOrders: 1 }
            },
            performanceLevels: [
                { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets.' },
                { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
                { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
                { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus.' },
                { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
            ]
        });
        setIsModalOpen(true);
    };

    const filteredKpis = selectedCategoryFilter === 'All'
        ? kpis
        : kpis.filter(k => (k.categoryId?._id || k.categoryId) === selectedCategoryFilter);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-orange-600" />
                        </div>
                        KPI Management
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 ml-[52px]">
                        Configure performance metrics, targets, and evaluation criteria.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-2.5 bg-white hover:bg-slate-50 text-slate-500 rounded-xl border border-slate-200 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
                    </button>
                    <button
                        onClick={openNew}
                        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add KPI
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-0">
                <button
                    onClick={() => setActiveMainTab('kpis')}
                    className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
                        activeMainTab === 'kpis'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Target className="w-4 h-4" /> KPIs ({kpis.length})
                </button>
                <button
                    onClick={() => setActiveMainTab('categories')}
                    className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-px ${
                        activeMainTab === 'categories'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <FolderTree className="w-4 h-4" /> Categories ({categories.length})
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            {activeMainTab === 'categories' ? (
                <HrmsKpiCategories />
            ) : (
                <div className="space-y-5">
                    {/* Category Filter Bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                            <Filter className="w-4 h-4" /> Filter:
                        </span>
                        <button
                            onClick={() => setSelectedCategoryFilter('All')}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                selectedCategoryFilter === 'All'
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                            }`}
                        >
                            All ({kpis.length})
                        </button>
                        {categories.map((cat) => {
                            const count = kpis.filter(k => (k.categoryId?._id || k.categoryId) === cat._id).length;
                            return (
                                <button
                                    key={cat._id}
                                    onClick={() => setSelectedCategoryFilter(cat._id)}
                                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        selectedCategoryFilter === cat._id
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                    }`}
                                >
                                    {cat.name} ({count})
                                </button>
                            );
                        })}
                    </div>

                    {/* KPI Cards Grid */}
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <RefreshCw className="w-7 h-7 text-orange-500 animate-spin" />
                        </div>
                    ) : filteredKpis.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                            <Target className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-700 font-semibold text-lg">No KPIs found</p>
                            <p className="text-sm text-slate-400 mt-1">Click "Add KPI" above to create your first performance metric.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredKpis.map((kpi) => (
                                <div
                                    key={kpi._id}
                                    className="bg-white rounded-2xl border border-slate-200 hover:border-orange-200 p-5 shadow-sm transition-all duration-200 flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-3 mb-3">
                                            <div>
                                                <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">
                                                    {kpi.categoryId?.name || 'General'}
                                                </span>
                                                <h3 className="font-semibold text-slate-900 text-base mt-1.5 group-hover:text-orange-600 transition-colors">
                                                    {kpi.name}
                                                </h3>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openEdit(kpi)}
                                                    className="p-2 hover:bg-slate-50 text-slate-400 hover:text-orange-600 rounded-lg transition-colors"
                                                    title="Edit KPI"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(kpi._id)}
                                                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                                                    title="Delete KPI"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                                            {kpi.description || 'No description provided.'}
                                        </p>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                                <span className="text-xs text-slate-400 block">Weightage</span>
                                                <span className="font-bold text-orange-600">{kpi.weightage}%</span>
                                            </div>
                                            <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                                                <span className="text-xs text-slate-400 block">Target</span>
                                                <span className="font-bold text-slate-800">
                                                    {kpi.targetType === 'Currency' ? '₹' : ''}{kpi.target.toLocaleString()}{kpi.targetType === 'Percentage' ? '%' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <span className={`inline-flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-full ${
                                            kpi.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${kpi.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            {kpi.isActive ? 'Active' : 'Disabled'}
                                        </span>
                                        <span className="text-slate-400">{kpi.frequency}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* KPI MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                                    <Target className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        {editId ? 'Edit KPI' : 'New KPI'}
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Configure the performance metric, target, and evaluation rules.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-5 space-y-6 overflow-y-auto flex-1">
                            {/* Essential Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">KPI Name *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        placeholder="e.g. Restaurant Onboarding Target"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                                    <select
                                        value={formData.categoryId}
                                        onChange={e => setFormData({...formData, categoryId: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="">-- Select --</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        placeholder="What does this KPI measure?"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Weightage (%) *</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={formData.weightage}
                                        onChange={e => setFormData({...formData, weightage: Number(e.target.value)})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Value *</label>
                                    <input
                                        required
                                        type="number"
                                        value={formData.target}
                                        onChange={e => setFormData({...formData, target: Number(e.target.value)})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Type</label>
                                    <select
                                        value={formData.targetType}
                                        onChange={e => setFormData({...formData, targetType: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="Numeric">Numeric</option>
                                        <option value="Currency">Currency (₹)</option>
                                        <option value="Percentage">Percentage (%)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Metric Key</label>
                                    <select
                                        value={formData.metricKey}
                                        onChange={e => setFormData({...formData, metricKey: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    >
                                        <option value="REST_ONBOARDED_COUNT">Restaurants Onboarded</option>
                                        <option value="REST_ACTIVE_COUNT">Active Restaurants</option>
                                        <option value="ORDERS_GENERATED">Delivered Orders</option>
                                        <option value="REVENUE_GENERATED">Gross Revenue</option>
                                        <option value="FINANCE_NET_PROFIT">Net Profit</option>
                                        <option value="ATTENDANCE_SCORE">Attendance %</option>
                                        <option value="DAILY_REPORT_SCORE">Report Compliance</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={e => setFormData({...formData, department: e.target.value})}
                                        placeholder="e.g. Sales, All"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                                    <input
                                        type="text"
                                        value={formData.role}
                                        onChange={e => setFormData({...formData, role: e.target.value})}
                                        placeholder="e.g. Manager, All"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2.5 md:col-span-3 pt-1">
                                    <input
                                        type="checkbox"
                                        id="isActiveKpi"
                                        checked={formData.isActive}
                                        onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                        className="w-4 h-4 text-orange-500 rounded border-slate-300 focus:ring-orange-500"
                                    />
                                    <label htmlFor="isActiveKpi" className="text-sm font-medium text-slate-700 cursor-pointer">
                                        Enable this KPI for evaluation
                                    </label>
                                </div>
                            </div>

                            {/* ADVANCED SETTINGS (Rule Builder as Accordion) */}
                            <HrmsKpiRuleBuilder
                                formulaExpression={formData.formulaExpression}
                                onFormulaChange={expr => setFormData({...formData, formulaExpression: expr})}
                                ruleConfig={formData.ruleConfig}
                                onRuleConfigChange={cfg => setFormData({...formData, ruleConfig: cfg})}
                                performanceLevels={formData.performanceLevels}
                                onPerformanceLevelsChange={lvls => setFormData({...formData, performanceLevels: lvls})}
                            />

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl font-medium text-sm border border-slate-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors"
                                >
                                    <Save className="w-4 h-4" /> {editId ? 'Update KPI' : 'Create KPI'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
