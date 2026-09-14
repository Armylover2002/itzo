import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    User, MapPin, Package, CreditCard, Wallet, ChevronRight,
    LogOut, ShieldCheck, Heart, HelpCircle, Info, Edit2, ChevronLeft
} from 'lucide-react';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';

const ProfilePage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-background pb-24 md:pb-8 font-sans transition-colors duration-500">
            <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 dark:border-white/5 mb-4 flex items-center gap-2 transition-colors">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/10 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800 dark:text-slate-200" />
                </button>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">My Profile</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">

                {/* User Identity Card */}
                <div className="bg-white dark:bg-card rounded-xl p-4 border border-slate-200 dark:border-white/5 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center p-1 border border-slate-200 dark:border-white/10">
                            <div className="h-full w-full rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                                <User size={28} className="text-slate-700 dark:text-slate-300" />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-base leading-tight font-semibold text-slate-900 dark:text-slate-100">{user?.name || 'Customer'}</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium flex items-center gap-1 mt-0.5">
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] uppercase">India</span> +91 {user?.phone}
                            </p>
                        </div>
                    </div>
                    <Link to="/quick/profile/edit" className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <Edit2 size={16} />
                    </Link>
                </div>

                {/* Menu Sections */}
                <div className="space-y-4">
                    {/* Account Section */}
                    <div className="bg-white dark:bg-card rounded-xl overflow-hidden border border-slate-200 dark:border-white/5 transition-colors">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Personal Account</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={Package}
                                label="Your Orders"
                                sub="Track, return or buy things again"
                                path="/quick/orders"
                                color="#0c831f"
                                bg="rgba(16,185,129,0.10)"
                            />
                            <MenuItem
                                icon={CreditCard}
                                label="Order Transactions"
                                sub="View all payments & refunds"
                                path="/quick/transactions"
                                color="#f97316"
                                bg="rgba(249,115,22,0.10)"
                            />
                            <MenuItem
                                icon={Wallet}
                                label="Wallet"
                                sub="Balance & return refunds"
                                path="/quick/wallet"
                                color="#10b981"
                                bg="rgba(16,185,129,0.10)"
                            />
                            <MenuItem
                                icon={Heart}
                                label="Your Wishlist"
                                sub="Your saved items"
                                path="/quick/wishlist"
                                color="#fb7185"
                                bg="rgba(248,113,113,0.08)"
                            />
                            <MenuItem
                                icon={MapPin}
                                label="Saved Addresses"
                                sub="Manage your delivery locations"
                                path="/quick/addresses"
                                color="#0ea5e9"
                                bg="rgba(56,189,248,0.10)"
                            />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div className="bg-white dark:bg-card rounded-xl overflow-hidden border border-slate-200 dark:border-white/5 transition-colors">
                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5">
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Help & Settings</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            <MenuItem
                                icon={HelpCircle}
                                label="Help & Support"
                                path="/quick/support"
                                color="#3b82f6"
                                bg="rgba(59,130,246,0.08)"
                            />
                            <MenuItem
                                icon={ShieldCheck}
                                label="Privacy Policy"
                                path="/quick/privacy"
                                color="#a855f7"
                                bg="rgba(168,85,247,0.08)"
                            />
                            <MenuItem
                                icon={Info}
                                label="About Us"
                                path="/quick/about"
                                color="#14b8a6"
                                bg="rgba(45,212,191,0.08)"
                            />
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={logout}
                    className="w-full py-3 rounded-lg border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-300 font-semibold bg-white dark:bg-card hover:bg-slate-100 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2 mt-2"
                >
                    <LogOut size={20} />
                    Sign out
                </button>

                <div className="text-center pb-8">
                    <p className="text-[10px] text-slate-400 font-medium">Version 2.4.0 - {appName}</p>
                </div>

            </div>
        </div>
    );
};

const MenuItem = ({ icon: Icon, label, sub, path, color = '#334155', bg = 'rgba(148,163,184,0.12)' }) => (
    <Link to={path || '#'} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3">
            <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: bg }}
            >
                <Icon
                    size={20}
                    className="transition-colors"
                    style={{ color }}
                />
            </div>
            <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors">{label}</h3>
                {sub && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">{sub}</p>}
            </div>
        </div>
        <div className="p-1.5 rounded-md group-hover:bg-slate-100 dark:group-hover:bg-white/10 transition-colors">
            <ChevronRight size={16} className="text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-all group-hover:translate-x-0.5" />
        </div>
    </Link>
);

export default ProfilePage;
