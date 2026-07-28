import React, { useState, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import {
    Save,
    User,
    Lock,
    Shield,
    Mail,
    Phone,
    Camera,
    LogOut,
    Key,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@core/context/AuthContext';
import { adminApi } from '../services/adminApi';

const AdminProfile = () => {
    const { user, logout } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('profile');
    const [profile, setProfile] = useState({
        name: '',
        email: '',
        role: 'ECS'
    });

    const [security, setSecurity] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await adminApi.getProfile();
            const data = response.data.result;
            setProfile({
                name: data.name,
                email: data.email,
                role: data.role || 'ECS'
            });
        } catch (error) {
            toast.error('Failed to fetch admin profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await adminApi.updateProfile({
                name: profile.name,
                email: profile.email
            });
            toast.success('Profile updated successfully');
            fetchProfile();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (security.newPassword !== security.confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        setIsSaving(true);
        try {
            await adminApi.updatePassword({
                currentPassword: security.currentPassword,
                newPassword: security.newPassword
            });
            toast.success('Password updated successfully');
            setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update password');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        My Profile
                        <div className="p-2 bg-orange-100 rounded-xl">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage your account settings and security preferences.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={logout}
                        className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 hover:text-red-600 transition-all shadow-sm"
                    >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Sidebar / User Card */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="relative group cursor-pointer">
                                <div className="h-32 w-32 rounded-full ring-4 ring-slate-50 bg-slate-100 flex items-center justify-center overflow-hidden">
                                    {/* Placeholder Avatar */}
                                    <span className="text-4xl font-black text-slate-300">
                                        {profile.name?.charAt(0)}
                                    </span>
                                </div>
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="h-8 w-8 text-white" />
                                </div>
                            </div>
                            <h2 className="mt-6 ds-h2 font-black text-slate-900">{profile.name}</h2>
                            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                                <Shield className="h-3 w-3" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{profile.role}</span>
                            </div>
                        </div>
                        <div className="p-2 bg-slate-50/50">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                    activeTab === 'profile'
                                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
                                )}
                            >
                                <User className="h-4 w-4" />
                                Profile Information
                            </button>
                            <button
                                onClick={() => setActiveTab('security')}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all mt-1",
                                    activeTab === 'security'
                                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
                                )}
                            >
                                <Lock className="h-4 w-4" />
                                Security & Password
                            </button>
                        </div>
                    </Card>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Profile Information Tab */}
                    {activeTab === 'profile' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Edit Profile
                                </h3>
                            </div>
                            <form onSubmit={handleProfileUpdate} className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                                        <input
                                            type="text"
                                            value={profile.name}
                                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/10 transition-all block"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Id</label>
                                        <div className="relative group">
                                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="email"
                                                value={profile.email}
                                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/10 transition-all block"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-100 active:scale-95",
                                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-primary-hover"
                                        )}
                                    >
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        </Card>
                    )}

                    {/* Security Tab */}
                    {activeTab === 'security' && (
                        <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    Change Password
                                </h3>
                            </div>
                            <form onSubmit={handlePasswordUpdate} className="p-8 space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Password</label>
                                    <div className="relative group">
                                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <input
                                            type="password"
                                            value={security.currentPassword}
                                            onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                                            className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/10 transition-all block"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                            <input
                                                type="password"
                                                value={security.newPassword}
                                                onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/10 transition-all block"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confirm New Password</label>
                                        <div className="relative group">
                                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                            <input
                                                type="password"
                                                value={security.confirmPassword}
                                                onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                                                className="w-full pl-12 pr-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-primary/10 transition-all block"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-slate-50 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-orange-100 active:scale-95",
                                            isSaving ? "opacity-70 cursor-wait" : "hover:bg-primary-hover"
                                        )}
                                    >
                                        {isSaving ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminProfile;
