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
    HiOutlineCalendarDays
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
    const [adjustType, setAdjustType] = useState('Restock');
    const [adjustValue, setAdjustValue] = useState('');
    const [adjustNote, setAdjustNote] = useState('');

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

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

                // One row per variant — stock and price are always variant-specific now.
                const rows = safeProducts.flatMap((p) => {
                    const variants = Array.isArray(p.variants) && p.variants.length > 0
                        ? p.variants
                        : [{ _id: null, name: 'Default', price: p.price, salePrice: p.salePrice, stock: p.stock, sku: p.sku, images: [] }];
                    const threshold = p.lowStockAlert || 5;

                    return variants.map((v) => {
                        const stock = Number(v.stock) || 0;
                        const price = Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0;
                        return {
                            id: `${p._id}::${v._id || 'default'}`,
                            productId: p._id,
                            variantId: v._id || null,
                            variantName: v.name || 'Default',
                            hasMultipleVariants: variants.length > 1,
                            name: p.name,
                            sku: v.sku || p.sku,
                            mainImage: (Array.isArray(v.images) && v.images[0]) || p.mainImage,
                            stock,
                            price,
                            threshold,
                            status: stock === 0
                                ? 'Out of Stock'
                                : (stock <= threshold ? 'Low Stock' : 'In Stock'),
                        };
                    });
                });

                setInventory(rows);
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
            status: 'In Stock'
        }
    ], [inventory]);

    const filteredInventory = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return inventory.filter(item => {
            const matchesSearch =
                item.name.toLowerCase().includes(term) ||
                (item.sku || '').toString().toLowerCase().includes(term);
            const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [inventory, searchTerm, filterStatus]);

    const handleFullAdjustment = async () => {
        const value = parseInt(adjustValue);
        if (isNaN(value) || value <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        try {
            const res = await sellerApi.adjustStock({
                productId: selectedItem.productId,
                variantId: selectedItem.variantId || undefined,
                type: adjustType === 'Restock' ? 'Restock' : 'Correction',
                quantity: adjustType === 'Restock' ? value : -value,
                note: adjustNote
            });

            if (res.data.success) {
                toast.success("Stock adjusted successfully");
                setIsAdjustModalOpen(false);
                fetchInventory(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to adjust stock");
        }
    };

    const openAdjustModal = (item) => {
        setSelectedItem(item);
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
                                            <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredInventory.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-6 py-10 text-center text-slate-600 text-xs font-black tracking-widest uppercase"
                                                >
                                                    No products found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredInventory
                                                    .slice((page - 1) * pageSize, page * pageSize)
                                                    .map((item) => (
                                                        <motion.tr
                                                            key={item.id}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="group hover:bg-slate-50/80 transition-all cursor-default"
                                                        >
                                                            <td className="px-6 py-5">
                                                                <div className="flex items-center gap-4 group">
                                                                    <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:scale-105 transition-transform overflow-hidden">
                                                                        {item.mainImage ? (
                                                                            <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                                        ) : (
                                                                            <HiOutlineCube className="h-6 w-6" />
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">
                                                                            {item.name}
                                                                            {item.hasMultipleVariants && (
                                                                                <span className="ml-1.5 text-primary font-bold">— {item.variantName}</span>
                                                                            )}
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
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
                                                                                item.stock <= item.threshold ? "text-rose-600" : "text-slate-900"
                                                                            )}
                                                                        >
                                                                            {item.stock} units
                                                                        </span>
                                                                        {item.stock <= item.threshold && (
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
                                                                <p className="text-sm font-black text-slate-900">₹{item.price}</p>
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <button
                                                                    onClick={() => openAdjustModal(item)}
                                                                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
                                                                >
                                                                    Adjust Stock
                                                                </button>
                                                            </td>
                                                        </motion.tr>
                                                    ))}
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
                                                <h4 className="text-sm font-black text-slate-900">{log.product?.name || 'Unknown Product'}</h4>
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
                {isAdjustModalOpen && selectedItem && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setIsAdjustModalOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-md relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                                        <HiOutlineArrowsUpDown className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900">Adjust Inventory</h3>
                                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none mt-1">Update product stock</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAdjustModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
                                    <HiOutlineXMark className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 overflow-hidden">
                                        {selectedItem.mainImage ? (
                                            <img src={selectedItem.mainImage} alt="" className="h-full w-full object-cover" />
                                        ) : <HiOutlineCube className="h-6 w-6" />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900">
                                            {selectedItem.name}
                                            {selectedItem.hasMultipleVariants && (
                                                <span className="ml-1.5 text-primary font-bold">— {selectedItem.variantName}</span>
                                            )}
                                        </h4>
                                        <p className="text-[10px] font-bold text-slate-600">CURRENT STOCK: <span className="text-slate-900 font-black">{selectedItem.stock} UNITS</span></p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                        {['Restock', 'Remove'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setAdjustType(type)}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                                                    adjustType === type
                                                        ? "bg-white text-slate-900 shadow-md"
                                                        : "text-slate-600 hover:text-slate-600"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Quantity Change</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-slate-600">#</div>
                                            <input
                                                type="number"
                                                value={adjustValue}
                                                onChange={(e) => setAdjustValue(e.target.value)}
                                                className="w-full pl-10 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Internal Note (Optional)</label>
                                        <textarea
                                            value={adjustNote}
                                            onChange={(e) => setAdjustNote(e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none h-20"
                                            placeholder="Reason for adjustment..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <Button
                                    onClick={() => setIsAdjustModalOpen(false)}
                                    variant="outline"
                                    className="flex-1 py-4 text-xs font-bold rounded-2xl bg-white"
                                >
                                    CANCEL
                                </Button>
                                <Button
                                    onClick={handleFullAdjustment}
                                    className="flex-1 py-4 text-xs font-bold rounded-2xl shadow-xl shadow-primary/20"
                                >
                                    SAVE CHANGES
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StockManagement;
