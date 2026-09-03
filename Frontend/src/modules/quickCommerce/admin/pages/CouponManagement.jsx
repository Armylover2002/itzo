import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
    HiOutlinePlus,
    HiOutlineTicket,
    HiOutlineMagnifyingGlass,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineCalendarDays,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineBuildingStorefront,
    HiOutlineArrowPath,
    HiOutlineCheck
} from 'react-icons/hi2';
import { Building2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';

const getCouponDynamicStatus = (coupon) => {
    if (!coupon.isActive) {
        return {
            key: 'inactive',
            label: 'Inactive',
            badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
        };
    }
    const now = new Date();
    const start = coupon.validFrom ? new Date(coupon.validFrom) : null;
    const end = coupon.validTill ? new Date(coupon.validTill) : null;

    if (end && end < now) {
        return {
            key: 'expired',
            label: 'Expired',
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }
    if (start && start > now) {
        return {
            key: 'scheduled',
            label: 'Scheduled',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
        };
    }
    return {
        key: 'active',
        label: 'Active',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
};

const getSellerShopImage = (seller) => {
    if (!seller) return '';
    return (
        seller.shopInfo?.shopImage ||
        seller.shopImage ||
        seller.logo ||
        seller.avatar ||
        seller.image ||
        ''
    );
};

const CouponManagement = () => {
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSellerPickerOpen, setIsSellerPickerOpen] = useState(false);
    const [sellerSearchQuery, setSellerSearchQuery] = useState('');
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusUpdatingId, setStatusUpdatingId] = useState(null);

    const [coupons, setCoupons] = useState([]);
    const [sellers, setSellers] = useState([]);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const [formData, setFormData] = useState({
        code: '',
        title: '',
        discountType: 'percentage',
        discountValue: '',
        minOrderValue: '',
        maxDiscount: '',
        usageLimit: '',
        perUserLimit: '1',
        validFrom: '',
        validTill: '',
        scope: 'all',
        sellerIds: [],
        selectedSellers: [],
        description: '',
    });

    const fetchCoupons = async () => {
        try {
            setIsLoading(true);
            const res = await adminApi.getCoupons({
                search: searchTerm || undefined,
            });
            if (res.data?.success) {
                const list = res.data.result || res.data.results || [];
                setCoupons(Array.isArray(list) ? list : []);
            }
        } catch (error) {
            showToast('Failed to load coupons', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSellers = async () => {
        try {
            let list = [];
            // Try bootstrap first as it returns active approved sellers
            try {
                const bRes = await adminApi.getSellerCommissionBootstrap();
                const bData = bRes.data?.data || bRes.data?.result;
                if (Array.isArray(bData?.sellers)) {
                    list = bData.sellers;
                }
            } catch {
                // ignore
            }

            if (list.length === 0) {
                const sRes = await adminApi.getSellers();
                const raw = sRes.data?.result?.items || sRes.data?.sellers || sRes.data?.result || [];
                list = Array.isArray(raw) ? raw : [];
            }
            setSellers(list);
        } catch (err) {
            console.error('Failed to fetch sellers:', err);
            setSellers([]);
        }
    };

    useEffect(() => {
        fetchCoupons();
        fetchSellers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm]);

    // Compute dynamic statistics
    const stats = useMemo(() => {
        let activeCount = 0;
        let scheduledCount = 0;
        let expiredCount = 0;
        let inactiveCount = 0;
        let totalRedeemed = 0;

        coupons.forEach((c) => {
            totalRedeemed += c.usedCount || 0;
            const status = getCouponDynamicStatus(c);
            if (status.key === 'active') activeCount++;
            else if (status.key === 'scheduled') scheduledCount++;
            else if (status.key === 'expired') expiredCount++;
            else if (status.key === 'inactive') inactiveCount++;
        });

        return {
            total: coupons.length,
            active: activeCount,
            scheduled: scheduledCount,
            expired: expiredCount,
            inactive: inactiveCount,
            totalRedeemed,
        };
    }, [coupons]);

    // Filter sellers for the picker modal
    const filteredPickerSellers = useMemo(() => {
        if (!Array.isArray(sellers)) return [];
        if (!sellerSearchQuery.trim()) return sellers;
        const q = sellerSearchQuery.toLowerCase().trim();
        return sellers.filter((s) => {
            const sName = (s.shopName || s.name || '').toLowerCase();
            const sPhone = (s.phone || '').toLowerCase();
            const sId = String(s._id || s.id || '').toLowerCase();
            return sName.includes(q) || sPhone.includes(q) || sId.includes(q);
        });
    }, [sellers, sellerSearchQuery]);

    // Client-side filtering by dynamic status
    const filteredCoupons = useMemo(() => {
        return coupons.filter((c) => {
            if (statusFilter === 'all') return true;
            const status = getCouponDynamicStatus(c);
            return status.key === statusFilter;
        });
    }, [coupons, statusFilter]);

    const handleOpenModal = (coupon = null) => {
        if (coupon) {
            setEditingCoupon(coupon);
            const fromStr = coupon.validFrom ? coupon.validFrom.substring(0, 10) : '';
            const tillStr = coupon.validTill ? coupon.validTill.substring(0, 10) : '';

            // Extract seller IDs: support both sellerIds array and legacy sellerId
            let extractedIds = [];
            let extractedSellerObjs = [];

            if (Array.isArray(coupon.sellerIds) && coupon.sellerIds.length > 0) {
                coupon.sellerIds.forEach((item) => {
                    if (item && typeof item === 'object') {
                        const sid = String(item._id || item.id);
                        extractedIds.push(sid);
                        extractedSellerObjs.push(item);
                    } else if (item) {
                        const sid = String(item);
                        extractedIds.push(sid);
                        const found = sellers.find((s) => String(s._id || s.id) === sid);
                        if (found) extractedSellerObjs.push(found);
                    }
                });
            } else if (coupon.sellerId) {
                const sObj = typeof coupon.sellerId === 'object' ? coupon.sellerId : null;
                const sid = String(sObj?._id || coupon.sellerId);
                extractedIds.push(sid);
                const found = sObj || sellers.find((s) => String(s._id || s.id) === sid);
                if (found) extractedSellerObjs.push(found);
            }

            const hasSellerScope = extractedIds.length > 0 || coupon.scope === 'seller';

            setFormData({
                code: coupon.code || '',
                title: coupon.title || '',
                discountType: coupon.discountType || 'percentage',
                discountValue: coupon.discountValue ?? '',
                minOrderValue: coupon.minOrderValue ?? '',
                maxDiscount: coupon.maxDiscount ?? '',
                usageLimit: coupon.usageLimit ?? '',
                perUserLimit: coupon.perUserLimit ?? '1',
                validFrom: fromStr,
                validTill: tillStr,
                scope: hasSellerScope ? 'seller' : 'all',
                sellerIds: extractedIds,
                selectedSellers: extractedSellerObjs,
                description: coupon.description || '',
            });
        } else {
            setEditingCoupon(null);
            setFormData({
                code: '',
                title: '',
                discountType: 'percentage',
                discountValue: '',
                minOrderValue: '',
                maxDiscount: '',
                usageLimit: '',
                perUserLimit: '1',
                validFrom: todayStr,
                validTill: todayStr,
                scope: 'all',
                sellerIds: [],
                selectedSellers: [],
                description: '',
            });
        }
        setIsModalOpen(true);
    };

    // Toggle seller selection in multi-select picker
    const handleToggleSellerSelection = (seller) => {
        const sid = String(seller._id || seller.id);
        setFormData((prev) => {
            const isAlreadySelected = prev.sellerIds.includes(sid);
            if (isAlreadySelected) {
                return {
                    ...prev,
                    sellerIds: prev.sellerIds.filter((id) => id !== sid),
                    selectedSellers: prev.selectedSellers.filter((s) => String(s._id || s.id) !== sid),
                };
            } else {
                return {
                    ...prev,
                    sellerIds: [...prev.sellerIds, sid],
                    selectedSellers: [...prev.selectedSellers, seller],
                };
            }
        });
    };

    // Remove single seller from form chips
    const handleRemoveSellerChip = (sellerId) => {
        const sid = String(sellerId);
        setFormData((prev) => ({
            ...prev,
            sellerIds: prev.sellerIds.filter((id) => id !== sid),
            selectedSellers: prev.selectedSellers.filter((s) => String(s._id || s.id) !== sid),
        }));
    };

    // Select all filtered sellers in picker
    const handleSelectAllFilteredSellers = () => {
        const newIds = [...formData.sellerIds];
        const newSellers = [...formData.selectedSellers];

        filteredPickerSellers.forEach((s) => {
            const sid = String(s._id || s.id);
            if (!newIds.includes(sid)) {
                newIds.push(sid);
                newSellers.push(s);
            }
        });

        setFormData((prev) => ({
            ...prev,
            sellerIds: newIds,
            selectedSellers: newSellers,
        }));
    };

    // Clear all seller selections in picker
    const handleClearAllSellers = () => {
        setFormData((prev) => ({
            ...prev,
            sellerIds: [],
            selectedSellers: [],
        }));
    };

    const handleToggleStatus = async (coupon) => {
        const id = coupon._id || coupon.id;
        const nextActive = !coupon.isActive;
        setStatusUpdatingId(id);
        try {
            await adminApi.toggleCouponStatus(id, nextActive);
            setCoupons((prev) =>
                prev.map((c) => ((c._id || c.id) === id ? { ...c, isActive: nextActive } : c))
            );
            showToast(`Coupon ${coupon.code} ${nextActive ? 'activated' : 'deactivated'}`, 'info');
        } catch (err) {
            showToast('Failed to update coupon status', 'error');
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const cleanCode = formData.code.trim().toUpperCase();
        if (!cleanCode) {
            showToast('Please enter a valid coupon code', 'error');
            return;
        }

        const discVal = Number(formData.discountValue);
        if (isNaN(discVal) || discVal <= 0) {
            showToast('Please enter a valid discount value greater than 0', 'error');
            return;
        }

        if (formData.discountType === 'percentage' && discVal > 100) {
            showToast('Percentage discount cannot exceed 100%', 'error');
            return;
        }

        if (formData.validFrom && formData.validTill && formData.validTill < formData.validFrom) {
            showToast('End date cannot be earlier than start date', 'error');
            return;
        }

        if (formData.scope === 'seller' && formData.sellerIds.length === 0) {
            showToast('Please select at least one seller or choose All Sellers', 'error');
            return;
        }

        try {
            setIsSubmitting(true);
            const payload = {
                code: cleanCode,
                title: formData.title.trim() || cleanCode,
                discountType: formData.discountType,
                discountValue: discVal,
                minOrderValue: formData.minOrderValue ? Number(formData.minOrderValue) : 0,
                maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : undefined,
                usageLimit: formData.usageLimit ? Number(formData.usageLimit) : undefined,
                perUserLimit: formData.perUserLimit ? Number(formData.perUserLimit) : 1,
                validFrom: formData.validFrom || undefined,
                validTill: formData.validTill || undefined,
                scope: formData.scope,
                sellerIds: formData.scope === 'seller' ? formData.sellerIds : [],
                sellerId: formData.scope === 'seller' ? (formData.sellerIds[0] || null) : null,
                description: formData.description.trim(),
                couponType: 'generic',
            };

            const targetId = editingCoupon?._id || editingCoupon?.id;
            if (targetId) {
                await adminApi.updateCoupon(targetId, payload);
                showToast(`Coupon ${cleanCode} updated successfully!`, 'success');
            } else {
                await adminApi.createCoupon(payload);
                showToast(`Coupon ${cleanCode} created successfully!`, 'success');
            }

            setIsModalOpen(false);
            setEditingCoupon(null);
            fetchCoupons();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save coupon', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const targetId = deleteTarget._id || deleteTarget.id;
        try {
            setIsDeleting(true);
            await adminApi.deleteCoupon(targetId);
            setCoupons((prev) => prev.filter((c) => (c._id || c.id) !== targetId));
            showToast(`Coupon ${deleteTarget.code} deleted successfully`, 'warning');
            setDeleteTarget(null);
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to delete coupon', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-16">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="ds-h1 tracking-tight">Coupon Management</h1>
                        <span className="px-2.5 py-0.5 bg-[#6412C6]/10 text-[#6412C6] border border-[#6412C6]/20 rounded-lg text-[10px] font-black uppercase tracking-wider">
                            Active Engine
                        </span>
                    </div>
                    <p className="ds-description mt-1">Create, manage, and monitor discount coupons and promotional campaigns.</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={fetchCoupons}
                        className="p-2.5 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-600 active:scale-95 shadow-xs"
                        title="Refresh Coupons"
                    >
                        <HiOutlineArrowPath className={cn("h-4 w-4", isLoading && "animate-spin text-[#6412C6]")} />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#6412C6] hover:bg-[#520da7] text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-[#6412C6]/25 active:scale-95 transition-all"
                    >
                        <HiOutlinePlus className="h-4 w-4 stroke-2" />
                        CREATE COUPON
                    </button>
                </div>
            </div>

            {/* Dynamic Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Coupons', value: stats.total, sub: 'Created Coupons', icon: HiOutlineTicket, bg: 'bg-[#6412C6]/10 text-[#6412C6]' },
                    { label: 'Active Now', value: stats.active, sub: 'Currently Redeemable', icon: HiOutlineCheckCircle, bg: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Scheduled', value: stats.scheduled, sub: 'Upcoming Validity', icon: HiOutlineClock, bg: 'bg-amber-50 text-amber-600' },
                    { label: 'Expired / Inactive', value: stats.expired + stats.inactive, sub: `${stats.expired} Expired, ${stats.inactive} Inactive`, icon: HiOutlineXCircle, bg: 'bg-rose-50 text-rose-600' },
                ].map((s, i) => (
                    <Card key={i} className="p-5 border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl flex items-center gap-4">
                        <div className={cn("p-3.5 rounded-2xl shrink-0", s.bg)}>
                            <s.icon className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{s.label}</p>
                            <h3 className="text-2xl font-black text-slate-900">{s.value}</h3>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">{s.sub}</p>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Coupons Table Card */}
            <Card className="border-none shadow-md ring-1 ring-slate-100 bg-white rounded-2xl overflow-hidden">
                {/* Search and Filters Bar */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by code or title..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-semibold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl gap-1">
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'active', label: 'Active' },
                            { key: 'scheduled', label: 'Scheduled' },
                            { key: 'expired', label: 'Expired' },
                            { key: 'inactive', label: 'Inactive' },
                        ].map((filter) => (
                            <button
                                key={filter.key}
                                type="button"
                                onClick={() => setStatusFilter(filter.key)}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all",
                                    statusFilter === filter.key
                                        ? "bg-[#6412C6] text-white shadow-xs"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-100">
                                <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coupon Details</th>
                                <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount</th>
                                <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Scope / Sellers</th>
                                <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validity Period</th>
                                <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                            <div className="h-7 w-7 border-2 border-[#6412C6] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Loading coupons...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCoupons.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-16">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                                                <HiOutlineTicket className="h-8 w-8" />
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-700">No coupons found</h4>
                                            <p className="text-xs text-slate-400">Try adjusting your filters or create a new coupon.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredCoupons.map((c) => {
                                    const cid = c._id || c.id;
                                    const statusInfo = getCouponDynamicStatus(c);

                                    // Gather sellers for display (supporting multiple sellers)
                                    const sellerList = [];
                                    if (Array.isArray(c.sellerIds) && c.sellerIds.length > 0) {
                                        c.sellerIds.forEach((item) => {
                                            if (item && typeof item === 'object') sellerList.push(item);
                                            else if (item) {
                                                const found = sellers.find((s) => String(s._id || s.id) === String(item));
                                                if (found) sellerList.push(found);
                                            }
                                        });
                                    } else if (c.sellerId) {
                                        const sObj = typeof c.sellerId === 'object' ? c.sellerId : null;
                                        const found = sObj || sellers.find((s) => String(s._id || s.id) === String(c.sellerId));
                                        if (found) sellerList.push(found);
                                    }

                                    const isSpecific = c.scope === 'seller' || sellerList.length > 0;

                                    return (
                                        <tr key={cid} className="hover:bg-slate-50/70 transition-colors group">
                                            <td className="px-5 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-[#6412C6]/10 text-[#6412C6] flex items-center justify-center shrink-0 mt-0.5">
                                                        <HiOutlineTicket className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-[#6412C6] tracking-wider bg-[#6412C6]/5 px-2.5 py-0.5 rounded border border-[#6412C6]/20">
                                                                {c.code}
                                                            </span>
                                                        </div>
                                                        {c.title && c.title !== c.code && (
                                                            <p className="text-xs font-bold text-slate-800 mt-1">{c.title}</p>
                                                        )}
                                                        {c.description && (
                                                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 max-w-xs">{c.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-black text-slate-900">
                                                        {c.discountType === 'percentage'
                                                            ? `${c.discountValue}% OFF`
                                                            : c.discountType === 'free_delivery'
                                                            ? 'Free Delivery'
                                                            : `₹${c.discountValue} FLAT OFF`}
                                                    </p>
                                                    {c.maxDiscount > 0 && c.discountType === 'percentage' && (
                                                        <p className="text-[10px] font-bold text-slate-400">Up to ₹{c.maxDiscount}</p>
                                                    )}
                                                    {c.minOrderValue > 0 ? (
                                                        <p className="text-[10px] font-semibold text-slate-500">Min. Order: ₹{c.minOrderValue}</p>
                                                    ) : (
                                                        <p className="text-[10px] text-slate-400">No Min. Order</p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {isSpecific && sellerList.length > 0 ? (
                                                    <div className="space-y-1 max-w-xs">
                                                        {sellerList.length === 1 ? (
                                                            <div className="flex items-center gap-2 p-1.5 pr-3 bg-purple-50/60 rounded-xl border border-purple-100">
                                                                {getSellerShopImage(sellerList[0]) ? (
                                                                    <img
                                                                        src={getSellerShopImage(sellerList[0])}
                                                                        alt={sellerList[0].shopName || 'Shop'}
                                                                        className="h-8 w-8 rounded-lg object-cover bg-white ring-1 ring-purple-200 shrink-0"
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(sellerList[0].shopName || 'shop')}`;
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <div className="h-8 w-8 rounded-lg bg-purple-100 text-[#6412C6] flex items-center justify-center shrink-0">
                                                                        <Building2 className="h-4 w-4" />
                                                                    </div>
                                                                )}
                                                                <div className="overflow-hidden">
                                                                    <p className="text-xs font-black text-slate-900 truncate">
                                                                        {sellerList[0].shopName || sellerList[0].name || 'Seller Store'}
                                                                    </p>
                                                                    <span className="text-[9px] font-bold text-purple-700 uppercase tracking-wider">
                                                                        1 Specific Seller
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="p-2 bg-purple-50/70 border border-purple-200 rounded-xl">
                                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                                    <span className="text-[10px] font-black text-[#6412C6] uppercase tracking-wider">
                                                                        {sellerList.length} Specific Sellers
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                                                                    {sellerList.slice(0, 4).map((s, idx) => {
                                                                        const simg = getSellerShopImage(s);
                                                                        return simg ? (
                                                                            <img
                                                                                key={idx}
                                                                                src={simg}
                                                                                alt={s.shopName || 'Shop'}
                                                                                title={s.shopName || s.name}
                                                                                className="h-7 w-7 rounded-full object-cover ring-2 ring-white shrink-0 bg-white"
                                                                                onError={(e) => {
                                                                                    e.target.onerror = null;
                                                                                    e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(s.shopName || 'shop')}`;
                                                                                }}
                                                                            />
                                                                        ) : (
                                                                            <div
                                                                                key={idx}
                                                                                title={s.shopName || s.name}
                                                                                className="h-7 w-7 rounded-full bg-purple-200 text-[#6412C6] ring-2 ring-white flex items-center justify-center text-[10px] font-bold shrink-0"
                                                                            >
                                                                                {(s.shopName || s.name || 'S').charAt(0).toUpperCase()}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                    {sellerList.length > 4 && (
                                                                        <div className="h-7 w-7 rounded-full bg-[#6412C6] text-white ring-2 ring-white flex items-center justify-center text-[9px] font-black shrink-0">
                                                                            +{sellerList.length - 4}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 truncate mt-0.5" title={sellerList.map(s => s.shopName || s.name).join(', ')}>
                                                                    {sellerList.map(s => s.shopName || s.name).join(', ')}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200">
                                                        <HiOutlineBuildingStorefront className="h-3.5 w-3.5 text-slate-500" />
                                                        <span className="text-xs font-bold">All Sellers (Store-wide)</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold">
                                                    <HiOutlineCalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                                                    <span>
                                                        {c.validFrom ? new Date(c.validFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Any'}
                                                        {' → '}
                                                        {c.validTill ? new Date(c.validTill).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No Expiry'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <div className="inline-flex items-center justify-center gap-2">
                                                    <span className={cn(
                                                        "text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border",
                                                        statusInfo.badgeClass
                                                    )}>
                                                        {statusInfo.label}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleStatus(c)}
                                                        disabled={statusUpdatingId === cid}
                                                        className={cn(
                                                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                                            c.isActive ? 'bg-[#6412C6]' : 'bg-slate-300',
                                                            statusUpdatingId === cid && 'opacity-60 cursor-not-allowed'
                                                        )}
                                                        title={c.isActive ? 'Click to Deactivate' : 'Click to Activate'}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out",
                                                                c.isActive ? 'translate-x-4' : 'translate-x-0'
                                                            )}
                                                        />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenModal(c)}
                                                        className="p-2 rounded-xl bg-[#6412C6]/10 text-[#6412C6] hover:bg-[#6412C6] hover:text-white transition-all active:scale-90"
                                                        title="Edit Coupon"
                                                    >
                                                        <HiOutlinePencilSquare className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteTarget(c)}
                                                        className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all active:scale-90"
                                                        title="Delete Coupon"
                                                    >
                                                        <HiOutlineTrash className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create & Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingCoupon(null);
                }}
                title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : "Create New Coupon"}
                size="lg"
            >
                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    {/* Code & Title */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Coupon Code <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\s+/g, '').toUpperCase() })}
                                placeholder="E.G. FLAT50, WELCOME10"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Coupon Title</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Display title (e.g. Summer Special)"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Scope: All Sellers or Specific Seller(s) */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-700">Applicable Store / Sellers</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label
                                className={cn(
                                    "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all",
                                    formData.scope === 'all'
                                        ? "border-[#6412C6] bg-[#6412C6]/5 text-[#6412C6] font-bold shadow-xs"
                                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                )}
                            >
                                <input
                                    type="radio"
                                    name="scope"
                                    checked={formData.scope === 'all'}
                                    onChange={() => setFormData({ ...formData, scope: 'all', sellerIds: [], selectedSellers: [] })}
                                    className="accent-[#6412C6]"
                                />
                                <span className="text-xs font-bold">All Sellers (Store-wide)</span>
                            </label>

                            <label
                                className={cn(
                                    "flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all",
                                    formData.scope === 'seller'
                                        ? "border-[#6412C6] bg-[#6412C6]/5 text-[#6412C6] font-bold shadow-xs"
                                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                                )}
                            >
                                <input
                                    type="radio"
                                    name="scope"
                                    checked={formData.scope === 'seller'}
                                    onChange={() => {
                                        setFormData((prev) => ({ ...prev, scope: 'seller' }));
                                        if (formData.selectedSellers.length === 0) {
                                            setIsSellerPickerOpen(true);
                                        }
                                    }}
                                    className="accent-[#6412C6]"
                                />
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold">Specific Seller(s)</span>
                                    {formData.selectedSellers.length > 0 && (
                                        <span className="px-1.5 py-0.2 bg-[#6412C6] text-white text-[10px] font-black rounded-full">
                                            {formData.selectedSellers.length}
                                        </span>
                                    )}
                                </div>
                            </label>
                        </div>

                        {/* Selected Sellers Container */}
                        {formData.scope === 'seller' && (
                            <div className="pt-1 space-y-2">
                                {formData.selectedSellers.length > 0 ? (
                                    <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-[#6412C6]">
                                                {formData.selectedSellers.length} Seller{formData.selectedSellers.length > 1 ? 's' : ''} Selected
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsSellerPickerOpen(true)}
                                                className="px-2.5 py-1 bg-[#6412C6] text-white rounded-lg text-xs font-bold hover:bg-[#520da7] transition-colors shadow-xs"
                                            >
                                                + Add / Edit Sellers
                                            </button>
                                        </div>

                                        {/* Multi-seller Pills */}
                                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                                            {formData.selectedSellers.map((seller) => {
                                                const sid = String(seller._id || seller.id);
                                                const simg = getSellerShopImage(seller);
                                                const sname = seller.shopName || seller.name || 'Store';

                                                return (
                                                    <div
                                                        key={sid}
                                                        className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-white border border-purple-200 rounded-xl shadow-xs"
                                                    >
                                                        {simg ? (
                                                            <img
                                                                src={simg}
                                                                alt={sname}
                                                                className="h-6 w-6 rounded-lg object-cover ring-1 ring-purple-200 bg-white shrink-0"
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(sname)}`;
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="h-6 w-6 rounded-lg bg-purple-100 text-[#6412C6] flex items-center justify-center shrink-0">
                                                                <Building2 className="h-3.5 w-3.5" />
                                                            </div>
                                                        )}
                                                        <span className="text-xs font-bold text-slate-800 max-w-[140px] truncate">
                                                            {sname}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSellerChip(sid)}
                                                            className="p-0.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                                                            title="Remove seller"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setIsSellerPickerOpen(true)}
                                        className="w-full p-3.5 border-2 border-dashed border-purple-300 rounded-xl bg-purple-50/40 text-purple-800 text-xs font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Building2 className="h-4 w-4 text-[#6412C6]" />
                                        <span>Click here to select specific sellers...</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Discount Type & Value */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Discount Type</label>
                            <select
                                value={formData.discountType}
                                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            >
                                <option value="percentage">Percentage Discount (%)</option>
                                <option value="fixed">Flat Discount (₹)</option>
                                <option value="free_delivery">Free Delivery</option>
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Discount Value {formData.discountType === 'percentage' ? '(%)' : '(₹)'} <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="number"
                                min="0"
                                max={formData.discountType === 'percentage' ? 100 : undefined}
                                step="any"
                                value={formData.discountValue}
                                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                placeholder={formData.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 100'}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Min Order & Max Discount */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Min. Order Value (₹)</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.minOrderValue}
                                onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                                placeholder="0 for no minimum"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Max Discount Cap (₹) {formData.discountType !== 'percentage' && '(Optional)'}
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={formData.maxDiscount}
                                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                                placeholder="e.g. 150 (Leave empty for no limit)"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Usage Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Total Uses Limit</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.usageLimit}
                                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                                placeholder="Leave empty for unlimited"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">Uses Per Customer</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.perUserLimit}
                                onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                                placeholder="1"
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Start Date & End Date (No previous dates, same day allowed) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                Start Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="date"
                                min={editingCoupon ? undefined : todayStr}
                                value={formData.validFrom}
                                onChange={(e) => {
                                    const nextFrom = e.target.value;
                                    setFormData((prev) => ({
                                        ...prev,
                                        validFrom: nextFrom,
                                        validTill: prev.validTill && prev.validTill < nextFrom ? nextFrom : prev.validTill,
                                    }));
                                }}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                            <span className="text-[10px] text-slate-400">Coupon becomes valid from this day</span>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">
                                End Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                required
                                type="date"
                                min={formData.validFrom || todayStr}
                                value={formData.validTill}
                                onChange={(e) => setFormData({ ...formData, validTill: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-[#6412C6] focus:bg-white transition-all"
                            />
                            <span className="text-[10px] text-slate-400">Can be the same day or a future date</span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Terms / Description</label>
                        <textarea
                            rows={2}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description for customer view or internal records..."
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#6412C6] focus:bg-white transition-all resize-none"
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                setIsModalOpen(false);
                                setEditingCoupon(null);
                            }}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-3 bg-[#6412C6] hover:bg-[#520da7] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#6412C6]/25 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSubmitting
                                ? 'Saving...'
                                : editingCoupon
                                ? 'Save Changes'
                                : 'Create Coupon'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Multi-Select Seller Modal */}
            <Modal
                isOpen={isSellerPickerOpen}
                onClose={() => setIsSellerPickerOpen(false)}
                title="Select Specific Sellers"
                size="md"
            >
                <div className="space-y-3 pt-1">
                    {/* Search and Selection Summary */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search approved sellers..."
                            value={sellerSearchQuery}
                            onChange={(e) => setSellerSearchQuery(e.target.value)}
                            className="pl-11 pr-4 py-3 w-full text-sm rounded-2xl bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-[#6412C6]/20 outline-none transition-all placeholder:text-slate-300 font-semibold"
                        />
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>

                    {/* Quick Selection Buttons */}
                    <div className="flex items-center justify-between px-1 py-1 text-xs">
                        <span className="font-bold text-slate-600">
                            <span className="text-[#6412C6] font-black">{formData.sellerIds.length}</span> seller{formData.sellerIds.length !== 1 ? 's' : ''} selected
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAllFilteredSellers}
                                className="text-xs font-bold text-[#6412C6] hover:underline"
                            >
                                Select All
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                                type="button"
                                onClick={handleClearAllSellers}
                                className="text-xs font-bold text-rose-600 hover:underline"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {/* Seller List with Multi-Select Checkboxes */}
                    <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                        {filteredPickerSellers.length > 0 ? (
                            filteredPickerSellers.map((s) => {
                                const sid = String(s._id || s.id);
                                const sname = s.shopName || s.name || 'Store';
                                const simg = getSellerShopImage(s);
                                const isSelected = formData.sellerIds.includes(sid);

                                return (
                                    <button
                                        key={sid}
                                        type="button"
                                        onClick={() => handleToggleSellerSelection(s)}
                                        className={cn(
                                            "w-full p-3 text-left rounded-2xl ring-1 transition-all flex items-center justify-between gap-3 group",
                                            isSelected
                                                ? "bg-[#6412C6]/10 ring-[#6412C6]"
                                                : "ring-slate-100 hover:bg-[#6412C6]/5 hover:ring-[#6412C6]/30"
                                        )}
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {/* Checkbox Icon */}
                                            <div
                                                className={cn(
                                                    "w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors",
                                                    isSelected
                                                        ? "bg-[#6412C6] border-[#6412C6] text-white"
                                                        : "border-slate-300 bg-white"
                                                )}
                                            >
                                                {isSelected && <HiOutlineCheck className="w-3.5 h-3.5 stroke-[3]" />}
                                            </div>

                                            {/* Shop Image */}
                                            {simg ? (
                                                <img
                                                    src={simg}
                                                    alt={sname}
                                                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200 shrink-0 bg-white"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(sname)}`;
                                                    }}
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-[#6412C6]/10 group-hover:text-[#6412C6] flex items-center justify-center shrink-0 transition-colors">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                            )}

                                            {/* Shop Name & Details */}
                                            <div className="overflow-hidden">
                                                <p className="font-black text-sm text-slate-900 group-hover:text-[#6412C6] transition-colors truncate">
                                                    {sname}
                                                </p>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                                                    {String(sid).slice(-8).toUpperCase()}
                                                    {s.phone ? ` • ${s.phone}` : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-[#6412C6]/10 transition-all shrink-0">
                                            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-[#6412C6] transition-colors" />
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center py-10 text-center">
                                <div className="p-3 bg-slate-50 rounded-full mb-2">
                                    <Building2 className="h-6 w-6 text-slate-300" />
                                </div>
                                <p className="text-sm font-bold text-slate-600">No approved sellers found</p>
                                <p className="text-xs text-slate-400 mt-1">Try a different search query</p>
                            </div>
                        )}
                    </div>

                    {/* Done / Confirm button */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setIsSellerPickerOpen(false)}
                            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSellerPickerOpen(false)}
                            className="flex-1 py-2.5 bg-[#6412C6] hover:bg-[#520da7] text-white rounded-xl text-xs font-bold shadow-md shadow-[#6412C6]/20 transition-all"
                        >
                            Done ({formData.sellerIds.length} Selected)
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center"
                        >
                            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                                <HiOutlineTrash className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-black text-slate-900 mb-1">Delete Coupon?</h3>
                            <p className="text-slate-500 text-xs mb-6">
                                Are you sure you want to remove promo code{' '}
                                <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {deleteTarget.code}
                                </span>
                                ? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    type="button"
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={handleDelete}
                                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition-all disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CouponManagement;
