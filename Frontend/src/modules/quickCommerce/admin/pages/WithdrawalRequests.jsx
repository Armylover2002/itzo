import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
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
import { adminApi } from "../services/adminApi";
import { toast } from "sonner";

const WithdrawalRequests = () => {
    const [activeTab, setActiveTab] = useState('sellers');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState({ isOpen: false, type: null, request: null });
    const [settleTxnId, setSettleTxnId] = useState('');
    const [settleAdminNote, setSettleAdminNote] = useState('');

    const [sellerRequests, setSellerRequests] = useState([]);
    const [deliveryRequests, setDeliveryRequests] = useState([]);
    const [sellerPage, setSellerPage] = useState(1);
    const [deliveryPage, setDeliveryPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [sellerTotal, setSellerTotal] = useState(0);
    const [deliveryTotal, setDeliveryTotal] = useState(0);
    const [financeSummary, setFinanceSummary] = useState({});

    const fetchData = async (sellerPageNum = 1, deliveryPageNum = 1) => {
        try {
            setLoading(true);
            const [sellerRes, deliveryRes, financeSummaryRes] = await Promise.all([
                adminApi.getSellerWithdrawals({ page: sellerPageNum, limit: pageSize }).catch(err => ({ data: { success: false, result: {} } })),
                adminApi.getDeliveryWithdrawals({ page: deliveryPageNum, limit: pageSize }).catch(err => ({ data: { success: false, result: {} } })),
                adminApi.getFinanceSummary().catch(() => ({ data: { success: false, result: {} } })),
            ]);

            if (sellerRes.data.success) {
                const payload = sellerRes.data.result || {};
                const items = Array.isArray(payload.items) ? payload.items : (sellerRes.data.results || []);
                setSellerRequests(items);
                setSellerTotal(typeof payload.total === 'number' ? payload.total : items.length);
                setSellerPage(typeof payload.page === 'number' ? payload.page : sellerPageNum);
            }
            if (deliveryRes.data.success) {
                const payload = deliveryRes.data.result || {};
                const items = Array.isArray(payload.items) ? payload.items : (deliveryRes.data.results || []);
                setDeliveryRequests(items);
                setDeliveryTotal(typeof payload.total === 'number' ? payload.total : items.length);
                setDeliveryPage(typeof payload.page === 'number' ? payload.page : deliveryPageNum);
            }
            if (financeSummaryRes.data.success) {
                setFinanceSummary(financeSummaryRes.data.result || {});
            }
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error("Failed to fetch requests");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(sellerPage, deliveryPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const fetchSellerPage = (p) => {
        fetchData(p, deliveryPage);
        setSellerPage(p);
    };
    const fetchDeliveryPage = (p) => {
        fetchData(sellerPage, p);
        setDeliveryPage(p);
    };

    const stats = useMemo(() => {
        const sData = Array.isArray(sellerRequests) ? sellerRequests : [];
        const dData = Array.isArray(deliveryRequests) ? deliveryRequests : [];

        return {
            sellers: {
                pending: sData.filter(r => r.status === 'Pending' || r.status === 'Processing').length,
                amount: Math.abs(sData.filter(r => r.status === 'Pending' || r.status === 'Processing').reduce((acc, r) => acc + (Number(r.amount) || 0), 0)),
                processed: sData.filter(r => r.status === 'Settled').length
            },
            delivery: {
                pending: dData.filter(r => r.status === 'Pending' || r.status === 'Processing').length,
                amount: Math.abs(dData.filter(r => r.status === 'Pending' || r.status === 'Processing').reduce((acc, r) => acc + (Number(r.amount) || 0), 0)),
                processed: dData.filter(r => r.status === 'Settled').length
            },
            sellerPendingToDistribute: Math.max(0, Number(financeSummary?.sellerPendingPayouts) || 0),
            unpaidWithdrawalPayout: Math.abs(
                (Number(sData.filter(r => r.status === 'Pending' || r.status === 'Processing').reduce((acc, r) => acc + (Number(r.amount) || 0), 0)) || 0) +
                (Number(dData.filter(r => r.status === 'Pending' || r.status === 'Processing').reduce((acc, r) => acc + (Number(r.amount) || 0), 0)) || 0)
            )
        };
    }, [sellerRequests, deliveryRequests, financeSummary]);

    const currentData = useMemo(() => {
        const data = activeTab === 'sellers' ? (sellerRequests || []) : (deliveryRequests || []);
        return data.filter(r => {
            const name = r.user?.shopName || r.user?.name || "";
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r._id?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || r.status?.toLowerCase() === filterStatus.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [activeTab, sellerRequests, deliveryRequests, searchTerm, filterStatus]);

    const handleAction = (type, request) => {
        setActionModal({ isOpen: true, type, request });
    };

    const confirmAction = async () => {
        try {
            setLoading(true);
            const status = actionModal.type === 'approve' ? 'Settled' : 'Rejected';

            if (actionModal.type === 'approve' && !settleTxnId.trim()) {
                toast.error('Please enter the Transaction ID / UTR before approving');
                setLoading(false);
                return;
            }

            const res = await adminApi.updateWithdrawalStatus(actionModal.request._id, {
                status,
                transactionId: settleTxnId.trim(),
                adminNote: settleAdminNote.trim(),
            });
            if (res.data.success) {
                toast.success(`Request ${status} successfully`);
                fetchData(sellerPage, deliveryPage);
                setActionModal({ isOpen: false, type: null, request: null });
                setSettleTxnId('');
                setSettleAdminNote('');
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
                    <p className="ds-description mt-1">Review and process fund disbursement requests from sellers and delivery partners.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchData(sellerPage, deliveryPage)}
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
                    { label: 'Pending Payout', value: `₹${(stats.unpaidWithdrawalPayout || 0).toLocaleString()}`, icon: Banknote, color: 'orange', bg: 'bg-orange-50', iconColor: 'text-primary' },
                    { label: 'Settled Today', value: stats.sellers.processed + stats.delivery.processed, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
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

            {/* Main Interface Tab Structure */}
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('sellers')}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all",
                                activeTab === 'sellers' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Building2 className="h-4 w-4" />
                            SELLER REQUESTS
                            <span className={cn(
                                "ml-1 px-2 py-0.5 rounded-full text-[10px]",
                                activeTab === 'sellers' ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
                            )}>{sellerRequests.length}</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('delivery')}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all",
                                activeTab === 'delivery' ? "bg-white text-slate-900 shadow-md" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Truck className="h-4 w-4" />
                            DELIVERY PARTNERS
                            <span className={cn(
                                "ml-1 px-2 py-0.5 rounded-full text-[10px]",
                                activeTab === 'delivery' ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
                            )}>{deliveryRequests.length}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
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
                                                    activeTab === 'sellers' ? "bg-orange-50 text-primary" : "bg-emerald-50 text-emerald-600"
                                                )}>
                                                    {activeTab === 'sellers' ? <Building2 className="h-6 w-6" /> : <Truck className="h-6 w-6" />}
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
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAction('approve', req)}
                                                            className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-primary-foreground transition-all active:scale-90"
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
                                                    className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all active:scale-90"
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
                                                <p className="text-slate-400 font-bold text-sm">No withdrawal requests found for this category.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-3 border-t border-slate-100">
                        <Pagination
                            page={activeTab === 'sellers' ? sellerPage : deliveryPage}
                            totalPages={Math.ceil((activeTab === 'sellers' ? sellerTotal : deliveryTotal) / pageSize) || 1}
                            total={activeTab === 'sellers' ? sellerTotal : deliveryTotal}
                            pageSize={pageSize}
                            onPageChange={activeTab === 'sellers' ? fetchSellerPage : fetchDeliveryPage}
                            onPageSizeChange={(newSize) => {
                                setPageSize(newSize);
                                setSellerPage(1);
                                setDeliveryPage(1);
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
                                activeTab === 'sellers' ? "bg-primary text-white" : "bg-emerald-600 text-white"
                            )}>
                                {activeTab === 'sellers' ? <Building2 className="h-10 w-10" /> : <Truck className="h-10 w-10" />}
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
                            </Card>

                            {/* Seller Payment Details */}
                            <Card className="p-5 border-none bg-orange-50/50 ring-1 ring-orange-100 rounded-xl">
                                <p className="ds-label mb-3 text-orange-700">Seller's Payment Details</p>
                                {selectedRequest.paymentMethod === 'qr' && selectedRequest.bankDetails?.qrCodeImage ? (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">QR Code</p>
                                        <img src={selectedRequest.bankDetails.qrCodeImage} alt="Seller QR Code" className="w-full max-w-[220px] mx-auto rounded-xl border border-slate-200 shadow-sm" />
                                    </div>
                                ) : selectedRequest.paymentMethod === 'upi' && selectedRequest.bankDetails?.upiId ? (
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">UPI ID</p>
                                        <p className="text-sm font-black text-slate-900 bg-white px-4 py-2.5 rounded-xl ring-1 ring-slate-100">{selectedRequest.bankDetails.upiId}</p>
                                    </div>
                                ) : selectedRequest.bankDetails?.bankName ? (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Bank Transfer</p>
                                        <div className="bg-white p-4 rounded-xl ring-1 ring-slate-100 space-y-1.5">
                                            <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase">Bank</span><span className="text-xs font-black text-slate-900">{selectedRequest.bankDetails.bankName}</span></div>
                                            <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase">Holder</span><span className="text-xs font-black text-slate-900">{selectedRequest.bankDetails.accountHolderName}</span></div>
                                            <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase">Acct</span><span className="text-xs font-black text-slate-900">****{selectedRequest.bankDetails.accountNumberLast4}</span></div>
                                            <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400 uppercase">IFSC</span><span className="text-xs font-black text-slate-900">{selectedRequest.bankDetails.ifscCode}</span></div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-slate-400 italic">No payment details provided by seller.</p>
                                )}
                            </Card>
                        </div>

                        <div className="flex gap-3 pt-2">
                            {selectedRequest.status === 'Pending' ? (
                                <>
                                    <button
                                        onClick={() => { setSelectedRequest(null); handleAction('approve', selectedRequest); }}
                                        className="flex-1 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                                    >
                                        Mark as Settled
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
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Action Confirmation Modal */}
            <Modal
                isOpen={actionModal.isOpen}
                onClose={() => { if (!loading) { setActionModal({ isOpen: false, type: null, request: null }); setSettleTxnId(''); setSettleAdminNote(''); } }}
                title="Confirm Financial Action"
                size="sm"
            >
                {actionModal.request && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className={cn(
                                "h-16 w-16 rounded-xl flex items-center justify-center mx-auto",
                                actionModal.type === 'approve' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                                {actionModal.type === 'approve' ? <CheckCircle className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mt-4">{actionModal.type === 'approve' ? 'Mark as Settled' : 'Reject Request'}</h3>
                            <p className="text-sm font-medium text-slate-500 mt-2 px-4">
                                {actionModal.type === 'approve'
                                    ? <>Ensure you have <b className="text-slate-900">manually transferred ₹{Math.abs(actionModal.request.amount).toLocaleString()}</b> to the seller before marking as settled.</>
                                    : <>You are about to reject the withdrawal request for <b className="text-slate-900">₹{Math.abs(actionModal.request.amount).toLocaleString()}</b>.</>}
                            </p>
                        </div>

                        {actionModal.type === 'approve' && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Transaction ID / UTR *</label>
                                    <input
                                        type="text"
                                        value={settleTxnId}
                                        onChange={(e) => setSettleTxnId(e.target.value)}
                                        placeholder="e.g. UTR123456789 or NEFT ref"
                                        className="w-full px-4 py-3 bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-primary/20 rounded-xl text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Admin Remark (optional)</label>
                                    <input
                                        type="text"
                                        value={settleAdminNote}
                                        onChange={(e) => setSettleAdminNote(e.target.value)}
                                        placeholder="e.g. Paid via NEFT on 22 Jul"
                                        className="w-full px-4 py-3 bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-primary/20 rounded-xl text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>
                        )}

                        {actionModal.type === 'reject' && (
                            <div>
                                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1.5 block">Rejection Reason (optional)</label>
                                <input
                                    type="text"
                                    value={settleAdminNote}
                                    onChange={(e) => setSettleAdminNote(e.target.value)}
                                    placeholder="e.g. Incorrect bank details"
                                    className="w-full px-4 py-3 bg-white ring-1 ring-slate-200 focus:ring-2 focus:ring-rose-100 rounded-xl text-sm font-bold outline-none transition-all placeholder:text-slate-300"
                                />
                            </div>
                        )}

                        <div className="space-y-3">
                            <button
                                onClick={confirmAction}
                                disabled={loading}
                                className={cn(
                                    "w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2",
                                    actionModal.type === 'approve' ? "bg-primary text-primary-foreground shadow-primary/20" : "bg-rose-500 text-white shadow-rose-200"
                                )}
                            >
                                {loading && <RotateCw className="h-4 w-4 animate-spin" />}
                                {loading ? 'PROCESSING...' : actionModal.type === 'approve' ? 'CONFIRM SETTLEMENT' : 'CONFIRM REJECTION'}
                            </button>
                            <button
                                onClick={() => { setActionModal({ isOpen: false, type: null, request: null }); setSettleTxnId(''); setSettleAdminNote(''); }}
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
