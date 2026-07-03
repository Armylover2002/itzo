import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Users, UserPlus, Search, Loader2, UserMinus, ShieldAlert } from 'lucide-react';

export default function MyTeam() {
    const [team, setTeam] = useState([]);
    const [unassigned, setUnassigned] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('team'); // 'team' or 'add'
    const [searchTeam, setSearchTeam] = useState('');
    const [searchUnassigned, setSearchUnassigned] = useState('');

    const fetchTeamData = useCallback(async () => {
        setLoading(true);
        try {
            const [teamRes, unassignedRes] = await Promise.all([
                axiosInstance.get('/hrms/team'),
                axiosInstance.get('/hrms/team/unassigned')
            ]);
            setTeam(teamRes.data?.data || []);
            setUnassigned(unassignedRes.data?.data || []);
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to fetch team data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTeamData();
    }, [fetchTeamData]);

    const handleAddMember = async (employeeId) => {
        setActionLoading(true);
        try {
            await axiosInstance.post('/hrms/team/add', { employeeId });
            toast.success('Team member added successfully');
            fetchTeamData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to add member');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveMember = async (employeeId) => {
        if (!window.confirm('Are you sure you want to remove this employee from your team?')) return;
        setActionLoading(true);
        try {
            await axiosInstance.post('/hrms/team/remove', { employeeId });
            toast.success('Team member removed successfully');
            fetchTeamData();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to remove member');
        } finally {
            setActionLoading(false);
        }
    };

    const filteredTeam = team.filter(m => 
        m.adminId?.name?.toLowerCase().includes(searchTeam.toLowerCase()) || 
        m.employeeId?.toLowerCase().includes(searchTeam.toLowerCase()) ||
        m.department?.toLowerCase().includes(searchTeam.toLowerCase())
    );

    const filteredUnassigned = unassigned.filter(m => 
        m.adminId?.name?.toLowerCase().includes(searchUnassigned.toLowerCase()) || 
        m.employeeId?.toLowerCase().includes(searchUnassigned.toLowerCase()) ||
        m.department?.toLowerCase().includes(searchUnassigned.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex-1 p-6 lg:p-8 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My Team</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your direct reports</p>
                </div>
            </div>

            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('team')}
                    className={`pb-4 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'team'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Current Team ({team.length})
                </button>
                <button
                    onClick={() => setActiveTab('add')}
                    className={`pb-4 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'add'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                >
                    Add Members
                </button>
            </div>

            {activeTab === 'team' && (
                <div className="space-y-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search team members..."
                            value={searchTeam}
                            onChange={(e) => setSearchTeam(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        />
                    </div>

                    {filteredTeam.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Team Members</h3>
                            <p className="text-slate-500 text-sm">You don't have any employees reporting to you yet.</p>
                            <button
                                onClick={() => setActiveTab('add')}
                                className="mt-4 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors"
                            >
                                Add Members
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTeam.map(member => (
                                <div key={member._id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0">
                                                {member.adminId?.profileImage ? (
                                                    <img src={member.adminId.profileImage} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    member.adminId?.name?.[0] || 'U'
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 text-sm">{member.adminId?.name}</h3>
                                                <p className="text-xs text-slate-500">{member.designation || 'Employee'}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveMember(member._id)}
                                            disabled={actionLoading}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors tooltip-trigger"
                                            title="Remove from team"
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-y-2 text-xs">
                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Employee ID</span>
                                            <span className="font-medium text-slate-700">{member.employeeId}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Department</span>
                                            <span className="font-medium text-slate-700">{member.department || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block mb-0.5">Status</span>
                                            <span className={`font-medium ${member.status === 'Active' ? 'text-emerald-600' : 'text-amber-600'}`}>{member.status}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'add' && (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                        <ShieldAlert className="w-5 h-5 text-blue-500 shrink-0" />
                        <div>
                            <h4 className="text-sm font-semibold text-blue-800">Assigning Members</h4>
                            <p className="text-xs text-blue-600 mt-1">You can only add employees who do not currently have a manager. To transfer an employee from another manager, please contact the Admin.</p>
                        </div>
                    </div>

                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search available employees..."
                            value={searchUnassigned}
                            onChange={(e) => setSearchUnassigned(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        />
                    </div>

                    {filteredUnassigned.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <p className="text-slate-500 text-sm">No available employees found.</p>
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                                    <tr>
                                        <th className="px-6 py-3">Employee</th>
                                        <th className="px-6 py-3">ID</th>
                                        <th className="px-6 py-3">Department</th>
                                        <th className="px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUnassigned.map(member => (
                                        <tr key={member._id} className="hover:bg-slate-50/50">
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold overflow-hidden shrink-0">
                                                        {member.adminId?.profileImage ? (
                                                            <img src={member.adminId.profileImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            member.adminId?.name?.[0] || 'U'
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-900">{member.adminId?.name}</div>
                                                        <div className="text-xs text-slate-500">{member.designation || 'Employee'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-slate-600 font-mono text-xs">{member.employeeId}</td>
                                            <td className="px-6 py-3 text-slate-600">{member.department || '—'}</td>
                                            <td className="px-6 py-3">
                                                <button
                                                    onClick={() => handleAddMember(member._id)}
                                                    disabled={actionLoading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg font-medium text-xs transition-colors disabled:opacity-50"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" /> Add
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
