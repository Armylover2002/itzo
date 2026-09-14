import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useToast } from '@shared/components/ui/Toast';
import {
    HiOutlinePlus,
    HiOutlineTicket,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineTrash,
    HiOutlinePencilSquare,
    HiOutlineCalendarDays,
    HiOutlineUsers,
    HiOutlineBanknotes,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXMark,
    HiOutlineEye
} from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { adminApi } from '../services/adminApi';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import {
    buildQuickCouponPayload,
    toLocalDateInputValue,
    validateQuickCouponForm,
} from '../../shared/quickCouponForm';

const EMPTY_FORM = {
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: '',
    usageLimit: '',
    perUserLimit: '1',
    validFrom: '',
    validTill: '',
    firstOrderOnly: false,
    description: '',
};
const getCouponDisplayStatus = (coupon) => {
    const status = String(coupon?.effectiveStatus || '').trim().toLowerCase();
    if (status) return status;
    if (!coupon?.isActive) return 'inactive';
    const now = new Date();
    const start = coupon?.validFrom ? new Date(coupon.validFrom) : null;
    const end = coupon?.validTill ? new Date(coupon.validTill) : null;
    if (start && start > now) return 'scheduled';
    if (end) {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);
        if (today > endDay) return 'expired';
    }
    return coupon?.isActive ? 'active' : 'inactive';
};

const couponStatusMeta = {
    active: { label: 'active', variant: 'success' },
    expired: { label: 'expired', variant: 'secondary' },
    scheduled: { label: 'scheduled', variant: 'warning' },
    inactive: { label: 'inactive', variant: 'secondary' },
};


const CouponManagement = () => {
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

    const permissionKey = "quick::core_management::marketing_tools::coupons";
    const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
    const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
    const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");

    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [editingCoupon, setEditingCoupon] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);

    const [coupons, setCoupons] = useState([]);

    const [formData, setFormData] = useState(EMPTY_FORM);

    useEffect(() => {
        const fetchCoupons = async () => {
            try {
                setIsLoading(true);
                const res = await adminApi.getCoupons({
                    status: statusFilter === 'all' ? undefined : statusFilter,
                    search: searchTerm || undefined,
                });
                if (res.data.success) {
                    const list = res.data.result || res.data.results || [];
                    setCoupons(list);
                }
            } catch (error) {
                showToast('Failed to load coupons', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchCoupons();
    }, [statusFilter, searchTerm]);

    const stats = useMemo(() => {
        const active = coupons.filter((c) => getCouponDisplayStatus(c) === 'active');
        const expiringSoon = coupons.filter((c) => {
            if (!c.validTill || getCouponDisplayStatus(c) !== 'active') return false;
            const till = new Date(c.validTill);
            const diffDays = (till - new Date()) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 7;
        });
        return {
            total: coupons.length,
            active: active.length,
            totalRedeemed: coupons.reduce((acc, c) => acc + (c.usedCount || 0), 0),
            expiringSoon: expiringSoon.length,
        };
    }, [coupons]);

    const filteredCoupons = coupons;

    const handleOpenModal = (coupon = null) => {
        if (coupon) {
            setEditingCoupon(coupon);
            setFormData({
                code: coupon.code || '',
                discountType: coupon.discountType || 'percentage',
                discountValue: coupon.discountValue ?? '',
                minOrderValue: coupon.minOrderValue ?? '',
                maxDiscount: coupon.maxDiscount ?? '',
                usageLimit: coupon.usageLimit ?? '',
                perUserLimit: coupon.perUserLimit ?? '1',
                validFrom: toLocalDateInputValue(coupon.validFrom),
                validTill: toLocalDateInputValue(coupon.validTill),
                firstOrderOnly: Boolean(coupon.firstOrderOnly),
                description: coupon.description || '',
            });
        } else {
            setEditingCoupon(null);
            setFormData(EMPTY_FORM);
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errorMessage = validateQuickCouponForm(formData);
        if (errorMessage) {
            showToast(errorMessage, 'error');
            return;
        }
        try {
            const payload = buildQuickCouponPayload(formData);

            if (editingCoupon?._id) {
                await adminApi.updateCoupon(editingCoupon._id, payload);
                showToast('Coupon updated successfully', 'success');
            } else {
                await adminApi.createCoupon(payload);
                showToast('New coupon launched!', 'success');
            }
            setIsModalOpen(false);
            setEditingCoupon(null);
            const res = await adminApi.getCoupons();
            if (res.data.success) {
                const list = res.data.result || res.data.results || [];
                setCoupons(list);
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save coupon', 'error');
        }
    };

    const handleDelete = async (id) => {
        try {
            await adminApi.deleteCoupon(id);
            setCoupons(coupons.filter(c => c._id !== id));
            setDeleteTarget(null);
            showToast('Coupon removed', 'warning');
        } catch (error) {
            showToast('Failed to delete coupon', 'error');
        }
    };

    const handleToggleStatus = async (coupon) => {
        try {
            const res = await adminApi.toggleCouponStatus(coupon._id);
            if (res?.data?.success) {
                setCoupons(prev => prev.map(c => c._id === coupon._id ? { ...c, isActive: !c.isActive } : c));
                showToast(`Coupon ${!coupon.isActive ? 'activated' : 'deactivated'}`, 'success');
            }
        } catch (error) {
            showToast('Failed to toggle coupon status', 'error');
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Promo Engine
                        <Badge variant="primary" className="text-[10px] font-black uppercase tracking-widest">v4.2 PRO</Badge>
                    </h1>
                    <p className="ds-description mt-1">Design, deploy, and track high-conversion discount campaigns.</p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-6 py-3.5 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                    >
                        <HiOutlinePlus className="h-5 w-5" />
                        CREATE NEW PROMO
                    </button>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Coupons', value: stats.total, icon: HiOutlineTicket, color: 'indigo' },
                    { label: 'Active Codes', value: stats.active, icon: HiOutlineCheckCircle, color: 'emerald' },
                    { label: 'Redemptions', value: stats.totalRedeemed.toLocaleString(), icon: HiOutlineUsers, color: 'amber' },
                    { label: 'Expiring Soon', value: stats.expiringSoon, icon: HiOutlineClock, color: 'rose' },
                ].map((s, i) => (
                    <Card key={i} className="p-6 border-none shadow-xl ring-1 ring-slate-100 bg-white group hover:ring-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("p-2.5 rounded-2xl",
                                s.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                                s.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                                s.color === 'amber' && "bg-amber-50 text-amber-600",
                                s.color === 'rose' && "bg-rose-50 text-rose-600",
                            )}>
                                <s.icon className="h-6 w-6" />
                            </div>
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{s.label}</h4>
                        <h3 className="text-2xl font-black text-slate-900">{s.value}</h3>
                    </Card>
                ))}
            </div>

            {/* Main Content Area */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
                {/* Table Filters */}
                <div className="p-4 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative group flex-1 max-w-md">
                            <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by code or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-primary/10 transition-all"
                            />
                        </div>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                            {['all', 'active', 'expired'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setStatusFilter(filter)}
                                    className={cn(
                                        "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        statusFilter === filter ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Coupons Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coupon Code</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Offerings</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Validity</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading && (
                                <tr>
                                    <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">
                                        Loading coupons...
                                    </td>
                                </tr>
                            )}
                            {!isLoading && filteredCoupons.map((c) => (
                                <tr key={c._id} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-4 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                <HiOutlineTicket className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <span className="text-sm font-black text-slate-900 tracking-wider bg-slate-100 px-2 py-1 rounded-lg border-2 border-dashed border-slate-300">{c.code}</span>
                                                <p className="text-[10px] font-medium text-slate-400 mt-1 line-clamp-2">{c.description}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="space-y-1">
                                            <p className="text-xs font-black text-slate-900">
                                                {c.discountType === 'percentage' ? `${c.discountValue}% OFF` : c.discountType === 'free_delivery' ? 'Free Delivery' : `₹${c.discountValue} OFF`}
                                            </p>
                                            {c.minOrderValue > 0 && (
                                                <p className="text-[10px] font-bold text-slate-400">Min. Order: ₹{c.minOrderValue}</p>
                                            )}
                                            {c.firstOrderOnly && (
                                                <p className="text-[10px] font-bold text-indigo-600">First order only</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Redeemed</span>
                                                <span className="text-xs font-black text-slate-900">{c.usedCount || 0}{c.usageLimit ? `/${c.usageLimit}` : ''}</span>
                                            </div>
                                            <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                                    style={{ width: c.usageLimit ? `${((c.usedCount || 0) / c.usageLimit) * 100}%` : '0%' }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center gap-2 text-slate-500">
                                            <HiOutlineCalendarDays className="h-4 w-4" />
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">
                                                {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : '—'} - {c.validTill ? new Date(c.validTill).toLocaleDateString() : '—'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 text-center">
                                        {(() => {
                                            const status = getCouponDisplayStatus(c);
                                            const meta = couponStatusMeta[status] || couponStatusMeta.inactive;
                                            return (
                                                <Badge variant={meta.variant} className="text-[9px] font-black uppercase">
                                                    {meta.label}
                                                </Badge>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center justify-end gap-2">
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleToggleStatus(c)}
                                                    disabled={getCouponDisplayStatus(c) === 'expired'}
                                                    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${c.isActive && getCouponDisplayStatus(c) === 'active' ? 'bg-green-500' : 'bg-slate-300'} ${getCouponDisplayStatus(c) === 'expired' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    title={getCouponDisplayStatus(c) === 'expired' ? 'Expired coupon' : (c.isActive ? 'Deactivate' : 'Activate')}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${c.isActive && getCouponDisplayStatus(c) === 'active' ? 'translate-x-7' : 'translate-x-1'}`} />
                                                </button>
                                            )}
                                            {canEdit && (
                                                <button
                                                    onClick={() => handleOpenModal(c)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                                                >
                                                    <HiOutlinePencilSquare className="h-5 w-5" />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => setDeleteTarget(c)}
                                                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                                                >
                                                    <HiOutlineTrash className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredCoupons.length === 0 && (
                    <div className="p-20 text-center">
                        <div className="h-20 w-20 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-6">
                            <HiOutlineTicket className="h-10 w-10 text-slate-200" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900">No codes found</h3>
                        <p className="text-sm font-bold text-slate-400 mt-2">Try adjusting your filters or create a new promotion.</p>
                    </div>
                )}
            </Card>

            {/* Delete confirmation dialog */}
            <AnimatePresence>
                {deleteTarget && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                                    <HiOutlineTrash className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">Delete coupon?</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    Are you sure you want to remove{' '}
                                    <span className="font-semibold text-slate-900">{deleteTarget.code}</span>? This action cannot be undone.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => setDeleteTarget(null)}
                                        className="px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleDelete(deleteTarget._id)}
                                        className="px-4 py-2.5 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal for Create/Edit */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingCoupon ? "Modify Promotion" : "New Promotion Protocol"}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promo Code</label>
                            <input
                                required
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="E.G. SUMMER50"
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black uppercase tracking-widest outline-none ring-1 ring-transparent focus:ring-primary/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount Type</label>
                            <select
                                value={formData.discountType}
                                onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (₹)</option>
                                <option value="free_delivery">Free Delivery</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {formData.discountType !== 'free_delivery' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Discount Value</label>
                                <input
                                    required
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={formData.discountValue}
                                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Min Order Value (₹)</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.minOrderValue}
                                onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Max Discount (optional)</label>
                            <input
                                type="number"
                                min="0"
                                value={formData.maxDiscount}
                                disabled={formData.discountType === 'fixed' || formData.discountType === 'free_delivery'}
                                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none disabled:opacity-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Usage Limit (optional)</label>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={formData.usageLimit}
                                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Per User Limit</label>
                            <input
                                type="number"
                                min={1}
                                step="1"
                                value={formData.perUserLimit}
                                onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            />
                        </div>
                        <div className="space-y-2 flex items-end">
                            <label className="flex items-center gap-3 w-full px-4 py-3 bg-slate-50 rounded-2xl cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={Boolean(formData.firstOrderOnly)}
                                    onChange={(e) => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
                                />
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">First order only</span>
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                            <input
                                required
                                type="date"
                                value={formData.validFrom}
                                onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                            <input
                                required
                                type="date"
                                value={formData.validTill}
                                min={formData.validFrom || undefined}
                                onChange={(e) => setFormData({ ...formData, validTill: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 -mt-3">Same start and end date is allowed.</p>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                        <textarea
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Briefly describe the campaign..."
                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-black outline-none resize-none"
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                        >
                            {editingCoupon ? 'SAVE CHANGES' : 'LAUNCH CAMPAIGN'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default CouponManagement;
