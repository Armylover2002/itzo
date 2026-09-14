// Ultimate FAQ Management System - Functional Version
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import {
    HelpCircle,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit3,
    Trash2,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronUp,
    MessageSquare,
    Layers,
    TrendingUp,
    Settings,
    ArrowUpRight,
    GripVertical,
    Save,
    X,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@shared/components/ui/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@shared/components/ui/Pagination';
import { PAGINATION_CONFIG } from '@/shared/constants/pagination';
import { adminApi } from '../services/adminApi';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";


const FAQManagement = () => {
    const { user: authUser } = useAuth();
    const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
    const [resolvedPermissions, setResolvedPermissions] = useState({});

    useEffect(() => {
        let isMounted = true;

        const resolvePermissions = async () => {
            if (!currentUser || currentUser.role === "ADMIN") {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            const existingPermissions = extractAdminPermissions(currentUser);
            if (Object.keys(existingPermissions).length > 0) {
                if (isMounted) setResolvedPermissions(existingPermissions);
                return;
            }

            const roleId = extractAdminRoleId(currentUser);
            if (!roleId) {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            try {
                const rolePermissions = await fetchAdminRolePermissions(roleId);
                if (isMounted) setResolvedPermissions(rolePermissions);
            } catch {
                if (isMounted) setResolvedPermissions({});
            }
        };

        resolvePermissions();
        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const permissionKey = "quick::core_management::faqs";
    const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
    const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
    const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

    const { showToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [expandedId, setExpandedId] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [sortBy, setSortBy] = useState('Most Viewed');
    const [editingFaqId, setEditingFaqId] = useState(null);

    // Form States
    const [newFaq, setNewFaq] = useState({
        question: '',
        answer: '',
        category: 'Orders',
        audience: 'customer',
        status: 'published'
    });

    const [isLoading, setIsLoading] = useState(true);
    const [newCategoryName, setNewCategoryName] = useState('');

    const [categories, setCategories] = useState([]);

    const fetchCategories = async () => {
        try {
            const res = await adminApi.getFaqCategories();
            setCategories(res.data?.result || []);
        } catch (error) {
            console.error('Failed to fetch categories', error);
        }
    };

    const hasFetchedCategories = useRef(false);
    useEffect(() => {
        if (!hasFetchedCategories.current) {
            fetchCategories();
            hasFetchedCategories.current = true;
        }
    }, []);

    useEffect(() => {
        if (categories.length === 0) return;
        if (newFaq.category && categories.some((category) => category.name === newFaq.category)) return;

        setNewFaq((prev) => ({ ...prev, category: categories[0].name }));
    }, [categories, newFaq.category]);

    const [faqs, setFaqs] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
    const [total, setTotal] = useState(0);

    const hasFetchedFaqs = useRef(false);
    useEffect(() => {
        if (!hasFetchedFaqs.current) {
            fetchFaqs(1);
            hasFetchedFaqs.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const fetchFaqs = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const response = await adminApi.getFAQs({ page: requestedPage, limit: pageSize });
            const payload = response.data.result || {};
            const data = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
            setFaqs(data);
            setTotal(typeof payload.total === 'number' ? payload.total : data.length);
            setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
        } catch (error) {
            showToast('Failed to fetch FAQs', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Computed Categories with Counts
    const categoriesWithCounts = useMemo(() => {
        return categories.map(cat => ({
            ...cat,
            count: faqs.filter(f => f.category === cat.name).length
        }));
    }, [categories, faqs]);

    // Core Filtering and Sorting Logic
    const filteredAndSortedFaqs = useMemo(() => {
        let result = faqs.filter(faq => {
            const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
            return matchesSearch && matchesCategory;
        });

        // Sorting Logic
        switch (sortBy) {
            case 'Most Viewed':
                result.sort((a, b) => b.views - a.views);
                break;
            case 'Newest First':
                result.sort((a, b) => b.createdAt - a.createdAt);
                break;
            case 'Alphabetical':
                result.sort((a, b) => a.question.localeCompare(b.question));
                break;
            default:
                break;
        }

        return result;
    }, [faqs, searchTerm, activeCategory, sortBy]);

    // Actions
    const handleSaveFaq = async (e) => {
        e.preventDefault();

        try {
            if (editingFaqId) {
                await adminApi.updateFAQ(editingFaqId, newFaq);
                showToast(`FAQ updated successfully`, 'success');
            } else {
                await adminApi.createFAQ(newFaq);
                showToast(`FAQ created successfully`, 'success');
            }
            fetchFaqs(page);
            setIsAddModalOpen(false);
            setEditingFaqId(null);
            setNewFaq({ question: '', answer: '', category: categories[0]?.name || 'Orders', audience: 'customer', status: 'published' });
        } catch (error) {
            showToast('Failed to save FAQ', 'error');
        }
    };

    const handleEditClick = (faq) => {
        setNewFaq({
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            audience: faq.audience || 'customer',
            status: faq.status
        });
        setEditingFaqId(faq._id);
        setIsAddModalOpen(true);
    };

    const handleDeleteFaq = async (id) => {
        try {
            await adminApi.deleteFAQ(id);
            fetchFaqs(page);
            showToast('FAQ deleted successfully', 'warning');
        } catch (error) {
            showToast('Failed to delete FAQ', 'error');
        }
    };

    const handleToggleStatus = async (faq) => {
        try {
            const newStatus = faq.status === 'published' ? 'draft' : 'published';
            await adminApi.updateFAQ(faq._id, { status: newStatus });
            fetchFaqs(page);
            showToast('Visibility state updated', 'info');
        } catch (error) {
            showToast('Failed to update status', 'error');
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const colors = ['sky', 'emerald', 'amber', 'rose', 'indigo', 'pink', 'violet'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        try {
            await adminApi.createFaqCategory({ name: newCategoryName, color: randomColor });
            await fetchCategories();
            setNewCategoryName('');
            showToast('New taxonomy node generated', 'success');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to generate category', 'error');
        }
    };

    const handleDeleteCategory = async (id) => {
        try {
            await adminApi.deleteFaqCategory(id);
            await fetchCategories();
            showToast('Category node removed', 'warning');
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to remove category', 'error');
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        FAQ Management
                        <div className="p-2 bg-red-100 rounded-xl">
                            <HelpCircle className="h-5 w-5 text-red-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Manage categories and help customers with common questions.</p>
                </div>
                <div className="flex items-center gap-3">
                    {(canCreate || canDelete) && (
                        <button
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-3 bg-white ring-1 ring-slate-200 text-slate-700 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <Layers className="h-4 w-4 text-sky-500" />
                            CATEGORIES
                        </button>
                    )}
                    {canCreate && (categories.length === 0 ? (
                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mt-6">
                            <p className="text-sm text-rose-600 font-bold text-center">Please create a category first before adding FAQs.</p>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                setNewFaq((prev) => ({
                                    ...prev,
                                    category: categories.some((category) => category.name === prev.category)
                                        ? prev.category
                                        : categories[0]?.name || ''
                                }));
                                setIsAddModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl text-xs font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95 shadow-red-200"
                        >
                            <Plus className="h-4 w-4" />
                            ADD FAQ
                        </button>
                    ))}
                </div>
            </div>

            {/* Quick Intelligence Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total FAQs', value: faqs.length, icon: MessageSquare, bg: 'bg-red-50', iconColor: 'text-red-600' },
                    { label: 'Total Views', value: faqs.reduce((acc, f) => acc + f.views, 0).toLocaleString(), icon: TrendingUp, bg: 'bg-sky-50', iconColor: 'text-sky-600' },
                    { label: 'Published', value: faqs.filter(f => f.status === 'published').length, icon: CheckCircle2, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
                    { label: 'Drafts', value: faqs.filter(f => f.status === 'draft').length, icon: Edit3, bg: 'bg-amber-50', iconColor: 'text-amber-600' },
                ].map((stat, i) => (
                    <Card key={i} className="p-5 border-none shadow-sm ring-1 ring-slate-100 bg-white group hover:ring-red-200 transition-all overflow-hidden relative text-left">
                        <div className="relative z-10 flex items-center gap-4">
                            <div className={cn("p-3 rounded-2xl h-12 w-12 flex items-center justify-center", stat.bg)}>
                                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-black text-slate-900">{stat.value}</h3>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Left Sidebar: Categories */}
                <div className="lg:col-span-1 space-y-4">
                    <Card className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl text-left">
                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6">FAQ Categories</h4>
                        <div className="space-y-2">
                            <button
                                onClick={() => setActiveCategory('All')}
                                className={cn(
                                    "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all",
                                    activeCategory === 'All' ? "bg-red-600 text-white shadow-lg" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <span className="flex items-center gap-3">
                                    <Layers className="h-4 w-4 opacity-70" />
                                    All Topics
                                </span>
                                <span className="text-[10px] opacity-60 font-black">{faqs.length}</span>
                            </button>
                            {categoriesWithCounts.map((cat) => (
                                <button
                                    key={cat._id}
                                    onClick={() => setActiveCategory(cat.name)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all",
                                        activeCategory === cat.name ? "bg-red-600 text-white shadow-lg shadow-red-100" : "text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    <span className="flex items-center gap-3">
                                        <div className={cn("h-1.5 w-1.5 rounded-full", activeCategory === cat.name ? "bg-white" : `bg-${cat.color}-500`)} />
                                        {cat.name}
                                    </span>
                                    <span className="text-[10px] opacity-60 font-black">{cat.count}</span>
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Main Content: FAQ List */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Filter & Search Bar */}
                    <Card className="p-4 border-none shadow-xl ring-1 ring-slate-100/50 bg-white/80 backdrop-blur-xl rounded-xl flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 relative group w-full text-left">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search questions or answers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500/10 transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Sort:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-slate-50 border-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none text-slate-600 cursor-pointer"
                            >
                                <option>Most Viewed</option>
                                <option>Newest First</option>
                                <option>Alphabetical</option>
                            </select>
                        </div>
                    </Card>

                    {/* FAQ Grid/List */}
                    <div className="space-y-4">
                        <AnimatePresence mode='popLayout'>
                            {filteredAndSortedFaqs.map((faq, index) => (
                                <motion.div
                                    key={faq.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <Card className={cn(
                                        "border-none shadow-lg ring-1 transition-all overflow-hidden rounded-xl text-left",
                                        expandedId === faq.id ? "ring-red-200 bg-white" : "ring-slate-100 bg-white hover:ring-slate-200"
                                    )}>
                                        <div className="p-6">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-slate-50 rounded-2xl text-slate-300">
                                                    <GripVertical className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest border-slate-200 text-slate-400">
                                                                {faq.id.substring(0, 8).toUpperCase()}
                                                            </Badge>
                                                            <Badge variant={faq.status === 'published' ? 'success' : 'secondary'} className="text-[8px] font-black uppercase tracking-widest">
                                                                {faq.status}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-2 mr-4">
                                                                <Eye className="h-3.5 w-3.5 text-slate-300" />
                                                                <span className="text-[10px] font-bold text-slate-400">{faq.views.toLocaleString()}</span>
                                                            </div>
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleToggleStatus(faq)}
                                                                    title={faq.status === 'published' ? 'Set as Draft' : 'Publish Now'}
                                                                    className="p-2 transition-all text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg"
                                                                >
                                                                    {faq.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                                </button>
                                                            )}
                                                            {canEdit && (
                                                                <button
                                                                    onClick={() => handleEditClick(faq)}
                                                                    className="p-2 transition-all text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg"
                                                                >
                                                                    <Edit3 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={() => handleDeleteFaq(faq._id)}
                                                                    className="p-2 transition-all text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                                                        className="cursor-pointer group"
                                                    >
                                                        <h3 className="text-base font-black text-slate-900 group-hover:text-red-600 transition-colors flex items-center justify-between">
                                                            {faq.question}
                                                            {expandedId === faq.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                        </h3>
                                                    </div>
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {expandedId === faq.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="mt-6 pt-6 border-t border-slate-50 ml-14">
                                                            <div className="bg-slate-50 p-6 rounded-xl relative">
                                                                <p className="text-sm font-bold text-slate-600 leading-relaxed italic">
                                                                    "{faq.answer}"
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center justify-between mt-4">
                                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                                                    <ArrowUpRight className="h-3 w-3" />
                                                                    Category: <span className="text-slate-500">{faq.category}</span>
                                                                </span>
                                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                                                    Updated: {faq.lastUpdated}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-center">
                <Pagination
                    page={page}
                    totalPages={Math.ceil(total / pageSize) || 1}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={(p) => fetchFaqs(p)}
                    onPageSizeChange={(newSize) => {
                        setPageSize(newSize);
                        setPage(1);
                    }}
                    loading={isLoading}
                />
            </div>

            {/* Modals */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingFaqId(null);
                    setNewFaq({ question: '', answer: '', category: categories[0]?.name || 'Orders', audience: 'customer', status: 'published' });
                }}
                title={editingFaqId ? `Edit Question: ${editingFaqId}` : "Create New FAQ"}
                size="lg"
            >
                <form onSubmit={handleSaveFaq} className="space-y-6 text-left">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Category</label>
                                <select
                                    value={newFaq.category}
                                    onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                                    className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm cursor-pointer"
                                >
                                    {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Visibility State</label>
                                <div className="flex bg-slate-100 p-1 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setNewFaq({ ...newFaq, status: 'published' })}
                                        className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", newFaq.status === 'published' ? "bg-white text-red-600 shadow-sm" : "text-slate-400")}
                                    >PUBLISHED</button>
                                    <button
                                        type="button"
                                        onClick={() => setNewFaq({ ...newFaq, status: 'draft' })}
                                        className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", newFaq.status === 'draft' ? "bg-white text-red-600 shadow-sm" : "text-slate-400")}
                                    >DRAFT</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Audience</label>
                                <div className="flex bg-slate-100 p-1 rounded-2xl">
                                    <button
                                        type="button"
                                        onClick={() => setNewFaq({ ...newFaq, audience: 'customer' })}
                                        className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", newFaq.audience === 'customer' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}
                                    >CUSTOMER</button>
                                    <button
                                        type="button"
                                        onClick={() => setNewFaq({ ...newFaq, audience: 'seller' })}
                                        className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", newFaq.audience === 'seller' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400")}
                                    >SELLER</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Question</label>
                        <input
                            type="text"
                            required
                            value={newFaq.question}
                            onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                            placeholder="Enter the question..."
                            className="w-full px-5 py-5 bg-slate-50 border-none rounded-2xl text-base font-black outline-none focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Answer</label>
                        <textarea
                            rows={4}
                            required
                            value={newFaq.answer}
                            onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                            placeholder="Type the answer here..."
                            className="w-full px-5 py-5 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/10 transition-all shadow-sm resize-none"
                        />
                    </div>
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all">CANCEL</button>
                        <button type="submit" className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl shadow-red-100 transition-all flex items-center justify-center gap-2">
                            <Save className="h-4 w-4" /> SAVE FAQ
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                title="Manage Categories"
            >
                <div className="space-y-6 text-left">
                    <div className="space-y-3">
                        {categories.map((cat) => (
                            <div key={cat._id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-4">
                                    <div className={cn("h-4 w-4 rounded-full shadow-sm", `bg-${cat.color}-500`)} />
                                    <span className="text-sm font-black text-slate-900">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleDeleteCategory(cat._id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-all"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="relative group">
                        <Plus className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-sky-500" />
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                            placeholder="New Category Label..."
                            className="w-full pl-11 pr-4 py-4 bg-white ring-1 ring-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-sky-500/10 transition-all"
                        />
                    </div>
                    <button onClick={handleAddCategory} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 transition-all">GENERATE NEW CATEGORY</button>
                </div>
            </Modal>
        </div>
    );
};

export default FAQManagement;
