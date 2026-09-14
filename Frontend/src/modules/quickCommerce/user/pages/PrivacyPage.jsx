import React from 'react';
import { ChevronLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';

const PrivacyPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'App';
    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-10">
            {/* Header */}
            <div className="bg-white sticky top-0 z-30 px-4 py-3 flex items-center gap-1 shadow-sm">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                    <ChevronLeft size={24} className="text-slate-600" />
                </button>
                <h1 className="text-lg font-black text-slate-800">Privacy Policy</h1>
            </div>

            <div className="p-5 max-w-3xl mx-auto space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center text-[#0c831f]">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Privacy Policy</h2>
                            <p className="text-xs text-slate-500 font-medium">Last updated: Oct 2025</p>
                        </div>
                    </div>

                    <div className="prose prose-slate prose-sm max-w-none text-slate-600 space-y-4">
                        <p>
                            At {appName}, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.
                        </p>

                        <h3 className="text-slate-800 font-bold text-base mt-6">1. Information We Collect</h3>
                        <p>
                            We collect information you provide directly, such as your name, address, phone number, and payment details. We also collect usage data automatically.
                        </p>

                        <h3 className="text-slate-800 font-bold text-base mt-6">2. How We Use Information</h3>
                        <p>
                            We use your data to process orders, improve our services, and communicate with you about promotions and updates.
                        </p>

                        <h3 className="text-slate-800 font-bold text-base mt-6">3. Data Security</h3>
                        <p>
                            We implement industry-standard security measures to protect your data. However, no method of transmission is 100% secure.
                        </p>

                        <h3 className="text-slate-800 font-bold text-base mt-6">4. Sharing of Information</h3>
                        <p>
                            We do not sell your personal data. We may share data with service providers (e.g., delivery partners) as necessary to fulfill your orders.
                        </p>

                        <h3 className="text-slate-800 font-bold text-base mt-6">5. Your Rights</h3>
                        <p>
                            You have the right to access, correct, or delete your personal data. Contact our support team for assistance.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
