import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@shared/components/ui/Card';
import Button from '@shared/components/ui/Button';
import Badge from '@shared/components/ui/Badge';
import Input from '@shared/components/ui/Input';
import Pagination from '@shared/components/ui/Pagination';
import {
    HiOutlineCube,
    HiOutlineExclamationTriangle,
    HiOutlineArchiveBoxXMark,
    HiOutlineArrowsUpDown,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlinePlus,
    HiOutlineMinus,
    HiOutlineArrowPath,
    HiOutlineClipboardDocumentList,
    HiOutlineXMark,
    HiOutlineCheck,
    HiOutlineCalendarDays,
    HiOutlineChevronDown
} from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BlurFade } from '@/components/ui/blur-fade';
import { MagicCard } from '@/components/ui/magic-card';
import { sellerApi } from '../services/sellerApi';
import { toast } from 'sonner';

const StockManagement = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('inventory'); // 'inventory' or 'history'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [adjustType, setAdjustType] = useState('Restock');
    const [adjustValue, setAdjustValue] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedProducts, setExpandedProducts] = useState(new Set());

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const toggleExpand = (productId) => {
        setExpandedProducts((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    const fetchInventory = async (silent = false, stockStatus) => {
        if (!silent) setIsLoading(true);
        try {
            const params = {};
            if (stockStatus === 'in') params.stockStatus = 'in';
            if (stockStatus === 'out') params.stockStatus = 'out';

            const res = await sellerApi.getProducts(params);
            if (res.data.success) {
                // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
                const payload = res.data.result || {};
                const rawProducts = Array.isArray(payload.items)
                    ? payload.items
                    : (res.data.results || []);

                const safeProducts = Array.isArray(rawProducts) ? rawProducts : [];

                // Group by product: one consolidated row per product with variant details.
                const items = safeProducts.map((p) => {
                    const variants = Array.isArray(p.variants) && p.variants.length > 0
                        ? p.variants
                        : [{
                            _id: null,
                            name: 'Default',
                            costPrice: p.costPrice || 0,
                            price: p.price,
                            salePrice: p.salePrice,
                            stock: p.stock,
                            sku: p.sku,
                            images: p.mainImage ? [p.mainImage] : []
                        }];

                    const threshold = p.lowStockAlert || 5;
                    const totalStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);

                    const prices = variants.map((v) => {
                        const sale = Number(v.salePrice);
                        const regular = Number(v.price) || 0;
                        return sale > 0 ? sale : regular;
                    }).filter((pr) => pr > 0);

                    const minPrice = prices.length ? Math.min(...prices) : (Number(p.salePrice) > 0 ? Number(p.salePrice) : Number(p.price) || 0);
                    const maxPrice = prices.length ? Math.max(...prices) : minPrice;

                    // Formula: Stock Valuation = Available Stock × Cost Price
                    // Fallback to salePrice || price if costPrice is not yet set
                    const valuation = variants.reduce((acc, v) => {
                        const cost = Number(v.costPrice) > 0
                            ? Number(v.costPrice)
                            : (Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0);
                        return acc + ((Number(v.stock) || 0) * cost);
                    }, 0);

                    const status = totalStock === 0
                        ? 'Out of Stock'
                        : (totalStock <= threshold ? 'Low Stock' : 'In Stock');

                    return {
                        id: p._id,
                        productId: p._id,
                        name: p.name,
                        brand: p.brand,
                        sku: p.sku || variants[0]?.sku || 'N/A',
                        mainImage: p.mainImage || p.image || variants[0]?.images?.[0] || '',
                        variants,
                        totalStock,
                        threshold,
                        minPrice,
                        maxPrice,
                        valuation,
                        status,
                        hasMultipleVariants: variants.length > 1,
                    };
                });

                setInventory(items);
            }
        } catch (error) {
            toast.error("Failed to load inventory");
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const fetchHistory = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const res = await sellerApi.getStockHistory();
            if (res.data.success) {
                setHistory(res.data.result || []);
            }
        } catch (error) {
            toast.error("Failed to load stock history");
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeView === 'inventory') {
            let stockStatusParam;
            if (filterStatus === 'In Stock') stockStatusParam = 'in';
            else if (filterStatus === 'Out of Stock') stockStatusParam = 'out';
            else stockStatusParam = undefined; // All / Low Stock -> no backend filter
            fetchInventory(false, stockStatusParam);
        } else {
            fetchHistory();
        }
    }, [activeView, filterStatus]);

    const stats = useMemo(() => [
        {
            label: 'Total Inventory',
            value: inventory.reduce((acc, item) => acc + item.stock, 0),
            icon: HiOutlineCube,
            color: 'text-white',
            bg: 'bg-indigo-600 shadow-md shadow-indigo-500/30',
            cardBg: 'bg-indigo-50/90 border border-indigo-200/90 shadow-xs shadow-indigo-500/10',
            gradientColor: '#c7d2fe',
            status: 'All'
        },
        {
            label: 'Low Stock Items',
            value: inventory.filter(i => i.stock > 0 && i.stock <= i.threshold).length,
            icon: HiOutlineExclamationTriangle,
            color: 'text-white',
            bg: 'bg-amber-600 shadow-md shadow-amber-500/30',
            cardBg: 'bg-amber-50/90 border border-amber-200/90 shadow-xs shadow-amber-500/10',
            gradientColor: '#fde68a',
            status: 'Low Stock'
        },
        {
            label: 'Out of Stock',
            value: inventory.filter(i => i.stock === 0).length,
            icon: HiOutlineArchiveBoxXMark,
            color: 'text-white',
            bg: 'bg-rose-600 shadow-md shadow-rose-500/30',
            cardBg: 'bg-rose-50/90 border border-rose-200/90 shadow-xs shadow-rose-500/10',
            gradientColor: '#fecdd3',
            status: 'Out of Stock'
        },
        {
            label: 'Stock Valuation',
            value: `₹${inventory.reduce((acc, item) => acc + (item.stock * item.price), 0).toLocaleString()}`,
            icon: HiOutlineArrowsUpDown,
            color: 'text-white',
            bg: 'bg-emerald-600 shadow-md shadow-emerald-500/30',
            cardBg: 'bg-emerald-50/90 border border-emerald-200/90 shadow-xs shadow-emerald-500/10',
            gradientColor: '#a7f3d0',
        { label: 'Total Inventory', value: inventory.reduce((acc, item) => acc + item.totalStock, 0), icon: HiOutlineCube, color: 'text-primary', bg: 'bg-[#fef4f4]', status: 'All' },
        { label: 'Low Stock Items', value: inventory.filter(i => i.totalStock > 0 && i.totalStock <= i.threshold).length, icon: HiOutlineExclamationTriangle, color: 'text-amber-600', bg: 'bg-amber-50', status: 'Low Stock' },
        { label: 'Out of Stock', value: inventory.filter(i => i.totalStock === 0).length, icon: HiOutlineArchiveBoxXMark, color: 'text-rose-600', bg: 'bg-rose-50', status: 'Out of Stock' },
        {
            label: 'Stock Valuation',
            subLabel: 'Σ (Stock × Cost Price)',
            value: `₹${inventory.reduce((acc, item) => acc + item.valuation, 0).toLocaleString('en-IN')}`,
            icon: HiOutlineArrowsUpDown,
            color: 'text-primary',
            bg: 'bg-[#fef4f4]',
            status: 'In Stock'
        }
    ], [inventory]);

    const filteredInventory = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return inventory.filter(item => {
            const matchesSearch =
                item.name.toLowerCase().includes(term) ||
                (item.sku || '').toString().toLowerCase().includes(term) ||
                item.variants.some(v => (v.name || '').toLowerCase().includes(term) || (v.sku || '').toLowerCase().includes(term));
            const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [inventory, searchTerm, filterStatus]);

    const handleFullAdjustment = async () => {
        const value = parseInt(adjustValue);
        if (isNaN(value) || value <= 0) {
            toast.error("Please enter a valid quantity greater than 0");
            return;
        }

        const currentVariant = selectedItem?.variants?.find(
            (v) => (v._id || 'default') === selectedVariantId
        ) || selectedItem?.variants?.[0];

        if (!currentVariant) {
            toast.error("Please select a variant to adjust");
            return;
        }

        const currentStock = Number(currentVariant.stock) || 0;
        if (adjustType === 'Remove' && value > currentStock) {
            toast.error(`Cannot remove more than available stock (${currentStock} units in "${currentVariant.name}")`);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await sellerApi.adjustStock({
                productId: selectedItem.productId,
                variantId: currentVariant._id || undefined,
                type: adjustType === 'Restock' ? 'Restock' : 'Remove',
                quantity: adjustType === 'Restock' ? value : -value,
                note: adjustNote
            });

            if (res.data.success) {
                toast.success("Stock adjusted successfully");
                setIsAdjustModalOpen(false);
                await fetchInventory(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to adjust stock");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openAdjustModal = (product, variant = null) => {
        setSelectedItem(product);
        const targetVariant = variant || product.variants?.[0] || null;
        setSelectedVariantId(targetVariant ? (targetVariant._id || 'default') : 'default');
        setAdjustType('Restock');
        setAdjustValue('');
        setAdjustNote('');
        setIsAdjustModalOpen(true);
    };

    if (isLoading && inventory.length === 0 && history.length === 0) {
        return <div className="flex items-center justify-center h-screen font-black text-slate-600 font-['Roboto',sans-serif]">LOADING STOCK DATA...</div>;
    }

    return (
        <div className="space-y-6 pb-16 font-['Roboto',sans-serif]">
            <BlurFade delay={0.1}>
                {/* Header */}
                <div className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
                            Stock Management
                            <Badge variant="warning" className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase bg-amber-100 text-amber-700">
                                Inventory Control
                            </Badge>
                        </h1>
                        <p className="text-slate-600 text-xs sm:text-sm mt-1 font-medium">
                            Monitor stock levels, manage restocks, and track movements.
                        </p>
                    </div>
                </div>
            </BlurFade>

            {activeView === 'inventory' ? (
                <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <BlurFade key={i} delay={0.1 + (i * 0.05)}>
                                <div
                                    onClick={() => setFilterStatus(stat.status)}
                                    className={cn(
                                        "cursor-pointer rounded-2xl transition-all duration-300",
                                        filterStatus === stat.status
                                            ? "ring-2 ring-[#E71D28] shadow-lg scale-[1.02]"
                                            : "hover:shadow-md hover:-translate-y-0.5"
                                    )}>
                                    <MagicCard
                                        className={cn("border-none shadow-xs p-0 overflow-hidden group rounded-2xl", stat.cardBg)}
                                        gradientColor={stat.gradientColor}
                                    >
                                        <div className="flex items-center gap-2 md:gap-3 p-2.5 sm:p-3 md:p-4 relative z-10">
                                            <div className={cn("h-8 w-8 sm:h-10 sm:w-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300 shadow-xs", stat.bg, stat.color)}>
                                                <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[9px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest truncate">{stat.label}</p>
                                                <h4 className="text-sm sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">{stat.value}</h4>
                                            <div>
                                                <p className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest">{stat.label}</p>
                                                <h4 className="text-xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
                                                {stat.subLabel && (
                                                    <p className="text-[9px] text-slate-400 font-semibold">{stat.subLabel}</p>
                                                )}
                                            </div>
                                        </div>
                                    </MagicCard>
                                </div>
                            </BlurFade>
                        ))}
                    </div>

                    <BlurFade delay={0.3}>
                        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-3xl">
                            {/* Toolbox */}
                            <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/30">
                                <div className="flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center w-full">
                                    <div className="relative w-full md:w-72">
                                        <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            placeholder="Search product or SKU..."
                                            className="pl-10 pr-4 py-2.5 rounded-xl border-none ring-1 ring-slate-200 bg-white focus:ring-2 focus:ring-[#E71D28]/20 transition-all text-xs font-semibold"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto scrollbar-none justify-between sm:justify-start">
                                        {['All', 'In Stock', 'Out of Stock'].map((status) => (
                                            <button
                                                key={status}
                                                onClick={() => {
                                                    setFilterStatus(status);
                                                    setPage(1);
                                                }}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-extrabold transition-all whitespace-nowrap",
                                                    filterStatus === status
                                                        ? "bg-white text-slate-900 shadow-xs"
                                                        : "text-slate-600 hover:text-slate-900"
                                                )}
                                            >
                                                {status}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center w-full md:w-auto">
                                    <Button
                                        onClick={() => navigate('/seller/products/add')}
                                        className="w-full md:w-auto rounded-xl px-4 py-2 text-[10px] font-extrabold shadow-md shadow-rose-500/20 bg-[#E71D28] hover:bg-[#c41922] text-white"
                                    >
                                        <HiOutlinePlus className="h-3.5 w-3.5 mr-1.5" />
                                        ADD NEW PRODUCT
                                    </Button>
                                </div>
                            </div>

                            {/* Mobile Inventory Cards View */}
                            <div className="block md:hidden divide-y divide-slate-100">
                                {filteredInventory.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-slate-500 text-xs font-bold uppercase tracking-wider">
                                        No products found for this filter.
                                    </div>
                                ) : (
                                    filteredInventory
                                        .slice((page - 1) * pageSize, page * pageSize)
                                        .map((item) => (
                                            <div key={item.id} className="p-3.5 space-y-2.5 bg-white">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200/60 shrink-0 overflow-hidden flex items-center justify-center">
                                                        {item.mainImage ? (
                                                            <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <HiOutlineCube className="h-5 w-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-xs font-black text-slate-900 leading-snug truncate">
                                                            {item.name}
                                                            {item.hasMultipleVariants && (
                                                                <span className="text-[#E71D28] font-bold"> — {item.variantName}</span>
                                                            )}
                                                        </h4>
                                                        <p className="text-[10px] font-mono text-slate-500 font-bold uppercase mt-0.5">
                                                            SKU: {item.sku || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        variant={item.status === 'In Stock' ? 'success' : 'destructive'}
                                                        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0"
                                                    >
                                                        {item.status}
                                                    </Badge>
                                                </div>

                                                <div className="flex items-center justify-between pt-1.5 text-xs border-t border-slate-100">
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Stock Units</span>
                                                        <span className={cn("font-black text-xs", item.stock <= item.threshold ? "text-rose-600" : "text-slate-900")}>
                                                            {item.stock} units
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Price</span>
                                                        <span className="font-black text-xs text-slate-900">₹{item.price}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => openAdjustModal(item)}
                                                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-extrabold transition-colors shadow-2xs"
                                                    >
                                                        Adjust Stock
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>

                            {/* Desktop Stock Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Product Information</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Inventory Capacity</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Stock Health</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Price</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Stock Valuation</th>
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredInventory.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-6 py-10 text-center text-slate-600 text-xs font-black tracking-widest uppercase"
                                                >
                                                    No products found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredInventory
                                                    .slice((page - 1) * pageSize, page * pageSize)
                                                    .map((item) => {
                                                        const isExpanded = expandedProducts.has(item.productId);
                                                        return (
                                                            <React.Fragment key={item.id}>
                                                                <motion.tr
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    className="group hover:bg-slate-50/80 transition-all cursor-default"
                                                                >
                                                                    <td className="px-6 py-5">
                                                                        <div className="flex items-center gap-3">
                                                                            {item.hasMultipleVariants && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => toggleExpand(item.productId)}
                                                                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all shrink-0"
                                                                                    title={isExpanded ? "Collapse variants" : "Expand variants"}
                                                                                >
                                                                                    <HiOutlineChevronDown
                                                                                        className={cn(
                                                                                            "h-4 w-4 transition-transform duration-200",
                                                                                            isExpanded && "rotate-180 text-primary"
                                                                                        )}
                                                                                    />
                                                                                </button>
                                                                            )}
                                                                            <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:scale-105 transition-transform overflow-hidden shrink-0 border border-slate-200/60">
                                                                                {item.mainImage ? (
                                                                                    <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                                                ) : (
                                                                                    <HiOutlineCube className="h-6 w-6 text-slate-400" />
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">
                                                                                        {item.name}
                                                                                    </h4>
                                                                                    {item.hasMultipleVariants && (
                                                                                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-primary text-[10px] font-bold border border-rose-100">
                                                                                            {item.variants.length} Variants
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                                                    Product Code: {item.sku || 'N/A'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="flex flex-col">
                                                                                <span
                                                                                    className={cn(
                                                                                        "text-sm font-black",
                                                                                        item.totalStock <= item.threshold ? "text-rose-600" : "text-slate-900"
                                                                                    )}
                                                                                >
                                                                                    {item.totalStock} units
                                                                                </span>
                                                                                {item.totalStock <= item.threshold && (
                                                                                    <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded w-fit mt-0.5">
                                                                                        Low Stock
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        <Badge
                                                                            variant={item.status === 'In Stock' ? 'success' : 'destructive'}
                                                                            className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                                                                        >
                                                                            {item.status}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        <p className="text-sm font-black text-slate-900">
                                                                            {item.minPrice === item.maxPrice
                                                                                ? `₹${item.minPrice}`
                                                                                : `₹${item.minPrice} - ₹${item.maxPrice}`}
                                                                        </p>
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        <div>
                                                                            <p className="text-sm font-black text-slate-900">
                                                                                ₹{item.valuation.toLocaleString('en-IN')}
                                                                            </p>
                                                                            <span className="text-[10px] text-slate-400 font-semibold">Σ (Stock × CP)</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 text-right">
                                                                        <button
                                                                            onClick={() => openAdjustModal(item)}
                                                                            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors shadow-sm"
                                                                        >
                                                                            Adjust Stock
                                                                        </button>
                                                                    </td>
                                                                </motion.tr>

                                                                {/* Expandable Variants Breakdown */}
                                                                {isExpanded && item.hasMultipleVariants && item.variants.map((v) => {
                                                                    const vStock = Number(v.stock) || 0;
                                                                    const vPrice = Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0;
                                                                    const vCost = Number(v.costPrice) > 0
                                                                        ? Number(v.costPrice)
                                                                        : (Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0);
                                                                    const vValuation = vStock * vCost;
                                                                    const vStatus = vStock === 0 ? 'Out of Stock' : (vStock <= item.threshold ? 'Low Stock' : 'In Stock');
                                                                    const vImage = (Array.isArray(v.images) && v.images[0]) || item.mainImage;

                                                                    return (
                                                                        <tr key={v._id || v.name} className="bg-slate-50/70 border-b border-slate-100">
                                                                            <td className="px-6 py-3.5 pl-14">
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                                                                        {vImage ? (
                                                                                            <img src={vImage} alt="" className="h-full w-full object-cover" />
                                                                                        ) : (
                                                                                            <HiOutlineCube className="h-4 w-4 text-slate-400" />
                                                                                        )}
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="text-xs font-black text-slate-800">{v.name}</span>
                                                                                        <span className="text-[10px] text-slate-500 font-mono ml-2">SKU: {v.sku || 'N/A'}</span>
                                                                                    </div>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3.5">
                                                                                <span className={cn(
                                                                                    "text-xs font-bold",
                                                                                    vStock <= item.threshold ? "text-rose-600" : "text-slate-800"
                                                                                )}>
                                                                                    {vStock} units
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-6 py-3.5">
                                                                                <Badge
                                                                                    variant={vStatus === 'In Stock' ? 'success' : 'destructive'}
                                                                                    className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                                                                                >
                                                                                    {vStatus}
                                                                                </Badge>
                                                                            </td>
                                                                            <td className="px-6 py-3.5">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs font-black text-slate-800">₹{vPrice.toLocaleString('en-IN')}</span>
                                                                                    {vCost > 0 && (
                                                                                        <span className="text-[10px] text-amber-700 font-semibold">CP: ₹{vCost.toLocaleString('en-IN')}</span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3.5">
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs font-black text-slate-900">
                                                                                        ₹{vValuation.toLocaleString('en-IN')}
                                                                                    </span>
                                                                                    <span className="text-[9px] text-slate-400 font-medium">
                                                                                        {vStock} × ₹{vCost}
                                                                                    </span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-6 py-3.5 text-right">
                                                                                <button
                                                                                    onClick={() => openAdjustModal(item, v)}
                                                                                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
                                                                                >
                                                                                    Adjust
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                            </AnimatePresence>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </BlurFade>

                    <div className="mt-4">
                        <Pagination
                            page={page}
                            totalPages={Math.ceil(filteredInventory.length / pageSize) || 1}
                            total={filteredInventory.length}
                            pageSize={pageSize}
                            onPageChange={(p) => setPage(p)}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setPage(1);
                            }}
                            loading={isLoading}
                        />
                    </div>
                </>
            ) : (
                /* History View */
                <BlurFade delay={0.2}>
                    <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl p-0 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                            <div>
                                <h3 className="text-base font-black text-slate-900">Inventory Movement Log</h3>
                                <p className="text-sm text-slate-600 font-medium">Audit trail for all stock adjustments and sales.</p>
                            </div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {history.length === 0 ? (
                                <div className="p-10 text-center text-slate-600 font-black uppercase tracking-widest">No history found</div>
                            ) : history.map((log) => (
                                <div key={log._id} className="p-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-center gap-5">
                                        <div className={cn(
                                            "h-12 w-12 rounded-2xl flex items-center justify-center shadow-sm",
                                            log.type === 'Restock' ? "bg-[#fef4f4] text-primary" :
                                                log.type === 'Sale' ? "bg-[#fef4f4] text-primary" : "bg-rose-50 text-rose-600"
                                        )}>
                                            {log.type === 'Restock' ? <HiOutlinePlus className="h-6 w-6" /> :
                                                log.type === 'Sale' ? <HiOutlineCube className="h-6 w-6" /> : <HiOutlineMinus className="h-6 w-6" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-900">
                                                    {log.product?.name || 'Unknown Product'}
                                                    {log.variantName && log.variantName !== 'Default' && (
                                                        <span className="ml-1 text-primary font-bold">— {log.variantName}</span>
                                                    )}
                                                </h4>
                                                <Badge className={cn(
                                                    "text-[9px] font-bold px-1.5 py-0",
                                                    log.type === 'Restock' ? "bg-[#fde8ea] text-[#a2141c]" :
                                                        log.type === 'Sale' ? "bg-[#fde8ea] text-[#a2141c]" : "bg-rose-100 text-rose-700"
                                                )}>
                                                    {log.type.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-slate-600 font-semibold mt-1">Note: {log.note || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "text-lg font-black tracking-tight mb-0.5",
                                            log.quantity > 0 ? "text-[#E71D28]" : "text-rose-600"
                                        )}>
                                            {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-600">
                                            <HiOutlineCalendarDays className="h-3.5 w-3.5" />
                                            {new Date(log.createdAt).toLocaleDateString()} • {new Date(log.createdAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </BlurFade>
            )}

            {/* Advanced Adjustment Modal */}
            <AnimatePresence>
                {isAdjustModalOpen && selectedItem && (() => {
                    const currentVariant = selectedItem.variants.find(
                        (v) => (v._id || 'default') === selectedVariantId
                    ) || selectedItem.variants[0];
                    const currentStock = Number(currentVariant?.stock) || 0;
                    const currentCostPrice = Number(currentVariant?.costPrice) > 0
                        ? Number(currentVariant.costPrice)
                        : (Number(currentVariant?.salePrice) > 0 ? Number(currentVariant.salePrice) : Number(currentVariant?.price) || 0);
                    const variantImage = (Array.isArray(currentVariant?.images) && currentVariant.images[0]) || selectedItem.mainImage;
                    const numVal = parseInt(adjustValue) || 0;
                    const resultingStock = adjustType === 'Restock' ? currentStock + numVal : currentStock - numVal;
                    const exceedsRemoval = adjustType === 'Remove' && numVal > currentStock;

                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                                onClick={() => !isSubmitting && setIsAdjustModalOpen(false)}
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="w-full max-w-lg relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                            >
                                {/* Header */}
                                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-[#E71D28] text-white rounded-xl flex items-center justify-center shadow-md shadow-rose-200">
                                            <HiOutlineArrowsUpDown className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-slate-900">Adjust Inventory</h3>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-1">
                                                Add or remove variant stock
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => !isSubmitting && setIsAdjustModalOpen(false)}
                                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
                                        <HiOutlineXMark className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                                    {/* Selected Product Banner */}
                                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                                        <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 overflow-hidden shrink-0">
                                            {variantImage ? (
                                                <img src={variantImage} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                <HiOutlineCube className="h-6 w-6 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="text-sm font-black text-slate-900 truncate">
                                                {selectedItem.name}
                                            </h4>
                                            <p className="text-[11px] text-slate-500 font-semibold">
                                                SKU: {currentVariant?.sku || selectedItem.sku || 'N/A'} • Total Units: <span className="font-bold text-slate-900">{selectedItem.totalStock}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Variant Selector (if multiple variants) */}
                                    {selectedItem.hasMultipleVariants && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">
                                                Select Variant To Adjust <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {selectedItem.variants.map((v) => {
                                                    const isSelected = selectedVariantId === (v._id || 'default');
                                                    const vStock = Number(v.stock) || 0;
                                                    const vPrice = Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0;
                                                    const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : (Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0);

                                                    return (
                                                        <button
                                                            key={v._id || v.name}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedVariantId(v._id || 'default');
                                                                setAdjustValue('');
                                                            }}
                                                            className={cn(
                                                                "p-3 rounded-2xl text-left transition-all border flex flex-col justify-between gap-1",
                                                                isSelected
                                                                    ? "bg-[#E71D28] text-white border-[#E71D28] shadow-md shadow-rose-200"
                                                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                                            )}>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="font-bold text-xs truncate">{v.name}</span>
                                                                {isSelected && <HiOutlineCheck className="h-3.5 w-3.5 shrink-0" />}
                                                            </div>
                                                            <div className={cn(
                                                                "text-[10px] font-semibold flex justify-between",
                                                                isSelected ? "text-rose-100" : "text-slate-500"
                                                            )}>
                                                                <span>Stock: {vStock} units</span>
                                                                <span>{vCost > 0 ? `CP: ₹${vCost}` : `₹${vPrice}`}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Selected Variant Current Stock Card */}
                                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100/70 border border-slate-200">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                Target Variant
                                            </span>
                                            <p className="text-xs font-black text-slate-900">
                                                {currentVariant?.name || 'Default Variant'}
                                            </p>
                                            <span className="text-[10px] text-amber-800 font-semibold">
                                                Cost Price: ₹{currentCostPrice.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                Stock Valuation
                                            </span>
                                            <p className="text-sm font-black text-[#E71D28]">
                                                ₹{(currentStock * currentCostPrice).toLocaleString('en-IN')}
                                            </p>
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {currentStock} UNITS
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mode Selector: Add (Restock) vs Remove */}
                                    <div className="space-y-4">
                                        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                            {[
                                                { id: 'Restock', label: '+ Add Stock (Restock)' },
                                                { id: 'Remove', label: '- Remove Stock' },
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setAdjustType(tab.id)}
                                                    className={cn(
                                                        "flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                                                        adjustType === tab.id
                                                            ? "bg-white text-slate-900 shadow-sm"
                                                            : "text-slate-600 hover:text-slate-900"
                                                    )}>
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Quantity Input */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">
                                                    Quantity {adjustType === 'Restock' ? 'to Add' : 'to Remove'} <span className="text-rose-500">*</span>
                                                </label>
                                                <div className="flex gap-1.5">
                                                    {[5, 10, 25].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => setAdjustValue(String(preset))}
                                                            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors">
                                                            +{preset}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={adjustValue}
                                                    onChange={(e) => setAdjustValue(e.target.value)}
                                                    className={cn(
                                                        "w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xl font-black outline-none focus:ring-2 transition-all",
                                                        exceedsRemoval
                                                            ? "ring-2 ring-rose-500 text-rose-600"
                                                            : "text-slate-900 focus:ring-primary/20"
                                                    )}
                                                    placeholder="Enter quantity (e.g. 5)"
                                                />
                                            </div>
                                            {exceedsRemoval && (
                                                <p className="text-[11px] font-bold text-rose-600 ml-1">
                                                    Cannot remove more than currently available stock ({currentStock} units).
                                                </p>
                                            )}
                                        </div>

                                        {/* Resulting Stock Preview */}
                                        {numVal > 0 && !exceedsRemoval && (
                                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1 text-emerald-800">
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span>Resulting Stock:</span>
                                                    <span className="font-black text-sm">
                                                        {currentStock} → {resultingStock} units ({adjustType === 'Restock' ? `+${numVal}` : `-${numVal}`})
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                                                    <span>Resulting Valuation:</span>
                                                    <span className="font-black">
                                                        ₹{(resultingStock * currentCostPrice).toLocaleString('en-IN')} ({adjustType === 'Restock' ? `+₹${(numVal * currentCostPrice).toLocaleString('en-IN')}` : `-₹${(numVal * currentCostPrice).toLocaleString('en-IN')}`})
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Internal Note */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest ml-1">
                                                Reason / Note (Optional)
                                            </label>
                                            <textarea
                                                value={adjustNote}
                                                onChange={(e) => setAdjustNote(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none h-16"
                                                placeholder="e.g. Weekly restock from warehouse, damaged batch, etc."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                                    <Button
                                        type="button"
                                        onClick={() => !isSubmitting && setIsAdjustModalOpen(false)}
                                        variant="outline"
                                        disabled={isSubmitting}
                                        className="flex-1 py-3 text-xs font-bold rounded-2xl bg-white">
                                        CANCEL
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleFullAdjustment}
                                        disabled={isSubmitting || numVal <= 0 || exceedsRemoval}
                                        className="flex-1 py-3 text-xs font-bold rounded-2xl shadow-xl shadow-rose-200 bg-[#E71D28] hover:bg-primary-hover text-white disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isSubmitting ? (
                                            <>
                                                <HiOutlineArrowPath className="mr-2 h-4 w-4 animate-spin" />
                                                SAVING...
                                            </>
                                        ) : (
                                            "CONFIRM & UPDATE"
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>
        </div>
    );
};

export default StockManagement;
