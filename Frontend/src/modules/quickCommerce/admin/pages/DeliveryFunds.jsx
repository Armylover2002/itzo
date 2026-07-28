import React, { useState, useMemo, useEffect } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import {
    Search,
    Filter,
    Wallet,
    Banknote,
    ArrowUpRight,
    Clock,
    CheckCircle,
    XCircle,
    RotateCw,
    CreditCard,
    Landmark,
    Undo2,
    FileText,
    ShieldCheck,
    MessageSquare,
    Users,
    Eye,
    X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@shared/components/ui/Pagination';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';

const DeliveryFunds = () => {
    const [transfers, setTransfers] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewingTxn, setViewingTxn] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchTransactions = async (requestedPage = 1) => {
        setIsLoading(true);
        try {
            const response = await adminApi.getDeliveryTransactions({ page: requestedPage, limit: pageSize });
            const payload = response.data.result || {};
            const data = Array.isArray(payload.items) ? payload.items : (response.data.results || []);

            // Map backend Transaction model to frontend format
            const mapped = data.map(tx => ({
                id: tx.reference,
                _id: tx._id,
                riderName: tx.user?.name || 'Unknown',
                riderId: tx.user?._id?.slice(-6).toUpperCase() || 'N/A',
                amount: Math.abs(tx.amount),
                status: tx.status?.toLowerCase() || 'pending',
                paymentMethod: 'Bank Transfer',
                accountInfo: tx.user?.documents?.bankDetails || 'No details',
                dateTime: new Date(tx.createdAt || tx.date).toLocaleString(),
                referenceId: tx.reference,
                type: tx.type
            }));
            setTransfers(mapped);
            setTotal(typeof payload.total === 'number' ? payload.total : mapped.length);
            setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
        } catch (error) {
            console.error("Fetch Transactions Error:", error);
            toast.error("Failed to load transactions");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    const handleBulkSettle = async () => {
        if (!window.confirm("Are you sure you want to settle all pending transactions?")) return;
        setIsProcessing(true);
        try {
            await adminApi.bulkSettleDelivery();
            toast.success("Bulk settlement processed");
            fetchTransactions(page);
        } catch (error) {
            toast.error("Bulk settlement failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSettleSingle = async (id) => {
        try {
            await adminApi.settleTransaction(id);
            toast.success("Transaction settled");
            fetchTransactions(page);
        } catch (error) {
            toast.error("Settlement failed");
        }
    };

    const filteredTransfers = useMemo(() => {
        return transfers.filter(tx => {
            const matchesSearch = tx.riderName.toLowerCase().includes(searchTerm.toLowerCase()) || tx.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [transfers, searchTerm, filterStatus]);

    const stats = useMemo(() => {
        const settled = transfers.filter(tx => tx.status === 'settled').reduce((acc, tx) => acc + tx.amount, 0);
        const pending = transfers.filter(tx => tx.status === 'pending').reduce((acc, tx) => acc + tx.amount, 0);
        const float = transfers.reduce((acc, tx) => acc + tx.amount, 0);

        return [
            { label: 'Total Settled', value: `₹${settled.toLocaleString()}`, icon: Banknote, color: 'emerald' },
            { label: 'Pending Payouts', value: `₹${pending.toLocaleString()}`, icon: Clock, color: 'amber' },
            { label: 'System Float', value: `₹${float.toLocaleString()}`, icon: Wallet, color: 'orange' },
            { label: 'Riders Involved', value: [...new Set(transfers.map(tx => tx.riderId))].length, icon: Users, color: 'rose' },
        ];
    }, [transfers]);

    return (
        <div className="ds-section-spacing animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="ds-h1 flex items-center gap-3">
                        Funds Settlement
                        <div className="p-1.5 bg-emerald-100 rounded-lg shadow-inner">
                            <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        </div>
                    </h1>
                    <p className="ds-description mt-1">Audit and execute secure fund transfers to your fleet partners.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBulkSettle}
                        disabled={isProcessing}
                        className="flex items-center space-x-2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-95 group disabled:opacity-50"
                    >
                        {isProcessing ? <RotateCw className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4 group-hover:scale-110 transition-transform" />}
                        <span>{isProcessing ? 'PROCESSING...' : 'BULK SETTLE ALL'}</span>
                    </button>
                </div>
            </div>

            {/* Financial Multi-Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <Card key={idx} className="p-6 border-none shadow-xl ring-1 ring-slate-100 hover:ring-primary/20 transition-all group relative overflow-hidden bg-white">
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn(
                                "p-3.5 rounded-2xl transition-all duration-500 group-hover:rotate-12 shadow-lg",
                                stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-600 shadow-emerald-100" :
                                    stat.color === 'amber' ? "bg-amber-500/10 text-amber-600 shadow-amber-100" :
                                        stat.color === 'orange' ? "bg-primary/10 text-primary shadow-orange-100" :
                                            "bg-rose-500/10 text-rose-600 shadow-rose-100"
                            )}>
                                <stat.icon className="h-6 w-6" strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="ds-label mb-1.5">{stat.label}</p>
                                <h3 className="ds-stat-medium">{stat.value}</h3>
                            </div>
                        </div>
                        <div className="absolute right-0 top-0 opacity-[0.03] translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
                            <stat.icon className="h-32 w-32" strokeWidth={1} />
                        </div>
                    </Card>
                ))}
            </div>

            {/* Utility Ledger Bar */}
            <Card className="p-4 border-none shadow-lg ring-1 ring-slate-100/50 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Find transaction by ID or rider name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border-none rounded-2xl text-xs font-semibold outline-none ring-1 ring-slate-100 focus:ring-2 focus:ring-primary/10 transition-all shadow-inner"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100/50 p-1.5 rounded-2xl flex items-center gap-1">
                            {['all', 'completed', 'pending', 'failed'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                        filterStatus === status
                                            ? "bg-white text-slate-900 shadow-md"
                                            : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                        <button className="p-3.5 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-600 hover:text-primary transition-all shadow-sm">
                            <Filter className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Funds Ledger Table */}
            <Card className="border-none shadow-2xl ring-1 ring-slate-100 overflow-hidden bg-white rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <th className="ds-table-header-cell pl-12">Transaction Node</th>
                                <th className="ds-table-header-cell">Rider Entity</th>
                                <th className="ds-table-header-cell text-center">Amount</th>
                                <th className="ds-table-header-cell">Gateway Status</th>
                                <th className="ds-table-header-cell text-right pr-12">Ledger Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-10 w-10 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditing Ledger...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTransfers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <FileText className="h-10 w-10 text-slate-300" />
                                            <p className="text-sm font-bold text-slate-500">No transactions found for this period.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTransfers.map((tx) => (
                                    <tr key={tx._id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                        <td className="px-5 py-7 pl-12">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-xl bg-slate-900/5 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                                                    <ArrowUpRight className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-900 tracking-tight">{tx.id}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{tx.type}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-7">
                                            <div>
                                                <p className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{tx.riderName}</p>
                                                <span className="text-[10px] font-bold text-slate-400">{tx.riderId}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-7 text-center">
                                            <div className="flex flex-col items-center">
                                                <p className="text-sm font-black text-slate-900">₹{tx.amount.toLocaleString()}</p>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{tx.paymentMethod}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-7">
                                            <div className="flex items-center gap-2">
                                                {tx.status === 'settled' ? (
                                                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                                                ) : tx.status === 'pending' ? (
                                                    <Clock className="h-4 w-4 text-amber-500 shrink-0 animate-spin-slow" />
                                                ) : (
                                                    <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                                                )}
                                                <Badge variant={tx.status === 'settled' ? 'success' : tx.status === 'pending' ? 'warning' : 'destructive'} className="text-[8px] font-black uppercase tracking-wider px-2">
                                                    {tx.status}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="px-4 py-7 text-right pr-12">
                                            <div className="flex items-center justify-end gap-2">
                                                {tx.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleSettleSingle(tx._id)}
                                                        className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95"
                                                        title="Settle Transaction"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setViewingTxn(tx)}
                                                    className="p-3 bg-white ring-1 ring-slate-200 rounded-2xl text-slate-400 hover:text-slate-900 hover:ring-slate-900 transition-all shadow-sm active:scale-95"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-slate-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchTransactions(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>

            {/* Detailed Transaction Modal (Receipt Style) */}
            <AnimatePresence>
                {viewingTxn && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setViewingTxn(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="w-full max-w-lg relative z-10 bg-white rounded-2xl shadow-3xl overflow-hidden"
                        >
                            <div className="p-5">
                                <div className="flex justify-between items-center mb-10">
                                    <h3 className="ds-h2 uppercase tracking-widest">Ledger Entry</h3>
                                    <div className="flex items-center gap-2">
                                        {viewingTxn.status === 'pending' && (
                                            <button
                                                onClick={() => {
                                                    handleSettleSingle(viewingTxn._id);
                                                    setViewingTxn(null);
                                                }}
                                                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-all"
                                            >
                                                SETTLE NOW
                                            </button>
                                        )}
                                        <button onClick={() => setViewingTxn(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
                                            <XCircle className="h-6 w-6" />
                                        </button>
                                    </div>
                                </div>

                                <div className="text-center mb-10">
                                    <div className={cn(
                                        "h-20 w-20 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg",
                                        viewingTxn.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                                            viewingTxn.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                                    )}>
                                        <Banknote className="h-10 w-10" />
                                    </div>
                                    <h4 className="text-3xl font-black text-slate-900 tracking-tight">₹{viewingTxn.amount.toLocaleString()}</h4>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        <Badge variant={viewingTxn.status === 'completed' ? 'success' : 'warning'} className="uppercase font-black text-[9px]">
                                            {viewingTxn.status}
                                        </Badge>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewingTxn.id}</span>
                                    </div>
                                </div>

                                <div className="space-y-6 pt-6 border-t border-dashed border-slate-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fleet Partner</p>
                                            <p className="text-sm font-bold text-slate-900">{viewingTxn.riderName}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{viewingTxn.riderId}</p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Entry Date</p>
                                            <p className="text-sm font-bold text-slate-900">{viewingTxn.dateTime}</p>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-slate-50 rounded-xl space-y-4">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</p>
                                            <div className="flex items-center gap-2">
                                                <CreditCard className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-900">{viewingTxn.paymentMethod}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</p>
                                            <div className="flex items-center gap-2">
                                                <Landmark className="h-4 w-4 text-slate-400" />
                                                <span className="text-xs font-bold text-slate-900">{viewingTxn.accountInfo}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref. ID</p>
                                            <span className="text-xs font-black text-slate-900 font-mono tracking-tight">{viewingTxn.referenceId}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 flex gap-4">
                                    <button className="flex-1 py-4.5 bg-primary text-primary-foreground rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-primary/90 hover:shadow-primary/20 active:scale-95 transition-all">
                                        Download Receipt
                                    </button>
                                    <button className="p-4.5 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all">
                                        <MessageSquare className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DeliveryFunds;
