import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Mail, FileText, ChevronLeft, PlusCircle, X, Send } from 'lucide-react';
import { useToast } from '@shared/components/ui/Toast';
import { useSettings } from '@core/context/SettingsContext';
import { customerApi } from '../services/customerApi';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SupportPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const supportEmail = settings?.supportEmail || '';
    const supportEmailShort = supportEmail ? (supportEmail.length > 12 ? supportEmail.slice(0, 12) + '...' : supportEmail) : 'support@...';
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [ticketLoading, setTicketLoading] = useState(false);
    const [ticketData, setTicketData] = useState({
        subject: '',
        description: '',
        priority: 'medium'
    });

    const handleTicketSubmit = async (e) => {
        e.preventDefault();
        try {
            setTicketLoading(true);
            const res = await customerApi.createTicket({
                ...ticketData,
                department: 'general'
            });
            if (res.data.success) {
                showToast('Support ticket created successfully!', 'success');
                setIsTicketModalOpen(false);
                setTicketData({ subject: '', description: '', priority: 'medium' });
            } else {
                showToast(res.data.message || 'Failed to create ticket', 'error');
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Error submitting ticket', 'error');
        } finally {
            setTicketLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header Banner */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1.5 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">Help & Support</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-4 relative z-20 space-y-5">
                {/* Contact Channels */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <ContactCard icon={MessageCircle} label="Chat Us" sub="Instant Support" to="/chat" />
                    <ContactCard
                        icon={PlusCircle}
                        label="Raise Ticket"
                        sub="Formal Request"
                        onClick={() => setIsTicketModalOpen(true)}
                    />
                    <ContactCard icon={Phone} label="Call Us" sub="+91 98765..." />
                    <ContactCard icon={Mail} label="Email Us" sub={supportEmailShort} />
                </div>

                {/* Legal Links */}
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                    <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Legal</h3>
                    <div className="space-y-3">
                        <Link to="/terms" className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 font-medium">
                            <FileText size={18} /> Terms & Conditions
                        </Link>
                        <Link to="/privacy" className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 font-medium">
                            <FileText size={18} /> Privacy Policy
                        </Link>
                    </div>
                </div>
            </div>

            {/* Ticket Creation Modal */}
            <AnimatePresence>
                {isTicketModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsTicketModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
                        >
                            <div className="p-6 md:p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900">Create Support Ticket</h3>
                                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Direct Assistance from our Executive</p>
                                    </div>
                                    <button
                                        onClick={() => setIsTicketModalOpen(false)}
                                        className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleTicketSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Subject</label>
                                        <input
                                            type="text"
                                            required
                                            value={ticketData.subject}
                                            onChange={(e) => setTicketData({ ...ticketData, subject: e.target.value })}
                                            placeholder="What can we help you with?"
                                            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold outline-none ring-1 ring-transparent focus:ring-primary-orange/20 transition-all"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        {['low', 'medium', 'high'].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setTicketData({ ...ticketData, priority: p })}
                                                className={cn(
                                                    "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                                    ticketData.priority === p
                                                        ? "bg-primary-orange text-white border-primary-orange shadow-lg shadow-orange-100"
                                                        : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                                )}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description</label>
                                        <textarea
                                            required
                                            value={ticketData.description}
                                            onChange={(e) => setTicketData({ ...ticketData, description: e.target.value })}
                                            placeholder="Please explain the issue clearly..."
                                            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold min-h-[150px] outline-none ring-1 ring-transparent focus:ring-primary-orange/20 transition-all"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={ticketLoading}
                                        className="w-full h-14 bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-white text-lg font-black rounded-2xl shadow-xl shadow-orange-100 transition-all active:scale-95"
                                    >
                                        {ticketLoading ? (
                                             <div className="flex items-center gap-2 text-center w-full justify-center">
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                SUBMITTING...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-center w-full justify-center">
                                                <Send size={20} /> SUBMIT TICKET
                                            </div>
                                        )}
                                    </Button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const ContactCard = ({ icon: Icon, label, sub, to, onClick }) => {
    const CardContent = (
        <div
            onClick={onClick}
            className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer group h-full"
        >
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:text-slate-800 transition-colors">
                <Icon size={20} />
            </div>
            <div>
                <h3 className="font-semibold text-slate-800 text-sm whitespace-nowrap">{label}</h3>
                <p className="text-[10px] text-slate-500 font-medium">{sub}</p>
            </div>
        </div>
    );

    return to ? <Link to={to} className="block h-full">{CardContent}</Link> : CardContent;
};

export default SupportPage;
