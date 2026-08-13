import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useHrmsSettings } from '../context/HrmsSettingsContext';
import axiosInstance from '@core/api/axios';
import { toast } from 'sonner';
import { Lock, Mail, Building2, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const { hrmsSettings } = useHrmsSettings();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await axiosInstance.post('/auth/admin/login', { email, password });
            const payload = response.data?.data || response.data?.result || response.data;
            const user = payload?.admin || payload?.user || payload;

            if (user?.role === 'HRMS_EMPLOYEE') {
                const loginData = { ...user, token: payload?.accessToken || payload?.token };
                login(loginData);
                toast.success('Welcome back!');
                navigate('/hrms/dashboard');
            } else {
                toast.error('Access denied. This portal is for employees only.');
            }
        } catch (error) {
            let msg = 'Login failed. Please check your credentials.';
            if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
                msg = 'Network error: Cannot connect to server. Please check if backend is running.';
            } else if (error.response?.data?.message) {
                msg = error.response.data.message;
            }
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-[0.02]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />

            <div className="w-full max-w-md relative">
                {/* Card */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative z-10">
                    {/* Header Gradient Bar */}
                    <div className="h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

                    <div className="p-8 sm:p-10">
                        {/* Logo */}
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-orange-500/25 rotate-3 hover:rotate-0 transition-transform duration-300 overflow-hidden">
                                {hrmsSettings?.companyLogoUrl ? (
                                    <img src={hrmsSettings.companyLogoUrl} alt="Logo" className="w-full h-full object-cover bg-white" />
                                ) : (
                                    <Building2 className="w-8 h-8 text-white" />
                                )}
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Portal</h1>
                            <p className="text-sm text-slate-500 mt-2">Sign in to access your HRMS dashboard</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm shadow-sm"
                                        placeholder="your@email.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-12 pl-11 pr-11 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm shadow-sm"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Signing in...
                                    </span>
                                ) : 'Sign In'}
                            </button>
                        </form>

                        <div className="mt-8 text-center text-sm text-slate-500 font-medium">
                            Want to join {hrmsSettings?.companyName || 'ItzoFood'}?{' '}
                            <Link to="/hrms/signup" className="text-orange-500 hover:text-orange-600 font-bold">
                                Submit a joining request
                            </Link>
                        </div>

                        {/* Policy Footer Links */}
                        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                            <p className="text-[11px] text-slate-400 font-medium mb-1.5">By continuing, you agree to our</p>
                            <div className="flex justify-center items-center gap-1.5 flex-wrap text-[11px]">
                                <Link to="/profile/terms" className="text-orange-500 font-bold hover:underline">
                                    Terms & Conditions
                                </Link>
                                <span className="text-slate-300">•</span>
                                <Link to="/profile/privacy" className="text-orange-500 font-bold hover:underline">
                                    Privacy Policy
                                </Link>
                                <span className="text-slate-300">•</span>
                                <Link to="/profile/support-policy" className="text-orange-500 font-bold hover:underline">
                                    Support
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 text-center text-sm text-slate-500 font-medium pb-6">
                        © {new Date().getFullYear()} {hrmsSettings?.companyName || 'ItzoFood'} · Enterprise HRMS
                    </div>
                </div>
            </div>
        </div>
    );
}
