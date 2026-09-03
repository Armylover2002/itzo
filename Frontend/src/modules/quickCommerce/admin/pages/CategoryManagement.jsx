import React, { useState, useEffect, useMemo, useRef } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Plus,
    ChevronRight,
    ChevronDown,
    Trash2,
    Edit,
    FolderOpen,
    Folder,
    Tag,
    Search,
    Filter,
    X,
    Image,
    AlertTriangle,
    Eye,
    EyeOff,
    Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

const CategoryManagement = () => {
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expanded, setExpanded] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [parentUnits, setParentUnits] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        status: 'active',
        type: 'header',
        parentId: ''
    });

    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [activeView, setActiveView] = useState('tree'); // 'tree' or 'subcategories'

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const [categoriesRes, parentsRes] = await Promise.all([
                adminApi.getCategoryTree(),
                adminApi.getParentUnits()
            ]);

            if (categoriesRes.data.success) {
                setCategories(categoriesRes.data.results || categoriesRes.data.result || []);
            }
            if (parentsRes.data.success) {
                setParentUnits(parentsRes.data.results || parentsRes.data.result || []);
            }
        } catch (error) {
            toast.error('Failed to fetch data');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleExpand = (id) => {
        setExpanded(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const expandAll = () => {
        const allIds = [];
        const traverse = (items) => {
            items.forEach(item => {
                const id = item._id || item.id;
                if (item.children && item.children.length > 0) {
                    allIds.push(id);
                    traverse(item.children);
                }
            });
        };
        traverse(categories);
        setExpanded(allIds);
    };

    const collapseAll = () => setExpanded([]);

    const filteredCategories = useMemo(() => {
        const filterNode = (node) => {
            const name = node.name || '';
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || node.status === filterStatus;

            // Always filter children first
            let filteredChildren = [];
            if (node.children) {
                filteredChildren = node.children.map(filterNode).filter(Boolean);
            }

            // A node stays if:
            // 1. It matches BOTH search and status
            // 2. OR it has children that match (for tree structure)
            if (matchesSearch && matchesStatus) {
                return { ...node, children: filteredChildren };
            }

            if (filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }

            return null;
        };

        if (!searchTerm && filterStatus === 'all') return categories;
        return categories.map(filterNode).filter(Boolean);
    }, [categories, searchTerm, filterStatus]);

    // Flatten for subcategory list view
    const allSubcategories = useMemo(() => {
        const subs = [];
        const traverse = (items, headerName = '', categoryName = '') => {
            items.forEach(item => {
                if (item.type === 'header') {
                    if (item.children) traverse(item.children, item.name, '');
                } else if (item.type === 'category') {
                    if (item.children) traverse(item.children, headerName, item.name);
                } else if (item.type === 'subcategory') {
                    subs.push({
                        ...item,
                        headerName,
                        parentCategory: categoryName
                    });
                }
            });
        };
        traverse(categories);
        return subs;
    }, [categories]);

    const filteredSubcategories = useMemo(() => {
        return allSubcategories.filter(sub => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                sub.name.toLowerCase().includes(searchLower) ||
                (sub.headerName && sub.headerName.toLowerCase().includes(searchLower)) ||
                (sub.parentCategory && sub.parentCategory.toLowerCase().includes(searchLower));

            const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [allSubcategories, searchTerm, filterStatus]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.slug) {
            toast.error('Name and slug are required');
            return;
        }

        setIsSaving(true);
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });
            if (imageFile) {
                data.append('image', imageFile);
            }

            if (editingItem) {
                const id = editingItem._id || editingItem.id;
                await adminApi.updateCategory(id, data);
                toast.success('Category updated successfully');
            } else {
                await adminApi.createCategory(data);
                toast.success('Category created successfully');
            }
            setIsAddModalOpen(false);
            setEditingItem(null);
            setImageFile(null);
            setPreviewUrl(null);
            fetchCategories();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save category');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const id = deleteTarget._id || deleteTarget.id;

        try {
            await adminApi.deleteCategory(id);
            toast.success('Category and descendants deleted');
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
            fetchCategories();
        } catch (error) {
            toast.error('Failed to delete category');
        }
    };

    const openModal = (type, parentId = '', item = null) => {
        if (item) {
            setFormData({
                name: item.name,
                slug: item.slug,
                description: item.description || '',
                status: item.status || 'active',
                type: item.type,
                parentId: item.parentId || ''
            });
            setEditingItem(item);
            setPreviewUrl(item.image || null);
            setImageFile(null);
        } else {
            setFormData({
                name: '',
                slug: '',
                description: '',
                status: 'active',
                type: type,
                parentId: parentId || ''
            });
            setEditingItem(null);
            setPreviewUrl(null);
            setImageFile(null);
        }
        setIsAddModalOpen(true);
    };

    const renderTree = (items, level = 0) => {
        return items.map(item => {
            const id = item._id || item.id;
            return (
                <motion.div
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={id}
                    className="select-none"
                >
                    <div
                        className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl transition-all mb-1.5 group relative overflow-hidden",
                            level === 0 ? "bg-white shadow-sm ring-1 ring-gray-100 mt-3 border-l-4 border-primary" : "hover:bg-gray-100/50",
                            expanded.includes(id) ? "bg-gray-50 ring-1 ring-gray-100" : ""
                        )}
                    >
                        <div className="flex items-center space-x-2.5 flex-1 cursor-pointer" onClick={() => item.children && item.children.length > 0 && toggleExpand(id)}>
                            <div style={{ paddingLeft: `${level * 24}px` }} className="flex items-center space-x-3">
                                {item.children && item.children.length > 0 ? (
                                    <div className={cn(
                                        "p-0.5 rounded transition-colors",
                                        expanded.includes(id) ? "bg-primary/10 text-primary" : "text-gray-300 group-hover:text-gray-400"
                                    )}>
                                        {expanded.includes(id) ?
                                            <ChevronDown className="h-3.5 w-3.5" /> :
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        }
                                    </div>
                                ) : (
                                    <div className="w-5" />
                                )}

                                {item.image ? (
                                    <div className="h-8 w-8 rounded-lg overflow-hidden shadow-sm ring-1 ring-gray-100">
                                        <img src={item.image} alt="" className="h-full w-full object-cover" />
                                    </div>
                                ) : (
                                    <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105",
                                        level === 0 ? "bg-[#f7f3fc] text-primary ring-2 ring-[#f7f3fc]" :
                                            level === 1 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                    )}>
                                        {level === 0 ? <FolderOpen className="h-4 w-4" /> :
                                            level === 1 ? <Folder className="h-4 w-4" /> :
                                                <Tag className="h-3.5 w-3.5" />}
                                    </div>
                                )}

                                <div className="flex flex-col">
                                    <div className="flex items-center space-x-1.5">
                                        <span className={cn(
                                            "text-xs tracking-tight",
                                            level === 0 ? "font-bold text-gray-900" :
                                                level === 1 ? "font-semibold text-gray-700" : "font-medium text-gray-600"
                                        )}>
                                            {item.name}
                                        </span>
                                        {item.status === 'inactive' && (
                                            <Badge variant="gray" className="text-[7px] h-3 px-1 font-bold uppercase tracking-tighter">Draft</Badge>
                                        )}
                                    </div>
                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{item.slug}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 mr-1.5">
                            <div className="flex -space-x-0.5 items-center mr-1.5">
                                {item.children?.length > 0 && (
                                    <span className="mr-1 text-[9px] font-bold text-gray-400">{item.children.length} items</span>
                                )}
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); openModal(item.type, item.parentId, item); }}
                                className="p-1.5 hover:bg-white hover:text-primary rounded-lg transition-all text-gray-400 shadow-sm ring-1 ring-gray-100 bg-white/50"
                            >
                                <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); setIsDeleteModalOpen(true); }}
                                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all text-gray-400 shadow-sm ring-1 ring-gray-100 bg-white/50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>

                        <div className={cn(
                            "absolute right-0 top-0 bottom-0 w-1",
                            item.status === 'active' ? "bg-emerald-500" : "bg-gray-300"
                        )} />
                    </div>
                    <AnimatePresence>
                        {item.children && item.children.length > 0 && expanded.includes(id) && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                {renderTree(item.children, level + 1)}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            );
        });
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Manage Categories
                        <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">ECS</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Organize your store by grouping items together into folders.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                        <Image className="h-5 w-5" />
                    </button>
                    <button
                        onClick={() => openModal('header')}
                        className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center space-x-2"
                    >
                        <Plus className="h-4 w-4" />
                        <span>CREATE NEW HEADER</span>
                    </button>
                </div>
            </div>

            {/* Toolbox & View Switcher */}
            <div className="space-y-4">
                <div className="flex p-1 bg-white ring-1 ring-slate-100 rounded-2xl w-fit shadow-sm">
                    <button
                        onClick={() => setActiveView('tree')}
                        className={cn(
                            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            activeView === 'tree' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Category Tree
                    </button>
                    <button
                        onClick={() => setActiveView('subcategories')}
                        className={cn(
                            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            activeView === 'subcategories' ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Detailed Subcategories
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <Card className="lg:col-span-3 border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                        <div className="flex flex-col md:flex-row gap-3 items-center">
                            <div className="relative flex-1 group w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={activeView === 'tree' ? "Search catalog..." : "Search subcategories..."}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors">
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 shrink-0 w-full md:w-auto">
                                <button
                                    onClick={() => {
                                        const nextStatus = filterStatus === 'all' ? 'active' : filterStatus === 'active' ? 'inactive' : 'all';
                                        setFilterStatus(nextStatus);
                                    }}
                                    className={cn(
                                        "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                        filterStatus === 'active' ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" :
                                            filterStatus === 'inactive' ? "bg-amber-500 text-white shadow-md shadow-amber-100" :
                                                "bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50"
                                    )}
                                >
                                    <Filter className="h-4 w-4" />
                                    <span>
                                        {filterStatus === 'active' ? 'ONLY LIVE' :
                                            filterStatus === 'inactive' ? 'ONLY DRAFT' :
                                                'SHOW ALL'}
                                    </span>
                                </button>
                                {activeView === 'tree' && (
                                    <button
                                        onClick={expanded.length > 0 ? collapseAll : expandAll}
                                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:ring-primary hover:text-primary transition-all"
                                    >
                                        <span>{expanded.length > 0 ? 'CLOSE ALL' : 'OPEN ALL'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card className="lg:col-span-1 border-none shadow-sm ring-1 ring-[#f7f3fc] bg-gradient-to-tr from-[#f7f3fc] to-white p-4 flex flex-col justify-between overflow-hidden relative">
                        <div className="z-10">
                            <p className="ds-label text-[#9359d7] mb-1">
                                {activeView === 'tree' ? 'Total Groups' : 'Subcategories'}
                            </p>
                            <h4 className="ds-stat-medium text-[#28074f] line-height-none">
                                {isLoading ? '...' : (activeView === 'tree' ? filteredCategories.length : filteredSubcategories.length)}
                            </h4>
                            <p className="text-[10px] font-semibold text-[#9359d7] mt-1">Working Fine</p>
                        </div>
                        {activeView === 'tree' ? (
                            <FolderOpen className="absolute -right-2 -bottom-2 h-16 w-16 text-primary/5 rotate-12" />
                        ) : (
                            <Tag className="absolute -right-2 -bottom-2 h-16 w-16 text-primary/5 rotate-12" />
                        )}
                    </Card>
                </div>
            </div>

            {/* Content Section */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-8">
                    {activeView === 'tree' ? (
                        <div className="bg-white/40 backdrop-blur-md rounded-xl p-6 ring-1 ring-slate-100 min-h-[500px] shadow-xl shadow-slate-200/40 relative">
                            {isLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            ) : filteredCategories.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                                    <Folder className="h-16 w-16 mb-3 opacity-20" />
                                    <p className="text-base font-bold italic">No records found</p>
                                    <button onClick={() => { setSearchTerm(''); setFilterStatus('all'); }} className="mt-3 text-sm text-primary font-semibold hover:underline">Clear all filters</button>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {renderTree(filteredCategories)}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white/40 backdrop-blur-md rounded-xl p-0 ring-1 ring-slate-100 min-h-[500px] shadow-xl shadow-slate-200/40 overflow-hidden relative">
                            {isLoading && (
                                <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                </div>
                            )}
                            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subcategory Management</h3>
                                <button
                                    onClick={() => openModal('subcategory')}
                                    className="text-[10px] font-black text-primary hover:text-primary-hover uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Plus className="h-3 w-3" />
                                    Quick Register
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-50">
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subcategory</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Category</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredSubcategories.map((sub) => {
                                            const id = sub._id || sub.id;
                                            return (
                                                <tr key={id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            {sub.image ? (
                                                                <div className="h-10 w-10 bg-white rounded-xl shadow-sm ring-1 ring-slate-100 overflow-hidden">
                                                                    <img src={sub.image} alt="" className="h-full w-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-8 w-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                                                                    <Tag className="h-4 w-4" />
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700">{sub.name}</span>
                                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{sub.slug}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant="outline" className="text-[9px] font-bold bg-[#f7f3fc]/50 text-primary border-[#f0e7f9]">
                                                            {sub.parentCategory || 'Unknown'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant={sub.status === 'active' ? 'emerald' : 'gray'} className="text-[9px] font-black uppercase tracking-widest">
                                                            {sub.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => openModal('subcategory', sub.parentId, sub)}
                                                                className="p-1.5 hover:bg-white text-slate-400 hover:text-primary-hover rounded-lg transition-all shadow-sm ring-1 ring-slate-100 bg-white/50"
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setDeleteTarget(sub); setIsDeleteModalOpen(true); }}
                                                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all shadow-sm ring-1 ring-slate-100 bg-white/50"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <Card className="bg-slate-900 border-none shadow-xl p-6 rounded-xl text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-lg font-bold mb-0.5 uppercase tracking-tight">Organization Guide</h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-6">Organize Categories</p>

                            <div className="space-y-4">
                                {[
                                    { step: '1', title: 'Headers', desc: 'Main navigation groups (e.g., Grocery).', color: 'bg-primary' },
                                    { step: '2', title: 'Categories', desc: 'Departmental folders (e.g., Dairy).', color: 'bg-emerald-500' },
                                    { step: '3', title: 'Subcategories', desc: 'Specific item groups (e.g., Milk).', color: 'bg-amber-500' }
                                ].map((item, i) => (
                                    <div key={i} className="flex gap-4 group">
                                        <div className={cn("h-8 w-8 shrink-0 rounded-xl flex items-center justify-center font-black text-sm shadow-lg rotate-2 group-hover:rotate-0 transition-transform duration-500", item.color)}>
                                            {item.step}
                                        </div>
                                        <div>
                                            <p className="font-bold text-xs mb-0.5">{item.title}</p>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 h-32 w-32 bg-primary/10 rounded-full blur-3xl" />
                    </Card>
                </div>
            </div>

            {/* Modals */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setIsAddModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-3xl relative z-10 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col lg:flex-row"
                        >
                            <div className="lg:w-1/3 bg-slate-50 p-6 border-r border-slate-100 flex flex-col justify-between">
                                <div className="space-y-6">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/50 flex flex-col items-center justify-center p-2 text-center border-2 border-dashed border-slate-200 group cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                                    >
                                        {previewUrl ? (
                                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                                        ) : (
                                            <>
                                                <Upload className="h-10 w-10 text-slate-300 group-hover:text-primary group-hover:scale-110 transition-all" />
                                                <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Upload Image</p>
                                            </>
                                        )}
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                        />
                                    </div>
                                    <div className="p-4 bg-slate-900 rounded-2xl text-white">
                                        <div className="flex flex-col items-center text-center">
                                            <Badge variant="primary" className="text-[7px] font-bold mb-1 uppercase tracking-widest">{formData.type}</Badge>
                                            <span className="text-xs font-bold truncate w-full">{formData.name || 'Untitled'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-6 lg:p-8 relative">
                                <button onClick={() => setIsAddModalOpen(false)} className="absolute right-6 top-6 p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <X className="h-5 w-5" />
                                </button>

                                <div className="space-y-6">
                                    <header>
                                        <Badge variant="outline" className="text-[9px] font-black uppercase bg-slate-50 mb-1.5 tracking-widest text-slate-400">{formData.type} level</Badge>
                                        <h3 className="text-xl font-bold text-slate-900">{editingItem ? 'Edit Organization Unit' : 'Create New Unit'}</h3>
                                    </header>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
                                            <input
                                                value={formData.name}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFormData({
                                                        ...formData,
                                                        name: val,
                                                        slug: val.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '')
                                                    });
                                                }}
                                                className="w-full px-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-bold outline-none ring-primary/5 focus:ring-2 placeholder:text-slate-300"
                                                placeholder="e.g. Dairy Products"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">URL Identifier (Slug)</label>
                                            <input value={formData.slug} readOnly className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs text-slate-400 font-bold outline-none" />
                                        </div>
                                    </div>

                                    {formData.type !== 'header' && (
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                                Parent {formData.type === 'category' ? 'Header' : 'Department'}
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={formData.parentId}
                                                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                                                    className="w-full px-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="">Select Parent Unit</option>
                                                    {parentUnits
                                                        .filter(unit => {
                                                            if (formData.type === 'category') return unit.type === 'header';
                                                            if (formData.type === 'subcategory') return unit.type === 'category' || unit.type === 'header';
                                                            return false;
                                                        })
                                                        .map(unit => (
                                                            <option key={unit._id || unit.id} value={unit._id || unit.id}>
                                                                {unit.name} ({unit.type})
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Short Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-bold min-h-[80px] outline-none placeholder:text-slate-300"
                                            placeholder="Briefly describe this group..."
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">Visibility Status</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Show to store visitors</p>
                                        </div>
                                        <div className="flex p-1 bg-slate-200/60 rounded-xl">
                                            <button
                                                onClick={() => setFormData({ ...formData, status: 'active' })}
                                                className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center space-x-1.5 tracking-widest",
                                                    formData.status === 'active' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                <span>LIVE</span>
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, status: 'inactive' })}
                                                className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center space-x-1.5 tracking-widest",
                                                    formData.status === 'inactive' ? "bg-white text-slate-700 shadow-sm" : "text-slate-400")}
                                            >
                                                <EyeOff className="h-3.5 w-3.5" />
                                                <span>DRAFT</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3.5 rounded-xl text-xs font-black tracking-widest text-slate-400 hover:bg-slate-50 transition-colors uppercase">Discard</button>
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="flex-[2] py-3.5 rounded-xl text-xs font-black tracking-widest bg-slate-900 text-white shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 uppercase"
                                        >
                                            {isSaving ? 'Synchronizing...' : (editingItem ? 'Apply Changes' : 'Confirm Registration')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-md relative z-10 bg-white rounded-xl p-4 text-center shadow-2xl">
                            <div className="h-20 w-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="h-10 w-10" /></div>
                            <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Irreversible Action</h3>
                            <p className="text-slate-500 text-xs font-bold mt-2 leading-relaxed uppercase tracking-tight">You are deleting <span className="text-rose-600">"{deleteTarget?.name}"</span>. This will destroy all linked categories and products within this group.</p>
                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-4 rounded-xl text-xs font-black tracking-widest text-slate-400 hover:bg-slate-50 uppercase">Abort</button>
                                <button onClick={handleDelete} className="flex-1 py-4 rounded-xl text-xs font-black tracking-widest bg-rose-500 text-white shadow-xl hover:bg-rose-600 transition-colors uppercase">Destroy</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CategoryManagement;
