import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
    HiOutlinePlus,
    HiOutlinePhoto,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineArrowUpCircle,
    HiOutlineArrowDownCircle,
    HiOutlineDevicePhoneMobile,
    HiOutlineEye,
    HiOutlineLink,
    HiOutlineSparkles,
    HiOutlineMegaphone,
    HiOutlineXMark
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { resolveQuickImageUrl } from '../../user/utils/image';

const DISPLAY_TYPES = [
    { id: 'banners', label: 'Banners' },
    { id: 'categories', label: 'Categories' },
    { id: 'subcategories', label: 'Sub Categories' },
    { id: 'products', label: 'Products' },
];

const idEquals = (a, b) => String(a || '') === String(b || '');
const idInList = (list, id) => (Array.isArray(list) ? list : []).some((item) => idEquals(item, id));
const toggleIdInList = (list, id) => {
    const next = Array.isArray(list) ? [...list] : [];
    const idx = next.findIndex((item) => idEquals(item, id));
    if (idx >= 0) next.splice(idx, 1);
    else next.push(id);
    return next;
};

const ALL_TARGET_ID = '__all__';

const isAllNamedHeader = (header) => {
    const slug = String(header?.slug || '').trim().toLowerCase();
    const name = String(header?.name || '').trim().toLowerCase();
    return slug === 'all' || name === 'all';
};

const getBannerItems = (section) =>
    section?.config?.banners?.items || section?.config?.items || [];

const getBannerThumbUrl = (section) => {
    const first = getBannerItems(section).find((b) => b?.imageUrl || b?.url);
    return resolveQuickImageUrl(first?.imageUrl || first?.url || '') || '';
};

const getCategoriesConfig = (section) =>
    section?.config?.categories || section?.config || {};

const getSubcategoriesConfig = (section) =>
    section?.config?.subcategories || section?.config || {};

const getProductsConfig = (section) =>
    section?.config?.products || section?.config || {};

const isVirtualSection = (section) => String(section?._id || '').startsWith('virtual_');

const getSectionHeaderIds = (section) => {
    const fromArray = Array.isArray(section?.headerIds) ? section.headerIds : [];
    const ids = fromArray.map((id) => String(id?._id || id || '')).filter(Boolean);
    if (ids.length) return [...new Set(ids)];
    if (section?.headerId) return [String(section.headerId._id || section.headerId)];
    return [];
};

const ContentManager = () => {
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const [pageType, setPageType] = useState('home');
    const [headerCategories, setHeaderCategories] = useState([]);
    const [selectedHeaderId, setSelectedHeaderId] = useState('');
    const [sections, setSections] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [catSearchTerm, setCatSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState('banners');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        displayType: 'banners',
        title: '',
        status: 'active',
        targetHeaderIds: [],
        // banners
        bannerItems: [{ imageUrl: '', title: '', subtitle: '', linkType: 'none', linkValue: '', isUploading: false }],
        // categories
        maxCategories: 4,
        categoryIds: [],
        categoryRows: 1,
        // subcategories
        subCategoryCategoryIds: [],
        subCategoryIds: [],
        subCategoryRows: 1,
        // products
        productCategoryIds: [],
        productSubCategoryIds: [],
        productIds: [],
        productRows: 1,
        productColumns: 2,
        singleRowScrollable: false,
    });

    const bannerFileInputsRef = useRef([]);

    const selectedHeader = useMemo(
        () => headerCategories.find(h => h._id === selectedHeaderId) || null,
        [headerCategories, selectedHeaderId]
    );

    // Real header chips (exclude any DB "All" row — dedicated All chip targets storefront All tab)
    const publishableHeaders = useMemo(
        () => (headerCategories || []).filter((h) => !isAllNamedHeader(h)),
        [headerCategories]
    );

    const allTabSelected = idInList(formData.targetHeaderIds, ALL_TARGET_ID);

    const loadHeaderCategories = async () => {
        try {
            // Fetch the full tree (all headers and their children)
            const res = await adminApi.getCategoryTree();
            if (res.data.success) {
                const tree = res.data.results || res.data.result || [];
                const headers = Array.isArray(tree) ? tree : [];
                setHeaderCategories(headers);
                
                // If on a header page, ensure we have the correct header selected
                const headerIdFromUrl = searchParams.get('headerId');
                if (pageType === 'header' && headerIdFromUrl) {
                    setSelectedHeaderId(headerIdFromUrl);
                } else if (!selectedHeaderId && headers.length) {
                    const firstReal = headers.find((h) => !isAllNamedHeader(h)) || headers[0];
                    setSelectedHeaderId(firstReal._id);
                }
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load categories', 'error');
        }
    };

    const loadSections = async () => {
        if (pageType === 'header' && !selectedHeaderId) return;
        setIsLoading(true);
        try {
            const params = { pageType };
            if (pageType === 'header') params.headerId = selectedHeaderId;
            const res = await adminApi.getExperienceSections(params);
            if (res.data.success) {
                const list = res.data.results || res.data.result || res.data;
                const safeList = Array.isArray(list) ? list.filter((s) => !isVirtualSection(s)) : [];
                setSections(safeList);
            } else {
                setSections([]);
            }
        } catch (e) {
            console.error(e);
            showToast('Failed to load experience sections', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHeaderCategories();
    }, []);

    // Apply deep-link from Hero & categories per page (?pageType=home | ?pageType=header&headerId=xxx)
    useEffect(() => {
        const fromUrl = searchParams.get('pageType');
        const headerIdFromUrl = searchParams.get('headerId');
        if (fromUrl === 'home') {
            setPageType('home');
        } else if (fromUrl === 'header' && headerIdFromUrl) {
            setPageType('header');
            setSelectedHeaderId(headerIdFromUrl);
        }
    }, [searchParams]);

    useEffect(() => {
        loadSections();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageType, selectedHeaderId]);

    const resetForm = () => {
        setFormData({
            displayType: 'banners',
            title: '',
            status: 'active',
            targetHeaderIds: pageType === 'header' && selectedHeaderId ? [String(selectedHeaderId)] : [],
            bannerItems: [{ imageUrl: '', title: '', subtitle: '', linkType: 'none', linkValue: '', isUploading: false }],
            maxCategories: 4,
            categoryIds: [],
            categoryRows: 1,
            subCategoryCategoryIds: [],
            subCategoryIds: [],
            subCategoryRows: 1,
            productCategoryIds: [],
            productSubCategoryIds: [],
            productIds: [],
            productRows: 1,
            productColumns: 2,
            singleRowScrollable: false,
        });
        setActiveTab('banners');
        setCatSearchTerm('');
    };

    const openCreateModal = () => {
        if (pageType === 'header' && !selectedHeaderId && headerCategories.length === 0) {
            showToast('No header categories available', 'warning');
            return;
        }
        setEditingItem(null);
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (section) => {
        if (isVirtualSection(section)) {
            showToast('Auto-generated sections cannot be edited. Create a product section instead.', 'warning');
            return;
        }
        setEditingItem(section);
        const { displayType, title, status } = section;
        const banners = getBannerItems(section);
        const categoriesCfg = getCategoriesConfig(section);
        const subcategoriesCfg = getSubcategoriesConfig(section);
        const productsCfg = getProductsConfig(section);
        const next = {
            displayType,
            title: title || '',
            status: status || 'active',
            targetHeaderIds: (() => {
                const ids = getSectionHeaderIds(section);
                if (section.showOnAllTab) {
                    return [...new Set([ALL_TARGET_ID, ...ids])];
                }
                return ids;
            })(),
            bannerItems: banners.length
                ? banners.map((b) => ({ ...b, isUploading: false }))
                : [{ imageUrl: '', title: '', subtitle: '', linkType: 'none', linkValue: '', isUploading: false }],
            maxCategories: categoriesCfg.maxItems || 4,
            categoryIds: (categoriesCfg.categoryIds || []).map(String),
            categoryRows: categoriesCfg.rows || 1,
            subCategoryCategoryIds: (subcategoriesCfg.categoryIds || []).map(String),
            subCategoryIds: (subcategoriesCfg.subcategoryIds || []).map(String),
            subCategoryRows: subcategoriesCfg.rows || 1,
            productCategoryIds: (productsCfg.categoryIds || []).map(String),
            productSubCategoryIds: (productsCfg.subcategoryIds || []).map(String),
            productIds: (productsCfg.productIds || []).map(String),
            productRows: productsCfg.rows || 1,
            productColumns: productsCfg.columns || 2,
            singleRowScrollable: !!productsCfg.singleRowScrollable,
        };
        setFormData(next);
        setActiveTab(displayType);
        setIsModalOpen(true);
    };

    const handleDeleteSection = async (id) => {
        if (String(id || '').startsWith('virtual_')) {
            showToast('Auto-generated sections cannot be deleted', 'warning');
            return;
        }
        if (!window.confirm('Are you sure you want to delete this section?')) return;
        try {
            await adminApi.deleteExperienceSection(id);
            showToast('Section deleted', 'success');
            setSections(prev => prev.filter(s => s._id !== id));
        } catch (e) {
            console.error(e);
            showToast('Failed to delete section', 'error');
        }
    };

    const handleSaveSection = async () => {
        const { displayType, title, status } = formData;
        const rawTargets = (formData.targetHeaderIds || []).map(String).filter(Boolean);
        const showOnAllTab = rawTargets.includes(ALL_TARGET_ID);
        const targetHeaderIds = rawTargets.filter((id) => id !== ALL_TARGET_ID);

        if (pageType === 'header' && !targetHeaderIds.length && !showOnAllTab) {
            showToast('Select at least one header category (or All)', 'warning');
            return;
        }

        if (['categories', 'subcategories', 'products'].includes(displayType)) {
            if (!title || !title.trim()) {
                showToast('Please enter a heading for this section', 'warning');
                return;
            }
        }

        const basePayload = {
            pageType,
            displayType,
            title: title?.trim() || '',
            status,
        };

        let config = {};

        if (displayType === 'banners') {
            if ((formData.bannerItems || []).some(b => b.isUploading)) {
                showToast('Please wait for all banner images to finish uploading', 'warning');
                return;
            }
            const items = (formData.bannerItems || []).filter(b => b.imageUrl);
            if (!items.length) {
                showToast('Please add at least one banner image', 'warning');
                return;
            }
            config = {
                banners: {
                    items: items.map(b => ({
                        imageUrl: b.imageUrl,
                        title: b.title || '',
                        subtitle: b.subtitle || '',
                        linkType: b.linkType || 'none',
                        linkValue: b.linkValue || '',
                        status: b.status || 'active',
                    })),
                },
            };
        } else if (displayType === 'categories') {
            if (!formData.categoryIds?.length) {
                showToast('Please select at least one category', 'warning');
                return;
            }
            config = {
                categories: {
                    maxItems: formData.maxCategories,
                    categoryIds: formData.categoryIds,
                    rows: formData.categoryRows || 1,
                },
            };
        } else if (displayType === 'subcategories') {
            if (!formData.subCategoryCategoryIds?.length || !formData.subCategoryIds?.length) {
                showToast('Please select categories and subcategories', 'warning');
                return;
            }
            config = {
                subcategories: {
                    categoryIds: formData.subCategoryCategoryIds,
                    subcategoryIds: formData.subCategoryIds,
                    rows: formData.subCategoryRows || 1,
                },
            };
        } else if (displayType === 'products') {
            config = {
                products: {
                    categoryIds: formData.productCategoryIds,
                    subcategoryIds: formData.productSubCategoryIds,
                    productIds: formData.productIds,
                    rows: formData.singleRowScrollable ? 1 : (formData.productRows || 1),
                    columns: formData.productColumns || 2,
                    singleRowScrollable: !!formData.singleRowScrollable,
                },
            };
        }

        const payload = {
            ...basePayload,
            headerId: pageType === 'header' ? (targetHeaderIds[0] || null) : null,
            headerIds: pageType === 'header' ? targetHeaderIds : [],
            showOnAllTab: pageType === 'header' ? showOnAllTab : false,
            config,
        };

        if (isSaving) return;
        setIsSaving(true);
        try {
            const targetNames = [
                ...(showOnAllTab ? ['All'] : []),
                ...targetHeaderIds
                    .map((id) => publishableHeaders.find((h) => String(h._id) === String(id))?.name)
                    .filter(Boolean),
            ];
            if (editingItem) {
                await adminApi.updateExperienceSection(editingItem._id, payload);
                showToast(
                    pageType === 'header'
                        ? `Section updated for ${targetNames.join(', ') || 'selected headers'}`
                        : 'Section updated for Home Page',
                    'success',
                );
            } else {
                await adminApi.createExperienceSection(payload);
                showToast(
                    pageType === 'header'
                        ? `Section published to ${targetNames.join(', ') || 'selected headers'}`
                        : 'Section published to Home Page',
                    'success',
                );
            }
            setIsModalOpen(false);
            // All-only publishes as Home / All tab section
            if (pageType === 'header' && showOnAllTab && !targetHeaderIds.length) {
                setPageType('home');
            } else {
                await loadSections();
            }
        } catch (e) {
            console.error(e);
            showToast(e.response?.data?.message || 'Failed to save section', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReorder = async (direction, section) => {
        const index = sections.findIndex(s => s._id === section._id);
        if (index < 0) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= sections.length) return;

        const copy = [...sections];
        const [removed] = copy.splice(index, 1);
        copy.splice(newIndex, 0, removed);

        const items = copy.map((s, idx) => ({ id: s._id, order: idx }));
        try {
            await adminApi.reorderExperienceSections(items);
            setSections(copy.map((s, idx) => ({ ...s, order: idx })));
        } catch (e) {
            console.error(e);
            showToast('Failed to reorder sections', 'error');
        }
    };

    const updateBannerItem = (idx, changes) => {
        setFormData(prev => {
            const items = [...prev.bannerItems];
            items[idx] = { ...items[idx], ...changes };
            return { ...prev, bannerItems: items };
        });
    };

    const handleBannerFileChange = async (idx, file) => {
        if (!file) return;
        updateBannerItem(idx, { isUploading: true });
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await adminApi.uploadExperienceBanner(fd);
            const url =
                res.data?.result?.url ||
                res.data?.data?.url ||
                res.data?.url;
            if (!url) {
                throw new Error('Upload failed');
            }
            updateBannerItem(idx, { imageUrl: url, isUploading: false });
            showToast('Banner image uploaded', 'success');
        } catch (e) {
            console.error(e);
            updateBannerItem(idx, { isUploading: false });
            showToast('Failed to upload banner image', 'error');
        }
    };

    const addBannerItem = () => {
        setFormData(prev => ({
            ...prev,
            bannerItems: [
                ...prev.bannerItems,
                { imageUrl: '', title: '', subtitle: '', linkType: 'none', linkValue: '', isUploading: false },
            ],
        }));
    };

    const removeBannerItem = (idx) => {
        setFormData(prev => ({
            ...prev,
            bannerItems: prev.bannerItems.filter((_, i) => i !== idx),
        }));
    };
    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Experience Studio
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </h1>
                    <p className="ds-description">Visual orchestrator for your customer-facing mobile application.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-5 py-3 bg-white text-slate-700 rounded-2xl text-[10px] font-black border border-slate-200 hover:bg-slate-50 transition-all">
                        <HiOutlineEye className="h-4 w-4" />
                        PREVIEW APP
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
                    >
                        <HiOutlinePlus className="h-5 w-5" />
                        ADD COMPONENT
                    </button>
                </div>
            </div>

            <p className="mt-3 text-xs text-slate-500 max-w-2xl">
                <strong>Hero banners and categories</strong> at the top of each page are configured separately in &quot;Hero & categories per page&quot; in the sidebar. The sections below are for the main content area only (banners, categories, products, etc.).
            </p>

            {/* Scope selectors */}
            <div className="flex flex-wrap gap-4 items-center mt-6">
                <div className="flex p-1.5 bg-slate-100 rounded-xl">
                    {[
                        { id: 'home', label: 'Home Page' },
                        { id: 'header', label: 'Header Category Pages' },
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => setPageType(opt.id)}
                            className={cn(
                                "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                                pageType === opt.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                {pageType === 'header' && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Header Category</span>
                        <select
                            value={selectedHeaderId}
                            onChange={(e) => setSelectedHeaderId(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        >
                            <option value="">Select header...</option>
                            {publishableHeaders.map((h) => (
                                <option key={h._id} value={h._id}>{h.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="text-[11px] font-semibold text-slate-500">
                    {pageType === 'home'
                        ? 'Editing sections for Home / All only'
                        : `Editing sections for: ${selectedHeader?.name || 'pick a header'}`}
                </div>
            </div>

            {/* Canvas Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Visual Editor */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Section list */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                                Configured Sections ({sections.length})
                            </h3>
                            {isLoading && (
                                <span className="text-[10px] font-bold text-slate-400">Loading...</span>
                            )}
                        </div>

                        {sections.length === 0 && !isLoading && (
                            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                                <HiOutlineSparkles className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                                    No sections configured yet
                                </p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Click &quot;Add Component&quot; to start designing this page.
                                </p>
                            </div>
                        )}

                        <div className="space-y-4">
                            {sections.map((section, idx) => {
                                const displayMeta = DISPLAY_TYPES.find(d => d.id === section.displayType);
                                const bannerCount = getBannerItems(section).length;
                                const bannerThumb = section.displayType === 'banners' ? getBannerThumbUrl(section) : '';
                                const categoriesCfg = getCategoriesConfig(section);
                                const subcategoriesCfg = getSubcategoriesConfig(section);
                                const productsCfg = getProductsConfig(section);
                                return (
                                    <Card key={section._id} className="p-4 border-none shadow-lg ring-1 ring-slate-100 bg-white rounded-xl group">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden border border-slate-100">
                                                {section.displayType === 'banners' && (
                                                    bannerThumb ? (
                                                        <img
                                                            src={bannerThumb}
                                                            alt={section.title || 'Banner'}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <HiOutlinePhoto className="h-6 w-6" />
                                                    )
                                                )}
                                                {section.displayType === 'categories' && <HiOutlineSparkles className="h-6 w-6" />}
                                                {section.displayType === 'subcategories' && <HiOutlineSparkles className="h-6 w-6" />}
                                                {section.displayType === 'products' && <HiOutlineDevicePhoneMobile className="h-6 w-6" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                        #{idx + 1} • {displayMeta?.label || section.displayType}
                                                    </span>
                                                    <Badge
                                                        variant={section.status === 'active' ? 'success' : 'secondary'}
                                                        className="text-[8px] font-black uppercase"
                                                    >
                                                        {section.status}
                                                    </Badge>
                                                </div>
                                                <h4 className="text-sm font-black text-slate-900 mb-1">
                                                    {section.title || '(No heading)'}
                                                </h4>
                                                <p className="text-[11px] text-slate-500">
                                                    {section.displayType === 'banners' && `${bannerCount} banners configured`}
                                                    {section.displayType === 'categories' && `${(categoriesCfg.categoryIds || []).length} categories • ${categoriesCfg.rows || 1} rows`}
                                                    {section.displayType === 'subcategories' && `${(subcategoriesCfg.subcategoryIds || []).length} subcategories • ${subcategoriesCfg.rows || 1} rows`}
                                                    {section.displayType === 'products' && `${(productsCfg.productIds || []).length || (productsCfg.items || []).length} products • ${productsCfg.rows || 1}x${productsCfg.columns || 2}${productsCfg.singleRowScrollable ? ' • Single row scroll' : ''}`}
                                                </p>
                                                {pageType === 'header' && (
                                                    <p className="text-[10px] text-sky-600 font-semibold mt-1">
                                                        {(() => {
                                                            const ids = getSectionHeaderIds(section);
                                                            const names = [
                                                                ...(section.showOnAllTab ? ['All'] : []),
                                                                ...ids
                                                                    .map((id) => publishableHeaders.find((h) => String(h._id) === String(id))?.name
                                                                        || headerCategories.find((h) => String(h._id) === String(id))?.name)
                                                                    .filter(Boolean),
                                                            ];
                                                            return names.length
                                                                ? `Shows on: ${names.join(', ')}`
                                                                : 'No header targets';
                                                        })()}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-2 items-end">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        disabled={idx === 0}
                                                        onClick={() => handleReorder('up', section)}
                                                        className={cn(
                                                            "p-1.5 rounded-xl border text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all",
                                                            idx === 0 && "opacity-30 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <HiOutlineArrowUpCircle className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        disabled={idx === sections.length - 1}
                                                        onClick={() => handleReorder('down', section)}
                                                        className={cn(
                                                            "p-1.5 rounded-xl border text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all",
                                                            idx === sections.length - 1 && "opacity-30 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <HiOutlineArrowDownCircle className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openEditModal(section)}
                                                        className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                    >
                                                        <HiOutlinePencilSquare className="h-5 w-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSection(section._id)}
                                                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                    >
                                                        <HiOutlineTrash className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Mobile Device Mockup — only configured sections, no fake fallback content */}
                <div className="lg:col-span-4 sticky top-4">
                    <div className="relative mx-auto border-[8px] border-slate-900 rounded-[3rem] h-[650px] w-[320px] shadow-2xl overflow-hidden bg-white ring-8 ring-slate-100">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-red-600 rounded-b-2xl z-20" />

                        <div className="h-full overflow-y-auto pt-8 pb-20 no-scrollbar">
                            <div className="p-4 flex items-center justify-between mb-2">
                                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200" />
                                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {pageType === 'home' ? 'Home' : (selectedHeader?.name || 'Header')}
                                </div>
                                <div className="h-8 w-8" />
                            </div>

                            {sections.length === 0 ? (
                                <div className="px-6 py-16 text-center">
                                    <HiOutlineSparkles className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        No sections yet
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-2">
                                        Add a component to preview it here.
                                    </p>
                                </div>
                            ) : (
                                <div className="px-4 space-y-5">
                                    {sections.map((section) => {
                                        if (section.displayType === 'banners') {
                                            const banners = getBannerItems(section).filter((b) => b.imageUrl || b.url);
                                            if (!banners.length) return null;
                                            const thumb = resolveQuickImageUrl(banners[0].imageUrl || banners[0].url);
                                            return (
                                                <div key={section._id} className="space-y-2">
                                                    {section.title ? (
                                                        <p className="text-[11px] font-black text-slate-800">{section.title}</p>
                                                    ) : null}
                                                    <div className="h-36 rounded-xl overflow-hidden bg-slate-100 relative">
                                                        {thumb ? (
                                                            <img
                                                                src={thumb}
                                                                alt=""
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="h-full w-full flex items-center justify-center text-slate-300">
                                                                <HiOutlinePhoto className="h-8 w-8" />
                                                            </div>
                                                        )}
                                                        {(banners[0].title || section.title) && (
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent flex items-end p-3">
                                                                <span className="text-white text-xs font-black">
                                                                    {banners[0].title || section.title}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {banners.length > 1 && (
                                                        <p className="text-[10px] text-slate-400 font-semibold">
                                                            +{banners.length - 1} more banner{banners.length > 2 ? 's' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        }

                                        if (section.displayType === 'categories') {
                                            const cfg = getCategoriesConfig(section);
                                            const count = (cfg.items || cfg.categoryIds || []).length;
                                            return (
                                                <div key={section._id} className="space-y-2">
                                                    <p className="text-[11px] font-black text-slate-800">
                                                        {section.title || 'Categories'}
                                                    </p>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {Array.from({ length: Math.min(count || 0, 8) }).map((_, i) => (
                                                            <div key={i} className="space-y-1">
                                                                <div className="aspect-square rounded-xl bg-slate-100 border border-slate-100" />
                                                                <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-semibold">{count} categories</p>
                                                </div>
                                            );
                                        }

                                        if (section.displayType === 'subcategories') {
                                            const cfg = getSubcategoriesConfig(section);
                                            const count = (cfg.items || cfg.subcategoryIds || []).length;
                                            return (
                                                <div key={section._id} className="space-y-2">
                                                    <p className="text-[11px] font-black text-slate-800">
                                                        {section.title || 'Subcategories'}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 font-semibold">{count} subcategories</p>
                                                </div>
                                            );
                                        }

                                        if (section.displayType === 'products') {
                                            const cfg = getProductsConfig(section);
                                            const count = (cfg.items || cfg.productIds || []).length;
                                            return (
                                                <div key={section._id} className="space-y-2">
                                                    <p className="text-[11px] font-black text-slate-800">
                                                        {section.title || 'Products'}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Array.from({ length: Math.min(count || 2, 4) }).map((_, i) => (
                                                            <div key={i} className="rounded-xl border border-slate-100 p-2 bg-slate-50">
                                                                <div className="aspect-square rounded-lg bg-white mb-2" />
                                                                <div className="h-1.5 w-2/3 bg-slate-200 rounded-full mb-1" />
                                                                <div className="h-1.5 w-1/3 bg-slate-200 rounded-full" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-semibold">
                                                        {count || 'Filtered'} products
                                                        {cfg.singleRowScrollable ? ' · scroll row' : ` · ${cfg.rows || 1}x${cfg.columns || 2}`}
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return null;
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-0 inset-x-0 h-14 bg-white/90 backdrop-blur-md border-t border-slate-100 flex items-center justify-around px-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-5 w-5 rounded-md bg-slate-100" />
                            ))}
                        </div>
                    </div>
                    <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6">
                        Live preview (configured only)
                    </p>
                </div>
            </div>

            {/* Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => !isSaving && setIsModalOpen(false)}
                title={editingItem ? "Edit Section" : "Create Section"}
            >
                <div className="space-y-6">
                    <div className={cn(
                        "rounded-2xl border px-4 py-3",
                        pageType === 'home'
                            ? "bg-emerald-50 border-emerald-100"
                            : "bg-sky-50 border-sky-100"
                    )}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                            Publishing target
                        </p>
                        {pageType === 'home' ? (
                            <>
                                <p className="text-sm font-bold text-slate-900">Home Page only</p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    This section will show only on the main Home / All tab. It will not appear inside header categories.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-slate-900">
                                    Header categories
                                    {formData.targetHeaderIds?.length
                                        ? ` (${formData.targetHeaderIds.length} selected)`
                                        : ''}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1 mb-3">
                                    Select All and/or specific headers. All shows on the customer All tab.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                targetHeaderIds: toggleIdInList(prev.targetHeaderIds, ALL_TARGET_ID),
                                            }))
                                        }
                                        className={cn(
                                            "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                                            allTabSelected
                                                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                                        )}
                                    >
                                        All
                                    </button>
                                    {publishableHeaders.map((h) => {
                                        const selected = idInList(formData.targetHeaderIds, h._id);
                                        return (
                                            <button
                                                key={h._id}
                                                type="button"
                                                onClick={() =>
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        targetHeaderIds: toggleIdInList(prev.targetHeaderIds, h._id),
                                                    }))
                                                }
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                                                    selected
                                                        ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                                                        : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                                                )}
                                            >
                                                {h.name}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!formData.targetHeaderIds?.length && (
                                    <p className="text-[11px] text-rose-500 font-semibold mt-2">
                                        Select at least one header category (or All)
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Display type & status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display Type</label>
                            <select
                                value={formData.displayType}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFormData(prev => ({ ...prev, displayType: value }));
                                    setActiveTab(value);
                                }}
                                className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-black outline-none"
                            >
                                {DISPLAY_TYPES.map(dt => (
                                    <option key={dt.id} value={dt.id}>{dt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-black outline-none"
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Heading - required for category/subcategory/product */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Section Heading {['categories', 'subcategories', 'products'].includes(formData.displayType) && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold border-none outline-none ring-1 ring-transparent focus:ring-primary/20 transition-all"
                            placeholder="E.g. Grocery Essentials"
                        />
                    </div>

                    {/* Type-specific config */}
                    {formData.displayType === 'banners' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Banner Items
                                </span>
                                <button
                                    type="button"
                                    onClick={addBannerItem}
                                    className="flex items-center gap-1 text-[10px] font-black text-primary"
                                >
                                    <HiOutlinePlus className="h-3 w-3" />
                                    Add banner
                                </button>
                            </div>
                            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                                {formData.bannerItems.map((item, idx) => (
                                    <Card key={idx} className="p-3 bg-white border-slate-100">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center">
                                                        {item.imageUrl ? (
                                                            <img
                                                                src={resolveQuickImageUrl(item.imageUrl) || item.imageUrl}
                                                                alt={item.title || `Banner ${idx + 1}`}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <HiOutlinePhoto className="h-6 w-6 text-slate-300" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <input
                                                            ref={(el) => {
                                                                bannerFileInputsRef.current[idx] = el;
                                                            }}
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(e) =>
                                                                handleBannerFileChange(idx, e.target.files?.[0])
                                                            }
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                bannerFileInputsRef.current[idx]?.click()
                                                            }
                                                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                                                        >
                                                            {item.imageUrl ? 'Change image' : 'Choose image file'}
                                                        </button>
                                                        <p className="text-[10px] text-slate-400">
                                                            {item.isUploading
                                                                ? 'Uploading...'
                                                                : item.imageUrl
                                                                ? 'Image uploaded'
                                                                : 'PNG, JPG up to 5MB'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <input
                                                    value={item.title || ''}
                                                    onChange={(e) => updateBannerItem(idx, { title: e.target.value })}
                                                    className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
                                                    placeholder="Banner title (optional)"
                                                />
                                                <input
                                                    value={item.subtitle || ''}
                                                    onChange={(e) => updateBannerItem(idx, { subtitle: e.target.value })}
                                                    className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
                                                    placeholder="Subtitle (optional)"
                                                />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        value={item.linkType || 'none'}
                                                        onChange={(e) => updateBannerItem(idx, { linkType: e.target.value })}
                                                        className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black outline-none"
                                                    >
                                                        <option value="none">No link</option>
                                                        <option value="header">Header</option>
                                                        <option value="category">Category</option>
                                                        <option value="subcategory">Subcategory</option>
                                                        <option value="product">Product</option>
                                                        <option value="url">External URL</option>
                                                    </select>
                                                    <input
                                                        value={item.linkValue || ''}
                                                        onChange={(e) => updateBannerItem(idx, { linkValue: e.target.value })}
                                                        className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
                                                        placeholder={item.linkType === 'url' ? "https://..." : "Slug / ID"}
                                                    />
                                                </div>
                                            </div>
                                            {formData.bannerItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeBannerItem(idx)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <HiOutlineXMark className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {formData.displayType === 'categories' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Number of categories
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formData.maxCategories}
                                        onChange={(e) => setFormData(prev => ({ ...prev, maxCategories: Number(e.target.value) || 1 }))}
                                        className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Rows (4 columns on mobile)
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formData.categoryRows}
                                        onChange={(e) => setFormData(prev => ({ ...prev, categoryRows: Number(e.target.value) || 1 }))}
                                        className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none"
                                    />
                                </div>
                            </div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Categories {pageType === 'home' ? '(Across all headers)' : `(Under ${selectedHeader?.name})`}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search categories..."
                                            value={catSearchTerm}
                                            onChange={(e) => setCatSearchTerm(e.target.value)}
                                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary/20 w-40"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {headerCategories
                                        .filter(h => pageType === 'home' || h._id === selectedHeaderId)
                                        .map(header => {
                                            const relevantChildren = (header.children || []).filter(c => 
                                                !catSearchTerm || c.name.toLowerCase().includes(catSearchTerm.toLowerCase())
                                            );
                                            
                                            if (!relevantChildren.length && catSearchTerm) return null;

                                            return (
                                                <div key={header._id} className="space-y-2">
                                                    {pageType === 'home' && (
                                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
                                                            {header.name}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        {relevantChildren.map(c => {
                                                            const isSelected = idInList(formData.categoryIds, c._id);
                                                            return (
                                                                <button
                                                                    key={c._id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            categoryIds: toggleIdInList(prev.categoryIds, c._id),
                                                                        }))
                                                                    }
                                                                    className={cn(
                                                                        "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                                                                        isSelected
                                                                            ? "bg-primary text-white border-primary shadow-sm"
                                                                            : "bg-white text-slate-600 border-slate-200 hover:border-primary/30 hover:bg-slate-50"
                                                                    )}
                                                                >
                                                                    {c.name}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    These categories will be rendered in 4-column grids per row.
                                </p>
                        </div>
                    )}

                    {formData.displayType === 'subcategories' && (
                        <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Parent categories
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={catSearchTerm}
                                            onChange={(e) => setCatSearchTerm(e.target.value)}
                                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary/20 w-32"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {headerCategories
                                        .filter(h => pageType === 'home' || h._id === selectedHeaderId)
                                        .map(header => {
                                            const relevantChildren = (header.children || []).filter(c => 
                                                !catSearchTerm || c.name.toLowerCase().includes(catSearchTerm.toLowerCase()) || 
                                                (c.children || []).some(sc => sc.name.toLowerCase().includes(catSearchTerm.toLowerCase()))
                                            );

                                            if (!relevantChildren.length && catSearchTerm) return null;

                                            return (
                                                <div key={header._id} className="space-y-3">
                                                    {pageType === 'home' && (
                                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">
                                                            {header.name}
                                                        </div>
                                                    )}
                                                    <div className="space-y-4 pl-1">
                                                        {relevantChildren.map(c => {
                                                            const isSelected = idInList(formData.subCategoryCategoryIds, c._id);
                                                            return (
                                                                <div key={c._id} className="space-y-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setFormData(prev => {
                                                                                const alreadySelected = idInList(prev.subCategoryCategoryIds, c._id);
                                                                                let nextCategoryIds;
                                                                                let nextSubCategoryIds = prev.subCategoryIds;

                                                                                if (alreadySelected) {
                                                                                    nextCategoryIds = prev.subCategoryCategoryIds.filter(id => !idEquals(id, c._id));
                                                                                    const childIds = (c.children || []).map(child => String(child._id));
                                                                                    nextSubCategoryIds = prev.subCategoryIds.filter(
                                                                                        id => !childIds.includes(String(id))
                                                                                    );
                                                                                } else {
                                                                                    nextCategoryIds = [...prev.subCategoryCategoryIds, c._id];
                                                                                }

                                                                                return {
                                                                                    ...prev,
                                                                                    subCategoryCategoryIds: nextCategoryIds,
                                                                                    subCategoryIds: nextSubCategoryIds,
                                                                                };
                                                                            })
                                                                        }
                                                                        className={cn(
                                                                            "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                                                                            isSelected
                                                                                ? "bg-primary text-white border-primary shadow-sm"
                                                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white"
                                                                        )}
                                                                    >
                                                                        {c.name}
                                                                    </button>

                                                                    {isSelected && (
                                                                        <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-slate-100 py-1">
                                                                            {(c.children || [])
                                                                                .filter(s => !catSearchTerm || s.name.toLowerCase().includes(catSearchTerm.toLowerCase()))
                                                                                .map(s => {
                                                                                const isSubSelected = idInList(formData.subCategoryIds, s._id);
                                                                                return (
                                                                                    <button
                                                                                        key={s._id}
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            setFormData(prev => ({
                                                                                                ...prev,
                                                                                                subCategoryIds: toggleIdInList(prev.subCategoryIds, s._id),
                                                                                            }))
                                                                                        }
                                                                                        className={cn(
                                                                                            "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                                                                                            isSubSelected
                                                                                                ? "bg-primary/10 text-primary border-primary/20"
                                                                                                : "bg-white text-slate-500 border-slate-200 hover:border-primary/20"
                                                                                        )}
                                                                                    >
                                                                                        {s.name}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    Displayed in 4-column grids per row.
                                </p>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Rows
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={formData.subCategoryRows}
                                    onChange={(e) => setFormData(prev => ({ ...prev, subCategoryRows: Number(e.target.value) || 1 }))}
                                    className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {formData.displayType === 'products' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Rows
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        disabled={formData.singleRowScrollable}
                                        value={formData.productRows}
                                        onChange={(e) => setFormData(prev => ({ ...prev, productRows: Number(e.target.value) || 1 }))}
                                        className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Columns
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={formData.productColumns}
                                        onChange={(e) => setFormData(prev => ({ ...prev, productColumns: Number(e.target.value) || 1 }))}
                                        className="w-full p-3 bg-slate-50 rounded-2xl text-xs font-bold border-none outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="singleRowScrollable"
                                    type="checkbox"
                                    checked={formData.singleRowScrollable}
                                    onChange={(e) => setFormData(prev => ({ ...prev, singleRowScrollable: e.target.checked }))}
                                />
                                <label htmlFor="singleRowScrollable" className="text-[11px] font-bold text-slate-600">
                                    Show products in a single horizontally scrollable row
                                </label>
                            </div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Filter by categories / subcategories (optional)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search..."
                                            value={catSearchTerm}
                                            onChange={(e) => setCatSearchTerm(e.target.value)}
                                            className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary/20 w-32"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar border border-slate-100 rounded-2xl p-4 bg-slate-50/30">
                                    {headerCategories
                                        .filter(h => pageType === 'home' || h._id === selectedHeaderId)
                                        .map(header => {
                                            const relevantChildren = (header.children || []).filter(c => 
                                                !catSearchTerm || c.name.toLowerCase().includes(catSearchTerm.toLowerCase()) || 
                                                (c.children || []).some(sc => sc.name.toLowerCase().includes(catSearchTerm.toLowerCase()))
                                            );

                                            if (!relevantChildren.length && catSearchTerm) return null;

                                            return (
                                                <div key={header._id} className="space-y-3">
                                                    {pageType === 'home' && (
                                                        <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                                                            {header.name}
                                                        </div>
                                                    )}
                                                    <div className="grid grid-cols-1 gap-4">
                                                        {relevantChildren.map(c => {
                                                            const isSelected = idInList(formData.productCategoryIds, c._id);
                                                            return (
                                                                <div key={c._id} className="space-y-2">
                                                                    <button
                                                                        key={c._id}
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setFormData(prev => {
                                                                                const alreadySelected = idInList(prev.productCategoryIds, c._id);
                                                                                let nextCategoryIds;
                                                                                let nextSubCategoryIds = prev.productSubCategoryIds;

                                                                                if (alreadySelected) {
                                                                                    nextCategoryIds = prev.productCategoryIds.filter(id => !idEquals(id, c._id));
                                                                                    const childIds = (c.children || []).map(child => String(child._id));
                                                                                    nextSubCategoryIds = prev.productSubCategoryIds.filter(
                                                                                        id => !childIds.includes(String(id))
                                                                                    );
                                                                                } else {
                                                                                    nextCategoryIds = [...prev.productCategoryIds, c._id];
                                                                                }

                                                                                return {
                                                                                    ...prev,
                                                                                    productCategoryIds: nextCategoryIds,
                                                                                    productSubCategoryIds: nextSubCategoryIds,
                                                                                };
                                                                            })
                                                                        }
                                                                        className={cn(
                                                                            "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                                                                            isSelected
                                                                                ? "bg-primary text-white border-primary shadow-sm"
                                                                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                                        )}
                                                                    >
                                                                        {c.name}
                                                                    </button>
                                                                    
                                                                    {isSelected && (
                                                                        <div className="flex flex-wrap gap-2 pl-4 border-l-2 border-slate-100 py-1">
                                                                            {(c.children || [])
                                                                                .filter(s => !catSearchTerm || s.name.toLowerCase().includes(catSearchTerm.toLowerCase()))
                                                                                .map(s => {
                                                                                    const isSubSelected = idInList(formData.productSubCategoryIds, s._id);
                                                                                    return (
                                                                                        <button
                                                                                            key={s._id}
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                setFormData(prev => ({
                                                                                                    ...prev,
                                                                                                    productSubCategoryIds: toggleIdInList(prev.productSubCategoryIds, s._id),
                                                                                                }))
                                                                                            }
                                                                                            className={cn(
                                                                                                "px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all",
                                                                                                isSubSelected
                                                                                                    ? "bg-primary/10 text-primary border-primary/20"
                                                                                                    : "bg-white text-slate-500 border-slate-200 hover:border-primary/20"
                                                                                            )}
                                                                                        >
                                                                                            {s.name}
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                                <p className="text-[10px] text-slate-400">
                                    You can later extend this to select specific products.
                                </p>
                        </div>
                    )}
                    <button
                        onClick={handleSaveSection}
                        disabled={isSaving || (pageType === 'header' && !(formData.targetHeaderIds || []).length)}
                        className="w-full py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:hover:scale-100"
                    >
                        {isSaving
                            ? 'SAVING...'
                            : editingItem
                              ? 'SAVE CHANGES'
                              : 'PUBLISH SECTION'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default ContentManager;
