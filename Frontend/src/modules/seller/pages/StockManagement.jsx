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
import { useAuthStore } from '@/core/auth/auth.store';

const normalizeSellerBusinessType = (type) =>
    (type || 'quick_commerce').toLowerCase().replace(/\s+/g, '_');

const isPharmacyDefaultPlaceholderVariant = (variant) => {
    if (!variant || typeof variant !== 'object') return false;
    const packQty = variant.packQuantity;
    const hasPackQty =
        packQty !== '' &&
        packQty != null &&
        Number.isFinite(Number(packQty)) &&
        Number(packQty) > 0;
    return (
        String(variant.name || '').trim() === 'Default' &&
        !String(variant.strength || '').trim() &&
        !String(variant.packType || '').trim() &&
        !hasPackQty &&
        !String(variant.unit || '').trim()
    );
};

const getProductTotalStock = (product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
        return variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
    }
    return Number(product.stock) || 0;
};

const getVariantUnitPrice = (variant = {}) => {
    const price = Number(variant.price) || 0;
    const sale = Number(variant.salePrice) || 0;
    if (sale > 0 && (price <= 0 || sale < price)) return sale;
    return price;
};

const getProductUnitPrice = (product = {}) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) return getVariantUnitPrice(variants[0]);
    const price = Number(product.price) || 0;
    const sale = Number(product.salePrice) || 0;
    if (sale > 0 && (price <= 0 || sale < price)) return sale;
    return price;
};

/** Sum of (each variant stock × that variant's sell price). */
const getProductStockValuation = (product = {}) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
        return variants.reduce(
            (sum, v) => sum + (Number(v.stock) || 0) * getVariantUnitPrice(v),
            0,
        );
    }
    return getProductTotalStock(product) * getProductUnitPrice(product);
};

const getInventoryVariants = (product = {}) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    return variants.map((v, idx) => ({
        ...v,
        id: String(v._id || v.id || `idx-${idx}`),
        name: String(v.name || `Variant ${idx + 1}`).trim() || `Variant ${idx + 1}`,
        stock: Number(v.stock) || 0,
        unitPrice: getVariantUnitPrice(v),
        value: (Number(v.stock) || 0) * getVariantUnitPrice(v),
    }));
};

const getPharmacyInventoryMeta = (product) => {
    const pd = product.pharmacyDetails || {};
    const realVariants = (product.variants || []).filter((v) => !isPharmacyDefaultPlaceholderVariant(v));
    const v = realVariants[0];
    const packTypeRaw = v?.packType || pd.packType || '';
    const packTypeLabels = {
        strip: 'Strip',
        bottle: 'Bottle',
        box: 'Box',
        tube: 'Tube',
        vial: 'Vial',
        device: 'Device',
        piece: 'Piece',
    };
    return {
        batchNumber: pd.batchNumber || '—',
        strength: v?.strength || pd.strength || '—',
        packType: packTypeLabels[packTypeRaw] || packTypeRaw || '—',
        expDate: pd.expDate || '',
    };
};

const getExpiryInfo = (expDate) => {
    if (!expDate) {
        return { daysRemaining: null, tier: 'none', dateLabel: '—', daysLabel: '—' };
    }
    const exp = new Date(expDate);
    if (Number.isNaN(exp.getTime())) {
        return { daysRemaining: null, tier: 'none', dateLabel: '—', daysLabel: '—' };
    }
    exp.setHours(23, 59, 59, 999);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((exp - today) / 86400000);
    let tier = 'safe';
    if (daysRemaining < 0) tier = 'expired';
    else if (daysRemaining <= 30) tier = 'critical';
    else if (daysRemaining <= 90) tier = 'warning';
    return {
        daysRemaining,
        tier,
        dateLabel: exp.toLocaleDateString(),
        daysLabel: daysRemaining < 0 ? 'Expired' : String(daysRemaining),
    };
};

const EXPIRY_TIER_CLASS = {
    expired: 'text-red-600 bg-red-50 ring-1 ring-red-100',
    critical: 'text-orange-600 bg-orange-50 ring-1 ring-orange-100',
    warning: 'text-yellow-700 bg-yellow-50 ring-1 ring-yellow-100',
    safe: 'text-emerald-600 bg-emerald-50 ring-1 ring-emerald-100',
    none: 'text-slate-400',
};

const getPharmacyStockHealthStatus = (stock, threshold, expiryTier) => {
    if (expiryTier === 'expired') return { label: 'Expired', tone: 'expired' };
    if (stock === 0) return { label: 'Out of Stock', tone: 'rose' };
    if (stock <= threshold) return { label: 'Low Stock', tone: 'amber' };
    if (expiryTier === 'critical') return { label: 'Expiring Soon', tone: 'critical' };
    if (expiryTier === 'warning') return { label: 'Monitor Expiry', tone: 'warning' };
    return { label: 'In Stock', tone: 'safe' };
};

const STOCK_HEALTH_TONE_CLASS = {
    expired: 'bg-red-50 text-red-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    critical: 'bg-orange-50 text-orange-600',
    warning: 'bg-yellow-50 text-yellow-700',
    safe: 'bg-emerald-50 text-emerald-600',
};

const StockManagement = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const sellerBusinessType = normalizeSellerBusinessType(user?.shopInfo?.businessType);
    const isPharmacySeller = sellerBusinessType === 'pharmacy';
    const [activeView, setActiveView] = useState('inventory'); // 'inventory' or 'history'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedVariantId, setSelectedVariantId] = useState('');
    const [adjustType, setAdjustType] = useState('Restock');
    const [adjustValue, setAdjustValue] = useState('');
    const [adjustNote, setAdjustNote] = useState('');
    const [isAdjusting, setIsAdjusting] = useState(false);

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

                setInventory(
                    safeProducts.map(p => {
                        const stock = getProductTotalStock(p);
                        const threshold = p.lowStockAlert || 5;
                        const variants = getInventoryVariants(p);
                        const valuation = getProductStockValuation(p);
                        return {
                            ...p,
                            id: p._id,
                            stock,
                            threshold,
                            variants,
                            valuation,
                            status:
                                stock === 0
                                    ? 'Out of Stock'
                                    : (stock <= threshold ? 'Low Stock' : 'In Stock')
                        };
                    })
                );
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
            iconColor: 'text-emerald-700',
            iconBg: 'bg-emerald-100/80',
            cardBg: 'bg-[#F0FDF4] border-emerald-200/60 hover:border-emerald-300/80 shadow-xs',
            status: 'All'
        },
        {
            label: 'Low Stock Items',
            value: inventory.filter(i => i.stock > 0 && i.stock <= i.threshold).length,
            icon: HiOutlineExclamationTriangle,
            iconColor: 'text-amber-700',
            iconBg: 'bg-amber-100/80',
            cardBg: 'bg-[#FFFBEB] border-amber-200/60 hover:border-amber-300/80 shadow-xs',
            status: 'Low Stock'
        },
        {
            label: 'Out of Stock',
            value: inventory.filter(i => i.stock === 0).length,
            icon: HiOutlineArchiveBoxXMark,
            iconColor: 'text-rose-700',
            iconBg: 'bg-rose-100/80',
            cardBg: 'bg-[#FEF2F2] border-rose-200/60 hover:border-rose-300/80 shadow-xs',
            status: 'Out of Stock'
        },
        {
            label: 'Stock Valuation',
            value: `₹${inventory.reduce((acc, item) => acc + (item.stock * item.price), 0).toLocaleString()}`,
            icon: HiOutlineArrowsUpDown,
            iconColor: 'text-sky-700',
            iconBg: 'bg-sky-100/80',
            cardBg: 'bg-[#F0F9FF] border-sky-200/60 hover:border-sky-300/80 shadow-xs',
            status: 'In Stock'
        }
    ], [inventory]);

    const selectedVariants = useMemo(
        () => (selectedItem ? getInventoryVariants(selectedItem) : []),
        [selectedItem],
    );

    const selectedVariant = useMemo(() => {
        if (!selectedVariants.length) return null;
        return (
            selectedVariants.find((v) => v.id === selectedVariantId) ||
            selectedVariants[0]
        );
    }, [selectedVariants, selectedVariantId]);

    const selectedVariantStock = selectedVariant
        ? selectedVariant.stock
        : (selectedItem?.stock || 0);

    const filteredInventory = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return inventory.filter(item => {
            const meta = isPharmacySeller ? getPharmacyInventoryMeta(item) : null;
            const matchesSearch =
                item.name.toLowerCase().includes(term) ||
                (item.sku || '').toString().toLowerCase().includes(term) ||
                (isPharmacySeller && (
                    (meta?.batchNumber || '').toLowerCase().includes(term) ||
                    (meta?.strength || '').toLowerCase().includes(term) ||
                    (item.pharmacyDetails?.genericName || '').toLowerCase().includes(term)
                ));
            const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [inventory, searchTerm, filterStatus, isPharmacySeller]);

    const handleFullAdjustment = async () => {
        const value = parseInt(adjustValue, 10);
        if (isNaN(value) || value <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        if (selectedVariants.length > 1 && !selectedVariantId) {
            toast.error("Select which variant to adjust");
            return;
        }

        if (adjustType === 'Remove' && value > selectedVariantStock) {
            toast.error(`Only ${selectedVariantStock} units available on this variant`);
            return;
        }

        if (isAdjusting) return;
        setIsAdjusting(true);
        try {
            const payload = {
                productId: selectedItem.id,
                type: adjustType === 'Restock' ? 'Restock' : 'Correction',
                quantity: adjustType === 'Restock' ? value : -value,
                note: adjustNote,
            };
            if (selectedVariant?.id && !String(selectedVariant.id).startsWith('idx-')) {
                payload.variantId = selectedVariant.id;
            } else if (selectedVariants.length === 1 && selectedVariants[0]?.id && !String(selectedVariants[0].id).startsWith('idx-')) {
                payload.variantId = selectedVariants[0].id;
            }

            const res = await sellerApi.adjustStock(payload);

            if (res.data.success) {
                toast.success(
                    selectedVariant
                        ? `Stock updated for "${selectedVariant.name}"`
                        : "Stock adjusted successfully",
                );
                setIsAdjustModalOpen(false);
                fetchInventory(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to adjust stock");
        } finally {
            setIsAdjusting(false);
        }
    };

    const openAdjustModal = (item) => {
        const variants = getInventoryVariants(item);
        setSelectedItem(item);
        setSelectedVariantId(variants[0]?.id || '');
        setAdjustValue('');
        setAdjustNote('');
        setAdjustType('Restock');
        setIsAdjustModalOpen(true);
    };

    if (isLoading && inventory.length === 0 && history.length === 0) {
        return <div className="flex items-center justify-center h-screen font-black text-slate-600">LOADING STOCK DATA...</div>;
    }

    return (
        <div className="flex flex-col gap-5 px-3 md:px-4 pb-20 max-w-7xl md:max-w-none mx-auto w-full">
            {/* Custom Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60 mb-1">
                <div>
                    <h1 className="text-lg sm:text-xl font-semibold text-[#1c1c1e] tracking-tight flex items-center gap-2">
                        Stock Management
                        <Badge variant="warning" className="text-[10px] px-2 py-0.5 font-medium tracking-wide uppercase bg-amber-100/80 text-amber-800 border-amber-200">
                            Inventory Control
                        </Badge>
                    </h1>
                    <p className="text-xs font-normal text-slate-500 mt-0.5">
                        Monitor stock levels, manage restocks, and track movements.
                    </p>
                </div>
            </div>

            {activeView === 'inventory' ? (
                <>
                    {/* Quick Stats Grid - Compact & Colored Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
                        {stats.map((stat, i) => (
                            <div
                                key={i}
                                onClick={() => setFilterStatus(stat.status)}
                                className={cn(
                                    "rounded-xl sm:rounded-2xl border p-2.5 sm:p-3 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between active:scale-[0.98]",
                                    stat.cardBg
                                )}
                            >
                                <div className="flex items-center justify-between gap-1.5">
                                    <div className={cn("rounded-lg p-1.5 sm:p-2 shrink-0 flex items-center justify-center shadow-xs", stat.iconBg)}>
                                        <stat.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", stat.iconColor)} />
                                    </div>
                                </div>
                                <div className="mt-1.5">
                                    <p className="text-[11px] sm:text-xs font-medium text-slate-600 truncate tracking-tight">{stat.label}</p>
                                    <p className="text-base sm:text-lg font-semibold tracking-tight text-[#1c1c1e] truncate mt-0.5">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                        {/* Toolbox / Filters Header */}
                        <div className="p-2 sm:p-3 border-b border-slate-200/60 bg-slate-50/60 space-y-2">
                            <div className="relative w-full">
                                <HiOutlineMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={isPharmacySeller
                                        ? "Search by product, batch, strength, or generic name..."
                                        : "Search by product name or SKU..."}
                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-normal text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-slate-400"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center justify-between gap-1.5">
                                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                                    {['All', 'In Stock', 'Out of Stock'].map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setFilterStatus(status);
                                                setPage(1);
                                            }}
                                            className={cn(
                                                "px-2 py-0.5 rounded-md text-[11px] font-medium transition-all min-h-0",
                                                filterStatus === status
                                                    ? "bg-white text-[#1c1c1e] shadow-xs font-semibold"
                                                    : "text-slate-600 hover:text-slate-900"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => navigate('/seller/products/add')}
                                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-all flex items-center shrink-0 shadow-xs min-h-0"
                                >
                                    <HiOutlinePlus className="h-3 w-3 mr-1" />
                                    Add Product
                                </button>
                            </div>
                        </div>

                        {/* Pagination — above content */}
                        <div className="px-2 sm:px-3 py-1.5 border-b border-slate-100/80 bg-slate-50/30">
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
                                compact
                            />
                        </div>

                        {/* Mobile Card List */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filteredInventory.length === 0 ? (
                                <div className="px-4 py-6 text-center text-slate-500 text-xs font-medium tracking-tight">
                                    No products found for this filter.
                                </div>
                            ) : filteredInventory
                                    .slice((page - 1) * pageSize, page * pageSize)
                                    .map((item) => {
                                        const meta = isPharmacySeller ? getPharmacyInventoryMeta(item) : null;
                                        const expiry = isPharmacySeller ? getExpiryInfo(meta?.expDate) : null;
                                        const health = isPharmacySeller
                                            ? getPharmacyStockHealthStatus(item.stock, item.threshold, expiry.tier)
                                            : null;
                                        return (
                                        <div key={item.id} className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-slate-50 transition-colors">
                                            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 overflow-hidden shrink-0">
                                                {item.mainImage ? (
                                                    <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <HiOutlineCube className="h-6 w-6" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-900 truncate">{item.name}</p>
                                                {isPharmacySeller ? (
                                                    <>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                            Batch: {meta.batchNumber}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                {meta.strength}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-slate-600">{meta.packType}</span>
                                                            <span className={cn(
                                                                "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                                                item.stock <= item.threshold ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                                            )}>
                                                                {item.stock} units
                                                            </span>
                                                            {expiry.tier !== 'none' && (
                                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", EXPIRY_TIER_CLASS[expiry.tier])}>
                                                                    {expiry.dateLabel}
                                                                </span>
                                                            )}
                                                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", STOCK_HEALTH_TONE_CLASS[health.tone])}>
                                                                {health.label}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                            <span className={cn(
                                                                "text-[9px] font-semibold px-1.5 py-0.5 rounded",
                                                                item.stock <= item.threshold ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                                            )}>
                                                                {item.stock} units total
                                                            </span>
                                                            <span className={cn(
                                                                "text-[9px] font-medium px-1.5 py-0.5 rounded",
                                                                item.status === 'In Stock' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                                            )}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                        {Array.isArray(item.variants) && item.variants.length > 0 ? (
                                                            <div className="mt-1.5 space-y-0.5">
                                                                {item.variants.map((v) => (
                                                                    <p key={v.id} className="text-[10px] font-semibold text-slate-600">
                                                                        {v.name}: <span className="text-slate-900">{v.stock}</span> · ₹{v.unitPrice}
                                                                    </p>
                                                                ))}
                                                                <p className="text-[10px] font-bold text-emerald-700 mt-0.5">
                                                                    Value ₹{(Number(item.valuation) || 0).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs font-bold text-slate-900 mt-0.5">
                                                                ₹{getProductUnitPrice(item)} · Value ₹{(Number(item.valuation) || 0).toLocaleString()}
                                                            </p>
                                                        )}
                                                        <p className="text-[11px] font-semibold text-slate-900 mt-0.5">₹{item.price}</p>
                                                    </>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => openAdjustModal(item)}
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200 transition-colors shrink-0"
                                            >
                                                Adjust
                                            </button>
                                        </div>
                                        );
                                    })}
                            </div>

                            {/* Desktop Stock Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/70 border-b border-slate-200/60">
                                            {isPharmacySeller ? (
                                                <>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Product Name</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Batch Number</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Strength</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Pack Type</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Current Stock</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Expiry Date</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Days Remaining</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700">Low Stock Status</th>
                                                    <th className="px-4 py-3 text-xs font-semibold text-slate-700 text-right whitespace-nowrap">Actions</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Product Information</th>
                                                    <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Variants & Stock</th>
                                                    <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Stock Health</th>
                                                    <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">Stock Value</th>
                                                    <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredInventory.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={isPharmacySeller ? 9 : 5}
                                                    className="px-4 py-8 text-center text-slate-500 text-xs font-medium tracking-tight"
                                                >
                                                    No products found for this filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            <AnimatePresence>
                                                {filteredInventory
                                                    .slice((page - 1) * pageSize, page * pageSize)
                                                    .map((item) => {
                                                        const meta = isPharmacySeller ? getPharmacyInventoryMeta(item) : null;
                                                        const expiry = isPharmacySeller ? getExpiryInfo(meta?.expDate) : null;
                                                        const health = isPharmacySeller
                                                            ? getPharmacyStockHealthStatus(item.stock, item.threshold, expiry.tier)
                                                            : null;
                                                        return (
                                                        <motion.tr
                                                            key={item.id}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            exit={{ opacity: 0 }}
                                                            className="group hover:bg-slate-50/80 transition-all cursor-default"
                                                        >
                                                            {isPharmacySeller ? (
                                                                <>
                                                                    <td className="px-6 py-5">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 overflow-hidden shrink-0">
                                                                                {item.mainImage ? (
                                                                                    <img src={item.mainImage} alt={item.name} className="h-full w-full object-cover" />
                                                                                ) : (
                                                                                    <HiOutlineCube className="h-6 w-6" />
                                                                                )}
                                                                            </div>
                                                                            <h4 className="text-sm font-black text-slate-900">{item.name}</h4>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-5 text-sm font-semibold text-slate-700">{meta.batchNumber}</td>
                                                                    <td className="px-6 py-5 text-sm font-semibold text-slate-800">{meta.strength}</td>
                                                                    <td className="px-6 py-5 text-sm text-slate-700">{meta.packType}</td>
                                                                    <td className="px-6 py-5">
                                                                        {Array.isArray(item.variants) && item.variants.length > 1 ? (
                                                                            <div className="space-y-1 min-w-[140px]">
                                                                                <span className={cn(
                                                                                    "text-sm font-black",
                                                                                    item.stock <= item.threshold ? "text-rose-600" : "text-slate-900"
                                                                                )}>
                                                                                    {item.stock} total
                                                                                </span>
                                                                                {item.variants.map((v) => (
                                                                                    <p key={v.id} className="text-[10px] font-semibold text-slate-600">
                                                                                        {v.name}: {v.stock}
                                                                                    </p>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className={cn(
                                                                                "text-sm font-black",
                                                                                item.stock <= item.threshold ? "text-rose-600" : "text-slate-900"
                                                                            )}>
                                                                                {item.stock}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        {expiry.tier === 'none' ? (
                                                                            <span className="text-slate-400">—</span>
                                                                        ) : (
                                                                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", EXPIRY_TIER_CLASS[expiry.tier])}>
                                                                                {expiry.dateLabel}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        {expiry.tier === 'none' ? (
                                                                            <span className="text-slate-400">—</span>
                                                                        ) : (
                                                                            <span className={cn("text-sm font-bold", EXPIRY_TIER_CLASS[expiry.tier].split(' ')[0])}>
                                                                                {expiry.daysLabel}
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-6 py-5">
                                                                        <span className={cn(
                                                                            "text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest",
                                                                            STOCK_HEALTH_TONE_CLASS[health.tone]
                                                                        )}>
                                                                            {health.label}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-5 text-right">
                                                                        <button
                                                                            onClick={() => openAdjustModal(item)}
                                                                            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
                                                                        >
                                                                            Adjust Stock
                                                                        </button>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
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
                                                                        <h4 className="text-sm font-black text-slate-900 group-hover:text-red-500 transition-colors">
                                                                            {item.name}
                                                                        </h4>
                                                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                                                                            Product Code: {item.sku || 'N/A'}
                                                                        </p>
                                                                        {Array.isArray(item.variants) && item.variants.length > 0 && (
                                                                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                                                {item.variants.length} variant{item.variants.length > 1 ? 's' : ''} · {item.stock} units total
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                {Array.isArray(item.variants) && item.variants.length > 0 ? (
                                                                    <div className="space-y-1.5 min-w-[180px]">
                                                                        {item.variants.map((v) => (
                                                                            <div
                                                                                key={v.id}
                                                                                className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-100"
                                                                            >
                                                                                <div className="min-w-0">
                                                                                    <p className="text-xs font-bold text-slate-800 truncate">{v.name}</p>
                                                                                    <p className="text-[10px] font-semibold text-slate-500">₹{v.unitPrice} / unit</p>
                                                                                </div>
                                                                                <span className={cn(
                                                                                    "text-xs font-black shrink-0",
                                                                                    v.stock <= 0 ? "text-rose-600" : "text-slate-900"
                                                                                )}>
                                                                                    {v.stock}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
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
                                                                )}
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
                                                                    ₹{(Number(item.valuation) || 0).toLocaleString()}
                                                                </p>
                                                                {Array.isArray(item.variants) && item.variants.length > 1 && (
                                                                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                                                        across {item.variants.length} variants
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-5 text-right">
                                                                <button
                                                                    onClick={() => openAdjustModal(item)}
                                                                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors"
                                                                >
                                                                    Adjust Stock
                                                                </button>
                                                            </td>
                                                                </>
                                                            )}
                                                        </motion.tr>
                                                        );
                                                    })}
                                            </AnimatePresence>
                                        )}
                                    </tbody>
                                </table>
                            </div>
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
                                            log.type === 'Restock' ? "bg-emerald-50 text-emerald-600" :
                                                log.type === 'Sale' ? "bg-red-50 text-red-600" : "bg-rose-50 text-rose-600"
                                        )}>
                                            {log.type === 'Restock' ? <HiOutlinePlus className="h-6 w-6" /> :
                                                log.type === 'Sale' ? <HiOutlineCube className="h-6 w-6" /> : <HiOutlineMinus className="h-6 w-6" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-900">{log.product?.name || 'Unknown Product'}</h4>
                                                <Badge className={cn(
                                                    "text-[9px] font-bold px-1.5 py-0",
                                                    log.type === 'Restock' ? "bg-emerald-100 text-emerald-700" :
                                                        log.type === 'Sale' ? "bg-red-100 text-red-700" : "bg-rose-100 text-rose-700"
                                                )}>
                                                    {log.type.toUpperCase()}
                                                </Badge>
                                            </div>
                                            {log.variantName ? (
                                                <p className="text-[11px] text-slate-700 font-bold mt-1">
                                                    Variant: {log.variantName}
                                                </p>
                                            ) : null}
                                            <p className="text-[11px] text-slate-600 font-semibold mt-1">Note: {log.note || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "text-lg font-black tracking-tight mb-0.5",
                                            log.quantity > 0 ? "text-emerald-600" : "text-rose-600"
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
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 bg-slate-900 text-white rounded-lg flex items-center justify-center shadow-sm">
                                        <HiOutlineArrowsUpDown className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-[#1c1c1e] tracking-tight">Adjust Inventory</h3>
                                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider leading-none mt-0.5">Update product stock</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAdjustModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                                    <HiOutlineXMark className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="p-4 space-y-3.5">
                                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 overflow-hidden shrink-0">
                                        {selectedItem.mainImage ? (
                                            <img src={selectedItem.mainImage} alt="" className="h-full w-full object-cover" />
                                        ) : <HiOutlineCube className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-black text-slate-900 truncate">{selectedItem.name}</h4>
                                        <p className="text-[10px] font-bold text-slate-600">
                                            PRODUCT TOTAL:{' '}
                                            <span className="text-slate-900 font-black">{selectedItem.stock} UNITS</span>
                                        </p>
                                    </div>
                                </div>

                                {selectedVariants.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">
                                            {selectedVariants.length > 1 ? 'Select Variant' : 'Variant'}
                                        </label>
                                        {selectedVariants.length > 1 ? (
                                            <div className="relative">
                                                <select
                                                    value={selectedVariantId || ''}
                                                    onChange={(e) => setSelectedVariantId(e.target.value)}
                                                    className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 appearance-none cursor-pointer"
                                                >
                                                    {selectedVariants.map((v) => (
                                                        <option key={v.id} value={v.id}>
                                                            {v.name} — ₹{v.unitPrice} / unit ({v.stock} units)
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400">
                                                    <HiOutlineArrowsUpDown className="h-4 w-4" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                                                <p className="text-sm font-bold text-slate-900">{selectedVariants[0].name}</p>
                                                <span className="text-xs font-black text-slate-800">{selectedVariants[0].stock} units</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                                        Adjusting stock for
                                    </p>
                                    <p className="text-sm font-black text-slate-900 mt-0.5">
                                        {selectedVariant?.name || selectedItem.name}
                                        <span className="text-slate-500 font-bold"> · current {selectedVariantStock} units</span>
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
                                        {['Restock', 'Remove'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setAdjustType(type)}
                                                className={cn(
                                                    "flex-1 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all",
                                                    adjustType === type
                                                        ? "bg-white text-[#1c1c1e] shadow-xs"
                                                        : "text-slate-500 hover:text-slate-700"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider ml-0.5">Quantity Change</label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">#</div>
                                            <input
                                                type="number"
                                                min="1"
                                                value={adjustValue}
                                                onChange={(e) => setAdjustValue(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-semibold text-[#1c1c1e] focus:ring-1 focus:ring-red-500/20 focus:border-red-500/30 transition-all outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider ml-0.5">Note (Optional)</label>
                                        <textarea
                                            value={adjustNote}
                                            onChange={(e) => setAdjustNote(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-700 focus:ring-1 focus:ring-red-500/20 focus:border-red-500/30 transition-all outline-none resize-none h-16"
                                            placeholder="Reason for adjustment..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex gap-2.5">
                                <Button
                                    onClick={() => setIsAdjustModalOpen(false)}
                                    variant="outline"
                                    className="flex-1 py-2 text-[11px] font-semibold rounded-xl bg-white"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleFullAdjustment}
                                    disabled={isAdjusting}
                                    className="flex-1 py-2 text-[11px] font-semibold rounded-xl shadow-sm"
                                >
                                    {isAdjusting ? 'SAVING...' : 'SAVE CHANGES'}
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
