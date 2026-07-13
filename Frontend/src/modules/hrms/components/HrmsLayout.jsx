import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useHrmsSettings } from '../context/HrmsSettingsContext';
import axiosInstance from '@core/api/axios';
import {
    LayoutDashboard, Clock, CalendarDays, Wallet, FileText,
    Receipt, User, LogOut, Menu, X, ChevronRight, Building2,
    LifeBuoy, ChevronDown, MessageSquarePlus, List, Phone, ClipboardList, Target, Users, MapPin
} from 'lucide-react';

const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/hrms/dashboard' },
    { label: 'My Performance', icon: Target, path: '/hrms/performance' },
    { label: 'Attendance', icon: Clock, path: '/hrms/attendance' },
    { label: 'Leave', icon: CalendarDays, path: '/hrms/leave' },
    { label: 'Salary & Payslip', icon: Wallet, path: '/hrms/salary' },
    { label: 'Documents', icon: FileText, path: '/hrms/documents' },
    { label: 'Travel Expenses', icon: Receipt, path: '/hrms/expenses' },
    { label: 'Daily Reports', icon: ClipboardList, path: '/hrms/reports' },
    { label: 'My Profile', icon: User, path: '/hrms/profile' },
    {
        label: 'Support', icon: LifeBuoy, path: '/hrms/support',
        subItems: [
            { label: 'Contact HR', icon: Phone, path: '/hrms/support/contact' },
            { label: 'Raise Request', icon: MessageSquarePlus, path: '/hrms/support/create' },
            { label: 'My Requests', icon: List, path: '/hrms/support/list' }
        ]
    }
];

export default function HrmsLayout() {
    const { user, logout } = useAuth();
    const { hrmsSettings } = useHrmsSettings();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [employeeProfile, setEmployeeProfile] = useState(null);
    const [openMenus, setOpenMenus] = useState({ 'Manager Portal (Team)': true });

    React.useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axiosInstance.get('/hrms/employees/me');
                setEmployeeProfile(res.data?.data?.employee || null);
            } catch(e) {}
        };
        fetchProfile();
    }, []);

    const toggleMenu = (label) => {
        setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const handleLogout = () => {
        logout();
        navigate('/hrms/login');
    };

    const dynamicNavItems = [...navItems];
    if (employeeProfile?.hrmsRole === 'Manager' || employeeProfile?.hrmsRole === 'HR' || employeeProfile?.hrmsRole === 'Admin') {
        dynamicNavItems.splice(2, 0, { 
            label: 'Manager Portal (Team)', 
            icon: Building2, 
            path: '/hrms/team',
            subItems: [
                { label: 'Team Dashboard', icon: LayoutDashboard, path: '/hrms/team/dashboard' },
                { label: 'My Team', icon: Users, path: '/hrms/team/my-team' },
                { label: 'Team Employees', icon: Users, path: '/hrms/team/employees' },
                { label: 'Attendance & Leaves', icon: Clock, path: '/hrms/team/attendance' },
                { label: 'Expenses', icon: Receipt, path: '/hrms/team/expenses' },


                { label: 'Live Tracking', icon: MapPin, path: '/hrms/team/live-tracking' },
                { label: 'Daily Reports', icon: ClipboardList, path: '/hrms/team/reports' },
                { label: 'Team Performance', icon: Target, path: '/hrms/team/performance' }
            ]
        });
    }

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-[2px]"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-72 bg-white border-r border-slate-200
                flex flex-col transition-transform duration-300 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 overflow-hidden">
                            {hrmsSettings?.companyLogoUrl ? (
                                <img src={hrmsSettings.companyLogoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
                            ) : (
                                <Building2 className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-slate-900 font-bold text-base tracking-tight">{hrmsSettings?.companyName || 'ItzoFood'}</h1>
                            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Employee Portal</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User Info */}
                <div className="px-5 py-4 mx-3 mt-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold border border-slate-200 overflow-hidden">
                            {user?.profileImage ? (
                                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user?.name?.[0]?.toUpperCase() || 'E'
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="text-slate-900 font-semibold text-sm truncate">{user?.name || 'Employee'}</p>
                            <p className="text-slate-900 text-xs truncate">{user?.email || ''}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/50 hover:[&::-webkit-scrollbar-thumb]:bg-orange-500/50 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {dynamicNavItems.map((item) => (
                        <div key={item.label}>
                            {item.subItems ? (
                                <>
                                    <button
                                        onClick={() => toggleMenu(item.label)}
                                        className={`w-full group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                                            ${openMenus[item.label] ? 'text-[#FE5502] bg-orange-50' : 'text-slate-600 hover:text-[#FE5502] hover:bg-orange-50'}
                                        `}
                                    >
                                        <item.icon className="w-[18px] h-[18px] shrink-0" />
                                        <span className="truncate">{item.label}</span>
                                        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${openMenus[item.label] ? 'rotate-180 text-orange-400' : 'opacity-60'}`} />
                                    </button>
                                    {openMenus[item.label] && (
                                        <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-1">
                                            {item.subItems.map((sub) => (
                                                <NavLink
                                                    key={sub.path}
                                                    to={sub.path}
                                                    onClick={() => setSidebarOpen(false)}
                                                    className={({ isActive }) => `
                                                        group flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium
                                                        transition-all duration-200
                                                        ${isActive
                                                            ? 'bg-orange-50 text-[#FE5502] font-semibold'
                                                            : 'text-slate-600 hover:text-[#FE5502] hover:bg-orange-50'
                                                        }
                                                    `}
                                                >
                                                    <sub.icon className="w-4 h-4 shrink-0" />
                                                    <span className="truncate">{sub.label}</span>
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <NavLink
                                    to={item.path}
                                    onClick={() => setSidebarOpen(false)}
                                    className={({ isActive }) => `
                                        group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                                        transition-all duration-200
                                        ${isActive
                                            ? 'bg-orange-50 text-[#FE5502] font-semibold shadow-sm border border-orange-500/10'
                                            : 'text-slate-600 hover:text-[#FE5502] hover:bg-orange-50'
                                        }
                                    `}
                                >
                                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                                    <span className="truncate">{item.label}</span>
                                    <ChevronRight className={`w-4 h-4 ml-auto opacity-0 group-hover:opacity-60 transition-opacity`} />
                                </NavLink>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Logout */}
                <div className="px-3 pb-5">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                    >
                        <LogOut className="w-[18px] h-[18px]" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="hidden sm:block">
                            <h2 className="text-slate-900 font-semibold text-base">HRMS Portal</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden md:inline text-sm text-slate-500">{user?.name || 'Employee'}</span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                            {user?.profileImage ? (
                                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                user?.name?.[0]?.toUpperCase() || 'E'
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
