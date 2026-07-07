import React, { useState } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Calculator, Play, ChevronDown, ShieldCheck, Trophy, Award } from 'lucide-react';

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

const DEFAULT_LEVELS = [
    { levelName: 'Excellent', minScore: 90, maxScore: 9999, color: '#10b981', icon: 'Trophy', description: 'Consistently exceeds all targets.' },
    { levelName: 'Good', minScore: 75, maxScore: 89.99, color: '#3b82f6', icon: 'Award', description: 'Meets and often exceeds targets.' },
    { levelName: 'Average', minScore: 60, maxScore: 74.99, color: '#f59e0b', icon: 'TrendingUp', description: 'Meets core performance standards.' },
    { levelName: 'Needs Improvement', minScore: 40, maxScore: 59.99, color: '#f97316', icon: 'AlertCircle', description: 'Below target; requires focus.' },
    { levelName: 'Poor', minScore: 0, maxScore: 39.99, color: '#ef4444', icon: 'XCircle', description: 'Critical underperformance.' }
];

/* Collapsible accordion section */
function AccordionSection({ title, icon: Icon, isOpen, onToggle, children }) {
    return (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
                    <Icon className="w-4 h-4 text-orange-500" />
                    {title}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="p-5 border-t border-slate-200 bg-white">
                    {children}
                </div>
            )}
        </div>
    );
}

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

    // Accordion open states — auto-expand if data already exists
    const [openSections, setOpenSections] = useState({
        formula: !!formulaExpression,
        rules: !!(ruleConfig?.activeRestaurantRules),
        levels: !!(performanceLevels && performanceLevels.length > 0)
    });

    const toggleSection = (key) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

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

    const levels = performanceLevels && performanceLevels.length > 0 ? performanceLevels : DEFAULT_LEVELS;

    return (
        <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-1">Advanced Settings</p>

            {/* SECTION 1: CUSTOM FORMULA */}
            <AccordionSection
                title="Custom Formula"
                icon={Calculator}
                isOpen={openSections.formula}
                onToggle={() => toggleSection('formula')}
            >
                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 block">Formula Expression</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formulaExpression}
                                onChange={(e) => onFormulaChange && onFormulaChange(e.target.value)}
                                placeholder="e.g. (RESTAURANTS_ONBOARDED / TARGET) * 100"
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                            />
                            {formulaExpression && (
                                <button
                                    type="button"
                                    onClick={() => onFormulaChange && onFormulaChange('')}
                                    className="absolute right-3 top-3 text-xs text-slate-400 hover:text-red-500 font-medium"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Variables & Operators */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="lg:col-span-2 space-y-4">
                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-2">
                                    Available Variables (click to insert)
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {AVAILABLE_VARIABLES.map((v) => (
                                        <button
                                            key={v.name}
                                            type="button"
                                            onClick={() => handleInsert(v.name)}
                                            title={v.desc}
                                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-orange-50 hover:text-orange-700 border border-slate-200 hover:border-orange-200 rounded-lg text-xs font-mono text-slate-600 transition-all active:scale-95"
                                        >
                                            {v.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 block mb-2">Operators</label>
                                <div className="flex gap-2">
                                    {OPERATORS.map((op) => (
                                        <button
                                            key={op}
                                            type="button"
                                            onClick={() => handleInsert(op)}
                                            className="w-10 h-10 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-base font-bold text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-center"
                                        >
                                            {op}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Test Formula Card */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                    <Play className="w-3.5 h-3.5 text-orange-500" /> Test Formula
                                </h4>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {['RESTAURANTS_ONBOARDED', 'ACTIVE_RESTAURANTS', 'GROSS_REVENUE', 'NET_PROFIT', 'TARGET', 'ACHIEVED'].map((key) => (
                                        <div key={key} className="bg-white p-2 rounded-lg border border-slate-100">
                                            <label className="text-[10px] text-slate-500 block font-mono truncate">{key}</label>
                                            <input
                                                type="number"
                                                value={testVariables[key] || 0}
                                                onChange={(e) => setTestVariables({ ...testVariables, [key]: Number(e.target.value) })}
                                                className="w-full bg-transparent text-xs text-slate-800 font-semibold focus:outline-none mt-0.5"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                                <button
                                    type="button"
                                    onClick={handleTestFormula}
                                    disabled={testing || !formulaExpression}
                                    className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <Play className="w-3.5 h-3.5" /> {testing ? 'Testing...' : 'Run Test'}
                                </button>
                                {testResult !== null && (
                                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                        <span className="text-[10px] text-emerald-600 block font-medium">Result</span>
                                        <span className="text-sm font-bold font-mono text-emerald-700">{testResult}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </AccordionSection>

            {/* SECTION 2: ACTIVE RESTAURANT RULES */}
            <AccordionSection
                title="Active Restaurant Rules"
                icon={ShieldCheck}
                isOpen={openSections.rules}
                onToggle={() => toggleSection('rules')}
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                        Define what criteria a restaurant must satisfy to be counted as "Active" for this KPI.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { id: 'requireApproved', label: 'Must be Approved', desc: 'Excludes pending or rejected restaurants' },
                            { id: 'requireMenuAvailable', label: 'Must have Menu', desc: 'Excludes restaurants without active menu items' },
                            { id: 'requireAcceptingOrders', label: 'Must be Accepting Orders', desc: 'Excludes restaurants currently offline' },
                            { id: 'requireNotSuspended', label: 'Must not be Suspended', desc: 'Excludes suspended accounts' }
                        ].map((rule) => (
                            <label
                                key={rule.id}
                                className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={ruleConfig?.activeRestaurantRules?.[rule.id] !== false}
                                    onChange={(e) => updateActiveRule(rule.id, e.target.checked)}
                                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                                />
                                <div>
                                    <span className="text-sm font-medium text-slate-800 block">{rule.label}</span>
                                    <span className="text-xs text-slate-500 block mt-0.5">{rule.desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="max-w-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <label className="text-sm font-medium text-slate-700 block mb-1">Minimum Monthly Orders</label>
                        <p className="text-xs text-slate-500 mb-2">
                            A restaurant must generate at least this many orders to be counted as Active.
                        </p>
                        <input
                            type="number"
                            min="0"
                            value={ruleConfig?.activeRestaurantRules?.minOrders ?? ruleConfig?.minOrdersThreshold ?? 1}
                            onChange={(e) => updateActiveRule('minOrders', Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                    </div>
                </div>
            </AccordionSection>

            {/* SECTION 3: PERFORMANCE LEVELS */}
            <AccordionSection
                title="Performance Levels & Ratings"
                icon={Trophy}
                isOpen={openSections.levels}
                onToggle={() => toggleSection('levels')}
            >
                <div className="space-y-3">
                    <p className="text-sm text-slate-500 mb-4">
                        Define score ranges for each performance rating. Employees will receive a badge based on where their score falls.
                    </p>
                    {levels.map((level, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex items-center gap-3 w-full md:w-48">
                                <div
                                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                                    style={{ backgroundColor: level.color || '#3b82f6' }}
                                />
                                <input
                                    type="text"
                                    value={level.levelName}
                                    onChange={(e) => updateLevel(idx, 'levelName', e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 w-full focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-500">Min:</span>
                                    <input
                                        type="number"
                                        value={level.minScore}
                                        onChange={(e) => updateLevel(idx, 'minScore', Number(e.target.value))}
                                        className="w-20 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-500">Max:</span>
                                    <input
                                        type="number"
                                        value={level.maxScore}
                                        onChange={(e) => updateLevel(idx, 'maxScore', Number(e.target.value))}
                                        className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full md:flex-1">
                                <span className="text-xs text-slate-500">Color:</span>
                                <input
                                    type="color"
                                    value={level.color || '#3b82f6'}
                                    onChange={(e) => updateLevel(idx, 'color', e.target.value)}
                                    className="w-8 h-8 rounded border border-slate-200 bg-transparent cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={level.color}
                                    onChange={(e) => updateLevel(idx, 'color', e.target.value)}
                                    className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </AccordionSection>
        </div>
    );
}
