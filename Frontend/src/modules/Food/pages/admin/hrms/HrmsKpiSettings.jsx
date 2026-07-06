import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Target, Settings, Save, X, Activity, FolderTree, Calculator, ShieldCheck, Sparkles, Filter, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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
            toast.error('Failed to load KPI Engine data');
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

    const filteredKpis = selectedCategoryFilter === 'All'
        ? kpis
        : kpis.filter(k => (k.categoryId?._id || k.categoryId) === selectedCategoryFilter);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 bg-slate-950 min-h-screen text-slate-100">
            {/* Header Suite */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/40 p-6 rounded-3xl border border-slate-800 shadow-2xl">
                <div>
                    <div className="flex items-center gap-2 text-orange-400 font-semibold text-xs tracking-wider uppercase mb-1">
                        <Sparkles className="w-4 h-4" /> Enterprise AI-Ready Architecture
                    </div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-orange-500" />
                        KPI Engine & Performance Suite
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                        Zero hardcoding. Configure dynamic formulas, active restaurant criteria, financial deduction rules, and automated performance level badges.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-colors"
                        title="Reload Engine Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-orange-400' : ''}`} />
                    </button>
                    <button
                        onClick={() => {
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
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl shadow-xl shadow-orange-500/20 font-bold text-sm transition-all transform hover:scale-105"
                    >
                        <Plus className="w-5 h-5" /> New Dynamic KPI
                    </button>
                </div>
            </div>

            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <button
                    onClick={() => setActiveMainTab('kpis')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                        activeMainTab === 'kpis'
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                >
                    <Target className="w-4 h-4" /> KPI Definitions & Formulas ({kpis.length})
                </button>
                <button
                    onClick={() => setActiveMainTab('categories')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${
                        activeMainTab === 'categories'
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                >
                    <FolderTree className="w-4 h-4" /> Category Management ({categories.length})
                </button>
            </div>

            {/* MAIN CONTENT AREA */}
            {activeMainTab === 'categories' ? (
                <HrmsKpiCategories />
            ) : (
                <div className="space-y-6">
                    {/* Category Filter Bar */}
                    <div className="flex items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                        <div className="flex items-center gap-2 text-sm text-slate-300 font-semibold">
                            <Filter className="w-4 h-4 text-orange-400" /> Filter by Category:
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedCategoryFilter('All')}
                                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    selectedCategoryFilter === 'All'
                                        ? 'bg-orange-500 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
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
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                            selectedCategoryFilter === cat._id
                                                ? 'bg-orange-500 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {cat.name} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* KPI Cards Grid */}
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                        </div>
                    ) : filteredKpis.length === 0 ? (
                        <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-slate-800">
                            <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-300 font-bold text-lg">No KPIs found matching your filter.</p>
                            <p className="text-sm text-slate-500 mt-1">Click "New Dynamic KPI" above to build your custom evaluation metric.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredKpis.map((kpi) => (
                                <div
                                    key={kpi._id}
                                    className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-800 hover:border-orange-500/30 p-6 shadow-xl transition-all duration-300 flex flex-col justify-between group"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-3 mb-3">
                                            <div>
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/20">
                                                    {kpi.categoryId?.name || 'General KPI'}
                                                </span>
                                                <h3 className="font-extrabold text-white text-lg mt-2 group-hover:text-orange-400 transition-colors">
                                                    {kpi.name}
                                                </h3>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => openEdit(kpi)}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-orange-400 rounded-xl transition-colors"
                                                    title="Edit KPI & Formula"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(kpi._id)}
                                                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 rounded-xl transition-colors"
                                                    title="Delete KPI"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                                            {kpi.description || 'No description provided.'}
                                        </p>

                                        {/* Formula preview badge */}
                                        {kpi.formulaExpression && (
                                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-4">
                                                <span className="text-[10px] text-slate-500 block uppercase font-bold mb-1">Dynamic Math Expression</span>
                                                <code className="text-xs font-mono text-emerald-400 break-all font-semibold">
                                                    {kpi.formulaExpression}
                                                </code>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                                            <div>
                                                <span className="text-slate-500 block text-[10px]">Metric Key</span>
                                                <span className="font-mono text-slate-200 font-bold">{kpi.metricKey}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500 block text-[10px]">Weightage</span>
                                                <span className="text-orange-400 font-extrabold text-sm">{kpi.weightage}%</span>
                                            </div>
                                            <div className="mt-2">
                                                <span className="text-slate-500 block text-[10px]">Target Value</span>
                                                <span className="font-bold text-white">
                                                    {kpi.targetType === 'Currency' ? '₹' : ''}{kpi.target.toLocaleString()}{kpi.targetType === 'Percentage' ? '%' : ''}
                                                </span>
                                            </div>
                                            <div className="mt-2">
                                                <span className="text-slate-500 block text-[10px]">Department / Role</span>
                                                <span className="text-slate-300 truncate block font-medium">{kpi.department} • {kpi.role}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                        <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full ${
                                            kpi.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400'
                                        }`}>
                                            <CheckCircle2 className="w-3 h-3" /> {kpi.isActive ? 'Active Engine' : 'Disabled'}
                                        </span>
                                        <span className="text-[11px] text-slate-500 font-mono">Freq: {kpi.frequency}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* KPI MODAL WITH RULE BUILDER */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 bg-slate-950 border-b border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400">
                                    <Target className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-extrabold text-white">
                                        {editId ? 'Configure Dynamic KPI' : 'Create Enterprise KPI'}
                                    </h2>
                                    <p className="text-xs text-slate-400">
                                        Define metrics, formulas, weightages, and level thresholds.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
                            {/* Basic Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">KPI Title *</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        placeholder="e.g. Active Restaurants Efficiency"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-orange-500 transition-colors"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Category *</label>
                                    <select
                                        value={formData.categoryId}
                                        onChange={e => setFormData({...formData, categoryId: e.target.value})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-orange-500"
                                    >
                                        <option value="">-- Select Category --</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Metric Key *</label>
                                    <select
                                        value={formData.metricKey}
                                        onChange={e => setFormData({...formData, metricKey: e.target.value})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-500"
                                    >
                                        <option value="REST_ONBOARDED_COUNT">REST_ONBOARDED_COUNT (Onboarding)</option>
                                        <option value="REST_ACTIVE_COUNT">REST_ACTIVE_COUNT (Active Restaurants)</option>
                                        <option value="ORDERS_GENERATED">ORDERS_GENERATED (Delivered Orders)</option>
                                        <option value="REVENUE_GENERATED">REVENUE_GENERATED (Gross Revenue)</option>
                                        <option value="FINANCE_NET_PROFIT">FINANCE_NET_PROFIT (Net Profit Margin)</option>
                                        <option value="ATTENDANCE_SCORE">ATTENDANCE_SCORE (Attendance %)</option>
                                        <option value="DAILY_REPORT_SCORE">DAILY_REPORT_SCORE (Reports Compliance)</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Description</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        placeholder="Explain the business objective of this metric..."
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Weightage (%) *</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={formData.weightage}
                                        onChange={e => setFormData({...formData, weightage: Number(e.target.value)})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-orange-400 focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Target Value *</label>
                                    <input
                                        required
                                        type="number"
                                        value={formData.target}
                                        onChange={e => setFormData({...formData, target: Number(e.target.value)})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Target Type</label>
                                    <select
                                        value={formData.targetType}
                                        onChange={e => setFormData({...formData, targetType: e.target.value})}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                                    >
                                        <option value="Numeric">Numeric Count</option>
                                        <option value="Currency">Currency (₹)</option>
                                        <option value="Percentage">Percentage (%)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Department Scope</label>
                                    <input
                                        type="text"
                                        value={formData.department}
                                        onChange={e => setFormData({...formData, department: e.target.value})}
                                        placeholder="e.g. Sales, Operations, All"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Role Scope</label>
                                    <input
                                        type="text"
                                        value={formData.role}
                                        onChange={e => setFormData({...formData, role: e.target.value})}
                                        placeholder="e.g. Field Executive, Manager, All"
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-6">
                                    <input
                                        type="checkbox"
                                        id="isActiveKpi"
                                        checked={formData.isActive}
                                        onChange={e => setFormData({...formData, isActive: e.target.checked})}
                                        className="w-5 h-5 text-orange-500 rounded border-slate-700 bg-slate-800 focus:ring-orange-500"
                                    />
                                    <label htmlFor="isActiveKpi" className="text-sm font-bold text-white cursor-pointer">
                                        KPI is Active in Evaluation Engine
                                    </label>
                                </div>
                            </div>

                            {/* RULE BUILDER COMPONENT */}
                            <HrmsKpiRuleBuilder
                                formulaExpression={formData.formulaExpression}
                                onFormulaChange={expr => setFormData({...formData, formulaExpression: expr})}
                                ruleConfig={formData.ruleConfig}
                                onRuleConfigChange={cfg => setFormData({...formData, ruleConfig: cfg})}
                                performanceLevels={formData.performanceLevels}
                                onPerformanceLevelsChange={lvls => setFormData({...formData, performanceLevels: lvls})}
                            />

                            {/* Footer Buttons */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-extrabold text-sm shadow-xl shadow-orange-500/20 flex items-center gap-2 transition-all transform hover:scale-105"
                                >
                                    <Save className="w-4 h-4" /> Save Enterprise KPI
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
