import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import {
    Banknote,
    Clock,
    CheckCircle2,
    XCircle,
    Search,
    Filter,
    ChevronRight,
    Building2,
    Truck,
    ArrowUpRight,
    CreditCard,
    MoreVertical,
    Download,
    Eye,
    CheckCircle,
    FileText,
    AlertCircle,
    RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@shared/components/ui/Pagination';
import { PAGINATION_CONFIG } from '@/shared/constants/pagination';
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";

const WithdrawalRequests = () => {
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

    const permissionKey = "quick::core_management::withdrawals";
    const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState({ isOpen: false, type: null, request: null });
    const [rejectReason, setRejectReason] = useState('');

    const [sellerRequests, setSellerRequests] = useState([]);
    const [sellerPage, setSellerPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
    const [sellerTotal, setSellerTotal] = useState(0);
    const [financeSummary, setFinanceSummary] = useState({});
    const [withdrawalLimits, setWithdrawalLimits] = useState({
        minWithdrawalAmount: 0,
        maxWithdrawalAmount: 0,
    });
    const [limitDraft, setLimitDraft] = useState({
        minWithdrawalAmount: '',
        maxWithdrawalAmount: '',
    });
    const [savingLimits, setSavingLimits] = useState(false);

    const fetchData = async (sellerPageNum = 1) => {
        try {
            setLoading(true);
            const [sellerRes, financeSummaryRes, feeRes] = await Promise.all([
                adminApi.getSellerWithdrawals({ page: sellerPageNum, limit: pageSize }).catch(err => ({ data: { success: false, result: {} } })),
                adminApi.getFinanceSummary().catch(() => ({ data: { success: false, result: {} } })),
                adminApi.getFeeSettings().catch(() => ({ data: { success: false, result: {} } })),
            ]);

            if (sellerRes.data.success) {
                const payload = sellerRes.data.result || {};
                const items = Array.isArray(payload.items) ? payload.items : (sellerRes.data.results || []);
                setSellerRequests(items);
                setSellerTotal(typeof payload.total === 'number' ? payload.total : items.length);
                setSellerPage(typeof payload.page === 'number' ? payload.page : sellerPageNum);
            }
            if (financeSummaryRes.data.success) {
                setFinanceSummary(financeSummaryRes.data.result || {});
            }
            if (feeRes.data?.success) {
                const feeSettings =
                    feeRes.data?.data?.feeSettings ||
                    feeRes.data?.result?.feeSettings ||
                    feeRes.data?.result ||
                    {};
                const minWd = Number(feeSettings.minWithdrawalAmount || 0);
                const maxWd = Number(feeSettings.maxWithdrawalAmount || 0);
                setWithdrawalLimits({
                    minWithdrawalAmount: minWd,
                    maxWithdrawalAmount: maxWd,
                });
                setLimitDraft({
                    minWithdrawalAmount: String(minWd || ''),
                    maxWithdrawalAmount: String(maxWd || ''),
                });
            }
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error("Failed to fetch requests");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveWithdrawalLimits = async () => {
        if (!canEdit) {
            toast.error("You do not have permission to edit withdrawal limits");
            return;
        }
        const minWd = Math.max(0, Number(limitDraft.minWithdrawalAmount || 0));
        const maxWd = Math.max(0, Number(limitDraft.maxWithdrawalAmount || 0));
        if (maxWd > 0 && minWd > maxWd) {
            toast.error("Minimum cannot be greater than maximum");
            return;
        }
        try {
            setSavingLimits(true);
            const res = await adminApi.updateFeeSettings({
                minWithdrawalAmount: minWd,
                maxWithdrawalAmount: maxWd,
            });
            if (res.data?.success) {
                const feeSettings =
                    res.data?.data?.feeSettings ||
                    res.data?.result?.feeSettings ||
                    res.data?.result ||
                    {};
                setWithdrawalLimits({
                    minWithdrawalAmount: Number(feeSettings.minWithdrawalAmount ?? minWd),
                    maxWithdrawalAmount: Number(feeSettings.maxWithdrawalAmount ?? maxWd),
                });
                setLimitDraft({
                    minWithdrawalAmount: String(Number(feeSettings.minWithdrawalAmount ?? minWd) || ''),
                    maxWithdrawalAmount: String(Number(feeSettings.maxWithdrawalAmount ?? maxWd) || ''),
                });
                toast.success("Withdrawal limits saved");
            } else {
                toast.error(res.data?.message || "Failed to save limits");
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || "Failed to save limits");
        } finally {
            setSavingLimits(false);
        }
    };

    useEffect(() => {
        fetchData(sellerPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const fetchSellerPage = (p) => {
        fetchData(p);
        setSellerPage(p);
    };

    const stats = useMemo(() => {
        const sData = Array.isArray(sellerRequests) ? sellerRequests : [];

        return {
            sellers: {
                pending: sData.filter(r => r.status === 'Pending' || r.status === 'Processing').length,
                amount: Math.abs(sData.filter(r => r.status === 'Pending' || r.status === 'Processing').reduce((acc, r) => acc + (Number(r.amount) || 0), 0)),
                processed: sData.filter(r => r.status === 'Settled').length
            },
            sellerPendingToDistribute: Math.max(0, Number(financeSummary?.sellerPendingPayouts) || 0),
            unpaidWithdrawalPayout: Math.abs(
                (Number(sData.filter(r => r.status === 'Pending' || r.status === 'Processing').reduce((acc, r) => acc + (Number(r.amount) || 0), 0)) || 0)
            )
        };
    }, [sellerRequests, financeSummary]);

    const currentData = useMemo(() => {
        const data = sellerRequests || [];
        return data.filter(r => {
            const name = r.user?.shopName || r.user?.name || "";
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r._id?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || r.status?.toLowerCase() === filterStatus.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [sellerRequests, searchTerm, filterStatus]);

    const handleAction = (type, request) => {
        setRejectReason('');
        setActionModal({ isOpen: true, type, request });
    };

    const confirmAction = async () => {
        try {
            setLoading(true);
            const status = actionModal.type === 'approve' ? 'Settled' : 'Rejected';
            const body = { status };
            if (actionModal.type === 'reject') {
                if (!rejectReason.trim()) {
                    toast.error("Rejection reason is required");
                    return;
                }
                body.reason = rejectReason;
            }
            const res = await adminApi.updateWithdrawalStatus(actionModal.request._id, body);
            if (res.data.success) {
                toast.success(`Request ${status} successfully`);
                fetchData(sellerPage);
                setActionModal({ isOpen: false, type: null, request: null });
                setRejectReason('');
            }
        } catch (error) {
            toast.error("Action failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Withdrawal Requests
                        <Badge variant="primary" className="text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">Financial Hub</Badge>
                    </h1>
                    <p className="ds-description mt-1">Review and process fund disbursement requests from sellers.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchData(sellerPage)}
                        className="p-2.5 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all shadow-sm">
                        <Download className="h-4 w-4" />
                        EXPORT ALL
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Pending', value: `₹${(stats.sellerPendingToDistribute || 0).toLocaleString()}`, icon: Clock, color: 'amber', bg: 'bg-amber-50', iconColor: 'text-amber-500' },
                    { label: 'Pending Payout', value: `₹${(stats.unpaidWithdrawalPayout || 0).toLocaleString()}`, icon: Banknote, color: 'blue', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
                    { label: 'Settled Today', value: stats.sellers.processed, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
                ].map((stat, i) => (
                    <Card key={i} className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                        <div className="flex items-center gap-4">
                            <div className={cn("p-3 rounded-2xl", stat.bg)}>
                                <stat.icon className={cn("h-6 w-6", stat.iconColor)} />
                            </div>
                            <div>
                                <p className="ds-label mb-1">{stat.label}</p>
                                <h3 className="ds-stat-medium">{stat.value}</h3>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 bg-white">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Seller Withdrawal Limits</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Sellers can only request amounts between min and max. Set max to 0 for no upper limit.
                            Current: ₹{Number(withdrawalLimits.minWithdrawalAmount || 0).toLocaleString()}
                            {" — "}
                            {Number(withdrawalLimits.maxWithdrawalAmount || 0) > 0
                                ? `₹${Number(withdrawalLimits.maxWithdrawalAmount).toLocaleString()}`
                                : "No max"}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Min amount (₹)</label>
                            <input
                                type="number"
                                min="0"
                                value={limitDraft.minWithdrawalAmount}
                                onChange={(e) => setLimitDraft((prev) => ({ ...prev, minWithdrawalAmount: e.target.value }))}
                                disabled={!canEdit || savingLimits}
                                className="w-full sm:w-36 px-3 py-2.5 bg-slate-50 ring-1 ring-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Max amount (₹)</label>
                            <input
                                type="number"
                                min="0"
                                value={limitDraft.maxWithdrawalAmount}
                                onChange={(e) => setLimitDraft((prev) => ({ ...prev, maxWithdrawalAmount: e.target.value }))}
                                disabled={!canEdit || savingLimits}
                                className="w-full sm:w-36 px-3 py-2.5 bg-slate-50 ring-1 ring-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveWithdrawalLimits}
                            disabled={!canEdit || savingLimits}
                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {savingLimits ? "Saving..." : "Save Limits"}
                        </button>
                    </div>
                </div>
            </Card>

            {/* Main Interface Tab Structure */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 ml-auto">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by ID or Name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10 w-64 transition-all"
                            />
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            {['all', 'pending', 'settled'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all",
                                        filterStatus === status ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="ds-table-header-cell pl-8">Requester Details</th>
                                    <th className="ds-table-header-cell">Transaction ID</th>
                                    <th className="ds-table-header-cell text-center">Amount Requested</th>
                                    <th className="ds-table-header-cell">Gateway Status</th>
                                    <th className="ds-table-header-cell text-right pr-8">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {currentData.map((req, i) => (
                                    <tr key={req._id} className="group hover:bg-slate-50/30 transition-all">
                                        <td className="px-6 py-5 pl-8">
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner",
                                                    "bg-indigo-50 text-indigo-600"
                                                )}>
                                                    <Building2 className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedRequest(req)}>
                                                        {req.user?.shopName || req.user?.name || "Unknown"}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{req.user?.phone}</span>
                                                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{new Date(req.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[10px] font-mono font-bold text-slate-500">{req.reference || req._id}</span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <p className="text-sm font-black text-slate-900">₹{Math.abs(req.amount).toLocaleString()}</p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <Badge
                                                variant={req.status === 'Pending' ? 'warning' : req.status === 'Settled' ? 'success' : req.status === 'Processing' ? 'primary' : 'danger'}
                                                className="text-[9px] font-black px-3 py-1 uppercase tracking-wider"
                                            >
                                                {req.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-5 text-right pr-8">
                                            <div className="flex items-center justify-end gap-2">
                                                {req.status === 'Pending' && canEdit && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction('approve', req)}
                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all active:scale-90"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleAction('reject', req)}
                                                            className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-90"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => setSelectedRequest(req)}
                                                    className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-purple-600 hover:text-white transition-all active:scale-90"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {currentData.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                                    <FileText className="h-8 w-8 text-slate-200" />
                                                </div>
                                                <p className="text-slate-400 font-bold text-sm">No withdrawal requests found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-3 border-t border-slate-100">
                        <Pagination
                            page={sellerPage}
                            totalPages={Math.ceil((sellerTotal) / pageSize) || 1}
                            total={sellerTotal}
                            pageSize={pageSize}
                            onPageChange={fetchSellerPage}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setSellerPage(1);
                            }}
                            loading={loading}
                        />
                    </div>
                </Card>
            </div>

            {/* Request Detail Modal */}
            <Modal
                isOpen={!!selectedRequest}
                onClose={() => setSelectedRequest(null)}
                title="Withdrawal Intel"
                size="md"
            >
                {selectedRequest && (
                    <div className="ds-section-spacing">
                        <div className="flex items-center gap-6 p-6 bg-slate-50 rounded-xl border border-slate-100">
                            <div className={cn(
                                "h-20 w-20 rounded-xl flex items-center justify-center shadow-xl",
                                "bg-indigo-600 text-white"
                            )}>
                                <Building2 className="h-10 w-10" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">{selectedRequest.user?.shopName || selectedRequest.user?.name || "Unknown"}</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">{selectedRequest._id}</p>
                                <div className="flex items-center gap-2 mt-3">
                                    <Badge variant={selectedRequest.status === 'Pending' ? 'warning' : 'success'}>
                                        {selectedRequest.status.toUpperCase()}
                                    </Badge>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Requested on {new Date(selectedRequest.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <Card className="p-5 border-none bg-slate-50 ring-1 ring-slate-100 rounded-xl">
                                <p className="ds-label mb-2">Request Amount</p>
                                <h4 className="text-2xl font-black text-slate-900">₹{Math.abs(selectedRequest.amount).toLocaleString()}</h4>
                                <p className="text-[10px] font-semibold text-slate-400 mt-1">Reference: {selectedRequest.reference}</p>
                                <p className="text-[10px] font-semibold text-slate-400 mt-1 uppercase">
                                    Method: {selectedRequest.paymentMethod || selectedRequest.payoutDetails?.paymentMethod || 'N/A'}
                                </p>
                            </Card>

                            <Card className="p-5 border-none bg-white ring-1 ring-slate-100 rounded-xl space-y-3">
                                <p className="ds-label">Payout Destination</p>
                                {(selectedRequest.payoutDetails?.upiId || selectedRequest.bankDetails?.upiId) && (
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UPI ID</p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {selectedRequest.payoutDetails?.upiId || selectedRequest.bankDetails?.upiId}
                                        </p>
                                    </div>
                                )}
                                {(selectedRequest.payoutDetails?.upiQrImage || selectedRequest.bankDetails?.upiQrImage) && (
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">UPI QR</p>
                                        <img
                                            src={selectedRequest.payoutDetails?.upiQrImage || selectedRequest.bankDetails?.upiQrImage}
                                            alt="UPI QR"
                                            className="h-40 w-40 object-contain rounded-xl border border-slate-100 bg-slate-50"
                                        />
                                    </div>
                                )}
                                {(selectedRequest.payoutDetails?.bankName || selectedRequest.bankDetails?.bankName) && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank</p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {selectedRequest.payoutDetails?.bankName || selectedRequest.bankDetails?.bankName}
                                        </p>
                                        <p className="text-xs text-slate-600">
                                            {selectedRequest.payoutDetails?.accountHolderName || selectedRequest.bankDetails?.accountHolderName || '—'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {selectedRequest.payoutDetails?.accountNumber || selectedRequest.bankDetails?.accountNumber || (selectedRequest.payoutDetails?.accountNumberLast4 || selectedRequest.bankDetails?.accountNumberLast4 ? `**** ${selectedRequest.payoutDetails?.accountNumberLast4 || selectedRequest.bankDetails?.accountNumberLast4}` : '----')}
                                            {" • "}
                                            {selectedRequest.payoutDetails?.ifscCode || selectedRequest.bankDetails?.ifscCode || '—'}
                                        </p>
                                    </div>
                                )}
                                {!(selectedRequest.payoutDetails?.upiId || selectedRequest.bankDetails?.upiId || selectedRequest.payoutDetails?.bankName || selectedRequest.bankDetails?.bankName) && (
                                    <p className="text-xs text-slate-400">No payout details available on this request.</p>
                                )}
                            </Card>
                        </div>

                        <div className="flex gap-3 pt-2">
                            {selectedRequest.status === 'Pending' && canEdit ? (
                                <>
                                    <button
                                        onClick={() => { setSelectedRequest(null); handleAction('approve', selectedRequest); }}
                                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-200 transition-all active:scale-[0.98]"
                                    >
                                        Authorize Transfer
                                    </button>
                                    <button
                                        onClick={() => { setSelectedRequest(null); handleAction('reject', selectedRequest); }}
                                        className="flex-1 py-4 bg-white ring-1 ring-slate-200 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                                    >
                                        Deny Request
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setSelectedRequest(null)}
                                    className="w-full py-4 bg-purple-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest"
                                >
                                    Close Intelligence
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Action Confirmation Modal */}
            <Modal
                isOpen={actionModal.isOpen}
                onClose={() => !loading && setActionModal({ isOpen: false, type: null, request: null })}
                title="Confirm Financial Action"
                size="sm"
            >
                {actionModal.request && (
                    <div className="text-center space-y-6">
                        <div className={cn(
                            "h-16 w-16 rounded-xl flex items-center justify-center mx-auto",
                            actionModal.type === 'approve' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                            {actionModal.type === 'approve' ? <CheckCircle className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Are you sure?</h3>
                            <p className="text-sm font-medium text-slate-500 mt-2 px-6">
                                You are about to {actionModal.type === 'approve' ? 'approve' : 'reject'} the withdrawal request for <b className="text-slate-900">₹{Math.abs(actionModal.request.amount).toLocaleString()}</b>.
                            </p>
                            {actionModal.type === 'reject' && (
                                <div className="mt-4 px-6 text-left">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1 block">Reason for Rejection *</label>
                                    <textarea
                                        className="w-full p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-rose-500"
                                        placeholder="Please provide a valid reason..."
                                        rows={3}
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={confirmAction}
                                disabled={loading}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2",
                                    actionModal.type === 'approve' ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-rose-500 text-white shadow-rose-200"
                                )}
                            >
                                {loading && <RotateCw className="h-4 w-4 animate-spin" />}
                                {loading ? 'PROCESSING...' : `YES, ${actionModal.type.toUpperCase()}`}
                            </button>
                            <button
                                onClick={() => setActionModal({ isOpen: false, type: null, request: null })}
                                disabled={loading}
                                className="w-full py-4 bg-slate-50 text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all"
                            >
                                CANCEL
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default WithdrawalRequests;
