import React, { useState } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Calculator, Play, CheckCircle2, AlertTriangle, HelpCircle, Sparkles, ShieldCheck, Sliders, Layers, Award, Trophy, TrendingUp, AlertCircle, XCircle } from 'lucide-react';

const AVAILABLE_VARIABLES = [
    { name: 'RESTAURANTS_ONBOARDED', desc: 'Total approved restaurants onboarded in period' },
    { name: 'ACTIVE_RESTAURANTS', desc: 'Restaurants generating orders & meeting active rules' },
    { name: 'DAILY_ORDERS', desc: 'Average daily delivered orders across assigned restaurants' },
    { name: 'MONTHLY_ORDERS', desc: 'Total delivered orders in the evaluation month' },
    { name: 'GROSS_REVENUE', desc: 'Total gross food revenue generated' },
    { name: 'NET_REVENUE', desc: 'Gross revenue minus platform charges & GST' },
    { name: 'NET_PROFIT', desc: 'Net profit contribution after all deductions' },
    { name: 'ATTENDANCE_PERCENTAGE', desc: 'Monthly attendance percentage (Present / Working Days)' },
    { name: 'LEAVE_PERCENTAGE', desc: 'Leave ratio percentage' },
    { name: 'SHORT_HOURS', desc: 'Total short hours or late check-in penalty hours' },
    { name: 'TRAVEL_EXPENSE', desc: 'Total approved travel reimbursement expenses' },
    { name: 'HOTEL_EXPENSE', desc: 'Total approved hotel accommodation expenses' },
    { name: 'FOOD_EXPENSE', desc: 'Total approved meal & visit expenses' },
    { name: 'INCENTIVES', desc: 'Calculated employee performance incentives' },
    { name: 'TARGET', desc: 'Configured target value for this specific KPI' },
    { name: 'ACHIEVED', desc: 'Default achieved value for the primary metric' }
];

const OPERATORS = ['+', '-', '*', '/', '(', ')'];

export default function HrmsKpiRuleBuilder({
    formulaExpression = '',
    onFormulaChange,
    ruleConfig = {},
    onRuleConfigChange,
    performanceLevels = [],
    onPerformanceLevelsChange
}) {
    const [testVariables, setTestVariables] = useState({
        RESTAURANTS_ONBOARDED: 85,
        ACTIVE_RESTAURANTS: 75,
        DAILY_ORDERS: 35,
        MONTHLY_ORDERS: 1050,
        GROSS_REVENUE: 120000,
        NET_REVENUE: 108000,
        NET_PROFIT: 25000,
        ATTENDANCE_PERCENTAGE: 95,
        LEAVE_PERCENTAGE: 5,
        SHORT_HOURS: 2,
        TRAVEL_EXPENSE: 4500,
        HOTEL_EXPENSE: 2000,
        FOOD_EXPENSE: 1500,
        INCENTIVES: 3600,
        TARGET: 100,
        ACHIEVED: 85
    });
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [activeTab, setActiveTab] = useState('formula'); // formula | active_rules | levels

    const handleInsert = (token) => {
        const newExpr = formulaExpression ? `${formulaExpression} ${token}` : token;
        if (onFormulaChange) onFormulaChange(newExpr);
    };

    const handleTestFormula = async () => {
        if (!formulaExpression || !formulaExpression.trim()) {
            toast.error('Please enter a formula expression first');
            return;
        }
        setTesting(true);
        try {
            const res = await axiosInstance.post('/hrms/performance/test-formula', {
                formulaExpression,
                sampleVariables: testVariables
            });
            setTestResult(res.data?.data?.evaluatedScore ?? 0);
            toast.success('Formula evaluated successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error evaluating formula');
            setTestResult(null);
        } finally {
            setTesting(false);
        }
    };

    const updateActiveRule = (key, value) => {
        const currentRules = ruleConfig?.activeRestaurantRules || {
            requireApproved: true,
            requireMenuAvailable: true,
            requireAcceptingOrders: true,
            requireNotSuspended: true,
            minOrders: 1
        };
        if (onRuleConfigChange) {
            onRuleConfigChange({
                ...ruleConfig,
                activeRestaurantRules: {
                    ...currentRules,
                    [key]: value
                }
            });
        }
    };

    const updateLevel = (index, field, value) => {
        const updated = [...(performanceLevels || [])];
        if (updated[index]) {
            updated[index] = { ...updated[index], [field]: value };
            if (onPerformanceLevelsChange) onPerformanceLevelsChange(updated);
        }
    };

    return (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            {/* Sub-tabs inside Rule Builder */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab('formula')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'formula'
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <Calculator className="w-4 h-4" /> Dynamic Formula Builder
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('active_rules')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'active_rules'
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <Sliders className="w-4 h-4" /> Active Restaurant Rules
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('levels')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        activeTab === 'levels'
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                            : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                >
                    <Trophy className="w-4 h-4" /> Performance Levels & Colors
                </button>
            </div>

            {/* TAB 1: FORMULA BUILDER */}
            {activeTab === 'formula' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-slate-200 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-orange-400" /> Mathematical Expression
                            </label>
                            <span className="text-xs text-slate-400">Click variables below or type custom math expression</span>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                value={formulaExpression}
                                onChange={(e) => onFormulaChange && onFormulaChange(e.target.value)}
                                placeholder="e.g. (RESTAURANTS_ONBOARDED / TARGET) * 100 or (GROSS_REVENUE - INCENTIVES) / TARGET * 100"
                                className="w-full bg-slate-950 border-2 border-slate-700/80 focus:border-orange-500 rounded-xl px-4 py-3 text-sm font-mono text-orange-400 placeholder-slate-600 focus:outline-none transition-colors"
                            />
                            {formulaExpression && (
                                <button
                                    type="button"
                                    onClick={() => onFormulaChange && onFormulaChange('')}
                                    className="absolute right-3 top-3 text-xs text-slate-500 hover:text-rose-400 font-sans"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Operators & Variables */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                                    Available Variables (Click to Insert)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_VARIABLES.map((v) => (
                                        <button
                                            key={v.name}
                                            type="button"
                                            onClick={() => handleInsert(v.name)}
                                            title={v.desc}
                                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-orange-500/20 hover:border-orange-500/40 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 hover:text-orange-400 transition-all transform active:scale-95 text-left flex items-center gap-1.5"
                                        >
                                            <span className="font-bold">{v.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                                    Math Operators
                                </label>
                                <div className="flex gap-2">
                                    {OPERATORS.map((op) => (
                                        <button
                                            key={op}
                                            type="button"
                                            onClick={() => handleInsert(op)}
                                            className="w-10 h-10 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-base font-bold text-slate-200 hover:text-white transition-colors flex items-center justify-center shadow-sm"
                                        >
                                            {op}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Live Formula Tester Card */}
                        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Play className="w-3.5 h-3.5 text-emerald-400" /> Live Formula Sandbox
                                </h4>
                                <p className="text-xs text-slate-400 mb-3">
                                    Test your formula with sample employee data before saving:
                                </p>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {['RESTAURANTS_ONBOARDED', 'ACTIVE_RESTAURANTS', 'GROSS_REVENUE', 'NET_PROFIT', 'TARGET', 'ACHIEVED'].map((key) => (
                                        <div key={key} className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                                            <label className="text-[10px] text-slate-400 block font-mono truncate">{key}</label>
                                            <input
                                                type="number"
                                                value={testVariables[key] || 0}
                                                onChange={(e) => setTestVariables({ ...testVariables, [key]: Number(e.target.value) })}
                                                className="w-full bg-transparent text-xs text-white font-bold focus:outline-none mt-0.5"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={handleTestFormula}
                                    disabled={testing || !formulaExpression}
                                    className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <Play className="w-3.5 h-3.5 fill-current" /> {testing ? 'Testing...' : 'Test Formula'}
                                </button>
                                {testResult !== null && (
                                    <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                                        <span className="text-[10px] text-emerald-400 block font-semibold">Result</span>
                                        <span className="text-sm font-bold font-mono text-emerald-300">{testResult} pts</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ACTIVE RESTAURANT RULES */}
            {activeTab === 'active_rules' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-300 text-xs">
                        <ShieldCheck className="w-5 h-5 flex-shrink-0 text-orange-400" />
                        <span>
                            Define what criteria a restaurant must satisfy to be counted in the <b>ACTIVE_RESTAURANTS</b> variable for this KPI.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { id: 'requireApproved', label: 'Require Restaurant Status to be Approved', desc: 'Excludes pending or rejected restaurants' },
                            { id: 'requireMenuAvailable', label: 'Require Menu to be Created & Available', desc: 'Excludes restaurants without active menu items' },
                            { id: 'requireAcceptingOrders', label: 'Require Currently Accepting Orders', desc: 'Excludes restaurants currently offline or paused' },
                            { id: 'requireNotSuspended', label: 'Require Not Suspended / Blocked', desc: 'Excludes suspended accounts' }
                        ].map((rule) => (
                            <label
                                key={rule.id}
                                className="flex items-start gap-3 p-4 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={ruleConfig?.activeRestaurantRules?.[rule.id] !== false}
                                    onChange={(e) => updateActiveRule(rule.id, e.target.checked)}
                                    className="w-4 h-4 mt-0.5 rounded border-slate-700 text-orange-500 focus:ring-orange-500 bg-slate-800"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-200 block">{rule.label}</span>
                                    <span className="text-[11px] text-slate-400 block mt-0.5">{rule.desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="max-w-xs bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                        <label className="text-xs font-bold text-slate-300 block mb-1">
                            Minimum Monthly Orders Threshold
                        </label>
                        <p className="text-[11px] text-slate-400 mb-3">
                            A restaurant must generate at least this many orders in the period to be counted as Active.
                        </p>
                        <input
                            type="number"
                            min="0"
                            value={ruleConfig?.activeRestaurantRules?.minOrders ?? ruleConfig?.minOrdersThreshold ?? 1}
                            onChange={(e) => updateActiveRule('minOrders', Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-orange-500"
                        />
                    </div>
                </div>
            )}

            {/* TAB 3: PERFORMANCE LEVELS */}
            {activeTab === 'levels' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                    <p className="text-xs text-slate-400">
                        Configure the 5 performance tiers, score brackets, and color badges for this KPI:
                    </p>
                    <div className="space-y-3">
                        {(performanceLevels && performanceLevels.length > 0 ? performanceLevels : [
                            { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets.' },
                            { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
                            { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
                            { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus.' },
                            { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
                        ]).map((level, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row items-center gap-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                                <div className="flex items-center gap-3 w-full md:w-48">
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: level.color || '#3b82f6' }}
                                    />
                                    <input
                                        type="text"
                                        value={level.levelName}
                                        onChange={(e) => updateLevel(idx, 'levelName', e.target.value)}
                                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white w-full focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                                <div className="flex items-center gap-2 w-full md:w-auto">
                                    <span className="text-[11px] text-slate-400">Min %:</span>
                                    <input
                                        type="number"
                                        value={level.minScore}
                                        onChange={(e) => updateLevel(idx, 'minScore', Number(e.target.value))}
                                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                                    />
                                    <span className="text-[11px] text-slate-400 ml-2">Max %:</span>
                                    <input
                                        type="number"
                                        value={level.maxScore}
                                        onChange={(e) => updateLevel(idx, 'maxScore', Number(e.target.value))}
                                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-white focus:outline-none"
                                    />
                                </div>
                                <div className="flex items-center gap-2 w-full md:flex-1">
                                    <span className="text-[11px] text-slate-400">Color Hex:</span>
                                    <input
                                        type="text"
                                        value={level.color}
                                        onChange={(e) => updateLevel(idx, 'color', e.target.value)}
                                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none"
                                    />
                                    <input
                                        type="color"
                                        value={level.color || '#3b82f6'}
                                        onChange={(e) => updateLevel(idx, 'color', e.target.value)}
                                        className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
