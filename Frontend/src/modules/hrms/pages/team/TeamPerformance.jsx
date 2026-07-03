import React, { useState, useEffect } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'react-hot-toast';
import { Target, Users, RefreshCw, BarChart, ChevronRight } from 'lucide-react';

export default function TeamPerformance() {
    const [teamData, setTeamData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const fetchPerformance = async (force = false) => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(`/hrms/performance/team-performance?period=${period}&forceRecalculate=${force}`);
            setTeamData(res.data?.data);
        } catch (error) {
            toast.error('Failed to load team performance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance();
    }, [period]);

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="w-6 h-6 text-orange-500" />
                        Team Performance
                    </h1>
                    <p className="text-sm text-slate-500">Overview of your team's KPI achievement</p>
                </div>
                <div className="flex items-center gap-3">
                    <input 
                        type="month" 
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500/30 outline-none shadow-sm"
                    />
                    <button onClick={() => fetchPerformance(true)} className="flex items-center gap-2 px-4 py-2 bg-white border shadow-sm text-slate-600 hover:text-orange-500 hover:border-orange-200 rounded-lg transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div></div>
            ) : !teamData ? (
                <div className="text-center py-12 text-slate-500">No team data available.</div>
            ) : (
                <>
                    {/* Team Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">Team Size</p>
                                <p className="text-3xl font-bold text-slate-800">{teamData.teamSize}</p>
                            </div>
                        </div>
                        <div className={`rounded-xl shadow-sm border p-6 flex items-center gap-4 ${getScoreColor(teamData.averageTeamScore)}`}>
                            <div className="w-12 h-12 bg-white/60 rounded-full flex items-center justify-center opacity-80">
                                <BarChart className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium opacity-80">Average Team Score</p>
                                <p className="text-3xl font-bold drop-shadow-sm">{teamData.averageTeamScore}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Team Members List */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Team Member Breakdown</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-white text-left text-slate-500">
                                        <th className="px-6 py-4 font-medium">Employee</th>
                                        <th className="px-6 py-4 font-medium text-center">Designation</th>
                                        <th className="px-6 py-4 font-medium text-right">Target Achieved</th>
                                        <th className="px-6 py-4 font-medium text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {teamData.teamMembersPerformance?.map((item, i) => (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                                                        {item.member.adminId?.profileImage ? (
                                                            <img src={item.member.adminId.profileImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">
                                                                {item.member.adminId?.name?.[0]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{item.member.adminId?.name}</p>
                                                        <p className="text-xs text-slate-400">{item.member.employeeId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-slate-600">{item.member.designation}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-slate-800 text-base">{item.performance.finalScore}%</span>
                                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full ${item.performance.finalScore >= 80 ? 'bg-green-500' : item.performance.finalScore >= 50 ? 'bg-orange-500' : 'bg-red-500'}`}
                                                            style={{ width: `${Math.min(100, item.performance.finalScore)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.performance.finalScore >= 80 ? 'bg-green-100 text-green-700' : item.performance.finalScore >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                    {item.performance.finalScore >= 80 ? 'Excellent' : item.performance.finalScore >= 50 ? 'Average' : 'Needs Improvement'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
