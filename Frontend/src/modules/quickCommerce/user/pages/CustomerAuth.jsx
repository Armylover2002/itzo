import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import {
    Phone,
    ShieldCheck,
    User,
    ShoppingBag,
    ChevronRight,
    MapPin,
    Zap,
    Utensils,
    Smartphone,
    ShoppingBasket,
    Heart,
    Star,
    ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';

const CATEGORIES = [
    {
        title: "Grocery",
        icon: <ShoppingBasket size={28} />,
        color: "#DCFCE7",
        ring: "#22C55E",
        text: "#15803D",
        theme: "#10B981",
        shadow: "rgba(16, 185, 129, 0.3)",
        img: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600"
    },
    {
        title: "Store",
        icon: <Smartphone size={28} />,
        color: "#F0FDFA",
        ring: "#2DD4BF",
        text: "#0F766E",
        theme: "#0D9488",
        shadow: "rgba(13, 148, 136, 0.3)",
        img: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=600"
    },
    {
        title: "Food",
        icon: <Utensils size={28} />,
        color: "#ECFDF5",
        ring: "#34D399",
        text: "#047857",
        theme: "#059669",
        shadow: "rgba(5, 150, 105, 0.3)",
        img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=600"
    },
    {
        title: "Health",
        icon: <ShieldCheck size={28} />,
        color: "#F7FEE7",
        ring: "#A3E635",
        text: "#4D7C0F",
        theme: "#84CC16",
        shadow: "rgba(132, 204, 22, 0.3)",
        img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=1200" // Hands holding heart visual
    },
];

const CustomerAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [timer, setTimer] = useState(0);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const { login } = useAuth();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    const logoUrl = settings?.logoUrl || '';
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        phone: '',
        otp: '',
        name: ''
    });

    const activeCategory = CATEGORIES[carouselIndex];

    useEffect(() => {
        const interval = setInterval(() => {
            setCarouselIndex((prev) => (prev + 1) % CATEGORIES.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        if (formData.phone.length !== 10) {
            toast.error('Enter valid 10-digit number');
            return;
        }
        setIsLoading(true);
        try {
            if (isLogin) {
                await customerApi.sendLoginOtp({ phone: formData.phone });
            } else {
                await customerApi.sendSignupOtp({ name: formData.name, phone: formData.phone });
            }
            setShowOtp(true);
            setTimer(30);
            toast.success('OTP sent!');
        } catch (error) {
            toast.error('Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (formData.otp.length !== 4) {
            toast.error('Enter 4-digit code');
            return;
        }
        setIsLoading(true);
        try {
            const response = await customerApi.verifyOtp({ phone: formData.phone, otp: formData.otp });
            const { token, customer } = response.data.result;
            login({ ...customer, token, role: 'customer' });
            toast.success('Successfully Logged In!');
            navigate('/');
        } catch (error) {
            toast.error('Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center font-['Outfit',_sans-serif] overflow-hidden">

            {/* Dynamic Atmospheric Background */}
            <motion.div
                animate={{ backgroundColor: activeCategory.color }}
                transition={{ duration: 1.5 }}
                className="absolute inset-0 z-0"
            />

            {/* Animated Blurred Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{
                        backgroundColor: activeCategory.theme,
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{
                        backgroundColor: { duration: 1.5 },
                        x: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                        y: { duration: 10, repeat: Infinity, ease: "easeInOut" },
                        scale: { duration: 12, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[100px] opacity-20"
                />
                <motion.div
                    animate={{
                        backgroundColor: activeCategory.theme,
                        x: [0, -40, 0],
                        y: [0, -60, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        backgroundColor: { duration: 1.5 },
                        x: { duration: 9, repeat: Infinity, ease: "easeInOut" },
                        y: { duration: 7, repeat: Infinity, ease: "easeInOut" },
                        scale: { duration: 15, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="absolute -bottom-24 -right-24 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30"
                />
            </div>

            {/* Premium Centered Card Container */}
            <div className="w-[92%] max-w-[400px] h-[85vh] max-h-[780px] bg-white relative z-10 overflow-hidden rounded-[40px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] border border-white/40 flex flex-col transition-colors duration-1000">

                {/* Scrollable Content Container */}
                <div className="h-full overflow-y-auto no-scrollbar pb-20">

                    {/* Header: Immersive Category Visuals */}
                    <motion.div
                        animate={{ backgroundColor: activeCategory.theme }}
                        transition={{ duration: 1 }}
                        className="relative h-[35%] w-full overflow-hidden"
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={carouselIndex}
                                initial={{ opacity: 0, scale: 1.1 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                transition={{ duration: 0.8 }}
                                className="absolute inset-0"
                            >
                                <img
                                    src={activeCategory.img}
                                    className="w-full h-full object-cover"
                                    alt="banner"
                                />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-transparent opacity-60" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.1), ${activeCategory.theme})` }} />
                            </motion.div>
                        </AnimatePresence>

                        {/* Top Branding Bar */}
                        <div className="absolute top-8 left-0 w-full px-6 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/30">
                                    <ShoppingBag size={20} className="text-white" />
                                </div>
                                <span className="text-white font-black tracking-tighter text-xl">{appName.toUpperCase()}</span>
                            </div>
                        </div>

                        {/* Centered App Message */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 text-white pt-10">
                            <motion.h2
                                key={carouselIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-2xl font-black tracking-tight leading-none mb-2"
                            >
                                {activeCategory.title.toUpperCase()} INSIDE
                            </motion.h2>
                            <p className="text-[10px] font-bold uppercase tracking-[4px] opacity-70">Everything delivered fast</p>
                        </div>

                        {/* S-Curve Divider */}
                        <div className="absolute -bottom-1 left-0 w-full leading-[0]">
                            <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-24">
                                <path
                                    fill="#ffffff"
                                    d="M0,224L40,213.3C80,203,160,181,240,186.7C320,192,400,224,480,240C560,256,640,256,720,234.7C800,213,880,171,960,165.3C1040,160,1120,192,1200,208C1280,224,1360,224,1400,224L1440,224L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
                                />
                            </svg>
                        </div>
                    </motion.div>

                    {/* Circular Carousel Control */}
                    <div className="relative -mt-14 flex justify-center z-20">
                        <div className="w-28 h-28 rounded-full bg-white border-4 border-white shadow-[0_15px_40px_rgba(34,197,94,0.2)] flex items-center justify-center overflow-hidden transition-shadow duration-1000" style={{ boxShadow: `0 15px 40px ${activeCategory.shadow}` }}>
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={carouselIndex}
                                    initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
                                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                    exit={{ opacity: 0, scale: 1.5, rotate: 20 }}
                                    className="p-4 rounded-3xl"
                                    style={{ backgroundColor: activeCategory.color, color: activeCategory.text }}
                                >
                                    {logoUrl ? (
                                        <img
                                            src={logoUrl}
                                            alt={`${appName} logo`}
                                            className="w-14 h-14 object-contain"
                                        />
                                    ) : (
                                        activeCategory.icon
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>


                    {/* Authentication Form Block */}
                    <div className="px-6 pt-6 pb-10">
                        <AnimatePresence mode="wait">
                            {!showOtp ? (
                                <motion.div
                                    key="main-form"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-5"
                                >
                                    {/* App Style Tab Switcher */}
                                    <div className="flex bg-gray-50 rounded-2xl p-1.5 border border-gray-100">
                                        <button
                                            onClick={() => setIsLogin(true)}
                                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-white shadow-sm' : 'text-gray-400'}`}
                                            style={{ color: isLogin ? activeCategory.theme : undefined }}
                                        >
                                            Login
                                        </button>
                                        <button
                                            onClick={() => setIsLogin(false)}
                                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-white shadow-sm' : 'text-gray-400'}`}
                                            style={{ color: !isLogin ? activeCategory.theme : undefined }}
                                        >
                                            Sign Up
                                        </button>
                                    </div>

                                    <div className="space-y-2 text-center">
                                        <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                            {isLogin ? 'Welcome Back!' : 'Create Account'}
                                        </h3>
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                                            OTP will be sent for verification
                                        </p>
                                    </div>

                                    <form onSubmit={handleSendOtp} className="space-y-4">
                                        {!isLogin && (
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors" style={{ color: 'inherit' }}>
                                                    <User size={18} className="group-focus-within:text-[var(--theme-color)]" style={{ color: 'inherit' }} />
                                                </div>
                                                <input
                                                    required
                                                    name="name"
                                                    placeholder="Full Name"
                                                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-gray-800 outline-none focus:bg-white transition-all"
                                                    style={{ '--theme-color': activeCategory.theme }}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    onFocus={(e) => e.target.style.borderColor = activeCategory.theme}
                                                    onBlur={(e) => e.target.style.borderColor = '#F3F4F6'}
                                                />
                                            </div>
                                        )}
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors">
                                                <Phone size={18} />
                                            </div>
                                            <div className="absolute left-11 top-1/2 -translate-y-1/2 font-black text-sm text-gray-400 border-r border-gray-200 pr-2">
                                                +91
                                            </div>
                                            <input
                                                required
                                                name="phone"
                                                maxLength={10}
                                                placeholder="Mobile Number"
                                                className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-20 pr-4 py-4 text-sm font-bold text-gray-800 outline-none focus:bg-white transition-all"
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                                                onFocus={(e) => e.target.style.borderColor = activeCategory.theme}
                                                onBlur={(e) => e.target.style.borderColor = '#F3F4F6'}
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full text-white py-5 rounded-[24px] text-xs font-black tracking-[4px] flex items-center justify-center gap-3 active:scale-95 transition-all uppercase"
                                            style={{ backgroundColor: activeCategory.theme, boxShadow: `0 20px 40px ${activeCategory.shadow}` }}
                                        >
                                            {isLoading ? 'Verifying...' : 'Continue'}
                                            <ChevronRight size={18} />
                                        </button>
                                    </form>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="otp-view"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-10"
                                >
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setShowOtp(false)}
                                            className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center text-gray-400"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <div>
                                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Verify Device</h3>
                                            <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">+91 {formData.phone}</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleVerifyOtp} className="space-y-10">
                                        <div className="flex justify-between gap-3 px-1">
                                            {[...Array(4)].map((_, i) => (
                                                <input
                                                    key={i}
                                                    type="tel"
                                                    maxLength={1}
                                                    className="w-14 h-16 bg-white border-2 border-gray-200 rounded-3xl text-center text-2xl font-black outline-none shadow-[0_18px_45px_rgba(15,23,42,0.35)] focus:bg-white focus:border-[var(--theme-color)] focus:shadow-[0_24px_65px_rgba(15,23,42,0.55)] transition-all"
                                                    style={{ color: activeCategory.theme }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Backspace' && !e.target.value && i > 0) {
                                                            e.target.previousElementSibling.focus();
                                                        }
                                                    }}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val && i < 3) (e.target.nextElementSibling).focus();
                                                        const otpArr = formData.otp.split('');
                                                        otpArr[i] = val;
                                                        setFormData({ ...formData, otp: otpArr.join('') });
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = activeCategory.theme}
                                                    onBlur={(e) => e.target.style.borderColor = ''}
                                                />
                                            ))}
                                        </div>

                                        <div className="space-y-4">
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full bg-gray-900 text-white py-5 rounded-[24px] text-xs font-black tracking-[4px] shadow-2xl flex items-center justify-center gap-3 uppercase active:scale-95 transition-all"
                                            >
                                                {isLoading ? 'Authenticating...' : `Enter ${appName}`}
                                            </button>
                                            <div className="flex justify-center">
                                                <button
                                                    type="button"
                                                    disabled={timer > 0}
                                                    onClick={handleSendOtp}
                                                    className={`text-[10px] font-black uppercase tracking-widest ${timer > 0 ? 'text-gray-300' : 'underline'}`}
                                                    style={{ color: timer > 0 ? undefined : activeCategory.theme }}
                                                >
                                                    {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Now'}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </div>

            {/* Desktop Message */}
            <div className="hidden md:block absolute bottom-10 right-10 text-white/20 text-xs font-bold uppercase tracking-[4px]">
                Adaptive Theme Simulator
            </div>
        </div>
    );
};

export default CustomerAuth;
