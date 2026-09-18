import React, { useEffect, useState } from 'react';
import axiosInstance from '@core/api/axios';
import { Loader2, Phone, Mail, MapPin, Clock, Calendar, AlertCircle } from 'lucide-react';

export default function SupportContact() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axiosInstance.get('/hrms/support/settings');
                setSettings(res.data?.data);
            } catch (err) {
                console.error(err);
                setError('Failed to load contact information');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <p className="font-medium">{error}</p>
                </div>
            </div>
        );
    }

    const contact = settings?.hrContact || {};

    const cards = [
        { title: 'HR Name', value: contact.name, icon: UserIcon },
        { title: 'HR Email', value: contact.email, icon: Mail },
        { title: 'HR Mobile', value: contact.mobile, icon: Phone },
        { title: 'Support Email', value: contact.companySupportEmail, icon: Mail },
        { title: 'Support Number', value: contact.companySupportNumber, icon: Phone },
        { title: 'Office Address', value: contact.officeAddress, icon: MapPin },
        { title: 'Working Days', value: contact.workingDays, icon: Calendar },
        { title: 'Working Hours', value: contact.workingHours, icon: Clock },
    ];

    function UserIcon(props) {
        return (
            <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        );
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Contact HR</h1>
                <p className="text-sm text-slate-500 mt-1">Get in touch with the Human Resources department</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((c, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-12 h-12 rounded-xl bg-[#f7f3fc] flex items-center justify-center shrink-0">
                            <c.icon className="w-6 h-6 text-[#6412c6]" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">{c.title}</p>
                            <p className="text-base font-bold text-slate-800 mt-0.5">{c.value || 'Not configured'}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-[#f7f3fc] border border-[#f0e7f9] rounded-2xl p-6 text-center">
                <h3 className="text-lg font-bold text-[#370a6d] mb-2">Need Help?</h3>
                <p className="text-[#550fa8]/80 mb-4">If you are facing issues that require a detailed explanation, please raise a support request.</p>
                <a href="/hrms/support/create" className="inline-flex items-center gap-2 bg-[#6412c6] text-white px-5 py-2.5 rounded-xl font-medium hover:bg-[#550fa8] transition-colors shadow-sm">
                    Raise a Request
                </a>
            </div>
        </div>
    );
}
