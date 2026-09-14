import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Phone, Mail, ChevronDown, ChevronUp, Search, HelpCircle } from 'lucide-react';
import { useSettings } from '@core/context/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { BlurFade } from '@/components/ui/blur-fade';
import { cn } from '@/lib/utils';
import axiosInstance from '@core/api/axios';

const SellerSupportPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    
    const [faqs, setFaqs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchFaqs = async () => {
            try {
                const response = await axiosInstance.get('/quick-commerce/public/faqs', {
                    params: { audience: 'seller' }
                });
                const data = response.data?.result ?? response.data;
                const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
                setFaqs(list);
                
                // Extract unique categories
                const cats = new Set(list.map(f => f.category));
                setCategories(['All', ...Array.from(cats)]);
                
            } catch (error) {
                console.error('Error fetching FAQs:', error);
            }
        };

        fetchFaqs();
    }, []);

    const filteredFaqs = faqs.filter(f => {
        const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
        const matchesSearch = f.question.toLowerCase().includes(searchTerm.toLowerCase()) || f.answer.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="space-y-4 px-3.5 md:px-4 max-w-5xl md:max-w-none mx-auto w-full pb-20">
            {/* Page Header */}
            <BlurFade delay={0.1}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
                    <div>
                        <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight">
                            Help Center & FAQs
                        </h1>
                        <p className="text-xs font-normal text-slate-500 mt-0.5">
                            Find quick answers to common merchant queries, order flows, and payments.
                        </p>
                    </div>
                </div>
            </BlurFade>

            {/* Main Content Card */}
            <BlurFade delay={0.2}>
                <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-3.5 sm:p-5 space-y-4">
                    {/* Search & Categories Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        {/* Search Input */}
                        <div className="relative group w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search FAQs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs font-normal text-slate-900 outline-none focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        {/* Category Pills */}
                        {categories.length > 1 && (
                            <div className="flex flex-wrap gap-1.5">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setActiveCategory(cat)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                                            activeCategory === cat 
                                                ? "bg-red-600 text-white shadow-2xs font-semibold" 
                                                : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 border border-slate-200/60"
                                        )}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* FAQ Items List */}
                    <div className="space-y-2.5">
                        {filteredFaqs.length > 0 ? (
                            filteredFaqs.map((faq) => (
                                <FAQItem
                                    key={faq._id || faq.id || faq.question}
                                    question={faq.question}
                                    answer={faq.answer}
                                />
                            ))
                        ) : (
                            <div className="bg-slate-50/70 rounded-xl border border-dashed border-slate-200 px-4 py-10 flex flex-col items-center justify-center text-center">
                                <HelpCircle className="h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-slate-700 font-semibold text-xs">No FAQs found.</p>
                                <p className="text-slate-500 text-[11px] mt-0.5 font-normal">Try adjusting your search or selecting a different category.</p>
                            </div>
                        )}
                    </div>
                </div>
            </BlurFade>
        </div>
    );
};

const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden transition-all hover:border-red-200 shadow-2xs">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors cursor-pointer"
            >
                <span className="font-semibold text-slate-900 text-xs sm:text-sm group-hover:text-red-600 transition-colors">{question}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-red-600 shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-50/60 border-t border-slate-100"
                    >
                        <div className="px-3.5 py-2.5 text-xs text-slate-600 font-normal leading-relaxed">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SellerSupportPage;
