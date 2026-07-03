import React, { useState, useEffect } from 'react';
import { Save, Loader2, Settings, ListOrdered, Clock, HelpCircle, Shuffle, ShieldAlert } from 'lucide-react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';

export default function AssessmentSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState([]);
    const [settings, setSettings] = useState({
        isAssessmentEnabled: true,
        questionsPerTest: 50,
        passingPercentage: 60,
        durationMinutes: 30,
        categoryDistribution: [],
        difficultyDistribution: { Easy: 30, Medium: 50, Hard: 20 },
        shuffleQuestions: true,
        shuffleOptions: true,
        allowRetest: false,
        maxAttempts: 1,
        autoSubmit: true,
        enableTimer: true
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [setRes, catRes] = await Promise.all([
                    axiosInstance.get('/hrms/assessments/settings'),
                    axiosInstance.get('/hrms/assessments/questions/categories')
                ]);
                
                const dbSettings = setRes.data?.data || {};
                const dbCategories = catRes.data?.data || [];
                
                // Merge category distribution with active categories
                const existingDist = dbSettings.categoryDistribution || [];
                const mergedDist = dbCategories.map(c => {
                    const found = existingDist.find(ed => ed.category === c);
                    return { category: c, count: found ? found.count : 0 };
                });

                setSettings({ ...dbSettings, categoryDistribution: mergedDist });
                setCategories(dbCategories);
            } catch (error) {
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleCategoryDistChange = (index, val) => {
        const newDist = [...settings.categoryDistribution];
        newDist[index].count = parseInt(val) || 0;
        setSettings({ ...settings, categoryDistribution: newDist });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await axiosInstance.patch('/hrms/assessments/settings', settings);
            toast.success('Assessment settings saved successfully!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>;
    }

    const totalDistributed = settings.categoryDistribution.reduce((acc, curr) => acc + curr.count, 0);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Assessment Settings</h1>
                    <p className="text-slate-500 text-sm mt-1">Configure the employee recruitment test rules</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save Settings
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Config */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-orange-100 rounded-lg text-orange-600"><Settings className="w-5 h-5" /></div>
                            <h3 className="text-lg font-bold text-slate-900">General Configuration</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                                <div>
                                    <p className="font-semibold text-slate-900 text-sm">Enable Assessment</p>
                                    <p className="text-xs text-slate-500">Require tests for onboarding</p>
                                </div>
                                <input type="checkbox" checked={settings.isAssessmentEnabled} onChange={e => handleChange('isAssessmentEnabled', e.target.checked)} className="w-5 h-5 accent-orange-500 cursor-pointer" />
                            </label>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Total Questions per Test</label>
                                <input type="number" value={settings.questionsPerTest} onChange={e => handleChange('questionsPerTest', Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Passing Percentage (%)</label>
                                <input type="number" value={settings.passingPercentage} onChange={e => handleChange('passingPercentage', Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Test Duration (Minutes)</label>
                                <input type="number" value={settings.durationMinutes} onChange={e => handleChange('durationMinutes', Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Shuffle className="w-5 h-5" /></div>
                            <h3 className="text-lg font-bold text-slate-900">Anti-Cheating & Security</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { key: 'shuffleQuestions', label: 'Shuffle Questions', desc: 'Randomize order per applicant' },
                                { key: 'shuffleOptions', label: 'Shuffle Options', desc: 'Randomize A/B/C/D order' },
                                { key: 'autoSubmit', label: 'Auto Submit on Timeout', desc: 'Force submission when time ends' },
                                { key: 'enableTimer', label: 'Show Timer UI', desc: 'Display countdown to applicant' }
                            ].map(opt => (
                                <label key={opt.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-300">
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{opt.label}</p>
                                        <p className="text-xs text-slate-500">{opt.desc}</p>
                                    </div>
                                    <input type="checkbox" checked={settings[opt.key]} onChange={e => handleChange(opt.key, e.target.checked)} className="w-5 h-5 accent-orange-500 cursor-pointer" />
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Config */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><ListOrdered className="w-5 h-5" /></div>
                                <h3 className="font-bold text-slate-900">Category Distribution</h3>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded ${totalDistributed === settings.questionsPerTest ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {totalDistributed} / {settings.questionsPerTest}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Define how many questions to pull from each category. Remaining slots will be filled randomly.</p>
                        
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                            {settings.categoryDistribution.map((cat, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-slate-700 truncate flex-1">{cat.category}</span>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={cat.count}
                                        onChange={e => handleCategoryDistChange(idx, e.target.value)}
                                        className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><ShieldAlert className="w-5 h-5" /></div>
                            <h3 className="font-bold text-slate-900">Retest Rules</h3>
                        </div>
                        
                        <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer mb-4">
                            <span className="font-semibold text-slate-900 text-sm">Allow Retest</span>
                            <input type="checkbox" checked={settings.allowRetest} onChange={e => handleChange('allowRetest', e.target.checked)} className="w-5 h-5 accent-orange-500 cursor-pointer" />
                        </label>

                        {settings.allowRetest && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Maximum Attempts</label>
                                <input type="number" min="1" value={settings.maxAttempts} onChange={e => handleChange('maxAttempts', Number(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
